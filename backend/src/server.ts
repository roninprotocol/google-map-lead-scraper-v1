import 'dotenv/config';

import { randomUUID } from 'crypto';
import { createServer } from 'http';

import cors from 'cors';
import express, { type NextFunction, type Request, type Response } from 'express';

import { formatResults, type Business } from './lib/formatter';
import { scrape, type ScraperEvent } from './lib/scraper';

type ApiMeta = {
  requestId: string;
  timestamp: string;
};

type ApiSuccess<T> = {
  success: true;
  data: T;
  meta: ApiMeta;
};

type ApiFailure = {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta: ApiMeta;
};

type StreamEvent =
  | {
      type: 'progress';
      data: {
        message: string;
        timestamp: string;
      };
    }
  | {
      type: 'result';
      data: Business;
    }
  | {
      type: 'done';
      data: {
        count: number;
        durationMs: number;
      };
    }
  | {
      type: 'error';
      error: {
        code: string;
        message: string;
      };
      data?: {
        durationMs?: number;
      };
    };

type JobStatus = 'queued' | 'running' | 'success' | 'error';

type Job = {
  id: string;
  status: JobStatus;
  createdAt: number;
  updatedAt: number;
  startedAt: number | null;
  finishedAt: number | null;
  events: StreamEvent[];
  clients: Set<Response>;
  cleanupTimer: NodeJS.Timeout | null;
};

const DEFAULT_ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:4173',
  'http://127.0.0.1:4173',
];

const DEFAULT_PORT = 3000;
const DEFAULT_SCRAPE_TIMEOUT_MS = 300000;
const DEFAULT_JOB_RETENTION_MS = 600000;
const DEFAULT_RATE_LIMIT_WINDOW_MS = 60000;
const DEFAULT_RATE_LIMIT_MAX_REQUESTS = 3;
const MAX_STORED_EVENTS = 200;

const jobs = new Map<string, Job>();
const rateLimits = new Map<string, { count: number; resetTime: number }>();

function nowIso() {
  return new Date().toISOString();
}

function toPositiveInteger(rawValue: string | undefined, fallbackValue: number) {
  const parsedValue = Number.parseInt(rawValue || '', 10);
  return Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : fallbackValue;
}

function splitOrigins(rawValue: string | undefined) {
  return rawValue
    ?.split(',')
    .map((value) => value.trim())
    .filter(Boolean) ?? [];
}

function escapeRegex(value: string) {
  return value.replace(/[|\\{}()[\]^$+?.]/g, '\\$&');
}

function createOriginMatcher(originPattern: string) {
  if (originPattern.includes('*')) {
    const regex = new RegExp(`^${originPattern.split('*').map(escapeRegex).join('.*')}$`);
    return (origin: string) => regex.test(origin);
  }

  return (origin: string) => origin === originPattern;
}

function getAllowedOriginMatchers() {
  const patterns = [...new Set([...DEFAULT_ALLOWED_ORIGINS, ...splitOrigins(process.env.CORS_ALLOWED_ORIGINS)])];
  return patterns.map(createOriginMatcher);
}

function getRequestMeta(response: Response): ApiMeta {
  return {
    requestId: response.locals.requestId as string,
    timestamp: nowIso(),
  };
}

function sendSuccess<T>(response: Response, statusCode: number, data: T) {
  const payload: ApiSuccess<T> = {
    success: true,
    data,
    meta: getRequestMeta(response),
  };

  response.status(statusCode).json(payload);
}

function sendError(
  response: Response,
  statusCode: number,
  code: string,
  message: string,
  details?: unknown
) {
  const payload: ApiFailure = {
    success: false,
    error: {
      code,
      message,
      ...(details !== undefined ? { details } : {}),
    },
    meta: getRequestMeta(response),
  };

  response.status(statusCode).json(payload);
}

function createJob(jobId: string): Job {
  return {
    id: jobId,
    status: 'queued',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    startedAt: null,
    finishedAt: null,
    events: [],
    clients: new Set<Response>(),
    cleanupTimer: null,
  };
}

function scheduleJobCleanup(job: Job, retentionMs: number) {
  if (job.cleanupTimer) {
    clearTimeout(job.cleanupTimer);
  }

  job.cleanupTimer = setTimeout(() => {
    jobs.delete(job.id);
  }, retentionMs);
}

function writeEvent(response: Response, event: StreamEvent) {
  response.write(`data: ${JSON.stringify(event)}\n\n`);
}

function pushJobEvent(job: Job, event: StreamEvent, jobRetentionMs: number) {
  job.updatedAt = Date.now();
  job.events.push(event);

  if (job.events.length > MAX_STORED_EVENTS) {
    job.events.splice(0, job.events.length - MAX_STORED_EVENTS);
  }

  for (const client of [...job.clients]) {
    if (client.writableEnded) {
      job.clients.delete(client);
      continue;
    }

    writeEvent(client, event);
  }

  if (event.type === 'done' || event.type === 'error') {
    job.status = event.type === 'done' ? 'success' : 'error';
    job.finishedAt = Date.now();
    scheduleJobCleanup(job, jobRetentionMs);
  }
}

function createProgressEvent(message: string): StreamEvent {
  return {
    type: 'progress',
    data: {
      message,
      timestamp: nowIso(),
    },
  };
}

function createErrorEvent(code: string, message: string, durationMs?: number): StreamEvent {
  return {
    type: 'error',
    error: { code, message },
    ...(durationMs !== undefined ? { data: { durationMs } } : {}),
  };
}

function normalizeScraperEvent(event: ScraperEvent): StreamEvent | null {
  if (event.type === 'progress') {
    return createProgressEvent(event.message);
  }

  const formattedRecord = formatResults([event.data])[0];
  return formattedRecord ? { type: 'result', data: formattedRecord } : null;
}

function consumeRateLimit(ipAddress: string, maxRequests: number, windowMs: number) {
  const currentTime = Date.now();
  const currentLimit = rateLimits.get(ipAddress);

  if (!currentLimit || currentTime >= currentLimit.resetTime) {
    rateLimits.set(ipAddress, {
      count: 1,
      resetTime: currentTime + windowMs,
    });
    return { allowed: true, retryAfterMs: 0 };
  }

  if (currentLimit.count >= maxRequests) {
    return { allowed: false, retryAfterMs: currentLimit.resetTime - currentTime };
  }

  currentLimit.count += 1;
  return { allowed: true, retryAfterMs: 0 };
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return 'An unexpected server error occurred.';
}

async function runScrapeJob(
  job: Job,
  keyword: string,
  location: string,
  scrapeTimeoutMs: number,
  jobRetentionMs: number
) {
  const abortController = new AbortController();
  const timeoutId = setTimeout(() => {
    abortController.abort(new Error('Scrape timed out. Try a more specific keyword or city.'));
  }, scrapeTimeoutMs);

  job.status = 'running';
  job.startedAt = Date.now();
  pushJobEvent(job, createProgressEvent(`Starting scrape for ${keyword} in ${location}.`), jobRetentionMs);

  try {
    const rawResults = await scrape(
      keyword,
      location,
      (event) => {
        const streamEvent = normalizeScraperEvent(event);
        if (streamEvent) {
          pushJobEvent(job, streamEvent, jobRetentionMs);
        }
      },
      abortController.signal
    );
    const formattedResults = formatResults(rawResults);
    const durationMs = Date.now() - (job.startedAt ?? Date.now());

    if (formattedResults.length === 0) {
      pushJobEvent(
        job,
        createErrorEvent('NO_RESULTS', 'No businesses found. Try a different keyword or city.', durationMs),
        jobRetentionMs
      );
      return;
    }

    pushJobEvent(job, createProgressEvent(`Prepared ${formattedResults.length} lead records.`), jobRetentionMs);
    pushJobEvent(
      job,
      {
        type: 'done',
        data: {
          count: formattedResults.length,
          durationMs,
        },
      },
      jobRetentionMs
    );
  } catch (error) {
    const durationMs = job.startedAt ? Date.now() - job.startedAt : undefined;
    const isTimeout = abortController.signal.aborted;
    const errorCode = isTimeout ? 'SCRAPE_TIMEOUT' : 'SCRAPE_FAILED';
    const message = isTimeout ? 'Scrape timed out. Try a more specific keyword or city.' : getErrorMessage(error);

    console.error(`Scraping error for job ${job.id}:`, error);
    pushJobEvent(job, createErrorEvent(errorCode, message, durationMs), jobRetentionMs);
  } finally {
    clearTimeout(timeoutId);
  }
}

const app = express();
const allowedOriginMatchers = getAllowedOriginMatchers();
const scrapeTimeoutMs = toPositiveInteger(process.env.SCRAPE_TIMEOUT_MS, DEFAULT_SCRAPE_TIMEOUT_MS);
const jobRetentionMs = toPositiveInteger(process.env.JOB_RETENTION_MS, DEFAULT_JOB_RETENTION_MS);
const rateLimitWindowMs = toPositiveInteger(process.env.RATE_LIMIT_WINDOW_MS, DEFAULT_RATE_LIMIT_WINDOW_MS);
const rateLimitMaxRequests = toPositiveInteger(process.env.RATE_LIMIT_MAX_REQUESTS, DEFAULT_RATE_LIMIT_MAX_REQUESTS);
const port = toPositiveInteger(process.env.PORT, DEFAULT_PORT);

app.disable('x-powered-by');
app.set('trust proxy', 1);

app.use((request, response, next) => {
  const requestId = request.header('x-request-id') || randomUUID();
  response.locals.requestId = requestId;
  response.setHeader('X-Request-Id', requestId);
  next();
});

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) {
        callback(null, true);
        return;
      }

      const isAllowed = allowedOriginMatchers.some((matcher) => matcher(origin));

      if (isAllowed) {
        callback(null, true);
        return;
      }

      callback(new Error(`Origin ${origin} is not allowed by CORS.`));
    },
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'X-Request-Id'],
  })
);
app.use(express.json({ limit: '1mb' }));

app.get('/health', (_request, response) => {
  sendSuccess(response, 200, {
    status: 'ok',
    service: 'google-maps-lead-scraper-backend',
    uptimeSeconds: Math.round(process.uptime()),
  });
});

app.post('/scrape', (request, response) => {
  const keyword = typeof request.body?.keyword === 'string' ? request.body.keyword.trim() : '';
  const location = typeof request.body?.location === 'string' ? request.body.location.trim() : '';

  if (!keyword || !location) {
    sendError(response, 400, 'VALIDATION_ERROR', 'Both keyword and location are required.');
    return;
  }

  const ipAddress = request.ip || request.socket.remoteAddress || 'unknown';
  const rateLimit = consumeRateLimit(ipAddress, rateLimitMaxRequests, rateLimitWindowMs);

  if (!rateLimit.allowed) {
    response.setHeader('Retry-After', Math.ceil(rateLimit.retryAfterMs / 1000));
    sendError(response, 429, 'RATE_LIMITED', 'Too many requests. Please wait before trying again.', {
      retryAfterMs: rateLimit.retryAfterMs,
    });
    return;
  }

  const job = createJob(randomUUID());
  jobs.set(job.id, job);
  sendSuccess(response, 202, {
    jobId: job.id,
    progressUrl: `/progress/${job.id}`,
    timeoutMs: scrapeTimeoutMs,
  });

  void runScrapeJob(job, keyword, location, scrapeTimeoutMs, jobRetentionMs);
});

app.get('/progress/:jobId', (request, response) => {
  const job = jobs.get(request.params.jobId);

  if (!job) {
    sendError(response, 404, 'JOB_NOT_FOUND', 'The requested scrape job could not be found.');
    return;
  }

  response.setHeader('Content-Type', 'text/event-stream');
  response.setHeader('Cache-Control', 'no-cache, no-transform');
  response.setHeader('Connection', 'keep-alive');
  response.flushHeaders();
  response.write(': connected\n\n');

  for (const event of job.events) {
    writeEvent(response, event);
  }

  if (job.status === 'success' || job.status === 'error') {
    setTimeout(() => {
      if (!response.writableEnded) {
        response.end();
      }
    }, 250);
    return;
  }

  const heartbeat = setInterval(() => {
    response.write(': ping\n\n');
  }, 15000);

  job.clients.add(response);

  request.on('close', () => {
    clearInterval(heartbeat);
    job.clients.delete(response);
  });
});

app.use((_request, response) => {
  sendError(response, 404, 'NOT_FOUND', 'Route not found.');
});

app.use((error: Error, _request: Request, response: Response, _next: NextFunction) => {
  if (error instanceof SyntaxError && 'body' in error) {
    sendError(response, 400, 'INVALID_JSON', 'The request body must be valid JSON.');
    return;
  }

  if (error.message.includes('not allowed by CORS')) {
    sendError(response, 403, 'CORS_FORBIDDEN', error.message);
    return;
  }

  console.error('Unhandled server error:', error);
  sendError(response, 500, 'INTERNAL_SERVER_ERROR', 'An unexpected server error occurred.');
});

const server = createServer(app);
server.keepAliveTimeout = 65000;
server.headersTimeout = 66000;
server.requestTimeout = 120000;

server.listen(port, '0.0.0.0', () => {
  console.log(`Backend server running on http://0.0.0.0:${port}`);
});

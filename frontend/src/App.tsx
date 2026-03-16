import { useDeferredValue, useEffect, useRef, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Command,
  Database,
  Download,
  Github,
  Linkedin,
  RefreshCcw,
  Sparkles,
} from 'lucide-react';
import SearchForm from './components/SearchForm';
import ResultsTable from './components/ResultsTable';
import StatusLog from './components/StatusLog';
import { createProgressEventSource, getApiErrorMessage, startScrape } from './lib/api';
import type { BusinessRecord, ScrapeStreamEvent, Status } from './types';
import { downloadCSV } from './utils/exportCSV';

const creatorLinks = {
  github: 'https://github.com/',
  linkedin: 'https://www.linkedin.com/',
};

function deriveProgress(messages: string[], resultsCount: number) {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    const extractionMatch = message.match(/Extracting result (\d+) of (\d+)/i);
    if (extractionMatch) {
      return {
        processed: Math.max(resultsCount, Number(extractionMatch[1])),
        total: Number(extractionMatch[2]),
      };
    }

    const listingMatch = message.match(/Found (\d+) business listings/i);
    if (listingMatch) {
      const total = Math.min(20, Number(listingMatch[1]));
      return {
        processed: resultsCount,
        total: total || 20,
      };
    }
  }

  return {
    processed: resultsCount,
    total: Math.max(resultsCount, 20),
  };
}

function formatElapsed(ms: number) {
  if (!ms || ms < 1000) {
    return '0s';
  }

  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes === 0) {
    return `${seconds}s`;
  }

  return `${minutes}m ${String(seconds).padStart(2, '0')}s`;
}

export default function App() {
  const [status, setStatus] = useState<Status>('idle');
  const [results, setResults] = useState<BusinessRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [currentKeyword, setCurrentKeyword] = useState('');
  const [currentLocation, setCurrentLocation] = useState('');
  const [logMessages, setLogMessages] = useState<string[]>([]);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [finishedAt, setFinishedAt] = useState<number | null>(null);
  const [downloadFeedback, setDownloadFeedback] = useState('Download CSV');
  const [now, setNow] = useState(() => Date.now());
  const eventSourceRef = useRef<EventSource | null>(null);
  const deferredResults = useDeferredValue(results);

  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  useEffect(() => {
    if (status !== 'loading' && status !== 'streaming') {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [status]);

  async function handleSubmit(keyword: string, location: string) {
    setStatus('loading');
    setResults([]);
    setError(null);
    setCurrentKeyword(keyword);
    setCurrentLocation(location);
    setLogMessages(['Starting scrape request...']);
    setStartedAt(Date.now());
    setFinishedAt(null);
    setDownloadFeedback('Download CSV');

    try {
      const response = await startScrape(keyword, location);

      if (response.success) {
        const { progressUrl } = response.data;

        if (eventSourceRef.current) {
          eventSourceRef.current.close();
        }

        const es = createProgressEventSource(progressUrl);
        eventSourceRef.current = es;

        es.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data) as ScrapeStreamEvent;

            if (data.type === 'progress') {
              setLogMessages((prev) => [...prev, data.data.message]);
            } else if (data.type === 'result') {
              setResults((prev) => {
                const newResults = [...prev, data.data];
                if (prev.length === 0) {
                  setStatus('streaming');
                }
                return newResults;
              });
            } else if (data.type === 'done') {
              setStatus('success');
              setFinishedAt(Date.now());
              es.close();
            } else if (data.type === 'error') {
              setError(data.error.message);
              setStatus('error');
              setFinishedAt(Date.now());
              es.close();
            }
          } catch (parseError) {
            console.error('Failed to parse SSE message', parseError);
          }
        };

        es.onerror = () => {
          setError('Could not connect to server. Is the backend running?');
          setStatus('error');
          setFinishedAt(Date.now());
          es.close();
        };
      } else {
        setError('Could not start the scrape job.');
        setStatus('error');
        setFinishedAt(Date.now());
      }
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
      setStatus('error');
      setFinishedAt(Date.now());
    }
  }

  function handleNewSearch() {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    setStatus('idle');
    setResults([]);
    setError(null);
    setCurrentKeyword('');
    setCurrentLocation('');
    setLogMessages([]);
    setStartedAt(null);
    setFinishedAt(null);
    setDownloadFeedback('Download CSV');
  }

  function handleDownloadAll() {
    if (deferredResults.length === 0) {
      return;
    }

    downloadCSV(deferredResults, currentKeyword, currentLocation);
    setDownloadFeedback('CSV Ready');
    window.setTimeout(() => {
      setDownloadFeedback('Download CSV');
    }, 1800);
  }

  const activeQuery = [currentKeyword, currentLocation].filter(Boolean).join(' / ');
  const progress = deriveProgress(logMessages, deferredResults.length);
  const processedCount = status === 'success' ? progress.total : progress.processed;
  const progressValue = progress.total > 0 ? Math.min(100, (processedCount / progress.total) * 100) : 0;
  const latestMessage = logMessages[logMessages.length - 1] || 'Awaiting first signal...';
  const elapsedMs =
    startedAt == null
      ? 0
      : ((status === 'loading' || status === 'streaming') ? now : (finishedAt ?? now)) - startedAt;
  const elapsedLabel = formatElapsed(elapsedMs);
  const isWorking = status === 'loading' || status === 'streaming';
  const showResults = deferredResults.length > 0;

  return (
    <div className="min-h-screen overflow-hidden text-[var(--text-primary)]">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute inset-x-0 top-[-12rem] h-[26rem] bg-[radial-gradient(circle_at_top,rgba(109,76,255,0.32),transparent_55%)]" />
        <div className="absolute right-[-8rem] top-24 h-64 w-64 rounded-full bg-[radial-gradient(circle,rgba(59,130,246,0.22),transparent_65%)] blur-3xl" />
        <div className="absolute left-[-6rem] top-56 h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(139,92,246,0.15),transparent_70%)] blur-3xl" />
        <div className="app-grid absolute inset-0 opacity-30" />
      </div>

      <div className="relative mx-auto flex min-h-screen w-full max-w-[1240px] flex-col gap-8 px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
        <section className="glass-panel relative overflow-hidden rounded-[30px] px-6 py-8 sm:px-8 sm:py-10 lg:px-10">
          <div className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(196,181,253,0.55),transparent)]" />
          <div className="absolute left-1/2 top-0 h-56 w-56 -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(109,76,255,0.26),transparent_68%)] blur-3xl" />

          <div className="relative">
            <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
              <div className="glass-pill mb-5 inline-flex items-center gap-2 px-4 py-2 text-xs font-medium uppercase tracking-[0.28em] text-[var(--text-accent)]">
                <Command className="h-4 w-4" />
                <span>
                  Google Maps <span aria-hidden="true">&bull;</span> Live Lead Extraction
                </span>
              </div>

              <h1 className="max-w-4xl text-4xl font-black tracking-[-0.05em] text-[var(--text-primary)] sm:text-5xl lg:text-6xl">
                Google Maps Lead Scraper
              </h1>
              <div className="mt-4 h-1.5 w-24 rounded-full bg-[linear-gradient(135deg,var(--violet-primary),var(--blue-accent))]" />
              <p className="mt-5 max-w-2xl text-base leading-7 text-[var(--text-muted)] sm:text-lg">
                Run focused local-business pulls with a darker, sharper operator workflow and stream leads into a polished review surface.
              </p>

              <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                <span className="glass-pill inline-flex items-center gap-2 px-4 py-2 text-sm text-[var(--text-primary)]">
                  <Sparkles className="h-4 w-4 text-[var(--text-accent)]" />
                  Up to 20 Google Maps leads
                </span>
                <span className="glass-pill inline-flex items-center gap-2 px-4 py-2 text-sm text-[var(--text-primary)]">
                  <Activity className="h-4 w-4 text-[var(--blue-accent)]" />
                  Live result streaming
                </span>
                {activeQuery ? (
                  <span className="glass-pill inline-flex items-center gap-2 px-4 py-2 text-sm text-[var(--text-primary)]">
                    <Database className="h-4 w-4 text-[var(--violet-secondary)]" />
                    Active query: {activeQuery}
                  </span>
                ) : null}
              </div>
            </div>

            <div className="mt-8 sm:mt-10">
              <SearchForm
                onSubmit={handleSubmit}
                status={status}
                initialKeyword={currentKeyword}
                initialLocation={currentLocation}
              />
            </div>
          </div>
        </section>

        {(isWorking || logMessages.length > 0) && (
          <section className="grid gap-4 xl:grid-cols-[1.2fr,0.8fr]">
            <div className="glass-panel rounded-[28px] p-6 sm:p-7">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-4">
                  <div className="inline-flex items-center gap-3 rounded-full border border-[rgba(196,181,253,0.14)] bg-[rgba(15,9,29,0.85)] px-4 py-2 text-sm font-medium text-[var(--text-primary)]">
                    <span className="relative flex h-3 w-3">
                      <span className="absolute inline-flex h-full w-full rounded-full bg-[var(--blue-accent)] opacity-75 animate-ping" />
                      <span className="relative inline-flex h-3 w-3 rounded-full bg-[var(--violet-secondary)]" />
                    </span>
                    {status === 'success' ? 'Run completed' : status === 'error' ? 'Run interrupted' : 'Scraping live'}
                  </div>

                  <div>
                    <p className="text-xs font-medium uppercase tracking-[0.22em] text-[var(--text-muted)]">
                      Current query
                    </p>
                    <h2 className="mt-2 text-2xl font-bold tracking-[-0.03em] text-[var(--text-primary)]">
                      {activeQuery || 'Awaiting operator command'}
                    </h2>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--text-muted)]">
                      Signals are streamed as each Google Maps detail page resolves. Fields beyond the business name remain best-effort.
                    </p>
                  </div>
                </div>

                <div className="grid min-w-[220px] gap-3 sm:grid-cols-2 xl:grid-cols-1">
                  <div className="glass-elevated rounded-[22px] p-4">
                    <p className="text-xs font-medium uppercase tracking-[0.22em] text-[var(--text-muted)]">
                      Processed
                    </p>
                    <div className="mt-2 flex items-end gap-2">
                      <span className="text-3xl font-black tracking-[-0.05em] text-[var(--text-primary)]">
                        {processedCount}
                      </span>
                      <span className="pb-1 text-sm text-[var(--text-muted)]">/ {progress.total}</span>
                    </div>
                  </div>

                  <div className="glass-elevated rounded-[22px] p-4">
                    <p className="text-xs font-medium uppercase tracking-[0.22em] text-[var(--text-muted)]">
                      Session time
                    </p>
                    <div className="mt-2 inline-flex items-center gap-2 text-lg font-semibold text-[var(--text-primary)]">
                      <Clock3 className="h-4 w-4 text-[var(--text-accent)]" />
                      {elapsedLabel}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 space-y-3">
                <div className="flex items-center justify-between text-xs font-medium uppercase tracking-[0.22em] text-[var(--text-muted)]">
                  <span>Operation progress</span>
                  <span>{Math.round(progressValue)}%</span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-[rgba(255,255,255,0.04)]">
                  <div
                    className="status-shimmer h-full rounded-full bg-[linear-gradient(135deg,var(--violet-primary),var(--blue-accent))] transition-[width] duration-500 ease-out"
                    style={{ width: `${progressValue}%` }}
                  />
                </div>
                <div className="glass-elevated rounded-[20px] px-4 py-3 text-sm text-[var(--text-muted)]">
                  <span className="font-medium text-[var(--text-accent)]">Recent event</span>
                  <p className="mt-2 leading-6 text-[var(--text-primary)]">{latestMessage}</p>
                </div>
              </div>
            </div>

            <StatusLog messages={logMessages} />
          </section>
        )}

        {showResults && (
          <section className="space-y-4">
            <div className="glass-panel rounded-[28px] p-4 sm:p-5">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                  <div className="glass-pill inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-[var(--text-primary)]">
                    <Sparkles className="h-4 w-4 text-[var(--text-accent)]" />
                    {activeQuery || 'Lead set'}
                  </div>

                  <div className="glass-pill inline-flex items-center gap-3 rounded-full px-4 py-2 text-sm text-[var(--text-muted)]">
                    <Database className="h-4 w-4 text-[var(--blue-accent)]" />
                    <span className="text-[var(--text-primary)]">
                      <span className="mr-1 text-xl font-black tracking-[-0.04em] text-[var(--text-primary)]">
                        {deferredResults.length}
                      </span>
                      leads collected
                    </span>
                  </div>

                  <div className="glass-pill inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm text-[var(--text-muted)]">
                    {status === 'success' ? (
                      <CheckCircle2 className="h-4 w-4 text-[var(--success)]" />
                    ) : (
                      <Activity className="h-4 w-4 text-[var(--blue-accent)]" />
                    )}
                    {status === 'success' ? `Completed in ${elapsedLabel}` : `Live in ${elapsedLabel}`}
                  </div>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <button
                    onClick={handleNewSearch}
                    className="secondary-button inline-flex h-12 items-center justify-center gap-2 rounded-2xl px-5 text-sm font-semibold"
                  >
                    <RefreshCcw className="h-4 w-4" />
                    New Search
                  </button>
                  <button
                    onClick={handleDownloadAll}
                    className="primary-button inline-flex h-12 items-center justify-center gap-2 rounded-2xl px-5 text-sm font-semibold"
                  >
                    <Download className="h-4 w-4" />
                    {downloadFeedback}
                  </button>
                </div>
              </div>
            </div>

            <ResultsTable data={deferredResults} />
          </section>
        )}

        {status === 'error' && (
          <section className="glass-panel rounded-[28px] border-[rgba(239,68,68,0.28)] bg-[rgba(39,10,24,0.72)] p-6 text-center sm:p-8">
            <div className="mx-auto flex max-w-2xl flex-col items-center">
              <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-[rgba(239,68,68,0.25)] bg-[rgba(239,68,68,0.12)] text-[var(--danger)]">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <h2 className="text-2xl font-bold tracking-[-0.03em] text-[var(--text-primary)]">Run needs attention</h2>
              <p className="mt-3 max-w-xl text-sm leading-7 text-[var(--text-muted)]">{error}</p>
              <button
                onClick={handleNewSearch}
                className="primary-button mt-6 inline-flex h-12 items-center justify-center gap-2 rounded-2xl px-5 text-sm font-semibold"
              >
                <RefreshCcw className="h-4 w-4" />
                Reset and try again
              </button>
            </div>
          </section>
        )}

        {status === 'idle' && !showResults && !error && (
          <section className="grid gap-4 lg:grid-cols-3">
            {[
              {
                title: 'Operator-grade command panel',
                body: 'Run business type and city in a single dark command surface with strong focus, helper text, and immediate actions.',
              },
              {
                title: 'Live scrape telemetry',
                body: 'Track progress, recent events, and count movement while the run is active without falling back to generic loading states.',
              },
              {
                title: 'Premium lead review',
                body: 'Review relevance, contact, location, and website blocks inside a glassy results card built for internal intelligence work.',
              },
            ].map((item) => (
              <div key={item.title} className="glass-panel rounded-[26px] p-6">
                <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[rgba(109,76,255,0.14)] text-[var(--text-accent)]">
                  <Sparkles className="h-5 w-5" />
                </div>
                <h2 className="mt-5 text-lg font-bold tracking-[-0.03em] text-[var(--text-primary)]">{item.title}</h2>
                <p className="mt-3 text-sm leading-7 text-[var(--text-muted)]">{item.body}</p>
              </div>
            ))}
          </section>
        )}

        <footer className="mt-auto pt-2">
          <div className="mx-auto flex max-w-5xl flex-col gap-3 rounded-[20px] border border-[rgba(196,181,253,0.08)] bg-[rgba(12,8,24,0.22)] px-4 py-3 text-xs text-[rgba(148,163,184,0.72)] shadow-[inset_0_1px_0_rgba(255,255,255,0.02)] backdrop-blur-sm sm:flex-row sm:items-center sm:justify-between">
            <p className="tracking-[0.08em] text-[rgba(196,181,253,0.58)]">Built by roninprotocol</p>

            <div className="flex items-center gap-2">
              <a
                href={creatorLinks.linkedin}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Open LinkedIn in a new tab"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[rgba(196,181,253,0.08)] bg-[rgba(255,255,255,0.02)] text-[rgba(191,219,254,0.68)] transition-colors duration-200 hover:border-[rgba(96,165,250,0.24)] hover:text-[var(--text-primary)]"
              >
                <Linkedin className="h-4 w-4" />
              </a>
              <a
                href={creatorLinks.github}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Open GitHub in a new tab"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[rgba(196,181,253,0.08)] bg-[rgba(255,255,255,0.02)] text-[rgba(191,219,254,0.68)] transition-colors duration-200 hover:border-[rgba(96,165,250,0.24)] hover:text-[var(--text-primary)]"
              >
                <Github className="h-4 w-4" />
              </a>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}

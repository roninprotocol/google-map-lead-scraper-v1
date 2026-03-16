export type Status = 'idle' | 'loading' | 'streaming' | 'success' | 'error';

export interface BusinessRecord {
  _id: string; // ADD THIS: stable ID for selection
  name: string;
  category: string;
  address: string;
  phone: string;
  website: string;
  rating: string;
  reviews: string;
  matchConfidence: 'high' | 'medium' | 'low';
}

export interface ApiMeta {
  requestId: string;
  timestamp: string;
}

export interface ApiSuccess<T> {
  success: true;
  data: T;
  meta: ApiMeta;
}

export interface ApiFailure {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta: ApiMeta;
}

export interface ScrapeAcceptedData {
  jobId: string;
  progressUrl: string;
  timeoutMs: number;
}

export type ScrapeStreamEvent =
  | {
      type: 'progress';
      data: {
        message: string;
        timestamp: string;
      };
    }
  | {
      type: 'result';
      data: BusinessRecord;
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

import axios from 'axios';
import type { ApiFailure, ApiSuccess, ScrapeAcceptedData } from '../types';

const configuredApiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();

export const API_BASE_URL = configuredApiBaseUrl
  ? configuredApiBaseUrl.replace(/\/+$/, '')
  : (import.meta.env.DEV ? 'http://localhost:3000' : '');

export function createApiUrl(path: string) {
  if (!path.startsWith('/')) {
    throw new Error(`API paths must start with "/". Received "${path}".`);
  }

  return API_BASE_URL ? `${API_BASE_URL}${path}` : path;
}

export async function startScrape(keyword: string, location: string) {
  const response = await axios.post<ApiSuccess<ScrapeAcceptedData>>(
    createApiUrl('/scrape'),
    { keyword, location },
    { timeout: 15000 }
  );

  return response.data;
}

export function createProgressEventSource(progressUrl: string) {
  return new EventSource(createApiUrl(progressUrl));
}

export function getApiErrorMessage(error: unknown) {
  if (axios.isAxiosError(error)) {
    const payload = error.response?.data as ApiFailure | undefined;
    return payload?.error?.message || error.message || 'Could not connect to server.';
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Could not connect to server.';
}

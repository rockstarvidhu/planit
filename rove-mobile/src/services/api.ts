import { readApiConfiguration } from '../config/api.ts';
import type {
  ItineraryRequest, ItineraryResponse, ReverseGeocodeRequest, ReverseGeocodeResponse,
  ApiErrorResponse,
} from '../types/api.ts';

export type ApiErrorKind = 'configuration' | 'invalid_request' | 'forbidden' | 'not_found' |
  'rate_limited' | 'upstream' | 'timeout' | 'cancelled' | 'network' | 'unexpected';

export class ApiClientError extends Error {
  readonly kind: ApiErrorKind;
  readonly status?: number;
  readonly code?: string;
  readonly retryAfterSeconds?: number;

  constructor(
    kind: ApiErrorKind,
    message: string,
    status?: number,
    code?: string,
    retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = 'ApiClientError';
    this.kind = kind;
    this.status = status;
    this.code = code;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

const HEALTH_TIMEOUT_MS = 5000;
const GEOCODE_TIMEOUT_MS = 12000;
const ITINERARY_TIMEOUT_MS = 35000; // Backend allows 30 seconds, plus transport overhead.
const MAX_TIMEOUT_MS = 45000;

function classifyResponse(status: number, code?: string, retryAfter?: string | null): ApiClientError {
  const safeCode = code && /^[A-Z_]{2,64}$/.test(code) ? code : undefined;
  const retry = retryAfter && /^\d+$/.test(retryAfter) ? Number(retryAfter) : undefined;
  if (status === 400 || status === 413) return new ApiClientError('invalid_request', 'Check the request details.', status, safeCode);
  if (status === 403) return new ApiClientError('forbidden', 'This request is not permitted.', status, safeCode);
  if (status === 404) return new ApiClientError('not_found', 'No matching result was found.', status, safeCode);
  if (status === 429) return new ApiClientError('rate_limited', 'Too many requests. Try again later.', status, safeCode, retry);
  if (status === 504) return new ApiClientError('timeout', 'The backend timed out. Try again.', status, safeCode);
  if (status >= 500) return new ApiClientError('upstream', 'The service is temporarily unavailable.', status, safeCode, retry);
  return new ApiClientError('unexpected', 'The request could not be completed.', status, safeCode);
}

async function responseCode(response: Response): Promise<string | undefined> {
  try {
    const body: ApiErrorResponse = await response.json();
    return typeof body?.code === 'string' ? body.code : undefined;
  } catch {
    return undefined;
  }
}

export interface ApiClientOptions {
  baseUrl?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

export function createApiClient(options: ApiClientOptions = {}) {
  const config = readApiConfiguration(options.baseUrl);
  if (config.state !== 'ready') throw new ApiClientError('configuration', config.message);
  const baseUrl = config.baseUrl;
  if (options.timeoutMs !== undefined && (!Number.isInteger(options.timeoutMs) ||
      options.timeoutMs < 1 || options.timeoutMs > MAX_TIMEOUT_MS)) {
    throw new ApiClientError('configuration', 'Invalid request timeout.');
  }
  const fetchImpl = options.fetchImpl ?? fetch;

  async function request<T>(
    path: string,
    init: RequestInit,
    decode: (response: Response) => Promise<T>,
    defaultTimeoutMs: number,
  ): Promise<T> {
    if (init.signal?.aborted) throw new ApiClientError('cancelled', 'Request cancelled.');
    const controller = new AbortController();
    const timeoutMs = options.timeoutMs ?? defaultTimeoutMs;
    let reason: 'timeout' | 'cancelled' | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let onCallerAbort: (() => void) | undefined;

    const cancelled = new Promise<never>((_, reject) => {
      onCallerAbort = () => {
        reason = 'cancelled';
        controller.abort();
        reject(new ApiClientError('cancelled', 'Request cancelled.'));
      };
      init.signal?.addEventListener('abort', onCallerAbort, { once: true });
    });
    const timedOut = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        reason = 'timeout';
        controller.abort();
        reject(new ApiClientError('timeout', 'Request timed out.'));
      }, timeoutMs);
    });

    try {
      const operation = (async () => {
        const response = await fetchImpl(`${baseUrl}${path}`, { ...init, signal: controller.signal });
        if (!response.ok) {
          throw classifyResponse(response.status, await responseCode(response), response.headers.get('retry-after'));
        }
        return decode(response);
      })();
      return await Promise.race([operation, cancelled, timedOut]);
    } catch (error) {
      if (error instanceof ApiClientError) throw error;
      if (reason === 'cancelled') throw new ApiClientError('cancelled', 'Request cancelled.');
      if (reason === 'timeout') throw new ApiClientError('timeout', 'Request timed out.');
      throw new ApiClientError('network', 'Cannot reach the backend.');
    } finally {
      if (timer) clearTimeout(timer);
      if (onCallerAbort) init.signal?.removeEventListener('abort', onCallerAbort);
    }
  }

  return {
    baseUrl,
    // GET / is a local health route with no provider calls or billing.
    checkHealth(signal?: AbortSignal) {
      return request('/', { method: 'GET', signal }, async response => {
        await response.text();
        return { reachable: true as const };
      }, HEALTH_TIMEOUT_MS);
    },
    reverseGeocode(body: ReverseGeocodeRequest, signal?: AbortSignal) {
      return request<ReverseGeocodeResponse>('/api/reverse-geocode', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body), signal,
      }, response => response.json(), GEOCODE_TIMEOUT_MS);
    },
    getItinerary(body: ItineraryRequest, signal?: AbortSignal) {
      return request<ItineraryResponse>('/api/itinerary', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body), signal,
      }, response => response.json(), ITINERARY_TIMEOUT_MS);
    },
    resolvePhotoUrl(photoUrl: string | null): string | null {
      if (photoUrl === null) return null;
      if (!photoUrl.startsWith('/api/photo?')) throw new ApiClientError('unexpected', 'Invalid photo URL.');
      const url = new URL(photoUrl, baseUrl);
      if (url.origin !== baseUrl || url.pathname !== '/api/photo' || !url.searchParams.has('ref') ||
          url.searchParams.has('key') || url.hash) {
        throw new ApiClientError('unexpected', 'Invalid photo URL.');
      }
      return url.toString();
    },
  };
}

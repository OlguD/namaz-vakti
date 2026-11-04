import { API_URL, IS_WEB } from './config';
import { ApiError } from './errors';

export type QueryValue = string | number | boolean | null | undefined;

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Record<string, QueryValue>;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  /** Milliseconds before the request is aborted. */
  timeoutMs?: number;
}

export function buildUrl(path: string, query?: Record<string, QueryValue>): string {
  const url = `${API_URL}/v1${path.startsWith('/') ? path : `/${path}`}`;
  if (!query) return url;
  const params = Object.entries(query)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  return params.length ? `${url}?${params.join('&')}` : url;
}

/**
 * One HTTP round trip against the API, with no auth handling. Throws ApiError
 * for every failure (status 0 = network/timeout).
 */
export async function rawRequest<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, query, headers = {}, signal, timeoutMs = 20_000 } = opts;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort);

  const finalHeaders: Record<string, string> = {
    Accept: 'application/json',
    'Accept-Language': 'tr',
    ...headers,
  };
  if (body !== undefined) finalHeaders['Content-Type'] = 'application/json';
  // Marks the request as coming from the web app so the API uses the
  // httpOnly refresh cookie (and forces a CORS preflight = CSRF protection).
  if (IS_WEB) finalHeaders['X-Client-Platform'] = 'web';

  let res: Response;
  try {
    res = await fetch(buildUrl(path, query), {
      method,
      headers: finalHeaders,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
      // The refresh cookie is scoped to /v1/auth; only send credentials there.
      credentials: IS_WEB && path.startsWith('/auth/') ? 'include' : 'omit',
    });
  } catch {
    throw new ApiError(0, signal?.aborted ? 'ABORTED' : 'NETWORK', 'Network request failed');
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
  }

  if (res.status === 204) return undefined as T;
  const text = await res.text();
  let json: unknown = undefined;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = undefined;
    }
  }
  if (!res.ok) {
    const env = (json as { error?: { code?: string; message?: string; details?: unknown }; requestId?: string }) ?? {};
    throw new ApiError(
      res.status,
      env.error?.code ?? `HTTP_${res.status}`,
      env.error?.message ?? res.statusText,
      env.error?.details,
      env.requestId,
    );
  }
  return json as T;
}

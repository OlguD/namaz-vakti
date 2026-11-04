import { getAccessToken, useSession } from '@/auth/session';
import { isApiError } from './errors';
import { rawRequest, type RequestOptions } from './http';

export interface ApiOptions extends RequestOptions {
  /** Send the access token (default true). Public endpoints still work with it. */
  auth?: boolean;
}

/**
 * Authenticated API call. Attaches the access token and, if the API answers
 * 401 (token revoked or expired early), refreshes once and retries.
 */
export async function api<T>(path: string, opts: ApiOptions = {}): Promise<T> {
  const { auth = true, headers = {}, ...rest } = opts;
  if (!auth) return rawRequest<T>(path, { ...rest, headers });

  const token = await getAccessToken();
  const withToken = (t: string | null) => ({
    ...rest,
    headers: t ? { ...headers, Authorization: `Bearer ${t}` } : headers,
  });
  try {
    return await rawRequest<T>(path, withToken(token));
  } catch (e) {
    if (!isApiError(e) || e.status !== 401) throw e;
    // Treat the in-memory token as expired: refresh, or start a new anonymous session.
    useSession.setState({ accessExpiresAt: 0 });
    return rawRequest<T>(path, withToken(await getAccessToken()));
  }
}

export const get = <T>(path: string, query?: RequestOptions['query'], opts?: ApiOptions) =>
  api<T>(path, { ...opts, query });
export const post = <T>(path: string, body?: unknown, opts?: ApiOptions) =>
  api<T>(path, { ...opts, method: 'POST', body: body ?? {} });
export const put = <T>(path: string, body?: unknown, opts?: ApiOptions) =>
  api<T>(path, { ...opts, method: 'PUT', body: body ?? {} });
export const patch = <T>(path: string, body?: unknown, opts?: ApiOptions) =>
  api<T>(path, { ...opts, method: 'PATCH', body: body ?? {} });
export const del = <T = void>(path: string, opts?: ApiOptions) =>
  api<T>(path, { ...opts, method: 'DELETE' });

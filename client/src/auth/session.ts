import * as Crypto from 'expo-crypto';
import { create } from 'zustand';
import { IS_WEB, PLATFORM } from '@/api/config';
import { isApiError } from '@/api/errors';
import { rawRequest } from '@/api/http';
import type { AuthResponse, TokenPair, User } from '@/api/types';
import { KEYS, kv, secrets } from '@/lib/storage';

/**
 * Session lifecycle
 * - The access token lives in memory only.
 * - Native: the refresh token is kept in the Keychain/Keystore.
 * - Web: the refresh token is an httpOnly cookie the page never sees; the API
 *   accepts it only with `X-Client-Platform: web` from an allow-listed origin.
 * - Every install starts with an anonymous account (no sign-up wall); signing
 *   in with Apple/Google/e-mail upgrades that same account in place.
 */
export type SessionStatus = 'booting' | 'ready' | 'offline';

interface SessionState {
  status: SessionStatus;
  user: User | null;
  accessToken: string | null;
  /** Epoch ms. */
  accessExpiresAt: number;
}

export const useSession = create<SessionState>(() => ({
  status: 'booting',
  user: null,
  accessToken: null,
  accessExpiresAt: 0,
}));

const EARLY_REFRESH_MS = 30_000;

async function installationId(): Promise<string> {
  const existing = await kv.get<string>(KEYS.installationId);
  if (existing) return existing;
  const id = Crypto.randomUUID();
  await kv.set(KEYS.installationId, id);
  return id;
}

async function applyTokens(tokens: TokenPair, user?: User): Promise<void> {
  if (!IS_WEB && tokens.refreshToken) await secrets.set(KEYS.refreshToken, tokens.refreshToken);
  if (IS_WEB) await kv.set(KEYS.webSession, true);
  useSession.setState((s) => ({
    accessToken: tokens.accessToken,
    accessExpiresAt: Date.now() + tokens.accessTokenExpiresIn * 1000,
    user: user ?? s.user,
    status: 'ready',
  }));
}

/** Persists a successful sign-in / registration response. */
export async function acceptAuthResponse(res: AuthResponse): Promise<void> {
  await applyTokens(res.tokens, res.user);
}

async function signInAnonymously(): Promise<void> {
  const res = await rawRequest<AuthResponse>('/auth/anonymous', {
    method: 'POST',
    body: { installationId: await installationId(), platform: PLATFORM },
  });
  await acceptAuthResponse(res);
}

let refreshing: Promise<boolean> | null = null;

/**
 * Rotates the refresh token. Single-flight: concurrent callers share one
 * request (two parallel rotations would trip the API's reuse detection and
 * revoke the session). Resolves false when there is no valid session.
 */
export function refreshSession(): Promise<boolean> {
  if (refreshing) return refreshing;
  refreshing = (async () => {
    try {
      const stored = IS_WEB ? undefined : await secrets.get(KEYS.refreshToken);
      if (!IS_WEB && !stored) return false;
      if (IS_WEB && !(await kv.get<boolean>(KEYS.webSession))) return false;
      const tokens = await rawRequest<TokenPair>('/auth/refresh', {
        method: 'POST',
        body: stored ? { refreshToken: stored } : {},
      });
      await applyTokens(tokens);
      return true;
    } catch (e) {
      if (isApiError(e) && e.isClientError) {
        await secrets.set(KEYS.refreshToken, null);
        await kv.remove(KEYS.webSession);
        useSession.setState({ accessToken: null, accessExpiresAt: 0 });
        return false;
      }
      throw e;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

/** Returns a usable access token, refreshing or re-creating the session if needed. */
export async function getAccessToken(): Promise<string | null> {
  const { accessToken, accessExpiresAt } = useSession.getState();
  if (accessToken && accessExpiresAt - Date.now() > EARLY_REFRESH_MS) return accessToken;
  if (await refreshSession()) return useSession.getState().accessToken;
  await signInAnonymously();
  return useSession.getState().accessToken;
}

/** Called once at launch. Never throws: offline launches still render cached data. */
export async function bootSession(): Promise<void> {
  try {
    const ok = await refreshSession();
    if (!ok) await signInAnonymously();
    const token = useSession.getState().accessToken;
    if (token) {
      const user = await rawRequest<User>('/me', { headers: { Authorization: `Bearer ${token}` } });
      useSession.setState({ user });
    }
  } catch {
    useSession.setState({ status: 'offline' });
  }
}

export function setUser(user: User): void {
  useSession.setState({ user });
}

/** Signs out everywhere on this device and continues as a fresh anonymous user. */
export async function signOut(): Promise<void> {
  const stored = IS_WEB ? undefined : await secrets.get(KEYS.refreshToken);
  try {
    await rawRequest('/auth/logout', {
      method: 'POST',
      body: stored ? { refreshToken: stored } : {},
    });
  } catch {
    // Best effort: the local session is dropped either way.
  }
  await secrets.set(KEYS.refreshToken, null);
  await kv.remove(KEYS.webSession);
  useSession.setState({ accessToken: null, accessExpiresAt: 0, user: null });
  await signInAnonymously().catch(() => useSession.setState({ status: 'offline' }));
}

/** Forget the session locally (account deleted / revoked). */
export async function dropSession(): Promise<void> {
  await secrets.set(KEYS.refreshToken, null);
  await kv.remove(KEYS.webSession);
  useSession.setState({ accessToken: null, accessExpiresAt: 0, user: null });
  await signInAnonymously().catch(() => useSession.setState({ status: 'offline' }));
}

export const isRegistered = (u: User | null | undefined): boolean => u?.kind === 'registered';

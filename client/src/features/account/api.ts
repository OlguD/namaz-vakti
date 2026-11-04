import { useMutation } from '@tanstack/react-query';
import { del, get, patch, post } from '@/api/client';
import type { AuthResponse, User } from '@/api/types';
import { acceptAuthResponse, dropSession, refreshSession, setUser } from '@/auth/session';
import { queryClient } from '@/api/query';

/** Reloads the profile into the session store. */
export async function reloadMe(): Promise<User> {
  const me = await get<User>('/me');
  setUser(me);
  return me;
}

async function signedIn(res: AuthResponse): Promise<User> {
  await acceptAuthResponse(res);
  // Per-account caches (settings, worship, …) belong to the previous account.
  await queryClient.invalidateQueries();
  return res.user;
}

export interface RegisterInput {
  email: string;
  password: string;
  displayName: string;
}

/** Registers with e-mail; upgrades the current anonymous account in place. */
export function useRegister() {
  return useMutation({
    mutationFn: async (body: RegisterInput) => signedIn(await post<AuthResponse>('/auth/email/register', body)),
  });
}

export function useEmailLogin() {
  return useMutation({
    mutationFn: async (body: { email: string; password: string }) =>
      signedIn(await post<AuthResponse>('/auth/email/login', body)),
  });
}

export function useAppleLogin() {
  return useMutation({
    mutationFn: async (body: { identityToken: string; nonce?: string; displayName?: string }) =>
      signedIn(await post<AuthResponse>('/auth/apple', body)),
  });
}

export function useGoogleLogin() {
  return useMutation({
    mutationFn: async (body: { idToken: string; displayName?: string }) =>
      signedIn(await post<AuthResponse>('/auth/google', body)),
  });
}

export function useForgotPassword() {
  return useMutation({
    mutationFn: (email: string) => post<void>('/auth/password/forgot', { email }, { auth: false }),
  });
}

export function useResetPassword() {
  return useMutation({
    mutationFn: (body: { token: string; password: string }) => post<void>('/auth/password/reset', body, { auth: false }),
  });
}

export function useResendVerification() {
  return useMutation({ mutationFn: () => post<void>('/auth/email/resend-verification') });
}

/**
 * Confirms an e-mail link. The API's access token carries an "email verified"
 * claim, so the session is refreshed afterwards to pick it up.
 */
export async function verifyEmailToken(token: string): Promise<void> {
  await post<void>('/auth/email/verify', { token }, { auth: false });
  await refreshSession().catch(() => false);
  await reloadMe().catch(() => undefined);
}

export function useUpdateProfile() {
  return useMutation({
    mutationFn: (body: { displayName?: string; locale?: string; districtId?: string | null }) => patch<User>('/me', body),
    onSuccess: (me) => setUser(me),
  });
}

export function useDeleteAccount() {
  return useMutation({
    mutationFn: async () => {
      await del('/me');
      await dropSession();
      queryClient.clear();
    },
  });
}

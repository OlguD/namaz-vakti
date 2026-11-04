import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { create } from 'zustand';
import { del, get, patch, post, put } from '@/api/client';
import type { User } from '@/api/types';
import { setUser, useSession } from '@/auth/session';
import { kv } from '@/lib/storage';
import type { BlockedUser, ChatRoom, ReportReason, ServerMessage } from './types';

export const roomsKey = ['chat-rooms'] as const;
export const blocksKey = ['chat-blocks'] as const;
const previewKey = (roomId: string) => ['chat-preview', roomId] as const;

export function useRooms() {
  return useQuery({
    queryKey: roomsKey,
    queryFn: () => get<ChatRoom[]>('/chat/rooms', undefined, { auth: false }),
    staleTime: 10 * 60_000,
  });
}

export function fetchHistory(roomId: string, before?: number | null, limit = 50) {
  return get<ServerMessage[]>(`/chat/rooms/${encodeURIComponent(roomId)}/messages`, { before: before ?? undefined, limit });
}

/** Recent messages per room for the rooms list (preview line + unread badge). */
export function useRoomPreviews(roomIds: readonly string[]) {
  const ready = useSession((s) => s.status !== 'booting');
  return useQueries({
    queries: roomIds.map((id) => ({
      queryKey: previewKey(id),
      queryFn: () => fetchHistory(id, null, 30),
      enabled: ready,
      staleTime: 20_000,
      refetchInterval: 30_000,
    })),
  });
}

// --- read markers (device-local) ----------------------------------------------

const SEEN_KEY = 'vakit.chat.seen';

interface SeenState {
  seen: Record<string, number>;
  hydrated: boolean;
}

export const useSeen = create<SeenState>(() => ({ seen: {}, hydrated: false }));

export async function hydrateSeen(): Promise<void> {
  if (useSeen.getState().hydrated) return;
  const seen = (await kv.get<Record<string, number>>(SEEN_KEY)) ?? {};
  useSeen.setState({ seen, hydrated: true });
}

export function markSeen(roomId: string, id: number | null): void {
  if (id == null) return;
  const cur = useSeen.getState().seen[roomId] ?? 0;
  if (id <= cur) return;
  const seen = { ...useSeen.getState().seen, [roomId]: id };
  useSeen.setState({ seen });
  void kv.set(SEEN_KEY, seen);
}

// --- moderation ----------------------------------------------------------------

export function useBlocks(enabled = true) {
  const registered = useSession((s) => s.user?.kind === 'registered');
  return useQuery({
    queryKey: blocksKey,
    queryFn: () => get<BlockedUser[]>('/me/blocks'),
    enabled: enabled && registered,
    staleTime: 60_000,
  });
}

export function useBlock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => put<void>(`/me/blocks/${encodeURIComponent(userId)}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: blocksKey }),
  });
}

export function useUnblock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => del(`/me/blocks/${encodeURIComponent(userId)}`),
    onMutate: async (userId) => {
      await qc.cancelQueries({ queryKey: blocksKey });
      const prev = qc.getQueryData<BlockedUser[]>(blocksKey);
      qc.setQueryData<BlockedUser[]>(blocksKey, (l) => l?.filter((u) => u.id !== userId));
      return { prev };
    },
    onError: (_e, _id, ctx) => {
      if (ctx?.prev) qc.setQueryData(blocksKey, ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: blocksKey }),
  });
}

export function reportMessage(messageId: string, reason: ReportReason, note?: string) {
  return post<void>(`/chat/messages/${encodeURIComponent(messageId)}/report`, { reason, ...(note?.trim() ? { note: note.trim().slice(0, 500) } : {}) });
}

export function deleteMessageRest(messageId: string) {
  return del(`/chat/messages/${encodeURIComponent(messageId)}`);
}

// --- account bits chat needs -------------------------------------------------------

export async function saveDisplayName(displayName: string): Promise<User> {
  const user = await patch<User>('/me', { displayName: displayName.trim() });
  setUser(user);
  return user;
}

export function resendVerification() {
  return post<void>('/auth/email/resend-verification');
}

/** Re-reads the profile (e.g. after the user verified their e-mail elsewhere). */
export async function reloadMe(): Promise<User> {
  const user = await get<User>('/me');
  setUser(user);
  return user;
}

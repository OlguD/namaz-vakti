import * as Crypto from 'expo-crypto';
import { create } from 'zustand';
import { post } from '@/api/client';
import { isApiError } from '@/api/errors';
import { queryClient } from '@/api/query';
import { KEYS, kv } from '@/lib/storage';

/**
 * Offline-first dhikr counting.
 *
 * Every tap lands in `pending` (per day + dhikr key) and is persisted on the
 * device. A flush moves pending counts into one `inflight` batch with a fresh
 * batchId and POSTs it to /worship/dhikr-sync. The API applies each batchId
 * once, so a batch whose response got lost is simply retried with the same id
 * — taps are never double counted and never lost.
 *
 * The current zikirmatik round (key, count, tours) is kept here too, so a
 * round survives leaving the screen or restarting the app.
 */
export interface DhikrEntry {
  date: string;
  dhikrKey: string;
  count: number;
}

export interface Batch {
  batchId: string;
  entries: DhikrEntry[];
}

export interface Round {
  key: string;
  count: number;
  tours: number;
}

export interface QueueData {
  /** "YYYY-MM-DD|dhikrKey" → taps not yet uploaded. */
  pending: Record<string, number>;
  inflight: Batch | null;
  round: Round | null;
}

const MAX_ENTRIES = 200;

export const EMPTY_QUEUE: QueueData = { pending: {}, inflight: null, round: null };

// ---- pure helpers (unit-tested) ----------------------------------------------

export function addTaps(q: QueueData, date: string, key: string, n = 1): QueueData {
  if (n <= 0) return q;
  const id = `${date}|${key}`;
  return { ...q, pending: { ...q.pending, [id]: (q.pending[id] ?? 0) + n } };
}

/** Moves (up to 200) pending entries into a new batch. No-op when a batch is in flight. */
export function takeBatch(q: QueueData, batchId: string): QueueData {
  if (q.inflight) return q;
  const ids = Object.keys(q.pending).filter((id) => (q.pending[id] ?? 0) > 0);
  if (ids.length === 0) return q;
  const chosen = ids.slice(0, MAX_ENTRIES);
  const pending = { ...q.pending };
  const entries: DhikrEntry[] = chosen.map((id) => {
    const [date, ...rest] = id.split('|');
    const count = pending[id] ?? 0;
    delete pending[id];
    return { date: date!, dhikrKey: rest.join('|'), count };
  });
  return { ...q, pending, inflight: { batchId, entries } };
}

/** Taps for `date` not yet reflected on the server (pending + in flight). */
export function unsyncedForDate(q: QueueData, date: string, key?: string): number {
  let n = 0;
  for (const [id, count] of Object.entries(q.pending)) {
    const [d, ...rest] = id.split('|');
    if (d === date && (!key || rest.join('|') === key)) n += count;
  }
  for (const e of q.inflight?.entries ?? []) {
    if (e.date === date && (!key || e.dhikrKey === key)) n += e.count;
  }
  return n;
}

// ---- store -------------------------------------------------------------------

interface QueueState extends QueueData {
  hydrated: boolean;
  syncing: boolean;
}

export const useDhikrQueue = create<QueueState>(() => ({ ...EMPTY_QUEUE, hydrated: false, syncing: false }));

let persistTimer: ReturnType<typeof setTimeout> | null = null;
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function snapshot(): QueueData {
  const { pending, inflight, round } = useDhikrQueue.getState();
  return { pending, inflight, round };
}

function schedulePersist(): void {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    persistTimer = null;
    void kv.set(KEYS.dhikrQueue, snapshot());
  }, 400);
}

let hydrating: Promise<void> | null = null;
export function hydrateDhikrQueue(): Promise<void> {
  if (useDhikrQueue.getState().hydrated) return Promise.resolve();
  hydrating ??= kv.get<QueueData>(KEYS.dhikrQueue).then((saved) => {
    // Taps made before hydration finished are merged, not overwritten.
    const live = snapshot();
    const base = saved ?? EMPTY_QUEUE;
    let merged: QueueData = { ...base, round: live.round ?? base.round };
    for (const [id, n] of Object.entries(live.pending)) {
      const [date, ...rest] = id.split('|');
      merged = addTaps(merged, date!, rest.join('|'), n);
    }
    useDhikrQueue.setState({ ...merged, hydrated: true });
  });
  return hydrating;
}

function update(next: QueueData): void {
  useDhikrQueue.setState(next);
  schedulePersist();
}

export function recordTaps(date: string, key: string, n = 1): void {
  update(addTaps(snapshot(), date, key, n));
  // Upload in quiet moments, not on every tap.
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(() => void flushDhikr(), 20_000);
}

export function setRound(round: Round | null): void {
  update({ ...snapshot(), round });
}

/**
 * Uploads everything that is waiting. Safe to call any time (concurrent calls
 * share one run). Network errors keep the batch for the next attempt.
 */
let flushing: Promise<void> | null = null;
export function flushDhikr(): Promise<void> {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  flushing ??= (async () => {
    await hydrateDhikrQueue();
    useDhikrQueue.setState({ syncing: true });
    try {
      for (let i = 0; i < 10; i++) {
        let q = snapshot();
        if (!q.inflight) q = takeBatch(q, `dz-${Crypto.randomUUID()}`);
        if (!q.inflight) break;
        update(q);
        try {
          await post<{ applied: boolean }>('/worship/dhikr-sync', q.inflight);
        } catch (e) {
          // 4xx: the batch can never succeed (e.g. a custom dhikr was deleted) — drop it.
          if (isApiError(e) && e.isClientError && e.status !== 401 && e.status !== 429) {
            update({ ...snapshot(), inflight: null });
            continue;
          }
          return;
        }
        update({ ...snapshot(), inflight: null });
      }
      await kv.set(KEYS.dhikrQueue, snapshot());
      void queryClient.invalidateQueries({ queryKey: ['worship', 'summary'] });
      void queryClient.invalidateQueries({ queryKey: ['worship', 'dhikr-stats'] });
    } finally {
      useDhikrQueue.setState({ syncing: false });
      flushing = null;
    }
  })();
  return flushing;
}

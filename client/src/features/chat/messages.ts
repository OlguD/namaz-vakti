import { MONTHS_TR } from '@/lib/dates';
import type { ChatMessage, ServerMessage } from './types';

/**
 * Pure message-list logic for the chat room. The list is kept sorted
 * oldest → newest; confirmed messages are ordered by their numeric id,
 * optimistic ones (no server id yet) stay at the end in send order.
 */

const idNum = (m: { id: string }) => {
  const n = Number(m.id);
  return Number.isFinite(n) ? n : Number.MAX_SAFE_INTEGER;
};

const isConfirmed = (m: ChatMessage) => m.status === 'sent';

/** Whitespace-insensitive body comparison (the server tidies spacing). */
export function sameBody(a: string, b: string): boolean {
  const norm = (s: string) => s.replace(/\s+/g, ' ').trim();
  return norm(a) === norm(b);
}

function sortList(list: ChatMessage[]): ChatMessage[] {
  const confirmed = list.filter(isConfirmed).sort((a, b) => idNum(a) - idNum(b));
  const local = list.filter((m) => !isConfirmed(m));
  return [...confirmed, ...local];
}

/**
 * Merges server messages (history page, live event or ack) into the list.
 * - duplicates by id are ignored (the same message can arrive by ack and broadcast)
 * - one of our pending messages is replaced by its confirmed copy: matched by
 *   clientId when known, else by author + body (broadcast before the ack).
 */
export function mergeMessages(
  list: readonly ChatMessage[],
  incoming: readonly ServerMessage[],
  opts: { myId?: string | null; clientId?: string } = {},
): ChatMessage[] {
  let next = [...list];
  const known = new Set(next.filter(isConfirmed).map((m) => m.id));
  for (const msg of incoming) {
    let pendingIdx = -1;
    if (opts.clientId) pendingIdx = next.findIndex((m) => m.clientId === opts.clientId && !isConfirmed(m));
    if (pendingIdx < 0 && opts.myId && msg.author.id === opts.myId) {
      pendingIdx = next.findIndex((m) => !isConfirmed(m) && m.status !== 'rejected' && sameBody(m.body, msg.body));
    }
    if (known.has(msg.id)) {
      // Already confirmed (e.g. broadcast beat the ack): just drop the pending copy.
      if (pendingIdx >= 0) next.splice(pendingIdx, 1);
      continue;
    }
    const confirmed: ChatMessage = { ...msg, status: 'sent', clientId: pendingIdx >= 0 ? next[pendingIdx]!.clientId : undefined };
    if (pendingIdx >= 0) next.splice(pendingIdx, 1);
    next.push(confirmed);
    known.add(msg.id);
  }
  return sortList(next);
}

export function removeMessage(list: readonly ChatMessage[], id: string): ChatMessage[] {
  return list.filter((m) => m.id !== id);
}

export function removeAuthor(list: readonly ChatMessage[], authorId: string): ChatMessage[] {
  return list.filter((m) => m.author.id !== authorId);
}

export function updateLocal(list: readonly ChatMessage[], clientId: string, patch: Partial<ChatMessage>): ChatMessage[] {
  return list.map((m) => (m.clientId === clientId && m.status !== 'sent' ? { ...m, ...patch } : m));
}

export function dropLocal(list: readonly ChatMessage[], clientId: string): ChatMessage[] {
  return list.filter((m) => !(m.clientId === clientId && m.status !== 'sent'));
}

/** Oldest confirmed id (cursor for loading older history). */
export function oldestId(list: readonly ChatMessage[]): number | null {
  const first = list.find(isConfirmed);
  return first ? idNum(first) : null;
}

export function newestId(list: readonly { id: string; status?: string }[]): number | null {
  let max: number | null = null;
  for (const m of list) {
    if (m.status && m.status !== 'sent') continue;
    const n = Number(m.id);
    if (Number.isFinite(n) && (max === null || n > max)) max = n;
  }
  return max;
}

// --- presentation -----------------------------------------------------------

export function initials(name: string | null | undefined): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0]!;
  const letters = parts.length > 1 ? first.charAt(0) + parts[parts.length - 1]!.charAt(0) : first.slice(0, Array.from(first).length > 1 && /[؀-ۿ]/.test(first) ? 1 : 2);
  return letters.toLocaleUpperCase('tr');
}

/** Stable avatar colour slot (0–2) per author. */
export function avatarSlot(authorId: string): number {
  let h = 0;
  for (let i = 0; i < authorId.length; i++) h = (h * 31 + authorId.charCodeAt(i)) | 0;
  return Math.abs(h) % 3;
}

/** True when the text is mostly Arabic script (render RTL with Amiri). */
export function isArabicText(s: string): boolean {
  const letters = s.replace(/[\s\d\p{P}\p{S}]/gu, '');
  if (!letters) return false;
  const arabic = (letters.match(/[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/g) ?? []).length;
  return arabic / letters.length > 0.5;
}

const pad = (n: number) => String(n).padStart(2, '0');

export function clockOf(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

/** "Bugün", "Dün" or "28 Ekim". */
export function dayLabel(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  if (dayKey(d) === dayKey(now)) return 'Bugün';
  const y = new Date(now);
  y.setDate(now.getDate() - 1);
  if (dayKey(d) === dayKey(y)) return 'Dün';
  return `${d.getDate()} ${MONTHS_TR[d.getMonth()]}${d.getFullYear() !== now.getFullYear() ? ` ${d.getFullYear()}` : ''}`;
}

export type Row =
  | { kind: 'day'; key: string; label: string }
  | {
      kind: 'msg';
      key: string;
      msg: ChatMessage;
      own: boolean;
      /** Same author as the previous bubble (tight spacing, no name). */
      joinPrev: boolean;
      /** Same author as the next bubble (avatar hidden). */
      joinNext: boolean;
    };

/** Builds display rows (day separators + grouped bubbles), oldest first. */
export function buildRows(list: readonly ChatMessage[], myId: string | null | undefined, now: Date = new Date()): Row[] {
  const rows: Row[] = [];
  let lastDay = '';
  list.forEach((m, i) => {
    const d = new Date(m.createdAt);
    const k = dayKey(d);
    if (k !== lastDay) {
      rows.push({ kind: 'day', key: `day-${k}`, label: dayLabel(m.createdAt, now) });
      lastDay = k;
    }
    const prev = list[i - 1];
    const next = list[i + 1];
    const sameDay = (o?: ChatMessage) => !!o && dayKey(new Date(o.createdAt)) === k;
    rows.push({
      kind: 'msg',
      key: m.clientId ? `c-${m.clientId}` : `m-${m.id}`,
      msg: m,
      own: !!myId && m.author.id === myId,
      joinPrev: !!prev && sameDay(prev) && prev.author.id === m.author.id,
      joinNext: !!next && sameDay(next) && next.author.id === m.author.id,
    });
  });
  return rows;
}

// --- slow mode ---------------------------------------------------------------

/** Seconds left before the next message may be sent (0 = free). */
export function cooldownLeft(until: number | null, now: number = Date.now()): number {
  if (!until) return 0;
  return Math.max(0, Math.ceil((until - now) / 1000));
}

/** Reads `retryAfterSeconds` from a SLOW_MODE error, falling back to the room setting. */
export function retryAfter(details: unknown, fallback: number): number {
  const v = (details as { retryAfterSeconds?: unknown } | undefined)?.retryAfterSeconds;
  return typeof v === 'number' && v > 0 ? v : Math.max(1, fallback);
}

/** Remaining mute time, e.g. "18 sa 42 dk" or "12 dk". */
export function muteLeftLabel(untilIso: string | null | undefined, now: Date = new Date()): string | null {
  if (!untilIso) return null;
  const ms = new Date(untilIso).getTime() - now.getTime();
  if (!(ms > 0)) return null;
  const min = Math.ceil(ms / 60000);
  const d = Math.floor(min / 1440);
  const h = Math.floor((min % 1440) / 60);
  const m = min % 60;
  if (d > 0) return h ? `${d} gün ${h} sa` : `${d} gün`;
  if (h > 0) return m ? `${h} sa ${m} dk` : `${h} sa`;
  return `${m} dk`;
}

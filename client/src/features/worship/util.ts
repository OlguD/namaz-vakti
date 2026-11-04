import { onlineManager } from '@tanstack/react-query';
import { useSyncExternalStore } from 'react';
import { addDays } from '@/lib/prayer';
import { MONTHS_TR, parseDate, WEEKDAYS_SHORT_TR } from '@/lib/dates';

/** "1.284" — Turkish thousands separator without relying on Intl. */
export function fmtNum(n: number): string {
  const s = String(Math.round(Math.abs(n)));
  const out = s.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return n < 0 ? `-${out}` : out;
}

/** "29 Ekim – 4 Kasım" (month shown once when both days share it). */
export function rangeLabel(from: string, to: string): string {
  const a = parseDate(from);
  const b = parseDate(to);
  if (a.getMonth() === b.getMonth()) return `${a.getDate()} – ${b.getDate()} ${MONTHS_TR[b.getMonth()]}`;
  return `${a.getDate()} ${MONTHS_TR[a.getMonth()]} – ${b.getDate()} ${MONTHS_TR[b.getMonth()]}`;
}

export function shortDay(date: string): string {
  return WEEKDAYS_SHORT_TR[parseDate(date).getDay()]!;
}

/** "8 Şubat" */
export function dayMonthLabel(date: string): string {
  const d = parseDate(date);
  return `${d.getDate()} ${MONTHS_TR[d.getMonth()]}`;
}

export function daysBetween(from: string, to: string): number {
  return Math.round((parseDate(to).getTime() - parseDate(from).getTime()) / 86_400_000);
}

export function dateRange(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

/** React Query's view of connectivity (device network state on native). */
export function useOnline(): boolean {
  return useSyncExternalStore(
    (cb) => onlineManager.subscribe(cb),
    () => onlineManager.isOnline(),
    () => true,
  );
}

const START: Record<'sabah' | 'ogle' | 'ikindi' | 'aksam' | 'yatsi', 'imsak' | 'ogle' | 'ikindi' | 'aksam' | 'yatsi'> = {
  sabah: 'imsak',
  ogle: 'ogle',
  ikindi: 'ikindi',
  aksam: 'aksam',
  yatsi: 'yatsi',
};

/**
 * Which of today's five prayers have already come in. Without times for
 * today, all five count as due (the user can still mark any of them).
 */
export function startedToday(
  today: { date: string; times: Record<string, string>; instants: Record<string, string> | null } | null,
  now: Date,
): Set<string> {
  const keys = Object.keys(START) as (keyof typeof START)[];
  if (!today) return new Set(keys);
  return new Set(
    keys.filter((k) => {
      const iso = today.instants?.[START[k]];
      const at = iso ? new Date(iso) : new Date(`${today.date}T${today.times[START[k]]}:00`);
      return !Number.isNaN(at.getTime()) && at.getTime() <= now.getTime();
    }),
  );
}

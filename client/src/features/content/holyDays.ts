/**
 * Turns the API's per-day rows into the events the "Dini günler" screen
 * shows: multi-day bayrams collapse into one row (with arefe), and markers
 * sharing a date (Üç Ayların Başlangıcı + Regaip) merge into one event.
 */
import { MONTHS_TR, parseDate, WEEKDAYS_TR } from '@/lib/dates';

export interface ReligiousDayRow {
  id: string;
  date: string;
  key: string;
  hijriYear: number;
  nameTr: string;
  nameEn: string | null;
  hijri: string | null;
  note: string | null;
  source: 'auto' | 'manual';
}

export interface HolyEvent {
  /** Reminder key in settings.holyDayReminders (year independent). */
  key: string;
  name: string;
  /** First day (YYYY-MM-DD). */
  date: string;
  hijri: string | null;
  hijriYear: number;
  /** Bayram: number of days; 1 otherwise. */
  days: number;
  /** Arefe date, for bayrams. */
  arefe: string | null;
  /** A marker that shares the date, e.g. "Üç Ayların Başlangıcı". */
  alsoMarks: string | null;
  kind: 'bayram' | 'night' | 'day';
}

const BAYRAM = /^(ramazan|kurban)-bayrami-(\d+|arefe)$/;
/** Observed in the evening of the given date (the night that follows). */
const NIGHTS = new Set(['regaip-kandili', 'mirac-kandili', 'berat-kandili', 'kadir-gecesi', 'mevlid-kandili']);
/** Markers that only annotate another event on the same date. */
const MARKERS = new Set(['uc-aylar-baslangici']);

export function groupHolyDays(rows: readonly ReligiousDayRow[]): HolyEvent[] {
  const events: HolyEvent[] = [];
  const bayrams = new Map<string, HolyEvent>();
  const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date));

  for (const row of sorted) {
    const m = BAYRAM.exec(row.key);
    if (m) {
      const group = `${m[1]}-bayrami`;
      const id = `${group}@${row.hijriYear}`;
      let ev = bayrams.get(id);
      if (!ev) {
        ev = {
          key: group,
          name: m[1] === 'ramazan' ? 'Ramazan Bayramı' : 'Kurban Bayramı',
          date: row.date,
          hijri: null,
          hijriYear: row.hijriYear,
          days: 0,
          arefe: null,
          alsoMarks: null,
          kind: 'bayram',
        };
        bayrams.set(id, ev);
        events.push(ev);
      }
      if (m[2] === 'arefe') {
        ev.arefe = row.date;
      } else {
        ev.days += 1;
        if (m[2] === '1') {
          ev.date = row.date;
          ev.hijri = row.hijri;
        }
      }
      continue;
    }
    events.push({
      key: row.key,
      name: row.nameTr,
      date: row.date,
      hijri: row.hijri,
      hijriYear: row.hijriYear,
      days: 1,
      arefe: null,
      alsoMarks: null,
      kind: NIGHTS.has(row.key) ? 'night' : 'day',
    });
  }

  // Fold markers into the event they share a date with.
  const out: HolyEvent[] = [];
  for (const ev of events) {
    if (!MARKERS.has(ev.key)) continue;
    const host = events.find((e) => e !== ev && e.date === ev.date && !MARKERS.has(e.key));
    if (host) host.alsoMarks = ev.name;
  }
  for (const ev of events) {
    if (MARKERS.has(ev.key) && events.some((e) => e !== ev && e.date === ev.date && !MARKERS.has(e.key))) continue;
    // A bayram whose day 1 fell outside the range still shows from its first visible day.
    if (ev.kind === 'bayram' && ev.days === 0) continue;
    out.push(ev);
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

/** Moment the event begins: the evening (≈18:00) for nights, midnight otherwise. */
export function eventStart(ev: HolyEvent): Date {
  const d = parseDate(ev.date);
  d.setHours(ev.kind === 'night' ? 18 : 0, 0, 0, 0);
  return d;
}

export function nextEvent(events: readonly HolyEvent[], now: Date): HolyEvent | null {
  return events.find((e) => {
    const end = parseDate(e.date);
    end.setDate(end.getDate() + Math.max(1, e.days));
    end.setHours(0, 0, 0, 0);
    // Nights stay "current" until the next morning.
    if (e.kind === 'night') end.setHours(6);
    return end.getTime() > now.getTime();
  }) ?? null;
}

export function countdownParts(target: Date, now: Date): { days: number; hours: number; minutes: number } {
  const ms = Math.max(0, target.getTime() - now.getTime());
  const totalMin = Math.floor(ms / 60_000);
  return { days: Math.floor(totalMin / 1440), hours: Math.floor((totalMin % 1440) / 60), minutes: totalMin % 60 };
}

/** "26 Recep 1448" → "26 Recep" */
export function hijriDayMonth(hijri: string | null): string | null {
  if (!hijri) return null;
  return hijri.replace(/\s*\d{4}$/, '').trim() || null;
}

export function shortMonth(date: string): string {
  return MONTHS_TR[parseDate(date).getMonth()]!.slice(0, 3);
}

export function dateLine(date: string): string {
  const d = parseDate(date);
  return `${d.getDate()} ${MONTHS_TR[d.getMonth()]} ${WEEKDAYS_TR[d.getDay()]}`;
}

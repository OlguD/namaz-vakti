import { addDays } from '../prayer-times/time-utils.js';

/** Approximate current hijri year (Umm al-Qura via ICU); only used to pick which years to sync. */
export function approximateHijriYear(date = new Date()): number {
  const parts = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', {
    year: 'numeric',
    timeZone: 'Europe/Istanbul',
  }).formatToParts(date);
  return Number(parts.find((part) => part.type === 'year')?.value);
}

/**
 * Month starts implied by Diyanet's own daily tables: a row saying that
 * 2026-11-04 is "24.5.1448" means 5/1448 began on 2026-10-12. Rows that imply
 * different starts for one month are reported as inconsistent.
 */
export function startsFromDiyanetRows(
  rows: Array<{ date: string; hijriShort: string | null }>,
  hijriYear: number,
): { starts: Map<number, string>; inconsistent: Set<number> } {
  const seen = new Map<number, Set<string>>();
  for (const row of rows) {
    const match = row.hijriShort ? /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(row.hijriShort) : null;
    if (!match || Number(match[3]) !== hijriYear) {
      continue;
    }
    const day = Number(match[1]);
    const month = Number(match[2]);
    if (day < 1 || day > 30 || month < 1 || month > 12) {
      continue;
    }
    const start = addDays(row.date, -(day - 1));
    seen.set(month, (seen.get(month) ?? new Set()).add(start));
  }
  const starts = new Map<number, string>();
  const inconsistent = new Set<number>();
  for (const [month, candidates] of seen) {
    if (candidates.size === 1) {
      starts.set(month, [...candidates][0]!);
    } else {
      inconsistent.add(month);
    }
  }
  return { starts, inconsistent };
}

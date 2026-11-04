/** Turkish date formatting that does not depend on the device's Intl data. */

export const MONTHS_TR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'] as const;
export const WEEKDAYS_TR = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'] as const;
export const WEEKDAYS_SHORT_TR = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'] as const;

/** Diyanet's Turkish transliteration of the hijri months. */
export const HIJRI_MONTHS_TR = [
  'Muharrem',
  'Safer',
  'Rebîülevvel',
  'Rebîülâhir',
  'Cemâziyelevvel',
  'Cemâziyelâhir',
  'Recep',
  'Şâban',
  'Ramazan',
  'Şevval',
  'Zilkade',
  'Zilhicce',
] as const;

/** Parses YYYY-MM-DD as a local calendar date (no time-zone shift). */
export function parseDate(date: string): Date {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return new Date(y, m - 1, d, 12);
}

/** "Çarşamba, 4 Kasım 2026" */
export function longDate(date: string | Date): string {
  const d = typeof date === 'string' ? parseDate(date) : date;
  return `${WEEKDAYS_TR[d.getDay()]}, ${d.getDate()} ${MONTHS_TR[d.getMonth()]} ${d.getFullYear()}`;
}

/** "4 Kasım" */
export function dayMonth(date: string | Date): string {
  const d = typeof date === 'string' ? parseDate(date) : date;
  return `${d.getDate()} ${MONTHS_TR[d.getMonth()]}`;
}

export function weekday(date: string | Date, short = false): string {
  const d = typeof date === 'string' ? parseDate(date) : date;
  return (short ? WEEKDAYS_SHORT_TR : WEEKDAYS_TR)[d.getDay()]!;
}

export interface Hijri {
  day: number;
  month: number;
  year: number;
}

/**
 * Hijri date from Intl (Umm al-Qura). Only a fallback: Diyanet's own date from
 * the prayer-time table is preferred whenever the API provides it.
 */
export function hijriFromIntl(date: Date): Hijri | null {
  try {
    const parts = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', { day: 'numeric', month: 'numeric', year: 'numeric' }).formatToParts(date);
    const get = (t: string) => Number(parts.find((p) => p.type === t)?.value?.replace(/[^\d]/g, ''));
    const day = get('day');
    const month = get('month');
    const year = get('year');
    return day && month && year ? { day, month, year } : null;
  } catch {
    return null;
  }
}

/** "24 Cemâziyelevvel 1448" */
export function hijriLabel(h: Hijri | null | undefined): string | null {
  if (!h) return null;
  return `${h.day} ${HIJRI_MONTHS_TR[h.month - 1] ?? ''} ${h.year}`;
}

/** "18:03" from an ISO instant, in the device's zone. */
export function clock(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

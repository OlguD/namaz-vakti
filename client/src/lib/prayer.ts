/** Prayer-time helpers shared by screens, notifications and widgets. */

export const VAKITS = ['imsak', 'gunes', 'ogle', 'ikindi', 'aksam', 'yatsi'] as const;
export type Vakit = (typeof VAKITS)[number];

export const VAKIT_LABEL: Record<Vakit, string> = {
  imsak: 'İmsak',
  gunes: 'Güneş',
  ogle: 'Öğle',
  ikindi: 'İkindi',
  aksam: 'Akşam',
  yatsi: 'Yatsı',
};

/** Turkish dative ("Yatsı'ya kalan"), with the right vowel harmony. */
export const VAKIT_DATIVE: Record<Vakit, string> = {
  imsak: "İmsak'a",
  gunes: "Güneş'e",
  ogle: "Öğle'ye",
  ikindi: "İkindi'ye",
  aksam: "Akşam'a",
  yatsi: "Yatsı'ya",
};

export interface HijriDate {
  day: number;
  month: number;
  year: number;
  /** e.g. "24 Cemaziyelevvel 1448" */
  long: string | null;
}

export interface PrayerDay {
  date: string;
  hijri: HijriDate | null;
  isRamadan: boolean;
  /** Local wall-clock times as published (HH:mm). */
  times: Record<Vakit, string>;
  /** UTC instants (ISO); null when the location's time zone is unknown. */
  instants: Record<Vakit, string> | null;
  moonPhaseUrl?: string | null;
  sunrise?: string | null;
  sunset?: string | null;
  qiblaTime?: string | null;
}

export interface VakitMoment {
  vakit: Vakit;
  at: Date;
  day: PrayerDay;
}

export interface VakitState {
  current: VakitMoment | null;
  next: VakitMoment | null;
  /** 0..1 progress from the current vakit to the next one. */
  progress: number;
  /** Milliseconds until the next vakit. */
  remainingMs: number;
  today: PrayerDay | null;
}

function moments(days: readonly PrayerDay[]): VakitMoment[] {
  const out: VakitMoment[] = [];
  for (const day of days) {
    for (const vakit of VAKITS) {
      const iso = day.instants?.[vakit];
      // Without a known zone, read the wall-clock time in the device's zone.
      const at = iso ? new Date(iso) : new Date(`${day.date}T${day.times[vakit]}:00`);
      if (!Number.isNaN(at.getTime())) out.push({ vakit, at, day });
    }
  }
  return out.sort((a, b) => a.at.getTime() - b.at.getTime());
}

/** Works out which vakit we are in, the next one and the countdown. */
export function vakitState(days: readonly PrayerDay[], now: Date = new Date()): VakitState {
  const all = moments(days);
  const t = now.getTime();
  let current: VakitMoment | null = null;
  let next: VakitMoment | null = null;
  for (const m of all) {
    if (m.at.getTime() <= t) current = m;
    else {
      next = m;
      break;
    }
  }
  const today =
    days.find((d) => d.date === localDate(now)) ?? current?.day ?? next?.day ?? days[0] ?? null;
  // Before today's imsak we are still in yesterday's yatsı.
  if (!current && next) {
    current = { vakit: 'yatsi', at: new Date(next.at.getTime() - 6 * 3600_000), day: next.day };
  }
  const remainingMs = next ? Math.max(0, next.at.getTime() - t) : 0;
  let progress = 0;
  if (current && next) {
    const span = next.at.getTime() - current.at.getTime();
    progress = span > 0 ? Math.min(1, Math.max(0, (t - current.at.getTime()) / span)) : 0;
  }
  return { current, next, progress, remainingMs, today };
}

/** "02:44:12" */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':');
}

/** Spoken form for screen readers: "2 saat 44 dakika". */
export function countdownLabel(ms: number): string {
  const minutes = Math.max(0, Math.round(ms / 60000));
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} dakika`;
  return m === 0 ? `${h} saat` : `${h} saat ${m} dakika`;
}

/** YYYY-MM-DD in the device's local time zone. */
export function localDate(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function addDays(date: string, n: number): string {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dt.toISOString().slice(0, 10);
}

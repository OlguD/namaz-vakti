/**
 * Pure builder for the local notification plan (no Expo imports, unit-tested).
 *
 * Prayer alerts are scheduled on the device, not pushed by the server, so they
 * work offline. iOS keeps at most 64 pending local notifications per app, so
 * the plan covers the next few days and is rebuilt whenever the app comes to
 * the foreground, the times change or the settings change.
 */
import type { AdhanSound, SettingsData } from '@/api/types';
import { VAKITS, VAKIT_LABEL, type PrayerDay, type Vakit } from '@/lib/prayer';

/** Leave a few slots free for other features (iOS limit is 64). */
export const MAX_PENDING = 56;
export const HORIZON_DAYS = 7;
export const SAHUR_BEFORE_MIN = 45;
export const IFTAR_BEFORE_MIN = 15;
export const FRIDAY_BEFORE_MIN = 60;
export const QURAN_AFTER_YATSI_MIN = 30;
/** Notifications closer than this are skipped (they would fire while scheduling). */
const MIN_LEAD_MS = 10_000;

export type PlanKind = 'vakit' | 'remind' | 'sahur' | 'iftar' | 'friday' | 'quran';

export interface PlannedNotification {
  /** Stable id: same plan → same ids (used to diff and to cancel only ours). */
  id: string;
  kind: PlanKind;
  at: Date;
  title: string;
  body: string;
  sound: AdhanSound;
  vakit?: Vakit;
  /** In-app route opened when the notification is tapped. */
  url: string;
}

export const ID_PREFIX = 'vakit:';

export function instantOf(day: PrayerDay, vakit: Vakit): Date | null {
  const iso = day.instants?.[vakit];
  const at = iso ? new Date(iso) : new Date(`${day.date}T${day.times[vakit]}:00`);
  return Number.isNaN(at.getTime()) ? null : at;
}

const minutesBefore = (d: Date, m: number) => new Date(d.getTime() - m * 60_000);

/** Friday by the calendar date of the prayer table (not the device zone). */
function isFriday(date: string): boolean {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay() === 5;
}

export interface PlanOptions {
  now?: Date;
  placeName?: string | null;
  horizonDays?: number;
  max?: number;
}

export function buildPlan(
  days: readonly PrayerDay[],
  settings: Pick<SettingsData, 'prayerNotifications' | 'reminders'>,
  opts: PlanOptions = {},
): PlannedNotification[] {
  const now = opts.now ?? new Date();
  const horizon = now.getTime() + (opts.horizonDays ?? HORIZON_DAYS) * 86_400_000;
  const where = opts.placeName ? `${opts.placeName} için ` : '';
  const out: PlannedNotification[] = [];
  const push = (n: PlannedNotification) => {
    const t = n.at.getTime();
    if (t - now.getTime() >= MIN_LEAD_MS && t <= horizon) out.push(n);
  };

  for (const day of days) {
    for (const vakit of VAKITS) {
      const pref = settings.prayerNotifications[vakit];
      const at = instantOf(day, vakit);
      if (!pref?.enabled || !at) continue;
      const label = VAKIT_LABEL[vakit];
      const time = day.times[vakit];
      push({
        id: `${ID_PREFIX}vakit:${day.date}:${vakit}`,
        kind: 'vakit',
        at,
        vakit,
        sound: pref.sound,
        title: vakit === 'gunes' ? `Güneş doğuyor · ${time}` : `${label} vakti · ${time}`,
        body:
          vakit === 'gunes'
            ? `${where}güneş doğuş vakti. Sabah namazının vakti çıktı.`
            : vakit === 'imsak'
              ? `${where}imsak vakti girdi.`
              : `${where}${label.toLocaleLowerCase('tr')} namazı vakti girdi.`,
        url: '/',
      });
      if (pref.remindBeforeMinutes > 0) {
        push({
          id: `${ID_PREFIX}remind:${day.date}:${vakit}`,
          kind: 'remind',
          at: minutesBefore(at, pref.remindBeforeMinutes),
          vakit,
          sound: pref.sound === 'sessiz' ? 'sessiz' : 'kisa',
          title: `${label} vaktine ${pref.remindBeforeMinutes} dakika`,
          body: `${where}${label.toLocaleLowerCase('tr')} ${time}'de giriyor.`,
          url: '/',
        });
      }
    }

    const imsak = instantOf(day, 'imsak');
    const aksam = instantOf(day, 'aksam');
    if (day.isRamadan && settings.reminders.sahur && imsak) {
      push({
        id: `${ID_PREFIX}sahur:${day.date}`,
        kind: 'sahur',
        at: minutesBefore(imsak, SAHUR_BEFORE_MIN),
        sound: 'kisa',
        title: 'Sahur vakti',
        body: `Sahur ${day.times.imsak}'de, imsakla biter.`,
        url: '/',
      });
    }
    if (day.isRamadan && settings.reminders.iftar && aksam) {
      push({
        id: `${ID_PREFIX}iftar:${day.date}`,
        kind: 'iftar',
        at: minutesBefore(aksam, IFTAR_BEFORE_MIN),
        sound: 'kisa',
        title: `İftara ${IFTAR_BEFORE_MIN} dakika`,
        body: `${where}iftar ${day.times.aksam}'de.`,
        url: '/',
      });
    }
    const ogle = instantOf(day, 'ogle');
    if (settings.reminders.friday && ogle && isFriday(day.date)) {
      push({
        id: `${ID_PREFIX}friday:${day.date}`,
        kind: 'friday',
        at: minutesBefore(ogle, FRIDAY_BEFORE_MIN),
        sound: 'kisa',
        title: 'Hayırlı cumalar',
        body: `Cuma namazı ${day.times.ogle}'de.`,
        url: '/',
      });
    }
    const yatsi = instantOf(day, 'yatsi');
    if (settings.reminders.dailyQuran && yatsi) {
      push({
        id: `${ID_PREFIX}quran:${day.date}`,
        kind: 'quran',
        at: new Date(yatsi.getTime() + QURAN_AFTER_YATSI_MIN * 60_000),
        sound: 'kisa',
        title: 'Günlük Kur’an',
        body: 'Bugünkü okumanızı yaptınız mı?',
        url: '/kuran',
      });
    }
  }

  out.sort((a, b) => a.at.getTime() - b.at.getTime() || a.id.localeCompare(b.id));
  // Keep the nearest ones; the plan is rebuilt as days pass.
  return out.slice(0, opts.max ?? MAX_PENDING);
}

/** Compact signature to skip rescheduling when nothing changed. */
export function planSignature(plan: readonly PlannedNotification[]): string {
  return plan.map((p) => `${p.id}@${p.at.getTime()}#${p.sound}`).join('|');
}

/** Android channel per sound (a channel's sound cannot change after creation). */
export function channelFor(sound: AdhanSound): string {
  return `vakit-${sound}`;
}

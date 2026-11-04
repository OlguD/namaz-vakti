import { describe, expect, it, jest } from '@jest/globals';
import { DEFAULT_SETTINGS } from '@/features/settings/api';
import type { PrayerDay } from '@/lib/prayer';
import { buildPlan, MAX_PENDING, planSignature } from './schedule';

jest.mock('@/api/client', () => ({}));
jest.mock('@/auth/session', () => ({ useSession: () => null }));

function day(date: string, opts: Partial<PrayerDay> = {}): PrayerDay {
  const t = { imsak: '06:05', gunes: '07:31', ogle: '12:53', ikindi: '15:37', aksam: '18:04', yatsi: '19:25' } as const;
  const instants = Object.fromEntries(
    Object.entries(t).map(([k, v]) => [k, new Date(`${date}T${v}:00+03:00`).toISOString()]),
  ) as PrayerDay['instants'];
  return { date, hijri: null, isRamadan: false, times: { ...t }, instants, ...opts };
}

const settings = structuredClone(DEFAULT_SETTINGS);
// 2026-11-04 is a Wednesday; 11:00 Istanbul time.
const now = new Date('2026-11-04T08:00:00Z');
const days = ['2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07'].map((d) => day(d));

describe('buildPlan', () => {
  it('schedules enabled vakits only, from now on, in time order', () => {
    const plan = buildPlan(days, settings, { now, placeName: 'İstanbul' });
    const first = plan[0]!;
    expect(first.id).toBe('vakit:vakit:2026-11-04:ogle');
    expect(first.title).toBe('Öğle vakti · 12:53');
    expect(first.body).toBe('İstanbul için öğle namazı vakti girdi.');
    // gunes is off by default
    expect(plan.some((p) => p.vakit === 'gunes')).toBe(false);
    // already passed today (imsak) is skipped
    expect(plan.some((p) => p.id === 'vakit:vakit:2026-11-04:imsak')).toBe(false);
    const times = plan.map((p) => p.at.getTime());
    expect([...times].sort((a, b) => a - b)).toEqual(times);
  });

  it('adds a reminder before the vakit when asked', () => {
    const s = structuredClone(settings);
    s.prayerNotifications.aksam.remindBeforeMinutes = 15;
    const plan = buildPlan(days, s, { now });
    const r = plan.find((p) => p.id === 'vakit:remind:2026-11-04:aksam')!;
    expect(r.at.toISOString()).toBe('2026-11-04T14:49:00.000Z');
    expect(r.title).toBe('Akşam vaktine 15 dakika');
  });

  it('adds sahur and iftar reminders only in Ramadan', () => {
    const ramadan = [day('2027-02-10', { isRamadan: true })];
    const plan = buildPlan(ramadan, settings, { now: new Date('2027-02-09T20:00:00Z') });
    expect(plan.find((p) => p.kind === 'sahur')!.at.toISOString()).toBe('2027-02-10T02:20:00.000Z');
    expect(plan.find((p) => p.kind === 'iftar')!.at.toISOString()).toBe('2027-02-10T14:49:00.000Z');
    expect(buildPlan(days, settings, { now }).some((p) => p.kind === 'sahur' || p.kind === 'iftar')).toBe(false);
  });

  it('adds a Friday reminder before öğle', () => {
    const plan = buildPlan(days, settings, { now });
    const fridays = plan.filter((p) => p.kind === 'friday');
    expect(fridays).toHaveLength(1);
    expect(fridays[0]!.id).toBe('vakit:friday:2026-11-06');
  });

  it('respects the pending-notification budget and the horizon', () => {
    const many = Array.from({ length: 30 }, (_, i) => {
      const d = new Date(Date.UTC(2026, 10, 4 + i)).toISOString().slice(0, 10);
      return day(d);
    });
    const s = structuredClone(settings);
    for (const v of Object.values(s.prayerNotifications)) {
      v.enabled = true;
      v.remindBeforeMinutes = 10;
    }
    const plan = buildPlan(many, s, { now });
    expect(plan.length).toBe(MAX_PENDING);
    const short = buildPlan(many, settings, { now, horizonDays: 2 });
    expect(short.every((p) => p.at.getTime() <= now.getTime() + 2 * 86_400_000)).toBe(true);
  });

  it('produces a stable signature', () => {
    expect(planSignature(buildPlan(days, settings, { now }))).toBe(planSignature(buildPlan(days, settings, { now })));
  });

  it('falls back to wall-clock times when instants are unknown', () => {
    const d = { ...day('2026-11-05'), instants: null };
    const plan = buildPlan([d], settings, { now });
    expect(plan.length).toBeGreaterThan(0);
  });
});

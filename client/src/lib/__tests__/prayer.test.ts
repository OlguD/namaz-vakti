import { addDays, countdownLabel, formatCountdown, vakitState, type PrayerDay } from '../prayer';

const day = (date: string, times: [string, string, string, string, string, string]): PrayerDay => {
  const [imsak, gunes, ogle, ikindi, aksam, yatsi] = times;
  const t = { imsak, gunes, ogle, ikindi, aksam, yatsi };
  // Istanbul is UTC+3 all year.
  const inst = Object.fromEntries(
    Object.entries(t).map(([k, v]) => [k, new Date(`${date}T${v}:00+03:00`).toISOString()]),
  ) as PrayerDay['instants'];
  return { date, hijri: null, isRamadan: false, times: t, instants: inst };
};

const days = [
  day('2026-11-04', ['06:05', '07:31', '12:53', '15:37', '18:04', '19:25']),
  day('2026-11-05', ['06:06', '07:32', '12:53', '15:36', '18:02', '19:24']),
];

describe('vakitState', () => {
  it('finds the current and next vakit with progress', () => {
    const s = vakitState(days, new Date('2026-11-04T14:00:00+03:00'));
    expect(s.current?.vakit).toBe('ogle');
    expect(s.next?.vakit).toBe('ikindi');
    expect(s.remainingMs).toBe(97 * 60_000);
    expect(s.progress).toBeCloseTo(67 / 164, 3);
    expect(s.today?.date).toBe('2026-11-04');
  });

  it('rolls over to tomorrow’s imsak after yatsı', () => {
    const s = vakitState(days, new Date('2026-11-04T23:00:00+03:00'));
    expect(s.current?.vakit).toBe('yatsi');
    expect(s.next?.vakit).toBe('imsak');
    expect(s.next?.day.date).toBe('2026-11-05');
  });

  it('treats the time before the first imsak as yatsı', () => {
    const s = vakitState(days, new Date('2026-11-04T04:00:00+03:00'));
    expect(s.current?.vakit).toBe('yatsi');
    expect(s.next?.vakit).toBe('imsak');
  });

  it('falls back to wall-clock times when instants are missing', () => {
    const noTz = days.map((d) => ({ ...d, instants: null }));
    const s = vakitState(noTz, new Date(2026, 10, 4, 13, 0));
    expect(s.current?.vakit).toBe('ogle');
  });

  it('is empty-safe', () => {
    expect(vakitState([], new Date())).toMatchObject({ current: null, next: null, progress: 0, remainingMs: 0 });
  });
});

describe('formatting', () => {
  it('formats countdowns', () => {
    expect(formatCountdown(2 * 3600_000 + 44 * 60_000 + 12_000)).toBe('02:44:12');
    expect(formatCountdown(-5)).toBe('00:00:00');
  });
  it('speaks countdowns in Turkish', () => {
    expect(countdownLabel(44 * 60_000)).toBe('44 dakika');
    expect(countdownLabel(2 * 3600_000)).toBe('2 saat');
    expect(countdownLabel(2 * 3600_000 + 5 * 60_000)).toBe('2 saat 5 dakika');
  });
  it('adds calendar days across month ends', () => {
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01');
    expect(addDays('2027-01-01', -1)).toBe('2026-12-31');
  });
});

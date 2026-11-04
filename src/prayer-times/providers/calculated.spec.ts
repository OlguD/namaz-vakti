import { calculateDays } from './calculated.js';

const minutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number) as [number, number];
  return h * 60 + m;
};

describe('calculateDays', () => {
  it('stays within 2 minutes of Diyanet for İstanbul (2026-11-04)', () => {
    const [day] = calculateDays(41.0082, 28.9784, 'Europe/Istanbul', '2026-11-04', 1);
    // Published by Diyanet for İstanbul on this date.
    const diyanet = {
      imsak: '06:05',
      gunes: '07:31',
      ogle: '12:53',
      ikindi: '15:38',
      aksam: '18:04',
      yatsi: '19:25',
    };
    for (const [key, expected] of Object.entries(diyanet)) {
      const actual = day![key as keyof typeof diyanet];
      expect(
        Math.abs(minutes(actual) - minutes(expected)),
        `${key}: ${actual} vs ${expected}`,
      ).toBeLessThanOrEqual(2);
    }
  });

  it('returns the requested number of consecutive days', () => {
    const days = calculateDays(51.5072, -0.1276, 'Europe/London', '2026-12-30', 4);
    expect(days.map((day) => day.date)).toEqual([
      '2026-12-30',
      '2026-12-31',
      '2027-01-01',
      '2027-01-02',
    ]);
  });
});

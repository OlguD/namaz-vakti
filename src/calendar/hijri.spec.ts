import { parseMonth } from './aladhan.client.js';
import { approximateHijriYear, startsFromDiyanetRows } from './hijri.js';

describe('startsFromDiyanetRows', () => {
  it('derives month starts from Diyanet’s daily hijri dates (real Emushaf rows)', () => {
    const { starts, inconsistent } = startsFromDiyanetRows(
      [
        { date: '2026-11-04', hijriShort: '24.5.1448' },
        { date: '2026-11-09', hijriShort: '29.5.1448' },
        { date: '2026-11-10', hijriShort: '1.6.1448' },
        { date: '2026-11-29', hijriShort: '20.6.1448' },
        { date: '2026-11-01', hijriShort: '21.5.1447' },
        { date: '2026-11-02', hijriShort: null },
      ],
      1448,
    );
    expect(Object.fromEntries(starts)).toEqual({ 5: '2026-10-12', 6: '2026-11-10' });
    expect(inconsistent.size).toBe(0);
  });

  it('flags a month whose rows disagree', () => {
    const { starts, inconsistent } = startsFromDiyanetRows(
      [
        { date: '2026-11-04', hijriShort: '24.5.1448' },
        { date: '2026-11-05', hijriShort: '24.5.1448' },
      ],
      1448,
    );
    expect(starts.has(5)).toBe(false);
    expect([...inconsistent]).toEqual([5]);
  });
});

describe('parseMonth (Aladhan)', () => {
  const day = (d: number, gregorian: string) => ({
    hijri: { day: String(d), month: { number: 7 }, year: '1448' },
    gregorian: { date: gregorian },
  });

  it('reads the start and the length', () => {
    const items = Array.from({ length: 30 }, (_, i) => day(i + 1, i === 0 ? '10-12-2026' : 'xx'));
    expect(parseMonth(items, 7, 1448)).toEqual({ start: '2026-12-10', length: 30 });
  });

  it('rejects responses for another month or of the wrong size', () => {
    const items = Array.from({ length: 30 }, (_, i) => day(i + 1, '10-12-2026'));
    expect(() => parseMonth(items, 8, 1448)).toThrow();
    expect(() => parseMonth(items.slice(0, 10), 7, 1448)).toThrow();
    expect(() => parseMonth(undefined, 7, 1448)).toThrow();
  });
});

describe('approximateHijriYear', () => {
  it('knows that November 2026 is 1448', () => {
    expect(approximateHijriYear(new Date('2026-11-04T12:00:00Z'))).toBe(1448);
  });
});

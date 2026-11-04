import { fold, matches } from '@/features/location/api';
import { moonName, moonPath } from '@/features/prayer/moon';
import { hijriLabel, longDate } from '../dates';
import { compassAbbr, distanceKm, qiblaBearing } from '../qibla';
import { titleTr } from '../text';

describe('qibla', () => {
  it('matches known bearings', () => {
    expect(qiblaBearing(41.0082, 28.9784)).toBeCloseTo(151.6, 0); // İstanbul
    expect(qiblaBearing(52.52, 13.405)).toBeCloseTo(136.6, 0); // Berlin
    expect(compassAbbr(151.6)).toBe('GD');
    expect(compassAbbr(359)).toBe('K');
  });
  it('computes distances', () => {
    expect(distanceKm(41.0082, 28.9784, 21.422487, 39.826206)).toBeGreaterThan(2390);
    expect(distanceKm(41.0082, 28.9784, 21.422487, 39.826206)).toBeLessThan(2420);
  });
});

describe('Turkish text', () => {
  it('title-cases Diyanet’s upper-case names', () => {
    expect(titleTr('İSTANBUL')).toBe('İstanbul');
    expect(titleTr('KÜÇÜKÇEKMECE')).toBe('Küçükçekmece');
    expect(titleTr('KUZEY KIBRIS')).toBe('Kuzey Kıbrıs');
    expect(titleTr('IĞDIR')).toBe('Iğdır');
  });
  it('searches accent-insensitively', () => {
    expect(fold('Kadıköy')).toBe('kadikoy');
    expect(matches('Kadıköy', 'kadikoy')).toBe(true);
    expect(matches('Şişli', 'SIS')).toBe(true);
    expect(matches('Fatih', 'üsk')).toBe(false);
  });
});

describe('dates', () => {
  it('formats long Turkish dates', () => {
    expect(longDate('2026-11-04')).toBe('Çarşamba, 4 Kasım 2026');
  });
  it('labels hijri dates with Diyanet month names', () => {
    expect(hijriLabel({ day: 12, month: 9, year: 1448 })).toBe('12 Ramazan 1448');
    expect(hijriLabel(null)).toBeNull();
  });
});

describe('moon phase', () => {
  it('names the phases', () => {
    expect(moonName(1)).toBe('Yeni ay');
    expect(moonName(15)).toBe('Dolunay');
    expect(moonName(8)).toBe('İlk dördün');
  });
  it('draws a closed path', () => {
    expect(moonPath(10)).toMatch(/^M7 .*Z$/);
  });
});

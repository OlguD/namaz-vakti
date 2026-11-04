import { describe, expect, it } from '@jest/globals';
import { distanceLabel, formatCoords, formatDistance, matchesQuery, metresBetween, radiusForSpan, regionFor, walkTime, zoomFor } from './format';

describe('mosque formatting', () => {
  it('formats distances like the design', () => {
    expect(formatDistance(347)).toBe('350 m');
    expect(formatDistance(4)).toBe('10 m');
    expect(formatDistance(1300)).toBe('1,3 km');
    expect(formatDistance(12_400)).toBe('12 km');
    expect(distanceLabel(1300)).toBe('1,3 kilometre');
    expect(distanceLabel(620)).toBe('620 metre');
  });

  it('estimates walking time (~80 m/min)', () => {
    expect(walkTime(350)).toBe('5 dk');
    expect(walkTime(900)).toBe('12 dk');
    expect(walkTime(2100)).toBe('27 dk');
    expect(walkTime(6000)).toBe('1 sa 15 dk');
  });

  it('computes distances and map spans', () => {
    const d = metresBetween({ lat: 41.01, lng: 28.97 }, { lat: 41.0102, lng: 28.964 });
    expect(d).toBeGreaterThan(450);
    expect(d).toBeLessThan(560);
    const r = regionFor({ lat: 41, lng: 29 }, 3000);
    expect(r.latitudeDelta).toBeCloseTo(0.0539, 3);
    expect(r.longitudeDelta).toBeGreaterThan(r.latitudeDelta);
    expect(radiusForSpan(r.latitudeDelta, r.longitudeDelta, 41)).toBe(3000);
    expect(radiusForSpan(0.0001, 0.0001, 41)).toBe(500);
    expect(radiusForSpan(5, 5, 41)).toBe(10_000);
  });

  it('picks a zoom that fits the radius', () => {
    expect(zoomFor(41, 3000, 393)).toBe(12);
    expect(zoomFor(41, 300, 393)).toBe(16);
  });

  it('formats coordinates and searches Turkish text', () => {
    expect(formatCoords({ lat: 40.99211, lng: 29.12384 })).toBe('40,9921 · 29,1238');
    expect(matchesQuery('Süleymaniye Camii', 'suleymaniye')).toBe(true);
    expect(matchesQuery('Beyazıt Camii', 'BEYAZIT')).toBe(true);
    expect(matchesQuery('Fetih Camii', 'mimar')).toBe(false);
  });
});

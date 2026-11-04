import { distanceToKaabaKm, qiblaBearing } from './qibla.js';

describe('qibla', () => {
  it.each([
    // Reference bearings from published qibla tables (±1°).
    ['İstanbul', 41.0082, 28.9784, 151.6],
    ['London', 51.5072, -0.1276, 118.9],
    ['New York', 40.7128, -74.006, 58.5],
    ['Jakarta', -6.2088, 106.8456, 295.1],
  ])('bearing from %s', (_name, lat, lng, expected) => {
    expect(Math.abs(qiblaBearing(lat, lng) - expected)).toBeLessThan(1);
  });

  it('distance from İstanbul is about 2,400 km', () => {
    expect(distanceToKaabaKm(41.0082, 28.9784)).toBeGreaterThan(2_350);
    expect(distanceToKaabaKm(41.0082, 28.9784)).toBeLessThan(2_450);
  });
});

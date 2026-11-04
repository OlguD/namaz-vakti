import { describe, expect, it } from '@jest/globals';
import {
  accuracyLevel,
  formatKm,
  isAligned,
  isMagneticInterference,
  normalize,
  shortestDelta,
  smoothAngle,
  unwrap,
} from './compass';

describe('compass maths', () => {
  it('normalizes angles', () => {
    expect(normalize(-10)).toBe(350);
    expect(normalize(370)).toBe(10);
    expect(normalize(360)).toBe(0);
  });

  it('takes the shortest turn across north', () => {
    expect(shortestDelta(350, 10)).toBe(20);
    expect(shortestDelta(10, 350)).toBe(-20);
    expect(shortestDelta(118, 151)).toBe(33);
    expect(shortestDelta(0, 180)).toBe(180);
  });

  it('smooths across the 0° seam instead of through 180°', () => {
    const s = smoothAngle(355, 5, 0.5);
    expect(s).toBeCloseTo(0, 5);
    expect(smoothAngle(null, 42)).toBe(42);
    // Large jumps snap.
    expect(smoothAngle(10, 200)).toBe(200);
  });

  it('keeps rotation continuous', () => {
    expect(unwrap(359, 1)).toBe(361);
    expect(unwrap(720, 350)).toBe(710);
  });

  it('detects alignment within ±3°', () => {
    expect(isAligned(149, 151)).toBe(true);
    expect(isAligned(155, 151)).toBe(false);
    expect(isAligned(359, 1)).toBe(true);
  });

  it('maps platform accuracy', () => {
    expect(accuracyLevel('ios', 5)).toBe('high');
    expect(accuracyLevel('ios', 20)).toBe('medium');
    expect(accuracyLevel('ios', -1)).toBe('low');
    expect(accuracyLevel('android', 3)).toBe('high');
    expect(accuracyLevel('android', 1)).toBe('low');
    expect(accuracyLevel('ios', null)).toBeNull();
  });

  it('flags magnetic interference', () => {
    expect(isMagneticInterference(20, 30, -25)).toBe(false); // ~44 µT
    expect(isMagneticInterference(200, 10, 10)).toBe(true);
    expect(isMagneticInterference(2, 3, 1)).toBe(true);
  });

  it('formats distance to the Kaaba', () => {
    expect(formatKm(2394.4)).toBe('2.394 km');
    expect(formatKm(812)).toBe('812 km');
  });
});

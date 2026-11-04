/** Pure compass maths: angle normalisation, smoothing and alignment. */

export type Accuracy = 'high' | 'medium' | 'low';

/** 0 ≤ a < 360 */
export function normalize(a: number): number {
  return ((a % 360) + 360) % 360;
}

/** Signed shortest turn from `from` to `to`, in (-180, 180]. Positive = turn right. */
export function shortestDelta(from: number, to: number): number {
  let d = normalize(to) - normalize(from);
  if (d > 180) d -= 360;
  if (d <= -180) d += 360;
  return d;
}

/**
 * Exponential smoothing on the circle. Works across the 359°→0° seam, and
 * snaps when the jump is large (first reading, phone flipped).
 */
export function smoothAngle(prev: number | null, next: number, alpha = 0.25, snapDeg = 90): number {
  if (prev == null) return normalize(next);
  const d = shortestDelta(prev, next);
  if (Math.abs(d) > snapDeg) return normalize(next);
  return normalize(prev + alpha * d);
}

/**
 * Keeps a rotation continuous so an animated dial never spins the long way
 * round: returns `prevUnwrapped + shortestDelta(prev, next)`.
 */
export function unwrap(prevUnwrapped: number, next: number): number {
  return prevUnwrapped + shortestDelta(prevUnwrapped, next);
}

export const ALIGN_TOLERANCE = 3;

export function isAligned(heading: number, qibla: number, tolerance = ALIGN_TOLERANCE): boolean {
  return Math.abs(shortestDelta(heading, qibla)) <= tolerance;
}

/**
 * Heading accuracy as reported by expo-location: iOS gives an error in degrees
 * (negative = invalid), Android a 0–3 sensor status.
 */
export function accuracyLevel(platform: string, raw: number | null | undefined): Accuracy | null {
  if (raw == null || Number.isNaN(raw)) return null;
  if (platform === 'ios') {
    if (raw < 0 || raw > 25) return 'low';
    return raw > 12 ? 'medium' : 'high';
  }
  if (platform === 'android') {
    if (raw <= 1) return 'low';
    return raw === 2 ? 'medium' : 'high';
  }
  return 'medium';
}

/** Earth's field is ~25–65 µT; well outside that means a magnet or metal nearby. */
export function isMagneticInterference(x: number, y: number, z: number, min = 20, max = 75): boolean {
  const m = Math.sqrt(x * x + y * y + z * z);
  return m < min || m > max;
}

/** "2.394 km" (Turkish thousands separator). */
export function formatKm(km: number): string {
  const n = Math.round(km);
  return `${String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.')} km`;
}

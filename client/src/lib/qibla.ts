/** Offline qibla maths (great-circle initial bearing to the Kaaba). */
export const KAABA = { lat: 21.422487, lng: 39.826206 } as const;

const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

/** Bearing from true north, 0–360°. */
export function qiblaBearing(lat: number, lng: number): number {
  const φ1 = rad(lat);
  const φ2 = rad(KAABA.lat);
  const Δλ = rad(KAABA.lng - lng);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (deg(Math.atan2(y, x)) + 360) % 360;
}

/** Haversine distance in km. */
export function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dφ = rad(lat2 - lat1);
  const dλ = rad(lng2 - lng1);
  const a = Math.sin(dφ / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dλ / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

const DIRS = ['K', 'KD', 'D', 'GD', 'G', 'GB', 'B', 'KB'] as const;
const DIR_NAMES = ['kuzey', 'kuzeydoğu', 'doğu', 'güneydoğu', 'güney', 'güneybatı', 'batı', 'kuzeybatı'] as const;

/** "GD" for 151°. */
export function compassAbbr(bearing: number): string {
  return DIRS[Math.round((((bearing % 360) + 360) % 360) / 45) % 8]!;
}

export function compassName(bearing: number): string {
  return DIR_NAMES[Math.round((((bearing % 360) + 360) % 360) / 45) % 8]!;
}

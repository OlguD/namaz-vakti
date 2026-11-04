/** Coordinates of the Kaaba (centre), WGS84. */
export const KAABA = { lat: 21.422487, lng: 39.826206 } as const;

const toRad = (deg: number) => (deg * Math.PI) / 180;
const toDeg = (rad: number) => (rad * 180) / Math.PI;

/**
 * Initial great-circle bearing from the point to the Kaaba, in degrees clockwise
 * from true north. The app adds the local magnetic declination before comparing it
 * to the compass heading.
 */
export function qiblaBearing(lat: number, lng: number): number {
  const φ1 = toRad(lat);
  const φ2 = toRad(KAABA.lat);
  const Δλ = toRad(KAABA.lng - lng);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

/** Haversine distance to the Kaaba in kilometres. */
export function distanceToKaabaKm(lat: number, lng: number): number {
  const R = 6371.0088;
  const dφ = toRad(KAABA.lat - lat);
  const dλ = toRad(KAABA.lng - lng);
  const a =
    Math.sin(dφ / 2) ** 2 +
    Math.cos(toRad(lat)) * Math.cos(toRad(KAABA.lat)) * Math.sin(dλ / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

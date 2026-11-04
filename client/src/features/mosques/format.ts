/** Distance / walking-time formatting and map maths for the mosque screens. */

/** Average walking pace (~4.8 km/h). */
const METRES_PER_MINUTE = 80;

/** "350 m", "1,3 km" */
export function formatDistance(m: number | null | undefined): string {
  if (m == null || Number.isNaN(m)) return '';
  if (m < 1000) return `${Math.max(10, Math.round(m / 10) * 10)} m`;
  const km = m / 1000;
  return `${(km < 10 ? km.toFixed(1) : Math.round(km).toString()).replace('.', ',')} km`;
}

/** Spoken form: "350 metre", "1,3 kilometre". */
export function distanceLabel(m: number | null | undefined): string {
  const s = formatDistance(m);
  return s.endsWith(' km') ? s.replace(' km', ' kilometre') : s.replace(' m', ' metre');
}

/** "5 dk", "1 sa 10 dk" */
export function walkTime(m: number | null | undefined): string {
  if (m == null || Number.isNaN(m)) return '';
  const min = Math.max(1, Math.ceil(m / METRES_PER_MINUTE));
  if (min < 60) return `${min} dk`;
  const h = Math.floor(min / 60);
  const r = min % 60;
  return r ? `${h} sa ${r} dk` : `${h} sa`;
}

export interface LatLng {
  lat: number;
  lng: number;
}

/** Haversine distance in metres. */
export function metresBetween(a: LatLng, b: LatLng): number {
  const R = 6_371_000;
  const r = (d: number) => (d * Math.PI) / 180;
  const dφ = r(b.lat - a.lat);
  const dλ = r(b.lng - a.lng);
  const h = Math.sin(dφ / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dλ / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Map deltas (react-native-maps region) that show `radiusM` around a point. */
export function regionFor(center: LatLng, radiusM: number) {
  const latDelta = (radiusM * 2) / 111_320;
  const lngDelta = latDelta / Math.max(0.2, Math.cos((center.lat * Math.PI) / 180));
  return { latitude: center.lat, longitude: center.lng, latitudeDelta: latDelta, longitudeDelta: lngDelta };
}

/** Web-mercator zoom that fits `radiusM` around the centre in `widthPx`. */
export function zoomFor(lat: number, radiusM: number, widthPx: number): number {
  const metresPerPxAtZoom0 = (156_543.03392 * Math.cos((lat * Math.PI) / 180));
  const z = Math.log2((metresPerPxAtZoom0 * widthPx) / (radiusM * 2));
  return Math.max(3, Math.min(18, Math.floor(z)));
}

/** Radius (m) to query for a visible span: half the larger side, clamped to the API's limits. */
export function radiusForSpan(latDelta: number, lngDelta: number, lat: number): number {
  const h = latDelta * 111_320;
  const w = lngDelta * 111_320 * Math.cos((lat * Math.PI) / 180);
  return Math.round(Math.min(10_000, Math.max(500, Math.max(h, w) / 2)));
}

/** "40,9921 · 29,1238" */
export function formatCoords(p: LatLng): string {
  return `${p.lat.toFixed(4).replace('.', ',')} · ${p.lng.toFixed(4).replace('.', ',')}`;
}

/** Case- and diacritic-insensitive Turkish search. */
export function matchesQuery(text: string, query: string): boolean {
  const fold = (s: string) =>
    s
      .toLocaleLowerCase('tr')
      .replace(/[âà]/g, 'a')
      .replace(/[îı]/g, 'i')
      .replace(/[ûü]/g, 'u')
      .replace(/ö/g, 'o')
      .replace(/ç/g, 'c')
      .replace(/ş/g, 's')
      .replace(/ğ/g, 'g');
  return fold(text).includes(fold(query.trim()));
}

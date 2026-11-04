/** Fixed grid used to import mosques area by area. 0.2° ≈ 22 km north–south. */
export const TILE_DEGREES = 0.2;

export interface BBox {
  south: number;
  west: number;
  north: number;
  east: number;
}

/** Grid index for a coordinate; the epsilon stops 151.2 / 0.2 = 755.999… landing one cell short. */
function cell(value: number): number {
  return Math.floor(value / TILE_DEGREES + 1e-9);
}

export function tileIdFor(lat: number, lng: number): string {
  return `${cell(lat)}:${cell(lng)}`;
}

export function tileBBox(tileId: string): BBox {
  const [row, col] = tileId.split(':').map(Number) as [number, number];
  const round = (value: number) => Math.round(value * 1e6) / 1e6;
  return {
    south: round(row * TILE_DEGREES),
    west: round(col * TILE_DEGREES),
    north: round((row + 1) * TILE_DEGREES),
    east: round((col + 1) * TILE_DEGREES),
  };
}

/** Every tile intersecting the square that encloses a circle of `radiusM` metres. */
export function tilesCovering(lat: number, lng: number, radiusM: number): string[] {
  const dLat = radiusM / 111_320;
  const dLng = radiusM / (111_320 * Math.max(Math.cos((lat * Math.PI) / 180), 0.01));
  const rowMin = cell(Math.max(-90, lat - dLat));
  const rowMax = cell(Math.min(89.999, lat + dLat));
  const colMin = cell(lng - dLng);
  const colMax = cell(lng + dLng);
  const ids: string[] = [];
  for (let row = rowMin; row <= rowMax; row += 1) {
    for (let col = colMin; col <= colMax; col += 1) {
      // Wrap longitude so tiles across the antimeridian keep valid ids.
      const wrapped = ((((col + 900) % 1800) + 1800) % 1800) - 900;
      ids.push(`${row}:${wrapped}`);
    }
  }
  return [...new Set(ids)];
}

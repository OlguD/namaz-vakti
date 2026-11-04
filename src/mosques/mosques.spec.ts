import { parseOverpass } from './overpass.client.js';
import { tileBBox, tileIdFor, tilesCovering } from './tiles.js';

describe('tiles', () => {
  it('maps a point to the tile that contains it', () => {
    const id = tileIdFor(41.0082, 28.9784);
    const box = tileBBox(id);
    expect(box.south).toBeLessThanOrEqual(41.0082);
    expect(box.north).toBeGreaterThan(41.0082);
    expect(box.west).toBeLessThanOrEqual(28.9784);
    expect(box.east).toBeGreaterThan(28.9784);
  });

  it('covers a radius with a small set of tiles', () => {
    const tiles = tilesCovering(41.0082, 28.9784, 5_000);
    expect(tiles).toContain(tileIdFor(41.0082, 28.9784));
    expect(tiles.length).toBeGreaterThanOrEqual(1);
    expect(tiles.length).toBeLessThanOrEqual(4);
  });

  it('handles negative coordinates', () => {
    expect(tileIdFor(-33.86, 151.2)).toBe('-170:756');
    expect(tileBBox('-170:756')).toEqual({ south: -34, west: 151.2, north: -33.8, east: 151.4 });
  });
});

describe('parseOverpass', () => {
  it('reads nodes and way centres and builds an address', () => {
    const result = parseOverpass([
      {
        type: 'node',
        id: 1,
        lat: 41.0054,
        lon: 28.9768,
        tags: {
          amenity: 'place_of_worship',
          religion: 'muslim',
          name: 'Sultan Ahmet Camii',
          'name:en': 'Blue Mosque',
          'addr:street': 'Sultan Ahmet',
          'addr:housenumber': '7',
          'addr:city': 'İstanbul',
          'source:date': 'x',
        },
      },
      {
        type: 'way',
        id: 2,
        center: { lat: 41.016, lon: 28.964 },
        tags: { name: 'Süleymaniye Camii' },
      },
      { type: 'relation', id: 3, tags: { name: 'no geometry' } },
    ]);
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      osmRef: 'node/1',
      name: 'Sultan Ahmet Camii',
      nameEn: 'Blue Mosque',
      address: 'Sultan Ahmet 7, İstanbul',
    });
    expect(result[0]!.tags).not.toHaveProperty('source:date');
    expect(result[1]).toMatchObject({ osmRef: 'way/2', lat: 41.016, lng: 28.964 });
  });
});

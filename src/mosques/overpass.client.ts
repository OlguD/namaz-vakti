import { Injectable } from '@nestjs/common';
import { AppConfig } from '../config/app-config.service.js';
import { HttpClient } from '../common/http-client.js';
import type { BBox } from './tiles.js';

export interface OsmMosque {
  osmRef: string;
  lat: number;
  lng: number;
  name: string | null;
  nameEn: string | null;
  nameAr: string | null;
  address: string | null;
  website: string | null;
  phone: string | null;
  wheelchair: string | null;
  tags: Record<string, string>;
}

interface OverpassElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

const KEPT_TAGS =
  /^(name(:.+)?|addr:.+|website|contact:.+|phone|wheelchair|building|denomination|opening_hours|capacity|toilets.*|wudu.*)$/;

/**
 * Mosque data from OpenStreetMap via the Overpass API (ODbL; the app must show
 * "© OpenStreetMap contributors"). Respect the public instance's fair-use limits
 * or run your own Overpass for production traffic.
 */
@Injectable()
export class OverpassClient {
  private readonly http: HttpClient;
  private readonly url: string;

  constructor(config: AppConfig) {
    this.url = config.get('OVERPASS_BASE_URL');
    this.http = new HttpClient({
      service: 'overpass',
      userAgent: config.get('OUTBOUND_USER_AGENT'),
      timeoutMs: 60_000,
      retries: 1,
      breakerThreshold: 4,
      breakerCooldownMs: 5 * 60_000,
    });
  }

  async mosquesIn(box: BBox): Promise<OsmMosque[]> {
    const bbox = `${box.south},${box.west},${box.north},${box.east}`;
    const query = `[out:json][timeout:50];nwr["amenity"="place_of_worship"]["religion"="muslim"](${bbox});out center tags;`;
    const response = await this.http.json<{ elements?: OverpassElement[] }>(this.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ data: query }).toString(),
    });
    return parseOverpass(response.elements ?? []);
  }
}

export function parseOverpass(elements: OverpassElement[]): OsmMosque[] {
  const mosques: OsmMosque[] = [];
  for (const element of elements) {
    const lat = element.lat ?? element.center?.lat;
    const lng = element.lon ?? element.center?.lon;
    if (lat === undefined || lng === undefined) {
      continue;
    }
    const tags = element.tags ?? {};
    const kept = Object.fromEntries(Object.entries(tags).filter(([key]) => KEPT_TAGS.test(key)));
    mosques.push({
      osmRef: `${element.type}/${element.id}`,
      lat,
      lng,
      name: tags.name ?? null,
      nameEn: tags['name:en'] ?? null,
      nameAr: tags['name:ar'] ?? null,
      address: formatAddress(tags),
      website: tags.website ?? tags['contact:website'] ?? null,
      phone: tags.phone ?? tags['contact:phone'] ?? null,
      wheelchair: tags.wheelchair ?? null,
      tags: kept,
    });
  }
  return mosques;
}

function formatAddress(tags: Record<string, string>): string | null {
  if (tags['addr:full']) {
    return tags['addr:full'];
  }
  const street = [tags['addr:street'], tags['addr:housenumber']].filter(Boolean).join(' ');
  const place = [
    tags['addr:postcode'],
    tags['addr:district'] ?? tags['addr:suburb'],
    tags['addr:city'],
  ]
    .filter(Boolean)
    .join(' ');
  const parts = [street, place].filter(Boolean);
  return parts.length > 0 ? parts.join(', ') : null;
}

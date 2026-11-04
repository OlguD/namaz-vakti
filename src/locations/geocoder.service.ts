import { Injectable } from '@nestjs/common';
import { AppConfig } from '../config/app-config.service.js';
import { HttpClient } from '../common/http-client.js';

export interface GeoPoint {
  lat: number;
  lng: number;
}

interface NominatimResult {
  lat: string;
  lon: string;
}

/**
 * Forward geocoding via Nominatim (OpenStreetMap). The public instance allows at
 * most 1 request/second and requires an identifying User-Agent; the geocode queue
 * enforces the rate. For heavy use, point NOMINATIM_BASE_URL at a self-hosted one.
 */
@Injectable()
export class GeocoderService {
  private readonly http: HttpClient;
  private readonly baseUrl: string;

  constructor(private readonly config: AppConfig) {
    this.baseUrl = config.get('NOMINATIM_BASE_URL').replace(/\/$/, '');
    this.http = new HttpClient({
      service: 'nominatim',
      userAgent: config.get('OUTBOUND_USER_AGENT'),
      timeoutMs: 10_000,
      retries: 1,
    });
  }

  /**
   * Tries "district, city, country" first, then "city, country". Upstream city
   * centres are often named "MERKEZ" (centre), which is useless as a query, so
   * that case skips straight to the city.
   */
  async locateDistrict(district: string, city: string, country: string): Promise<GeoPoint | null> {
    const candidates: string[] = [];
    const isCentre =
      /^merkez$/i.test(district.trim()) ||
      district.trim().toLowerCase() === city.trim().toLowerCase();
    if (!isCentre) {
      candidates.push(`${district}, ${city}, ${country}`);
    }
    candidates.push(`${city}, ${country}`);

    for (const query of candidates) {
      const point = await this.search(query);
      if (point) {
        return point;
      }
    }
    return null;
  }

  private async search(query: string): Promise<GeoPoint | null> {
    const params = new URLSearchParams({
      q: query,
      format: 'jsonv2',
      limit: '1',
      'accept-language': 'en',
    });
    const email = this.config.get('NOMINATIM_EMAIL');
    if (email) {
      params.set('email', email);
    }
    const results = await this.http.json<NominatimResult[]>(`${this.baseUrl}/search?${params}`);
    const [first] = results;
    if (!first) {
      return null;
    }
    const lat = Number(first.lat);
    const lng = Number(first.lon);
    return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
  }
}

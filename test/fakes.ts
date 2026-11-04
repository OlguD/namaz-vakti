import { UpstreamError } from '../src/common/http-client.js';
import type { OsmMosque } from '../src/mosques/overpass.client.js';
import type {
  LocationEntry,
  PrayerTimesProvider,
  ProviderDay,
} from '../src/prayer-times/providers/provider.js';
import { addDays, localDate } from '../src/prayer-times/time-utils.js';
import type { SocialIdentity } from '../src/auth/social-verifier.service.js';
import type { YoutubeChannelInfo, YoutubeVideoStatus } from '../src/live/youtube.client.js';

/** In-memory stand-in for the Emushaf API, with call counting and an off switch. */
export class FakePrayerProvider implements PrayerTimesProvider {
  readonly name = 'emushaf' as const;
  down = false;
  calls = { countries: 0, cities: 0, districts: 0, times: 0 };

  readonly data = {
    countries: [
      { id: '2', name: 'TÜRKİYE', nameEn: 'TÜRKİYE' },
      { id: '15', name: 'BİRLEŞİK KRALLIK', nameEn: 'UNITED KINGDOM' },
      { id: '999', name: 'AMERİKA', nameEn: 'UNITED STATES' },
    ],
    cities: {
      '2': [{ id: '539', name: 'İSTANBUL', nameEn: 'ISTANBUL' }],
      '15': [{ id: '725', name: 'İNGİLTERE', nameEn: 'ENGLAND' }],
      '999': [{ id: '800', name: 'NEW YORK', nameEn: 'NEW YORK' }],
    } as Record<string, LocationEntry[]>,
    districts: {
      '539': [
        { id: '9541', name: 'İSTANBUL', nameEn: 'ISTANBUL' },
        { id: '9542', name: 'ADALAR', nameEn: 'ADALAR' },
      ],
      '725': [{ id: '14096', name: 'LONDRA', nameEn: 'LONDON' }],
      '800': [{ id: '8001', name: 'NEW YORK', nameEn: 'NEW YORK' }],
    } as Record<string, LocationEntry[]>,
  };

  async countries() {
    this.calls.countries += 1;
    this.guard();
    return this.data.countries;
  }

  async cities(countryId: string) {
    this.calls.cities += 1;
    this.guard();
    return this.data.cities[countryId] ?? [];
  }

  async districts(cityId: string) {
    this.calls.districts += 1;
    this.guard();
    return this.data.districts[cityId] ?? [];
  }

  /** 30 days starting 2 days ago, like the real API's monthly window. */
  async times(): Promise<ProviderDay[]> {
    this.calls.times += 1;
    this.guard();
    const start = addDays(localDate(new Date(), 'Europe/Istanbul'), -2);
    return Array.from({ length: 30 }, (_, i) => ({
      date: addDays(start, i),
      imsak: '06:05',
      gunes: '07:31',
      ogle: '12:53',
      ikindi: '15:38',
      aksam: '18:04',
      yatsi: '19:25',
      sunrise: '07:38',
      sunset: '17:57',
      qiblaTime: '11:05',
      hijriShort: `${(i % 29) + 1}.9.1448`,
      hijriLong: `${(i % 29) + 1} Ramazan 1448`,
    }));
  }

  private guard(): void {
    if (this.down) {
      throw new UpstreamError('emushaf', 'fake outage');
    }
  }
}

export class FakeOverpass {
  calls = 0;
  mosques: OsmMosque[] = [
    mosque('node/1', 41.0054, 28.9768, 'Sultan Ahmet Camii'),
    mosque('way/2', 41.016, 28.964, 'Süleymaniye Camii'),
    mosque('node/3', 41.0086, 28.98, 'Ayasofya Camii'),
  ];

  async mosquesIn(box: { south: number; west: number; north: number; east: number }) {
    this.calls += 1;
    return this.mosques.filter(
      (m) => m.lat >= box.south && m.lat < box.north && m.lng >= box.west && m.lng < box.east,
    );
  }
}

function mosque(osmRef: string, lat: number, lng: number, name: string): OsmMosque {
  return {
    osmRef,
    lat,
    lng,
    name,
    nameEn: null,
    nameAr: null,
    address: null,
    website: null,
    phone: null,
    wheelchair: null,
    tags: { name },
  };
}

/** Identity tokens are "subject|email" strings; anything else is rejected. */
export class FakeSocialVerifier {
  async verifyApple(token: string): Promise<SocialIdentity> {
    return this.parse(token, 'apple');
  }

  async verifyGoogle(token: string): Promise<SocialIdentity> {
    return { ...this.parse(token, 'google'), name: 'Google Kullanıcı' };
  }

  private parse(token: string, provider: 'apple' | 'google'): SocialIdentity {
    const [subject, email] = token.split('|');
    if (!subject) {
      throw new Error('bad token');
    }
    return { provider, subject, email, emailVerified: Boolean(email) };
  }
}

export class FakeYoutube {
  enabled = true;
  feed: Record<string, string[]> = {};
  statuses: Record<string, YoutubeVideoStatus> = {};
  videoCalls = 0;

  async resolveChannel(input: string): Promise<YoutubeChannelInfo> {
    return {
      id: input.startsWith('UC') ? input : 'UCfakechannelid00000000',
      title: 'Test Kanal',
      thumbnailUrl: null,
    };
  }

  async recentVideoIds(channelId: string): Promise<string[]> {
    return this.feed[channelId] ?? [];
  }

  async videoStatuses(ids: string[]): Promise<Map<string, YoutubeVideoStatus>> {
    this.videoCalls += 1;
    return new Map(ids.filter((id) => this.statuses[id]).map((id) => [id, this.statuses[id]!]));
  }
}

export class FakeExpo {
  sent: Array<{ to: string; title: string; body: string }> = [];

  async send(messages: Array<{ to: string; title: string; body: string }>) {
    this.sent.push(...messages);
    return messages.map((message, index) =>
      message.to.includes('dead')
        ? { status: 'error' as const, message: 'gone', details: { error: 'DeviceNotRegistered' } }
        : { status: 'ok' as const, id: `ticket-${this.sent.length}-${index}` },
    );
  }

  async receipts(ids: string[]) {
    return Object.fromEntries(ids.map((id) => [id, { status: 'ok' as const }]));
  }
}

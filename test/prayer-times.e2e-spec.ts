import { LocationsService } from '../src/locations/locations.service.js';
import { localDate } from '../src/prayer-times/time-utils.js';
import { createTestApp, type TestContext } from './app.js';

describe('Locations & prayer times (e2e)', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx.close();
  });

  it('lazily syncs the location directory from the provider, once', async () => {
    const countries = await ctx.http().get('/v1/locations/countries').expect(200);
    expect(countries.body.map((c: { id: string }) => c.id)).toEqual(
      expect.arrayContaining(['2', '15']),
    );
    expect(countries.headers['cache-control']).toContain('max-age');

    const cities = await ctx.http().get('/v1/locations/countries/2/cities').expect(200);
    expect(cities.body).toEqual([{ id: '539', name: 'İSTANBUL', nameEn: 'ISTANBUL' }]);
    const districts = await ctx.http().get('/v1/locations/cities/539/districts').expect(200);
    expect(districts.body.map((d: { id: string }) => d.id).sort()).toEqual(['9541', '9542']);

    const before = { ...ctx.fakes.prayer.calls };
    await ctx.http().get('/v1/locations/countries').expect(200);
    await ctx.http().get('/v1/locations/countries/2/cities').expect(200);
    await ctx.http().get('/v1/locations/cities/539/districts').expect(200);
    expect(ctx.fakes.prayer.calls).toEqual(before);

    await ctx.http().get('/v1/locations/countries/nope/cities').expect(404);
  });

  it('returns times with local strings and UTC instants (Türkiye default zone)', async () => {
    const res = await ctx.http().get('/v1/prayer-times/districts/9541?days=7').expect(200);
    expect(res.body.district).toMatchObject({
      id: '9541',
      city: { id: '539' },
      country: { id: '2' },
      timezone: 'Europe/Istanbul',
    });
    expect(res.body.source).toBe('emushaf');
    expect(res.body.stale).toBe(false);
    expect(res.body.days).toHaveLength(7);
    const today = localDate(new Date(), 'Europe/Istanbul');
    const [first] = res.body.days;
    expect(first.date).toBe(today);
    expect(first.times.imsak).toBe('06:05');
    expect(first.instants.imsak).toBe(`${today}T03:05:00.000Z`);
    expect(first.hijri).toMatchObject({ month: 9, year: 1448 });
    expect(first.isRamadan).toBe(true);
  });

  it('serves repeat requests from cache without calling the provider', async () => {
    const before = ctx.fakes.prayer.calls.times;
    await ctx.http().get('/v1/prayer-times/districts/9541?days=7').expect(200);
    await ctx.http().get('/v1/prayer-times/districts/9541?days=3').expect(200);
    expect(ctx.fakes.prayer.calls.times).toBe(before);
  });

  it('accepts an explicit start date and validates input', async () => {
    const today = localDate(new Date(), 'Europe/Istanbul');
    const res = await ctx
      .http()
      .get(`/v1/prayer-times/districts/9541?days=2&from=${today}`)
      .expect(200);
    expect(res.body.days[0].date).toBe(today);
    await ctx.http().get('/v1/prayer-times/districts/9541?days=99').expect(400);
    await ctx.http().get('/v1/prayer-times/districts/9541?from=04.11.2026').expect(400);
    await ctx.http().get('/v1/prayer-times/districts/nope').expect(404);
  });

  it('falls back to a local calculation when the provider is down and nothing is cached', async () => {
    await ctx.http().get('/v1/locations/cities/539/districts').expect(200);
    await ctx.app.get(LocationsService).setDistrictLocation('9542', { lat: 40.8762, lng: 29.0906 });
    ctx.fakes.prayer.down = true;
    try {
      const res = await ctx.http().get('/v1/prayer-times/districts/9542?days=3').expect(200);
      expect(res.body.source).toBe('calculated');
      expect(res.body.days).toHaveLength(3);
      expect(res.body.days[0].instants.ogle).toMatch(/Z$/);
    } finally {
      ctx.fakes.prayer.down = false;
    }
  });

  it('answers 503 when the provider is down, nothing is cached and coordinates are unknown', async () => {
    await ctx.http().get('/v1/locations/countries/15/cities').expect(200);
    await ctx.http().get('/v1/locations/cities/725/districts').expect(200);
    ctx.fakes.prayer.down = true;
    try {
      const res = await ctx.http().get('/v1/prayer-times/districts/14096').expect(503);
      expect(res.body.error.code).toBe('UPSTREAM_UNAVAILABLE');
    } finally {
      ctx.fakes.prayer.down = false;
    }
  });

  it('uses London summer/winter offsets for UK districts', async () => {
    const res = await ctx.http().get('/v1/prayer-times/districts/14096?days=1').expect(200);
    expect(res.body.timezone).toBe('Europe/London');
    const offsetHours =
      (Date.parse(`${res.body.days[0].date}T12:53:00Z`) -
        Date.parse(res.body.days[0].instants.ogle)) /
      3_600_000;
    expect([0, 1]).toContain(offsetHours);
  });

  it('finds the nearest geocoded district and uses its official table', async () => {
    await ctx.app.get(LocationsService).setDistrictLocation('9541', { lat: 41.0082, lng: 28.9784 });
    const nearest = await ctx.http().get('/v1/locations/nearest?lat=41.02&lng=28.95').expect(200);
    expect(nearest.body.district.id).toBe('9541');
    expect(nearest.body.distanceKm).toBeLessThan(5);

    const times = await ctx
      .http()
      .get('/v1/prayer-times/nearby?lat=41.02&lng=28.95&days=2')
      .expect(200);
    expect(times.body.district.id).toBe('9541');
    expect(times.body.source).toBe('emushaf');
  });

  it('calculates for positions with no district nearby', async () => {
    const res = await ctx
      .http()
      .get('/v1/prayer-times/nearby?lat=-33.8688&lng=151.2093&days=2')
      .expect(200);
    expect(res.body).toMatchObject({
      district: null,
      source: 'calculated',
      timezone: 'Australia/Sydney',
    });
    expect(res.body.location).toEqual({ lat: -33.8688, lng: 151.2093 });
    const none = await ctx
      .http()
      .get('/v1/locations/nearest?lat=-33.8688&lng=151.2093')
      .expect(200);
    expect(none.body).toEqual({});
  });

  it('computes the qibla bearing', async () => {
    const res = await ctx.http().get('/v1/locations/qibla?lat=51.5072&lng=-0.1276').expect(200);
    expect(res.body.bearing).toBeCloseTo(118.9, 0);
    await ctx.http().get('/v1/locations/qibla?lat=200&lng=0').expect(400);
  });
});

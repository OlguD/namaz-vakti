import { eq } from 'drizzle-orm';
import { CalendarService } from '../src/calendar/calendar.service.js';
import { MetalPricesService } from '../src/content/metal-prices.service.js';
import { DB, type Database } from '../src/db/database.module.js';
import { metalPriceHistory, prayerTimes, zakatSettings } from '../src/db/schema/index.js';
import { bearer, createTestApp, type TestContext, unique } from './app.js';

describe('Automatic holy days and zakat prices (e2e)', () => {
  let ctx: TestContext;
  let db: Database;
  let admin: { accessToken: string };

  beforeAll(async () => {
    ctx = await createTestApp();
    db = ctx.app.get<Database>(DB);
    const res = await ctx
      .http()
      .post('/v1/auth/google')
      .send({ idToken: `${unique('auto-admin-')}|admin@example.com` })
      .expect(201);
    admin = { accessToken: res.body.tokens.accessToken };
  });

  afterAll(async () => {
    await ctx.close();
  });

  describe('holy days', () => {
    beforeAll(async () => {
      // Aladhan (DIYANET) month starts, as Diyanet published them.
      Object.assign(ctx.fakes.aladhan.starts, {
        '1447-1': '2025-06-26',
        // Deliberately one day off for 2/1447, to prove Diyanet's own tables win.
        '1447-2': '2025-07-27',
        '1447-3': '2025-08-24',
        '1447-7': '2025-12-21',
        '1447-8': '2026-01-20',
        '1447-9': '2026-02-19',
        '1447-10': '2026-03-20',
        '1447-12': '2026-05-18',
        '1448-7': '2026-12-10',
        '1448-8': '2027-01-09',
        '1448-9': '2027-02-08',
        '1448-10': '2027-03-09',
      });

      // Diyanet's own daily hijri dates, stored the normal way with prayer times
      // (past dates and an old fetch time, so other suites are unaffected).
      await ctx.http().get('/v1/locations/countries').expect(200);
      await ctx.http().get('/v1/locations/countries/2/cities').expect(200);
      await ctx.http().get('/v1/locations/cities/539/districts').expect(200);
      const times = {
        imsak: '06:05',
        gunes: '07:31',
        ogle: '12:53',
        ikindi: '15:38',
        aksam: '18:04',
        yatsi: '19:25',
      };
      const old = new Date('2020-01-01T00:00:00Z');
      await db
        .insert(prayerTimes)
        .values([
          {
            districtId: '9541',
            date: '2025-07-30',
            hijriShort: '5.2.1447',
            source: 'emushaf',
            fetchedAt: old,
            ...times,
          },
          {
            districtId: '9541',
            date: '2025-08-24',
            hijriShort: '1.3.1447',
            source: 'emushaf',
            fetchedAt: old,
            ...times,
          },
        ])
        .onConflictDoNothing();
    });

    it('generates Diyanet’s holy days for both years', async () => {
      const calendar = ctx.app.get(CalendarService);
      const report = await calendar.syncYear(1447);
      await calendar.syncYear(1448);

      const safer = report.months.find((m) => m.month === 2)!;
      expect(safer).toMatchObject({
        start: '2025-07-26',
        source: 'diyanet_tables',
        verified: false,
      });
      expect(safer.conflict).toMatch(/Aladhan says 2025-07-27/);
      expect(report.months.find((m) => m.month === 3)).toMatchObject({
        source: 'diyanet_tables',
        verified: true,
      });
      expect(report.months.find((m) => m.month === 7)).toMatchObject({
        source: 'aladhan_diyanet',
        verified: false,
      });

      const res = await ctx
        .http()
        .get('/v1/content/religious-days?from=2025-06-01&to=2027-04-01')
        .expect(200);
      const dates = Object.fromEntries(
        res.body.map((day: { key: string; hijriYear: number; date: string }) => [
          `${day.key}@${day.hijriYear}`,
          day.date,
        ]),
      );
      expect(dates).toMatchObject({
        'regaip-kandili@1447': '2025-12-25',
        'mirac-kandili@1447': '2026-01-15',
        'berat-kandili@1447': '2026-02-02',
        'kadir-gecesi@1447': '2026-03-16',
        'ramazan-bayrami-1@1447': '2026-03-20',
        'kurban-bayrami-1@1447': '2026-05-27',
        'mevlid-kandili@1447': '2025-09-03',
        'regaip-kandili@1448': '2026-12-10',
        'mirac-kandili@1448': '2027-01-04',
        'berat-kandili@1448': '2027-01-22',
        'ramazan-baslangici@1448': '2027-02-08',
        'kadir-gecesi@1448': '2027-03-05',
        'ramazan-bayrami-1@1448': '2027-03-09',
      });
      expect(
        res.body
          .filter((day: { key: string }) => day.key in { 'mirac-kandili': 1, 'berat-kandili': 1 })
          .every((day: { source: string }) => day.source === 'auto'),
      ).toBe(true);
    });

    it('keeps an admin override across re-syncs and can revert it', async () => {
      const calendar = ctx.app.get(CalendarService);
      await ctx
        .http()
        .post('/v1/admin/content/religious-days')
        .set(bearer(admin))
        .send([
          { key: 'berat-kandili', hijriYear: 1448, date: '2027-01-23', nameTr: 'Berat Kandili' },
        ])
        .expect(201);
      await calendar.syncYear(1448);

      const check = async () =>
        (
          await ctx
            .http()
            .get('/v1/content/religious-days?from=2027-01-01&to=2027-02-01')
            .expect(200)
        ).body.find((day: { key: string }) => day.key === 'berat-kandili');
      expect(await check()).toMatchObject({ date: '2027-01-23', source: 'manual' });

      await ctx
        .http()
        .delete('/v1/admin/content/religious-days/berat-kandili/1448/override')
        .set(bearer(admin))
        .expect(204);
      expect(await check()).toMatchObject({ date: '2027-01-22', source: 'auto' });
    });

    it('survives an Aladhan outage using what is already stored', async () => {
      ctx.fakes.aladhan.down = true;
      try {
        const report = await ctx.app.get(CalendarService).syncYear(1448);
        expect(report.months.find((m) => m.month === 7)?.start).toBe('2026-12-10');
        expect(report.generated).toBeGreaterThan(5);
      } finally {
        ctx.fakes.aladhan.down = false;
      }
    });

    it('shows calendar health to admins only', async () => {
      const status = await ctx
        .http()
        .get('/v1/admin/content/calendar-status')
        .set(bearer(admin))
        .expect(200);
      expect(status.body.conflicts.length).toBeGreaterThan(0);
      await ctx.http().get('/v1/admin/content/calendar-status').expect(401);
    });
  });

  describe('zakat prices', () => {
    const metals = () => ctx.app.get(MetalPricesService);

    beforeAll(async () => {
      // Other suites may have pinned a price in the shared database.
      await db.delete(zakatSettings);
      await db.delete(metalPriceHistory);
    });

    it('converts market spot prices at the official rate and publishes them', async () => {
      const result = await metals().refresh();
      expect(result.applied).toBe(true);
      const rates = await ctx.http().get('/v1/content/zakat-rates').expect(200);
      expect(rates.body).toMatchObject({
        source: 'auto',
        stale: false,
        usdTry: 42,
        goldGramPrice: 5401.33,
        silverGramPrice: 64.82,
        goldNisabGrams: 80.18,
        sources: ['TCMB', 'GoldAPI.io'],
      });
      expect(rates.body.nisabAmount).toBeCloseTo(5401.33 * 80.18, 1);
    });

    it('rejects a suspicious jump and keeps the last good price', async () => {
      ctx.fakes.goldApi.gold = 9000;
      try {
        const result = await metals().refresh();
        expect(result).toMatchObject({ applied: false, reason: 'rejected' });
        const admin = await ctx
          .http()
          .get('/v1/admin/content/zakat-rates')
          .set(bearer({ accessToken: adminToken() }))
          .expect(200);
        expect(admin.body.goldGramPrice).toBe(5401.33);
        expect(admin.body.lastError).toMatch(/goldGramPrice moved/);
        expect(admin.body.history).toHaveLength(1);
      } finally {
        ctx.fakes.goldApi.gold = 4000;
      }
    });

    it('a manual pin stops automatic updates until resumed', async () => {
      await ctx
        .http()
        .put('/v1/admin/content/zakat-rates')
        .set(bearer(admin))
        .send({ goldGramPrice: 5000 })
        .expect(200);
      expect(await metals().refresh()).toMatchObject({ applied: false, reason: 'manual' });
      const pinned = await ctx.http().get('/v1/content/zakat-rates').expect(200);
      expect(pinned.body).toMatchObject({ goldGramPrice: 5000, source: 'manual', stale: false });

      ctx.fakes.goldApi.gold = 4100;
      const resumed = await ctx
        .http()
        .post('/v1/admin/content/zakat-rates/auto')
        .set(bearer(admin))
        .expect(200);
      expect(resumed.body.applied).toBe(true);
      const live = await ctx.http().get('/v1/content/zakat-rates').expect(200);
      expect(live.body).toMatchObject({ source: 'auto', goldGramPrice: 5536.36 });
    });

    it('reports stale prices and a missing key', async () => {
      await db
        .update(zakatSettings)
        .set({ fetchedAt: new Date(Date.now() - 5 * 86_400_000) })
        .where(eq(zakatSettings.id, 1));
      expect((await ctx.http().get('/v1/content/zakat-rates').expect(200)).body.stale).toBe(true);

      ctx.fakes.goldApi.configured = false;
      try {
        expect(await metals().refresh()).toMatchObject({
          applied: false,
          reason: 'not_configured',
        });
      } finally {
        ctx.fakes.goldApi.configured = true;
      }
    });
  });

  function adminToken() {
    return admin.accessToken;
  }
});

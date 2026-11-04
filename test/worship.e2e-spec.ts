import { randomUUID } from 'node:crypto';
import { addDays, localDate } from '../src/prayer-times/time-utils.js';
import {
  anonymous,
  bearer,
  createTestApp,
  type Session,
  type TestContext,
  unique,
  verifiedUser,
} from './app.js';

describe('Worship, Qur’an, content and settings (e2e)', () => {
  let ctx: TestContext;
  const today = localDate(new Date(), 'UTC');

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx.close();
  });

  describe('prayer log and qada', () => {
    let user: Session;

    beforeAll(async () => {
      user = await anonymous(ctx);
    });

    it('marks, changes and clears prayers and reports the week', async () => {
      const yesterday = addDays(today, -1);
      await ctx
        .http()
        .put(`/v1/worship/prayers/${today}/sabah`)
        .set(bearer(user))
        .send({ status: 'prayed' })
        .expect(204);
      await ctx
        .http()
        .put(`/v1/worship/prayers/${today}/ogle`)
        .set(bearer(user))
        .send({ status: 'jamaah' })
        .expect(204);
      await ctx
        .http()
        .put(`/v1/worship/prayers/${today}/ikindi`)
        .set(bearer(user))
        .send({ status: 'qada' })
        .expect(204);
      await ctx
        .http()
        .put(`/v1/worship/prayers/${yesterday}/yatsi`)
        .set(bearer(user))
        .send({ status: 'prayed' })
        .expect(204);
      await ctx
        .http()
        .put(`/v1/worship/prayers/${yesterday}/yatsi`)
        .set(bearer(user))
        .send({ status: null })
        .expect(204);

      const week = await ctx
        .http()
        .get(`/v1/worship/prayers?from=${addDays(today, -6)}&to=${today}`)
        .set(bearer(user))
        .expect(200);
      expect(week.body.days).toHaveLength(7);
      expect(week.body.days.at(-1)).toEqual({
        date: today,
        sabah: 'prayed',
        ogle: 'jamaah',
        ikindi: 'qada',
        aksam: null,
        yatsi: null,
      });
      expect(week.body.days.at(-2).yatsi).toBeNull();
      expect(week.body.totals).toEqual({ done: 2, jamaah: 1, qada: 1 });
    });

    it('validates dates, vakits and ranges', async () => {
      await ctx
        .http()
        .put(`/v1/worship/prayers/${today}/teheccud`)
        .set(bearer(user))
        .send({ status: 'prayed' })
        .expect(404);
      await ctx
        .http()
        .put('/v1/worship/prayers/2026-02-30/sabah')
        .set(bearer(user))
        .send({ status: 'prayed' })
        .expect(400);
      await ctx
        .http()
        .put(`/v1/worship/prayers/${addDays(today, 5)}/sabah`)
        .set(bearer(user))
        .send({ status: 'prayed' })
        .expect(400);
      await ctx
        .http()
        .get(`/v1/worship/prayers?from=${addDays(today, -90)}&to=${today}`)
        .set(bearer(user))
        .expect(400);
      await ctx
        .http()
        .put(`/v1/worship/prayers/${today}/sabah`)
        .set(bearer(user))
        .send({ status: 'skipped' })
        .expect(400);
    });

    it('keeps prayer logs private per user', async () => {
      const other = await anonymous(ctx);
      const res = await ctx
        .http()
        .get(`/v1/worship/prayers?from=${today}&to=${today}`)
        .set(bearer(other))
        .expect(200);
      expect(res.body.totals).toEqual({ done: 0, jamaah: 0, qada: 0 });
    });

    it('estimates qada, applies it, and decrements atomically without going negative', async () => {
      const estimate = await ctx
        .http()
        .post('/v1/worship/qada/estimate')
        .set(bearer(user))
        .send({
          birthYear: 1992,
          pubertyAge: 15,
          regularSince: 2016,
          prayedPercent: 25,
          apply: true,
        })
        .expect(200);
      expect(estimate.body.estimate).toMatchObject({ perVakit: 2464, total: 14_784 });
      expect(estimate.body.counters).toMatchObject({ sabah: 2464, vitir: 2464, total: 14_784 });

      const after = await Promise.all(
        Array.from({ length: 5 }, () =>
          ctx
            .http()
            .post('/v1/worship/qada/sabah/adjust')
            .set(bearer(user))
            .send({ delta: -1 })
            .expect(200),
        ),
      );
      expect(after.length).toBe(5);
      const qada = await ctx.http().get('/v1/worship/qada').set(bearer(user)).expect(200);
      expect(qada.body.sabah).toBe(2459);

      await ctx
        .http()
        .put('/v1/worship/qada')
        .set(bearer(user))
        .send({ sabah: 0, ogle: 1, ikindi: 0, aksam: 0, yatsi: 0, vitir: 0 })
        .expect(200);
      const floor = await ctx
        .http()
        .post('/v1/worship/qada/sabah/adjust')
        .set(bearer(user))
        .send({ delta: -1 })
        .expect(200);
      expect(floor.body.sabah).toBe(0);
      await ctx
        .http()
        .post('/v1/worship/qada/sabah/adjust')
        .set(bearer(user))
        .send({ delta: -5 })
        .expect(400);
    });
  });

  describe('dhikr', () => {
    it('syncs counts idempotently and reports stats, top dhikr and streak', async () => {
      const user = await anonymous(ctx);
      const custom = await ctx
        .http()
        .post('/v1/worship/dhikrs')
        .set(bearer(user))
        .send({ arabic: 'حَسْبُنَا اللّٰهُ', transliteration: 'Hasbünallah', target: 100 })
        .expect(201);
      expect(custom.body.key).toBe(`custom:${custom.body.id}`);

      const batchId = randomUUID();
      const entries = [
        { date: today, dhikrKey: 'subhanallah', count: 33 },
        { date: today, dhikrKey: 'subhanallah', count: 33 },
        { date: today, dhikrKey: custom.body.key, count: 100 },
        { date: addDays(today, -1), dhikrKey: 'salavat', count: 10 },
      ];
      const first = await ctx
        .http()
        .post('/v1/worship/dhikr-sync')
        .set(bearer(user))
        .send({ batchId, entries })
        .expect(200);
      expect(first.body.applied).toBe(true);
      // Same batch again (lost response, retry): nothing is double-counted.
      const retry = await ctx
        .http()
        .post('/v1/worship/dhikr-sync')
        .set(bearer(user))
        .send({ batchId, entries })
        .expect(200);
      expect(retry.body.applied).toBe(false);

      const stats = await ctx
        .http()
        .get(`/v1/worship/dhikr-stats?range=week&today=${today}`)
        .set(bearer(user))
        .expect(200);
      expect(stats.body.days).toHaveLength(7);
      expect(stats.body.days.at(-1)).toEqual({ date: today, total: 166 });
      expect(stats.body.total).toBe(176);
      expect(stats.body.top[0]).toEqual({ key: custom.body.key, label: 'Hasbünallah', total: 100 });
      expect(stats.body.heatmap).toHaveLength(105);
      expect(stats.body.streakDays).toBe(2);

      const month = await ctx
        .http()
        .get(`/v1/worship/dhikr-stats?range=month&today=${today}`)
        .set(bearer(user))
        .expect(200);
      expect(month.body.days).toHaveLength(30);
    });

    it('rejects unknown keys and other users’ custom dhikr', async () => {
      const owner = await anonymous(ctx);
      const thief = await anonymous(ctx);
      const custom = await ctx
        .http()
        .post('/v1/worship/dhikrs')
        .set(bearer(owner))
        .send({ transliteration: 'Benim zikrim', target: 33 })
        .expect(201);
      await ctx
        .http()
        .post('/v1/worship/dhikr-sync')
        .set(bearer(thief))
        .send({
          batchId: randomUUID(),
          entries: [{ date: today, dhikrKey: custom.body.key, count: 1 }],
        })
        .expect(404);
      await ctx
        .http()
        .post('/v1/worship/dhikr-sync')
        .set(bearer(owner))
        .send({
          batchId: randomUUID(),
          entries: [{ date: today, dhikrKey: 'bilinmeyen', count: 1 }],
        })
        .expect(400);
      await ctx
        .http()
        .delete(`/v1/worship/dhikrs/${custom.body.id}`)
        .set(bearer(thief))
        .expect(404);
      await ctx
        .http()
        .delete(`/v1/worship/dhikrs/${custom.body.id}`)
        .set(bearer(owner))
        .expect(204);
    });

    it('lists built-in and custom dhikr', async () => {
      const user = await anonymous(ctx);
      const res = await ctx.http().get('/v1/worship/dhikrs').set(bearer(user)).expect(200);
      expect(res.body.builtin.map((d: { key: string }) => d.key)).toEqual([
        'subhanallah',
        'elhamdulillah',
        'allahuekber',
        'tevhid',
        'estagfirullah',
        'salavat',
      ]);
      expect(res.body.custom).toEqual([]);
    });
  });

  describe('summary and Qur’an', () => {
    it('reads pages, wraps khatms and feeds the İbadet summary', async () => {
      const user = await anonymous(ctx);
      await ctx
        .http()
        .put('/v1/quran/progress')
        .set(bearer(user))
        .send({ juz: 11, page: 18, targetDate: addDays(today, 9) })
        .expect(200);
      const read = await ctx
        .http()
        .post('/v1/quran/progress/read')
        .set(bearer(user))
        .send({ pages: 4, date: today })
        .expect(200);
      expect(read.body).toMatchObject({ juz: 12, page: 2, currentJuz: 13, khatmCompleted: false });

      const progress = await ctx
        .http()
        .get(`/v1/quran/progress?today=${today}`)
        .set(bearer(user))
        .expect(200);
      expect(progress.body.pagesLeft).toBe(600 - 242);
      expect(progress.body.pagesPerDay).toBe(Math.ceil(358 / 10));

      await ctx
        .http()
        .put(`/v1/worship/prayers/${today}/sabah`)
        .set(bearer(user))
        .send({ status: 'prayed' })
        .expect(204);
      const summary = await ctx
        .http()
        .get(`/v1/worship/summary?date=${today}`)
        .set(bearer(user))
        .expect(200);
      expect(summary.body).toMatchObject({
        prayers: { done: 1, total: 5 },
        dhikrToday: 0,
        quran: { currentJuz: 13, percent: 40 },
        streakDays: 1,
      });

      await ctx
        .http()
        .put('/v1/quran/progress')
        .set(bearer(user))
        .send({ juz: 29, page: 19 })
        .expect(200);
      const wrap = await ctx
        .http()
        .post('/v1/quran/progress/read')
        .set(bearer(user))
        .send({ pages: 1, date: today })
        .expect(200);
      expect(wrap.body).toMatchObject({
        juz: 0,
        page: 0,
        completedKhatms: 1,
        khatmCompleted: true,
      });
    });
  });

  describe('group khatm', () => {
    it('creates, invites, and resolves a race for the same juz', async () => {
      const owner = await verifiedUser(ctx, unique('Ahmet D'));
      const a = await verifiedUser(ctx, unique('Merve K'));
      const b = await verifiedUser(ctx, unique('Zeynep'));

      const anon = await anonymous(ctx);
      await ctx
        .http()
        .post('/v1/quran/hatims')
        .set(bearer(anon))
        .send({ name: 'Olmaz' })
        .expect(403);

      const created = await ctx
        .http()
        .post('/v1/quran/hatims')
        .set(bearer(owner))
        .send({ name: 'Ailecek hatim' })
        .expect(201);
      expect(created.body.juz).toHaveLength(30);
      expect(created.body.counts).toEqual({ open: 30, taken: 0, read: 0 });
      const { id, inviteCode } = created.body;

      // Not a member yet → looks like it does not exist.
      await ctx.http().get(`/v1/quran/hatims/${id}`).set(bearer(a)).expect(404);
      await ctx
        .http()
        .post('/v1/quran/hatims/join')
        .set(bearer(a))
        .send({ code: inviteCode.toLowerCase() })
        .expect(200);
      await ctx
        .http()
        .post('/v1/quran/hatims/join')
        .set(bearer(a))
        .send({ code: inviteCode })
        .expect(200);
      await ctx
        .http()
        .post('/v1/quran/hatims/join')
        .set(bearer(b))
        .send({ code: inviteCode })
        .expect(200);

      const race = await Promise.all([
        ctx.http().post(`/v1/quran/hatims/${id}/juz/7/take`).set(bearer(a)),
        ctx.http().post(`/v1/quran/hatims/${id}/juz/7/take`).set(bearer(b)),
      ]);
      expect(race.map((r) => r.status).sort()).toEqual([200, 409]);

      const detail = await ctx.http().get(`/v1/quran/hatims/${id}`).set(bearer(owner)).expect(200);
      expect(detail.body.members).toHaveLength(3);
      const seven = detail.body.juz.find((j: { juz: number }) => j.juz === 7);
      expect(seven.status).toBe('taken');
      expect(seven.holder.initials).toMatch(/^[A-ZÇĞİÖŞÜ]{1,2}$/);
    });

    it('enforces who may mark read or release, and completes a round', async () => {
      const owner = await verifiedUser(ctx, unique('Sahip'));
      const member = await verifiedUser(ctx, unique('Uye'));
      const created = await ctx
        .http()
        .post('/v1/quran/hatims')
        .set(bearer(owner))
        .send({ name: 'Kadir gecesi' })
        .expect(201);
      const { id, inviteCode } = created.body;
      await ctx
        .http()
        .post('/v1/quran/hatims/join')
        .set(bearer(member))
        .send({ code: inviteCode })
        .expect(200);

      const took = await ctx
        .http()
        .post(`/v1/quran/hatims/${id}/take-next`)
        .set(bearer(member))
        .expect(200);
      expect(took.body.juz[0].holder.isMe).toBe(true);
      await ctx.http().post(`/v1/quran/hatims/${id}/juz/2/read`).set(bearer(member)).expect(409);
      await ctx.http().post(`/v1/quran/hatims/${id}/juz/1/release`).set(bearer(member)).expect(200);
      await ctx.http().post(`/v1/quran/hatims/${id}/juz/1/take`).set(bearer(member)).expect(200);
      await ctx.http().post(`/v1/quran/hatims/${id}/juz/1/read`).set(bearer(member)).expect(200);

      await ctx.http().post(`/v1/quran/hatims/${id}/new-round`).set(bearer(owner)).expect(400);
      await ctx.http().post(`/v1/quran/hatims/${id}/new-round`).set(bearer(member)).expect(403);

      // Owner takes and reads the remaining 29 (5 at a time, the holding limit).
      for (let juz = 2; juz <= 30; juz += 1) {
        await ctx
          .http()
          .post(`/v1/quran/hatims/${id}/juz/${juz}/take`)
          .set(bearer(owner))
          .expect(200);
        await ctx
          .http()
          .post(`/v1/quran/hatims/${id}/juz/${juz}/read`)
          .set(bearer(owner))
          .expect(200);
      }
      const done = await ctx.http().get(`/v1/quran/hatims/${id}`).set(bearer(owner)).expect(200);
      expect(done.body).toMatchObject({
        completedRounds: 1,
        counts: { open: 0, taken: 0, read: 30 },
      });
      const next = await ctx
        .http()
        .post(`/v1/quran/hatims/${id}/new-round`)
        .set(bearer(owner))
        .expect(200);
      expect(next.body).toMatchObject({ round: 2, counts: { open: 30, taken: 0, read: 0 } });
    });

    it('rotates invites, transfers ownership when the owner leaves, and deletes when empty', async () => {
      const owner = await verifiedUser(ctx);
      const member = await verifiedUser(ctx);
      const created = await ctx
        .http()
        .post('/v1/quran/hatims')
        .set(bearer(owner))
        .send({ name: 'Devir' })
        .expect(201);
      const { id, inviteCode } = created.body;
      await ctx
        .http()
        .post('/v1/quran/hatims/join')
        .set(bearer(member))
        .send({ code: inviteCode })
        .expect(200);

      const rotated = await ctx
        .http()
        .post(`/v1/quran/hatims/${id}/invite/rotate`)
        .set(bearer(owner))
        .expect(200);
      expect(rotated.body.inviteCode).not.toBe(inviteCode);
      const late = await verifiedUser(ctx);
      await ctx
        .http()
        .post('/v1/quran/hatims/join')
        .set(bearer(late))
        .send({ code: inviteCode })
        .expect(404);

      await ctx.http().post(`/v1/quran/hatims/${id}/juz/3/take`).set(bearer(owner)).expect(200);
      await ctx.http().delete(`/v1/quran/hatims/${id}/members/me`).set(bearer(owner)).expect(204);
      const view = await ctx.http().get(`/v1/quran/hatims/${id}`).set(bearer(member)).expect(200);
      expect(view.body.isOwner).toBe(true);
      expect(view.body.juz[2].status).toBe('open');

      await ctx.http().delete(`/v1/quran/hatims/${id}/members/me`).set(bearer(member)).expect(204);
      await ctx.http().get(`/v1/quran/hatims/${id}`).set(bearer(member)).expect(404);
    });
  });

  describe('content and settings', () => {
    it('serves duas, esma and the holy-day list', async () => {
      const duas = await ctx.http().get('/v1/content/duas').expect(200);
      expect(duas.body.categories).toHaveLength(8);
      expect(duas.body.duas.length).toBeGreaterThan(5);
      expect(duas.headers.etag).toBeDefined();
      const cached = await ctx
        .http()
        .get('/v1/content/duas')
        .set('If-None-Match', duas.headers.etag)
        .expect(304);
      expect(cached.text).toBe('');

      const esma = await ctx.http().get('/v1/content/esma').expect(200);
      expect(esma.body).toHaveLength(99);
      expect(esma.body[1]).toMatchObject({ no: 2, transliteration: 'er-Rahmân' });

      const days = await ctx.http().get('/v1/content/religious-days').expect(200);
      expect(Array.isArray(days.body)).toBe(true);
    });

    it('lets admins import holy days and set zakat prices; others get 403', async () => {
      const admin = await ctx
        .http()
        .post('/v1/auth/google')
        .send({ idToken: `${unique('content-')}|admin@example.com` })
        .expect(201);
      const adminAuth = bearer({ accessToken: admin.body.tokens.accessToken });
      const user = await verifiedUser(ctx);

      const day = {
        date: addDays(today, 30),
        key: 'test-kandili',
        hijriYear: 1448,
        nameTr: 'Test Kandili',
      };
      await ctx
        .http()
        .post('/v1/admin/content/religious-days')
        .set(bearer(user))
        .send([day])
        .expect(403);
      await ctx
        .http()
        .post('/v1/admin/content/religious-days')
        .set(adminAuth)
        .send([day, day])
        .expect(201);
      await ctx
        .http()
        .post('/v1/admin/content/religious-days')
        .set(adminAuth)
        .send([{ date: 'x' }])
        .expect(400);
      const days = await ctx.http().get('/v1/content/religious-days').expect(200);
      expect(days.body).toContainEqual(
        expect.objectContaining({ key: 'test-kandili', nameTr: 'Test Kandili', source: 'manual' }),
      );

      const rates = await ctx
        .http()
        .put('/v1/admin/content/zakat-rates')
        .set(adminAuth)
        .send({ goldGramPrice: 3000 })
        .expect(200);
      expect(rates.body).toMatchObject({
        goldGramPrice: 3000,
        goldNisabGrams: 80.18,
        nisabAmount: 240_540,
      });
    });

    it('syncs settings with defaults, strict validation and optimistic concurrency', async () => {
      const user = await anonymous(ctx);
      const empty = await ctx.http().get('/v1/me/settings').set(bearer(user)).expect(200);
      expect(empty.body.version).toBe(0);
      expect(empty.body.data.theme).toBe('system');
      expect(empty.body.data.prayerNotifications.gunes.enabled).toBe(false);

      const data = {
        ...empty.body.data,
        theme: 'dark',
        favorites: { duas: ['yemek-once'], esma: [2] },
      };
      const saved = await ctx
        .http()
        .put('/v1/me/settings')
        .set(bearer(user))
        .send({ version: 0, data })
        .expect(200);
      expect(saved.body.version).toBe(1);

      // A second device still on version 0 is told about the conflict.
      const stale = await ctx
        .http()
        .put('/v1/me/settings')
        .set(bearer(user))
        .send({ version: 0, data: { ...data, theme: 'light' } })
        .expect(409);
      expect(stale.body.error.details.current.data.theme).toBe('dark');

      const bad = await ctx
        .http()
        .put('/v1/me/settings')
        .set(bearer(user))
        .send({ version: 1, data: { ...data, isAdmin: true } })
        .expect(400);
      expect(bad.body.error.code).toBe('VALIDATION_FAILED');

      const partial = await ctx
        .http()
        .put('/v1/me/settings')
        .set(bearer(user))
        .send({ version: 1, data: { language: 'ar' } })
        .expect(200);
      expect(partial.body.data).toMatchObject({ language: 'ar', theme: 'system' });
    });
  });

  it('account deletion removes worship data too', async () => {
    const user = await verifiedUser(ctx);
    await ctx
      .http()
      .put(`/v1/worship/prayers/${today}/sabah`)
      .set(bearer(user))
      .send({ status: 'prayed' })
      .expect(204);
    await ctx
      .http()
      .post('/v1/quran/hatims')
      .set(bearer(user))
      .send({ name: 'Silinecek' })
      .expect(201);
    await ctx.http().delete('/v1/me').set(bearer(user)).expect(204);
    await ctx
      .http()
      .get('/v1/worship/summary?date=' + today)
      .set(bearer(user))
      .expect(401);
  });
});

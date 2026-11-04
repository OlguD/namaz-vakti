import { getQueueToken } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { LiveService } from '../src/live/live.service.js';
import { QUEUES } from '../src/jobs/queues.js';
import { NotificationsService } from '../src/notifications/notifications.service.js';
import { anonymous, bearer, createTestApp, type TestContext, unique, verifiedUser } from './app.js';

describe('Mosques, live streams and push (e2e)', () => {
  let ctx: TestContext;
  let admin: { accessToken: string };

  beforeAll(async () => {
    ctx = await createTestApp();
    const res = await ctx
      .http()
      .post('/v1/auth/google')
      .send({ idToken: `${unique('content-admin-')}|admin@example.com` })
      .expect(201);
    admin = { accessToken: res.body.tokens.accessToken };
  });

  afterAll(async () => {
    await ctx.close();
  });

  describe('mosques', () => {
    it('imports the area on first request and returns mosques nearest first', async () => {
      const res = await ctx
        .http()
        .get('/v1/mosques/nearby?lat=41.0082&lng=28.9784&radius=3000')
        .expect(200);
      expect(res.body.partial).toBe(false);
      expect(res.body.attribution).toContain('OpenStreetMap');
      expect(res.body.mosques.map((m: { name: string }) => m.name)).toEqual([
        'Ayasofya Camii',
        'Sultan Ahmet Camii',
        'Süleymaniye Camii',
      ]);
      expect(res.body.mosques[0].distanceM).toBeLessThan(300);

      const calls = ctx.fakes.overpass.calls;
      await ctx.http().get('/v1/mosques/nearby?lat=41.0082&lng=28.9784&radius=500').expect(200);
      expect(ctx.fakes.overpass.calls).toBe(calls);
    });

    it('respects the radius and validates input', async () => {
      const res = await ctx
        .http()
        .get('/v1/mosques/nearby?lat=41.0082&lng=28.9784&radius=500')
        .expect(200);
      expect(res.body.mosques.map((m: { name: string }) => m.name)).toEqual([
        'Ayasofya Camii',
        'Sultan Ahmet Camii',
      ]);
      await ctx.http().get('/v1/mosques/nearby?lat=41&lng=28&radius=50000').expect(400);
    });

    it('hides mosques that disappear from OSM on re-import', async () => {
      const near = await ctx
        .http()
        .get('/v1/mosques/nearby?lat=41.0082&lng=28.9784&radius=3000')
        .expect(200);
      const ayasofya = near.body.mosques.find((m: { name: string }) => m.name === 'Ayasofya Camii');
      ctx.fakes.overpass.mosques = ctx.fakes.overpass.mosques.filter(
        (m) => m.name !== 'Ayasofya Camii',
      );
      const { MosquesService } = await import('../src/mosques/mosques.service.js');
      const { tileIdFor } = await import('../src/mosques/tiles.js');
      await ctx.app.get(MosquesService).importTile(tileIdFor(41.0086, 28.98));
      await ctx.http().get(`/v1/mosques/${ayasofya.id}`).expect(404);
    });

    it('accepts suggestions from registered users and applies them on review', async () => {
      const anon = await anonymous(ctx);
      await ctx
        .http()
        .post('/v1/mosques/suggestions')
        .set(bearer(anon))
        .send({ kind: 'add', name: 'Mahalle Mescidi', lat: 41.01, lng: 28.97 })
        .expect(403);

      const user = await verifiedUser(ctx);
      const suggestion = await ctx
        .http()
        .post('/v1/mosques/suggestions')
        .set(bearer(user))
        .send({ kind: 'add', name: 'Mahalle Mescidi', lat: 41.01, lng: 28.97 })
        .expect(201);
      const queue = await ctx
        .http()
        .get('/v1/admin/mosques/suggestions')
        .set(bearer(admin))
        .expect(200);
      expect(queue.body.map((s: { id: string }) => s.id)).toContain(suggestion.body.id);

      await ctx
        .http()
        .post(`/v1/admin/mosques/suggestions/${suggestion.body.id}/review`)
        .set(bearer(admin))
        .send({ accept: true })
        .expect(204);
      const near = await ctx
        .http()
        .get('/v1/mosques/nearby?lat=41.01&lng=28.97&radius=200')
        .expect(200);
      expect(near.body.mosques).toEqual([
        expect.objectContaining({ name: 'Mahalle Mescidi', source: 'user' }),
      ]);
    });
  });

  describe('live streams', () => {
    it('admin adds a channel; polling finds live and upcoming streams; ended ones are not re-checked', async () => {
      const channel = await ctx
        .http()
        .post('/v1/admin/live/channels')
        .set(bearer(admin))
        .send({
          channel: 'UCfakechannelid00000000',
          category: 'haramain',
          notifyOnLive: true,
          priority: 10,
        })
        .expect(201);
      expect(channel.body).toMatchObject({ title: 'Test Kanal', category: 'haramain' });

      const base = {
        thumbnailUrl: null,
        scheduledStartAt: null,
        actualEndAt: null,
        concurrentViewers: null,
      };
      ctx.fakes.youtube.feed.UCfakechannelid00000000 = [
        'LIVE0000001',
        'SOON0000001',
        'OLD00000001',
      ];
      ctx.fakes.youtube.statuses = {
        LIVE0000001: {
          ...base,
          videoId: 'LIVE0000001',
          title: 'Kâbe Canlı',
          status: 'live',
          actualStartAt: new Date(),
          concurrentViewers: 900,
        },
        SOON0000001: {
          ...base,
          videoId: 'SOON0000001',
          title: 'Cuma Hutbesi',
          status: 'upcoming',
          actualStartAt: null,
          scheduledStartAt: new Date(Date.now() + 3_600_000),
        },
        OLD00000001: {
          ...base,
          videoId: 'OLD00000001',
          title: 'Eski yayın',
          status: 'ended',
          actualStartAt: new Date(),
          actualEndAt: new Date(),
        },
      };

      const result = await ctx.app.get(LiveService).poll();
      expect(result).toEqual({ checked: 3, live: 1 });

      const streams = await ctx.http().get('/v1/live/streams').expect(200);
      expect(streams.body.map((s: { videoId: string }) => s.videoId)).toEqual([
        'LIVE0000001',
        'SOON0000001',
      ]);
      expect(streams.body[0]).toMatchObject({
        status: 'live',
        embedUrl: 'https://www.youtube.com/embed/LIVE0000001',
        channel: { category: 'haramain' },
      });
      const onlyLive = await ctx
        .http()
        .get('/v1/live/streams?status=live&category=haramain')
        .expect(200);
      expect(onlyLive.body).toHaveLength(1);

      // The newly live stream from a notify-enabled channel queued a broadcast exactly once.
      const queue = ctx.app.get<Queue>(getQueueToken(QUEUES.notifications));
      const job = await queue.getJob('live-notify-LIVE0000001');
      expect(job?.data).toMatchObject({ audience: 'live_subscribers', body: 'Kâbe Canlı' });

      // Second round: the ended video is settled and skipped.
      ctx.fakes.youtube.statuses.SOON0000001!.status = 'live';
      const second = await ctx.app.get(LiveService).poll();
      expect(second.checked).toBe(2);
      const live = await ctx.http().get('/v1/live/streams?status=live').expect(200);
      expect(live.body).toHaveLength(2);
    });

    it('is admin-only to manage channels', async () => {
      const user = await verifiedUser(ctx);
      await ctx
        .http()
        .post('/v1/admin/live/channels')
        .set(bearer(user))
        .send({ channel: '@x' })
        .expect(403);
    });
  });

  describe('devices and push', () => {
    it('registers devices, fans out a broadcast and forgets uninstalled devices', async () => {
      const a = await anonymous(ctx);
      const b = await anonymous(ctx);
      await ctx
        .http()
        .put('/v1/me/devices/install-a-123456')
        .set(bearer(a))
        .send({
          platform: 'ios',
          pushToken: 'ExponentPushToken[aaaaaaaaaaaaaaaaaaaaaa]',
          locale: 'tr',
          liveAlerts: true,
        })
        .expect(200);
      await ctx
        .http()
        .put('/v1/me/devices/install-b-123456')
        .set(bearer(b))
        .send({
          platform: 'android',
          pushToken: 'ExponentPushToken[deadbbbbbbbbbbbbbbbbbb]',
          locale: 'tr',
          liveAlerts: false,
        })
        .expect(200);
      await ctx
        .http()
        .put('/v1/me/devices/install-c-123456')
        .set(bearer(b))
        .send({ platform: 'android', pushToken: 'not-a-token' })
        .expect(400);

      const notifications = ctx.app.get(NotificationsService);
      const queue = ctx.app.get<Queue>(getQueueToken(QUEUES.notifications));
      await queue.drain();

      expect(
        await notifications.fanOut({
          title: 'Duyuru',
          body: 'Merhaba',
          audience: 'all',
          locale: 'tr',
        }),
      ).toBe(2);
      expect(
        await notifications.fanOut({
          title: 'Canlı',
          body: 'x',
          audience: 'live_subscribers',
          locale: 'tr',
        }),
      ).toBe(1);

      const batches = await queue.getJobs(['waiting']);
      for (const job of batches.filter((j) => j.name === 'send-push-batch')) {
        await notifications.sendBatch(job.data);
      }
      expect(ctx.fakes.expo.sent.map((m) => m.title).sort()).toEqual(['Canlı', 'Duyuru', 'Duyuru']);
      // The dead token was cleared, so the next broadcast only reaches one device.
      expect(
        await notifications.fanOut({ title: 'Tekrar', body: 'x', audience: 'all', locale: 'tr' }),
      ).toBe(1);
    });

    it('only admins can broadcast', async () => {
      const user = await verifiedUser(ctx);
      await ctx
        .http()
        .post('/v1/admin/notifications/broadcast')
        .set(bearer(user))
        .send({ title: 'x', body: 'y' })
        .expect(403);
      const ok = await ctx
        .http()
        .post('/v1/admin/notifications/broadcast')
        .set(bearer(admin))
        .send({ title: 'Ramazan', body: 'Hayırlı Ramazanlar' })
        .expect(202);
      expect(ok.body.queued).toBe(true);
    });
  });
});

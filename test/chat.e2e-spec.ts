import { eq } from 'drizzle-orm';
import { io, type Socket } from 'socket.io-client';
import { DB, type Database } from '../src/db/database.module.js';
import { chatRooms, users } from '../src/db/schema/index.js';
import {
  anonymous,
  bearer,
  createTestApp,
  type Session,
  type TestContext,
  unique,
  verifiedUser,
} from './app.js';

type Ack<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string; details?: Record<string, unknown> } };

describe('Chat (e2e)', () => {
  let ctx: TestContext;
  let db: Database;
  const sockets: Socket[] = [];

  const connect = (session: Session) =>
    new Promise<Socket>((resolve, reject) => {
      const socket = io(`${ctx.url}/chat`, {
        auth: { token: session.accessToken },
        transports: ['websocket'],
        forceNew: true,
      });
      sockets.push(socket);
      socket.once('connect', () => resolve(socket));
      socket.once('connect_error', reject);
    });

  const emit = <T>(socket: Socket, event: string, payload: unknown) =>
    socket.timeout(5_000).emitWithAck(event, payload) as Promise<Ack<T>>;

  const nextEvent = <T>(socket: Socket, event: string) =>
    new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`no ${event}`)), 3_000);
      socket.once(event, (payload: T) => {
        clearTimeout(timer);
        resolve(payload);
      });
    });

  beforeAll(async () => {
    ctx = await createTestApp();
    db = ctx.app.get<Database>(DB);
    // A dedicated room without slow mode keeps the tests fast and isolated.
    await db
      .insert(chatRooms)
      .values({ id: 'test', name: 'Test', slowModeSeconds: 0 })
      .onConflictDoNothing();
    await db
      .insert(chatRooms)
      .values({ id: 'slow', name: 'Slow', slowModeSeconds: 30 })
      .onConflictDoNothing();
  });

  afterAll(async () => {
    sockets.forEach((socket) => socket.disconnect());
    await ctx.close();
  });

  it('refuses socket connections without a valid token', async () => {
    await expect(connect({ accessToken: 'bad', refreshToken: '', userId: '' })).rejects.toThrow(
      'UNAUTHENTICATED',
    );
  });

  it('delivers messages to everyone in the room and stores history', async () => {
    const alice = await verifiedUser(ctx, unique('Alice'));
    const bob = await verifiedUser(ctx, unique('Bob'));
    const a = await connect(alice);
    const b = await connect(bob);
    expect((await emit(a, 'room:join', { roomId: 'test' })).ok).toBe(true);
    expect((await emit(b, 'room:join', { roomId: 'test' })).ok).toBe(true);

    const received = nextEvent<{ body: string; author: { id: string } }>(b, 'message:new');
    const ack = await emit<{ id: string; body: string }>(a, 'message:send', {
      roomId: 'test',
      body: '  Selamün   aleyküm  ',
      clientMessageId: 'c1',
    });
    expect(ack).toMatchObject({ ok: true, data: { body: 'Selamün aleyküm' } });
    expect(await received).toMatchObject({ body: 'Selamün aleyküm', author: { id: alice.userId } });

    // Same clientMessageId → same message, not a duplicate.
    const retry = await emit<{ id: string }>(a, 'message:send', {
      roomId: 'test',
      body: 'Selamün aleyküm',
      clientMessageId: 'c1',
    });
    expect(retry.ok && ack.ok && retry.data.id === ack.data.id).toBe(true);

    const history = await ctx.http().get('/v1/chat/rooms/test/messages').expect(200);
    expect(history.body.filter((m: { body: string }) => m.body === 'Selamün aleyküm')).toHaveLength(
      1,
    );
  });

  it('lets anonymous users read but not write', async () => {
    const anon = await anonymous(ctx);
    const socket = await connect(anon);
    const join = await emit<unknown[]>(socket, 'room:join', { roomId: 'test' });
    expect(join.ok).toBe(true);
    const send = await emit(socket, 'message:send', { roomId: 'test', body: 'merhaba' });
    expect(send).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } });
  });

  it('rejects profanity, links and repeats, and enforces slow mode', async () => {
    const user = await verifiedUser(ctx);
    const socket = await connect(user);
    const bad = await emit(socket, 'message:send', { roomId: 'test', body: 's1kt1r git' });
    expect(bad).toMatchObject({
      ok: false,
      error: { code: 'MESSAGE_REJECTED', details: { reason: 'profanity' } },
    });
    const link = await emit(socket, 'message:send', {
      roomId: 'test',
      body: 'bedava www.spam.example.com',
    });
    expect(link).toMatchObject({
      ok: false,
      error: { code: 'MESSAGE_REJECTED', details: { reason: 'link' } },
    });
    expect(
      (await emit(socket, 'message:send', { roomId: 'test', body: 'Hayırlı cumalar' })).ok,
    ).toBe(true);
    const repeat = await emit(socket, 'message:send', { roomId: 'test', body: 'hayırlı  cumalar' });
    expect(repeat).toMatchObject({ ok: false, error: { details: { reason: 'duplicate' } } });

    expect((await emit(socket, 'message:send', { roomId: 'slow', body: 'ilk' })).ok).toBe(true);
    const slow = await emit(socket, 'message:send', { roomId: 'slow', body: 'ikinci' });
    expect(slow).toMatchObject({ ok: false, error: { code: 'SLOW_MODE' } });
    expect(
      (slow as unknown as { error: { details: { retryAfterSeconds: number } } }).error.details
        .retryAfterSeconds,
    ).toBeGreaterThan(0);
  });

  it('requires a display name and respects mutes', async () => {
    const user = await verifiedUser(ctx);
    await db.update(users).set({ displayName: null }).where(eq(users.id, user.userId));
    const noName = await ctx
      .http()
      .post('/v1/chat/rooms/test/messages')
      .set(bearer(user))
      .send({ body: 'selam' })
      .expect(400);
    expect(noName.body.error.code).toBe('DISPLAY_NAME_REQUIRED');

    await db
      .update(users)
      .set({ displayName: unique('Sessiz'), chatMutedUntil: new Date(Date.now() + 3_600_000) })
      .where(eq(users.id, user.userId));
    const muted = await ctx
      .http()
      .post('/v1/chat/rooms/test/messages')
      .set(bearer(user))
      .send({ body: 'selam' })
      .expect(403);
    expect(muted.body.error.code).toBe('CHAT_MUTED');
  });

  it('hides a message after three reports and removes it from open clients', async () => {
    const author = await verifiedUser(ctx);
    const listener = await connect(await verifiedUser(ctx));
    await emit(listener, 'room:join', { roomId: 'test' });
    const sent = await ctx
      .http()
      .post('/v1/chat/rooms/test/messages')
      .set(bearer(author))
      .send({ body: 'şüpheli içerik' })
      .expect(201);

    const removed = nextEvent<{ id: string; reason: string }>(listener, 'message:removed');
    for (let i = 0; i < 3; i += 1) {
      const reporter = await anonymous(ctx);
      await ctx
        .http()
        .post(`/v1/chat/messages/${sent.body.id}/report`)
        .set(bearer(reporter))
        .send({ reason: 'spam' })
        .expect(204);
    }
    expect(await removed).toMatchObject({ id: sent.body.id, reason: 'hidden' });
    const history = await ctx.http().get('/v1/chat/rooms/test/messages?limit=100').expect(200);
    expect(history.body.map((m: { id: string }) => m.id)).not.toContain(sent.body.id);
  });

  it('hides blocked users from the blocker’s history', async () => {
    const annoying = await verifiedUser(ctx);
    const me = await verifiedUser(ctx);
    const message = await ctx
      .http()
      .post('/v1/chat/rooms/test/messages')
      .set(bearer(annoying))
      .send({ body: 'beni gör' })
      .expect(201);
    await ctx.http().put(`/v1/me/blocks/${annoying.userId}`).set(bearer(me)).expect(204);

    const mine = await ctx
      .http()
      .get('/v1/chat/rooms/test/messages?limit=100')
      .set(bearer(me))
      .expect(200);
    expect(mine.body.map((m: { id: string }) => m.id)).not.toContain(message.body.id);
    const blocks = await ctx.http().get('/v1/me/blocks').set(bearer(me)).expect(200);
    expect(blocks.body[0].id).toBe(annoying.userId);

    await ctx.http().delete(`/v1/me/blocks/${annoying.userId}`).set(bearer(me)).expect(204);
    const again = await ctx
      .http()
      .get('/v1/chat/rooms/test/messages?limit=100')
      .set(bearer(me))
      .expect(200);
    expect(again.body.map((m: { id: string }) => m.id)).toContain(message.body.id);
  });

  it('lets authors delete their own messages but not others’', async () => {
    const author = await verifiedUser(ctx);
    const other = await verifiedUser(ctx);
    const sent = await ctx
      .http()
      .post('/v1/chat/rooms/test/messages')
      .set(bearer(author))
      .send({ body: 'silinecek' })
      .expect(201);
    await ctx.http().delete(`/v1/chat/messages/${sent.body.id}`).set(bearer(other)).expect(403);
    await ctx.http().delete(`/v1/chat/messages/${sent.body.id}`).set(bearer(author)).expect(204);
    await ctx.http().delete(`/v1/chat/messages/${sent.body.id}`).set(bearer(author)).expect(404);
  });

  it('lets a moderator ban from the report queue, which signs the user out', async () => {
    const admin = await ctx
      .http()
      .post('/v1/auth/google')
      .send({ idToken: `${unique('mod-')}|admin@example.com` })
      .expect(201);
    const adminSession = { accessToken: admin.body.tokens.accessToken };
    const offender = await verifiedUser(ctx);
    const sent = await ctx
      .http()
      .post('/v1/chat/rooms/test/messages')
      .set(bearer(offender))
      .send({ body: 'kural dışı' })
      .expect(201);
    const reporter = await anonymous(ctx);
    await ctx
      .http()
      .post(`/v1/chat/messages/${sent.body.id}/report`)
      .set(bearer(reporter))
      .send({ reason: 'harassment' })
      .expect(204);

    await ctx.http().get('/v1/admin/reports').set(bearer(offender)).expect(403);
    const queue = await ctx.http().get('/v1/admin/reports').set(bearer(adminSession)).expect(200);
    expect(queue.body.map((r: { messageId: string }) => r.messageId)).toContain(sent.body.id);

    await ctx
      .http()
      .post(`/v1/admin/reports/messages/${sent.body.id}/resolve`)
      .set(bearer(adminSession))
      .send({ action: 'remove_and_ban', durationHours: 48 })
      .expect(204);
    const refresh = await ctx
      .http()
      .post('/v1/auth/refresh')
      .send({ refreshToken: offender.refreshToken })
      .expect(401);
    expect(refresh.body.error.code).toBe('INVALID_TOKEN');
    const login = await ctx
      .http()
      .post('/v1/auth/email/login')
      .send({ email: offender.email, password: 'correct horse battery' })
      .expect(403);
    expect(login.body.error.code).toBe('ACCOUNT_BANNED');
  });
});

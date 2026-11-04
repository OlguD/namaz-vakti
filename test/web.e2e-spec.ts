import { io } from 'socket.io-client';
import { createTestApp, type TestContext, unique } from './app.js';

const ORIGIN = 'https://app.example.com';
const web = { 'X-Client-Platform': 'web', Origin: ORIGIN };

function refreshCookie(setCookie: string[] | string | undefined): string | undefined {
  const list = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
  return list.find((cookie) => cookie.startsWith('nv_rt='));
}

describe('Web clients (e2e)', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx.close();
  });

  it('keeps the refresh token out of the body and in an httpOnly cookie', async () => {
    const res = await ctx.http().post('/v1/auth/anonymous').set(web).send({}).expect(201);
    expect(res.body.tokens.accessToken).toEqual(expect.any(String));
    expect(res.body.tokens.refreshToken).toBeNull();

    const cookie = refreshCookie(res.headers['set-cookie']);
    expect(cookie).toBeDefined();
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/Secure/i);
    expect(cookie).toMatch(/SameSite=Strict/i);
    expect(cookie).toMatch(/Path=\/v1\/auth/);
  });

  it('refreshes from the cookie and rotates it', async () => {
    const login = await ctx.http().post('/v1/auth/anonymous').set(web).send({}).expect(201);
    const first = refreshCookie(login.headers['set-cookie'])!.split(';')[0]!;

    const refreshed = await ctx
      .http()
      .post('/v1/auth/refresh')
      .set(web)
      .set('Cookie', first)
      .send({})
      .expect(200);
    expect(refreshed.body.refreshToken).toBeNull();
    const second = refreshCookie(refreshed.headers['set-cookie'])!.split(';')[0]!;
    expect(second).not.toBe(first);

    // Replaying the old cookie is detected and clears the cookie.
    const replay = await ctx
      .http()
      .post('/v1/auth/refresh')
      .set(web)
      .set('Cookie', first)
      .send({})
      .expect(401);
    expect(replay.body.error.code).toBe('TOKEN_REUSED');
    expect(refreshCookie(replay.headers['set-cookie'])).toMatch(/Expires=Thu, 01 Jan 1970/);
  });

  it('refuses cookie use from an untrusted origin or without the client header (CSRF)', async () => {
    const login = await ctx.http().post('/v1/auth/anonymous').set(web).send({}).expect(201);
    const cookie = refreshCookie(login.headers['set-cookie'])!.split(';')[0]!;

    const evil = await ctx
      .http()
      .post('/v1/auth/refresh')
      .set({ 'X-Client-Platform': 'web', Origin: 'https://evil.example' })
      .set('Cookie', cookie)
      .send({})
      .expect(403);
    expect(evil.body.error.code).toBe('FORBIDDEN');

    // A plain form post cannot add the custom header, so the cookie is ignored.
    await ctx
      .http()
      .post('/v1/auth/refresh')
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .send({})
      .expect(401);
  });

  it('refuses to start a web session from an untrusted origin', async () => {
    await ctx
      .http()
      .post('/v1/auth/anonymous')
      .set({ 'X-Client-Platform': 'web', Origin: 'https://evil.example' })
      .send({})
      .expect(403);
  });

  it('logout revokes the session and clears the cookie', async () => {
    const login = await ctx
      .http()
      .post('/v1/auth/email/register')
      .set(web)
      .send({
        email: `${unique('web')}@example.com`,
        password: 'long enough password',
        displayName: unique('Web'),
      })
      .expect(201);
    const cookie = refreshCookie(login.headers['set-cookie'])!.split(';')[0]!;
    const out = await ctx
      .http()
      .post('/v1/auth/logout')
      .set(web)
      .set('Cookie', cookie)
      .send({})
      .expect(204);
    expect(refreshCookie(out.headers['set-cookie'])).toMatch(/Expires=Thu, 01 Jan 1970/);
    await ctx.http().post('/v1/auth/refresh').set(web).set('Cookie', cookie).send({}).expect(401);
  });

  it('native apps are unaffected', async () => {
    const res = await ctx.http().post('/v1/auth/anonymous').send({}).expect(201);
    expect(res.body.tokens.refreshToken).toEqual(expect.any(String));
    expect(refreshCookie(res.headers['set-cookie'])).toBeUndefined();
  });

  it('answers CORS preflights only for the web app origin', async () => {
    const ok = await ctx
      .http()
      .options('/v1/auth/refresh')
      .set('Origin', ORIGIN)
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'content-type,x-client-platform');
    expect(ok.headers['access-control-allow-origin']).toBe(ORIGIN);
    expect(ok.headers['access-control-allow-credentials']).toBe('true');

    const evil = await ctx
      .http()
      .options('/v1/auth/refresh')
      .set('Origin', 'https://evil.example')
      .set('Access-Control-Request-Method', 'POST');
    expect(evil.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('rejects socket handshakes from other sites', async () => {
    const login = await ctx.http().post('/v1/auth/anonymous').send({}).expect(201);
    const connect = (origin: string) =>
      new Promise<'connected' | 'refused'>((resolve) => {
        const socket = io(`${ctx.url}/chat`, {
          auth: { token: login.body.tokens.accessToken },
          transports: ['polling'],
          extraHeaders: { Origin: origin },
          forceNew: true,
          reconnection: false,
        });
        socket.once('connect', () => {
          socket.disconnect();
          resolve('connected');
        });
        socket.once('connect_error', () => {
          socket.disconnect();
          resolve('refused');
        });
      });
    expect(await connect(ORIGIN)).toBe('connected');
    expect(await connect('https://evil.example')).toBe('refused');
  });
});

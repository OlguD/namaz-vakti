import {
  anonymous,
  bearer,
  createTestApp,
  extractToken,
  type TestContext,
  unique,
  verifiedUser,
} from './app.js';

describe('Auth (e2e)', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx.close();
  });

  it('creates an anonymous account that can read its profile', async () => {
    const session = await anonymous(ctx);
    const me = await ctx.http().get('/v1/me').set(bearer(session)).expect(200);
    expect(me.body).toMatchObject({
      id: session.userId,
      kind: 'anonymous',
      role: 'user',
      providers: [],
    });
  });

  it('rejects requests without a token and with a bad token', async () => {
    const missing = await ctx.http().get('/v1/me').expect(401);
    expect(missing.body.error.code).toBe('UNAUTHENTICATED');
    await ctx.http().get('/v1/me').set('Authorization', 'Bearer nope').expect(401);
  });

  it('upgrades an anonymous account in place with e-mail registration, then verifies', async () => {
    const anon = await anonymous(ctx);
    const email = `${unique('reg')}@example.com`;
    const res = await ctx
      .http()
      .post('/v1/auth/email/register')
      .set(bearer(anon))
      .send({
        email: email.toUpperCase(),
        password: 'long enough password',
        displayName: unique('Ahmet'),
      })
      .expect(201);
    expect(res.body.user).toMatchObject({
      id: anon.userId,
      kind: 'registered',
      email,
      emailVerified: false,
    });

    const token = extractToken(ctx.mail.outbox.get(email)!.text);
    await ctx.http().post('/v1/auth/email/verify').send({ token }).expect(204);
    // Tokens are single-use.
    const again = await ctx.http().post('/v1/auth/email/verify').send({ token }).expect(400);
    expect(again.body.error.code).toBe('INVALID_TOKEN');

    const me = await ctx
      .http()
      .get('/v1/me')
      .set('Authorization', `Bearer ${res.body.tokens.accessToken}`)
      .expect(200);
    expect(me.body).toMatchObject({ emailVerified: true, providers: ['email'] });
  });

  it('logs in, and refuses wrong passwords with the same error as unknown e-mails', async () => {
    const user = await verifiedUser(ctx);
    await ctx
      .http()
      .post('/v1/auth/email/login')
      .send({ email: user.email, password: 'correct horse battery' })
      .expect(200);
    const wrong = await ctx
      .http()
      .post('/v1/auth/email/login')
      .send({ email: user.email, password: 'nope nope nope' })
      .expect(401);
    const unknown = await ctx
      .http()
      .post('/v1/auth/email/login')
      .send({ email: 'nobody@example.com', password: 'nope nope nope' })
      .expect(401);
    expect(wrong.body.error).toEqual(unknown.body.error);
  });

  it('rejects duplicate e-mails and display names, and bad names', async () => {
    const user = await verifiedUser(ctx, unique('Benzersiz'));
    const me = await ctx.http().get('/v1/me').set(bearer(user)).expect(200);
    const dupEmail = await ctx
      .http()
      .post('/v1/auth/email/register')
      .send({ email: user.email, password: 'long enough password', displayName: unique('Baska') })
      .expect(409);
    expect(dupEmail.body.error.code).toBe('EMAIL_TAKEN');
    const dupName = await ctx
      .http()
      .post('/v1/auth/email/register')
      .send({
        email: `${unique('x')}@example.com`,
        password: 'long enough password',
        displayName: me.body.displayName.toUpperCase(),
      })
      .expect(409);
    expect(dupName.body.error.code).toBe('DISPLAY_NAME_TAKEN');
    const reserved = await ctx
      .http()
      .patch('/v1/me')
      .set(bearer(user))
      .send({ displayName: 'Admin Ekibi' })
      .expect(400);
    expect(reserved.body.error.details).toMatchObject({ problem: 'reserved' });
  });

  it('rotates refresh tokens and revokes the family when a used token is replayed', async () => {
    const session = await anonymous(ctx);
    const first = await ctx
      .http()
      .post('/v1/auth/refresh')
      .send({ refreshToken: session.refreshToken })
      .expect(200);
    const second = await ctx
      .http()
      .post('/v1/auth/refresh')
      .send({ refreshToken: first.body.refreshToken })
      .expect(200);

    const replay = await ctx
      .http()
      .post('/v1/auth/refresh')
      .send({ refreshToken: session.refreshToken })
      .expect(401);
    expect(replay.body.error.code).toBe('TOKEN_REUSED');
    // The legitimate latest token died with the family.
    const after = await ctx
      .http()
      .post('/v1/auth/refresh')
      .send({ refreshToken: second.body.refreshToken })
      .expect(401);
    expect(after.body.error.code).toBe('INVALID_TOKEN');
  });

  it('logout revokes the session', async () => {
    const session = await anonymous(ctx);
    await ctx
      .http()
      .post('/v1/auth/logout')
      .send({ refreshToken: session.refreshToken })
      .expect(204);
    await ctx
      .http()
      .post('/v1/auth/refresh')
      .send({ refreshToken: session.refreshToken })
      .expect(401);
  });

  it('resets a password and signs out other sessions', async () => {
    const user = await verifiedUser(ctx);
    await ctx.http().post('/v1/auth/password/forgot').send({ email: user.email }).expect(204);
    await ctx
      .http()
      .post('/v1/auth/password/forgot')
      .send({ email: 'ghost@example.com' })
      .expect(204);
    const token = extractToken(ctx.mail.outbox.get(user.email)!.text);
    await ctx
      .http()
      .post('/v1/auth/password/reset')
      .send({ token, password: 'a brand new password' })
      .expect(204);
    await ctx.http().post('/v1/auth/refresh').send({ refreshToken: user.refreshToken }).expect(401);
    await ctx
      .http()
      .post('/v1/auth/email/login')
      .send({ email: user.email, password: 'a brand new password' })
      .expect(200);
  });

  it('signs in with Apple, upgrading the anonymous caller, and finds the same account next time', async () => {
    const anon = await anonymous(ctx);
    const subject = unique('apple-sub-');
    const email = `${unique('apple')}@privaterelay.appleid.com`;
    const first = await ctx
      .http()
      .post('/v1/auth/apple')
      .set(bearer(anon))
      .send({ identityToken: `${subject}|${email}`, displayName: unique('Elma') })
      .expect(201);
    expect(first.body.user).toMatchObject({
      id: anon.userId,
      kind: 'registered',
      emailVerified: true,
      providers: ['apple'],
    });

    // Fresh install: a new anonymous account signs in with the same Apple ID.
    const other = await anonymous(ctx);
    const second = await ctx
      .http()
      .post('/v1/auth/apple')
      .set(bearer(other))
      .send({ identityToken: `${subject}|${email}` })
      .expect(201);
    expect(second.body.user.id).toBe(anon.userId);
    // The throwaway anonymous account was folded in and removed.
    await ctx.http().get('/v1/me').set(bearer(other)).expect(401);
  });

  it('links Google to an existing verified e-mail account', async () => {
    const user = await verifiedUser(ctx);
    const res = await ctx
      .http()
      .post('/v1/auth/google')
      .send({ idToken: `${unique('g-')}|${user.email}` })
      .expect(201);
    expect(res.body.user.id).toBe(user.userId);
    expect(res.body.user.providers.sort()).toEqual(['email', 'google']);
  });

  it('makes listed admin e-mails admins once verified', async () => {
    const res = await ctx
      .http()
      .post('/v1/auth/google')
      .send({ idToken: `${unique('g-admin-')}|admin@example.com` })
      .expect(201);
    expect(res.body.user.role).toBe('admin');
  });

  it('deletes the account permanently', async () => {
    const user = await verifiedUser(ctx);
    await ctx.http().delete('/v1/me').set(bearer(user)).expect(204);
    await ctx.http().get('/v1/me').set(bearer(user)).expect(401);
    await ctx
      .http()
      .post('/v1/auth/email/login')
      .send({ email: user.email, password: 'correct horse battery' })
      .expect(401);
  });

  it('validates input and strips unknown fields', async () => {
    const res = await ctx
      .http()
      .post('/v1/auth/email/register')
      .send({ email: 'not-an-email', password: 'short', displayName: 'x', role: 'admin' })
      .expect(400);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
    expect(JSON.stringify(res.body.error.details)).toContain('role');
  });
});

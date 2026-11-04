import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { SocialVerifier } from '../src/auth/social-verifier.service.js';
import { configureApp } from '../src/bootstrap.js';
import { ExpoPushClient } from '../src/notifications/expo-push.client.js';
import { YoutubeClient } from '../src/live/youtube.client.js';
import { MailService } from '../src/mail/mail.service.js';
import { OverpassClient } from '../src/mosques/overpass.client.js';
import { EmushafProvider } from '../src/prayer-times/providers/emushaf.provider.js';
import {
  FakeExpo,
  FakeOverpass,
  FakePrayerProvider,
  FakeSocialVerifier,
  FakeYoutube,
} from './fakes.js';

export interface TestContext {
  app: INestApplication;
  http: () => ReturnType<typeof request>;
  url: string;
  fakes: {
    prayer: FakePrayerProvider;
    overpass: FakeOverpass;
    youtube: FakeYoutube;
    expo: FakeExpo;
  };
  mail: MailService;
  close: () => Promise<void>;
}

/** The real app wired exactly like production, with third-party clients faked. */
export async function createTestApp(): Promise<TestContext> {
  const fakes = {
    prayer: new FakePrayerProvider(),
    overpass: new FakeOverpass(),
    youtube: new FakeYoutube(),
    expo: new FakeExpo(),
  };
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(EmushafProvider)
    .useValue(fakes.prayer)
    .overrideProvider(OverpassClient)
    .useValue(fakes.overpass)
    .overrideProvider(YoutubeClient)
    .useValue(fakes.youtube)
    .overrideProvider(ExpoPushClient)
    .useValue(fakes.expo)
    .overrideProvider(SocialVerifier)
    .useValue(new FakeSocialVerifier())
    .compile();

  const app = moduleRef.createNestApplication({ logger: ['error', 'warn'] });
  await configureApp(app);
  await app.listen(0, '127.0.0.1');
  const address = app.getHttpServer().address() as { port: number };
  const url = `http://127.0.0.1:${address.port}`;

  return {
    app,
    url,
    http: () => request(app.getHttpServer()),
    fakes,
    mail: app.get(MailService),
    close: () => app.close(),
  };
}

let counter = 0;
export function unique(prefix: string): string {
  counter += 1;
  return `${prefix}${Date.now().toString(36)}${counter}`;
}

export interface Session {
  accessToken: string;
  refreshToken: string;
  userId: string;
}

export async function anonymous(ctx: TestContext): Promise<Session> {
  const res = await ctx.http().post('/v1/auth/anonymous').send({}).expect(201);
  return {
    accessToken: res.body.tokens.accessToken,
    refreshToken: res.body.tokens.refreshToken,
    userId: res.body.user.id,
  };
}

/** Registers by e-mail, clicks the verification link and returns fresh tokens. */
export async function verifiedUser(
  ctx: TestContext,
  name = unique('Kul'),
): Promise<Session & { email: string }> {
  const email = `${unique('u')}@example.com`;
  const res = await ctx
    .http()
    .post('/v1/auth/email/register')
    .send({ email, password: 'correct horse battery', displayName: name.slice(0, 24) })
    .expect(201);
  const token = extractToken(ctx.mail.outbox.get(email)!.text);
  await ctx.http().post('/v1/auth/email/verify').send({ token }).expect(204);
  const refreshed = await ctx
    .http()
    .post('/v1/auth/refresh')
    .send({ refreshToken: res.body.tokens.refreshToken })
    .expect(200);
  return {
    accessToken: refreshed.body.accessToken,
    refreshToken: refreshed.body.refreshToken,
    userId: res.body.user.id,
    email,
  };
}

export function extractToken(text: string): string {
  const match = /token=([\w-]+)/.exec(text);
  if (!match) {
    throw new Error(`No token in e-mail: ${text}`);
  }
  return decodeURIComponent(match[1]!);
}

export const bearer = (session: { accessToken: string }) => ({
  Authorization: `Bearer ${session.accessToken}`,
});

import { HttpStatus, Injectable } from '@nestjs/common';
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';
import { createHash } from 'node:crypto';
import { AppConfig } from '../config/app-config.service.js';
import { AppError } from '../common/errors.js';

export interface SocialIdentity {
  provider: 'apple' | 'google';
  subject: string;
  email?: string;
  emailVerified: boolean;
  name?: string;
}

const APPLE_ISSUER = 'https://appleid.apple.com';
const GOOGLE_ISSUERS = ['https://accounts.google.com', 'accounts.google.com'];

/**
 * Verifies ID tokens produced on-device by Sign in with Apple / Google Sign-In.
 * The app never sends us passwords or OAuth codes for these providers — only the
 * signed ID token, which we check against the provider's published keys and our
 * own client IDs (audience).
 */
@Injectable()
export class SocialVerifier {
  private readonly appleKeys = createRemoteJWKSet(new URL('https://appleid.apple.com/auth/keys'), {
    cacheMaxAge: 6 * 60 * 60 * 1000,
  });
  private readonly googleKeys = createRemoteJWKSet(
    new URL('https://www.googleapis.com/oauth2/v3/certs'),
    { cacheMaxAge: 6 * 60 * 60 * 1000 },
  );

  constructor(private readonly config: AppConfig) {}

  async verifyApple(idToken: string, rawNonce?: string): Promise<SocialIdentity> {
    const audience = this.config.get('APPLE_CLIENT_IDS');
    if (audience.length === 0) {
      throw new AppError(
        'FEATURE_DISABLED',
        'Sign in with Apple is not configured',
        HttpStatus.NOT_IMPLEMENTED,
      );
    }
    const payload = await this.verify(idToken, this.appleKeys, APPLE_ISSUER, audience);
    if (rawNonce !== undefined) {
      // Apple embeds SHA-256(nonce); the app sends us the raw value it generated.
      const expected = createHash('sha256').update(rawNonce).digest('hex');
      if (payload.nonce !== expected) {
        throw this.invalid();
      }
    }
    return {
      provider: 'apple',
      subject: String(payload.sub),
      email: typeof payload.email === 'string' ? payload.email.toLowerCase() : undefined,
      emailVerified: payload.email_verified === true || payload.email_verified === 'true',
    };
  }

  async verifyGoogle(idToken: string): Promise<SocialIdentity> {
    const audience = this.config.get('GOOGLE_CLIENT_IDS');
    if (audience.length === 0) {
      throw new AppError(
        'FEATURE_DISABLED',
        'Google sign-in is not configured',
        HttpStatus.NOT_IMPLEMENTED,
      );
    }
    const payload = await this.verify(idToken, this.googleKeys, GOOGLE_ISSUERS, audience);
    return {
      provider: 'google',
      subject: String(payload.sub),
      email: typeof payload.email === 'string' ? payload.email.toLowerCase() : undefined,
      emailVerified: payload.email_verified === true,
      name: typeof payload.name === 'string' ? payload.name : undefined,
    };
  }

  private async verify(
    token: string,
    keys: ReturnType<typeof createRemoteJWKSet>,
    issuer: string | string[],
    audience: string[],
  ): Promise<JWTPayload & Record<string, unknown>> {
    try {
      const { payload } = await jwtVerify(token, keys, { issuer, audience, clockTolerance: 30 });
      if (!payload.sub) {
        throw this.invalid();
      }
      return payload as JWTPayload & Record<string, unknown>;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw this.invalid();
    }
  }

  private invalid(): AppError {
    return new AppError(
      'INVALID_TOKEN',
      'Identity token could not be verified',
      HttpStatus.UNAUTHORIZED,
    );
  }
}

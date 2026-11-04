import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { and, eq, isNull } from 'drizzle-orm';
import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { AppConfig } from '../config/app-config.service.js';
import { type Database, InjectDb, type Tx } from '../db/database.module.js';
import { refreshTokens } from '../db/schema/index.js';
import { AppError } from '../common/errors.js';
import { HttpStatus } from '@nestjs/common';
import type { AuthUser } from './auth.decorators.js';
import { AccessRevocation } from './access-revocation.service.js';

export interface TokenPair {
  accessToken: string;
  accessTokenExpiresIn: number;
  refreshToken: string;
  refreshTokenExpiresAt: string;
}

interface AccessClaims {
  sub: string;
  kind: AuthUser['kind'];
  role: AuthUser['role'];
  ev: boolean;
  /** Issued-at in milliseconds; finer than `iat`, used for revocation checks. */
  iam: number;
}

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

/** Opaque random secret, URL-safe. */
export function randomSecret(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: AppConfig,
    @InjectDb() private readonly db: Database,
    private readonly revocation: AccessRevocation,
  ) {}

  async verifyAccessToken(token: string): Promise<AuthUser> {
    let claims: AccessClaims;
    try {
      claims = await this.jwt.verifyAsync<AccessClaims>(token, {
        algorithms: ['HS256'],
        audience: 'namaz-vakti-app',
        issuer: 'namaz-vakti-api',
      });
    } catch {
      throw AppError.unauthenticated('Access token is invalid or expired');
    }
    if (await this.revocation.isRevoked(claims.sub, claims.iam)) {
      throw AppError.unauthenticated('Session has ended; sign in again');
    }
    return { id: claims.sub, kind: claims.kind, role: claims.role, emailVerified: claims.ev };
  }

  /** Issues an access token and starts a new refresh-token family (a new login). */
  async issue(user: AuthUser, userAgent?: string, tx: Database | Tx = this.db): Promise<TokenPair> {
    return this.issueInFamily(user, randomUUID(), userAgent, tx);
  }

  /**
   * Exchanges a refresh token for a new pair. The presented token is retired; if it
   * was already retired, someone is replaying a stolen token, so the whole family
   * (every session descended from that login) is revoked.
   */
  async rotate(
    presented: string,
    loadUser: (userId: string, tx: Tx) => Promise<AuthUser>,
    userAgent?: string,
  ): Promise<TokenPair> {
    const [id, secret] = presented.split('.');
    if (!id || !secret || !/^[0-9a-f-]{36}$/.test(id)) {
      throw this.invalid();
    }

    const outcome = await this.db.transaction(async (tx) => {
      const [row] = await tx
        .select()
        .from(refreshTokens)
        .where(eq(refreshTokens.id, id))
        .for('update');
      if (!row || !safeEqual(row.tokenHash, sha256(secret))) {
        throw this.invalid();
      }
      if (row.revokedAt) {
        throw this.invalid();
      }
      if (row.rotatedAt) {
        // Report instead of throwing: a throw here would roll back the revocation.
        return { reused: true as const, familyId: row.familyId };
      }
      if (row.expiresAt.getTime() < Date.now()) {
        throw this.invalid();
      }

      await tx.update(refreshTokens).set({ rotatedAt: new Date() }).where(eq(refreshTokens.id, id));
      const user = await loadUser(row.userId, tx);
      return {
        reused: false as const,
        pair: await this.issueInFamily(user, row.familyId, userAgent, tx),
      };
    });

    if (outcome.reused) {
      await this.db
        .update(refreshTokens)
        .set({ revokedAt: new Date() })
        .where(and(eq(refreshTokens.familyId, outcome.familyId), isNull(refreshTokens.revokedAt)));
      throw new AppError(
        'TOKEN_REUSED',
        'Refresh token was already used; all sessions from this login were signed out',
        HttpStatus.UNAUTHORIZED,
      );
    }
    return outcome.pair;
  }

  /** Logout: revoke the family the presented token belongs to. Silent if unknown. */
  async revokeFamilyOf(presented: string): Promise<void> {
    const [id, secret] = presented.split('.');
    if (!id || !secret || !/^[0-9a-f-]{36}$/.test(id)) {
      return;
    }
    const [row] = await this.db.select().from(refreshTokens).where(eq(refreshTokens.id, id));
    if (!row || !safeEqual(row.tokenHash, sha256(secret))) {
      return;
    }
    await this.db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(and(eq(refreshTokens.familyId, row.familyId), isNull(refreshTokens.revokedAt)));
  }

  /** Signs the user out everywhere: refresh tokens revoked, live access tokens voided. */
  async revokeAllForUser(userId: string, tx: Database | Tx = this.db): Promise<void> {
    await this.revocation.revokeUser(userId);
    await tx
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(and(eq(refreshTokens.userId, userId), isNull(refreshTokens.revokedAt)));
  }

  private async issueInFamily(
    user: AuthUser,
    familyId: string,
    userAgent: string | undefined,
    tx: Database | Tx,
  ): Promise<TokenPair> {
    const ttl = this.config.get('JWT_ACCESS_TTL_SECONDS');
    const claims: AccessClaims = {
      sub: user.id,
      kind: user.kind,
      role: user.role,
      ev: user.emailVerified,
      iam: Date.now(),
    };
    const accessToken = await this.jwt.signAsync(claims, {
      algorithm: 'HS256',
      expiresIn: ttl,
      audience: 'namaz-vakti-app',
      issuer: 'namaz-vakti-api',
    });

    const secret = randomSecret();
    const expiresAt = new Date(Date.now() + this.config.get('REFRESH_TOKEN_TTL_DAYS') * 86_400_000);
    const [row] = await tx
      .insert(refreshTokens)
      .values({
        userId: user.id,
        familyId,
        tokenHash: sha256(secret),
        expiresAt,
        userAgent: userAgent?.slice(0, 255),
      })
      .returning({ id: refreshTokens.id });

    return {
      accessToken,
      accessTokenExpiresIn: ttl,
      refreshToken: `${row!.id}.${secret}`,
      refreshTokenExpiresAt: expiresAt.toISOString(),
    };
  }

  private invalid(): AppError {
    return new AppError(
      'INVALID_TOKEN',
      'Refresh token is invalid or expired',
      HttpStatus.UNAUTHORIZED,
    );
  }
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

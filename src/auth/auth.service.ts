import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import argon2 from 'argon2';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { AppError } from '../common/errors.js';
import { type Database, InjectDb, type Tx } from '../db/database.module.js';
import { authIdentities, devices, emailTokens, users } from '../db/schema/index.js';
import { MailService } from '../mail/mail.service.js';
import {
  mapUniqueViolation,
  type PublicProfile,
  toAuthUser,
  toProfile,
  type UserRow,
  UsersService,
} from '../users/users.service.js';
import type { AuthUser } from './auth.decorators.js';
import type { AnonymousLoginDto } from './dto.js';
import { type SocialIdentity, SocialVerifier } from './social-verifier.service.js';
import { randomSecret, sha256, type TokenPair, TokenService } from './token.service.js';

export interface AuthResult {
  tokens: TokenPair;
  user: PublicProfile;
}

const VERIFY_TTL_MS = 24 * 60 * 60 * 1000;
const RESET_TTL_MS = 60 * 60 * 1000;
// OWASP-recommended argon2id baseline (19 MiB, 2 passes).
const ARGON_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  /** Hash of a random string; verifying against it equalises timing for unknown e-mails. */
  private readonly dummyHash = argon2.hash(randomSecret(), ARGON_OPTIONS);

  constructor(
    @InjectDb() private readonly db: Database,
    private readonly users: UsersService,
    private readonly tokens: TokenService,
    private readonly social: SocialVerifier,
    private readonly mail: MailService,
  ) {}

  async anonymous(input: AnonymousLoginDto, userAgent?: string): Promise<AuthResult> {
    return this.db.transaction(async (tx) => {
      const [user] = await tx.insert(users).values({ kind: 'anonymous' }).returning();
      if (input.installationId && input.platform) {
        await tx
          .insert(devices)
          .values({
            userId: user!.id,
            installationId: input.installationId,
            platform: input.platform,
          })
          .onConflictDoUpdate({
            target: devices.installationId,
            set: { userId: user!.id, platform: input.platform, lastSeenAt: new Date() },
          });
      }
      return this.result(user!, userAgent, tx);
    });
  }

  async apple(
    identityToken: string,
    nonce: string | undefined,
    displayName: string | undefined,
    caller: AuthUser | undefined,
    userAgent?: string,
  ): Promise<AuthResult> {
    const identity = await this.social.verifyApple(identityToken, nonce);
    return this.socialLogin(identity, displayName, caller, userAgent);
  }

  async google(
    idToken: string,
    displayName: string | undefined,
    caller: AuthUser | undefined,
    userAgent?: string,
  ): Promise<AuthResult> {
    const identity = await this.social.verifyGoogle(idToken);
    return this.socialLogin(identity, displayName ?? identity.name, caller, userAgent);
  }

  /**
   * Resolution order for a verified social identity:
   * 1. identity already linked → sign in as that user (adopting the anonymous caller's devices)
   * 2. verified e-mail matches an existing verified account → link and sign in
   * 3. caller is anonymous → upgrade that account in place (keeps their settings)
   * 4. otherwise create a new registered account
   */
  private async socialLogin(
    identity: SocialIdentity,
    requestedName: string | undefined,
    caller: AuthUser | undefined,
    userAgent?: string,
  ): Promise<AuthResult> {
    const email = identity.emailVerified ? identity.email : undefined;

    try {
      return await this.db.transaction(async (tx) => {
        const [linked] = await tx
          .select({ userId: authIdentities.userId })
          .from(authIdentities)
          .where(
            and(
              eq(authIdentities.provider, identity.provider),
              eq(authIdentities.subject, identity.subject),
            ),
          );
        if (linked) {
          const user = await this.users.getOrThrow(linked.userId, tx);
          await this.absorbAnonymousCaller(caller, user.id, tx);
          return this.result(user, userAgent, tx);
        }

        let target: UserRow | undefined;
        if (email) {
          const existing = await this.users.findByEmail(email, tx);
          if (existing?.emailVerifiedAt) {
            target = existing;
          }
        }
        if (!target && caller?.kind === 'anonymous') {
          target = await this.users.findById(caller.id, tx);
        }

        const name = await this.availableName(requestedName, target?.id, tx);
        const adminRole = this.users.roleForEmail(email, true);

        if (target) {
          const [updated] = await tx
            .update(users)
            .set({
              kind: 'registered',
              email: target.email ?? email ?? null,
              emailVerifiedAt: target.emailVerifiedAt ?? new Date(),
              displayName: target.displayName ?? name ?? null,
              ...(adminRole ? { role: adminRole } : {}),
            })
            .where(eq(users.id, target.id))
            .returning();
          target = updated!;
          if (caller?.kind === 'anonymous' && caller.id !== target.id) {
            await this.absorbAnonymousCaller(caller, target.id, tx);
          }
        } else {
          const [created] = await tx
            .insert(users)
            .values({
              kind: 'registered',
              email: email ?? null,
              emailVerifiedAt: new Date(),
              displayName: name ?? null,
              role: adminRole ?? 'user',
            })
            .returning();
          target = created!;
        }

        await tx.insert(authIdentities).values({
          userId: target.id,
          provider: identity.provider,
          subject: identity.subject,
          email: identity.email,
        });
        return this.result(target, userAgent, tx);
      });
    } catch (error) {
      throw mapUniqueViolation(error);
    }
  }

  async registerWithEmail(
    email: string,
    password: string,
    displayName: string,
    caller: AuthUser | undefined,
    userAgent?: string,
  ): Promise<AuthResult> {
    const name = await this.users.assertDisplayNameAvailable(displayName, caller?.id);
    if (await this.users.findByEmail(email)) {
      throw AppError.conflict('EMAIL_TAKEN', 'An account with this e-mail already exists');
    }
    const passwordHash = await argon2.hash(password, ARGON_OPTIONS);

    try {
      const { result, token } = await this.db.transaction(async (tx) => {
        let row: UserRow;
        if (caller?.kind === 'anonymous') {
          const [updated] = await tx
            .update(users)
            .set({ kind: 'registered', email, passwordHash, displayName: name })
            .where(and(eq(users.id, caller.id), eq(users.kind, 'anonymous')))
            .returning();
          if (!updated) {
            throw AppError.unauthenticated('Anonymous session no longer exists');
          }
          row = updated;
        } else {
          const [created] = await tx
            .insert(users)
            .values({ kind: 'registered', email, passwordHash, displayName: name })
            .returning();
          row = created!;
        }
        const token = await this.createEmailToken(row.id, 'verify_email', VERIFY_TTL_MS, tx);
        return { result: await this.result(row, userAgent, tx), token };
      });
      await this.mail.sendVerification(email, token);
      return result;
    } catch (error) {
      throw mapUniqueViolation(error);
    }
  }

  async loginWithEmail(email: string, password: string, userAgent?: string): Promise<AuthResult> {
    const row = await this.users.findByEmail(email);
    if (!row?.passwordHash) {
      await argon2.verify(await this.dummyHash, password).catch(() => false);
      throw this.invalidCredentials();
    }
    if (!(await argon2.verify(row.passwordHash, password))) {
      throw this.invalidCredentials();
    }
    this.users.assertNotBanned(row);
    return this.result(row, userAgent, this.db);
  }

  async resendVerification(userId: string): Promise<void> {
    const row = await this.users.getOrThrow(userId);
    if (!row.email || row.emailVerifiedAt) {
      return;
    }
    const token = await this.createEmailToken(row.id, 'verify_email', VERIFY_TTL_MS);
    await this.mail.sendVerification(row.email, token);
  }

  async verifyEmail(token: string): Promise<void> {
    await this.db.transaction(async (tx) => {
      const row = await this.consumeEmailToken(token, 'verify_email', tx);
      const user = await this.users.getOrThrow(row.userId, tx);
      const adminRole = this.users.roleForEmail(user.email, true);
      await tx
        .update(users)
        .set({ emailVerifiedAt: new Date(), ...(adminRole ? { role: adminRole } : {}) })
        .where(eq(users.id, row.userId));
    });
  }

  /** Always succeeds from the caller's view, so it cannot be used to probe for accounts. */
  async forgotPassword(email: string): Promise<void> {
    const row = await this.users.findByEmail(email);
    if (!row?.passwordHash) {
      return;
    }
    const token = await this.createEmailToken(row.id, 'reset_password', RESET_TTL_MS);
    await this.mail.sendPasswordReset(email, token).catch((error: unknown) => {
      this.logger.error({ err: error }, 'Password reset e-mail failed');
    });
  }

  async resetPassword(token: string, password: string): Promise<void> {
    const passwordHash = await argon2.hash(password, ARGON_OPTIONS);
    await this.db.transaction(async (tx) => {
      const row = await this.consumeEmailToken(token, 'reset_password', tx);
      // Receiving the reset mail also proves ownership of the address.
      await tx
        .update(users)
        .set({ passwordHash, emailVerifiedAt: new Date() })
        .where(eq(users.id, row.userId));
      await this.tokens.revokeAllForUser(row.userId, tx);
    });
  }

  async refresh(refreshToken: string, userAgent?: string): Promise<TokenPair> {
    return this.tokens.rotate(refreshToken, (id, tx) => this.users.loadAuthUser(id, tx), userAgent);
  }

  async logout(refreshToken: string): Promise<void> {
    await this.tokens.revokeFamilyOf(refreshToken);
  }

  private async result(
    row: UserRow,
    userAgent: string | undefined,
    tx: Database | Tx,
  ): Promise<AuthResult> {
    this.users.assertNotBanned(row);
    const tokens = await this.tokens.issue(toAuthUser(row), userAgent, tx);
    const identities = await tx
      .select({ provider: authIdentities.provider })
      .from(authIdentities)
      .where(eq(authIdentities.userId, row.id));
    const providers: PublicProfile['providers'] = identities.map((identity) => identity.provider);
    if (row.passwordHash) {
      providers.push('email');
    }
    return { tokens, user: toProfile(row, providers) };
  }

  /** Moves an anonymous caller's devices onto the account they just signed in to, then removes it. */
  private async absorbAnonymousCaller(
    caller: AuthUser | undefined,
    targetId: string,
    tx: Tx,
  ): Promise<void> {
    if (!caller || caller.kind !== 'anonymous' || caller.id === targetId) {
      return;
    }
    await tx.update(devices).set({ userId: targetId }).where(eq(devices.userId, caller.id));
    await tx.delete(users).where(and(eq(users.id, caller.id), eq(users.kind, 'anonymous')));
    await this.tokens.revokeAllForUser(caller.id, tx);
  }

  private async availableName(
    requested: string | undefined,
    exceptUserId: string | undefined,
    tx: Tx,
  ): Promise<string | undefined> {
    if (!requested?.trim()) {
      return undefined;
    }
    try {
      return await this.users.assertDisplayNameAvailable(requested, exceptUserId, tx);
    } catch {
      // A provider-supplied name that is taken or invalid is not worth failing login
      // over; the app asks for a name before the first chat message.
      return undefined;
    }
  }

  private async createEmailToken(
    userId: string,
    purpose: 'verify_email' | 'reset_password',
    ttlMs: number,
    tx: Database | Tx = this.db,
  ): Promise<string> {
    const token = randomSecret(24);
    await tx.insert(emailTokens).values({
      userId,
      purpose,
      tokenHash: sha256(token),
      expiresAt: new Date(Date.now() + ttlMs),
    });
    return token;
  }

  private async consumeEmailToken(
    token: string,
    purpose: 'verify_email' | 'reset_password',
    tx: Tx,
  ): Promise<typeof emailTokens.$inferSelect> {
    const [row] = await tx
      .update(emailTokens)
      .set({ usedAt: new Date() })
      .where(
        and(
          eq(emailTokens.tokenHash, sha256(token)),
          eq(emailTokens.purpose, purpose),
          isNull(emailTokens.usedAt),
          gt(emailTokens.expiresAt, new Date()),
        ),
      )
      .returning();
    if (!row) {
      throw new AppError(
        'INVALID_TOKEN',
        'This link is invalid or has expired',
        HttpStatus.BAD_REQUEST,
      );
    }
    return row;
  }

  private invalidCredentials(): AppError {
    return new AppError(
      'INVALID_CREDENTIALS',
      'E-mail or password is incorrect',
      HttpStatus.UNAUTHORIZED,
    );
  }
}

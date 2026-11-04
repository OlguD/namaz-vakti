import { HttpStatus, Injectable } from '@nestjs/common';
import { and, eq, ne, sql } from 'drizzle-orm';
import { AppError } from '../common/errors.js';
import { AppConfig } from '../config/app-config.service.js';
import { type Database, InjectDb, type Tx } from '../db/database.module.js';
import { authIdentities, districts, users } from '../db/schema/index.js';
import { checkDisplayName } from '../moderation/text-filter.js';
import type { AuthUser } from '../auth/auth.decorators.js';

export type UserRow = typeof users.$inferSelect;

export interface PublicProfile {
  id: string;
  kind: UserRow['kind'];
  role: UserRow['role'];
  displayName: string | null;
  email: string | null;
  emailVerified: boolean;
  locale: string;
  districtId: string | null;
  providers: Array<'apple' | 'google' | 'email'>;
  chatMutedUntil: string | null;
  createdAt: string;
}

const DISPLAY_NAME_MESSAGES = {
  length: 'Display name must be 3–24 characters',
  characters: 'Display name may contain letters, digits, spaces, dot, dash and underscore',
  profanity: 'This display name is not allowed',
  reserved: 'This display name is reserved',
} as const;

@Injectable()
export class UsersService {
  constructor(
    @InjectDb() private readonly db: Database,
    private readonly config: AppConfig,
  ) {}

  async findById(id: string, tx: Database | Tx = this.db): Promise<UserRow | undefined> {
    const [row] = await tx.select().from(users).where(eq(users.id, id));
    return row;
  }

  async findByEmail(email: string, tx: Database | Tx = this.db): Promise<UserRow | undefined> {
    const [row] = await tx.select().from(users).where(eq(users.email, email.toLowerCase()));
    return row;
  }

  async getOrThrow(id: string, tx: Database | Tx = this.db): Promise<UserRow> {
    const row = await this.findById(id, tx);
    if (!row) {
      throw AppError.unauthenticated('Account no longer exists');
    }
    return row;
  }

  /** Loads the user for token issuance and refuses banned accounts. */
  async loadAuthUser(id: string, tx: Database | Tx = this.db): Promise<AuthUser> {
    const row = await this.getOrThrow(id, tx);
    this.assertNotBanned(row);
    return toAuthUser(row);
  }

  assertNotBanned(row: UserRow): void {
    if (row.bannedUntil && row.bannedUntil.getTime() > Date.now()) {
      throw new AppError('ACCOUNT_BANNED', 'This account is suspended', HttpStatus.FORBIDDEN, {
        until: row.bannedUntil.toISOString(),
      });
    }
  }

  /** Validates and checks uniqueness; returns the trimmed name. */
  async assertDisplayNameAvailable(
    name: string,
    exceptUserId?: string,
    tx: Database | Tx = this.db,
  ): Promise<string> {
    const trimmed = name.trim();
    const problem = checkDisplayName(trimmed);
    if (problem) {
      throw AppError.badRequest('VALIDATION_FAILED', DISPLAY_NAME_MESSAGES[problem], {
        field: 'displayName',
        problem,
      });
    }
    const conditions = [sql`lower(${users.displayName}) = lower(${trimmed})`];
    if (exceptUserId) {
      conditions.push(ne(users.id, exceptUserId));
    }
    const [taken] = await tx
      .select({ id: users.id })
      .from(users)
      .where(and(...conditions));
    if (taken) {
      throw AppError.conflict('DISPLAY_NAME_TAKEN', 'This display name is already taken');
    }
    return trimmed;
  }

  /** Grants admin to verified e-mails listed in ADMIN_EMAILS (first-admin bootstrap). */
  roleForEmail(email: string | null | undefined, verified: boolean): 'admin' | undefined {
    if (!email || !verified) {
      return undefined;
    }
    return this.config.get('ADMIN_EMAILS').includes(email.toLowerCase()) ? 'admin' : undefined;
  }

  async profile(id: string): Promise<PublicProfile> {
    const row = await this.getOrThrow(id);
    const identities = await this.db
      .select({ provider: authIdentities.provider })
      .from(authIdentities)
      .where(eq(authIdentities.userId, id));
    const providers: PublicProfile['providers'] = identities.map((identity) => identity.provider);
    if (row.passwordHash) {
      providers.push('email');
    }
    return toProfile(row, providers);
  }

  async update(
    id: string,
    patch: { displayName?: string; locale?: string; districtId?: string | null },
  ): Promise<PublicProfile> {
    const changes: Partial<typeof users.$inferInsert> = {};
    if (patch.displayName !== undefined) {
      changes.displayName = await this.assertDisplayNameAvailable(patch.displayName, id);
    }
    if (patch.locale !== undefined) {
      changes.locale = patch.locale;
    }
    if (patch.districtId !== undefined) {
      if (patch.districtId !== null) {
        const [district] = await this.db
          .select({ id: districts.id })
          .from(districts)
          .where(eq(districts.id, patch.districtId));
        if (!district) {
          throw AppError.notFound('District');
        }
      }
      changes.districtId = patch.districtId;
    }
    if (Object.keys(changes).length > 0) {
      try {
        await this.db.update(users).set(changes).where(eq(users.id, id));
      } catch (error) {
        throw mapUniqueViolation(error);
      }
    }
    return this.profile(id);
  }

  /**
   * Permanently deletes the account. Identities, devices, sessions, chat messages,
   * reports and blocks go with it through ON DELETE CASCADE (App Store 5.1.1(v)).
   */
  async deleteAccount(id: string): Promise<void> {
    await this.db.delete(users).where(eq(users.id, id));
  }
}

export function toAuthUser(row: UserRow): AuthUser {
  return {
    id: row.id,
    kind: row.kind,
    role: row.role,
    emailVerified: row.kind === 'registered' && row.emailVerifiedAt !== null,
  };
}

export function toProfile(row: UserRow, providers: PublicProfile['providers']): PublicProfile {
  return {
    id: row.id,
    kind: row.kind,
    role: row.role,
    displayName: row.displayName,
    email: row.email,
    emailVerified: row.emailVerifiedAt !== null,
    locale: row.locale,
    districtId: row.districtId,
    providers,
    chatMutedUntil:
      row.chatMutedUntil && row.chatMutedUntil.getTime() > Date.now()
        ? row.chatMutedUntil.toISOString()
        : null,
    createdAt: row.createdAt.toISOString(),
  };
}

/** Postgres unique violations on users → friendly 409s. */
export function mapUniqueViolation(error: unknown): unknown {
  const cause = (error as { cause?: { code?: string; constraint?: string } }).cause ?? error;
  const pgError = cause as { code?: string; constraint?: string };
  if (pgError.code === '23505') {
    if (pgError.constraint === 'users_display_name_unique') {
      return AppError.conflict('DISPLAY_NAME_TAKEN', 'This display name is already taken');
    }
    if (pgError.constraint === 'users_email_unique') {
      return AppError.conflict('EMAIL_TAKEN', 'An account with this e-mail already exists');
    }
  }
  return error;
}

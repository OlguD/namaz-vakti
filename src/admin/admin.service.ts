import { Injectable } from '@nestjs/common';
import { and, desc, eq, ilike, or, sql } from 'drizzle-orm';
import { AppError } from '../common/errors.js';
import { TokenService } from '../auth/token.service.js';
import { ChatBroadcaster } from '../chat/chat.broadcaster.js';
import { type Database, InjectDb } from '../db/database.module.js';
import { chatMessages, chatReports, chatRooms, users } from '../db/schema/index.js';

export type ResolveAction = 'dismiss' | 'remove' | 'remove_and_mute' | 'remove_and_ban';

@Injectable()
export class AdminService {
  constructor(
    @InjectDb() private readonly db: Database,
    private readonly tokens: TokenService,
    private readonly broadcaster: ChatBroadcaster,
  ) {}

  /** Report queue grouped by message, most-reported first. */
  async reportQueue(status: 'open' | 'actioned' | 'dismissed', limit: number) {
    const result = await this.db.execute<{
      message_id: number;
      room_id: string;
      body: string;
      hidden: boolean;
      author_id: string;
      author_name: string | null;
      reporters: number;
      reasons: string[];
      first_reported_at: Date;
    }>(sql`
      SELECT m.id AS message_id, m.room_id, m.body, (m.hidden_at IS NOT NULL) AS hidden,
             u.id AS author_id, u.display_name AS author_name,
             count(DISTINCT r.reporter_id)::int AS reporters,
             array_agg(DISTINCT r.reason::text) AS reasons,
             min(r.created_at) AS first_reported_at
      FROM ${chatReports} r
      JOIN ${chatMessages} m ON m.id = r.message_id
      JOIN ${users} u ON u.id = m.user_id
      WHERE r.status = ${status}
      GROUP BY m.id, u.id
      ORDER BY reporters DESC, first_reported_at ASC
      LIMIT ${limit}
    `);
    return result.rows.map((row) => ({
      messageId: String(row.message_id),
      roomId: row.room_id,
      body: row.body,
      hidden: row.hidden,
      author: { id: row.author_id, displayName: row.author_name },
      reporters: row.reporters,
      reasons: row.reasons,
      firstReportedAt: new Date(row.first_reported_at).toISOString(),
    }));
  }

  async resolveReports(
    moderatorId: string,
    messageId: number,
    action: ResolveAction,
    durationHours = 24,
  ): Promise<void> {
    const [message] = await this.db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.id, messageId));
    if (!message) {
      throw AppError.notFound('Message');
    }
    await this.db.transaction(async (tx) => {
      await tx
        .update(chatReports)
        .set({
          status: action === 'dismiss' ? 'dismissed' : 'actioned',
          handledBy: moderatorId,
          handledAt: new Date(),
        })
        .where(and(eq(chatReports.messageId, messageId), eq(chatReports.status, 'open')));

      if (action === 'dismiss') {
        // Undo an automatic hide that turned out to be unwarranted.
        await tx
          .update(chatMessages)
          .set({ hiddenAt: null, hiddenReason: null })
          .where(
            and(eq(chatMessages.id, messageId), eq(chatMessages.hiddenReason, 'auto:reports')),
          );
        return;
      }
      await tx
        .update(chatMessages)
        .set({ deletedAt: new Date(), deletedBy: moderatorId })
        .where(eq(chatMessages.id, messageId));
    });

    if (action !== 'dismiss') {
      this.broadcaster.messageRemoved(message.roomId, String(messageId), 'deleted');
    }
    if (action === 'remove_and_mute') {
      await this.mute(message.userId, durationHours);
    }
    if (action === 'remove_and_ban') {
      await this.ban(message.userId, durationHours);
    }
  }

  async searchUsers(query: string | undefined, limit: number) {
    const pattern = query ? `%${query.replace(/[%_]/g, '\\$&')}%` : undefined;
    return this.db
      .select({
        id: users.id,
        kind: users.kind,
        role: users.role,
        displayName: users.displayName,
        email: users.email,
        emailVerifiedAt: users.emailVerifiedAt,
        chatMutedUntil: users.chatMutedUntil,
        bannedUntil: users.bannedUntil,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(
        pattern
          ? or(
              ilike(users.email, pattern),
              ilike(users.displayName, pattern),
              sql`${users.id}::text = ${query}`,
            )
          : eq(users.kind, 'registered'),
      )
      .orderBy(desc(users.createdAt))
      .limit(limit);
  }

  async mute(userId: string, hours: number): Promise<void> {
    await this.updateUser(userId, { chatMutedUntil: new Date(Date.now() + hours * 3_600_000) });
  }

  /** Suspends the account: sessions are revoked and their messages vanish from open clients. */
  async ban(userId: string, hours: number): Promise<void> {
    await this.updateUser(userId, { bannedUntil: new Date(Date.now() + hours * 3_600_000) });
    await this.tokens.revokeAllForUser(userId);
    await this.db
      .update(chatMessages)
      .set({ hiddenAt: new Date(), hiddenReason: 'ban' })
      .where(and(eq(chatMessages.userId, userId), sql`${chatMessages.hiddenAt} IS NULL`));
    this.broadcaster.userRemoved(userId);
  }

  async unban(userId: string): Promise<void> {
    await this.updateUser(userId, { bannedUntil: null, chatMutedUntil: null });
    await this.db
      .update(chatMessages)
      .set({ hiddenAt: null, hiddenReason: null })
      .where(and(eq(chatMessages.userId, userId), eq(chatMessages.hiddenReason, 'ban')));
  }

  async setRole(
    actorId: string,
    userId: string,
    role: 'user' | 'moderator' | 'admin',
  ): Promise<void> {
    if (actorId === userId) {
      throw AppError.badRequest('VALIDATION_FAILED', 'You cannot change your own role');
    }
    const [target] = await this.db.select().from(users).where(eq(users.id, userId));
    if (!target) {
      throw AppError.notFound('User');
    }
    if (role !== 'user' && target.kind !== 'registered') {
      throw AppError.badRequest('VALIDATION_FAILED', 'Only registered accounts can be staff');
    }
    await this.updateUser(userId, { role });
    // Role is a token claim: force a fresh login so it takes effect everywhere.
    await this.tokens.revokeAllForUser(userId);
  }

  async updateRoom(
    roomId: string,
    patch: { slowModeSeconds?: number; isActive?: boolean; name?: string; description?: string },
  ) {
    const [room] = await this.db
      .update(chatRooms)
      .set(patch)
      .where(eq(chatRooms.id, roomId))
      .returning();
    if (!room) {
      throw AppError.notFound('Room');
    }
    return room;
  }

  async createRoom(input: {
    id: string;
    name: string;
    description?: string;
    language?: string;
    slowModeSeconds?: number;
  }) {
    const [room] = await this.db.insert(chatRooms).values(input).onConflictDoNothing().returning();
    if (!room) {
      throw AppError.conflict('CONFLICT', 'A room with this id already exists');
    }
    return room;
  }

  private async updateUser(
    userId: string,
    patch: Partial<typeof users.$inferInsert>,
  ): Promise<void> {
    const updated = await this.db
      .update(users)
      .set(patch)
      .where(eq(users.id, userId))
      .returning({ id: users.id });
    if (updated.length === 0) {
      throw AppError.notFound('User');
    }
  }
}

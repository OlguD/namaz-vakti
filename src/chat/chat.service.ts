import { HttpStatus, Injectable } from '@nestjs/common';
import { and, asc, countDistinct, desc, eq, isNull, lt, notInArray } from 'drizzle-orm';
import type { Redis } from 'ioredis';
import { assertRegistered } from '../auth/auth.guard.js';
import type { AuthUser } from '../auth/auth.decorators.js';
import { AppError } from '../common/errors.js';
import { type Database, InjectDb } from '../db/database.module.js';
import { chatMessages, chatReports, chatRooms, userBlocks, users } from '../db/schema/index.js';
import { ModerationService } from '../moderation/moderation.service.js';
import { tidyMessage } from '../moderation/text-filter.js';
import { InjectRedis } from '../redis/redis.module.js';
import { UsersService } from '../users/users.service.js';

export const MAX_MESSAGE_LENGTH = 500;
/** Distinct reporters after which a message is hidden pending moderator review. */
export const AUTO_HIDE_REPORTS = 3;
const BURST_LIMIT = 5;
const BURST_WINDOW_SECONDS = 10;

export interface MessageView {
  id: string;
  roomId: string;
  body: string;
  createdAt: string;
  author: { id: string; displayName: string };
}

export type ReportReason = (typeof chatReports.$inferInsert)['reason'];

@Injectable()
export class ChatService {
  constructor(
    @InjectDb() private readonly db: Database,
    @InjectRedis() private readonly redis: Redis,
    private readonly users: UsersService,
    private readonly moderation: ModerationService,
  ) {}

  rooms() {
    return this.db
      .select({
        id: chatRooms.id,
        name: chatRooms.name,
        description: chatRooms.description,
        language: chatRooms.language,
        slowModeSeconds: chatRooms.slowModeSeconds,
      })
      .from(chatRooms)
      .where(eq(chatRooms.isActive, true))
      .orderBy(asc(chatRooms.sortOrder));
  }

  async requireRoom(roomId: string) {
    const [room] = await this.db
      .select()
      .from(chatRooms)
      .where(and(eq(chatRooms.id, roomId), eq(chatRooms.isActive, true)));
    if (!room) {
      throw AppError.notFound('Room');
    }
    return room;
  }

  /** Newest `limit` messages before `beforeId`, returned oldest-first; blocked authors removed. */
  async history(
    roomId: string,
    viewerId: string | undefined,
    beforeId?: number,
    limit = 50,
  ): Promise<MessageView[]> {
    await this.requireRoom(roomId);
    const blocked = viewerId ? await this.blockedIds(viewerId) : [];
    const rows = await this.db
      .select({
        id: chatMessages.id,
        roomId: chatMessages.roomId,
        body: chatMessages.body,
        createdAt: chatMessages.createdAt,
        authorId: users.id,
        authorName: users.displayName,
      })
      .from(chatMessages)
      .innerJoin(users, eq(users.id, chatMessages.userId))
      .where(
        and(
          eq(chatMessages.roomId, roomId),
          isNull(chatMessages.deletedAt),
          isNull(chatMessages.hiddenAt),
          beforeId ? lt(chatMessages.id, beforeId) : undefined,
          blocked.length > 0 ? notInArray(chatMessages.userId, blocked) : undefined,
        ),
      )
      .orderBy(desc(chatMessages.id))
      .limit(limit);
    return rows.reverse().map(toView);
  }

  async send(
    caller: AuthUser,
    roomId: string,
    rawBody: string,
    clientMessageId?: string,
  ): Promise<MessageView> {
    assertRegistered(caller);
    const user = await this.users.getOrThrow(caller.id);
    this.users.assertNotBanned(user);
    if (user.chatMutedUntil && user.chatMutedUntil.getTime() > Date.now()) {
      throw new AppError('CHAT_MUTED', 'You are muted in chat', HttpStatus.FORBIDDEN, {
        until: user.chatMutedUntil.toISOString(),
      });
    }
    if (!user.displayName) {
      throw AppError.badRequest('DISPLAY_NAME_REQUIRED', 'Choose a display name before chatting');
    }
    const room = await this.requireRoom(roomId);

    const body = tidyMessage(rawBody);
    if (body.length === 0 || body.length > MAX_MESSAGE_LENGTH) {
      throw AppError.badRequest(
        'VALIDATION_FAILED',
        `Messages must be 1–${MAX_MESSAGE_LENGTH} characters`,
      );
    }

    if (clientMessageId) {
      const existing = await this.findByClientId(user.id, clientMessageId);
      if (existing) {
        return existing;
      }
    }

    await this.enforceRates(user.id, room.id, room.slowModeSeconds, body);

    const verdict = await this.moderation.check(body);
    if (!verdict.allowed) {
      throw AppError.badRequest(
        'MESSAGE_REJECTED',
        'This message does not follow the community rules',
        {
          reason: verdict.reason,
        },
      );
    }

    const [row] = await this.db
      .insert(chatMessages)
      .values({ roomId: room.id, userId: user.id, body, clientMessageId: clientMessageId ?? null })
      .onConflictDoNothing()
      .returning();
    if (!row) {
      // Lost a race with a retry carrying the same clientMessageId.
      const existing = clientMessageId
        ? await this.findByClientId(user.id, clientMessageId)
        : undefined;
      if (existing) {
        return existing;
      }
      throw new AppError(
        'INTERNAL',
        'Message could not be stored',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
    return toView({ ...row, authorId: user.id, authorName: user.displayName });
  }

  /** Authors delete their own messages; moderators and admins delete any. Returns the room. */
  async delete(caller: AuthUser, messageId: number): Promise<{ roomId: string }> {
    const [message] = await this.db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.id, messageId));
    if (!message || message.deletedAt) {
      throw AppError.notFound('Message');
    }
    const isStaff = caller.role === 'moderator' || caller.role === 'admin';
    if (message.userId !== caller.id && !isStaff) {
      throw AppError.forbidden('You can only delete your own messages');
    }
    await this.db
      .update(chatMessages)
      .set({ deletedAt: new Date(), deletedBy: caller.id })
      .where(eq(chatMessages.id, messageId));
    return { roomId: message.roomId };
  }

  /**
   * Any signed-in user (anonymous included — they can read) may report. Reaching
   * AUTO_HIDE_REPORTS distinct reporters hides the message until a moderator acts.
   */
  async report(
    caller: AuthUser,
    messageId: number,
    reason: ReportReason,
    note?: string,
  ): Promise<{ hidden: boolean; roomId: string }> {
    const [message] = await this.db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.id, messageId));
    if (!message || message.deletedAt) {
      throw AppError.notFound('Message');
    }
    if (message.userId === caller.id) {
      throw AppError.badRequest('VALIDATION_FAILED', 'You cannot report your own message');
    }
    await this.db
      .insert(chatReports)
      .values({ messageId, reporterId: caller.id, reason, note: note?.slice(0, 500) ?? null })
      .onConflictDoNothing();

    const [{ reporters } = { reporters: 0 }] = await this.db
      .select({ reporters: countDistinct(chatReports.reporterId) })
      .from(chatReports)
      .where(and(eq(chatReports.messageId, messageId), eq(chatReports.status, 'open')));

    if (reporters >= AUTO_HIDE_REPORTS && !message.hiddenAt) {
      await this.db
        .update(chatMessages)
        .set({ hiddenAt: new Date(), hiddenReason: 'auto:reports' })
        .where(eq(chatMessages.id, messageId));
      return { hidden: true, roomId: message.roomId };
    }
    return { hidden: Boolean(message.hiddenAt), roomId: message.roomId };
  }

  async block(blockerId: string, blockedId: string): Promise<void> {
    if (blockerId === blockedId) {
      throw AppError.badRequest('VALIDATION_FAILED', 'You cannot block yourself');
    }
    const target = await this.users.findById(blockedId);
    if (!target) {
      throw AppError.notFound('User');
    }
    await this.db.insert(userBlocks).values({ blockerId, blockedId }).onConflictDoNothing();
  }

  async unblock(blockerId: string, blockedId: string): Promise<void> {
    await this.db
      .delete(userBlocks)
      .where(and(eq(userBlocks.blockerId, blockerId), eq(userBlocks.blockedId, blockedId)));
  }

  async listBlocks(blockerId: string) {
    return this.db
      .select({ id: users.id, displayName: users.displayName, blockedAt: userBlocks.createdAt })
      .from(userBlocks)
      .innerJoin(users, eq(users.id, userBlocks.blockedId))
      .where(eq(userBlocks.blockerId, blockerId))
      .orderBy(desc(userBlocks.createdAt));
  }

  async blockedIds(blockerId: string): Promise<string[]> {
    const rows = await this.db
      .select({ id: userBlocks.blockedId })
      .from(userBlocks)
      .where(eq(userBlocks.blockerId, blockerId));
    return rows.map((row) => row.id);
  }

  private async findByClientId(
    userId: string,
    clientMessageId: string,
  ): Promise<MessageView | undefined> {
    const [row] = await this.db
      .select({
        id: chatMessages.id,
        roomId: chatMessages.roomId,
        body: chatMessages.body,
        createdAt: chatMessages.createdAt,
        authorId: users.id,
        authorName: users.displayName,
      })
      .from(chatMessages)
      .innerJoin(users, eq(users.id, chatMessages.userId))
      .where(
        and(eq(chatMessages.userId, userId), eq(chatMessages.clientMessageId, clientMessageId)),
      );
    return row ? toView(row) : undefined;
  }

  /** Burst limit, per-room slow mode and a repeat-message guard, all in Redis. */
  private async enforceRates(
    userId: string,
    roomId: string,
    slowModeSeconds: number,
    body: string,
  ): Promise<void> {
    const burstKey = `chat:burst:${userId}`;
    const [[, burst]] = (await this.redis
      .multi()
      .incr(burstKey)
      .expire(burstKey, BURST_WINDOW_SECONDS, 'NX')
      .exec()) as [[null, number], [null, number]];
    if (burst > BURST_LIMIT) {
      throw slowMode(await this.redis.ttl(burstKey));
    }

    if (slowModeSeconds > 0) {
      const set = await this.redis.set(
        `chat:slow:${roomId}:${userId}`,
        '1',
        'EX',
        slowModeSeconds,
        'NX',
      );
      if (set !== 'OK') {
        throw slowMode(await this.redis.ttl(`chat:slow:${roomId}:${userId}`));
      }
    }

    const fingerprint = body.toLocaleLowerCase('tr-TR').replace(/\s+/g, ' ');
    const repeatKey = `chat:last:${userId}`;
    const previous = await this.redis.getset(repeatKey, fingerprint);
    await this.redis.expire(repeatKey, 60);
    if (previous === fingerprint) {
      throw AppError.badRequest('MESSAGE_REJECTED', 'You already sent this message', {
        reason: 'duplicate',
      });
    }
  }
}

function slowMode(retryAfterSeconds: number): AppError {
  return new AppError(
    'SLOW_MODE',
    'You are sending messages too quickly',
    HttpStatus.TOO_MANY_REQUESTS,
    {
      retryAfterSeconds: Math.max(1, retryAfterSeconds),
    },
  );
}

function toView(row: {
  id: number;
  roomId: string;
  body: string;
  createdAt: Date;
  authorId: string;
  authorName: string | null;
}): MessageView {
  return {
    id: String(row.id),
    roomId: row.roomId,
    body: row.body,
    createdAt: row.createdAt.toISOString(),
    author: { id: row.authorId, displayName: row.authorName ?? 'Kullanıcı' },
  };
}

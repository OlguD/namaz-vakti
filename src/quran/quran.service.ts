import { HttpStatus, Injectable } from '@nestjs/common';
import { and, asc, count, eq, ne, sql } from 'drizzle-orm';
import { randomBytes } from 'node:crypto';
import { AppError } from '../common/errors.js';
import { type Database, InjectDb, type Tx } from '../db/database.module.js';
import {
  groupHatimJuz,
  groupHatimMembers,
  groupHatims,
  quranProgress,
  quranReadingDays,
  users,
} from '../db/schema/index.js';
import { assertFutureDate, assertUserDate } from '../worship/day.js';

export const PAGES_PER_JUZ = 20;
export const TOTAL_PAGES = 30 * PAGES_PER_JUZ;
const MAX_MEMBERS = 60;
const MAX_TAKEN_PER_MEMBER = 5;
const MAX_GROUPS_PER_USER = 30;
/** No look-alike characters, so codes survive being read aloud or typed. */
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function inviteCode(length = 8): string {
  const bytes = randomBytes(length);
  let code = '';
  for (const byte of bytes) {
    code += CODE_ALPHABET[byte % CODE_ALPHABET.length];
  }
  return code;
}

export function initials(name: string | null): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return '?';
  }
  return ((parts[0]![0] ?? '') + (parts[1]?.[0] ?? '')).toLocaleUpperCase('tr-TR');
}

/** Moves a (juz, page) position forward by `pages`, wrapping into new khatms. */
export function advance(
  juz: number,
  page: number,
  pages: number,
): { juz: number; page: number; khatms: number } {
  const position = juz * PAGES_PER_JUZ + page + pages;
  const khatms = Math.floor(position / TOTAL_PAGES);
  const inKhatm = position % TOTAL_PAGES;
  return { juz: Math.floor(inKhatm / PAGES_PER_JUZ), page: inKhatm % PAGES_PER_JUZ, khatms };
}

@Injectable()
export class QuranService {
  constructor(@InjectDb() private readonly db: Database) {}

  // ---- personal khatm ------------------------------------------------------

  async progress(userId: string, today?: string) {
    const [row] = await this.db
      .select()
      .from(quranProgress)
      .where(eq(quranProgress.userId, userId));
    return toProgressView(row, today);
  }

  async setProgress(
    userId: string,
    input: { juz: number; page: number; targetDate?: string | null },
  ) {
    if (input.targetDate) {
      assertFutureDate(input.targetDate, 'targetDate');
    }
    const values = {
      juz: input.juz,
      page: input.juz === 30 ? 0 : input.page,
      targetDate: input.targetDate ?? null,
    };
    const [row] = await this.db
      .insert(quranProgress)
      .values({ userId, ...values })
      .onConflictDoUpdate({
        target: quranProgress.userId,
        set: { ...values, updatedAt: new Date() },
      })
      .returning();
    return toProgressView(row);
  }

  /** "I read N pages today": advances the position and records the day. */
  async read(userId: string, pages: number, date: string) {
    assertUserDate(date);
    return this.db.transaction(async (tx) => {
      const [current] = await tx
        .select()
        .from(quranProgress)
        .where(eq(quranProgress.userId, userId))
        .for('update');
      const next = advance(current?.juz ?? 0, current?.page ?? 0, pages);
      const values = {
        juz: next.juz,
        page: next.page,
        completedKhatms: (current?.completedKhatms ?? 0) + next.khatms,
        updatedAt: new Date(),
      };
      const [row] = current
        ? await tx
            .update(quranProgress)
            .set(values)
            .where(eq(quranProgress.userId, userId))
            .returning()
        : await tx
            .insert(quranProgress)
            .values({ userId, ...values })
            .returning();
      await tx
        .insert(quranReadingDays)
        .values({ userId, date, pages })
        .onConflictDoUpdate({
          target: [quranReadingDays.userId, quranReadingDays.date],
          set: { pages: sql`${quranReadingDays.pages} + excluded.pages` },
        });
      return { ...toProgressView(row, date), khatmCompleted: next.khatms > 0 };
    });
  }

  // ---- group khatm ----------------------------------------------------------

  async myGroups(userId: string) {
    const rows = await this.db
      .select({
        id: groupHatims.id,
        name: groupHatims.name,
        round: groupHatims.round,
        completedRounds: groupHatims.completedRounds,
        targetDate: groupHatims.targetDate,
        role: groupHatimMembers.role,
        members: sql<number>`(SELECT count(*)::int FROM ${groupHatimMembers} m WHERE m.hatim_id = ${groupHatims.id})`,
        read: sql<number>`(SELECT count(*)::int FROM ${groupHatimJuz} j WHERE j.hatim_id = ${groupHatims.id} AND j.status = 'read')`,
        taken: sql<number>`(SELECT count(*)::int FROM ${groupHatimJuz} j WHERE j.hatim_id = ${groupHatims.id} AND j.status = 'taken')`,
        mine: sql<
          number[]
        >`(SELECT coalesce(array_agg(j.juz ORDER BY j.juz), '{}') FROM ${groupHatimJuz} j WHERE j.hatim_id = ${groupHatims.id} AND j.status = 'taken' AND j.user_id = ${userId})`,
      })
      .from(groupHatimMembers)
      .innerJoin(groupHatims, eq(groupHatims.id, groupHatimMembers.hatimId))
      .where(eq(groupHatimMembers.userId, userId))
      .orderBy(asc(groupHatims.createdAt));
    return rows.map((row) => ({ ...row, open: 30 - row.read - row.taken, myJuz: row.mine }));
  }

  async create(userId: string, name: string, targetDate: string | null) {
    if (targetDate) {
      assertFutureDate(targetDate, 'targetDate');
    }
    await this.requireDisplayName(userId);
    const groups = await this.db.$count(groupHatimMembers, eq(groupHatimMembers.userId, userId));
    if (groups >= MAX_GROUPS_PER_USER) {
      throw AppError.badRequest(
        'VALIDATION_FAILED',
        `You can be in at most ${MAX_GROUPS_PER_USER} group khatms`,
      );
    }
    const id = await this.db.transaction(async (tx) => {
      const [hatim] = await tx
        .insert(groupHatims)
        .values({ name: name.trim(), ownerId: userId, inviteCode: inviteCode(), targetDate })
        .returning({ id: groupHatims.id });
      await tx.insert(groupHatimMembers).values({ hatimId: hatim!.id, userId, role: 'owner' });
      await tx
        .insert(groupHatimJuz)
        .values(Array.from({ length: 30 }, (_, i) => ({ hatimId: hatim!.id, juz: i + 1 })));
      return hatim!.id;
    });
    return this.detail(userId, id);
  }

  async detail(userId: string, hatimId: string) {
    const hatim = await this.requireMember(userId, hatimId);
    const [members, juz] = await Promise.all([
      this.db
        .select({
          id: users.id,
          displayName: users.displayName,
          role: groupHatimMembers.role,
          joinedAt: groupHatimMembers.joinedAt,
        })
        .from(groupHatimMembers)
        .innerJoin(users, eq(users.id, groupHatimMembers.userId))
        .where(eq(groupHatimMembers.hatimId, hatimId))
        .orderBy(asc(groupHatimMembers.joinedAt)),
      this.db
        .select({
          juz: groupHatimJuz.juz,
          status: groupHatimJuz.status,
          userId: groupHatimJuz.userId,
          displayName: users.displayName,
        })
        .from(groupHatimJuz)
        .leftJoin(users, eq(users.id, groupHatimJuz.userId))
        .where(eq(groupHatimJuz.hatimId, hatimId))
        .orderBy(asc(groupHatimJuz.juz)),
    ]);
    const counts = { open: 0, taken: 0, read: 0 };
    for (const row of juz) {
      counts[row.status] += 1;
    }
    return {
      id: hatim.id,
      name: hatim.name,
      round: hatim.round,
      completedRounds: hatim.completedRounds,
      targetDate: hatim.targetDate,
      inviteCode: hatim.inviteCode,
      isOwner: hatim.ownerId === userId,
      counts,
      members: members.map((member) => ({
        id: member.id,
        displayName: member.displayName,
        initials: initials(member.displayName),
        role: member.role,
        isMe: member.id === userId,
      })),
      juz: juz.map((row) => ({
        juz: row.juz,
        status: row.status,
        holder: row.userId
          ? {
              id: row.userId,
              displayName: row.displayName,
              initials: initials(row.displayName),
              isMe: row.userId === userId,
            }
          : null,
      })),
    };
  }

  /** Joining is idempotent: an existing member just gets the group back. */
  async join(userId: string, code: string) {
    await this.requireDisplayName(userId);
    const [hatim] = await this.db
      .select()
      .from(groupHatims)
      .where(eq(groupHatims.inviteCode, code.trim().toUpperCase()));
    if (!hatim) {
      throw AppError.notFound('Group khatm');
    }
    await this.db.transaction(async (tx) => {
      // Serialise joins per group so the member limit cannot be overshot.
      await tx.execute(sql`SELECT 1 FROM ${groupHatims} WHERE id = ${hatim.id} FOR UPDATE`);
      const [{ members } = { members: 0 }] = await tx
        .select({ members: count() })
        .from(groupHatimMembers)
        .where(eq(groupHatimMembers.hatimId, hatim.id));
      const [already] = await tx
        .select()
        .from(groupHatimMembers)
        .where(and(eq(groupHatimMembers.hatimId, hatim.id), eq(groupHatimMembers.userId, userId)));
      if (already) {
        return;
      }
      if (members >= MAX_MEMBERS) {
        throw AppError.badRequest(
          'VALIDATION_FAILED',
          `A group khatm can have at most ${MAX_MEMBERS} members`,
        );
      }
      await tx.insert(groupHatimMembers).values({ hatimId: hatim.id, userId });
    });
    return this.detail(userId, hatim.id);
  }

  /**
   * Claims a juz. The status check is part of the UPDATE itself, so when two
   * people tap the same juz at once exactly one wins and the other gets 409.
   */
  async take(userId: string, hatimId: string, juz: number | 'next') {
    await this.requireMember(userId, hatimId);
    const taken = await this.db.$count(
      groupHatimJuz,
      and(
        eq(groupHatimJuz.hatimId, hatimId),
        eq(groupHatimJuz.userId, userId),
        eq(groupHatimJuz.status, 'taken'),
      ),
    );
    if (taken >= MAX_TAKEN_PER_MEMBER) {
      throw AppError.badRequest(
        'VALIDATION_FAILED',
        `Finish a juz first; you can hold at most ${MAX_TAKEN_PER_MEMBER}`,
      );
    }
    const target =
      juz === 'next'
        ? sql`(SELECT juz FROM ${groupHatimJuz} WHERE hatim_id = ${hatimId} AND status = 'open' ORDER BY juz LIMIT 1 FOR UPDATE SKIP LOCKED)`
        : sql`${juz}`;
    const updated = await this.db
      .update(groupHatimJuz)
      .set({ status: 'taken', userId, takenAt: new Date(), readAt: null })
      .where(
        and(
          eq(groupHatimJuz.hatimId, hatimId),
          sql`${groupHatimJuz.juz} = ${target}`,
          eq(groupHatimJuz.status, 'open'),
        ),
      )
      .returning({ juz: groupHatimJuz.juz });
    if (updated.length === 0) {
      throw new AppError(
        'CONFLICT',
        juz === 'next' ? 'Every juz has already been taken' : 'This juz has already been taken',
        HttpStatus.CONFLICT,
      );
    }
    return this.detail(userId, hatimId);
  }

  /** The holder (or the owner) marks a juz read; the round completes at 30/30. */
  async markRead(userId: string, hatimId: string, juz: number) {
    const hatim = await this.requireMember(userId, hatimId);
    await this.db.transaction(async (tx) => {
      const updated = await tx
        .update(groupHatimJuz)
        .set({ status: 'read', readAt: new Date() })
        .where(
          and(
            eq(groupHatimJuz.hatimId, hatimId),
            eq(groupHatimJuz.juz, juz),
            eq(groupHatimJuz.status, 'taken'),
            hatim.ownerId === userId ? undefined : eq(groupHatimJuz.userId, userId),
          ),
        )
        .returning({ juz: groupHatimJuz.juz });
      if (updated.length === 0) {
        throw new AppError(
          'CONFLICT',
          'Only the person holding this juz can mark it read',
          HttpStatus.CONFLICT,
        );
      }
      await this.completeRoundIfDone(tx, hatimId);
    });
    return this.detail(userId, hatimId);
  }

  /** Gives a taken juz back to the pool (holder or owner). */
  async release(userId: string, hatimId: string, juz: number) {
    const hatim = await this.requireMember(userId, hatimId);
    const updated = await this.db
      .update(groupHatimJuz)
      .set({ status: 'open', userId: null, takenAt: null })
      .where(
        and(
          eq(groupHatimJuz.hatimId, hatimId),
          eq(groupHatimJuz.juz, juz),
          eq(groupHatimJuz.status, 'taken'),
          hatim.ownerId === userId ? undefined : eq(groupHatimJuz.userId, userId),
        ),
      )
      .returning({ juz: groupHatimJuz.juz });
    if (updated.length === 0) {
      throw new AppError('CONFLICT', 'You are not holding this juz', HttpStatus.CONFLICT);
    }
    return this.detail(userId, hatimId);
  }

  /** Owner starts the next round once everything is read. */
  async newRound(userId: string, hatimId: string) {
    const hatim = await this.requireOwner(userId, hatimId);
    const [{ unread } = { unread: 0 }] = await this.db
      .select({ unread: count() })
      .from(groupHatimJuz)
      .where(and(eq(groupHatimJuz.hatimId, hatimId), ne(groupHatimJuz.status, 'read')));
    if (unread > 0) {
      throw AppError.badRequest('VALIDATION_FAILED', 'All 30 juz must be read before a new round');
    }
    await this.db.transaction(async (tx) => {
      await tx
        .update(groupHatimJuz)
        .set({ status: 'open', userId: null, takenAt: null, readAt: null })
        .where(eq(groupHatimJuz.hatimId, hatimId));
      await tx
        .update(groupHatims)
        .set({ round: hatim.round + 1 })
        .where(eq(groupHatims.id, hatimId));
    });
    return this.detail(userId, hatimId);
  }

  async update(
    userId: string,
    hatimId: string,
    patch: { name?: string; targetDate?: string | null },
  ) {
    await this.requireOwner(userId, hatimId);
    if (patch.targetDate) {
      assertFutureDate(patch.targetDate, 'targetDate');
    }
    await this.db
      .update(groupHatims)
      .set({
        ...(patch.name ? { name: patch.name.trim() } : {}),
        ...(patch.targetDate !== undefined ? { targetDate: patch.targetDate } : {}),
      })
      .where(eq(groupHatims.id, hatimId));
    return this.detail(userId, hatimId);
  }

  /** Invalidates old invite links (e.g. one leaked to the wrong chat). */
  async rotateInvite(userId: string, hatimId: string) {
    await this.requireOwner(userId, hatimId);
    await this.db
      .update(groupHatims)
      .set({ inviteCode: inviteCode() })
      .where(eq(groupHatims.id, hatimId));
    return this.detail(userId, hatimId);
  }

  /**
   * Leaving hands back any juz the member still holds. When the owner leaves,
   * the longest-standing member becomes owner; the last one out deletes the group.
   */
  async leave(userId: string, hatimId: string): Promise<void> {
    await this.requireMember(userId, hatimId);
    await this.removeMember(hatimId, userId);
  }

  async kick(ownerId: string, hatimId: string, memberId: string) {
    await this.requireOwner(ownerId, hatimId);
    if (memberId === ownerId) {
      throw AppError.badRequest('VALIDATION_FAILED', 'Use leave to remove yourself');
    }
    await this.removeMember(hatimId, memberId);
    return this.detail(ownerId, hatimId);
  }

  async remove(userId: string, hatimId: string): Promise<void> {
    await this.requireOwner(userId, hatimId);
    await this.db.delete(groupHatims).where(eq(groupHatims.id, hatimId));
  }

  private async removeMember(hatimId: string, memberId: string): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx.execute(sql`SELECT 1 FROM ${groupHatims} WHERE id = ${hatimId} FOR UPDATE`);
      await tx
        .update(groupHatimJuz)
        .set({ status: 'open', userId: null, takenAt: null })
        .where(
          and(
            eq(groupHatimJuz.hatimId, hatimId),
            eq(groupHatimJuz.userId, memberId),
            eq(groupHatimJuz.status, 'taken'),
          ),
        );
      const removed = await tx
        .delete(groupHatimMembers)
        .where(and(eq(groupHatimMembers.hatimId, hatimId), eq(groupHatimMembers.userId, memberId)))
        .returning({ role: groupHatimMembers.role });
      if (removed.length === 0) {
        throw AppError.notFound('Member');
      }
      if (removed[0]!.role !== 'owner') {
        return;
      }
      const [successor] = await tx
        .select({ userId: groupHatimMembers.userId })
        .from(groupHatimMembers)
        .where(eq(groupHatimMembers.hatimId, hatimId))
        .orderBy(asc(groupHatimMembers.joinedAt))
        .limit(1);
      if (!successor) {
        await tx.delete(groupHatims).where(eq(groupHatims.id, hatimId));
        return;
      }
      await tx
        .update(groupHatimMembers)
        .set({ role: 'owner' })
        .where(
          and(
            eq(groupHatimMembers.hatimId, hatimId),
            eq(groupHatimMembers.userId, successor.userId),
          ),
        );
      await tx
        .update(groupHatims)
        .set({ ownerId: successor.userId })
        .where(eq(groupHatims.id, hatimId));
    });
  }

  private async completeRoundIfDone(tx: Tx, hatimId: string): Promise<void> {
    const [{ unread } = { unread: 0 }] = await tx
      .select({ unread: count() })
      .from(groupHatimJuz)
      .where(and(eq(groupHatimJuz.hatimId, hatimId), ne(groupHatimJuz.status, 'read')));
    if (unread === 0) {
      await tx
        .update(groupHatims)
        .set({ completedRounds: sql`${groupHatims.completedRounds} + 1` })
        .where(eq(groupHatims.id, hatimId));
    }
  }

  /** Non-members get 404, not 403, so group ids cannot be probed. */
  private async requireMember(userId: string, hatimId: string) {
    const [row] = await this.db
      .select({ hatim: groupHatims })
      .from(groupHatims)
      .innerJoin(
        groupHatimMembers,
        and(eq(groupHatimMembers.hatimId, groupHatims.id), eq(groupHatimMembers.userId, userId)),
      )
      .where(eq(groupHatims.id, hatimId));
    if (!row) {
      throw AppError.notFound('Group khatm');
    }
    return row.hatim;
  }

  private async requireOwner(userId: string, hatimId: string) {
    const hatim = await this.requireMember(userId, hatimId);
    if (hatim.ownerId !== userId) {
      throw AppError.forbidden('Only the group owner can do this');
    }
    return hatim;
  }

  private async requireDisplayName(userId: string): Promise<void> {
    const [user] = await this.db
      .select({ name: users.displayName })
      .from(users)
      .where(eq(users.id, userId));
    if (!user?.name) {
      throw AppError.badRequest('DISPLAY_NAME_REQUIRED', 'Choose a display name first');
    }
  }
}

function toProgressView(row: typeof quranProgress.$inferSelect | undefined, today?: string) {
  const juz = row?.juz ?? 0;
  const page = row?.page ?? 0;
  const pagesLeft = Math.max(0, TOTAL_PAGES - juz * PAGES_PER_JUZ - page);
  let pagesPerDay: number | null = null;
  if (row?.targetDate && today) {
    // Days left including today; a past target means "all of it today".
    const days = Math.round((Date.parse(row.targetDate) - Date.parse(today)) / 86_400_000) + 1;
    pagesPerDay = days > 0 ? Math.ceil(pagesLeft / days) : pagesLeft;
  }
  return {
    juz,
    page,
    currentJuz: Math.min(30, juz + 1),
    completedKhatms: row?.completedKhatms ?? 0,
    targetDate: row?.targetDate ?? null,
    pagesLeft,
    pagesPerDay,
    percent: Math.round(((juz * PAGES_PER_JUZ + page) / TOTAL_PAGES) * 100),
  };
}

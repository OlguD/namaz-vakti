import { describe, expect, it } from '@jest/globals';
import {
  avatarSlot,
  buildRows,
  cooldownLeft,
  dayLabel,
  dropLocal,
  initials,
  isArabicText,
  mergeMessages,
  muteLeftLabel,
  newestId,
  oldestId,
  removeAuthor,
  retryAfter,
  updateLocal,
} from './messages';
import type { ChatMessage, ServerMessage } from './types';

const ME = 'me-1';
const srv = (id: number, author = 'u2', body = `m${id}`, createdAt = '2026-11-04T11:00:00Z'): ServerMessage => ({
  id: String(id),
  roomId: 'genel',
  body,
  createdAt,
  author: { id: author, displayName: author === ME ? 'Ben' : 'Ömer F.' },
});
const pending = (clientId: string, body: string): ChatMessage => ({
  id: `local-${clientId}`,
  roomId: 'genel',
  body,
  createdAt: '2026-11-04T11:05:00Z',
  author: { id: ME, displayName: 'Ben' },
  status: 'sending',
  clientId,
});

describe('mergeMessages', () => {
  it('orders by id and ignores duplicates', () => {
    const list = mergeMessages([], [srv(3), srv(1), srv(2)]);
    expect(list.map((m) => m.id)).toEqual(['1', '2', '3']);
    const again = mergeMessages(list, [srv(2), srv(4)]);
    expect(again.map((m) => m.id)).toEqual(['1', '2', '3', '4']);
  });

  it('prepends an older history page', () => {
    const list = mergeMessages([], [srv(10), srv(11)]);
    expect(mergeMessages(list, [srv(8), srv(9)]).map((m) => m.id)).toEqual(['8', '9', '10', '11']);
  });

  it('keeps optimistic messages last until confirmed', () => {
    let list = mergeMessages([], [srv(1)]);
    list = [...list, pending('c1', 'selam')];
    list = mergeMessages(list, [srv(2)]);
    expect(list.map((m) => m.id)).toEqual(['1', '2', 'local-c1']);
  });

  it('replaces the pending copy on ack (by clientId)', () => {
    let list = [...mergeMessages([], [srv(1)]), pending('c1', 'selam')];
    list = mergeMessages(list, [srv(5, ME, 'selam')], { myId: ME, clientId: 'c1' });
    expect(list.map((m) => [m.id, m.status, m.clientId])).toEqual([
      ['1', 'sent', undefined],
      ['5', 'sent', 'c1'],
    ]);
  });

  it('replaces the pending copy when the broadcast beats the ack, then ignores the ack', () => {
    let list = [pending('c1', 'selam   dostlar')];
    list = mergeMessages(list, [srv(7, ME, 'selam dostlar')], { myId: ME });
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ id: '7', status: 'sent', clientId: 'c1' });
    list = mergeMessages(list, [srv(7, ME, 'selam dostlar')], { myId: ME, clientId: 'c1' });
    expect(list).toHaveLength(1);
  });

  it('does not swallow a rejected message with the same text', () => {
    const rejected: ChatMessage = { ...pending('c9', 'aynı'), status: 'rejected' };
    const list = mergeMessages([rejected], [srv(3, ME, 'aynı')], { myId: ME });
    expect(list.map((m) => m.status)).toEqual(['sent', 'rejected']);
  });
});

describe('list helpers', () => {
  it('updates, drops and filters', () => {
    const list = [...mergeMessages([], [srv(1), srv(2, 'blocked')]), pending('c1', 'x')];
    expect(updateLocal(list, 'c1', { status: 'queued' })[2]!.status).toBe('queued');
    expect(dropLocal(list, 'c1')).toHaveLength(2);
    expect(removeAuthor(list, 'blocked').map((m) => m.id)).toEqual(['1', 'local-c1']);
    expect(oldestId(list)).toBe(1);
    expect(newestId(list)).toBe(2);
  });
});

describe('presentation', () => {
  it('makes initials', () => {
    expect(initials('Ömer F.')).toBe('ÖF');
    expect(initials('ayşe')).toBe('AY');
    expect(initials('يوسف')).toBe('ي');
    expect(initials('')).toBe('?');
  });

  it('detects Arabic', () => {
    expect(isArabicText('السلام عليكم ورحمة الله')).toBe(true);
    expect(isArabicText('Selamün aleyküm')).toBe(false);
    expect(isArabicText('Elhamdülillah الحمد لله ama çoğu Türkçe cümle')).toBe(false);
  });

  it('labels days', () => {
    const now = new Date(2026, 10, 4, 15, 0);
    expect(dayLabel(new Date(2026, 10, 4, 9).toISOString(), now)).toBe('Bugün');
    expect(dayLabel(new Date(2026, 10, 3, 21).toISOString(), now)).toBe('Dün');
    expect(dayLabel(new Date(2026, 9, 28, 21).toISOString(), now)).toBe('28 Ekim');
    expect(dayLabel(new Date(2025, 9, 28, 21).toISOString(), now)).toBe('28 Ekim 2025');
  });

  it('groups bubbles and inserts day separators', () => {
    const y = new Date(2026, 10, 3, 21).toISOString();
    const t = new Date(2026, 10, 4, 14).toISOString();
    const list = mergeMessages([], [srv(1, 'a', 'x', y), srv(2, 'a', 'y', t), srv(3, 'a', 'z', t), srv(4, ME, 'w', t)]);
    const rows = buildRows(list, ME, new Date(2026, 10, 4, 15));
    expect(rows.map((r) => (r.kind === 'day' ? r.label : `${r.msg.id}:${r.joinPrev ? 1 : 0}${r.joinNext ? 1 : 0}${r.own ? 'o' : ''}`))).toEqual([
      'Dün',
      '1:00',
      'Bugün',
      '2:01',
      '3:10',
      '4:00o',
    ]);
  });

  it('gives stable avatar slots', () => {
    expect(avatarSlot('abc')).toBe(avatarSlot('abc'));
    expect([0, 1, 2]).toContain(avatarSlot('some-uuid'));
  });
});

describe('slow mode and mute', () => {
  it('counts down', () => {
    expect(cooldownLeft(null)).toBe(0);
    expect(cooldownLeft(10_500, 8_000)).toBe(3);
    expect(cooldownLeft(5_000, 8_000)).toBe(0);
  });

  it('reads retryAfterSeconds', () => {
    expect(retryAfter({ retryAfterSeconds: 4 }, 5)).toBe(4);
    expect(retryAfter(undefined, 5)).toBe(5);
    expect(retryAfter({}, 0)).toBe(1);
  });

  it('formats mute time left', () => {
    const now = new Date('2026-11-04T12:00:00Z');
    expect(muteLeftLabel('2026-11-05T06:42:00Z', now)).toBe('18 sa 42 dk');
    expect(muteLeftLabel('2026-11-04T12:12:00Z', now)).toBe('12 dk');
    expect(muteLeftLabel('2026-11-07T14:00:00Z', now)).toBe('3 gün 2 sa');
    expect(muteLeftLabel('2026-11-04T11:00:00Z', now)).toBeNull();
    expect(muteLeftLabel(null, now)).toBeNull();
  });
});

import { describe, expect, it } from '@jest/globals';
import { applyPrayerMark, estimateQada, NEXT_STATUS, type PrayerLogRange } from './api';
import { nextCount } from './catalog';
import { addTaps, EMPTY_QUEUE, takeBatch, unsyncedForDate } from './dhikrQueue';
import { fmtNum, rangeLabel, startedToday } from './util';

describe('dhikr queue', () => {
  it('accumulates taps per day and key', () => {
    let q = addTaps(EMPTY_QUEUE, '2026-11-04', 'subhanallah');
    q = addTaps(q, '2026-11-04', 'subhanallah', 2);
    q = addTaps(q, '2026-11-03', 'custom:abc', 5);
    expect(q.pending).toEqual({ '2026-11-04|subhanallah': 3, '2026-11-03|custom:abc': 5 });
    expect(unsyncedForDate(q, '2026-11-04')).toBe(3);
  });

  it('moves pending taps into one batch and keeps a batch in flight until it is cleared', () => {
    let q = addTaps(EMPTY_QUEUE, '2026-11-04', 'tevhid', 4);
    q = takeBatch(q, 'dz-1');
    expect(q.pending).toEqual({});
    expect(q.inflight).toEqual({ batchId: 'dz-1', entries: [{ date: '2026-11-04', dhikrKey: 'tevhid', count: 4 }] });
    // New taps wait; the same batch (same id) is retried first.
    q = addTaps(q, '2026-11-04', 'tevhid', 1);
    expect(takeBatch(q, 'dz-2').inflight?.batchId).toBe('dz-1');
    expect(unsyncedForDate(q, '2026-11-04', 'tevhid')).toBe(5);
  });

  it('caps a batch at 200 entries', () => {
    let q = EMPTY_QUEUE;
    for (let i = 0; i < 250; i++) q = addTaps(q, '2026-11-04', `custom:${i}`);
    q = takeBatch(q, 'dz-big');
    expect(q.inflight?.entries).toHaveLength(200);
    expect(Object.keys(q.pending)).toHaveLength(50);
  });
});

describe('zikirmatik counting', () => {
  it('completes at the target and starts a new tour on the next tap', () => {
    expect(nextCount(32, 1, 33)).toEqual({ count: 33, tours: 1, completed: true });
    expect(nextCount(33, 1, 33)).toEqual({ count: 1, tours: 2, completed: false });
  });
});

describe('qada estimate', () => {
  it('matches the API formula', () => {
    expect(estimateQada({ birthYear: 1992, pubertyAge: 15, regularSince: 2016, prayedPercent: 25 })).toEqual({
      perVakit: 2464,
      total: 2464 * 6,
      fromYear: 2007,
      years: 9,
    });
    expect(estimateQada({ birthYear: 2000, pubertyAge: 15, regularSince: 2010, prayedPercent: 0 }).perVakit).toBe(0);
  });
});

describe('prayer log', () => {
  const log: PrayerLogRange = {
    from: '2026-11-03',
    to: '2026-11-04',
    days: [
      { date: '2026-11-03', sabah: 'prayed', ogle: 'jamaah', ikindi: null, aksam: 'qada', yatsi: null },
      { date: '2026-11-04', sabah: null, ogle: null, ikindi: null, aksam: null, yatsi: null },
    ],
    totals: { done: 2, jamaah: 1, qada: 1 },
  };

  it('recomputes totals after a mark', () => {
    const next = applyPrayerMark(log, '2026-11-04', 'sabah', 'jamaah');
    expect(next.days[1]!.sabah).toBe('jamaah');
    expect(next.totals).toEqual({ done: 3, jamaah: 2, qada: 1 });
  });

  it('cycles empty → prayed → jamaah → qada → empty', () => {
    expect(NEXT_STATUS.none).toBe('prayed');
    expect(NEXT_STATUS.prayed).toBe('jamaah');
    expect(NEXT_STATUS.jamaah).toBe('qada');
    expect(NEXT_STATUS.qada).toBeNull();
  });

  it('counts only the prayers whose time has come', () => {
    const day = {
      date: '2026-11-04',
      times: { imsak: '06:05', gunes: '07:31', ogle: '12:53', ikindi: '15:37', aksam: '18:04', yatsi: '19:25' },
      instants: {
        imsak: '2026-11-04T03:05:00.000Z',
        gunes: '2026-11-04T04:31:00.000Z',
        ogle: '2026-11-04T09:53:00.000Z',
        ikindi: '2026-11-04T12:37:00.000Z',
        aksam: '2026-11-04T15:04:00.000Z',
        yatsi: '2026-11-04T16:25:00.000Z',
      },
    };
    expect([...startedToday(day, new Date('2026-11-04T11:00:00Z'))]).toEqual(['sabah', 'ogle']);
    expect(startedToday(null, new Date()).size).toBe(5);
  });
});

describe('formatting', () => {
  it('uses Turkish thousands separators and ranges', () => {
    expect(fmtNum(1284)).toBe('1.284');
    expect(fmtNum(48210)).toBe('48.210');
    expect(fmtNum(12)).toBe('12');
    expect(rangeLabel('2026-10-29', '2026-11-04')).toBe('29 Ekim – 4 Kasım');
    expect(rangeLabel('2026-11-01', '2026-11-07')).toBe('1 – 7 Kasım');
  });
});

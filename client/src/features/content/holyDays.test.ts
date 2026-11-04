import { describe, expect, it } from '@jest/globals';
import { countdownParts, groupHolyDays, hijriDayMonth, nextEvent, type ReligiousDayRow } from './holyDays';

const row = (date: string, key: string, nameTr: string, hijri: string | null = null, hijriYear = 1448): ReligiousDayRow => ({
  id: `${key}-${date}`,
  date,
  key,
  hijriYear,
  nameTr,
  nameEn: null,
  hijri,
  note: null,
  source: 'auto',
});

const ROWS = [
  row('2026-12-10', 'regaip-kandili', 'Regaip Kandili', '1 Recep 1448'),
  row('2026-12-10', 'uc-aylar-baslangici', 'Üç Ayların Başlangıcı', '1 Recep 1448'),
  row('2027-01-04', 'mirac-kandili', 'Miraç Kandili', '26 Recep 1448'),
  row('2027-03-08', 'ramazan-bayrami-arefe', 'Ramazan Bayramı Arefesi', 'Ramazan sonu 1448'),
  row('2027-03-09', 'ramazan-bayrami-1', 'Ramazan Bayramı 1. Gün', '1 Şevval 1448'),
  row('2027-03-10', 'ramazan-bayrami-2', 'Ramazan Bayramı 2. Gün', '2 Şevval 1448'),
  row('2027-03-11', 'ramazan-bayrami-3', 'Ramazan Bayramı 3. Gün', '3 Şevval 1448'),
  row('2027-06-06', 'hicri-yilbasi', 'Hicrî Yılbaşı', '1 Muharrem 1449', 1449),
];

describe('groupHolyDays', () => {
  const events = groupHolyDays(ROWS);

  it('merges a bayram into one event with its arefe and length', () => {
    const b = events.find((e) => e.key === 'ramazan-bayrami')!;
    expect(b).toMatchObject({ name: 'Ramazan Bayramı', date: '2027-03-09', days: 3, arefe: '2027-03-08', kind: 'bayram', hijri: '1 Şevval 1448' });
  });

  it('folds same-day markers into the main event', () => {
    expect(events.map((e) => e.key)).toEqual(['regaip-kandili', 'mirac-kandili', 'ramazan-bayrami', 'hicri-yilbasi']);
    expect(events[0]).toMatchObject({ alsoMarks: 'Üç Ayların Başlangıcı', kind: 'night' });
  });

  it('keeps a lone marker as its own event', () => {
    const solo = groupHolyDays([row('2027-11-29', 'uc-aylar-baslangici', 'Üç Ayların Başlangıcı', '1 Recep 1449', 1449)]);
    expect(solo).toHaveLength(1);
  });
});

describe('nextEvent', () => {
  const events = groupHolyDays(ROWS);
  it('picks the first event not yet over', () => {
    expect(nextEvent(events, new Date(2026, 10, 4, 13))?.key).toBe('regaip-kandili');
    // During the kandil night it is still the current event.
    expect(nextEvent(events, new Date(2026, 11, 10, 23))?.key).toBe('regaip-kandili');
    expect(nextEvent(events, new Date(2026, 11, 11, 9))?.key).toBe('mirac-kandili');
    // Bayram stays current through its last day.
    expect(nextEvent(events, new Date(2027, 2, 11, 20))?.key).toBe('ramazan-bayrami');
  });
});

describe('helpers', () => {
  it('splits a countdown', () => {
    expect(countdownParts(new Date(2026, 11, 10, 18), new Date(2026, 10, 4, 13, 8))).toEqual({ days: 36, hours: 4, minutes: 52 });
    expect(countdownParts(new Date(0), new Date())).toEqual({ days: 0, hours: 0, minutes: 0 });
  });
  it('drops the hijri year', () => {
    expect(hijriDayMonth('26 Recep 1448')).toBe('26 Recep');
    expect(hijriDayMonth(null)).toBeNull();
  });
});

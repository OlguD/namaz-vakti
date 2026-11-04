import { generateReligiousDays } from './religious-days.js';

/**
 * Month starts consistent with Diyanet's published calendar: every holy day
 * below was checked against Diyanet's 2025–2027 "Dini Günler" lists.
 */
const STARTS_1447 = {
  1: '2025-06-26',
  3: '2025-08-24',
  7: '2025-12-21',
  8: '2026-01-20',
  9: '2026-02-19',
  10: '2026-03-20',
  12: '2026-05-18',
};

const STARTS_1448_PART = {
  7: '2026-12-10',
  8: '2027-01-09',
  9: '2027-02-08',
  10: '2027-03-09',
};

const byKey = (days: ReturnType<typeof generateReligiousDays>) =>
  Object.fromEntries(days.map((day) => [day.key, day.date]));

describe('generateReligiousDays', () => {
  it('reproduces Diyanet’s 1447 (2025–2026) list', () => {
    expect(byKey(generateReligiousDays(1447, STARTS_1447))).toEqual({
      'hicri-yilbasi': '2025-06-26',
      'asure-gunu': '2025-07-05',
      'mevlid-kandili': '2025-09-03',
      'uc-aylar-baslangici': '2025-12-21',
      'regaip-kandili': '2025-12-25',
      'mirac-kandili': '2026-01-15',
      'berat-kandili': '2026-02-02',
      'ramazan-baslangici': '2026-02-19',
      'kadir-gecesi': '2026-03-16',
      'ramazan-bayrami-arefe': '2026-03-19',
      'ramazan-bayrami-1': '2026-03-20',
      'ramazan-bayrami-2': '2026-03-21',
      'ramazan-bayrami-3': '2026-03-22',
      'kurban-bayrami-arefe': '2026-05-26',
      'kurban-bayrami-1': '2026-05-27',
      'kurban-bayrami-2': '2026-05-28',
      'kurban-bayrami-3': '2026-05-29',
      'kurban-bayrami-4': '2026-05-30',
    });
  });

  it('reproduces Diyanet’s announced 1448 (2026–2027) dates', () => {
    const days = byKey(generateReligiousDays(1448, STARTS_1448_PART));
    expect(days).toMatchObject({
      'uc-aylar-baslangici': '2026-12-10',
      // 1 Recep 1448 is a Thursday, so Regaip falls on the same evening.
      'regaip-kandili': '2026-12-10',
      'mirac-kandili': '2027-01-04',
      'berat-kandili': '2027-01-22',
      'ramazan-baslangici': '2027-02-08',
      'kadir-gecesi': '2027-03-05',
      'ramazan-bayrami-arefe': '2027-03-08',
      'ramazan-bayrami-1': '2027-03-09',
    });
    // Months without a known start produce nothing rather than guesses.
    expect(days['kurban-bayrami-1']).toBeUndefined();
  });

  it('labels kandils with the hijri date of the evening', () => {
    const days = generateReligiousDays(1447, STARTS_1447);
    const mirac = days.find((day) => day.key === 'mirac-kandili')!;
    const regaip = days.find((day) => day.key === 'regaip-kandili')!;
    expect(mirac.hijri).toBe('26 Recep 1447');
    expect(regaip.hijri).toBe('5 Recep 1447');
  });
});

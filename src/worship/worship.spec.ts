import { customDhikrId } from './dhikr-catalog.js';
import { streakLength } from './day.js';
import { estimateQada } from './qada.js';

describe('streakLength', () => {
  const days = (...list: string[]) => new Set(list);

  it('counts consecutive days ending today', () => {
    expect(streakLength(days('2026-11-02', '2026-11-03', '2026-11-04'), '2026-11-04')).toBe(3);
  });

  it('keeps yesterday’s streak alive until today ends', () => {
    expect(streakLength(days('2026-11-02', '2026-11-03'), '2026-11-04')).toBe(2);
  });

  it('stops at a gap and handles month boundaries', () => {
    expect(
      streakLength(days('2026-10-30', '2026-10-31', '2026-11-01', '2026-10-28'), '2026-11-01'),
    ).toBe(3);
    expect(streakLength(days(), '2026-11-04')).toBe(0);
  });
});

describe('estimateQada', () => {
  it('matches the wizard example (born 1992, puberty 15, regular since 2016, 25% prayed)', () => {
    expect(
      estimateQada({ birthYear: 1992, pubertyAge: 15, regularSince: 2016, prayedPercent: 25 }),
    ).toEqual({
      fromYear: 2007,
      years: 9,
      perVakit: 2464,
      total: 14_784,
    });
  });

  it('never goes negative', () => {
    expect(
      estimateQada({ birthYear: 2000, pubertyAge: 15, regularSince: 2010, prayedPercent: 0 })
        .perVakit,
    ).toBe(0);
  });
});

describe('customDhikrId', () => {
  it('extracts ids only from well-formed keys', () => {
    expect(customDhikrId('custom:3f2b8e1c-0d4a-4c5e-9f7a-1b2c3d4e5f60')).toBe(
      '3f2b8e1c-0d4a-4c5e-9f7a-1b2c3d4e5f60',
    );
    expect(customDhikrId('subhanallah')).toBeUndefined();
    expect(customDhikrId("custom:1' or 1=1")).toBeUndefined();
  });
});

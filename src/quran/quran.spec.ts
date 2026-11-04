import { advance, initials, inviteCode } from './quran.service.js';

describe('advance', () => {
  it('moves within a juz and across juz', () => {
    expect(advance(0, 0, 4)).toEqual({ juz: 0, page: 4, khatms: 0 });
    expect(advance(11, 18, 4)).toEqual({ juz: 12, page: 2, khatms: 0 });
  });

  it('wraps into a new khatm after 600 pages', () => {
    expect(advance(29, 19, 1)).toEqual({ juz: 0, page: 0, khatms: 1 });
    expect(advance(29, 10, 615)).toEqual({ juz: 0, page: 5, khatms: 2 });
  });
});

describe('initials', () => {
  it('uses up to two words with Turkish casing', () => {
    expect(initials('ahmet yılmaz')).toBe('AY');
    expect(initials('İsmail')).toBe('İ');
    expect(initials('  ')).toBe('?');
    expect(initials(null)).toBe('?');
  });
});

describe('inviteCode', () => {
  it('uses an unambiguous alphabet', () => {
    for (let i = 0; i < 200; i += 1) {
      expect(inviteCode()).toMatch(/^[A-HJ-NP-Z2-9]{8}$/);
    }
  });
});

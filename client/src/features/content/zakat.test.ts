import { describe, expect, it } from '@jest/globals';
import { computeZakat, EMPTY_INPUTS, formatTry, parseAmount } from './zakat';

describe('parseAmount', () => {
  it.each([
    ['120.000', 120000],
    ['1.250,50', 1250.5],
    ['40,5', 40.5],
    ['40.5', 40.5],
    ['1.234.567', 1234567],
    ['5474.36', 5474.36],
    [' 15 000 ₺', 15000],
    ['', 0],
    ['abc', 0],
    ['-50', 0],
  ])('%s → %d', (raw, expected) => {
    expect(parseAmount(raw)).toBeCloseTo(expected, 6);
  });
});

describe('formatTry', () => {
  it('groups thousands with dots', () => {
    expect(formatTry(438934.18)).toBe('438.934');
    expect(formatTry(1250.5, 2)).toBe('1.250,50');
    expect(formatTry(-25000)).toBe('−25.000');
    expect(formatTry(0)).toBe('0');
  });
});

describe('computeZakat', () => {
  const base = { ...EMPTY_INPUTS, goldPrice: '3000', silverPrice: '38' };

  it('is due above nisab: 2.5% of net assets', () => {
    const r = computeZakat(
      { ...base, cash: '120.000', gold: '40', fx: '20.000', recv: '15.000', debt: '25.000' },
      80.18,
    );
    expect(r.parts.gold).toBe(120000);
    expect(r.net).toBe(250000);
    expect(r.nisab).toBeCloseTo(240540);
    expect(r.due).toBe(true);
    expect(r.zakat).toBeCloseTo(6250);
  });

  it('is not due below nisab', () => {
    const r = computeZakat({ ...base, cash: '90.000', gold: '20', fx: '15.000', debt: '10.000' }, 80.18);
    expect(r.net).toBe(155000);
    expect(r.due).toBe(false);
    expect(r.zakat).toBe(0);
  });

  it('counts exactly-at-nisab as due', () => {
    const r = computeZakat({ ...base, gold: '80,18' }, 80.18);
    expect(r.due).toBe(true);
  });

  it('cannot decide without a gold price', () => {
    const r = computeZakat({ ...EMPTY_INPUTS, cash: '1.000.000' }, 80.18);
    expect(r.nisab).toBeNull();
    expect(r.due).toBe(false);
  });

  it('debts larger than assets give a negative net and no zakat', () => {
    const r = computeZakat({ ...base, cash: '10.000', debt: '50.000' }, 80.18);
    expect(r.net).toBe(-40000);
    expect(r.zakat).toBe(0);
  });
});

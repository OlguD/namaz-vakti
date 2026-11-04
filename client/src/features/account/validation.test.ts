import { describe, expect, it } from '@jest/globals';
import { initials, isEmail, nameError, passwordStrength } from './validation';

describe('account validation', () => {
  it('scores passwords like the design', () => {
    expect(passwordStrength('')).toBe(0);
    expect(passwordStrength('abc1')).toBe(1);
    expect(passwordStrength('abcdefgh')).toBe(1);
    expect(passwordStrength('gece-vakti7')).toBe(2);
    expect(passwordStrength('gece-vakti-77!')).toBe(3);
  });

  it('checks e-mail and name rules', () => {
    expect(isEmail('ahmet@ornek.com')).toBe(true);
    expect(isEmail('ahmet@ornek')).toBe(false);
    expect(nameError('Al')).toMatch(/En az 3/);
    expect(nameError('Ahmet')).toBeNull();
    expect(nameError('x'.repeat(25))).toMatch(/En fazla/);
  });

  it('builds Turkish initials', () => {
    expect(initials('ahmet yılmaz')).toBe('AY');
    expect(initials('ismail')).toBe('İ');
    expect(initials('')).toBe('?');
  });
});

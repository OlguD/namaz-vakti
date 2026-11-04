/** Client-side checks that mirror the API's validation rules (auth/dto.ts). */

export const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
export const NAME_MIN = 3;
export const NAME_MAX = 24;
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;

export function isEmail(s: string): boolean {
  return EMAIL_RE.test(s.trim());
}

export function nameError(name: string): string | null {
  const n = name.trim();
  if (!n) return null;
  if (n.length < NAME_MIN) return `En az ${NAME_MIN} karakter olmalı.`;
  if (n.length > NAME_MAX) return `En fazla ${NAME_MAX} karakter olabilir.`;
  return null;
}

export type Strength = 0 | 1 | 2 | 3;

/** 0 empty · 1 weak (blocked) · 2 good · 3 strong — same scale as the design. */
export function passwordStrength(pw: string): Strength {
  if (!pw) return 0;
  if (pw.length < PASSWORD_MIN || !/\d/.test(pw)) return 1;
  if (pw.length >= 12 && /[^A-Za-z0-9]/.test(pw)) return 3;
  return 2;
}

export function strengthLabel(s: Strength): string {
  if (s <= 1) return `Zayıf · en az ${PASSWORD_MIN} karakter ve bir rakam gerekli`;
  if (s === 2) return 'İyi · daha uzun bir şifre daha güvenli';
  return 'Güçlü şifre';
}

/** "Ahmet Yılmaz" → "AY", "" → "?" */
export function initials(name: string | null | undefined): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return ((parts[0]![0] ?? '') + (parts[1]?.[0] ?? '')).toLocaleUpperCase('tr');
}

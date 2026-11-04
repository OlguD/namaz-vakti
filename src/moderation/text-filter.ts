import { PROFANITY, RESERVED_NAMES } from './wordlist.js';

const FOLD: Record<string, string> = {
  ç: 'c',
  ğ: 'g',
  ı: 'i',
  i̇: 'i',
  ö: 'o',
  ş: 's',
  ü: 'u',
  â: 'a',
  î: 'i',
  û: 'u',
  '0': 'o',
  '1': 'i',
  '3': 'e',
  '4': 'a',
  '5': 's',
  '7': 't',
  '@': 'a',
  $: 's',
  '€': 'e',
};

const exactSet = new Set<string>(PROFANITY.exact);

/**
 * Lower-cases with Turkish rules, folds diacritics and common leetspeak, and
 * collapses repeated letters, so "S1KT1RRR" and "sıktir" both become "siktir".
 */
export function normalize(text: string): string {
  const lowered = text.toLocaleLowerCase('tr-TR').normalize('NFC');
  let folded = '';
  for (const char of lowered) {
    folded += FOLD[char] ?? char;
  }
  return folded.replace(/(\p{L})\1+/gu, '$1');
}

export function words(normalized: string): string[] {
  return normalized.split(/[^\p{L}]+/u).filter(Boolean);
}

export function containsProfanity(text: string): boolean {
  const normalized = normalize(text);
  for (const word of words(normalized)) {
    if (exactSet.has(word)) {
      return true;
    }
    if (PROFANITY.prefix.some((root) => word.startsWith(root))) {
      return true;
    }
  }
  const compact = normalized.replace(/[^\p{L}]+/gu, '');
  return PROFANITY.compact.some((root) => compact.includes(root));
}

const URL_PATTERN =
  /\b(?:https?:\/\/|www\.)\S+|\b[\p{L}0-9-]{2,}\.(?:com|net|org|io|me|tv|ly|gg|xyz|info|tr|co|app|link|site|online|ru|cn)\b/iu;

export function containsLink(text: string): boolean {
  return URL_PATTERN.test(text);
}

export type DisplayNameProblem = 'length' | 'characters' | 'profanity' | 'reserved';

/** 3–24 chars, letters/digits/space/._-, no profanity, no staff impersonation. */
export function checkDisplayName(name: string): DisplayNameProblem | null {
  const trimmed = name.trim();
  if (trimmed.length < 3 || trimmed.length > 24) {
    return 'length';
  }
  if (!/^[\p{L}\p{N}][\p{L}\p{N} ._-]*$/u.test(trimmed)) {
    return 'characters';
  }
  if (containsProfanity(trimmed)) {
    return 'profanity';
  }
  const compact = normalize(trimmed).replace(/[^\p{L}]+/gu, '');
  if (RESERVED_NAMES.some((reserved) => compact === reserved || compact.startsWith(reserved))) {
    return 'reserved';
  }
  return null;
}

/** Collapses runs of whitespace and blank lines; keeps intentional single newlines. */
export function tidyMessage(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/[^\S\n]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

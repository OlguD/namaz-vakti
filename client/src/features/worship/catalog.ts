import type { Dhikr } from './api';

/**
 * Same built-in dhikrs as the API (src/worship/dhikr-catalog.ts), so the
 * zikirmatik works on first launch offline. The API list wins when loaded.
 */
export const BUILTIN_DHIKRS: Dhikr[] = [
  { key: 'subhanallah', transliteration: 'Sübhânallah', arabic: 'سُبْحَانَ اللّٰهِ', meaning: 'Allah her türlü eksiklikten uzaktır.', target: 33, custom: false },
  { key: 'elhamdulillah', transliteration: 'Elhamdülillah', arabic: 'اَلْحَمْدُ لِلّٰهِ', meaning: 'Hamd yalnızca Allah’a mahsustur.', target: 33, custom: false },
  { key: 'allahuekber', transliteration: 'Allâhu Ekber', arabic: 'اَللّٰهُ أَكْبَرُ', meaning: 'Allah en büyüktür.', target: 33, custom: false },
  { key: 'tevhid', transliteration: 'Lâ ilâhe illallah', arabic: 'لَا إِلٰهَ إِلَّا اللّٰهُ', meaning: 'Allah’tan başka ilah yoktur.', target: 100, custom: false },
  { key: 'estagfirullah', transliteration: 'Estağfirullah', arabic: 'أَسْتَغْفِرُ اللّٰهَ', meaning: 'Allah’tan bağışlanma dilerim.', target: 100, custom: false },
  { key: 'salavat', transliteration: 'Salavat', arabic: 'اَللّٰهُمَّ صَلِّ عَلٰى مُحَمَّدٍ', meaning: 'Allah’ım, Hz. Muhammed’e salât eyle.', target: 100, custom: false },
];

export const TARGET_PRESETS = [33, 99, 100] as const;

/** Next count after one tap: wraps to 1 (and a new tour) once the target was reached. */
export function nextCount(count: number, tours: number, target: number): { count: number; tours: number; completed: boolean } {
  if (count >= target) return { count: 1, tours: tours + 1, completed: target === 1 };
  const n = count + 1;
  return { count: n, tours, completed: n >= target };
}

/** Built-in dhikr shown in the zikirmatik. Custom ones are keyed "custom:<uuid>". */
export const BUILTIN_DHIKRS = [
  {
    key: 'subhanallah',
    transliteration: 'Sübhânallah',
    arabic: 'سُبْحَانَ اللّٰهِ',
    meaning: 'Allah her türlü eksiklikten uzaktır.',
    target: 33,
  },
  {
    key: 'elhamdulillah',
    transliteration: 'Elhamdülillah',
    arabic: 'اَلْحَمْدُ لِلّٰهِ',
    meaning: 'Hamd yalnızca Allah’a mahsustur.',
    target: 33,
  },
  {
    key: 'allahuekber',
    transliteration: 'Allâhu Ekber',
    arabic: 'اَللّٰهُ أَكْبَرُ',
    meaning: 'Allah en büyüktür.',
    target: 33,
  },
  {
    key: 'tevhid',
    transliteration: 'Lâ ilâhe illallah',
    arabic: 'لَا إِلٰهَ إِلَّا اللّٰهُ',
    meaning: 'Allah’tan başka ilah yoktur.',
    target: 100,
  },
  {
    key: 'estagfirullah',
    transliteration: 'Estağfirullah',
    arabic: 'أَسْتَغْفِرُ اللّٰهَ',
    meaning: 'Allah’tan bağışlanma dilerim.',
    target: 100,
  },
  {
    key: 'salavat',
    transliteration: 'Salavat',
    arabic: 'اَللّٰهُمَّ صَلِّ عَلٰى مُحَمَّدٍ',
    meaning: 'Allah’ım, Hz. Muhammed’e salât eyle.',
    target: 100,
  },
] as const;

export const BUILTIN_KEYS = new Set<string>(BUILTIN_DHIKRS.map((dhikr) => dhikr.key));

const CUSTOM_KEY = /^custom:([0-9a-f-]{36})$/;

export function customDhikrId(key: string): string | undefined {
  return CUSTOM_KEY.exec(key)?.[1];
}

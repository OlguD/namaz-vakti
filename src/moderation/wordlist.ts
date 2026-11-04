/**
 * Profanity roots, written in normalised form (lower-case, Turkish letters folded
 * to ASCII, no repeated letters). See `normalize()` in text-filter.ts.
 *
 * `exact` entries only match a whole word: they are short or overlap with innocent
 * words (e.g. "amin" — amen — must never be caught by "am").
 * `prefix` entries match any word that starts with them ("orospu" → "orospuluk").
 * `compact` entries are also searched for inside the text with spaces and symbols
 * removed, which catches "o.r.o.s.p.u"; only long, unambiguous roots go here.
 *
 * Extend this list from real moderation reports rather than guessing.
 */
export const PROFANITY = {
  exact: [
    'am',
    'ami',
    'amk',
    'amq',
    'aq',
    'mk',
    'oc',
    'sik',
    'sg',
    'siktir',
    'pic',
    'got',
    'yarak',
    'yarrak',
    'dalyarak',
    'kahpe',
    'ibne',
    'gavat',
    'pezevenk',
    'fuck',
    'fck',
    'shit',
    'cunt',
    'dick',
    'bitch',
    'slut',
    'whore',
    'nigger',
    'nigga',
    'fag',
    'faggot',
  ],
  prefix: [
    'amcik',
    'amina',
    'aminak',
    'amini',
    'amk',
    'orospu',
    'orspu',
    'siker',
    'sikim',
    'sikis',
    'sikik',
    'siktir',
    'sikt',
    'yarrag',
    'yarag',
    'pezevenk',
    'kahpe',
    'gotver',
    'gotun',
    'pust',
    'ibnelik',
    'fucking',
    'fucker',
    'motherfuck',
    'bullshit',
    'asshole',
  ],
  compact: ['orospu', 'amcik', 'aminakoy', 'aminakoyim', 'siktir', 'pezevenk', 'motherfuck'],
} as const;

/** Display names that would let someone impersonate staff or the app. */
export const RESERVED_NAMES = [
  'admin',
  'administrator',
  'moderator',
  'mod',
  'yonetici',
  'destek',
  'support',
  'official',
  'resmi',
  'namazvakti',
  'sistem',
  'system',
  'diyanet',
];

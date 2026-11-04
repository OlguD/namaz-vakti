import { z } from 'zod';

const vakitPrefs = z
  .object({
    enabled: z.boolean(),
    remindBeforeMinutes: z.union([
      z.literal(0),
      z.literal(5),
      z.literal(10),
      z.literal(15),
      z.literal(30),
    ]),
    sound: z.enum(['mekke', 'medine', 'istanbul', 'kisa', 'cansesi', 'sessiz']),
  })
  .strict();

const defaultVakit = (enabled: boolean, sound: 'mekke' | 'sessiz' = 'mekke') => ({
  enabled,
  remindBeforeMinutes: 0 as const,
  sound,
});

/**
 * The user's app settings, synced between devices and the web. Unknown keys are
 * rejected so a buggy client cannot grow the document; missing keys fall back
 * to the defaults below, so older clients keep working when fields are added.
 */
export const settingsSchema = z
  .object({
    theme: z.enum(['system', 'dark', 'light']).default('system'),
    language: z.enum(['tr', 'en', 'ar']).default('tr'),
    location: z
      .object({
        mode: z.enum(['auto', 'manual']),
        districtId: z.string().max(32).nullable(),
      })
      .strict()
      .default({ mode: 'auto', districtId: null }),
    prayerNotifications: z
      .object({
        imsak: vakitPrefs,
        gunes: vakitPrefs,
        ogle: vakitPrefs,
        ikindi: vakitPrefs,
        aksam: vakitPrefs,
        yatsi: vakitPrefs,
      })
      .strict()
      .default({
        imsak: defaultVakit(true),
        gunes: defaultVakit(false, 'sessiz'),
        ogle: defaultVakit(true),
        ikindi: defaultVakit(true),
        aksam: defaultVakit(true),
        yatsi: defaultVakit(true),
      }),
    reminders: z
      .object({
        iftar: z.boolean(),
        sahur: z.boolean(),
        haramainLive: z.boolean(),
        dailyQuran: z.boolean(),
        friday: z.boolean(),
      })
      .strict()
      .default({ iftar: true, sahur: true, haramainLive: true, dailyQuran: false, friday: true }),
    /** Per holy-day reminders, keyed by religious day key. */
    holyDayReminders: z.record(z.string().max(64), z.boolean()).default({}),
    favorites: z
      .object({
        duas: z.array(z.string().max(64)).max(300),
        esma: z.array(z.number().int().min(1).max(99)).max(99),
      })
      .strict()
      .default({ duas: [], esma: [] }),
    zikirmatik: z
      .object({
        lastDhikrKey: z.string().max(60).nullable(),
        target: z.number().int().min(1).max(100_000),
        view: z.enum(['ring', 'beads']),
        haptics: z.boolean(),
        nightMode: z.boolean(),
      })
      .strict()
      .default({ lastDhikrKey: null, target: 33, view: 'ring', haptics: true, nightMode: false }),
  })
  .strict();

export type Settings = z.infer<typeof settingsSchema>;

export const DEFAULT_SETTINGS: Settings = settingsSchema.parse({});

/** Max serialized size; far above any legitimate document. */
export const MAX_SETTINGS_BYTES = 32 * 1024;

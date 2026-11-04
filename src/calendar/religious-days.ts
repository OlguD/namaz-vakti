import { addDays } from '../prayer-times/time-utils.js';

/** Hijri months in Diyanet's Turkish spelling, 1 = Muharrem. */
export const HIJRI_MONTHS_TR = [
  'Muharrem',
  'Safer',
  'Rebiülevvel',
  'Rebiülahir',
  'Cemaziyelevvel',
  'Cemaziyelahir',
  'Recep',
  'Şaban',
  'Ramazan',
  'Şevval',
  'Zilkade',
  'Zilhicce',
] as const;

/** Gregorian start date ("YYYY-MM-DD") of each hijri month, keyed 1..12. */
export type MonthStarts = Partial<Record<number, string>>;

export interface GeneratedDay {
  key: string;
  hijriYear: number;
  date: string;
  nameTr: string;
  nameEn: string;
  /** Hijri date of the Gregorian `date` (for kandils, the evening before the holy date). */
  hijri: string;
  note?: string;
}

interface Rule {
  key: string;
  nameTr: string;
  nameEn: string;
  month: number;
  /** Hijri day the occasion belongs to. */
  day: number;
  /**
   * Kandil nights are observed on the evening before the hijri date, so Diyanet
   * lists the previous Gregorian day (e.g. Miraç = 27 Recep → listed on 26 Recep).
   */
  eveBefore?: boolean;
  note?: string;
}

const RULES: Rule[] = [
  { key: 'hicri-yilbasi', nameTr: 'Hicrî Yılbaşı', nameEn: 'Islamic New Year', month: 1, day: 1 },
  { key: 'asure-gunu', nameTr: 'Aşure Günü', nameEn: 'Day of Ashura', month: 1, day: 10 },
  {
    key: 'mevlid-kandili',
    nameTr: 'Mevlid Kandili',
    nameEn: 'Mawlid',
    month: 3,
    day: 12,
    eveBefore: true,
  },
  {
    key: 'uc-aylar-baslangici',
    nameTr: 'Üç Ayların Başlangıcı',
    nameEn: 'Start of the Three Holy Months',
    month: 7,
    day: 1,
  },
  {
    key: 'mirac-kandili',
    nameTr: 'Miraç Kandili',
    nameEn: 'Laylat al-Miraj',
    month: 7,
    day: 27,
    eveBefore: true,
  },
  {
    key: 'berat-kandili',
    nameTr: 'Berat Kandili',
    nameEn: 'Laylat al-Bara’ah',
    month: 8,
    day: 15,
    eveBefore: true,
  },
  {
    key: 'ramazan-baslangici',
    nameTr: 'Ramazan Başlangıcı',
    nameEn: 'First day of Ramadan',
    month: 9,
    day: 1,
  },
  {
    key: 'kadir-gecesi',
    nameTr: 'Kadir Gecesi',
    nameEn: 'Laylat al-Qadr',
    month: 9,
    day: 27,
    eveBefore: true,
  },
  {
    key: 'ramazan-bayrami-arefe',
    nameTr: 'Ramazan Bayramı Arefesi',
    nameEn: 'Eve of Eid al-Fitr',
    month: 10,
    day: 1,
    eveBefore: true,
  },
  {
    key: 'ramazan-bayrami-1',
    nameTr: 'Ramazan Bayramı 1. Gün',
    nameEn: 'Eid al-Fitr, day 1',
    month: 10,
    day: 1,
  },
  {
    key: 'ramazan-bayrami-2',
    nameTr: 'Ramazan Bayramı 2. Gün',
    nameEn: 'Eid al-Fitr, day 2',
    month: 10,
    day: 2,
  },
  {
    key: 'ramazan-bayrami-3',
    nameTr: 'Ramazan Bayramı 3. Gün',
    nameEn: 'Eid al-Fitr, day 3',
    month: 10,
    day: 3,
  },
  {
    key: 'kurban-bayrami-arefe',
    nameTr: 'Kurban Bayramı Arefesi',
    nameEn: 'Day of Arafah',
    month: 12,
    day: 9,
  },
  {
    key: 'kurban-bayrami-1',
    nameTr: 'Kurban Bayramı 1. Gün',
    nameEn: 'Eid al-Adha, day 1',
    month: 12,
    day: 10,
  },
  {
    key: 'kurban-bayrami-2',
    nameTr: 'Kurban Bayramı 2. Gün',
    nameEn: 'Eid al-Adha, day 2',
    month: 12,
    day: 11,
  },
  {
    key: 'kurban-bayrami-3',
    nameTr: 'Kurban Bayramı 3. Gün',
    nameEn: 'Eid al-Adha, day 3',
    month: 12,
    day: 12,
  },
  {
    key: 'kurban-bayrami-4',
    nameTr: 'Kurban Bayramı 4. Gün',
    nameEn: 'Eid al-Adha, day 4',
    month: 12,
    day: 13,
  },
];

function weekday(date: string): number {
  return new Date(`${date}T12:00:00Z`).getUTCDay();
}

/** "26 Recep 1447" */
function label(day: number, month: number, year: number): string {
  return `${day} ${HIJRI_MONTHS_TR[month - 1]} ${year}`;
}

/**
 * Religious days of one hijri year, following Diyanet's conventions. Months
 * whose start is unknown are skipped (their days are simply not generated).
 */
export function generateReligiousDays(hijriYear: number, starts: MonthStarts): GeneratedDay[] {
  const days: GeneratedDay[] = [];

  for (const rule of RULES) {
    const start = starts[rule.month];
    if (!start) {
      continue;
    }
    const holyDate = addDays(start, rule.day - 1);
    const date = rule.eveBefore ? addDays(holyDate, -1) : holyDate;
    // The eve of a month's first day is the last day of the previous month,
    // whose length we may not know, so it is described rather than numbered.
    const hijri = !rule.eveBefore
      ? label(rule.day, rule.month, hijriYear)
      : rule.day > 1
        ? label(rule.day - 1, rule.month, hijriYear)
        : `${HIJRI_MONTHS_TR[rule.month - 2] ?? HIJRI_MONTHS_TR[11]} sonu ${hijriYear}`;
    days.push({
      key: rule.key,
      hijriYear,
      date,
      nameTr: rule.nameTr,
      nameEn: rule.nameEn,
      hijri,
      note: rule.note,
    });
  }

  // Regaip: the night before the first Friday of Recep.
  const recep = starts[7];
  if (recep) {
    let friday = recep;
    while (weekday(friday) !== 5) {
      friday = addDays(friday, 1);
    }
    const date = addDays(friday, -1);
    const dayInRecep = Math.round((Date.parse(date) - Date.parse(recep)) / 86_400_000) + 1;
    days.push({
      key: 'regaip-kandili',
      hijriYear,
      date,
      nameTr: 'Regaip Kandili',
      nameEn: 'Laylat al-Raghaib',
      hijri: dayInRecep >= 1 ? label(dayInRecep, 7, hijriYear) : `Cemaziyelahir sonu ${hijriYear}`,
    });
  }

  return days.sort((a, b) => a.date.localeCompare(b.date) || a.key.localeCompare(b.key));
}

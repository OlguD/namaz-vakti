/**
 * "Günün ayeti" rotation. Short, well-known verses with the Diyanet meal.
 * NOTE: like the dua and esma content, have a qualified person review this
 * list before release (reviewed: false).
 */
export interface Verse {
  arabic: string;
  meaning: string;
  ref: string;
}

export const VERSES_REVIEWED = false;

export const VERSES: Verse[] = [
  { arabic: 'أَلَا بِذِكْرِ اللَّهِ تَطْمَئِنُّ الْقُلُوبُ', meaning: 'Bilesiniz ki kalpler ancak Allah’ı anmakla huzur bulur.', ref: "Ra'd · 28" },
  { arabic: 'فَإِنَّ مَعَ الْعُسْرِ يُسْرًا', meaning: 'Şüphesiz güçlükle beraber bir kolaylık vardır.', ref: 'İnşirah · 5' },
  { arabic: 'فَاذْكُرُونِي أَذْكُرْكُمْ', meaning: 'Öyleyse yalnız beni anın ki ben de sizi anayım.', ref: 'Bakara · 152' },
  { arabic: 'إِنَّ اللَّهَ مَعَ الصَّابِرِينَ', meaning: 'Şüphesiz Allah sabredenlerle beraberdir.', ref: 'Bakara · 153' },
  { arabic: 'لَا يُكَلِّفُ اللَّهُ نَفْسًا إِلَّا وُسْعَهَا', meaning: 'Allah hiç kimseye gücünün yeteceğinden fazlasını yüklemez.', ref: 'Bakara · 286' },
  { arabic: 'وَمَنْ يَتَوَكَّلْ عَلَى اللَّهِ فَهُوَ حَسْبُهُ', meaning: 'Kim Allah’a tevekkül ederse O, ona yeter.', ref: 'Talâk · 3' },
  { arabic: 'لَا تَقْنَطُوا مِنْ رَحْمَةِ اللَّهِ', meaning: 'Allah’ın rahmetinden ümidinizi kesmeyin.', ref: 'Zümer · 53' },
];

/** Same verse all day, a new one each day. */
export function verseOfDay(date: string): Verse {
  const n = date.split('-').reduce((a, p) => a * 31 + Number(p), 7);
  return VERSES[Math.abs(n) % VERSES.length]!;
}

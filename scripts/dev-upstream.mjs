#!/usr/bin/env node
/**
 * DEV ONLY — fake versions of every third-party service the backend talks to, so the
 * API and the apps can be developed (and screenshotted) offline with realistic data.
 *
 *   npm run dev:upstream                 # starts the mock on :4010 (PORT to override)
 *
 * Mocked upstreams (path prefix → env var of the backend):
 *   /emushaf    EMUSHAF_BASE_URL   /ulkeler, /sehirler/:id, /ilceler/:id, /vakitler/:id
 *   /nominatim  NOMINATIM_BASE_URL /search?q=…&format=jsonv2
 *   /overpass   OVERPASS_BASE_URL  /overpass/api/interpreter (POST data=<query>)
 *   /aladhan    ALADHAN_BASE_URL   /v1/hToGCalendar/:month/:year
 *   /tcmb       TCMB_BASE_URL      /kurlar/today.xml
 *   /goldapi    GOLDAPI_BASE_URL   /api/:metal/:currency (any x-access-token)
 *   /youtube    (hard-coded URLs)  /v3/channels, /v3/videos, /feeds/videos.xml
 *
 * The YouTube URLs are constants in src/live/youtube.client.ts, so this same file also
 * works as a preload: `node --import ./scripts/dev-upstream.mjs dist/main.js` patches
 * globalThis.fetch to send googleapis.com/youtube and youtube.com/feeds requests to
 * DEV_UPSTREAM_URL (default http://localhost:4010) and does not start a server.
 *
 * Everything is deterministic (seeded by ids / bounding boxes), except the clock:
 * prayer tables start "today", viewer counts drift, the TCMB bulletin is today's.
 */
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SELF = fileURLToPath(import.meta.url);
const isMain = Boolean(process.argv[1]) && path.resolve(process.argv[1]) === SELF;

// ---------------------------------------------------------------------------
// Preload mode: redirect hard-coded YouTube URLs
// ---------------------------------------------------------------------------

function installFetchRedirect() {
  if (globalThis.__devUpstreamPatched) {
    return;
  }
  globalThis.__devUpstreamPatched = true;
  const base = (process.env.DEV_UPSTREAM_URL || 'http://localhost:4010').replace(/\/$/, '');
  const rules = [
    ['https://www.googleapis.com/youtube/v3/', `${base}/youtube/v3/`],
    ['https://www.youtube.com/feeds/', `${base}/youtube/feeds/`],
  ];
  const original = globalThis.fetch;
  globalThis.fetch = function patchedFetch(input, init) {
    const url =
      typeof input === 'string' ? input : input instanceof URL ? input.href : input?.url ?? '';
    for (const [from, to] of rules) {
      if (url.startsWith(from)) {
        const target = to + url.slice(from.length);
        return original(typeof input === 'string' || input instanceof URL ? target : new Request(target, input), init);
      }
    }
    return original(input, init);
  };
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

const TR_UPPER = (s) => s.toLocaleUpperCase('tr-TR');
/** "Kadıköy" → "KADIKOY" (how Emushaf spells *AdiEn). */
function fold(s) {
  return TR_UPPER(s)
    .replace(/Ç/g, 'C')
    .replace(/Ğ/g, 'G')
    .replace(/[Iİ]/g, 'I')
    .replace(/Ö/g, 'O')
    .replace(/Ş/g, 'S')
    .replace(/Ü/g, 'U')
    .replace(/Â/g, 'A')
    .replace(/Î/g, 'I')
    .replace(/Û/g, 'U')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();
}

function hashString(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function rng(seed) {
  let a = typeof seed === 'number' ? seed : hashString(String(seed));
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gaussian(rand) {
  const u = Math.max(rand(), 1e-9);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand());
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
function b64id(seed, length) {
  const rand = rng(seed);
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += B64[Math.floor(rand() * 64)];
  }
  return out;
}

const pad2 = (n) => String(n).padStart(2, '0');

/** Wall-clock parts of an instant in a zone. */
function zoned(date, timeZone) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
      timeZoneName: 'longOffset',
    })
      .formatToParts(date)
      .map((p) => [p.type, p.value]),
  );
  const off = /GMT([+-])(\d{2}):(\d{2})/.exec(parts.timeZoneName ?? '');
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`,
    offsetHours: off ? (off[1] === '-' ? -1 : 1) * (Number(off[2]) + Number(off[3]) / 60) : 0,
    offset: off ? `${off[1]}${off[2]}:${off[3]}` : '+00:00',
  };
}

function addDays(iso, n) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function weekdayOf(iso) {
  return new Date(`${iso}T12:00:00Z`).getUTCDay();
}

const xmlEscape = (s) =>
  String(s).replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c]);

// ---------------------------------------------------------------------------
// Hijri dates (Umm al-Qura via ICU)
// ---------------------------------------------------------------------------

const HIJRI_MONTHS_TR = [
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
];
const HIJRI_MONTHS_EN = [
  'Muḥarram',
  'Ṣafar',
  'Rabīʿ al-awwal',
  'Rabīʿ al-thānī',
  'Jumādá al-ūlá',
  'Jumādá al-ākhirah',
  'Rajab',
  'Shaʿbān',
  'Ramaḍān',
  'Shawwāl',
  'Dhū al-Qaʿdah',
  'Dhū al-Ḥijjah',
];
const HIJRI_MONTHS_AR = [
  'مُحَرَّم',
  'صَفَر',
  'رَبيع الأوَّل',
  'رَبيع الثاني',
  'جُمادى الأولى',
  'جُمادى الآخرة',
  'رَجَب',
  'شَعْبان',
  'رَمَضان',
  'شَوّال',
  'ذوالقعدة',
  'ذوالحجة',
];
const GREG_MONTHS_TR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
const GREG_MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAYS_TR = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
const WEEKDAYS_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const WEEKDAYS_AR = ['الاحد', 'الاثنين', 'الثلاثاء', 'الاربعاء', 'الخميس', 'الجمعة', 'السبت'];

const hijriFormat = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', {
  day: 'numeric',
  month: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
});

/** Gregorian "YYYY-MM-DD" → { day, month, year } in Umm al-Qura. */
function toHijri(iso) {
  const parts = Object.fromEntries(
    hijriFormat.formatToParts(new Date(`${iso}T12:00:00Z`)).map((p) => [p.type, p.value]),
  );
  return { day: Number(parts.day), month: Number(parts.month), year: Number(parts.year) };
}

/** First Gregorian day and length of a hijri month. */
function hijriMonthSpan(month, year) {
  const epochMs = Date.UTC(622, 6, 16, 12);
  const estimate = new Date(epochMs + ((year - 1) * 354.36667 + (month - 1) * 29.5306) * 86_400_000)
    .toISOString()
    .slice(0, 10);
  for (let i = -25; i <= 25; i += 1) {
    const iso = addDays(estimate, i);
    const h = toHijri(iso);
    if (h.day === 1 && h.month === month && h.year === year) {
      let length = 29;
      if (toHijri(addDays(iso, 29)).month === month) {
        length = 30;
      }
      return { start: iso, length };
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Location directory (Emushaf-style ids; names upper-cased like upstream)
// ---------------------------------------------------------------------------

/** Türkiye: [cityId, name, lat, lng, extraDistricts?]. Ids follow Diyanet's alphabetical 500–580. */
const TR_CITIES = [
  [500, 'Adana', 37.0, 35.3213, [['Seyhan', 36.9914, 35.3308], ['Çukurova', 37.0469, 35.2864], ['Yüreğir', 36.9985, 35.3720], ['Ceyhan', 37.0247, 35.8175]]],
  [501, 'Adıyaman', 37.7648, 38.2786],
  [502, 'Afyonkarahisar', 38.7638, 30.5403],
  [503, 'Ağrı', 39.7191, 43.0503],
  [504, 'Aksaray', 38.3687, 34.037],
  [505, 'Amasya', 40.6499, 35.8353],
  [506, 'Ankara', 39.9334, 32.8597, [['Çankaya', 39.9179, 32.8627], ['Keçiören', 39.9806, 32.8647], ['Yenimahalle', 39.9696, 32.8106], ['Mamak', 39.9301, 32.9112], ['Altındağ', 39.9444, 32.8799], ['Etimesgut', 39.9572, 32.6783], ['Sincan', 39.9697, 32.5834], ['Gölbaşı', 39.7891, 32.8061], ['Polatlı', 39.5842, 32.1472]]],
  [507, 'Antalya', 36.8969, 30.7133, [['Muratpaşa', 36.8841, 30.7056], ['Konyaaltı', 36.8697, 30.6355], ['Kepez', 36.9419, 30.7140], ['Alanya', 36.5444, 31.9954], ['Manavgat', 36.7867, 31.4433], ['Kemer', 36.5978, 30.5603], ['Kaş', 36.2018, 29.6377]]],
  [508, 'Ardahan', 41.1105, 42.7022],
  [509, 'Artvin', 41.1828, 41.8183],
  [510, 'Aydın', 37.856, 27.8416, [['Kuşadası', 37.8579, 27.261], ['Nazilli', 37.9126, 28.3206]]],
  [511, 'Balıkesir', 39.6484, 27.8826, [['Bandırma', 40.3520, 27.9767], ['Edremit', 39.5960, 27.0245]]],
  [512, 'Bartın', 41.6344, 32.3375],
  [513, 'Batman', 37.8812, 41.1351],
  [514, 'Bayburt', 40.2552, 40.2249],
  [515, 'Bilecik', 40.1506, 29.9792],
  [516, 'Bingöl', 38.8847, 40.4939],
  [517, 'Bitlis', 38.4006, 42.1095],
  [518, 'Bolu', 40.735, 31.6061],
  [519, 'Burdur', 37.7203, 30.2908],
  [520, 'Bursa', 40.1885, 29.061, [['Osmangazi', 40.2045, 29.0367], ['Nilüfer', 40.2210, 28.9530], ['Yıldırım', 40.1900, 29.1050], ['İnegöl', 40.0780, 29.5100], ['Gemlik', 40.4310, 29.1560], ['Mudanya', 40.3750, 28.8830]]],
  [521, 'Çanakkale', 40.1553, 26.4142],
  [522, 'Çankırı', 40.6013, 33.6134],
  [523, 'Çorum', 40.5506, 34.9556],
  [524, 'Denizli', 37.7765, 29.0864],
  [525, 'Diyarbakır', 37.9144, 40.2306],
  [526, 'Düzce', 40.8438, 31.1565],
  [527, 'Edirne', 41.6771, 26.5557],
  [528, 'Elazığ', 38.681, 39.2264],
  [529, 'Erzincan', 39.75, 39.5],
  [530, 'Erzurum', 39.9043, 41.2679],
  [531, 'Eskişehir', 39.7767, 30.5206, [['Odunpazarı', 39.7590, 30.5310], ['Tepebaşı', 39.7880, 30.4970]]],
  [532, 'Gaziantep', 37.0662, 37.3833, [['Şahinbey', 37.0500, 37.3700], ['Şehitkamil', 37.0870, 37.3650]]],
  [533, 'Giresun', 40.9128, 38.3895],
  [534, 'Gümüşhane', 40.4386, 39.5086],
  [535, 'Hakkari', 37.5833, 43.7333],
  [536, 'Hatay', 36.2025, 36.1606, [['İskenderun', 36.5872, 36.1735]]],
  [537, 'Iğdır', 39.888, 44.0048],
  [538, 'Isparta', 37.7648, 30.5566],
  [539, 'İstanbul', 41.0082, 28.9784],
  [540, 'İzmir', 38.4237, 27.1428, [['Konak', 38.4189, 27.1287], ['Karşıyaka', 38.4600, 27.1100], ['Bornova', 38.4700, 27.2200], ['Buca', 38.3880, 27.1750], ['Çiğli', 38.4960, 27.0690], ['Bayraklı', 38.4620, 27.1650], ['Karabağlar', 38.3790, 27.1300], ['Menemen', 38.6070, 27.0690], ['Torbalı', 38.1550, 27.3620], ['Çeşme', 38.3230, 26.3030]]],
  [541, 'Kahramanmaraş', 37.5858, 36.9371],
  [542, 'Karabük', 41.2061, 32.6204],
  [543, 'Karaman', 37.1759, 33.2287],
  [544, 'Kars', 40.6013, 43.0975],
  [545, 'Kastamonu', 41.3887, 33.7827],
  [546, 'Kayseri', 38.7205, 35.4826, [['Melikgazi', 38.7300, 35.5000], ['Kocasinan', 38.7400, 35.4700], ['Talas', 38.6900, 35.5550]]],
  [547, 'Kilis', 36.7184, 37.1212],
  [548, 'Kırıkkale', 39.8468, 33.5153],
  [549, 'Kırklareli', 41.7333, 27.2167],
  [550, 'Kırşehir', 39.1425, 34.1709],
  [551, 'Kocaeli', 40.7654, 29.9408, [['İzmit', 40.7660, 29.9170], ['Gebze', 40.8020, 29.4310], ['Gölcük', 40.7170, 29.8200]]],
  [552, 'Konya', 37.8746, 32.4932, [['Selçuklu', 37.9260, 32.4850], ['Meram', 37.8380, 32.4380], ['Karatay', 37.8800, 32.5300], ['Ereğli', 37.5130, 34.0470], ['Akşehir', 38.3570, 31.4160]]],
  [553, 'Kütahya', 39.4167, 29.9833],
  [554, 'Malatya', 38.3552, 38.3095],
  [555, 'Manisa', 38.6191, 27.4289],
  [556, 'Mardin', 37.3212, 40.7245],
  [557, 'Mersin', 36.8121, 34.6415, [['Tarsus', 36.9177, 34.8928]]],
  [558, 'Muğla', 37.2153, 28.3636, [['Bodrum', 37.0344, 27.4305], ['Fethiye', 36.6214, 29.1164], ['Marmaris', 36.855, 28.2742]]],
  [559, 'Muş', 38.9462, 41.7539],
  [560, 'Nevşehir', 38.6939, 34.6857],
  [561, 'Niğde', 37.9667, 34.6833],
  [562, 'Ordu', 40.9839, 37.8764],
  [563, 'Osmaniye', 37.0742, 36.2464],
  [564, 'Rize', 41.0201, 40.5234],
  [565, 'Sakarya', 40.7569, 30.3783],
  [566, 'Samsun', 41.2867, 36.33, [['Atakum', 41.3300, 36.2700], ['İlkadım', 41.2900, 36.3300], ['Bafra', 41.5680, 35.9070]]],
  [567, 'Siirt', 37.9333, 41.95],
  [568, 'Sinop', 42.0231, 35.1531],
  [569, 'Sivas', 39.7477, 37.0179],
  [570, 'Şanlıurfa', 37.1591, 38.7969],
  [571, 'Şırnak', 37.5164, 42.4611],
  [572, 'Tekirdağ', 40.9781, 27.5115, [['Çorlu', 41.1590, 27.8000]]],
  [573, 'Tokat', 40.3167, 36.55],
  [574, 'Trabzon', 41.0027, 39.7168, [['Akçaabat', 41.0210, 39.5710], ['Of', 40.9450, 40.2690]]],
  [575, 'Tunceli', 39.1079, 39.5401],
  [576, 'Uşak', 38.6823, 29.4082],
  [577, 'Van', 38.5012, 43.3729],
  [578, 'Yalova', 40.65, 29.2667],
  [579, 'Yozgat', 39.8181, 34.8147],
  [580, 'Zonguldak', 41.4564, 31.7987],
];

/** İstanbul's districts; the centre ("İSTANBUL") keeps the real id 9541. */
const ISTANBUL_DISTRICTS = [
  ['Adalar', 40.876, 29.091], ['Arnavutköy', 41.1849, 28.7404], ['Ataşehir', 40.9833, 29.1167],
  ['Avcılar', 40.9796, 28.7214], ['Bağcılar', 41.039, 28.8567], ['Bahçelievler', 41.0019, 28.8597],
  ['Bakırköy', 40.9819, 28.8772], ['Başakşehir', 41.0931, 28.802], ['Bayrampaşa', 41.035, 28.912],
  ['Beşiktaş', 41.0422, 29.0083], ['Beykoz', 41.124, 29.108], ['Beylikdüzü', 40.9822, 28.64],
  ['Beyoğlu', 41.037, 28.977], ['Büyükçekmece', 41.02, 28.585], ['Çatalca', 41.1436, 28.461],
  ['Çekmeköy', 41.0333, 29.1833], ['Esenler', 41.043, 28.876], ['Esenyurt', 41.029, 28.672],
  ['Eyüpsultan', 41.048, 28.934], ['Fatih', 41.0186, 28.9397], ['Gaziosmanpaşa', 41.057, 28.915],
  ['Güngören', 41.022, 28.872], ['Kadıköy', 40.991, 29.027], ['Kağıthane', 41.079, 28.973],
  ['Kartal', 40.889, 29.19], ['Küçükçekmece', 41.0, 28.78], ['Maltepe', 40.935, 29.13],
  ['Pendik', 40.877, 29.233], ['Sancaktepe', 41.0, 29.23], ['Sarıyer', 41.167, 29.05],
  ['Silivri', 41.073, 28.246], ['Sultanbeyli', 40.967, 29.267], ['Sultangazi', 41.106, 28.867],
  ['Şile', 41.175, 29.612], ['Şişli', 41.06, 28.987], ['Tuzla', 40.816, 29.3],
  ['Ümraniye', 41.016, 29.124], ['Üsküdar', 41.023, 29.015], ['Zeytinburnu', 40.994, 28.904],
];

/** Other countries: { id, name, nameEn, tz, cities: [[id, name, nameEn, lat, lng, districts[[name, nameEn, lat, lng]]]] } */
const FOREIGN = [
  {
    id: 13, name: 'ALMANYA', nameEn: 'GERMANY', tz: 'Europe/Berlin',
    cities: [
      [11002, 'Berlin', 'BERLIN', 52.52, 13.405, [['Neukölln', 'NEUKOLLN', 52.4811, 13.4353], ['Kreuzberg', 'KREUZBERG', 52.4986, 13.4033], ['Spandau', 'SPANDAU', 52.5352, 13.199], ['Wedding', 'WEDDING', 52.5493, 13.3591]]],
      [11005, 'Köln', 'COLOGNE', 50.9375, 6.9603, [['Bonn', 'BONN', 50.7374, 7.0982], ['Leverkusen', 'LEVERKUSEN', 51.0459, 6.9842], ['Düren', 'DUREN', 50.8045, 6.4924]]],
      [11007, 'Hamburg', 'HAMBURG', 53.5511, 9.9937, [['Harburg', 'HARBURG', 53.4609, 9.9836], ['Wilhelmsburg', 'WILHELMSBURG', 53.4975, 10.0063]]],
      [11011, 'München', 'MUNICH', 48.1351, 11.582, [['Augsburg', 'AUGSBURG', 48.3705, 10.8978]]],
    ],
  },
  {
    id: 23, name: 'HOLLANDA', nameEn: 'NETHERLANDS', tz: 'Europe/Amsterdam',
    cities: [
      [11201, 'Amsterdam', 'AMSTERDAM', 52.3676, 4.9041, [['Zaandam', 'ZAANDAM', 52.442, 4.8292], ['Haarlem', 'HAARLEM', 52.3874, 4.6462]]],
      [11203, 'Rotterdam', 'ROTTERDAM', 51.9244, 4.4777, [['Schiedam', 'SCHIEDAM', 51.9192, 4.3961], ['Dordrecht', 'DORDRECHT', 51.8133, 4.6901]]],
      [11205, 'Lahey', 'THE HAGUE', 52.0705, 4.3007, [['Delft', 'DELFT', 52.0116, 4.3571]]],
    ],
  },
  {
    id: 54, name: 'KUZEY KIBRIS', nameEn: 'NORTHERN CYPRUS', tz: 'Asia/Nicosia',
    cities: [
      [12001, 'Lefkoşa', 'NICOSIA', 35.1856, 33.3823, [['Gönyeli', 'GONYELI', 35.2073, 33.3133], ['Değirmenlik', 'DEGIRMENLIK', 35.2508, 33.4767], ['Hamitköy', 'HAMITKOY', 35.2010, 33.3550]]],
      [12002, 'Girne', 'KYRENIA', 35.3364, 33.3182, [['Alsancak', 'ALSANCAK', 35.341, 33.196], ['Lapta', 'LAPTA', 35.337, 33.165], ['Çatalköy', 'CATALKOY', 35.326, 33.387]]],
      [12003, 'Gazimağusa', 'FAMAGUSTA', 35.1149, 33.9192, [['Akdoğan', 'AKDOGAN', 35.1650, 33.7340], ['Yeni Boğaziçi', 'YENI BOGAZICI', 35.1760, 33.8650]]],
      [12004, 'Güzelyurt', 'MORPHOU', 35.198, 32.9934, [['Lefke', 'LEFKE', 35.1142, 32.85]]],
      [12005, 'İskele', 'ISKELE', 35.2869, 33.892, [['Yeni Erenköy', 'YENI ERENKOY', 35.5390, 34.1920]]],
    ],
  },
  {
    id: 187, name: 'SUUDİ ARABİSTAN', nameEn: 'SAUDI ARABIA', tz: 'Asia/Riyadh',
    cities: [
      [13001, 'Mekke', 'MECCA', 21.4225, 39.8262, []],
      [13002, 'Medine', 'MEDINA', 24.4672, 39.6111, []],
      [13003, 'Riyad', 'RIYADH', 24.7136, 46.6753, []],
      [13004, 'Cidde', 'JEDDAH', 21.4858, 39.1925, []],
    ],
  },
];

function buildDirectory() {
  const countries = [];
  const cityById = new Map();
  const districtById = new Map();

  const addCity = (country, city) => {
    country.cities.push(city);
    city.country = country;
    cityById.set(city.id, city);
    for (const district of city.districts) {
      district.city = city;
      districtById.set(district.id, district);
    }
  };

  const turkey = { id: '2', name: 'TÜRKİYE', nameEn: 'TÜRKİYE', tz: 'Europe/Istanbul', cities: [] };
  countries.push(turkey);
  for (const [cityId, cityName, lat, lng, extra = []] of TR_CITIES) {
    const isIstanbul = cityId === 539;
    const centreId = isIstanbul ? 9541 : 20000 + (cityId - 500) * 20;
    const list = isIstanbul ? ISTANBUL_DISTRICTS : extra;
    const districts = [
      { id: String(centreId), proper: cityName, name: TR_UPPER(cityName), nameEn: fold(cityName), lat, lng, centre: true },
      ...list.map(([name, dLat, dLng], i) => ({
        id: String(isIstanbul ? 9542 + i : centreId + 1 + i),
        proper: name,
        name: TR_UPPER(name),
        nameEn: fold(name),
        lat: dLat,
        lng: dLng,
      })),
    ];
    addCity(turkey, { id: String(cityId), proper: cityName, name: TR_UPPER(cityName), nameEn: fold(cityName), lat, lng, districts });
  }

  let nextDistrictId = 30001;
  for (const def of FOREIGN) {
    const country = { id: String(def.id), name: def.name, nameEn: def.nameEn, tz: def.tz, cities: [] };
    countries.push(country);
    for (const [cityId, proper, nameEn, lat, lng, list] of def.cities) {
      const districts = [
        { id: String(nextDistrictId++), proper, name: TR_UPPER(proper), nameEn, lat, lng, centre: true },
        ...list.map(([dProper, dEn, dLat, dLng]) => ({
          id: String(nextDistrictId++),
          proper: dProper,
          name: TR_UPPER(dProper),
          nameEn: dEn,
          lat: dLat,
          lng: dLng,
        })),
      ];
      addCity(country, { id: String(cityId), proper, name: TR_UPPER(proper), nameEn, lat, lng, districts });
    }
  }
  return { countries, cityById, districtById, allDistricts: [...districtById.values()] };
}

const DIR = buildDirectory();

// ---------------------------------------------------------------------------
// Emushaf
// ---------------------------------------------------------------------------

let adhan; // loaded in startServer()

const KAABA = { lat: 21.422487, lng: 39.826206 };
const rad = Math.PI / 180;

function qiblaBearing(lat, lng) {
  const φ1 = lat * rad;
  const φ2 = KAABA.lat * rad;
  const Δλ = (KAABA.lng - lng) * rad;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (Math.atan2(y, x) / rad + 360) % 360;
}

/** Solar azimuth (degrees clockwise from north), low-precision almanac formulae. */
function solarAzimuth(date, lat, lng) {
  const n = date.getTime() / 86_400_000 + 2440587.5 - 2451545.0;
  const L = (280.46 + 0.9856474 * n) % 360;
  const g = ((357.528 + 0.9856003 * n) % 360) * rad;
  const lambda = (L + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * rad;
  const eps = (23.439 - 0.0000004 * n) * rad;
  const ra = Math.atan2(Math.cos(eps) * Math.sin(lambda), Math.cos(lambda));
  const dec = Math.asin(Math.sin(eps) * Math.sin(lambda));
  const gmst = (((18.697374558 + 24.06570982441908 * n) % 24) + 24) % 24;
  const H = (gmst * 15 + lng) * rad - ra;
  const φ = lat * rad;
  const az = Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(φ) - Math.tan(dec) * Math.cos(φ));
  return (az / rad + 180 + 360) % 360;
}

/** Moment the sun stands in the qibla direction ("kıble saati"), if it does that day. */
function qiblaTime(sunrise, sunset, lat, lng) {
  const q = qiblaBearing(lat, lng);
  const diff = (t) => ((solarAzimuth(t, lat, lng) - q + 540) % 360) - 180;
  let prev = diff(sunrise);
  for (let t = sunrise.getTime() + 60_000; t <= sunset.getTime(); t += 60_000) {
    const d = diff(new Date(t));
    if (prev < 0 && d >= 0 && d - prev < 20) {
      return new Date(t);
    }
    prev = d;
  }
  return null;
}

function emushafDays(district) {
  const { Coordinates, CalculationMethod, PrayerTimes } = adhan;
  const tz = district.city.country.tz;
  const coords = new Coordinates(district.lat, district.lng);
  const params = CalculationMethod.Turkey();
  const raw = CalculationMethod.Turkey();
  raw.methodAdjustments = { fajr: 0, sunrise: 0, dhuhr: 0, asr: 0, maghrib: 0, isha: 0 };
  const today = zoned(new Date(), tz).date;
  const hhmm = (d) => zoned(d, tz).time;
  const days = [];
  for (let i = 0; i < 30; i += 1) {
    const iso = addDays(today, i);
    const [y, m, d] = iso.split('-').map(Number);
    const local = new Date(y, m - 1, d);
    const t = new PrayerTimes(coords, local, params);
    const r = new PrayerTimes(coords, local, raw);
    const h = toHijri(iso);
    const q = qiblaTime(r.sunrise, r.maghrib, district.lat, district.lng);
    const z = zoned(new Date(`${iso}T12:00:00Z`), tz);
    const dmy = `${pad2(d)}.${pad2(m)}.${y}`;
    days.push({
      HicriTarihKisa: `${h.day}.${h.month}.${h.year}`,
      HicriTarihKisaIso8601: null,
      HicriTarihUzun: `${h.day} ${HIJRI_MONTHS_TR[h.month - 1]} ${h.year}`,
      HicriTarihUzunIso8601: null,
      AyinSekliURL: `https://namazvakti.diyanet.gov.tr/images/r${Math.min(Math.max(h.day, 1), 30)}.gif`,
      MiladiTarihKisa: dmy,
      MiladiTarihKisaIso8601: dmy,
      MiladiTarihUzun: `${pad2(d)} ${GREG_MONTHS_TR[m - 1]} ${y} ${WEEKDAYS_TR[weekdayOf(iso)]}`,
      MiladiTarihUzunIso8601: `${iso}T00:00:00.0000000+03:00`,
      GreenwichOrtalamaZamani: z.offsetHours,
      Aksam: hhmm(t.maghrib),
      Gunes: hhmm(t.sunrise),
      GunesBatis: hhmm(r.maghrib),
      GunesDogus: hhmm(r.sunrise),
      Ikindi: hhmm(t.asr),
      Imsak: hhmm(t.fajr),
      KibleSaati: q ? hhmm(q) : '',
      Ogle: hhmm(t.dhuhr),
      Yatsi: hhmm(t.isha),
    });
  }
  return days;
}

function emushaf(sub) {
  if (sub === '/ulkeler') {
    return [200, DIR.countries.map((c) => ({ UlkeAdi: c.name, UlkeAdiEn: c.nameEn, UlkeID: c.id }))];
  }
  let m = /^\/sehirler\/([^/]+)$/.exec(sub);
  if (m) {
    const country = DIR.countries.find((c) => c.id === decodeURIComponent(m[1]));
    return [200, (country?.cities ?? []).map((c) => ({ SehirAdi: c.name, SehirAdiEn: c.nameEn, SehirID: c.id }))];
  }
  m = /^\/ilceler\/([^/]+)$/.exec(sub);
  if (m) {
    const city = DIR.cityById.get(decodeURIComponent(m[1]));
    return [200, (city?.districts ?? []).map((d) => ({ IlceAdi: d.name, IlceAdiEn: d.nameEn, IlceID: d.id }))];
  }
  m = /^\/vakitler\/([^/]+)$/.exec(sub);
  if (m) {
    const district = DIR.districtById.get(decodeURIComponent(m[1]));
    return district ? [200, emushafDays(district)] : [404, { Message: 'İlçe bulunamadı' }];
  }
  return null;
}

// ---------------------------------------------------------------------------
// Nominatim
// ---------------------------------------------------------------------------

function nominatimPlace(entity, kind) {
  const city = kind === 'city' ? entity : entity.city;
  const country = city.country;
  const display =
    kind === 'city' || entity.centre
      ? `${city.proper}, ${country.nameEn === 'TÜRKİYE' ? 'Türkiye' : country.nameEn}`
      : `${entity.proper}, ${city.proper}, ${country.nameEn === 'TÜRKİYE' ? 'Türkiye' : country.nameEn}`;
  const osmId = 100000 + (hashString(`${kind}:${entity.id}`) % 9_000_000);
  const box = kind === 'city' ? 0.25 : 0.05;
  return {
    place_id: osmId * 3 + 7,
    licence: 'Data © OpenStreetMap contributors, ODbL 1.0. http://osm.org/copyright',
    osm_type: 'relation',
    osm_id: osmId,
    lat: entity.lat.toFixed(7),
    lon: entity.lng.toFixed(7),
    category: 'boundary',
    type: 'administrative',
    place_rank: kind === 'city' ? 8 : 12,
    importance: kind === 'city' ? 0.71 : 0.48,
    addresstype: kind === 'city' ? 'province' : 'town',
    name: kind === 'city' ? city.proper : entity.proper,
    display_name: display,
    boundingbox: [entity.lat - box, entity.lat + box, entity.lng - box, entity.lng + box].map((v) => v.toFixed(7)),
  };
}

function nominatimSearch(q) {
  const parts = String(q ?? '')
    .split(',')
    .map((p) => fold(p))
    .filter(Boolean);
  if (parts.length === 0) {
    return [];
  }
  const same = (entity, part) => fold(entity.nameEn) === part || fold(entity.name) === part;
  const countryOk = (country, part) => part === undefined || same(country, part);
  // "district, city, country"
  if (parts.length >= 2) {
    for (const d of DIR.allDistricts) {
      if (same(d, parts[0]) && same(d.city, parts[1]) && countryOk(d.city.country, parts[2])) {
        return [nominatimPlace(d, 'district')];
      }
    }
    // "city, country"
    for (const c of DIR.cityById.values()) {
      if (same(c, parts[0]) && countryOk(c.country, parts[1])) {
        return [nominatimPlace(c, 'city')];
      }
    }
  }
  // Free text: first matching city, then district.
  for (const c of DIR.cityById.values()) {
    if (same(c, parts[0])) {
      return [nominatimPlace(c, 'city')];
    }
  }
  for (const d of DIR.allDistricts) {
    if (same(d, parts[0])) {
      return [nominatimPlace(d, 'district')];
    }
  }
  return [];
}

// ---------------------------------------------------------------------------
// Overpass (mosques)
// ---------------------------------------------------------------------------

const FAMOUS_MOSQUES = [
  ['Süleymaniye Camii', 'Süleymaniye Mosque', 'جامع السليمانية', 41.0162, 28.9639, 'Fatih', 'İstanbul', { capacity: '5000', website: 'https://www.suleymaniyecamii.gov.tr' }],
  ['Sultan Ahmet Camii', 'Blue Mosque', 'جامع السلطان أحمد', 41.0054, 28.9768, 'Fatih', 'İstanbul', { capacity: '10000', website: 'https://www.sultanahmetcamii.org' }],
  ['Ayasofya-i Kebir Câmi-i Şerifi', 'Hagia Sophia Grand Mosque', 'آيا صوفيا', 41.0086, 28.9802, 'Fatih', 'İstanbul', { capacity: '4500' }],
  ['Fatih Camii', 'Fatih Mosque', 'جامع الفاتح', 41.0194, 28.9497, 'Fatih', 'İstanbul', {}],
  ['Yeni Cami', 'New Mosque', 'الجامع الجديد', 41.0171, 28.9706, 'Fatih', 'İstanbul', {}],
  ['Rüstem Paşa Camii', 'Rüstem Pasha Mosque', 'جامع رستم باشا', 41.0177, 28.9688, 'Fatih', 'İstanbul', {}],
  ['Beyazıt Camii', 'Bayezid II Mosque', 'جامع بايزيد', 41.0102, 28.964, 'Fatih', 'İstanbul', {}],
  ['Şehzade Camii', 'Şehzade Mosque', 'جامع شهزاده', 41.0145, 28.9578, 'Fatih', 'İstanbul', {}],
  ['Laleli Camii', 'Laleli Mosque', null, 41.0099, 28.9567, 'Fatih', 'İstanbul', {}],
  ['Eyüp Sultan Camii', 'Eyüp Sultan Mosque', 'جامع أبي أيوب الأنصاري', 41.0479, 28.9339, 'Eyüpsultan', 'İstanbul', {}],
  ['Kılıç Ali Paşa Camii', 'Kılıç Ali Pasha Mosque', null, 41.0263, 28.981, 'Beyoğlu', 'İstanbul', {}],
  ['Nusretiye Camii', 'Nusretiye Mosque', null, 41.0272, 28.9822, 'Beyoğlu', 'İstanbul', {}],
  ['Ortaköy Camii', 'Ortaköy Mosque', null, 41.0473, 29.0269, 'Beşiktaş', 'İstanbul', {}],
  ['Mihrimah Sultan Camii', 'Mihrimah Sultan Mosque', null, 41.027, 29.0157, 'Üsküdar', 'İstanbul', {}],
  ['Büyük Çamlıca Camii', 'Grand Çamlıca Mosque', 'جامع تشامليجا الكبير', 41.0277, 29.0681, 'Üsküdar', 'İstanbul', { capacity: '63000', website: 'https://www.camlicacamii.com' }],
  ['Kocatepe Camii', 'Kocatepe Mosque', 'جامع كوجه تبه', 39.9167, 32.8601, 'Çankaya', 'Ankara', { capacity: '24000' }],
  ['Hacı Bayram-ı Veli Camii', 'Hacı Bayram Mosque', null, 39.9461, 32.8578, 'Altındağ', 'Ankara', {}],
  ['Bursa Ulu Camii', 'Grand Mosque of Bursa', 'الجامع الكبير في بورصة', 40.184, 29.0619, 'Osmangazi', 'Bursa', {}],
  ['Selimiye Camii', 'Selimiye Mosque', 'جامع السليمية', 41.6779, 26.5594, 'Merkez', 'Edirne', { capacity: '6000' }],
  ['Aziziye Camii', 'Aziziye Mosque', null, 37.8716, 32.4983, 'Karatay', 'Konya', {}],
  ['Sabancı Merkez Camii', 'Sabancı Central Mosque', null, 36.9935, 35.3378, 'Seyhan', 'Adana', { capacity: '28500' }],
  ['Hisar Camii', 'Hisar Mosque', null, 38.4192, 27.1305, 'Konak', 'İzmir', {}],
  ['Selimiye Camii (Ayasofya)', 'Selimiye Mosque Nicosia', null, 35.1765, 33.3644, 'Lefkoşa', 'Lefkoşa', {}],
  ['Lala Mustafa Paşa Camii', 'Lala Mustafa Pasha Mosque', null, 35.1252, 33.9419, 'Gazimağusa', 'Gazimağusa', {}],
  ['Hala Sultan Tekkesi', null, null, 34.8853, 33.6100, 'Larnaka', 'Larnaka', {}],
  ['DİTİB Merkez Camii', 'DITIB Central Mosque', null, 50.9455, 6.9361, 'Ehrenfeld', 'Köln', { website: 'https://www.ditib.de' }],
  ['Şehitlik Camii', 'Şehitlik Mosque', null, 52.4856, 13.4006, 'Neukölln', 'Berlin', {}],
  ['Mescid-i Haram', 'Masjid al-Haram', 'المسجد الحرام', 21.4225, 39.8262, 'Mekke', 'Mekke', { capacity: '2500000' }],
  ['Mescid-i Nebevi', "Prophet's Mosque", 'المسجد النبوي', 24.4672, 39.6111, 'Medine', 'Medine', { capacity: '1000000' }],
  ['Kuba Mescidi', 'Quba Mosque', 'مسجد قباء', 24.4393, 39.6173, 'Medine', 'Medine', {}],
];

const MOSQUE_NAMES = [
  'Hz. Ebubekir', 'Hz. Ömer', 'Hz. Osman', 'Hz. Ali', 'Hz. Hamza', 'Hz. Bilal-i Habeşi', 'Eyüp Sultan',
  'Mimar Sinan', 'Hacı Ahmet Efendi', 'Hacı Hasan', 'Hacı Mehmet Ağa', 'Hacı Hüseyin', 'Fatih Sultan Mehmet',
  'Yavuz Selim', 'Kanuni Sultan Süleyman', 'Abdülhamid Han', 'Valide Sultan', 'Piri Paşa', 'Sokullu Mehmet Paşa',
  'İskender Paşa', 'Hüsrev Paşa', 'Cedid Ali Paşa', 'Akşemseddin', 'Gülbahar Hatun', 'Nur', 'Rahmet', 'Huzur',
  'Tevhid', 'Hidayet', 'Şifa', 'Çamlık', 'Kuba', 'Ensar', 'Muhacirin', 'Mevlana', 'Yunus Emre', 'Hacı Bayram-ı Veli',
  'Aziz Mahmud Hüdayi', 'Sultan Alparslan', 'Malazgirt', 'Osman Gazi', 'Orhan Gazi', 'Ertuğrul Gazi', 'Selahaddin Eyyubi',
  'Cumhuriyet', 'Esentepe', 'Yıldıztepe', 'Gültepe', 'Sarıgöl', 'Bahçelievler', 'Çarşı', 'Pazar', 'Kale', 'Köprübaşı',
  'İstasyon', 'Hükümet', 'Şehitler', 'Gazi', 'Hacı Bektaş Mahallesi', 'Kocamustafapaşa', 'Ayazma', 'Tekke', 'Arap',
];
const UNSUFFIXED = ['Yeni Cami', 'Ulu Cami', 'Eski Cami', 'Merkez Cami'];
const STREETS = [
  'Atatürk', 'Cumhuriyet', 'İstiklal', 'Gazi', 'Fevzi Çakmak', 'Kazım Karabekir', 'Mimar Sinan', 'Yunus Emre',
  'Mevlana', 'Hürriyet', 'Barbaros', 'Bağdat', 'Okul', 'Cami', 'Pınarbaşı', 'Gül', 'Lale', 'Menekşe', 'Çınar', 'Ihlamur',
  'Akasya', 'Kavak', 'Dumlupınar', 'Sakarya', 'Çanakkale', 'Ankara', 'İnönü', 'Necip Fazıl', 'Mehmet Akif', 'Sultan Murat',
];

function parseOverpassBox(query) {
  const bbox = /\((-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)\)/.exec(query);
  if (bbox) {
    const [s, w, n, e] = bbox.slice(1).map(Number);
    return { south: s, west: w, north: n, east: e };
  }
  const around = /around:\s*(\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/.exec(query);
  if (around) {
    const [r, lat, lng] = around.slice(1).map(Number);
    const dLat = r / 111_320;
    const dLng = r / (111_320 * Math.max(Math.cos(lat * rad), 0.01));
    return { south: lat - dLat, west: lng - dLng, north: lat + dLat, east: lng + dLng };
  }
  return null;
}

function mosqueTags(rand, name, district, city, isWay) {
  const tags = {
    amenity: 'place_of_worship',
    religion: 'muslim',
    denomination: 'sunni',
    name,
  };
  if (isWay) {
    tags.building = 'mosque';
  }
  if (rand() < 0.75) {
    const street = STREETS[Math.floor(rand() * STREETS.length)];
    tags['addr:street'] = `${street} ${rand() < 0.5 ? 'Caddesi' : 'Sokak'}`;
    tags['addr:housenumber'] = String(1 + Math.floor(rand() * 120));
  }
  if (district) {
    tags['addr:district'] = district;
  }
  if (city) {
    tags['addr:city'] = city;
  }
  const w = rand();
  if (w < 0.35) {
    tags.wheelchair = 'yes';
  } else if (w < 0.5) {
    tags.wheelchair = 'limited';
  } else if (w < 0.6) {
    tags.wheelchair = 'no';
  }
  if (rand() < 0.4) {
    tags.toilets = 'yes';
  }
  if (rand() < 0.3) {
    tags.wudu = 'yes';
  }
  return tags;
}

function mosqueName(rand, used, district) {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const roll = rand();
    let name;
    if (roll < 0.1) {
      name = UNSUFFIXED[Math.floor(rand() * UNSUFFIXED.length)];
    } else if (roll < 0.18) {
      name = `${MOSQUE_NAMES[Math.floor(rand() * MOSQUE_NAMES.length)]} Mescidi`;
    } else {
      name = `${MOSQUE_NAMES[Math.floor(rand() * MOSQUE_NAMES.length)]} Camii`;
    }
    if (!used.has(name)) {
      used.add(name);
      return name;
    }
  }
  return `${district ?? 'Mahalle'} Camii`;
}

function overpassMosques(box) {
  const inside = (lat, lng) => lat >= box.south && lat <= box.north && lng >= box.west && lng <= box.east;
  const elements = [];

  for (const [i, [name, nameEn, nameAr, lat, lng, district, city, extra]] of FAMOUS_MOSQUES.entries()) {
    if (!inside(lat, lng)) {
      continue;
    }
    const tags = mosqueTags(rng(`famous:${i}`), name, district, city, true);
    if (nameEn) tags['name:en'] = nameEn;
    if (nameAr) tags['name:ar'] = nameAr;
    Object.assign(tags, extra);
    tags.wheelchair = 'yes';
    elements.push({ type: 'way', id: 24_000_000 + i * 977, center: { lat, lon: lng }, tags });
  }

  // Clusters around every known district centre near the box (stable across tiles).
  const margin = 0.06;
  let clustered = 0;
  for (const d of DIR.allDistricts) {
    if (d.lat < box.south - margin || d.lat > box.north + margin || d.lng < box.west - margin || d.lng > box.east + margin) {
      continue;
    }
    const rand = rng(`district:${d.id}`);
    const count = d.centre ? 30 : 18;
    const sigmaLat = 0.012;
    const sigmaLng = sigmaLat / Math.max(Math.cos(d.lat * rad), 0.2);
    const used = new Set();
    const cityName = d.city.proper;
    for (let k = 0; k < count; k += 1) {
      const lat = d.lat + gaussian(rand) * sigmaLat;
      const lng = d.lng + gaussian(rand) * sigmaLng;
      const name = k === 0 && d.id !== '9541' ? `${d.proper} Merkez Camii` : mosqueName(rand, used, d.proper);
      const isWay = rand() < 0.7;
      const diaspora = ['13', '23'].includes(d.city.country.id) && rand() < 0.5;
      const addrDistrict = d.id === '9541' ? 'Fatih' : d.centre ? 'Merkez' : d.proper;
      const tags = mosqueTags(rand, diaspora ? `DİTİB ${name}` : name, addrDistrict, cityName, isWay);
      if (!inside(lat, lng)) {
        continue;
      }
      if (rand() < 0.15) {
        const base = fold(name).replace(/ CAMII$| MESCIDI$| CAMI$/, '');
        tags['name:en'] = `${base.split(' ').map((w) => w[0] + w.slice(1).toLowerCase()).join(' ')} Mosque`;
      }
      const id = 100_000_000 + (hashString(`${d.id}:${k}`) % 900_000_000);
      clustered += 1;
      elements.push(
        isWay
          ? { type: 'way', id, center: { lat: +lat.toFixed(7), lon: +lng.toFixed(7) }, tags }
          : { type: 'node', id: id + 7, lat: +lat.toFixed(7), lon: +lng.toFixed(7), tags },
      );
    }
  }

  // Village / neighbourhood mosques spread over the area (seeded by the box).
  const background = Math.max(0, 40 - clustered);
  const rand = rng(`box:${box.south.toFixed(4)},${box.west.toFixed(4)},${box.north.toFixed(4)},${box.east.toFixed(4)}`);
  const used = new Set();
  for (let k = 0; k < background; k += 1) {
    const lat = box.south + rand() * (box.north - box.south);
    const lng = box.west + rand() * (box.east - box.west);
    const isWay = rand() < 0.6;
    const name = mosqueName(rand, used, null);
    const tags = mosqueTags(rand, name, null, null, isWay);
    const id = 1_000_000_000 + Math.floor(rand() * 900_000_000);
    elements.push(
      isWay
        ? { type: 'way', id, center: { lat: +lat.toFixed(7), lon: +lng.toFixed(7) }, tags }
        : { type: 'node', id: id + 3, lat: +lat.toFixed(7), lon: +lng.toFixed(7), tags },
    );
  }

  return {
    version: 0.6,
    generator: 'Overpass API 0.7.62.5 (dev-upstream mock)',
    osm3s: {
      timestamp_osm_base: new Date().toISOString().replace(/\.\d+Z$/, 'Z'),
      copyright: 'The data included in this document is from www.openstreetmap.org. The data is made available under ODbL.',
    },
    elements,
  };
}

// ---------------------------------------------------------------------------
// YouTube
// ---------------------------------------------------------------------------

const YT_CHANNELS = [
  {
    id: 'UCMekkeKabeCanliYayin_01', handle: '@mekkecanli', title: 'Mekke Canlı Yayın',
    description: "Kâbe-i Muazzama'dan 7/24 kesintisiz canlı yayın.",
    videos: [
      { kind: 'live', title: 'Mekke Canlı Yayın | Kâbe-i Muazzama 7/24 — Makkah Live HD', startedHoursAgo: 2880, viewers: 12500 },
      { kind: 'ended', title: 'Mekke Cuma Hutbesi ve Namazı — Canlı', startedHoursAgo: 120, durationHours: 1.5 },
      { kind: 'none', title: 'Kâbe Tavafı | Huzur Veren Görüntüler', publishedHoursAgo: 30 },
      { kind: 'none', title: "Mescid-i Haram'da Teravih Namazı Özeti", publishedHoursAgo: 200 },
      { kind: 'none', title: 'Mekke Ezanı — Sabah Namazı', publishedHoursAgo: 400 },
    ],
  },
  {
    id: 'UCMedineMescidiNebevi_02', handle: '@medinecanli', title: 'Medine Canlı Yayın',
    description: "Mescid-i Nebevi'den 7/24 canlı yayın.",
    videos: [
      { kind: 'live', title: 'Medine Canlı | Mescid-i Nebevi 7/24 Canlı Yayın', startedHoursAgo: 2100, viewers: 4300 },
      { kind: 'none', title: "Ravza-i Mutahhara'dan Görüntüler", publishedHoursAgo: 50 },
      { kind: 'none', title: 'Medine Ezanı — Akşam Namazı', publishedHoursAgo: 150 },
    ],
  },
  {
    id: 'UCKuranKerimTilavet_0003', handle: '@kurantilaveti', title: "Kur'an-ı Kerim Tilaveti",
    description: "Seçkin hafızlardan Kur'an-ı Kerim tilavetleri ve hatimler.",
    videos: [
      { kind: 'live', title: "Kur'an-ı Kerim Tilaveti Canlı — Hafız Sesinden Hatim", startedHoursAgo: 5, viewers: 860 },
      { kind: 'upcoming', title: 'Cuma Gecesi Yasin-i Şerif ve Dua — Canlı', startsInHours: 'thursday-evening' },
      { kind: 'none', title: 'Mülk Suresi | Hafız Abdullah', publishedHoursAgo: 20 },
      { kind: 'none', title: 'Kehf Suresi Tilaveti', publishedHoursAgo: 96 },
    ],
  },
  {
    id: 'UCDiniSohbetVeDualar_004', handle: '@dinisohbet', title: 'Dini Sohbetler ve Dualar',
    description: 'Tefsir, hadis ve ilmihal sohbetleri; canlı dua programları.',
    videos: [
      { kind: 'live', title: 'Sabah Sohbeti: Sabır ve Şükür Üzerine — Canlı', startedHoursAgo: 1, viewers: 1240 },
      { kind: 'upcoming', title: 'Haftalık Tefsir Sohbeti — Canlı Yayın', startsInHours: 'tomorrow-evening' },
      { kind: 'ended', title: 'Kandil Gecesi Özel Dua Programı', startedHoursAgo: 340, durationHours: 2 },
      { kind: 'none', title: 'Kısa Hadis Dersleri #42', publishedHoursAgo: 70 },
    ],
  },
];
for (const c of YT_CHANNELS) {
  if (!/^UC[\w-]{22}$/.test(c.id)) throw new Error(`bad mock channel id ${c.id}`);
}

/** Which catalogue entry a (possibly unknown) channel id or handle maps to. */
function catalogIndexFor(channelIdOrHandle) {
  const byId = YT_CHANNELS.findIndex((c) => c.id === channelIdOrHandle || c.handle.toLowerCase() === String(channelIdOrHandle).toLowerCase());
  return byId >= 0 ? byId : hashString(channelIdOrHandle) % YT_CHANNELS.length;
}

/** 11-char id = 8 chars from the channel + catalogue index + slot + checksum; decodable without state. */
function videoIdFor(channelId, catIdx, slot) {
  const head = b64id(`yt:${channelId}`, 8) + String(catIdx) + B64[slot];
  return head + B64[hashString(head) % 64];
}
function decodeVideoId(id) {
  if (!/^[\w-]{11}$/.test(id) || B64[hashString(id.slice(0, 10)) % 64] !== id[10]) {
    return null;
  }
  const catIdx = Number(id[8]);
  const slot = B64.indexOf(id[9]);
  const channel = YT_CHANNELS[catIdx];
  const video = channel?.videos[slot];
  return video ? { channel, video, catIdx, slot } : null;
}

/** Channel id that owns a video (for snippet.channelId): known catalogue id when the head matches. */
function ownerChannelId(id, channel) {
  return b64id(`yt:${channel.id}`, 8) === id.slice(0, 8) ? channel.id : `UC${b64id(`owner:${id.slice(0, 8)}`, 22)}`;
}

function istanbulAt(iso, hh, mm) {
  return new Date(`${iso}T${pad2(hh)}:${pad2(mm)}:00+03:00`);
}

function videoTimes(video, now = new Date()) {
  const hour = 3_600_000;
  if (video.kind === 'live') {
    return { actualStartTime: new Date(Math.floor((now.getTime() - video.startedHoursAgo * hour) / hour) * hour) };
  }
  if (video.kind === 'ended') {
    const start = new Date(Math.floor((now.getTime() - video.startedHoursAgo * hour) / hour) * hour);
    return { actualStartTime: start, actualEndTime: new Date(start.getTime() + video.durationHours * hour), scheduledStartTime: start };
  }
  if (video.kind === 'upcoming') {
    const today = zoned(now, 'Europe/Istanbul').date;
    let date = addDays(today, 1);
    let at = istanbulAt(date, 20, 30);
    if (video.startsInHours === 'thursday-evening') {
      let i = 0;
      do {
        date = addDays(today, i);
        at = istanbulAt(date, 21, 0);
        i += 1;
      } while ((weekdayOf(date) !== 4 || at <= now) && i < 15);
    }
    return { scheduledStartTime: at };
  }
  return { publishedAt: new Date(Math.floor((now.getTime() - video.publishedHoursAgo * hour) / hour) * hour) };
}

function thumbs(id, live) {
  const suffix = live ? '_live' : '';
  return {
    default: { url: `https://i.ytimg.com/vi/${id}/default${suffix}.jpg`, width: 120, height: 90 },
    medium: { url: `https://i.ytimg.com/vi/${id}/mqdefault${suffix}.jpg`, width: 320, height: 180 },
    high: { url: `https://i.ytimg.com/vi/${id}/hqdefault${suffix}.jpg`, width: 480, height: 360 },
    standard: { url: `https://i.ytimg.com/vi/${id}/sddefault${suffix}.jpg`, width: 640, height: 480 },
    maxres: { url: `https://i.ytimg.com/vi/${id}/maxresdefault${suffix}.jpg`, width: 1280, height: 720 },
  };
}

function channelThumbs(channelId) {
  const base = `https://yt3.ggpht.com/ytc/${b64id(`thumb:${channelId}`, 40)}`;
  return {
    default: { url: `${base}=s88-c-k-c0x00ffffff-no-rj`, width: 88, height: 88 },
    medium: { url: `${base}=s240-c-k-c0x00ffffff-no-rj`, width: 240, height: 240 },
    high: { url: `${base}=s800-c-k-c0x00ffffff-no-rj`, width: 800, height: 800 },
  };
}

function ytChannels(params) {
  const ids = (params.get('id') ?? '').split(',').filter(Boolean);
  const handle = params.get('forHandle');
  const refs = handle ? [handle.startsWith('@') ? handle : `@${handle}`] : ids;
  const items = refs.map((ref) => {
    const cat = YT_CHANNELS[catalogIndexFor(ref)];
    const known = YT_CHANNELS.find((c) => c.id === ref || c.handle.toLowerCase() === ref.toLowerCase());
    const id = known ? known.id : ref.startsWith('@') ? `UC${b64id(`handle:${ref.toLowerCase()}`, 22)}` : ref;
    return {
      kind: 'youtube#channel',
      etag: b64id(`etag:${id}`, 27),
      id,
      snippet: {
        title: cat.title,
        description: cat.description,
        customUrl: known ? known.handle : ref.startsWith('@') ? ref.toLowerCase() : `@${cat.handle.slice(1)}${hashString(id) % 100}`,
        publishedAt: '2014-03-11T09:12:44Z',
        thumbnails: channelThumbs(id),
        localized: { title: cat.title, description: cat.description },
        country: 'TR',
      },
    };
  });
  return {
    kind: 'youtube#channelListResponse',
    etag: b64id(`list:${refs.join(',')}`, 27),
    pageInfo: { totalResults: items.length, resultsPerPage: 5 },
    items,
  };
}

function ytFeed(channelId) {
  const catIdx = catalogIndexFor(channelId);
  const cat = YT_CHANNELS[catIdx];
  const now = new Date();
  const entries = cat.videos.map((video, slot) => {
    const id = videoIdFor(channelId, catIdx, slot);
    const t = videoTimes(video, now);
    const published = (t.publishedAt ?? t.actualStartTime ?? new Date(now.getTime() - 3_600_000)).toISOString();
    return `
 <entry>
  <id>yt:video:${id}</id>
  <yt:videoId>${id}</yt:videoId>
  <yt:channelId>${xmlEscape(channelId)}</yt:channelId>
  <title>${xmlEscape(video.title)}</title>
  <link rel="alternate" href="https://www.youtube.com/watch?v=${id}"/>
  <author>
   <name>${xmlEscape(cat.title)}</name>
   <uri>https://www.youtube.com/channel/${xmlEscape(channelId)}</uri>
  </author>
  <published>${published.replace(/\.\d+Z$/, '+00:00')}</published>
  <updated>${now.toISOString().replace(/\.\d+Z$/, '+00:00')}</updated>
  <media:group>
   <media:title>${xmlEscape(video.title)}</media:title>
   <media:content url="https://www.youtube.com/v/${id}?version=3" type="application/x-shockwave-flash" width="640" height="390"/>
   <media:thumbnail url="https://i4.ytimg.com/vi/${id}/hqdefault.jpg" width="480" height="360"/>
   <media:description>${xmlEscape(cat.description)}</media:description>
   <media:community>
    <media:starRating count="${200 + (hashString(id) % 5000)}" average="5.00" min="1" max="5"/>
    <media:statistics views="${1000 + (hashString(`v${id}`) % 250000)}"/>
   </media:community>
  </media:group>
 </entry>`;
  });
  return `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns:yt="http://www.youtube.com/xml/schemas/2015" xmlns:media="http://search.yahoo.com/mrss/" xmlns="http://www.w3.org/2005/Atom">
 <link rel="self" href="http://www.youtube.com/feeds/videos.xml?channel_id=${xmlEscape(channelId)}"/>
 <id>yt:channel:${xmlEscape(channelId.replace(/^UC/, ''))}</id>
 <yt:channelId>${xmlEscape(channelId.replace(/^UC/, ''))}</yt:channelId>
 <title>${xmlEscape(cat.title)}</title>
 <link rel="alternate" href="https://www.youtube.com/channel/${xmlEscape(channelId)}"/>
 <author>
  <name>${xmlEscape(cat.title)}</name>
  <uri>https://www.youtube.com/channel/${xmlEscape(channelId)}</uri>
 </author>
 <published>2014-03-11T09:12:44+00:00</published>${entries.join('')}
</feed>
`;
}

function ytVideos(params) {
  const ids = (params.get('id') ?? '').split(',').filter(Boolean).slice(0, 50);
  const now = new Date();
  const items = [];
  for (const id of ids) {
    const decoded = decodeVideoId(id);
    if (!decoded) {
      continue; // unknown ids behave like deleted/private videos
    }
    const { channel, video } = decoded;
    const t = videoTimes(video, now);
    const iso = (d) => d?.toISOString().replace(/\.\d+Z$/, 'Z');
    const item = {
      kind: 'youtube#video',
      etag: b64id(`etag:${id}`, 27),
      id,
      snippet: {
        publishedAt: iso(t.publishedAt ?? t.scheduledStartTime ?? t.actualStartTime),
        channelId: ownerChannelId(id, channel),
        title: video.title,
        description: channel.description,
        thumbnails: thumbs(id, video.kind === 'live' || video.kind === 'upcoming'),
        channelTitle: channel.title,
        categoryId: '29',
        liveBroadcastContent: video.kind === 'live' ? 'live' : video.kind === 'upcoming' ? 'upcoming' : 'none',
        defaultAudioLanguage: 'tr',
        localized: { title: video.title, description: channel.description },
      },
    };
    if (video.kind === 'live') {
      // Viewers drift a little every minute so the UI looks alive.
      const wobble = Math.sin(now.getTime() / 600_000 + hashString(id)) * 0.08;
      item.liveStreamingDetails = {
        actualStartTime: iso(t.actualStartTime),
        concurrentViewers: String(Math.round(video.viewers * (1 + wobble))),
        activeLiveChatId: `Cg0KC${b64id(`chat:${id}`, 20)}`,
      };
    } else if (video.kind === 'upcoming') {
      item.liveStreamingDetails = { scheduledStartTime: iso(t.scheduledStartTime) };
    } else if (video.kind === 'ended') {
      item.liveStreamingDetails = {
        actualStartTime: iso(t.actualStartTime),
        actualEndTime: iso(t.actualEndTime),
        scheduledStartTime: iso(t.scheduledStartTime),
      };
    }
    items.push(item);
  }
  return {
    kind: 'youtube#videoListResponse',
    etag: b64id(`videos:${ids.join(',')}`, 27),
    items,
    pageInfo: { totalResults: items.length, resultsPerPage: items.length },
  };
}

// ---------------------------------------------------------------------------
// Aladhan
// ---------------------------------------------------------------------------

function aladhanMonth(month, year) {
  const span = hijriMonthSpan(month, year);
  if (!span) {
    return [400, { code: 400, status: 'BAD_REQUEST', data: 'Please specify a valid Hijri month and year.' }];
  }
  const data = [];
  for (let i = 0; i < span.length; i += 1) {
    const iso = addDays(span.start, i);
    const [gy, gm, gd] = iso.split('-').map(Number);
    const wd = weekdayOf(iso);
    data.push({
      hijri: {
        date: `${pad2(i + 1)}-${pad2(month)}-${year}`,
        format: 'DD-MM-YYYY',
        day: pad2(i + 1),
        weekday: { en: ['Al Ahad', 'Al Athnayn', 'Al Thalaata', 'Al Arbiaa', 'Al Khamees', 'Al Juma', 'Al Sabt'][wd], ar: WEEKDAYS_AR[wd] },
        month: { number: month, en: HIJRI_MONTHS_EN[month - 1], ar: HIJRI_MONTHS_AR[month - 1], days: span.length },
        year: String(year),
        designation: { abbreviated: 'AH', expanded: 'Anno Hegirae' },
        holidays: [],
        adjustedHolidays: [],
        method: 'DIYANET',
      },
      gregorian: {
        date: `${pad2(gd)}-${pad2(gm)}-${gy}`,
        format: 'DD-MM-YYYY',
        day: pad2(gd),
        weekday: { en: WEEKDAYS_EN[wd] },
        month: { number: gm, en: GREG_MONTHS_EN[gm - 1] },
        year: String(gy),
        designation: { abbreviated: 'AD', expanded: 'Anno Domini' },
        lunarSighting: false,
      },
    });
  }
  return [200, { code: 200, status: 'OK', data }];
}

// ---------------------------------------------------------------------------
// TCMB + GoldAPI
// ---------------------------------------------------------------------------

/** Last business day in Türkiye (TCMB publishes no bulletin at weekends). */
function bulletinDate(now = new Date()) {
  let iso = zoned(now, 'Europe/Istanbul').date;
  while ([0, 6].includes(weekdayOf(iso))) {
    iso = addDays(iso, -1);
  }
  return iso;
}

function usdTryFor(iso) {
  return 42.35 + (hashString(`usd:${iso}`) % 30) / 100; // 42.35–42.64
}

function tcmbXml() {
  const iso = bulletinDate();
  const [y, m, d] = iso.split('-');
  const usd = usdTryFor(iso);
  const cross = { EUR: 1.153, GBP: 1.312, CHF: 1.247, SAR: 0.2666, JPY: 0.00653, AUD: 0.655 };
  const f4 = (n) => n.toFixed(4);
  const currency = (code, nameTr, nameEn, unit, selling, crossRate, order) => {
    const buying = selling * 0.9982;
    return `<Currency CrossOrder="${order}" Kod="${code}" CurrencyCode="${code}">
\t\t\t<Unit>${unit}</Unit>
\t\t\t<Isim>${nameTr}</Isim>
\t\t\t<CurrencyName>${nameEn}</CurrencyName>
\t\t\t<ForexBuying>${f4(buying)}</ForexBuying>
\t\t\t<ForexSelling>${f4(selling)}</ForexSelling>
\t\t\t<BanknoteBuying>${f4(buying * 0.9993)}</BanknoteBuying>
\t\t\t<BanknoteSelling>${f4(selling * 1.0011)}</BanknoteSelling>
\t\t\t\t<CrossRateUSD>${crossRate ?? ''}</CrossRateUSD>
\t\t\t\t<CrossRateOther></CrossRateOther>
\t\t</Currency>`;
  };
  return `<?xml version="1.0" encoding="UTF-8"?>
<?xml-stylesheet type="text/xsl" href="isokur.xsl"?>
<Tarih_Date Tarih="${d}.${m}.${y}" Date="${m}/${d}/${y}"  Bulten_No="${y}/${200 + (hashString(iso) % 50)}" >
\t${currency('USD', 'ABD DOLARI', 'US DOLLAR', 1, usd, '', 0)}
\t${currency('AUD', 'AVUSTRALYA DOLARI', 'AUSTRALIAN DOLLAR', 1, usd * cross.AUD, '', 1)}
\t${currency('CHF', 'İSVİÇRE FRANGI', 'SWISS FRANK', 1, usd * cross.CHF, f4(1 / cross.CHF), 2)}
\t${currency('EUR', 'EURO', 'EURO', 1, usd * cross.EUR, '', 3)}
\t${currency('GBP', 'İNGİLİZ STERLİNİ', 'POUND STERLING', 1, usd * cross.GBP, '', 4)}
\t${currency('JPY', 'JAPON YENİ', 'JAPENESE YEN', 100, usd * cross.JPY * 100, f4(1 / cross.JPY), 5)}
\t${currency('SAR', 'SUUDİ ARABİSTAN RİYALİ', 'SAUDI RIYAL', 1, usd * cross.SAR, f4(1 / cross.SAR), 6)}
</Tarih_Date>
`;
}

function goldQuote(metal, currency) {
  const base = { XAU: 4000, XAG: 48, XPT: 1580, XPD: 1210 }[metal];
  if (!base) {
    return [400, { error: `Invalid metal: ${metal}` }];
  }
  const fx = currency === 'USD' ? 1 : currency === 'TRY' ? usdTryFor(bulletinDate()) : null;
  if (!fx) {
    return [400, { error: `Invalid currency: ${currency}` }];
  }
  const now = Date.now();
  const bucket = Math.floor(now / 600_000);
  const drift = Math.sin(bucket / 7) * 0.006 + ((hashString(`${metal}:${bucket}`) % 100) - 50) / 50_000;
  const price = +(base * (1 + drift) * fx).toFixed(2);
  const prev = +(base * (1 + Math.sin((bucket - 144) / 7) * 0.006) * fx).toFixed(2);
  const gram = price / 31.1034768;
  return [
    200,
    {
      timestamp: Math.floor(now / 1000),
      metal,
      currency,
      exchange: 'FOREXCOM',
      symbol: `FOREXCOM:${metal}${currency}`,
      prev_close_price: prev,
      open_price: prev,
      low_price: +(Math.min(price, prev) * 0.996).toFixed(2),
      high_price: +(Math.max(price, prev) * 1.004).toFixed(2),
      open_time: Math.floor(now / 86_400_000) * 86_400,
      price,
      ch: +(price - prev).toFixed(2),
      chp: +(((price - prev) / prev) * 100).toFixed(2),
      ask: +(price * 1.0002).toFixed(2),
      bid: +(price * 0.9998).toFixed(2),
      price_gram_24k: +gram.toFixed(4),
      price_gram_22k: +(gram * 0.9167).toFixed(4),
      price_gram_21k: +(gram * 0.875).toFixed(4),
      price_gram_20k: +(gram * 0.8333).toFixed(4),
      price_gram_18k: +(gram * 0.75).toFixed(4),
      price_gram_16k: +(gram * 0.6667).toFixed(4),
      price_gram_14k: +(gram * 0.5833).toFixed(4),
      price_gram_10k: +(gram * 0.4167).toFixed(4),
    },
  ];
}

// ---------------------------------------------------------------------------
// HTTP server
// ---------------------------------------------------------------------------

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

async function route(req, url) {
  const p = url.pathname.replace(/\/+$/, '') || '/';
  const q = url.searchParams;

  if (p === '/' || p === '/health') {
    return [200, {
      ok: true,
      service: 'dev-upstream',
      prefixes: ['/emushaf', '/nominatim', '/overpass', '/aladhan', '/tcmb', '/goldapi', '/youtube'],
      youtubeChannels: YT_CHANNELS.map((c) => ({ id: c.id, handle: c.handle, title: c.title })),
    }];
  }

  if (p.startsWith('/emushaf/')) {
    return emushaf(p.slice('/emushaf'.length)) ?? [404, { Message: 'Not found' }];
  }

  if (p === '/nominatim/search') {
    return [200, nominatimSearch(q.get('q'))];
  }

  if (p.startsWith('/overpass')) {
    let data = q.get('data') ?? '';
    if (req.method === 'POST') {
      const body = await readBody(req);
      data = new URLSearchParams(body).get('data') ?? body;
    }
    const box = parseOverpassBox(data);
    if (!box) {
      return [400, 'text/plain', 'Error: no bbox or around filter found in query (dev-upstream mock)'];
    }
    return [200, overpassMosques(box)];
  }

  let m = /^\/aladhan\/v1\/hToGCalendar\/(\d{1,2})\/(\d{4})$/.exec(p);
  if (m) {
    return aladhanMonth(Number(m[1]), Number(m[2]));
  }

  if (p === '/tcmb/kurlar/today.xml') {
    return [200, 'application/xml; charset=utf-8', tcmbXml()];
  }

  m = /^\/goldapi\/api\/([A-Za-z]{3})\/([A-Za-z]{3})(?:\/\d{8})?$/.exec(p);
  if (m) {
    if (!req.headers['x-access-token']) {
      return [403, { error: 'No API Key provided' }];
    }
    return goldQuote(m[1].toUpperCase(), m[2].toUpperCase());
  }

  if (p.startsWith('/youtube/v3/')) {
    if (!q.get('key')) {
      return [403, { error: { code: 403, message: 'The request is missing a valid API key.', status: 'PERMISSION_DENIED' } }];
    }
    if (p === '/youtube/v3/channels') {
      return [200, ytChannels(q)];
    }
    if (p === '/youtube/v3/videos') {
      return [200, ytVideos(q)];
    }
    return [404, { error: { code: 404, message: 'Not implemented in dev-upstream mock' } }];
  }

  if (p === '/youtube/feeds/videos.xml') {
    const channelId = q.get('channel_id');
    if (!channelId) {
      return [400, 'text/plain', 'channel_id required'];
    }
    return [200, 'application/atom+xml; charset=UTF-8', ytFeed(channelId)];
  }

  return [404, { error: 'Unknown path (dev-upstream mock)', path: p }];
}

async function startServer() {
  const mod = await import('adhan');
  adhan = mod.default ?? mod;
  const port = Number(process.env.PORT ?? 4010);

  const server = createServer(async (req, res) => {
    const started = Date.now();
    const url = new URL(req.url ?? '/', 'http://localhost');
    let status = 500;
    try {
      const result = await route(req, url);
      let type = 'application/json; charset=utf-8';
      let body;
      if (result.length === 3) {
        [status, type, body] = result;
      } else {
        [status, body] = result;
        body = JSON.stringify(body);
      }
      res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' });
      res.end(body);
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: String(error?.stack ?? error) }));
      console.error(error);
    } finally {
      const shown = url.pathname + (url.search.length > 120 ? `${url.search.slice(0, 120)}…` : url.search);
      console.log(`${new Date().toISOString().slice(11, 19)} ${req.method} ${shown} → ${status} (${Date.now() - started} ms)`);
    }
  });

  server.listen(port, () => {
    const base = `http://localhost:${port}`;
    console.log(`dev-upstream mock listening on ${base}
  ${DIR.countries.length} countries, ${DIR.cityById.size} cities, ${DIR.districtById.size} districts

  EMUSHAF_BASE_URL=${base}/emushaf
  NOMINATIM_BASE_URL=${base}/nominatim
  OVERPASS_BASE_URL=${base}/overpass/api/interpreter
  ALADHAN_BASE_URL=${base}/aladhan
  TCMB_BASE_URL=${base}/tcmb
  GOLDAPI_BASE_URL=${base}/goldapi
  GOLDAPI_KEY=dev-mock
  YOUTUBE_API_KEY=dev-mock
  DEV_UPSTREAM_URL=${base}
  NODE_OPTIONS=--import=./scripts/dev-upstream.mjs   # YouTube redirect (API + worker)
`);
  });

  const stop = () => server.close(() => process.exit(0));
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}

// Entry point last, so every module-level constant above is initialised first.
if (isMain) {
  await startServer();
} else {
  installFetchRedirect();
}

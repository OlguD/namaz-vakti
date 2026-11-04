import { parseLocations, parseTimes } from './emushaf.provider.js';

// Trimmed real responses from https://ezanvakti.emushaf.net (İstanbul, district 9541).
const ISTANBUL_DAYS = [
  {
    HicriTarihKisa: '25.5.1448',
    HicriTarihKisaIso8601: null,
    HicriTarihUzun: '25 Cemaziyelevvel 1448',
    AyinSekliURL: 'https://namazvakti.diyanet.gov.tr/images/sd3.gif',
    MiladiTarihKisa: '05.11.2026',
    MiladiTarihKisaIso8601: '05.11.2026',
    MiladiTarihUzun: '05 Kasım 2026 Perşembe',
    MiladiTarihUzunIso8601: '2026-11-05T00:00:00.0000000+03:00',
    GreenwichOrtalamaZamani: 3.0,
    Aksam: '18:03',
    Gunes: '07:32',
    GunesBatis: '17:56',
    GunesDogus: '07:39',
    Ikindi: '15:37',
    Imsak: '06:06',
    KibleSaati: '11:05',
    Ogle: '12:53',
    Yatsi: '19:24',
  },
  {
    HicriTarihKisa: '24.5.1448',
    HicriTarihUzun: '24 Cemaziyelevvel 1448',
    AyinSekliURL: 'https://namazvakti.diyanet.gov.tr/images/sd2.gif',
    MiladiTarihKisa: '04.11.2026',
    Aksam: '18:04',
    Gunes: '07:31',
    GunesBatis: '17:57',
    GunesDogus: '07:38',
    Ikindi: '15:38',
    Imsak: '06:05',
    KibleSaati: '11:05',
    Ogle: '12:53',
    Yatsi: '19:25',
  },
  { MiladiTarihKisa: 'bozuk', Imsak: '06:00' },
];

describe('parseTimes', () => {
  it('maps fields, normalises dates and sorts by date', () => {
    const days = parseTimes(ISTANBUL_DAYS);
    expect(days).toHaveLength(2);
    expect(days[0]).toEqual({
      date: '2026-11-04',
      imsak: '06:05',
      gunes: '07:31',
      ogle: '12:53',
      ikindi: '15:38',
      aksam: '18:04',
      yatsi: '19:25',
      sunrise: '07:38',
      sunset: '17:57',
      qiblaTime: '11:05',
      hijriShort: '24.5.1448',
      hijriLong: '24 Cemaziyelevvel 1448',
      moonPhaseUrl: 'https://namazvakti.diyanet.gov.tr/images/sd2.gif',
    });
  });

  it('rejects non-array payloads', () => {
    expect(() => parseTimes({ error: 'x' })).toThrow();
  });
});

describe('parseLocations', () => {
  it('reads the prefixed id/name fields', () => {
    const districts = parseLocations(
      [
        { IlceAdi: 'LONDRA', IlceAdiEn: 'LONDON', IlceID: '14096' },
        { IlceAdi: 'FILTON ', IlceAdiEn: 'FILTON ', IlceID: '14046' },
        { foo: 'bar' },
      ],
      'Ilce',
    );
    expect(districts).toEqual([
      { id: '14096', name: 'LONDRA', nameEn: 'LONDON' },
      { id: '14046', name: 'FILTON', nameEn: 'FILTON' },
    ]);
  });
});

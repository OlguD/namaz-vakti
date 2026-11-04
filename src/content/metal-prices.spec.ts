import { parseTcmb } from './metal-prices.clients.js';
import { toSnapshot, validateSnapshot } from './metal-prices.service.js';

const TCMB_XML = `<?xml version="1.0" encoding="UTF-8"?>
<?xml-stylesheet type="text/xsl" href="isokur.xsl"?>
<Tarih_Date Tarih="20.03.2018" Date="03/20/2018" Bulten_No="2018/56">
  <Currency CrossOrder="0" Kod="USD" CurrencyCode="USD">
    <Unit>1</Unit><Isim>ABD DOLARI</Isim><CurrencyName>US DOLLAR</CurrencyName>
    <ForexBuying>3.9356</ForexBuying><ForexSelling>3.9427</ForexSelling>
    <BanknoteBuying>3.9329</BanknoteBuying><BanknoteSelling>3.9486</BanknoteSelling>
    <CrossRateUSD/><CrossRateOther/>
  </Currency>
  <Currency CrossOrder="1" Kod="AUD" CurrencyCode="AUD">
    <Unit>1</Unit><ForexSelling>3.0360</ForexSelling>
  </Currency>
</Tarih_Date>`;

describe('parseTcmb', () => {
  it('reads the USD forex selling rate and bulletin date (real 2018 bulletin)', () => {
    expect(parseTcmb(TCMB_XML)).toEqual({ rate: 3.9427, date: '2018-03-20' });
  });

  it('fails loudly on a bulletin without USD', () => {
    expect(() => parseTcmb('<Tarih_Date Date="03/20/2018"></Tarih_Date>')).toThrow();
  });
});

describe('metal price snapshot', () => {
  it('converts USD/oz to TRY/g at the official rate', () => {
    const snapshot = toSnapshot(42, '2026-11-04', 3110.34768, 31.1034768);
    expect(snapshot.goldGramPrice).toBe(4200);
    expect(snapshot.silverGramPrice).toBe(42);
  });

  it('rejects broken feeds and sudden jumps, accepts normal moves', () => {
    const base = toSnapshot(42, '2026-11-04', 4000, 48);
    expect(validateSnapshot(base)).toBeNull();
    expect(validateSnapshot(toSnapshot(42, 'x', 0.5, 48))).toMatch(/gold/);
    expect(
      validateSnapshot(toSnapshot(42, 'x', 4000, 48), toSnapshot(42, 'x', 4400, 48)),
    ).toBeNull();
    expect(validateSnapshot(toSnapshot(42, 'x', 6000, 48), base)).toMatch(/goldGramPrice moved/);
    expect(validateSnapshot(toSnapshot(4200, 'x', 4000, 48), base)).toMatch(
      /USD\/TRY out of bounds/,
    );
  });
});

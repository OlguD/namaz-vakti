import {
  checkDisplayName,
  containsLink,
  containsProfanity,
  normalize,
  tidyMessage,
} from './text-filter.js';

describe('normalize', () => {
  it('folds Turkish letters, leetspeak and repeated letters', () => {
    expect(normalize('SIKTIRRR')).toBe('siktir');
    expect(normalize('Şükür')).toBe('sukur');
    expect(normalize('İstanbul')).toBe('istanbul');
    expect(normalize('0r0spu')).toBe('orospu');
  });
});

describe('containsProfanity', () => {
  it.each(['orospu çocuğu', 'S1KT1R git', 'o.r.o.s.p.u', 'amına', 'what the fuck', 'AQ'])(
    'catches %s',
    (text) => {
      expect(containsProfanity(text)).toBe(true);
    },
  );

  it.each([
    'Amin, Allah kabul etsin',
    'Âmin',
    'Hayırlı cumalar',
    'Siklon geliyormuş, dikkatli olun',
    'Amasya’dan selamlar',
    'Gotik mimari çok güzel',
    'Dickens okuyorum',
    'Hamd olsun',
    'Kamil bey nasılsınız',
  ])('allows %s', (text) => {
    expect(containsProfanity(text)).toBe(false);
  });
});

describe('containsLink', () => {
  it('detects links', () => {
    expect(containsLink('bak https://spam.example')).toBe(true);
    expect(containsLink('www.example.org')).toBe(true);
    expect(containsLink('kazan.com da')).toBe(true);
  });

  it('ignores normal sentences with dots', () => {
    expect(containsLink('Vakit 5.30 gibi. Sonra görüşürüz.')).toBe(false);
  });
});

describe('checkDisplayName', () => {
  it('accepts normal names', () => {
    expect(checkDisplayName('Olgu D.')).toBeNull();
    expect(checkDisplayName('Ahmet_34')).toBeNull();
    expect(checkDisplayName('محمد')).toBeNull();
  });

  it('rejects bad names', () => {
    expect(checkDisplayName('ab')).toBe('length');
    expect(checkDisplayName('<script>')).toBe('characters');
    expect(checkDisplayName('Admin123')).toBe('reserved');
    expect(checkDisplayName('Moderatör')).toBe('reserved');
    expect(checkDisplayName('orospu1')).toBe('profanity');
  });
});

describe('tidyMessage', () => {
  it('collapses whitespace', () => {
    expect(tidyMessage('  selam   \n\n\n\n  dünya  ')).toBe('selam \n\n dünya');
  });
});

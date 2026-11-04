import { useEffect, useState } from 'react';
import { ScrollView, TextInput, View } from 'react-native';
import { useZakatRates } from '@/features/content/api';
import { noWebOutline, TitleBar } from '@/features/content/ui';
import { computeZakat, EMPTY_INPUTS, formatTry, parseAmount, type ZakatInputs } from '@/features/content/zakat';
import { dayMonth } from '@/lib/dates';
import { kv } from '@/lib/storage';
import { useTheme } from '@/theme/theme';
import { fonts, radius } from '@/theme/tokens';
import { Button, Icon, Notice, Screen, Touch, Txt } from '@/ui';

/** Device-only storage key: amounts are personal and never sent to the API. */
const SAVED_KEY = 'vakit.zakat.inputs';

type Field = Exclude<keyof ZakatInputs, 'goldPrice' | 'silverPrice'>;

const STEPS: { key: Field; title: string; help: string; unit: '₺' | 'g'; price?: { key: 'goldPrice' | 'silverPrice'; label: string } }[] = [
  { key: 'cash', title: 'Nakit ve banka', help: 'Elinizdeki nakit, vadesiz-vadeli hesaplar ve yatırım fonları.', unit: '₺' },
  { key: 'gold', title: 'Altın', help: 'Ziynet dahil sahip olduğunuz altının toplam gramı (22 ayar ve üzeri saf altına çevrilerek).', unit: 'g', price: { key: 'goldPrice', label: 'Gram altın fiyatı' } },
  { key: 'silver', title: 'Gümüş', help: 'Gümüş eşya ve külçelerin toplam gramı.', unit: 'g', price: { key: 'silverPrice', label: 'Gram gümüş fiyatı' } },
  { key: 'fx', title: 'Döviz', help: 'Döviz hesaplarınızın bugünkü kurla Türk lirası karşılığı.', unit: '₺' },
  { key: 'recv', title: 'Alacaklar', help: 'Geri alınması kuvvetle muhtemel alacaklarınız.', unit: '₺' },
  { key: 'debt', title: 'Borçlar', help: 'Bir yıl içinde ödemeniz gereken borçlar varlıktan düşülür.', unit: '₺' },
];

export default function ZakatScreen() {
  const { c, isDark } = useTheme();
  const rates = useZakatRates();
  const [v, setV] = useState<ZakatInputs>(EMPTY_INPUTS);
  const [step, setStep] = useState(0);
  const [saved, setSaved] = useState<string | null>(null);
  /** Price fields the user has edited (otherwise they follow today's rates). */
  const [focus, setFocus] = useState<string | null>(null);
  const [touched, setTouched] = useState<Partial<Record<keyof ZakatInputs, boolean>>>({});

  // Restore the last saved calculation (device only), then fill missing prices from the API.
  useEffect(() => {
    void kv.get<ZakatInputs>(SAVED_KEY).then((s) => {
      if (!s) return;
      setV((cur) => ({ ...cur, ...s }));
      setTouched({ goldPrice: !!s.goldPrice, silverPrice: !!s.silverPrice });
    });
  }, []);
  // Prices default to today's rates; the user can type their own (kept as an override).
  const r0 = rates.data;
  const inputs: ZakatInputs = {
    ...v,
    goldPrice: touched.goldPrice ? v.goldPrice : r0?.goldGramPrice ? formatTry(r0.goldGramPrice, 2) : '',
    silverPrice: touched.silverPrice ? v.silverPrice : r0?.silverGramPrice ? formatTry(r0.silverGramPrice, 2) : '',
  };

  const nisabGrams = rates.data?.goldNisabGrams ?? 80.18;
  const res = computeZakat(inputs, nisabGrams);
  const s = STEPS[step]!;
  const set = (k: keyof ZakatInputs) => (t: string) => {
    setSaved(null);
    setTouched((x) => ({ ...x, [k]: true }));
    setV((cur) => ({ ...cur, [k]: t.replace(/[^\d.,]/g, '') }));
  };

  const eq = (() => {
    const p = res.parts;
    switch (s.key) {
      case 'gold':
        return `${v.gold || '0'} g × ${formatTry(parseAmount(inputs.goldPrice))} ₺ = ${formatTry(p.gold)} ₺`;
      case 'silver':
        return `${v.silver || '0'} g × ${formatTry(parseAmount(inputs.silverPrice))} ₺ = ${formatTry(p.silver)} ₺`;
      case 'debt':
        return `Düşülen: −${formatTry(p.debt)} ₺`;
      default:
        return `Toplama eklenen: ${formatTry(p[s.key])} ₺`;
    }
  })();

  const max = Math.max(res.net, res.nisab ?? 0) * 1.15 || 1;
  const due = res.due;
  const r = rates.data;
  const priceLine = r?.goldGramPrice
    ? `Gram altın ${formatTry(r.goldGramPrice)} ₺${r.source === 'manual' ? ' · elle girildi' : r.sources.length ? ` · ${r.sources.join(', ')}` : ''}${r.fetchedAt ? ` · ${dayMonth(new Date(r.fetchedAt))}` : ''}`
    : null;

  return (
    <Screen refreshing={rates.isFetching && !rates.isLoading} onRefresh={() => rates.refetch()} pattern={false}>
      <TitleBar title="Zekât hesapla" backLabel="İbadet’e dön" />

      <View
        accessibilityLiveRegion="polite"
        accessibilityLabel={due ? `Verilmesi gereken zekât ${formatTry(res.zakat)} lira. Nisap üzerinde.` : 'Zekât düşmüyor. Nisap altında.'}
        style={{ marginTop: 14, padding: 16, borderRadius: 24, backgroundColor: due ? c.goldTint : c.raised, borderWidth: 1, borderColor: due ? c.goldLine : c.hair }}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
          <View style={{ gap: 2, flexShrink: 1 }}>
            <Txt v="caption" weight="semibold" color={due ? c.goldText : c.text2}>
              {due ? 'Verilmesi gereken zekât · %2,5' : 'Zekât düşmüyor'}
            </Txt>
            <Txt tnum style={{ fontFamily: fonts.thin, fontSize: 42, lineHeight: 48 }}>
              {formatTry(res.zakat)}{' '}
              <Txt v="body" tone="secondary" style={{ fontSize: 18 }}>
                ₺
              </Txt>
            </Txt>
          </View>
          <View style={{ minHeight: 28, paddingHorizontal: 10, borderRadius: 999, justifyContent: 'center', backgroundColor: due ? c.sageTint : isDark ? 'rgba(255,255,255,0.05)' : 'rgba(26,28,33,0.04)' }}>
            <Txt v="small" weight="semibold" color={due ? c.sage : c.text2}>
              {res.nisab === null ? 'Fiyat bekleniyor' : due ? 'Nisap üzerinde' : 'Nisap altında'}
            </Txt>
          </View>
        </View>
        <View aria-hidden style={{ height: 6, marginTop: 12, borderRadius: 3, backgroundColor: isDark ? 'rgba(243,238,228,0.12)' : 'rgba(26,28,33,0.10)' }}>
          <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${Math.max(0, Math.min(100, (res.net / max) * 100))}%`, borderRadius: 3, backgroundColor: due ? c.gold : c.text3 }} />
          {res.nisab ? <View style={{ position: 'absolute', left: `${(res.nisab / max) * 100}%`, top: -4, width: 2, height: 14, marginLeft: -1, borderRadius: 1, backgroundColor: c.text }} /> : null}
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
          <Txt v="small" tone="secondary" tnum>
            Net varlık {formatTry(res.net)} ₺
          </Txt>
          <Txt v="small" tone="secondary" tnum>
            Nisap {res.nisab === null ? '—' : `${formatTry(res.nisab)} ₺`}
          </Txt>
        </View>
      </View>

      {r?.stale ? (
        <View style={{ marginTop: 10 }}>
          <Notice icon="clock" title="Fiyatlar güncel olmayabilir" body={`Altın fiyatı ${r.fetchedAt ? `en son ${dayMonth(new Date(r.fetchedAt))} tarihinde` : 'henüz'} alındı. Hesaplamadan önce gram fiyatını kontrol edin.`} />
        </View>
      ) : rates.isError && !r ? (
        <View style={{ marginTop: 10 }}>
          <Notice icon="offline" title="Güncel fiyatlar alınamadı" body="Gram altın ve gümüş fiyatını kendiniz girerek hesaplayabilirsiniz." />
        </View>
      ) : null}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} accessibilityRole="tablist" accessibilityLabel="Adımlar" contentContainerStyle={{ gap: 6, paddingBottom: 2 }} style={{ marginTop: 14, flexGrow: 0 }}>
        {STEPS.map((x, i) => {
          const sel = i === step;
          return (
            <Touch
              key={x.key}
              onPress={() => setStep(i)}
              accessibilityRole="tab"
              accessibilityState={{ selected: sel }}
              accessibilityLabel={`${i + 1}. ${x.title}`}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 40, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: sel ? c.goldLine : c.hair, backgroundColor: sel ? c.goldTint : 'transparent' }}
            >
              <Txt v="subStrong" tnum color={sel ? c.goldText : i < step ? c.text : c.text2} style={{ opacity: 0.7 }}>
                {i + 1}
              </Txt>
              <Txt v="subStrong" color={sel ? c.goldText : i < step ? c.text : c.text2}>
                {x.title}
              </Txt>
            </Touch>
          );
        })}
      </ScrollView>

      <View style={{ marginTop: 12, paddingVertical: 18, paddingHorizontal: 16, borderRadius: 24, backgroundColor: c.raised, borderWidth: 1, borderColor: c.hair }}>
        <Txt v="titleSm" accessibilityRole="header" style={{ fontSize: 21 }}>
          {s.title}
        </Txt>
        <Txt v="sub" tone="sub" style={{ marginTop: 4 }}>
          {s.help}
        </Txt>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, height: 60, marginTop: 14, paddingHorizontal: 16, borderRadius: radius.md, borderWidth: 1, borderColor: focus === 'main' ? c.goldLine : isDark ? 'rgba(255,255,255,0.16)' : 'rgba(26,28,33,0.16)', backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : c.raised }}>
          <TextInput
            key={s.key}
            value={v[s.key]}
            onChangeText={set(s.key)}
            inputMode="decimal"
            keyboardType="decimal-pad"
            placeholder="0"
            placeholderTextColor={c.text3}
            accessibilityLabel={`${s.title}, ${s.unit === 'g' ? 'gram' : 'Türk lirası'}`}
            onFocus={() => setFocus('main')}
            onBlur={() => setFocus(null)}
            style={[{ flex: 1, minWidth: 0, height: 58, color: c.text, fontFamily: fonts.light, fontSize: 26, fontVariant: ['tabular-nums'] }, noWebOutline]}
          />
          <Txt v="body" tone="secondary">
            {s.unit}
          </Txt>
        </View>
        {s.price ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, minHeight: 48, marginTop: 8, paddingHorizontal: 14, borderRadius: 14, backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(26,28,33,0.04)' }}>
            <Txt v="sub" tone="secondary">
              {s.price.label}
            </Txt>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <TextInput
                value={inputs[s.price.key]}
                onChangeText={set(s.price.key)}
                inputMode="decimal"
                keyboardType="decimal-pad"
                accessibilityLabel={`${s.price.label}, Türk lirası`}
                onFocus={() => setFocus('price')}
                onBlur={() => setFocus(null)}
                style={[{ width: 100, minHeight: 44, textAlign: 'right', color: c.text, fontFamily: fonts.medium, fontSize: 15, fontVariant: ['tabular-nums'], borderBottomWidth: 1, borderBottomColor: focus === 'price' ? c.goldLine : 'transparent' }, noWebOutline]}
              />
              <Txt v="sub" tone="secondary">
                ₺
              </Txt>
            </View>
          </View>
        ) : null}
        <Txt v="small" tone="secondary" tnum style={{ marginTop: 10, fontSize: 12.5 }}>
          {eq}
        </Txt>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
          <Button label="Geri" kind="secondary" disabled={step === 0} onPress={() => setStep((x) => Math.max(0, x - 1))} style={{ flex: 1, minHeight: 52 }} />
          <Button
            label={step === STEPS.length - 1 ? (saved ? 'Kaydedildi' : 'Hesabı kaydet') : 'Devam'}
            icon={step === STEPS.length - 1 && saved ? 'check' : undefined}
            onPress={() => {
              if (step < STEPS.length - 1) setStep(step + 1);
              else void kv.set(SAVED_KEY, v).then(() => setSaved('ok'));
            }}
            style={{ flex: 1, minHeight: 52 }}
          />
        </View>
        {step === STEPS.length - 1 ? (
          <Txt v="small" tone="tertiary" style={{ marginTop: 10 }} accessibilityLiveRegion="polite">
            {saved ? 'Hesap yalnızca bu cihazda saklandı.' : 'Kaydettiğiniz tutarlar yalnızca bu cihazda saklanır.'}
          </Txt>
        ) : null}
      </View>

      {priceLine ? (
        <Txt v="small" tone="tertiary" tnum style={{ marginTop: 10, marginHorizontal: 4 }}>
          {priceLine}
        </Txt>
      ) : null}

      <View style={{ flexDirection: 'row', gap: 10, marginTop: 12, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 16, borderWidth: 1, borderColor: c.hair }}>
        <Icon name="info" size={18} color={c.text2} />
        <Txt v="small" tone="secondary" style={{ flex: 1, lineHeight: 18 }}>
          <Txt v="small" weight="semibold">
            Bilgilendirme amaçlıdır.{' '}
          </Txt>
          Nisap {String(nisabGrams).replace('.', ',')} g altın esas alınarak hesaplanır; malın üzerinden bir kamerî yıl geçmiş olmalıdır. Özel durumlar için bir din görevlisine danışın.
        </Txt>
      </View>
    </Screen>
  );
}

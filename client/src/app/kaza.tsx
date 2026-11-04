import { useRouter } from 'expo-router';
import { useState } from 'react';
import { TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { errorMessage } from '@/api/errors';
import { estimateQada, QADA_KEYS, QADA_LABEL, useApplyQadaEstimate, useQada } from '@/features/worship/api';
import { fmtNum } from '@/features/worship/util';
import { useTheme } from '@/theme/theme';
import { fonts, radius } from '@/theme/tokens';
import { Button, Glass, Icon, IconButton, Notice, Screen, Touch, Txt } from '@/ui';

const TITLES = [
  ['Namaz ne zaman farz oldu?', 'Ergenlik çağından itibaren kılınmayan vakitler kaza borcu sayılır.'],
  ['Düzenli kılmaya ne zaman başladınız?', 'Arada kıldığınız dönemleri de hesaba katalım.'],
  ['Tahmini kaza borcunuz', 'Bu sayıyı namaz takibindeki kaza sayacına aktarabilirsiniz.'],
] as const;

const THIS_YEAR = new Date().getFullYear();

export default function KazaWizardScreen() {
  const { c } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(1);
  const [birth, setBirth] = useState('');
  const [age, setAge] = useState(15);
  const [start, setStart] = useState('');
  const [part, setPart] = useState(25);
  const current = useQada();
  const apply = useApplyQadaEstimate();

  const birthYear = Number(birth);
  const regularSince = Number(start);
  const birthOk = birth.length === 4 && birthYear >= 1900 && birthYear <= THIS_YEAR - 9;
  const startOk = start.length === 4 && regularSince >= 1900 && regularSince <= THIS_YEAR + 1;
  const est = estimateQada({ birthYear: birthOk ? birthYear : 0, pubertyAge: age, regularSince: startOk ? regularSince : 0, prayedPercent: part });
  const canNext = step === 1 ? birthOk : step === 2 ? startOk && regularSince >= birthYear : true;
  const [title, lead] = TITLES[step - 1]!;

  const close = () => (router.canGoBack() ? router.back() : router.replace('/namaz-takibi'));

  return (
    <Screen
      footer={
        <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 20, paddingBottom: insets.bottom + 20, maxWidth: 560, width: '100%', alignSelf: 'center' }}>
          {step > 1 ? <Button kind="secondary" label="Geri" style={{ flex: 1 }} onPress={() => setStep(step - 1)} /> : null}
          {step < 3 ? (
            <Button label="Devam" style={{ flex: 1 }} disabled={!canNext} onPress={() => setStep(step + 1)} />
          ) : (
            <Button
              label="Sayaca ekle"
              style={{ flex: 1 }}
              loading={apply.isPending}
              onPress={() =>
                apply.mutate(
                  { birthYear, pubertyAge: age, regularSince, prayedPercent: part },
                  { onSuccess: () => router.replace('/namaz-takibi') },
                )
              }
            />
          )}
        </View>
      }
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <IconButton icon="close" label="Kapat" onPress={close} />
        <Txt v="subStrong" tone="secondary" tnum>
          Adım {step} / 3
        </Txt>
      </View>
      <View style={{ flexDirection: 'row', gap: 6, marginTop: 16 }} aria-hidden>
        {[1, 2, 3].map((i) => (
          <View key={i} style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: i <= step ? c.gold : c.hair }} />
        ))}
      </View>
      <Txt v="display" accessibilityRole="header" style={{ marginTop: 22, fontSize: 30, lineHeight: 36 }}>
        {title}
      </Txt>
      <Txt v="body" tone="sub" style={{ marginTop: 8 }}>
        {lead}
      </Txt>

      {step === 1 ? (
        <View style={{ gap: 22, marginTop: 24 }}>
          <YearInput label="Doğum yılı" value={birth} onChange={setBirth} placeholder="1992" />
          <View style={{ gap: 8 }}>
            <Txt v="subStrong" tone="secondary">
              Ergenlik (bulûğ) yaşı
            </Txt>
            <Options values={[12, 13, 14, 15]} value={age} onChange={setAge} label={(n) => String(n)} groupLabel="Ergenlik yaşı" />
            <Txt v="small" tone="tertiary">
              Emin değilseniz 15 yaş esas alınabilir.
            </Txt>
          </View>
        </View>
      ) : null}

      {step === 2 ? (
        <View style={{ gap: 22, marginTop: 24 }}>
          <YearInput label="Düzenli kılmaya başladığınız yıl" value={start} onChange={setStart} placeholder={String(THIS_YEAR - 5)} />
          <View style={{ gap: 8 }}>
            <Txt v="subStrong" tone="secondary">
              O dönemde yaklaşık ne kadarını kıldınız?
            </Txt>
            <Options values={[0, 25, 50, 75]} value={part} onChange={setPart} label={(n) => `%${n}`} groupLabel="Kılınan oran" />
          </View>
          {startOk ? (
            <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center', padding: 14, borderRadius: 16, backgroundColor: c.glass, borderWidth: 1, borderColor: c.hair }}>
              <Icon name="calendar" size={18} color={c.goldText} />
              <Txt v="sub" style={{ flex: 1 }}>
                Kılınmayan dönem:{' '}
                <Txt v="subStrong" tnum>
                  {est.fromYear} – {regularSince}
                </Txt>{' '}
                · {est.years} yıl
              </Txt>
            </View>
          ) : null}
        </View>
      ) : null}

      {step === 3 ? (
        <View style={{ gap: 14, marginTop: 24 }}>
          <Glass radius={24} style={{ alignItems: 'center', gap: 4, paddingVertical: 22 }}>
            <Txt v="caption" tone="gold">
              Tahmini toplam
            </Txt>
            <Txt v="countdown" tnum style={{ fontSize: 52, lineHeight: 58 }}>
              {fmtNum(est.total)}
            </Txt>
            <Txt v="sub" tone="secondary" tnum>
              vakit · her vakit için {fmtNum(est.perVakit)}
            </Txt>
          </Glass>
          <Glass radius={20} padded={false}>
            {QADA_KEYS.map((k, i) => (
              <View key={k} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, minHeight: 46, alignItems: 'center', borderTopWidth: i === 0 ? 0 : 1, borderTopColor: c.hair }}>
                <Txt v="callout">{QADA_LABEL[k]}</Txt>
                <Txt v="time" tnum>
                  {fmtNum(est.perVakit)}
                </Txt>
              </View>
            ))}
          </Glass>
          {(current.data?.total ?? 0) > 0 ? (
            <Notice icon="info" tone="gold" title="Mevcut sayaç değişecek" body={`Şu anki kaza sayacınız (${fmtNum(current.data!.total)} vakit) bu tahminle değiştirilir.`} />
          ) : null}
          {apply.error ? <Notice icon="alert" title="Kaydedilemedi" body={errorMessage(apply.error)} /> : null}
          <Txt v="small" tone="secondary">
            Bu sonuç verdiğiniz bilgilere dayanan bir tahmindir. Vitir, Hanefî mezhebine göre eklenmiştir. Kesin hüküm için bir din görevlisine danışın.
          </Txt>
        </View>
      ) : null}
    </Screen>
  );
}

function YearInput({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder: string }) {
  const { c } = useTheme();
  return (
    <View style={{ gap: 8 }}>
      <Txt v="subStrong" tone="secondary">
        {label}
      </Txt>
      <TextInput
        value={value}
        onChangeText={(t) => onChange(t.replace(/[^\d]/g, '').slice(0, 4))}
        keyboardType="number-pad"
        inputMode="numeric"
        placeholder={placeholder}
        placeholderTextColor={c.text3}
        accessibilityLabel={label}
        maxLength={4}
        style={{ minHeight: 56, borderRadius: radius.md, borderWidth: 1, borderColor: c.stroke, backgroundColor: c.input, paddingHorizontal: 16, color: c.text, fontFamily: fonts.light, fontSize: 24 }}
      />
    </View>
  );
}

function Options<T extends number>({ values, value, onChange, label, groupLabel }: { values: T[]; value: T; onChange: (v: T) => void; label: (v: T) => string; groupLabel: string }) {
  const { c } = useTheme();
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={groupLabel} style={{ flexDirection: 'row', gap: 8 }}>
      {values.map((v) => {
        const on = v === value;
        return (
          <Touch
            key={v}
            onPress={() => onChange(v)}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            style={{ flex: 1, minHeight: 48, borderRadius: 14, borderWidth: 1, borderColor: on ? c.goldLine : c.hair, backgroundColor: on ? c.goldTint : 'transparent', alignItems: 'center', justifyContent: 'center' }}
          >
            <Txt v="callout" tnum color={on ? c.goldText : c.text}>
              {label(v)}
            </Txt>
          </Touch>
        );
      })}
    </View>
  );
}

import * as Haptics from 'expo-haptics';
import { Link, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import { useVakitState } from '@/features/prayer/api';
import { useSettings } from '@/features/settings/api';
import { recordTaps } from '@/features/worship/dhikrQueue';
import { WIcon } from '@/features/worship/icons';
import { useDhikrSync } from '@/features/worship/useDhikrSync';
import { localDate, type Vakit } from '@/lib/prayer';
import { useTheme } from '@/theme/theme';
import { fonts } from '@/theme/tokens';
import { Button, Glass, Icon, IconButton, Rosette, SkyBackdrop, Touch, Txt } from '@/ui';

interface Step {
  key: string;
  label: string;
  tr: string;
  ar: string;
  n: number;
}

/** Post-prayer tesbihat (same text as the design; counts feed dhikr statistics). */
const STEPS: Step[] = [
  { key: 'subhanallah', label: 'Sübhânallah', tr: 'Sübhânallah', ar: 'سُبْحَانَ اللّٰهِ', n: 33 },
  { key: 'elhamdulillah', label: 'Elhamdülillah', tr: 'Elhamdülillah', ar: 'اَلْحَمْدُ لِلّٰهِ', n: 33 },
  { key: 'allahuekber', label: 'Allâhu Ekber', tr: 'Allâhu Ekber', ar: 'اَللّٰهُ أَكْبَرُ', n: 33 },
  {
    key: 'tevhid',
    label: 'Tevhid',
    tr: 'Lâ ilâhe illallâhu vahdehû lâ şerîke leh, lehü’l-mülkü ve lehü’l-hamdü ve hüve alâ külli şey’in kadîr.',
    ar: 'لَا إِلٰهَ إِلَّا اللّٰهُ وَحْدَهُ لَا شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ وَهُوَ عَلٰى كُلِّ شَيْءٍ قَدِيرٌ',
    n: 1,
  },
];

const PRAYER_NAME: Record<Vakit, string> = {
  imsak: 'Sabah',
  gunes: 'Sabah',
  ogle: 'Öğle',
  ikindi: 'İkindi',
  aksam: 'Akşam',
  yatsi: 'Yatsı',
};

export default function TesbihatScreen() {
  useDhikrSync();
  const { c, isDark, sky } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { current } = useVakitState();
  const { zikirmatik } = useSettings();
  const [step, setStep] = useState(0);
  const [counts, setCounts] = useState([0, 0, 0, 0]);
  const advance = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (advance.current) clearTimeout(advance.current);
  }, []);
  const done = step >= STEPS.length;
  const vakit = current?.vakit ?? 'ogle';

  const tap = () => {
    const s = STEPS[step];
    if (!s || counts[step]! >= s.n) return;
    const next = counts.slice();
    next[step] = next[step]! + 1;
    setCounts(next);
    recordTaps(localDate(), s.key, 1);
    const reached = next[step]! >= s.n;
    if (zikirmatik.haptics && Platform.OS !== 'web') {
      void (reached ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success) : Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)).catch(() => {});
    }
    if (reached) {
      if (advance.current) clearTimeout(advance.current);
      advance.current = setTimeout(() => setStep((x) => x + 1), 420);
    }
  };

  const close = () => (router.canGoBack() ? router.back() : router.replace('/ibadet'));

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <SkyBackdrop sky={{ ...sky('ogle'), stars: false }} height={700} />

      <View style={{ paddingTop: insets.top + 12, paddingHorizontal: 16, gap: 14, maxWidth: 560, width: '100%', alignSelf: 'center' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <IconButton icon="close" label="Kapat" onPress={close} />
          <View>
            <Txt v="headline">Tesbihat</Txt>
            <Txt v="small" tone="secondary">
              {PRAYER_NAME[vakit]} namazı sonrası
            </Txt>
          </View>
        </View>
        <View accessible accessibilityLabel={`Tesbihat ilerlemesi: adım ${Math.min(step + 1, 4)} / 4`} style={{ flexDirection: 'row', gap: 6 }}>
          {STEPS.map((s, i) => {
            const fill = i < step ? 1 : i === step ? counts[i]! / s.n : 0;
            return (
              <View key={s.key} style={{ flex: 1, gap: 6 }} aria-hidden>
                <View style={{ height: 3, borderRadius: 2, backgroundColor: c.hair, overflow: 'hidden' }}>
                  <View style={{ height: 3, width: `${fill * 100}%`, backgroundColor: c.gold }} />
                </View>
                <Txt v="small" numberOfLines={1} color={i === step ? c.goldText : i < step ? c.text : c.text2} weight={i === step ? 'semibold' : 'medium'} style={{ fontSize: 11 }}>
                  {s.label}
                </Txt>
              </View>
            );
          })}
        </View>
      </View>

      {!done ? (
        <Pressable
          onPress={tap}
          accessibilityRole="button"
          accessibilityLabel={`${STEPS[step]!.label}, ${counts[step]} / ${STEPS[step]!.n}. Saymak için dokunun.`}
          style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, paddingBottom: insets.bottom + 40, gap: 28 }}
        >
          <View style={{ alignItems: 'center', gap: 6 }} pointerEvents="none">
            <Txt v="caption" tone="gold" tnum>
              {step + 1} / 4
            </Txt>
            <Txt v="arabic" center style={step === 3 ? { fontSize: 24, lineHeight: 42 } : { fontSize: 40, lineHeight: 60 }}>
              {STEPS[step]!.ar}
            </Txt>
            <Txt v="title" tone="gold" weight="titleItalic" center style={step === 3 ? { fontSize: 15, lineHeight: 22 } : { fontSize: 20, lineHeight: 26 }}>
              {STEPS[step]!.tr}
            </Txt>
          </View>
          <View style={{ width: 220, height: 220 }} pointerEvents="none">
            <Svg width={220} height={220} viewBox="0 0 220 220" style={{ position: 'absolute' }}>
              <Circle cx={110} cy={110} r={100} fill="none" stroke={c.hair} strokeWidth={1.5} />
              <Circle
                cx={110}
                cy={110}
                r={100}
                fill="none"
                stroke={c.gold}
                strokeWidth={4}
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 100 * (counts[step]! / STEPS[step]!.n)} ${2 * Math.PI * 100}`}
                transform="rotate(-90 110 110)"
              />
            </Svg>
            <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 }}>
              <Txt v="countdown" tnum style={{ fontSize: 72, lineHeight: 76, letterSpacing: -2 }} accessibilityLiveRegion="polite">
                {counts[step]}
              </Txt>
              <Txt v="callout" tone="secondary" tnum style={{ fontFamily: fonts.regular, marginTop: 24 }}>
                / {STEPS[step]!.n}
              </Txt>
            </View>
          </View>
          <Txt v="small" tone="tertiary" pointerEvents="none">
            Ekrana dokunun
          </Txt>
        </Pressable>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 24, gap: 14, maxWidth: 560, width: '100%', alignSelf: 'center' }}>
          <View style={{ alignItems: 'center', gap: 8, marginTop: 18, marginBottom: 6 }}>
            <Txt v="caption" tone="gold">
              Tesbihat tamamlandı
            </Txt>
            <Txt v="display" center accessibilityRole="header">
              Allah kabul etsin
            </Txt>
          </View>
          <Glass radius={24} style={{ gap: 8 }}>
            <Rosette size={140} style={{ right: -36, top: -36 }} />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Txt v="caption" tone="gold">
                Ayetü’l-Kürsi
              </Txt>
              <Txt v="small" tone="secondary">
                Bakara 255
              </Txt>
            </View>
            <Txt v="arabic" style={{ fontSize: 22, lineHeight: 40 }}>
              اللّٰهُ لَا إِلٰهَ إِلَّا هُوَ الْحَيُّ الْقَيُّومُ لَا تَأْخُذُهُ سِنَةٌ وَلَا نَوْمٌ لَهُ مَا فِي السَّمٰوَاتِ وَمَا فِي الْأَرْضِ
            </Txt>
            <Txt v="sub" tone="sub">
              “Allah, O’ndan başka ilah yoktur; diridir, her şeyin varlığı O’na bağlıdır. O’nu ne uyuklama tutar ne de uyku. Göklerde ve yerde ne varsa O’nundur…”
            </Txt>
            <Link href={'/dualar'} asChild>
              <Touch accessibilityRole="link" style={{ minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' }}>
                <Txt v="subStrong" tone="gold">
                  Tamamını oku
                </Txt>
              </Touch>
            </Link>
          </Glass>
          <Link href={'/dualar'} asChild>
            <Touch accessibilityRole="link" accessibilityLabel="Namaz sonrası dua, Dualar · Namaz">
              <Glass radius={20} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{ width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: c.goldTint }}>
                  <WIcon name="dua" color={c.goldText} />
                </View>
                <View style={{ flex: 1 }}>
                  <Txt v="callout">Namaz sonrası dua</Txt>
                  <Txt v="small" tone="secondary">
                    Dualar · Namaz
                  </Txt>
                </View>
                <Icon name="forward" size={18} color={c.text3} />
              </Glass>
            </Touch>
          </Link>
          <Button label="Bitir" onPress={close} style={{ marginTop: 6 }} />
        </ScrollView>
      )}
    </View>
  );
}

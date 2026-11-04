import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { Link, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import { Animated, Easing, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { useSettings, useUpdateSettings } from '@/features/settings/api';
import { useDhikrs, useWorshipSummary, type Dhikr } from '@/features/worship/api';
import { BUILTIN_DHIKRS, nextCount, TARGET_PRESETS } from '@/features/worship/catalog';
import { hydrateDhikrQueue, recordTaps, setRound, unsyncedForDate, useDhikrQueue } from '@/features/worship/dhikrQueue';
import { WIcon } from '@/features/worship/icons';
import { useDhikrSync } from '@/features/worship/useDhikrSync';
import { fmtNum } from '@/features/worship/util';
import { localDate } from '@/lib/prayer';
import { useTheme } from '@/theme/theme';
import { dark, fonts, type Palette } from '@/theme/tokens';
import { Button, Girih, Icon, Sheet, tapFeedback, Touch, Txt } from '@/ui';

/** Night palette: very dim, no sky, for counting in the dark. */
const NIGHT: Palette = {
  ...dark,
  bg: '#020306',
  text: 'rgba(243,238,228,0.48)',
  text2: 'rgba(243,238,228,0.32)',
  text3: 'rgba(243,238,228,0.30)',
  goldText: 'rgba(227,207,164,0.55)',
  hair: 'rgba(243,238,228,0.06)',
  glass: 'rgba(255,255,255,0.03)',
  stroke: 'rgba(255,255,255,0.06)',
};

export default function ZikirScreen() {
  useDhikrSync();
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const settings = useSettings();
  const updateSettings = useUpdateSettings();
  const zs = settings.zikirmatik;
  const today = localDate();
  const summary = useWorshipSummary(today);
  const list = useDhikrs();
  const dhikrs = useMemo<Dhikr[]>(() => [...(list.data?.builtin ?? BUILTIN_DHIKRS), ...(list.data?.custom ?? [])], [list.data]);

  const round = useDhikrQueue((q) => q.round);
  const unsynced = useDhikrQueue((q) => unsyncedForDate(q, today));
  useEffect(() => {
    void hydrateDhikrQueue();
  }, []);

  const [night, setNight] = useState(zs.nightMode);
  const [view, setView] = useState<'ring' | 'beads'>(zs.view);
  const [target, setTarget] = useState(zs.target);
  const [resetOpen, setResetOpen] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);

  const activeKey = round?.key ?? zs.lastDhikrKey ?? 'subhanallah';
  const dhikr = dhikrs.find((d) => d.key === activeKey) ?? dhikrs[0]!;
  const count = round?.key === dhikr.key ? round.count : 0;
  const tours = round?.key === dhikr.key ? round.tours : 1;
  const complete = count >= target;
  const c = night ? NIGHT : theme.c;

  const save = (patch: Partial<typeof zs>) => updateSettings.mutate((s) => ({ ...s, zikirmatik: { ...s.zikirmatik, ...patch } }));

  // Ripple on each tap.
  const [ripple] = useState(() => new Animated.Value(1));
  const tap = () => {
    if (resetOpen) return;
    const next = nextCount(count, tours, target);
    setRound({ key: dhikr.key, count: next.count, tours: next.tours });
    recordTaps(today, dhikr.key, 1);
    ripple.setValue(0);
    Animated.timing(ripple, { toValue: 1, duration: 650, easing: Easing.bezier(0.22, 0.61, 0.36, 1), useNativeDriver: Platform.OS !== 'web' }).start();
    if (zs.haptics && Platform.OS !== 'web') {
      if (next.completed) void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      else void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
  };

  const pick = (d: Dhikr) => {
    tapFeedback();
    setRound({ key: d.key, count: 0, tours: 1 });
    setTarget(d.target);
    save({ lastDhikrKey: d.key, target: d.target });
  };
  const pickTarget = (t: number) => {
    setTarget(t);
    if (count > t) setRound({ key: dhikr.key, count: t, tours });
    save({ target: t });
  };
  const idx = dhikrs.findIndex((d) => d.key === dhikr.key);
  const nextDhikr = dhikrs[(idx + 1) % dhikrs.length]!;
  const todayTotal = (summary.data?.dhikrToday ?? 0) + unsynced;
  const isCustomTarget = !(TARGET_PRESETS as readonly number[]).includes(target);

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <StatusBar style={night || theme.isDark ? 'light' : 'dark'} hidden={night} />
      {!night ? <Backdrop light={!theme.isDark} /> : null}

      {/* The whole middle of the screen counts. */}
      <Pressable
        onPress={tap}
        accessibilityRole="button"
        accessibilityLabel={`Saymak için dokunun. ${dhikr.transliteration}, ${count} / ${target}`}
        accessibilityHint="Her dokunuş bir sayım ekler"
        style={{ position: 'absolute', left: 0, right: 0, top: insets.top + 64, bottom: night ? 0 : 170 + insets.bottom }}
      />

      <View pointerEvents="box-none" style={{ flex: 1, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24, width: '100%', maxWidth: 560, alignSelf: 'center' }}>
        <View pointerEvents="box-none" style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, opacity: night ? 0.5 : 1 }}>
          <RoundButton icon="back" label="İbadet’e dön" c={c} onPress={() => (router.canGoBack() ? router.back() : router.replace('/ibadet'))} />
          <Txt v="subStrong" color={c.text2} style={{ letterSpacing: 1.5, fontFamily: fonts.semibold }}>
            ZİKİRMATİK
          </Txt>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <Touch
              onPress={() => {
                const v = view === 'ring' ? 'beads' : 'ring';
                setView(v);
                save({ view: v });
              }}
              accessibilityRole="button"
              accessibilityLabel={view === 'ring' ? 'Tesbih görünümü' : 'Halka görünümü'}
              style={roundStyle(c)}
            >
              <WIcon name={view === 'ring' ? 'beads' : 'ring'} color={c.text} />
            </Touch>
            <Touch
              onPress={() => {
                setNight(!night);
                save({ nightMode: !night });
              }}
              accessibilityRole="button"
              accessibilityLabel={night ? 'Gece modunu kapat' : 'Gece modu'}
              accessibilityState={{ selected: night }}
              style={[roundStyle(c), night && { backgroundColor: 'rgba(201,169,110,0.10)' }]}
            >
              <Icon name="moon" size={20} color={night ? '#C9A96E' : c.text} />
            </Touch>
          </View>
        </View>

        <View pointerEvents="none" style={{ alignItems: 'center', paddingHorizontal: 24, marginTop: 14, gap: 4, opacity: night ? 0.55 : 1 }}>
          {dhikr.arabic ? (
            <Txt v="arabic" center color={c.text} style={{ fontSize: 36, lineHeight: 56 }} numberOfLines={2} adjustsFontSizeToFit>
              {dhikr.arabic}
            </Txt>
          ) : null}
          <Txt v="title" center color={c.goldText} weight="titleItalic" style={{ fontSize: 19, lineHeight: 24 }}>
            {dhikr.transliteration}
          </Txt>
          {dhikr.meaning && !night ? (
            <Txt v="sub" center color={c.text2} numberOfLines={2}>
              {dhikr.meaning}
            </Txt>
          ) : null}
        </View>

        <View pointerEvents="none" style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          {view === 'ring' ? (
            <CountRing count={count} target={target} complete={complete} night={night} c={c} ripple={ripple} />
          ) : (
            <Beads count={count} target={target} complete={complete} c={c} />
          )}
        </View>

        {complete && !night ? (
          <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 24, marginBottom: 14 }}>
            <Button kind="secondary" compact label="Yeniden başla" style={{ flex: 1 }} onPress={() => setRound({ key: dhikr.key, count: 0, tours })} />
            <Touch
              onPress={() => pick(nextDhikr)}
              accessibilityRole="button"
              accessibilityLabel={`Sonraki: ${nextDhikr.transliteration}`}
              style={{ flex: 1, minHeight: 44, borderRadius: 16, backgroundColor: '#C9A96E', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 }}
            >
              <Txt v="bodyStrong" color="#1A1408" numberOfLines={1} style={{ fontSize: 14 }}>
                Sonraki: {nextDhikr.transliteration}
              </Txt>
            </Touch>
          </View>
        ) : !night ? (
          <Txt v="small" center color={c.text3} tnum style={{ marginBottom: 14 }} pointerEvents="none">
            Tur {tours} · bugün {fmtNum(todayTotal)} · ekrana dokunun
          </Txt>
        ) : (
          <Txt v="small" center color={c.text3} style={{ marginBottom: 14 }} pointerEvents="none">
            Gece modu · ekranı karartın, dokunmaya devam edin
          </Txt>
        )}

        {!night ? (
          <View style={{ gap: 12 }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }} accessibilityRole="radiogroup" accessibilityLabel="Zikir seç">
              {dhikrs.map((d) => {
                const on = d.key === dhikr.key;
                return (
                  <Touch
                    key={d.key}
                    onPress={() => pick(d)}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: on }}
                    style={{ minHeight: 40, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1, borderColor: on ? c.goldLine : c.stroke, backgroundColor: on ? c.goldTint : c.glass, justifyContent: 'center' }}
                  >
                    <Txt v="callout" color={on ? c.goldText : c.text} style={{ fontSize: 14 }}>
                      {d.transliteration}
                    </Txt>
                  </Touch>
                );
              })}
              <Link href="/zikir/ozel" asChild>
                <Touch accessibilityRole="button" style={{ minHeight: 40, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1, borderStyle: 'dashed', borderColor: c.goldLine, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Icon name="plus" size={16} color={c.goldText} />
                  <Txt v="callout" color={c.goldText} style={{ fontSize: 14 }}>
                    Zikir ekle
                  </Txt>
                </Touch>
              </Link>
            </ScrollView>
            <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 16 }}>
              <View accessibilityRole="radiogroup" accessibilityLabel="Hedef" style={{ flex: 1, flexDirection: 'row', gap: 4, padding: 4, borderRadius: 16, backgroundColor: theme.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(26,28,33,0.06)' }}>
                {[...TARGET_PRESETS, 0].map((t) => {
                  const on = t === 0 ? isCustomTarget : t === target;
                  return (
                    <Touch
                      key={t}
                      onPress={() => (t === 0 ? setCustomOpen(true) : pickTarget(t))}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: on }}
                      accessibilityLabel={t === 0 ? `Özel hedef${isCustomTarget ? `, ${target}` : ''}` : `Hedef ${t}`}
                      style={{
                        flex: 1,
                        minHeight: 38,
                        borderRadius: 12,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: on ? (theme.isDark ? 'rgba(255,255,255,0.14)' : '#FFFFFF') : 'transparent',
                      }}
                    >
                      <Txt v="callout" tnum color={on ? c.text : c.text2} style={{ fontSize: 14 }}>
                        {t === 0 ? (isCustomTarget ? String(target) : 'Özel') : String(t)}
                      </Txt>
                    </Touch>
                  );
                })}
              </View>
              <Touch onPress={() => setResetOpen(true)} accessibilityRole="button" accessibilityLabel="Sayacı sıfırla" style={{ width: 46, height: 46, borderRadius: 16, borderWidth: 1, borderColor: c.stroke, backgroundColor: c.glass, alignItems: 'center', justifyContent: 'center' }}>
                <WIcon name="reset" color={c.text2} />
              </Touch>
            </View>
          </View>
        ) : null}
      </View>

      <Sheet visible={resetOpen} onClose={() => setResetOpen(false)} title="Sayaç sıfırlansın mı?">
        <Txt v="body" tone="sub" style={{ fontSize: 14, lineHeight: 21 }}>
          Bu turdaki{' '}
          <Txt v="bodyStrong" tnum style={{ fontSize: 14 }}>
            {count}
          </Txt>{' '}
          sayım sıfırlanır. Bugünkü toplamınız ({fmtNum(todayTotal)}) ve istatistikleriniz korunur.
        </Txt>
        <View style={{ gap: 6, marginTop: 18 }}>
          <Button
            kind="danger"
            label="Sıfırla"
            onPress={() => {
              setRound({ key: dhikr.key, count: 0, tours: 1 });
              setResetOpen(false);
            }}
          />
          <Button kind="ghost" label="Vazgeç" onPress={() => setResetOpen(false)} />
        </View>
      </Sheet>

      <CustomTargetSheet
        key={customOpen ? 'open' : 'closed'}
        visible={customOpen}
        initial={isCustomTarget ? target : 500}
        onClose={() => setCustomOpen(false)}
        onSave={(t) => {
          pickTarget(t);
          setCustomOpen(false);
        }}
      />
    </View>
  );
}

function roundStyle(c: Palette) {
  return { width: 44, height: 44, borderRadius: 999, borderWidth: 1, borderColor: c.stroke, backgroundColor: c.glass, alignItems: 'center' as const, justifyContent: 'center' as const };
}

function RoundButton({ icon, label, c, onPress }: { icon: 'back'; label: string; c: Palette; onPress: () => void }) {
  return (
    <Touch onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={roundStyle(c)}>
      <Icon name={icon} size={20} color={c.text} />
    </Touch>
  );
}

function Backdrop({ light }: { light: boolean }) {
  return (
    <View pointerEvents="none" style={{ position: 'absolute', inset: 0, left: 0, right: 0, top: 0, bottom: 0 }} aria-hidden>
      <Svg width="100%" height="100%" style={{ position: 'absolute' }}>
        <Defs>
          <RadialGradient id="zkBg" cx="50%" cy="45%" rx="70%" ry="45%">
            <Stop offset="0" stopColor="#C9A96E" stopOpacity={light ? 0.16 : 0.1} />
            <Stop offset="1" stopColor="#C9A96E" stopOpacity={0} />
          </RadialGradient>
        </Defs>
        {!light ? <Rect width="100%" height="100%" fill="#05070D" opacity={0.6} /> : null}
        <Rect width="100%" height="100%" fill="url(#zkBg)" />
      </Svg>
      <Girih width="100%" height={900} tile={96} opacity={light ? 0.035 : 0.03} fade={false} />
    </View>
  );
}

const R = 136;
const CIRC = 2 * Math.PI * R;

function CountRing({ count, target, complete, night, c, ripple }: { count: number; target: number; complete: boolean; night: boolean; c: Palette; ripple: Animated.Value }) {
  const size = night ? 320 : 300;
  const p = Math.min(1, count / Math.max(1, target));
  const ticks = target <= 33 && !night ? target : 0;
  return (
    <View style={{ width: size, height: size }}>
      {complete && !night ? (
        <View
          style={{
            position: 'absolute',
            left: 14,
            top: 14,
            right: 14,
            bottom: 14,
            borderRadius: 999,
            backgroundColor: c.goldTint,
            borderWidth: 1,
            borderColor: c.goldLine,
            shadowColor: '#C9A96E',
            shadowOpacity: 0.45,
            shadowRadius: 40,
          }}
        />
      ) : null}
      <Animated.View
        style={{
          position: 'absolute',
          left: 14,
          top: 14,
          right: 14,
          bottom: 14,
          borderRadius: 999,
          borderWidth: 1.5,
          borderColor: c.gold,
          opacity: ripple.interpolate({ inputRange: [0, 1], outputRange: [0.6, 0] }),
          transform: [{ scale: ripple.interpolate({ inputRange: [0, 1], outputRange: [1, 1.16] }) }],
        }}
      />
      <Svg width={size} height={size} viewBox="0 0 300 300" style={{ position: 'absolute' }}>
        <Circle cx={150} cy={150} r={R} fill="none" stroke={c.hair} strokeWidth={1.5} />
        {Array.from({ length: ticks }, (_, i) => {
          const a = (i / ticks) * 2 * Math.PI - Math.PI / 2;
          return <Circle key={i} cx={150 + R * Math.cos(a)} cy={150 + R * Math.sin(a)} r={2.5} fill={night ? c.hair : c.text3} opacity={0.6} />;
        })}
        <Circle
          cx={150}
          cy={150}
          r={R}
          fill="none"
          stroke={night ? 'rgba(201,169,110,0.45)' : '#C9A96E'}
          strokeWidth={4}
          strokeLinecap="round"
          strokeDasharray={`${CIRC * p} ${CIRC}`}
          transform="rotate(-90 150 150)"
        />
      </Svg>
      <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
        {complete && !night ? (
          <Txt v="title" color={c.goldText} style={{ fontSize: 22, lineHeight: 26 }}>
            Tamamlandı
          </Txt>
        ) : null}
        <Txt
          v="countdown"
          tnum
          accessibilityLiveRegion="polite"
          color={complete && !night ? c.goldText : c.text}
          style={{ fontSize: night ? 148 : 104, lineHeight: night ? 150 : 108, letterSpacing: -3 }}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {count}
        </Txt>
        <Txt v="callout" tnum color={c.text2} style={{ fontSize: 16, marginTop: 6, fontFamily: fonts.regular }}>
          / {target}
        </Txt>
      </View>
    </View>
  );
}

const SPACING = 46;

function Beads({ count, target, complete, c }: { count: number; target: number; complete: boolean; c: Palette }) {
  const n = Math.min(target, 33);
  const cyc = count === 0 ? 0 : ((count - 1) % 33) + 1;
  const [shift] = useState(() => new Animated.Value(185 - cyc * SPACING));
  useEffect(() => {
    Animated.timing(shift, { toValue: 185 - cyc * SPACING, duration: 380, easing: Easing.bezier(0.22, 0.61, 0.36, 1), useNativeDriver: Platform.OS !== 'web' }).start();
  }, [cyc, shift]);
  return (
    <View style={{ width: '100%', alignItems: 'center', gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
        <Txt v="countdown" tnum accessibilityLiveRegion="polite" color={complete ? c.goldText : c.text} style={{ fontSize: 64, lineHeight: 68, letterSpacing: -2 }}>
          {count}
        </Txt>
        <Txt v="callout" tnum color={c.text2} style={{ fontSize: 16, fontFamily: fonts.regular }}>
          / {target}
        </Txt>
      </View>
      <View style={{ width: '100%', height: 360, overflow: 'hidden' }}>
        <View style={{ position: 'absolute', left: '50%', marginLeft: -0.75, top: 0, bottom: 0, width: 1.5, backgroundColor: c.goldLine, opacity: 0.8 }} />
        <View style={{ position: 'absolute', left: 96, right: 96, top: 179, height: 1, backgroundColor: c.goldLine }} />
        <Animated.View style={{ position: 'absolute', left: 0, right: 0, top: 0, transform: [{ translateY: shift }] }}>
          {Array.from({ length: n }, (_, i) => {
            const counted = i < cyc;
            return (
              <View
                key={i}
                style={{
                  position: 'absolute',
                  left: '50%',
                  marginLeft: -17,
                  top: i * SPACING,
                  width: 34,
                  height: 34,
                  borderRadius: 17,
                  backgroundColor: counted ? '#C9A96E' : c.raised,
                  borderWidth: 1,
                  borderColor: counted ? '#E3CFA4' : c.stroke,
                  shadowColor: counted ? '#C9A96E' : '#000',
                  shadowOpacity: counted ? 0.6 : 0.3,
                  shadowRadius: 8,
                  shadowOffset: { width: 0, height: 4 },
                }}
              />
            );
          })}
          <View style={{ position: 'absolute', left: '50%', marginLeft: -13, top: n * SPACING, width: 26, height: 58, borderRadius: 13, backgroundColor: '#C9A96E', borderWidth: 1, borderColor: '#E3CFA4' }} />
          <View style={{ position: 'absolute', left: '50%', marginLeft: -1, top: n * SPACING + 58, width: 2, height: 46, backgroundColor: '#C9A96E', opacity: 0.6 }} />
        </Animated.View>
        <LinearGradient pointerEvents="none" colors={[c.bg, withAlpha(c.bg)]} style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 80 }} />
        <LinearGradient pointerEvents="none" colors={[withAlpha(c.bg), c.bg]} style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 80 }} />
      </View>
    </View>
  );
}

function CustomTargetSheet({ visible, initial, onClose, onSave }: { visible: boolean; initial: number; onClose: () => void; onSave: (n: number) => void }) {
  const { c } = useTheme();
  const [value, setValue] = useState(String(initial));
  const n = Math.round(Number(value));
  const ok = Number.isFinite(n) && n >= 1 && n <= 100_000;
  return (
    <Sheet visible={visible} onClose={onClose} title="Özel hedef">
      <Txt v="sub" tone="sub">
        Bu zikir için kaç tekrar hedefliyorsunuz?
      </Txt>
      <TextInput
        value={value}
        onChangeText={(t) => setValue(t.replace(/[^\d]/g, ''))}
        keyboardType="number-pad"
        accessibilityLabel="Hedef sayısı"
        maxLength={6}
        autoFocus
        style={{ marginTop: 14, minHeight: 56, borderRadius: 16, borderWidth: 1, borderColor: c.stroke, backgroundColor: c.input, color: c.text, textAlign: 'center', fontFamily: fonts.light, fontSize: 28 }}
      />
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
        {[500, 1000, 1001, 4444].map((p) => (
          <Touch key={p} onPress={() => setValue(String(p))} accessibilityRole="button" style={{ flex: 1, minHeight: 40, borderRadius: 12, borderWidth: 1, borderColor: c.hair, alignItems: 'center', justifyContent: 'center' }}>
            <Txt v="callout" tnum style={{ fontSize: 14 }}>
              {p}
            </Txt>
          </Touch>
        ))}
      </View>
      <Button label="Kaydet" disabled={!ok} style={{ marginTop: 18 }} onPress={() => onSave(n)} />
    </Sheet>
  );
}

/** Transparent version of a #RRGGBB colour (for fades). */
function withAlpha(hex: string): string {
  return /^#[0-9a-f]{6}$/i.test(hex) ? `${hex}00` : 'transparent';
}

import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { Animated, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, G, Rect } from 'react-native-svg';
import { useEsma, useFavorites } from '@/features/content/api';
import { FavButton } from '@/features/content/ui';
import { useReducedMotion } from '@/lib/a11y';
import { useTheme } from '@/theme/theme';
import { fonts } from '@/theme/tokens';
import { Button, Icon, IconButton, Screen, Skeleton, StateView, Touch, Txt } from '@/ui';

export default function EsmaDetailScreen() {
  const { no: raw } = useLocalSearchParams<{ no: string }>();
  const router = useRouter();
  const { c, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const { data, isLoading, refetch } = useEsma();
  const fav = useFavorites();
  const no = Number(raw);
  const total = data?.length ?? 99;
  const n = data?.find((x) => x.no === no);
  const goldStroke = isDark ? c.gold : '#9A7A3C';

  const [fade] = useState(() => new Animated.Value(1));
  useEffect(() => {
    if (reduced) return;
    fade.setValue(0);
    Animated.timing(fade, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, [no, fade, reduced]);

  const go = (d: number) => {
    const target = ((no - 1 + d + total) % total) + 1;
    router.setParams({ no: String(target) });
  };

  const header = (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <LinearGradient
      aria-hidden
      pointerEvents="none"
      colors={isDark ? ['#0E1230', '#2A2350', '#181634', '#0B0F17'] : ['#C9BEDB', '#E9D9E3', '#F6F1E7', '#F6F1E7']}
      locations={[0, 0.34, 0.66, 1]}
      style={{ position: 'absolute', left: -40, right: -40, top: -(insets.top + 8), height: 520 }}
    />

      <IconButton icon="back" label="Listeye dön" onPress={() => (router.canGoBack() ? router.back() : router.replace('/esma'))} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Txt v="sub" tone="secondary" tnum accessibilityLabel={`${no}. isim, toplam ${total}`}>
          {no} / {total}
        </Txt>
        {n ? <FavButton on={fav.isEsmaFav(n.no)} onPress={() => fav.toggleEsma(n.no)} label={fav.isEsmaFav(n.no) ? 'Favorilerden çıkar' : 'Favorilere ekle'} /> : null}
      </View>
    </View>
  );

  const footer = n ? (
    <View style={{ position: 'absolute', left: 0, right: 0, bottom: insets.bottom + 20, alignItems: 'center', paddingHorizontal: 16 }}>
      <View style={{ width: '100%', maxWidth: 528, flexDirection: 'row', gap: 8 }}>
        <Touch onPress={() => go(-1)} accessibilityRole="button" accessibilityLabel="Önceki isim" style={navBtn(c)}>
          <Icon name="back" size={20} />
        </Touch>
        <Button
          label="Zikirmatikte çek"
          style={{ flex: 1, minHeight: 56 }}
          onPress={() => router.push(`/zikir?esma=${n.no}` as Href)}
          accessibilityHint={`${n.transliteration} ismini zikirmatikte açar`}
        />
        <Touch onPress={() => go(1)} accessibilityRole="button" accessibilityLabel="Sonraki isim" style={navBtn(c)}>
          <Icon name="forward" size={20} />
        </Touch>
      </View>
    </View>
  ) : null;

  return (
    <Screen header={header} footer={footer} pattern={false} contentStyle={{ paddingBottom: insets.bottom + 110 }}>
      {isLoading && !data ? (
        <View style={{ alignItems: 'center', gap: 16, marginTop: 30 }}>
          <Skeleton width={240} height={240} r={120} />
          <Skeleton width={180} height={32} />
          <Skeleton height={60} />
        </View>
      ) : !n ? (
        <StateView
          icon="star"
          title={data ? 'İsim bulunamadı' : 'İsimler yüklenemedi'}
          action={data ? <Button label="Listeye dön" kind="secondary" onPress={() => router.replace('/esma')} /> : <Button label="Tekrar dene" kind="secondary" onPress={() => refetch()} />}
        />
      ) : (
        <Animated.View style={{ opacity: fade }}>
          <View style={{ width: 280, height: 280, alignSelf: 'center', marginTop: 8 }}>
            <Svg width={280} height={280} viewBox="0 0 280 280" style={{ position: 'absolute' }} aria-hidden>
              <G fill="none" stroke={goldStroke} strokeWidth={0.8} opacity={0.55}>
                <Rect x="50" y="50" width="180" height="180" rx="4" />
                <Rect x="50" y="50" width="180" height="180" rx="4" transform="rotate(45 140 140)" />
              </G>
              <Circle cx="140" cy="140" r="104" fill="none" stroke={goldStroke} strokeWidth={0.6} opacity={0.35} />
              <Circle cx="140" cy="140" r="134" fill="none" stroke={goldStroke} strokeWidth={0.6} opacity={0.18} strokeDasharray="2 6" />
            </Svg>
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
              <Txt lang="ar" center adjustsFontSizeToFit numberOfLines={1} style={{ fontFamily: fonts.arabicBold, fontSize: n.arabic.length > 10 ? 44 : 62, lineHeight: 100, color: c.goldText, writingDirection: 'rtl', maxWidth: 180 }}>
                {n.arabic}
              </Txt>
            </View>
          </View>
          <Txt accessibilityRole="header" center style={{ fontFamily: fonts.display, fontSize: 32, lineHeight: 38, marginTop: 14 }}>
            {n.transliteration}
          </Txt>
          <Txt v="body" tone="sub" style={{ marginTop: 16, lineHeight: 23 }}>
            {n.meaningTr}
          </Txt>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 14, borderWidth: 1, borderColor: c.hair }}>
            <Icon name="book" size={16} color={c.text2} strokeWidth={1.6} />
            <Txt v="small" tone="secondary" style={{ flex: 1, fontSize: 12.5 }}>
              {n.no}. isim · Tirmizî rivayetindeki sıraya göre
            </Txt>
          </View>
        </Animated.View>
      )}
    </Screen>
  );
}

function navBtn(c: { stroke: string; glass: string }) {
  return { width: 56, height: 56, borderRadius: 16, borderWidth: 1, borderColor: c.stroke, backgroundColor: c.glass, alignItems: 'center' as const, justifyContent: 'center' as const };
}

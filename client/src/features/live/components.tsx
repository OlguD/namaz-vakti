import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Link } from 'expo-router';
import { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, G, Path } from 'react-native-svg';
import { useReducedMotion } from '@/lib/a11y';
import { useTheme } from '@/theme/theme';
import { Icon, Touch, Txt } from '@/ui';
import type { LiveCategory, LiveStream } from './api';
import { CATEGORY_ART, compactCount } from './format';

const INK = '#F3EEE4';

/** Category glyphs (design: Live.dc.html ICON map). */
const CATEGORY_GLYPH: Record<LiveCategory, string> = {
  haramain: 'M5 8l7-3 7 3v9l-7 3-7-3zM5 8l7 3 7-3M12 11v9M5 11.5l7 3 7-3',
  dua: 'M15 4a8 8 0 1 0 5 14A7 7 0 0 1 15 4z',
  quran: 'M12 6.5C10 5 7 4.5 4 5v13c3-.5 6 0 8 1.5 2-1.5 5-2 8-1.5V5c-3-.5-6 0-8 1.5zM12 6.5v13',
  sohbet: 'M4 7a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v7a3 3 0 0 1-3 3h-7l-4 3v-3a3 3 0 0 1-2-3z',
  other: 'M12 10.2a1.8 1.8 0 1 0 0 3.6 1.8 1.8 0 0 0 0-3.6M8.2 8.2a5.4 5.4 0 0 0 0 7.6M15.8 8.2a5.4 5.4 0 0 1 0 7.6',
};

export function CategoryGlyph({ category, size = 22, color = '#E3CFA4' }: { category: LiveCategory; size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <Path d={CATEGORY_GLYPH[category]} />
    </Svg>
  );
}

export function EyeIcon({ size = 14, color = INK }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <Path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
      <Circle cx="12" cy="12" r="2.5" />
    </Svg>
  );
}

/** Thumbnail with the category gradient behind it (shown offline / while loading). */
export function StreamArt({
  stream,
  style,
  stars,
  children,
}: {
  stream: Pick<LiveStream, 'thumbnailUrl' | 'channel'>;
  style?: StyleProp<ViewStyle>;
  stars?: boolean;
  children?: React.ReactNode;
}) {
  const colors = CATEGORY_ART[stream.channel.category] ?? CATEGORY_ART.other;
  return (
    <View style={[{ overflow: 'hidden', backgroundColor: '#05070D' }, style]}>
      <LinearGradient colors={colors} style={StyleSheet.absoluteFill} />
      {stars ? (
        <Svg width="100%" height="100%" viewBox="0 0 353 214" preserveAspectRatio="xMidYMid slice" style={StyleSheet.absoluteFill} aria-hidden>
          <G fill={INK}>
            <Circle cx="30" cy="30" r="0.8" opacity={0.7} />
            <Circle cx="88" cy="18" r="0.6" opacity={0.5} />
            <Circle cx="260" cy="26" r="0.8" opacity={0.7} />
            <Circle cx="320" cy="50" r="0.6" opacity={0.5} />
            <Circle cx="200" cy="12" r="0.5" opacity={0.4} />
          </G>
        </Svg>
      ) : null}
      {stream.thumbnailUrl ? (
        <Image source={{ uri: stream.thumbnailUrl }} style={StyleSheet.absoluteFill} contentFit="cover" transition={300} accessible={false} />
      ) : (
        <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
          <CategoryGlyph category={stream.channel.category} size={34} color="rgba(227,207,164,0.55)" />
        </View>
      )}
      {children}
    </View>
  );
}

/** Gold pulsing "CANLI" pill drawn on top of video art (always on dark). */
export function LivePill({ small }: { small?: boolean }) {
  const reduced = useReducedMotion();
  const [pulse] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (reduced) return;
    const loop = Animated.loop(Animated.timing(pulse, { toValue: 1, duration: 2400, easing: Easing.out(Easing.ease), useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [pulse, reduced]);
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        height: small ? 26 : 28,
        paddingHorizontal: small ? 10 : 12,
        borderRadius: 999,
        backgroundColor: 'rgba(11,15,23,0.55)',
        borderWidth: 1,
        borderColor: 'rgba(201,169,110,0.55)',
      }}
    >
      <View style={{ width: 6, height: 6 }}>
        <Animated.View
          style={{
            position: 'absolute',
            width: 6,
            height: 6,
            borderRadius: 3,
            backgroundColor: '#C9A96E',
            opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.7, 0] }),
            transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 2.4] }) }],
          }}
        />
        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#C9A96E' }} />
      </View>
      <Txt v="caption" color="#E3CFA4" weight="semibold" style={{ fontSize: small ? 10.5 : 11 }}>
        CANLI
      </Txt>
    </View>
  );
}

export function ViewersPill({ count }: { count: number | null }) {
  const label = compactCount(count);
  if (!label) return null;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, height: 28, paddingHorizontal: 10, borderRadius: 999, backgroundColor: 'rgba(11,15,23,0.55)' }}>
      <EyeIcon />
      <Txt v="small" color={INK} tnum weight="medium">
        {label} izliyor
      </Txt>
    </View>
  );
}

/** Big card for the first live stream (design: 214pt tall). */
export function FeaturedStream({ stream, offline }: { stream: LiveStream; offline?: boolean }) {
  const { c } = useTheme();
  const viewers = compactCount(stream.concurrentViewers);
  return (
    <Link href={{ pathname: '/yayin/[videoId]', params: { videoId: stream.videoId } }} asChild>
      <Touch
        accessibilityRole="button"
        accessibilityLabel={`Canlı: ${stream.title}, ${stream.channel.title}${viewers ? `, ${viewers} izliyor` : ''}. İzle`}
        style={{ borderRadius: 26, opacity: offline ? 0.6 : 1 }}
      >
        <StreamArt
          stream={stream}
          stars
          style={{ height: 214, borderRadius: 26, borderWidth: 1, borderColor: c.hair, shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 24, shadowOffset: { width: 0, height: 20 } }}
        >
          <LinearGradient colors={['rgba(5,7,13,0)', 'rgba(5,7,13,0.86)']} locations={[0.38, 1]} style={StyleSheet.absoluteFill} />
          <View style={{ position: 'absolute', left: 14, right: 14, top: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <LivePill />
            <ViewersPill count={stream.concurrentViewers} />
          </View>
          <View style={{ position: 'absolute', left: 16, right: 16, bottom: 14, flexDirection: 'row', alignItems: 'flex-end', gap: 12 }}>
            <View style={{ flex: 1, gap: 4 }}>
              <Txt v="titleSm" color={INK} numberOfLines={2} style={{ fontSize: 21, lineHeight: 26 }}>
                {stream.title}
              </Txt>
              <Txt v="sub" color="rgba(243,238,228,0.8)" numberOfLines={1}>
                {stream.channel.title}
              </Txt>
            </View>
            <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: '#C9A96E', alignItems: 'center', justifyContent: 'center' }}>
              <Svg width={20} height={20} viewBox="0 0 24 24" aria-hidden>
                <Path d="M8 5.5v13l10-6.5z" fill="#1A1408" />
              </Svg>
            </View>
          </View>
          {offline ? (
            <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
              <View style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: 'rgba(11,15,23,0.8)' }}>
                <Txt v="subStrong" color={INK}>
                  Bağlantı bekleniyor
                </Txt>
              </View>
            </View>
          ) : null}
        </StreamArt>
      </Touch>
    </Link>
  );
}

/** Small round monogram for a channel (gold ring when live). */
export function ChannelMono({ text, live, size = 48 }: { text: string; live?: boolean; size?: number }) {
  const { c } = useTheme();
  return (
    <View
      aria-hidden
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: c.raised,
        borderWidth: 1.5,
        borderColor: live ? c.gold : c.stroke,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Txt v="titleSm" tone="gold" style={{ fontSize: size * 0.38, lineHeight: size * 0.5 }}>
        {text}
      </Txt>
    </View>
  );
}

export function BellButton({ on, onPress, label }: { on: boolean; onPress: () => void; label: string }) {
  const { c } = useTheme();
  return (
    <Touch
      onPress={onPress}
      accessibilityRole="switch"
      accessibilityState={{ checked: on }}
      accessibilityLabel={label}
      style={{
        width: 44,
        height: 44,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: on ? c.goldLine : c.hair,
        backgroundColor: on ? c.goldTint : 'transparent',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Svg width={18} height={18} viewBox="0 0 24 24" fill={on ? c.goldText : 'none'} stroke={on ? c.goldText : c.text2} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <Path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15zM10 20.5a2 2 0 0 0 4 0" />
      </Svg>
    </Touch>
  );
}

export function OfflineStrip({ text }: { text: string }) {
  const { c } = useTheme();
  return (
    <View
      accessibilityRole="alert"
      style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 14, backgroundColor: c.cautionTint, borderWidth: 1, borderColor: c.cautionLine }}
    >
      <Icon name="offline" size={18} color={c.caution} strokeWidth={1.6} />
      <Txt v="sub" style={{ flex: 1 }}>
        {text}
      </Txt>
    </View>
  );
}

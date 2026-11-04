import { LinearGradient } from 'expo-linear-gradient';
import { memo, useId } from 'react';
import { Platform, StyleSheet, View, type ViewStyle } from 'react-native';
import Svg, { Circle, Defs, G, Path, Pattern, Rect, RadialGradient, Stop, LinearGradient as SvgLinear, Mask } from 'react-native-svg';
import type { Sky } from '@/theme/tokens';
import { useTheme } from '@/theme/theme';

/** Girih (eight-point star) tile used at 3–7% opacity behind headers. */
export const Girih = memo(function Girih({
  width,
  height,
  tile = 72,
  color,
  opacity,
  fade = true,
  style,
}: {
  width: number | `${number}%`;
  height: number;
  tile?: number;
  color?: string;
  opacity?: number;
  fade?: boolean;
  style?: ViewStyle;
}) {
  const { c } = useTheme();
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const s = tile / 72;
  return (
    <Svg width={width} height={height} style={[{ position: 'absolute', left: 0, top: 0 }, style]} pointerEvents="none" aria-hidden>
      <Defs>
        <Pattern id={`g${id}`} width={tile} height={tile} patternUnits="userSpaceOnUse">
          <G fill="none" stroke={color ?? c.pattern} strokeWidth={0.6} transform={`scale(${s})`}>
            <Rect x="21" y="21" width="30" height="30" />
            <Rect x="21" y="21" width="30" height="30" transform="rotate(45 36 36)" />
            <Path d="M36 0V15M36 57V72M0 36H15M57 36H72M0 0L21 21M72 0L51 21M0 72L21 51M72 72L51 51" />
          </G>
        </Pattern>
        <SvgLinear id={`f${id}`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#fff" stopOpacity="1" />
          <Stop offset="1" stopColor="#fff" stopOpacity="0" />
        </SvgLinear>
        <Mask id={`m${id}`}>
          <Rect width="100%" height="100%" fill={fade ? `url(#f${id})` : '#fff'} />
        </Mask>
      </Defs>
      <Rect width="100%" height="100%" fill={`url(#g${id})`} opacity={opacity ?? c.patternOpacity} mask={`url(#m${id})`} />
    </Svg>
  );
});

/** Single girih rosette used as a corner ornament on cards and sheets. */
export function Rosette({ size = 140, style, opacity = 0.08, color }: { size?: number; style?: ViewStyle; opacity?: number; color?: string }) {
  const { c } = useTheme();
  return (
    <Svg width={size} height={size} viewBox="0 0 72 72" style={[{ position: 'absolute' }, style]} pointerEvents="none" aria-hidden opacity={opacity}>
      <G fill="none" stroke={color ?? c.pattern} strokeWidth={0.6}>
        <Rect x="21" y="21" width="30" height="30" />
        <Rect x="21" y="21" width="30" height="30" transform="rotate(45 36 36)" />
        <Circle cx="36" cy="36" r="8" />
      </G>
    </Svg>
  );
}

const STARS: [number, number, number, number][] = [
  [34, 74, 0.8, 0.7], [92, 40, 0.6, 0.5], [300, 120, 0.7, 0.6], [352, 58, 0.9, 0.8],
  [248, 30, 0.6, 0.45], [170, 20, 0.5, 0.4], [18, 160, 0.5, 0.35], [140, 96, 0.7, 0.5],
  [210, 150, 0.6, 0.4], [370, 180, 0.5, 0.35], [60, 210, 0.6, 0.3],
];

/** Faint star field for İmsak and Yatsı skies. */
export function Stars({ width = 393, height = 240 }: { width?: number; height?: number }) {
  return (
    <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMin slice" style={StyleSheet.absoluteFill} pointerEvents="none" aria-hidden>
      <G fill="#F3EEE4">
        {STARS.map(([x, y, r, o], i) => (
          <Circle key={i} cx={x} cy={y} r={r} opacity={o} />
        ))}
      </G>
    </Svg>
  );
}

/** The vakit sky: gradient + glow + stars + girih, filling its parent. */
export function SkyBackdrop({ sky, height = 852, glowTop = 150 }: { sky: Sky; height?: number; glowTop?: number }) {
  const { c } = useTheme();
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const glow = sky.glow.replace(/rgba\((\d+),(\d+),(\d+),[^)]+\)/, 'rgb($1,$2,$3)');
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: c.bg }]} pointerEvents="none" aria-hidden>
      <LinearGradient colors={sky.colors} locations={sky.locations} style={{ position: 'absolute', left: 0, right: 0, top: 0, height }} />
      <Svg width="100%" height={340} style={{ position: 'absolute', top: glowTop, left: 0 }} aria-hidden>
        <Defs>
          <RadialGradient id={`s${id}`} cx="50%" cy="50%" rx="60%" ry="50%">
            <Stop offset="0" stopColor={glow} stopOpacity={alphaOf(sky.glow)} />
            <Stop offset="1" stopColor={glow} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect width="100%" height="100%" fill={`url(#s${id})`} />
      </Svg>
      {sky.stars ? <Stars /> : null}
      <Girih width="100%" height={520} color={sky.onDark ? '#E3CFA4' : c.pattern} />
    </View>
  );
}

function alphaOf(rgba: string): number {
  const m = /rgba\([^,]+,[^,]+,[^,]+,\s*([\d.]+)\)/.exec(rgba);
  return m ? Number(m[1]) : 0.3;
}

/** Web-only frosted glass (RN has no portable backdrop blur). */
export const webBlur: ViewStyle =
  Platform.OS === 'web'
    ? ({ backdropFilter: 'blur(24px) saturate(140%)', WebkitBackdropFilter: 'blur(24px) saturate(140%)' } as unknown as ViewStyle)
    : {};

import { memo, useMemo } from 'react';
import { Platform, View } from 'react-native';
import Svg, { Circle, G, Path, Rect, Text as SvgText } from 'react-native-svg';
import { useTheme } from '@/theme/theme';
import { fonts } from '@/theme/tokens';
import { Txt } from '@/ui';
import { shortestDelta } from './compass';

const S = 320;
const C = S / 2;

const rad = (a: number) => (a * Math.PI) / 180;
const pt = (a: number, r: number): [number, number] => [C + r * Math.sin(rad(a)), C - r * Math.cos(rad(a))];
const f = (n: number) => n.toFixed(2);

function arc(a1: number, a2: number, r: number): string {
  const [sx, sy] = pt(a1, r);
  const [ex, ey] = pt(a2, r);
  const sweep = a2 > a1 ? 1 : 0;
  const large = Math.abs(a2 - a1) > 180 ? 1 : 0;
  return `M${f(sx)} ${f(sy)}A${r} ${r} 0 ${large} ${sweep} ${f(ex)} ${f(ey)}`;
}

/** Static tick paths (computed once). */
const TICKS = (() => {
  let minor = '';
  let major = '';
  for (let i = 0; i < 72; i++) {
    const a = i * 5;
    const isMajor = i % 6 === 0;
    const [x1, y1] = pt(a, isMajor ? 120 : 128);
    const [x2, y2] = pt(a, 136);
    const seg = `M${f(x1)} ${f(y1)}L${f(x2)} ${f(y2)}`;
    if (isMajor) major += seg;
    else minor += seg;
  }
  return { minor, major };
})();

const LABELS: { a: number; t: string; strong: boolean }[] = [
  { a: 0, t: 'K', strong: true },
  { a: 90, t: 'D', strong: false },
  { a: 180, t: 'G', strong: false },
  { a: 270, t: 'B', strong: false },
];

/**
 * The compass dial from the design: the rose turns with the phone (−heading)
 * so the Kaaba marker sits at the real qibla direction, while the pointer at
 * the top shows where the phone faces.
 */
export const CompassDial = memo(function CompassDial({
  qibla,
  heading,
  aligned,
  loading,
  dimmed,
  caption,
  value,
  footer,
  label,
}: {
  qibla: number;
  /** null = no live heading: north stays up. */
  heading: number | null;
  aligned: boolean;
  loading: boolean;
  dimmed?: boolean;
  caption: string;
  value: string;
  footer: string;
  label: string;
}) {
  const { c, isDark } = useTheme();
  const h = heading ?? 0;
  const delta = heading == null ? 0 : shortestDelta(h, qibla);
  const showDelta = !aligned && !loading && heading != null && Math.abs(delta) > 3;
  const tick = isDark ? 'rgba(243,238,228,0.28)' : 'rgba(26,28,33,0.28)';
  const tickMajor = isDark ? 'rgba(243,238,228,0.62)' : 'rgba(26,28,33,0.62)';
  const ring = isDark ? 'rgba(243,238,228,0.22)' : 'rgba(26,28,33,0.20)';
  const gold = isDark ? c.gold : '#9A7A3C';

  const geom = useMemo(() => {
    const [kx, ky] = pt(qibla, 152);
    const [r1x, r1y] = pt(qibla, 60);
    const [r2x, r2y] = pt(qibla, 128);
    return { kx, ky, ray: `M${f(r1x)} ${f(r1y)}L${f(r2x)} ${f(r2y)}`, kaabaArc: arc(qibla - 5, qibla + 5, 136) };
  }, [qibla]);

  return (
    <View style={{ width: S, height: S, alignSelf: 'center', opacity: dimmed ? 0.5 : 1 }}>
      <View
        aria-hidden
        style={[
          { position: 'absolute', left: 24, top: 24, right: 24, bottom: 24, borderRadius: 999 },
          aligned && {
            backgroundColor: c.goldTint,
            borderWidth: 1,
            borderColor: c.goldLine,
            shadowColor: '#C9A96E',
            shadowOpacity: 0.45,
            shadowRadius: 30,
            shadowOffset: { width: 0, height: 0 },
          },
          aligned && Platform.OS === 'web' ? ({ boxShadow: '0 0 48px 6px rgba(201,169,110,0.35), inset 0 0 40px rgba(201,169,110,0.18)' } as object) : null,
        ]}
      />
      <Svg width={S} height={S} viewBox={`0 0 ${S} ${S}`} style={{ position: 'absolute', overflow: 'visible' }} role="img" aria-label={label} accessibilityLabel={label}>
        <Circle cx={C} cy={C} r={136} fill="none" stroke={aligned ? gold : ring} strokeWidth={1} />
        <Circle cx={C} cy={C} r={96} fill="none" stroke={c.hair} strokeWidth={1} />
        <G transform={`rotate(${-h} ${C} ${C})`}>
          <Path d={TICKS.minor} stroke={loading ? c.hair : tick} strokeWidth={1} strokeLinecap="round" />
          <Path d={TICKS.major} stroke={loading ? c.hair : tickMajor} strokeWidth={1.4} strokeLinecap="round" />
          {!loading ? (
            <G>
              {LABELS.map((l) => {
                const [x, y] = pt(l.a, 106);
                return (
                  <SvgText
                    key={l.t}
                    x={x}
                    y={y + (l.strong ? 5 : 4.5)}
                    transform={`rotate(${h} ${f(x)} ${f(y)})`}
                    textAnchor="middle"
                    fontFamily={l.strong ? fonts.semibold : fonts.medium}
                    fontSize={l.strong ? 15 : 13}
                    fontWeight={l.strong ? '700' : '500'}
                    fill={l.strong ? c.text : c.text2}
                  >
                    {l.t}
                  </SvgText>
                );
              })}
              <Path d={geom.kaabaArc} fill="none" stroke={gold} strokeWidth={3} strokeLinecap="round" />
              <Path d={geom.ray} fill="none" stroke={gold} strokeWidth={1} strokeDasharray="3 4" opacity={0.7} />
              <G transform={`translate(${f(geom.kx)} ${f(geom.ky)}) rotate(${h})`}>
                <Circle cx={0} cy={0} r={15} fill={c.goldTint} />
                <Rect x={-7} y={-7} width={14} height={14} rx={2} fill={gold} />
                <Path d="M-7 -2.5H7" stroke={c.bg} strokeWidth={1.4} />
              </G>
            </G>
          ) : null}
        </G>
        {showDelta ? (
          <Path
            d={delta > 0 ? arc(0, delta, 146) : arc(delta, 0, 146)}
            fill="none"
            stroke={c.goldLine}
            strokeWidth={1.5}
            strokeDasharray="2 4"
            strokeLinecap="round"
          />
        ) : null}
        <Path d={`M${C} 2V34`} stroke={aligned ? gold : c.text} strokeWidth={2.5} strokeLinecap="round" />
        <Circle cx={C} cy={2} r={3} fill={aligned ? gold : c.text} />
      </Svg>
      <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', gap: 4 }}>
        <Txt v="caption" tone="gold" style={{ fontSize: 10.5 }}>
          {caption}
        </Txt>
        <Txt v="countdown" tnum style={{ fontSize: 54, lineHeight: 58 }}>
          {value}
        </Txt>
        <Txt v="sub" tone="sub" tnum>
          {footer}
        </Txt>
      </View>
    </View>
  );
});

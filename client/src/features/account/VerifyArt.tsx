import Svg, { Circle, G, Path, Rect } from 'react-native-svg';
import { useTheme } from '@/theme/theme';

/** Envelope inside girih rings (verify / reset screens). */
export function VerifyArt({ size = 168, done }: { size?: number; done?: boolean }) {
  const { c } = useTheme();
  const line = c.hair;
  return (
    <Svg width={size} height={size} viewBox="0 0 168 168" aria-hidden>
      <Circle cx="84" cy="84" r="82" fill="none" stroke={line} strokeWidth={1} strokeDasharray="1 6" />
      <Circle cx="84" cy="84" r="60" fill="none" stroke={line} strokeWidth={1} />
      <G fill="none" stroke={c.gold} strokeWidth={0.8} opacity={0.5}>
        <Rect x="44" y="44" width="80" height="80" />
        <Rect x="44" y="44" width="80" height="80" transform="rotate(45 84 84)" />
      </G>
      <Rect x="58" y="66" width="52" height="38" rx="6" fill={c.bg} stroke={c.gold} strokeWidth={1.6} />
      {done ? (
        <Path d="m72 85 8 8 16-16" fill="none" stroke={c.sage} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
      ) : (
        <Path d="m60 70 24 18 24-18" fill="none" stroke={c.gold} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
      )}
    </Svg>
  );
}

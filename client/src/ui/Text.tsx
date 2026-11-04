import { Text as RNText, type TextProps, type TextStyle } from 'react-native';
import { useTheme } from '@/theme/theme';
import { fonts } from '@/theme/tokens';

/** Type scale from the design board (section D · Tipografi). */
export const type = {
  hero: { fontFamily: fonts.display, fontSize: 38, lineHeight: 42, letterSpacing: -0.38 },
  display: { fontFamily: fonts.display, fontSize: 34, lineHeight: 40, letterSpacing: -0.34 },
  title: { fontFamily: fonts.title, fontSize: 24, lineHeight: 30 },
  titleSm: { fontFamily: fonts.title, fontSize: 20, lineHeight: 26 },
  countdown: { fontFamily: fonts.thin, fontSize: 46, lineHeight: 50, letterSpacing: -0.9 },
  time: { fontFamily: fonts.light, fontSize: 17, lineHeight: 22 },
  headline: { fontFamily: fonts.semibold, fontSize: 17, lineHeight: 22 },
  bodyStrong: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 22 },
  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22 },
  callout: { fontFamily: fonts.medium, fontSize: 15, lineHeight: 20 },
  sub: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 19 },
  subStrong: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 18 },
  small: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 17 },
  caption: {
    fontFamily: fonts.medium,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  tab: { fontFamily: fonts.medium, fontSize: 10, lineHeight: 12 },
  arabic: { fontFamily: fonts.arabic, fontSize: 26, lineHeight: 46, writingDirection: 'rtl' },
  arabicSm: { fontFamily: fonts.arabic, fontSize: 20, lineHeight: 34, writingDirection: 'rtl' },
} satisfies Record<string, TextStyle>;

export type TypeVariant = keyof typeof type;
export type Tone = 'primary' | 'secondary' | 'tertiary' | 'sub' | 'gold' | 'sage' | 'caution' | 'danger' | 'onGold';

export interface TxtProps extends TextProps {
  v?: TypeVariant;
  tone?: Tone;
  color?: string;
  /** Tabular numerals (times, counters). */
  tnum?: boolean;
  center?: boolean;
  weight?: keyof typeof fonts;
}

export function Txt({ v = 'body', tone = 'primary', color, tnum, center, weight, style, ...rest }: TxtProps) {
  const { c } = useTheme();
  const toneColor: Record<Tone, string> = {
    primary: c.text,
    secondary: c.text2,
    tertiary: c.text3,
    sub: c.sub,
    gold: c.goldText,
    sage: c.sage,
    caution: c.caution,
    danger: c.danger,
    onGold: c.onGold,
  };
  const isArabic = v === 'arabic' || v === 'arabicSm';
  return (
    <RNText
      maxFontSizeMultiplier={v === 'countdown' ? 1.35 : 1.6}
      {...rest}
      style={[
        type[v],
        { color: color ?? toneColor[tone] },
        tnum && { fontVariant: ['tabular-nums'] },
        center && { textAlign: 'center' },
        isArabic && { textAlign: center ? 'center' : 'right' },
        weight && { fontFamily: fonts[weight] },
        style,
      ]}
    />
  );
}

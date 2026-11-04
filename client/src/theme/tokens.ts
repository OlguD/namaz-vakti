/**
 * Design tokens from the "Vakit — Sessiz Gökyüzü" design board (Main.dc.html).
 * Every colour, size and duration used by the UI comes from here.
 */
import type { Vakit } from '@/lib/prayer';

export type ThemeName = 'dark' | 'light';

export interface Palette {
  name: ThemeName;
  bg: string;
  raised: string;
  sheet: string;
  text: string;
  text2: string;
  text3: string;
  /** Secondary copy on top of a sky gradient. */
  sub: string;
  gold: string;
  goldSoft: string;
  /** Gold used for text (meets 4.5:1 on the base). */
  goldText: string;
  goldTint: string;
  goldLine: string;
  onGold: string;
  sage: string;
  sageTint: string;
  caution: string;
  cautionTint: string;
  cautionLine: string;
  danger: string;
  glass: string;
  glassStrong: string;
  stroke: string;
  hair: string;
  scrim: string;
  grab: string;
  pattern: string;
  patternOpacity: number;
  tabBar: string;
  input: string;
}

export const dark: Palette = {
  name: 'dark',
  bg: '#0B0F17',
  raised: '#161D2C',
  sheet: '#121826',
  text: '#F3EEE4',
  text2: '#A9A59C',
  text3: '#85827B',
  sub: 'rgba(243,238,228,0.78)',
  gold: '#C9A96E',
  goldSoft: '#E3CFA4',
  goldText: '#E3CFA4',
  goldTint: 'rgba(201,169,110,0.16)',
  goldLine: 'rgba(201,169,110,0.45)',
  onGold: '#1A1408',
  sage: '#9DB89C',
  sageTint: 'rgba(157,184,156,0.14)',
  caution: '#D9A37A',
  cautionTint: 'rgba(217,163,122,0.12)',
  cautionLine: 'rgba(217,163,122,0.45)',
  danger: '#E08A7A',
  glass: 'rgba(255,255,255,0.06)',
  glassStrong: 'rgba(255,255,255,0.10)',
  stroke: 'rgba(255,255,255,0.12)',
  hair: 'rgba(255,255,255,0.10)',
  scrim: 'rgba(5,7,13,0.55)',
  grab: 'rgba(243,238,228,0.25)',
  pattern: '#E3CFA4',
  patternOpacity: 0.05,
  tabBar: 'rgba(22,29,44,0.72)',
  input: 'rgba(255,255,255,0.05)',
};

export const light: Palette = {
  name: 'light',
  bg: '#F6F1E7',
  raised: '#FFFCF6',
  sheet: '#FFFCF6',
  text: '#1A1C21',
  text2: '#57534B',
  text3: '#6E6A61',
  sub: '#4E4A42',
  gold: '#C9A96E',
  goldSoft: '#9A7A3C',
  goldText: '#84652C',
  goldTint: 'rgba(201,169,110,0.22)',
  goldLine: 'rgba(132,101,44,0.45)',
  onGold: '#1A1408',
  sage: '#5E7D62',
  sageTint: 'rgba(94,125,98,0.12)',
  caution: '#A2593A',
  cautionTint: 'rgba(162,89,58,0.10)',
  cautionLine: 'rgba(162,89,58,0.40)',
  danger: '#A63D2F',
  glass: 'rgba(255,255,255,0.58)',
  glassStrong: '#FFFCF6',
  stroke: 'rgba(26,28,33,0.08)',
  hair: 'rgba(26,28,33,0.10)',
  scrim: 'rgba(26,28,33,0.35)',
  grab: 'rgba(26,28,33,0.20)',
  pattern: '#5E4719',
  patternOpacity: 0.07,
  tabBar: 'rgba(255,252,246,0.82)',
  input: 'rgba(255,255,255,0.7)',
};

export interface Sky {
  /** Gradient stops from the top of the screen down to the horizon. */
  colors: [string, string, ...string[]];
  locations: [number, number, ...number[]];
  /** Warm glow behind the countdown ring. */
  glow: string;
  stars: boolean;
  /** Text on the sky is light even in the light theme at night. */
  onDark: boolean;
}

/** Gradients for the top ~60% of the screen; they melt into `bg`. */
export function skyFor(vakit: Vakit, theme: ThemeName): Sky {
  const d = theme === 'dark';
  const bg = d ? dark.bg : light.bg;
  switch (vakit) {
    case 'imsak':
      return {
        colors: d
          ? ['#0E1230', '#2A2350', '#4B3566', '#1A1530', bg]
          : ['#3A3F7A', '#8E7FB5', '#E9D9E3', bg],
        locations: d ? [0, 0.28, 0.44, 0.66, 0.84] : [0, 0.3, 0.6, 0.84],
        glow: 'rgba(160,130,200,0.30)',
        stars: true,
        onDark: true,
      };
    case 'gunes':
      return {
        colors: d
          ? ['#1A1630', '#5B3A4A', '#C98C6E', '#3A2430', bg]
          : ['#F2BE98', '#F8DEC7', '#FBF3EA', bg],
        locations: d ? [0, 0.24, 0.42, 0.62, 0.84] : [0, 0.3, 0.6, 0.84],
        glow: 'rgba(230,160,110,0.35)',
        stars: false,
        onDark: d,
      };
    case 'ogle':
      return {
        colors: d
          ? ['#0D1B2E', '#1F3A57', '#3E6585', '#162636', bg]
          : ['#9CC4E4', '#CFE3F1', '#F6F1E7', bg],
        locations: d ? [0, 0.24, 0.42, 0.62, 0.84] : [0, 0.3, 0.6, 0.84],
        glow: 'rgba(150,190,230,0.28)',
        stars: false,
        onDark: d,
      };
    case 'ikindi':
      return {
        colors: d
          ? ['#1A1408', '#4A3416', '#8A6430', '#3A2A14', bg]
          : ['#E3B871', '#F0D7A6', '#F7EFE1', bg],
        locations: d ? [0, 0.26, 0.42, 0.6, 0.8] : [0, 0.3, 0.6, 0.84],
        glow: 'rgba(214,170,96,0.38)',
        stars: false,
        onDark: d,
      };
    case 'aksam':
      return {
        colors: d
          ? ['#1A1222', '#3D2230', '#7A4340', '#4A2A33', '#1A1520', bg]
          : ['#E59A7A', '#F0C1A6', '#F7E4D8', bg],
        locations: d ? [0, 0.22, 0.38, 0.54, 0.7, 0.84] : [0, 0.3, 0.6, 0.84],
        glow: 'rgba(214,132,96,0.42)',
        stars: false,
        onDark: d,
      };
    case 'yatsi':
    default:
      return {
        colors: d
          ? ['#05070D', '#0B1224', '#142040', '#0E1528', bg]
          : ['#1F2B4A', '#3E4D75', '#8794B5', bg],
        locations: d ? [0, 0.28, 0.46, 0.66, 0.84] : [0, 0.3, 0.62, 0.86],
        glow: 'rgba(120,140,200,0.28)',
        stars: true,
        onDark: true,
      };
  }
}

export const space = {
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  12: 48,
  16: 64,
  /** Horizontal screen gutter. */
  gutter: 20,
} as const;

export const radius = {
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 28,
  full: 999,
} as const;

export const motion = {
  fast: 300,
  base: 400,
  slow: 500,
  breath: 4800,
  sky: 1600,
  /** cubic-bezier(.22,.61,.36,1) */
  easeOut: [0.22, 0.61, 0.36, 1] as const,
} as const;

export const fonts = {
  display: 'Fraunces_300Light',
  displayItalic: 'Fraunces_300Light_Italic',
  title: 'Fraunces_400Regular',
  titleItalic: 'Fraunces_400Regular_Italic',
  thin: 'Inter_200ExtraLight',
  light: 'Inter_300Light',
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  arabic: 'Amiri_400Regular',
  arabicBold: 'Amiri_700Bold',
} as const;

/** Minimum touch target (iOS 44pt, Android 48dp). */
export const HIT = 44;

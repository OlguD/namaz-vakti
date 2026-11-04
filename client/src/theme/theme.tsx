import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { useSettings } from '@/features/settings/api';
import type { Vakit } from '@/lib/prayer';
import { dark, light, skyFor, type Palette, type Sky, type ThemeName } from './tokens';

interface Theme {
  name: ThemeName;
  c: Palette;
  isDark: boolean;
  sky: (vakit: Vakit) => Sky;
}

const ThemeContext = createContext<Theme | null>(null);

export function ThemeProvider({
  children,
  override,
}: {
  children: ReactNode;
  /** Force a theme (tests, previews, share cards). */
  override?: ThemeName;
}) {
  const system = useColorScheme();
  const { theme: pref } = useSettings();
  const name: ThemeName =
    override ?? (pref === 'system' ? (system === 'light' ? 'light' : 'dark') : pref);
  const value = useMemo<Theme>(
    () => ({
      name,
      c: name === 'dark' ? dark : light,
      isDark: name === 'dark',
      sky: (vakit) => skyFor(vakit, name),
    }),
    [name],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  const t = useContext(ThemeContext);
  if (!t) throw new Error('useTheme must be used inside <ThemeProvider>');
  return t;
}

/** Palette to use for text drawn directly on a sky gradient. */
export function useOnSky(sky: Sky): Palette {
  const { c } = useTheme();
  return sky.onDark ? dark : c;
}

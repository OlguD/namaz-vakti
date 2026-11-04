import Svg, { Path } from 'react-native-svg';
import { useTheme } from '@/theme/theme';

/** Icons from the İbadet designs (same 24-grid / 1.5 stroke style as src/ui/Icon). */
const P = {
  zikir: 'M12 3a6 6 0 1 1 0 12 6 6 0 0 1 0-12zM12 15v3M10.5 21.5h3L12 18z',
  tesbihat: 'M6 12a2 2 0 1 0 0 .01M12 12a2 2 0 1 0 0 .01M18 12a2 2 0 1 0 0 .01M3 19h18',
  namaz: 'M4.5 6.5h15v13h-15zM4.5 10h15M8.5 4v4M15.5 4v4M9 15l2 2 4-4',
  kuran: 'M12 6.5C10 5 7 4.5 4 5v13c3-.5 6 0 8 1.5 2-1.5 5-2 8-1.5V5c-3-.5-6 0-8 1.5zM12 6.5v13',
  dua: 'M15 4a8 8 0 1 0 5 14A7 7 0 0 1 15 4zM17.5 7.5l.6 1.4 1.4.6-1.4.6-.6 1.4-.6-1.4-1.4-.6 1.4-.6z',
  esma: 'M7 7h10v10H7zM12 4.9 19.1 12 12 19.1 4.9 12z',
  gunler: 'M4.5 6.5h15v13h-15zM4.5 10h15M8.5 4v4M15.5 4v4M12 12.5l.9 1.9 2.1.3-1.5 1.4.4 2-1.9-1-1.9 1 .4-2-1.5-1.4 2.1-.3z',
  zekat: 'M12 4v16M7 20h10M5 8h14M5 8l-2.5 6a2.5 2.5 0 0 0 5 0zM19 8l-2.5 6a2.5 2.5 0 0 0 5 0z',
  beads: 'M12 3v18M12 5.5a1.8 1.8 0 1 0 0 .01M12 10.5a1.8 1.8 0 1 0 0 .01M12 15.5a1.8 1.8 0 1 0 0 .01',
  ring: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z',
  reset: 'M4 12a8 8 0 1 0 2.3-5.7M4 4v4.5h4.5',
  flame: 'M12 21c3.5 0 6-2.4 6-5.8 0-3.8-3.2-5.6-4-9.2-1.8 1.3-3 3.4-2.6 5.6C10 10.6 9.4 9.4 9.3 8 7.4 9.7 6 12.1 6 15.2 6 18.6 8.5 21 12 21z',
  dot: 'M12 12h.01',
  prayed: 'm5 12.5 4.5 4.5L19 7.5',
  jamaah: 'M3 12.5 7 16.5 13 8M11 15.5l1 1 8-9.5',
  qada: 'M12 7.5V12l3 2M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z',
  link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
} as const;

export type WorshipIconName = keyof typeof P;

export function WIcon({ name, size = 20, color, strokeWidth = 1.5 }: { name: WorshipIconName; size?: number; color?: string; strokeWidth?: number }) {
  const { c } = useTheme();
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color ?? c.text} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <Path d={P[name]} />
    </Svg>
  );
}

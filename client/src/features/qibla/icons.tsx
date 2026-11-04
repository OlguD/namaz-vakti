import Svg, { Path } from 'react-native-svg';

/** Icons only the qibla / mosque screens use (same 24-grid, round-cap style as src/ui/Icon). */
const PATHS = {
  infinity: 'M12 12c-2-2.6-4-4-6-4a4 4 0 0 0 0 8c2 0 4-1.4 6-4zm0 0c2 2.6 4 4 6 4a4 4 0 0 0 0-8c-2 0-4 1.4-6 4z',
  magnet: 'M6 3.5v8a6 6 0 0 0 12 0v-8M6 3.5h3.5v8a2.5 2.5 0 0 0 5 0v-8H18M6 7.5h3.5M14.5 7.5H18',
  arrowRight: 'M5 12h13M13 7l5 5-5 5',
  arrowLeft: 'M19 12H6M11 7l-5 5 5 5',
  spinner: 'M12 3a9 9 0 1 0 9 9',
  directions: 'M12 2.8 21.2 12 12 21.2 2.8 12zM9 14v-2.5a1.5 1.5 0 0 1 1.5-1.5H15M13 8l2 2-2 2',
  walk: 'M13 4.5a1.5 1.5 0 1 0 0-.01M10 21l2-6 3 3v4M9.5 11l2-3 3 1.5 2 2.5M11.5 8 9 13',
  ruler: 'M4 15 15 4l5 5L9 20zM7.5 11.5l2 2M10.5 8.5l2 2M13.5 5.5l2 2',
  locate: 'M12 2v3M12 19v3M2 12h3M19 12h3M12 6a6 6 0 1 0 0 12 6 6 0 0 0 0-12zM12 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4z',
} as const;

export type LocalIconName = keyof typeof PATHS;

export function LocalIcon({ name, size = 20, color = 'currentColor', strokeWidth = 1.6 }: { name: LocalIconName; size?: number; color?: string; strokeWidth?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <Path d={PATHS[name]} />
    </Svg>
  );
}

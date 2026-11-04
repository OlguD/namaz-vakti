import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { useTheme } from '@/theme/theme';

/**
 * Line icons in the design's style: 24-unit grid, 1.5 stroke, round caps.
 * Decorative by default (hidden from screen readers); the control that
 * contains an icon carries the accessible label.
 */
const P = {
  vakit: <Path d="M3 18h18M6.5 18a5.5 5.5 0 0 1 11 0M12 5v2.5M5.3 9.3l1.6 1.6M18.7 9.3l-1.6 1.6" />,
  tesbih: (
    <>
      <Circle cx="12" cy="9" r="6" />
      <Circle cx="6" cy="9" r="1.3" fill="currentColor" />
      <Circle cx="18" cy="9" r="1.3" fill="currentColor" />
      <Circle cx="12" cy="3" r="1.3" fill="currentColor" />
      <Path d="M12 15v3M10.5 21.5h3L12 18z" />
    </>
  ),
  compass: (
    <>
      <Circle cx="12" cy="12" r="9" />
      <Path d="m15.5 8.5-2 5-5 2 2-5z" />
    </>
  ),
  mosque: <Path d="M3.5 20h17M5.5 20v-5.5a6.5 6.5 0 0 1 13 0V20M12 3v4.5M10 20v-3a2 2 0 0 1 4 0v3" />,
  live: (
    <>
      <Circle cx="12" cy="12" r="1.8" />
      <Path d="M8.2 8.2a5.4 5.4 0 0 0 0 7.6M15.8 8.2a5.4 5.4 0 0 1 0 7.6M5.3 5.3a9.5 9.5 0 0 0 0 13.4M18.7 5.3a9.5 9.5 0 0 1 0 13.4" />
    </>
  ),
  chat: <Path d="M4 7a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v7a3 3 0 0 1-3 3h-7l-4 3v-3a3 3 0 0 1-2-3z" />,
  sliders: (
    <>
      <Path d="M4 7h9M17 7h3M4 17h3M11 17h9" />
      <Circle cx="15" cy="7" r="2" />
      <Circle cx="9" cy="17" r="2" />
    </>
  ),
  back: <Path d="m15 6-6 6 6 6" />,
  forward: <Path d="m9 6 6 6-6 6" />,
  down: <Path d="m6 9 6 6 6-6" />,
  up: <Path d="m6 15 6-6 6 6" />,
  close: <Path d="M6 6l12 12M18 6 6 18" />,
  check: <Path d="m5 12.5 4.5 4.5L19 7.5" />,
  plus: <Path d="M12 5v14M5 12h14" />,
  minus: <Path d="M5 12h14" />,
  pin: (
    <>
      <Path d="M12 21s-6.5-5.8-6.5-11.2a6.5 6.5 0 0 1 13 0C18.5 15.2 12 21 12 21z" />
      <Circle cx="12" cy="9.8" r="2.2" />
    </>
  ),
  locate: (
    <>
      <Circle cx="12" cy="12" r="7" />
      <Circle cx="12" cy="12" r="2.5" />
      <Path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
    </>
  ),
  search: (
    <>
      <Circle cx="11" cy="11" r="6.5" />
      <Path d="m20 20-4.2-4.2" />
    </>
  ),
  share: <Path d="M12 3v12M7.5 7.5 12 3l4.5 4.5M5 13v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5" />,
  heart: <Path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />,
  bell: <Path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15zM10 20.5a2 2 0 0 0 4 0" />,
  bellOff: <Path d="M6 16V11a6 6 0 0 1 9.4-4.9M18 11v5l1.5 2H8M10 20.5a2 2 0 0 0 4 0M4 4l16 16" />,
  user: (
    <>
      <Circle cx="12" cy="8.5" r="3.5" />
      <Path d="M5 20a7 7 0 0 1 14 0" />
    </>
  ),
  info: (
    <>
      <Circle cx="12" cy="12" r="9" />
      <Path d="M12 11v5.5M12 7.5v.01" />
    </>
  ),
  alert: (
    <>
      <Circle cx="12" cy="12" r="9" />
      <Path d="M12 7.5v5.5M12 16.5v.01" />
    </>
  ),
  offline: <Path d="M3 8.5a14 14 0 0 1 5-2.7M21 8.5A14 14 0 0 0 12 5.5M6 12a9 9 0 0 1 4-2M18 12a9 9 0 0 0-2.5-1.6M9 15.5a4.5 4.5 0 0 1 6 0M12 19h.01M4 4l16 16" />,
  refresh: <Path d="M20 11a8 8 0 1 0-2.3 5.7M20 5v6h-6" />,
  calendar: (
    <>
      <Rect x="3.5" y="5" width="17" height="15" rx="2.5" />
      <Path d="M3.5 10h17M8 3v4M16 3v4" />
    </>
  ),
  book: <Path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5zM4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5" />,
  moon: <Path d="M19 14.5A7.5 7.5 0 0 1 9.5 5a7.5 7.5 0 1 0 9.5 9.5z" />,
  sun: (
    <>
      <Circle cx="12" cy="12" r="4" />
      <Path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" />
    </>
  ),
  star: <Path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.8l-5.2 2.8 1-5.8-4.3-4.1 5.9-.9z" />,
  play: <Path d="M8 5.5v13l10-6.5z" />,
  pause: <Path d="M8 5v14M16 5v14" />,
  more: (
    <>
      <Circle cx="5.5" cy="12" r="1.2" fill="currentColor" />
      <Circle cx="12" cy="12" r="1.2" fill="currentColor" />
      <Circle cx="18.5" cy="12" r="1.2" fill="currentColor" />
    </>
  ),
  flag: <Path d="M5 21V4M5 4h11l-2 4 2 4H5" />,
  shield: (
    <>
      <Path d="M12 3 4.5 6v5.5c0 4.5 3.2 8.2 7.5 9.5 4.3-1.3 7.5-5 7.5-9.5V6z" />
      <Path d="m9 12 2 2 4-4" />
    </>
  ),
  mail: (
    <>
      <Rect x="3" y="5.5" width="18" height="13" rx="2.5" />
      <Path d="m4 7.5 8 6 8-6" />
    </>
  ),
  lock: (
    <>
      <Rect x="5" y="10.5" width="14" height="10" rx="2.5" />
      <Path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
    </>
  ),
  trash: <Path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13M10 11v5.5M14 11v5.5" />,
  globe: (
    <>
      <Circle cx="12" cy="12" r="9" />
      <Path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
    </>
  ),
  block: (
    <>
      <Circle cx="12" cy="12" r="9" />
      <Path d="m5.6 5.6 12.8 12.8" />
    </>
  ),
  send: <Path d="M4 12 20 4l-6 16-3-7z" />,
  clock: (
    <>
      <Circle cx="12" cy="12" r="9" />
      <Path d="M12 7v5l3 2" />
    </>
  ),
  chart: <Path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
  target: (
    <>
      <Circle cx="12" cy="12" r="9" />
      <Circle cx="12" cy="12" r="5" />
      <Circle cx="12" cy="12" r="1" fill="currentColor" />
    </>
  ),
  hands: <Path d="M8 21v-5l-3-4V6a1.5 1.5 0 0 1 3 0v5M16 21v-5l3-4V6a1.5 1.5 0 0 0-3 0v5M8 11l2.5-6.5a1.4 1.4 0 0 1 2.6 1L12 9M16 11l-2.5-6.5" />,
  coin: (
    <>
      <Circle cx="12" cy="12" r="8.5" />
      <Path d="M12 7v10M9.5 9.5h4a1.75 1.75 0 0 1 0 3.5h-3a1.75 1.75 0 0 0 0 3.5h4" />
    </>
  ),
  people: (
    <>
      <Circle cx="9" cy="8.5" r="3" />
      <Path d="M3.5 19a5.5 5.5 0 0 1 11 0M16 5.8a3 3 0 0 1 0 5.4M17.5 13.6A5.5 5.5 0 0 1 20.5 19" />
    </>
  ),
  copy: (
    <>
      <Rect x="8" y="8" width="12" height="12" rx="2.5" />
      <Path d="M16 8V6.5A2.5 2.5 0 0 0 13.5 4h-7A2.5 2.5 0 0 0 4 6.5v7A2.5 2.5 0 0 0 6.5 16H8" />
    </>
  ),
  edit: <Path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16zM13.5 6.5l4 4" />,
  logout: <Path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4M10 16l-4-4 4-4M6 12h10" />,
  expand: <Path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />,
  volume: <Path d="M4 9.5v5h3.5L12 18V6L7.5 9.5zM15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" />,
  vibrate: (
    <>
      <Rect x="8" y="4" width="8" height="16" rx="2" />
      <Path d="M4 9v6M20 9v6" />
    </>
  ),
  route: (
    <>
      <Circle cx="6" cy="18" r="2.5" />
      <Circle cx="18" cy="6" r="2.5" />
      <Path d="M8.5 18H15a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h6.5" />
    </>
  ),
  phone: <Path d="M6.5 3.5h3l1.5 4-2 1.5a11 11 0 0 0 6 6l1.5-2 4 1.5v3a2 2 0 0 1-2 2A16 16 0 0 1 4.5 5.5a2 2 0 0 1 2-2z" />,
  layers: <Path d="m12 4 9 5-9 5-9-5zM3 14l9 5 9-5" />,
  history: <Path d="M3.5 12a8.5 8.5 0 1 0 2.5-6M3 3.5v4h4M12 7.5V12l3 2" />,
} as const;

export type IconName = keyof typeof P;

export interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
  /** Set to give the icon its own accessible name (rare: prefer labelling the control). */
  label?: string;
}

export function Icon({ name, size = 22, color, strokeWidth = 1.5, label }: IconProps) {
  const { c } = useTheme();
  const stroke = color ?? c.text;
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={stroke}
      color={stroke}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...(label ? { accessible: true, accessibilityLabel: label, role: 'img' as const } : { 'aria-hidden': true })}
    >
      {P[name]}
    </Svg>
  );
}

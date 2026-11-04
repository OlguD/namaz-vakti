import { useEffect, useState } from 'react';
import { Animated, Easing, View } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { useReducedMotion } from '@/lib/a11y';
import { useTheme } from '@/theme/theme';
import { Txt } from '@/ui';

const VIEW = 268;
const R = 116;
const CIRC = 2 * Math.PI * R;

/**
 * The "time left" ring from the home screen: dotted outer dial, a gold arc for
 * the elapsed part of the current vakit and a breathing glow behind it.
 */
export function CountdownRing({
  size = 240,
  progress,
  caption,
  countdown,
  footer,
  accessibilityLabel,
  onDark = true,
}: {
  size?: number;
  progress: number;
  caption: string;
  countdown: string;
  footer?: string;
  accessibilityLabel: string;
  onDark?: boolean;
}) {
  const { c } = useTheme();
  const reduced = useReducedMotion();
  const breath = useState(() => new Animated.Value(0))[0];
  useEffect(() => {
    if (reduced) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breath, { toValue: 1, duration: 2400, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(breath, { toValue: 0, duration: 2400, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [breath, reduced]);

  const p = Math.min(1, Math.max(0, progress));
  const angle = p * 2 * Math.PI - Math.PI / 2;
  const dotX = VIEW / 2 + R * Math.cos(angle);
  const dotY = VIEW / 2 + R * Math.sin(angle);
  const ink = onDark ? '243,238,228' : '26,28,33';
  const text = onDark ? '#F3EEE4' : c.text;
  const sub = onDark ? 'rgba(243,238,228,0.78)' : c.sub;
  const gold = onDark ? '#E3CFA4' : c.goldText;

  return (
    <View
      accessible
      accessibilityRole="timer"
      accessibilityLabel={accessibilityLabel}
      style={{ width: size, height: size, alignSelf: 'center' }}
    >
      <Animated.View
        aria-hidden
        style={{
          position: 'absolute',
          inset: 16,
          left: 16,
          top: 16,
          right: 16,
          bottom: 16,
          opacity: reduced ? 0.8 : breath.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] }),
          transform: [{ scale: reduced ? 1 : breath.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1.04] }) }],
        }}
      >
        <Svg width="100%" height="100%">
          <Defs>
            <RadialGradient id="ringGlow" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor="#C9A96E" stopOpacity={0.3} />
              <Stop offset="1" stopColor="#C9A96E" stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Circle cx="50%" cy="50%" r="50%" fill="url(#ringGlow)" />
        </Svg>
      </Animated.View>
      <Svg width={size} height={size} viewBox={`0 0 ${VIEW} ${VIEW}`} style={{ position: 'absolute' }} aria-hidden>
        <Circle cx={VIEW / 2} cy={VIEW / 2} r={128} fill="none" stroke={`rgba(${ink},0.22)`} strokeWidth={1} strokeDasharray="1 9.05" />
        <Circle cx={VIEW / 2} cy={VIEW / 2} r={R} fill="none" stroke={`rgba(${ink},0.14)`} strokeWidth={1} />
        <Circle
          cx={VIEW / 2}
          cy={VIEW / 2}
          r={R}
          fill="none"
          stroke="#C9A96E"
          strokeWidth={3}
          strokeLinecap="round"
          strokeDasharray={`${CIRC * p} ${CIRC}`}
          transform={`rotate(-90 ${VIEW / 2} ${VIEW / 2})`}
        />
        <Circle cx={dotX} cy={dotY} r={9} fill="rgba(201,169,110,0.25)" />
        <Circle cx={dotX} cy={dotY} r={4} fill="#E3CFA4" />
      </Svg>
      <View style={{ position: 'absolute', inset: 0, left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        <Txt v="caption" color={gold} style={{ letterSpacing: 1.5 }}>
          {caption}
        </Txt>
        <Txt v="countdown" color={text} tnum>
          {countdown}
        </Txt>
        {footer ? (
          <Txt v="sub" color={sub}>
            {footer}
          </Txt>
        ) : null}
      </View>
    </View>
  );
}

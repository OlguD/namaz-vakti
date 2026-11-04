import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, PanResponder, Platform, View } from 'react-native';
import { useTheme } from '@/theme/theme';
import { radius } from '@/theme/tokens';
import { Touch, webBlur } from '@/ui';

export type Snap = 'peek' | 'half' | 'full';
const ORDER: Snap[] = ['peek', 'half', 'full'];

/**
 * Map bottom sheet with three snap points. Drag the handle/header, or tap the
 * handle to cycle; it is a real button for keyboard and screen-reader users.
 */
export function MapSheet({
  snap,
  onSnap,
  heights,
  header,
  children,
  locked,
}: {
  snap: Snap;
  onSnap: (s: Snap) => void;
  heights: Record<Snap, number>;
  header?: ReactNode;
  children: ReactNode;
  /** Loading / empty: stay at the current height, no dragging. */
  locked?: boolean;
}) {
  const { c, isDark } = useTheme();
  const [h] = useState(() => new Animated.Value(heights[snap]));
  // Latest props for the gesture callbacks (the responder is created once).
  const liveRef = useRef({ at: heights[snap], heights, snap, locked, onSnap });
  useEffect(() => {
    Object.assign(liveRef.current, { heights, snap, locked, onSnap });
  });

  useEffect(() => {
    liveRef.current.at = heights[snap];
    Animated.timing(h, { toValue: heights[snap], duration: 400, easing: Easing.bezier(0.22, 0.61, 0.36, 1), useNativeDriver: false }).start();
  }, [snap, heights, h]);

  // The responder only reads liveRef inside gesture callbacks, never during render.
  // eslint-disable-next-line react-hooks/refs
  const [pan] = useState(() => {
    const live = liveRef.current;
    return PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) => !live.locked && Math.abs(g.dy) > 6 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderMove: (_e, g) => {
        h.setValue(Math.min(live.heights.full, Math.max(live.heights.peek - 40, live.at - g.dy)));
      },
      onPanResponderRelease: (_e, g) => {
        const projected = live.at - g.dy - g.vy * 120;
        let best: Snap = 'peek';
        for (const s of ORDER) if (Math.abs(live.heights[s] - projected) < Math.abs(live.heights[best] - projected)) best = s;
        if (best === live.snap) {
          Animated.timing(h, { toValue: live.heights[live.snap], duration: 300, useNativeDriver: false }).start();
        } else live.onSnap(best);
      },
    });
  });

  const next = ORDER[(ORDER.indexOf(snap) + 1) % ORDER.length]!;
  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: h,
          maxWidth: 560,
          alignSelf: 'center',
          width: '100%',
          paddingHorizontal: 16,
          borderTopLeftRadius: radius.xxl,
          borderTopRightRadius: radius.xxl,
          backgroundColor: isDark ? 'rgba(18,24,38,0.95)' : 'rgba(255,252,246,0.97)',
          borderTopWidth: 1,
          borderColor: c.stroke,
          shadowColor: '#000',
          shadowOpacity: 0.4,
          shadowRadius: 24,
          shadowOffset: { width: 0, height: -12 },
          elevation: 12,
          overflow: 'hidden',
        },
        webBlur,
      ]}
    >
      <View {...pan.panHandlers}>
        <Touch
          onPress={() => !locked && onSnap(next)}
          accessibilityRole="button"
          accessibilityLabel={snap === 'full' ? 'Sayfayı küçült' : 'Sayfayı genişlet'}
          style={{ height: 24, alignItems: 'center', justifyContent: 'center', ...(Platform.OS === 'web' ? { cursor: 'grab' } : null) }}
        >
          <View style={{ width: 40, height: 5, borderRadius: 3, backgroundColor: c.grab }} />
        </Touch>
        {header}
      </View>
      <View style={{ flex: 1, minHeight: 0 }}>{children}</View>
    </Animated.View>
  );
}

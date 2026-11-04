import type { BottomTabBarProps } from 'expo-router/tabs';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/theme';
import { tapFeedback, Touch } from './controls';
import { webBlur } from './Decor';
import { Icon, type IconName } from './Icon';
import { Txt } from './Text';

const ITEMS: Record<string, { label: string; icon: IconName }> = {
  index: { label: 'Vakitler', icon: 'vakit' },
  ibadet: { label: 'İbadet', icon: 'tesbih' },
  kible: { label: 'Kıble', icon: 'compass' },
  camiler: { label: 'Camiler', icon: 'mosque' },
  canli: { label: 'Canlı', icon: 'live' },
};

/**
 * Floating glass tab bar (16 from the sides, 20 from the bottom). The active
 * tab only changes colour; labels are always visible.
 */
export function TabBar({ state, emitter, navigateToTab }: BottomTabBarProps) {
  const { c, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      pointerEvents="box-none"
      style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingBottom: Math.max(insets.bottom - 8, 0) + 20, alignItems: 'center' }}
    >
      <View
        accessibilityRole="tablist"
        style={[
          {
            width: '100%',
            maxWidth: 560,
            paddingHorizontal: 16,
          },
        ]}
      >
        <View
          style={[
            {
              height: 66,
              flexDirection: 'row',
              paddingHorizontal: 4,
              borderRadius: 28,
              backgroundColor: c.tabBar,
              borderWidth: 1,
              borderColor: c.stroke,
              borderTopColor: isDark ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.95)',
              shadowColor: '#000',
              shadowOpacity: isDark ? 0.5 : 0.12,
              shadowRadius: 24,
              shadowOffset: { width: 0, height: 16 },
              elevation: 8,
            },
            webBlur,
          ]}
        >
          {state.routes.map((route, index) => {
            const item = ITEMS[route.name];
            if (!item) return null;
            const focused = state.index === index;
            const color = focused ? c.gold : c.text2;
            return (
              <Touch
                key={route.key}
                accessibilityRole="tab"
                accessibilityState={{ selected: focused }}
                accessibilityLabel={item.label}
                onPress={() => {
                  const event = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                  if (!focused && !event.defaultPrevented) {
                    tapFeedback();
                    navigateToTab(route.key);
                  }
                }}
                style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4 }}
              >
                <Icon name={item.icon} size={22} color={color} />
                <Txt v="tab" color={color} style={focused ? { fontFamily: 'Inter_600SemiBold' } : undefined}>
                  {item.label}
                </Txt>
              </Touch>
            );
          })}
        </View>
      </View>
    </View>
  );
}

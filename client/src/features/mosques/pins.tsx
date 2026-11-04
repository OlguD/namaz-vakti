import { View } from 'react-native';
import { useTheme } from '@/theme/theme';
import { Icon, Txt } from '@/ui';

/** Native map pins (the web map renders the same look as HTML, see MosqueMap.web.tsx). */
export function MosquePin({ selected }: { selected?: boolean }) {
  const { c, isDark } = useTheme();
  return (
    <View style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
      <View
        style={{
          width: 34,
          height: 34,
          borderRadius: 17,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: selected ? c.gold : isDark ? '#161D2C' : '#FFFCF6',
          borderWidth: 1.5,
          borderColor: isDark ? c.gold : '#9A7A3C',
          shadowColor: '#000',
          shadowOpacity: 0.35,
          shadowRadius: 6,
          shadowOffset: { width: 0, height: 4 },
          elevation: 4,
        }}
      >
        <Icon name="mosque" size={18} color={selected ? c.onGold : c.goldText} strokeWidth={1.6} />
      </View>
    </View>
  );
}

export function NearestPin({ name, label }: { name: string; label?: string }) {
  const { c, isDark } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: 22,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: c.gold,
          borderWidth: 4,
          borderColor: c.goldTint,
          shadowColor: '#000',
          shadowOpacity: 0.4,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 6 },
          elevation: 6,
        }}
      >
        <Icon name="mosque" size={22} color={c.onGold} strokeWidth={1.7} />
      </View>
      <View
        style={{
          paddingVertical: 5,
          paddingHorizontal: 10,
          borderRadius: 12,
          backgroundColor: isDark ? 'rgba(22,29,44,0.92)' : 'rgba(255,252,246,0.95)',
          borderWidth: 1,
          borderColor: c.stroke,
          maxWidth: 200,
        }}
      >
        <Txt v="small" weight="semibold" numberOfLines={1}>
          {name}
        </Txt>
        {label ? (
          <Txt v="small" tone="secondary" tnum style={{ fontSize: 11, lineHeight: 14 }}>
            {label}
          </Txt>
        ) : null}
      </View>
    </View>
  );
}

export function UserDot() {
  const { isDark } = useTheme();
  const ink = isDark ? '#F3EEE4' : '#1A1C21';
  const land = isDark ? '#0B0F17' : '#F6F1E7';
  return (
    <View style={{ width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', backgroundColor: isDark ? 'rgba(243,238,228,0.10)' : 'rgba(26,28,33,0.08)' }}>
      <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: ink, borderWidth: 3, borderColor: land }} />
    </View>
  );
}

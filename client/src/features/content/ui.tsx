import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Platform, TextInput, View, type TextStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '@/theme/theme';
import { fonts, radius } from '@/theme/tokens';
import { Icon, IconButton, Touch, Txt } from '@/ui';

/** Category icons from the Dualar design, keyed by the API's `icon` names. */
const CATEGORY_PATHS: Record<string, string> = {
  sunrise: 'M12 4v2M5.6 6.6 7 8M4 13h2M18 13h2M17 8l1.4-1.4M7.5 13a4.5 4.5 0 0 1 9 0M3 17h18M7 20h10',
  mihrab: 'M12 3v3M8 9a4 4 0 0 1 8 0v11H8zM5 20h14M10 14h4',
  utensils: 'M7 3v8a2 2 0 0 0 2 2v8M11 3v8M7 7h4M16 3c-1.5 2-2 4-2 7h3v11',
  route: 'M3 12h18M14 5l7 7-7 7M3 6v12',
  heart: 'M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10zM9.5 11h5M12 8.5v5',
  lamp: 'M4 15a8 8 0 0 1 16 0M12 15v6M8 21h8M12 3v3',
  moon: 'M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z',
  book: 'M4 5.5c3-1 5.5-.5 8 1.5 2.5-2 5-2.5 8-1.5v13c-3-1-5.5-.5-8 1.5-2.5-2-5-2.5-8-1.5zM12 7v13',
};

export function CategoryIcon({ name, color, size = 22 }: { name: string | null; color: string; size?: number }) {
  const d = CATEGORY_PATHS[name ?? ''] ?? CATEGORY_PATHS.book!;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <Path d={d} />
    </Svg>
  );
}

const HEART = 'M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z';

/** Heart that fills when the item is a favourite. */
export function HeartIcon({ filled, color, size = 20 }: { filled: boolean; color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? color : 'none'} stroke={color} strokeWidth={1.5} strokeLinejoin="round" aria-hidden>
      <Path d={HEART} />
    </Svg>
  );
}

/** Round glass favourite toggle (aria-pressed). */
export function FavButton({ on, onPress, label }: { on: boolean; onPress: () => void; label: string }) {
  const { c } = useTheme();
  return (
    <Touch
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: on }}
      aria-pressed={on}
      style={{ width: 44, height: 44, borderRadius: 999, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: c.stroke, backgroundColor: c.glass }}
    >
      <HeartIcon filled={on} color={on ? c.goldText : c.text} />
    </Touch>
  );
}

/** Soft sky wash behind the top of content screens (scrolls with content). */
export function TopWash({
  colors,
  height = 340,
  inHeader,
}: {
  colors: { dark: [string, string, string]; light: [string, string, string] };
  height?: number;
  /** Placed inside Screen's pinned `header` (stays put; content scrolls over it). */
  inHeader?: boolean;
}) {
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const top = inHeader ? -(insets.top + 8) : -(insets.top + 14);
  return (
    <LinearGradient
      aria-hidden
      pointerEvents="none"
      colors={isDark ? colors.dark : colors.light}
      locations={[0, 0.4, 1]}
      style={{ position: 'absolute', left: -40, right: -40, top, height }}
    />
  );
}

export const WASH = {
  dusk: { dark: ['#1A1630', '#5B3A4A', '#0B0F17'], light: ['#F2BE98', '#F8DEC7', '#F6F1E7'] },
  night: { dark: ['#0E1230', '#2A2350', '#0B0F17'], light: ['#C9BEDB', '#E9D9E3', '#F6F1E7'] },
} satisfies Record<string, { dark: [string, string, string]; light: [string, string, string] }>;

/** Compact header: back button + serif title (+ subtitle) + right slot. */
export function TitleBar({ title, subtitle, right, backLabel = 'Geri' }: { title: string; subtitle?: string; right?: ReactNode; backLabel?: string }) {
  const router = useRouter();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <IconButton icon="back" label={backLabel} onPress={() => (router.canGoBack() ? router.back() : router.replace('/ibadet'))} />
      <View style={{ flex: 1 }}>
        <Txt accessibilityRole="header" style={{ fontFamily: fonts.display, fontSize: 28, lineHeight: 34 }} numberOfLines={1}>
          {title}
        </Txt>
        {subtitle ? (
          <Txt v="small" tone="secondary" numberOfLines={1}>
            {subtitle}
          </Txt>
        ) : null}
      </View>
      {right}
    </View>
  );
}

/** Browsers draw their own outline inside our bordered boxes; the box shows focus instead. */
export const noWebOutline: TextStyle | null = Platform.OS === 'web' ? ({ outlineStyle: 'none', outlineWidth: 0 } as unknown as TextStyle) : null;

export function SearchField({ value, onChangeText, placeholder, label }: { value: string; onChangeText: (s: string) => void; placeholder: string; label: string }) {
  const { c } = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <View
      style={{ flexDirection: 'row', alignItems: 'center', gap: 10, height: 48, marginTop: 14, paddingHorizontal: 14, borderRadius: radius.md, backgroundColor: c.glass, borderWidth: 1, borderColor: focused ? c.goldLine : c.stroke }}
    >
      <Icon name="search" size={18} color={c.text2} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={c.text3}
        accessibilityLabel={label}
        returnKeyType="search"
        autoCorrect={false}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={[{ flex: 1, minWidth: 0, height: 46, color: c.text, fontFamily: fonts.regular, fontSize: 15 }, noWebOutline]}
      />
      {value ? (
        <Touch onPress={() => onChangeText('')} accessibilityRole="button" accessibilityLabel="Aramayı temizle" hitSlop={12}>
          <Icon name="close" size={16} color={c.text2} />
        </Touch>
      ) : null}
    </View>
  );
}

/** Two-tab pill switch used by Dualar / Esma ("Kategoriler" / "Favoriler · n"). */
export function TabSwitch<T extends string>({ tabs, value, onChange, label }: { tabs: { value: T; label: string }[]; value: T; onChange: (v: T) => void; label: string }) {
  const { c, isDark } = useTheme();
  return (
    <View accessibilityRole="tablist" accessibilityLabel={label} style={{ flexDirection: 'row', gap: 4, marginTop: 12, padding: 4, borderRadius: radius.md, backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(26,28,33,0.05)' }}>
      {tabs.map((t) => {
        const on = t.value === value;
        return (
          <Touch
            key={t.value}
            onPress={() => onChange(t.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            style={{ flex: 1, minHeight: 40, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? (isDark ? 'rgba(255,255,255,0.12)' : c.raised) : 'transparent' }}
          >
            <Txt v="subStrong" color={on ? c.text : c.text2} style={{ fontSize: 14 }}>
              {t.label}
            </Txt>
          </Touch>
        );
      })}
    </View>
  );
}

/** Turkish-insensitive search normalisation (â→a, ı/î→i, drops ’ - and spaces). */
export function norm(s: string | null | undefined): string {
  return (s ?? '')
    .toLocaleLowerCase('tr')
    .replace(/[âàá]/g, 'a')
    .replace(/[îıí]/g, 'i')
    .replace(/[ûú]/g, 'u')
    .replace(/[’'`\-\s.]/g, '');
}

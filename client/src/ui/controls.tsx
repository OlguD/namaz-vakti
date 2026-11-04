import * as Haptics from 'expo-haptics';
import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  TextInput,
  View,
  type PressableProps,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { useTheme } from '@/theme/theme';
import { fonts, HIT, radius } from '@/theme/tokens';
import { webBlur } from './Decor';
import { Icon, type IconName } from './Icon';
import { Txt } from './Text';

export function tapFeedback(): void {
  if (Platform.OS !== 'web') void Haptics.selectionAsync().catch(() => {});
}

/** Pressable with the design's subtle press state (opacity, never ripple colour). */
export function Touch({ style, children, ...rest }: PressableProps & { style?: StyleProp<ViewStyle>; children?: ReactNode }) {
  return (
    <Pressable
      {...rest}
      style={({ pressed }) => [style, pressed && { opacity: 0.72 }, rest.disabled && { opacity: 0.45 }]}
    >
      {children}
    </Pressable>
  );
}

/** Frosted card: glass fill, hairline stroke and a 1px inner top light. */
export function Glass({
  children,
  style,
  radius: r = radius.xl,
  strong,
  padded = true,
}: {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  radius?: number;
  strong?: boolean;
  padded?: boolean;
}) {
  const { c, isDark } = useTheme();
  return (
    <View
      style={[
        {
          borderRadius: r,
          backgroundColor: strong ? c.glassStrong : c.glass,
          borderWidth: 1,
          borderColor: c.stroke,
          borderTopColor: isDark ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.95)',
          padding: padded ? 16 : 0,
          overflow: 'hidden',
        },
        !isDark && styles.lightShadow,
        webBlur,
        style,
      ]}
    >
      {children}
    </View>
  );
}

/** Opaque surface for lists and sheets (bg.raised). */
export function Card({ children, style, padded = true }: { children?: ReactNode; style?: StyleProp<ViewStyle>; padded?: boolean }) {
  const { c, isDark } = useTheme();
  return (
    <View
      style={[
        { borderRadius: radius.lg, backgroundColor: c.raised, borderWidth: 1, borderColor: c.hair, padding: padded ? 16 : 0, overflow: 'hidden' },
        !isDark && styles.lightShadow,
        style,
      ]}
    >
      {children}
    </View>
  );
}

type ButtonKind = 'primary' | 'secondary' | 'ghost' | 'danger';

export function Button({
  label,
  onPress,
  kind = 'primary',
  icon,
  loading,
  disabled,
  style,
  accessibilityHint,
  compact,
}: {
  label: string;
  onPress?: () => void;
  kind?: ButtonKind;
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
  compact?: boolean;
}) {
  const { c } = useTheme();
  const look: Record<ButtonKind, { bg: string; fg: string; border?: string }> = {
    primary: { bg: c.gold, fg: c.onGold },
    secondary: { bg: c.glassStrong, fg: c.text, border: c.stroke },
    ghost: { bg: 'transparent', fg: c.goldText },
    danger: { bg: c.cautionTint, fg: c.caution, border: c.cautionLine },
  };
  const l = look[kind];
  return (
    <Touch
      onPress={() => {
        tapFeedback();
        onPress?.();
      }}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!(disabled || loading), busy: !!loading }}
      style={[
        {
          minHeight: compact ? 44 : 54,
          paddingHorizontal: compact ? 16 : 22,
          borderRadius: radius.md,
          backgroundColor: l.bg,
          borderWidth: l.border ? 1 : 0,
          borderColor: l.border,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
        },
        kind === 'primary' && styles.goldShadow,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={l.fg} />
      ) : (
        <>
          {icon ? <Icon name={icon} size={18} color={l.fg} /> : null}
          <Txt v="bodyStrong" color={l.fg} style={{ fontSize: compact ? 15 : 16 }}>
            {label}
          </Txt>
        </>
      )}
    </Touch>
  );
}

/** 44pt round glass button holding one icon. */
export function IconButton({
  icon,
  label,
  onPress,
  size = HIT,
  tone,
  style,
}: {
  icon: IconName;
  label: string;
  onPress?: () => void;
  size?: number;
  tone?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const { c } = useTheme();
  return (
    <Touch
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={size < HIT ? (HIT - size) / 2 : undefined}
      style={[
        {
          width: size,
          height: size,
          borderRadius: radius.full,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 1,
          borderColor: c.stroke,
          backgroundColor: c.glass,
        },
        webBlur,
        style,
      ]}
    >
      <Icon name={icon} size={20} color={tone ?? c.text} />
    </Touch>
  );
}

export function Chip({
  label,
  selected,
  onPress,
  icon,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: IconName;
}) {
  const { c } = useTheme();
  return (
    <Touch
      onPress={() => {
        tapFeedback();
        onPress?.();
      }}
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      style={{
        minHeight: 36,
        paddingHorizontal: 14,
        borderRadius: radius.sm,
        borderWidth: 1,
        borderColor: selected ? c.goldLine : c.stroke,
        backgroundColor: selected ? c.goldTint : 'transparent',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
      }}
    >
      {icon ? <Icon name={icon} size={16} color={selected ? c.goldText : c.text2} /> : null}
      <Txt v="subStrong" color={selected ? c.goldText : c.text}>
        {label}
      </Txt>
    </Touch>
  );
}

/** Segmented control (two to four options). */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  const { c } = useTheme();
  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={label}
      style={{ flexDirection: 'row', padding: 4, gap: 4, borderRadius: radius.md, backgroundColor: c.glass, borderWidth: 1, borderColor: c.stroke }}
    >
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Touch
            key={o.value}
            onPress={() => {
              tapFeedback();
              onChange(o.value);
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            style={{
              flex: 1,
              minHeight: 38,
              borderRadius: radius.sm,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: on ? c.goldTint : 'transparent',
              borderWidth: on ? 1 : 0,
              borderColor: c.goldLine,
            }}
          >
            <Txt v="subStrong" color={on ? c.goldText : c.text2}>
              {o.label}
            </Txt>
          </Touch>
        );
      })}
    </View>
  );
}

export function Toggle({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) {
  const { c } = useTheme();
  return (
    <Switch
      value={value}
      onValueChange={(v) => {
        tapFeedback();
        onChange(v);
      }}
      accessibilityLabel={label}
      trackColor={{ false: c.hair, true: c.gold }}
      thumbColor={Platform.OS === 'android' ? (value ? '#FFF7E6' : '#E8E3D9') : undefined}
      ios_backgroundColor={c.hair}
      {...(Platform.OS === 'web' ? ({ activeThumbColor: '#FFF7E6' } as object) : {})}
    />
  );
}

export function Field({
  label,
  error,
  hint,
  style,
  ...input
}: TextInputProps & { label: string; error?: string | null; hint?: string }) {
  const { c } = useTheme();
  return (
    <View style={[{ gap: 6 }, style as ViewStyle]}>
      <Txt v="subStrong" tone="secondary">
        {label}
      </Txt>
      <TextInput
        placeholderTextColor={c.text3}
        accessibilityLabel={label}
        {...input}
        style={{
          minHeight: 52,
          borderRadius: radius.md,
          borderWidth: 1,
          borderColor: error ? c.cautionLine : c.stroke,
          backgroundColor: c.input,
          paddingHorizontal: 16,
          color: c.text,
          fontFamily: fonts.regular,
          fontSize: 16,
        }}
      />
      {error ? (
        <Txt v="small" tone="caution" accessibilityLiveRegion="polite">
          {error}
        </Txt>
      ) : hint ? (
        <Txt v="small" tone="tertiary">
          {hint}
        </Txt>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  lightShadow: {
    shadowColor: '#463719',
    shadowOpacity: 0.12,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 1,
  },
  goldShadow: {
    shadowColor: '#C9A96E',
    shadowOpacity: 0.45,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 12 },
  },
});

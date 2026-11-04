import { View } from 'react-native';
import { useTheme } from '@/theme/theme';
import { radius } from '@/theme/tokens';
import { tapFeedback, Touch, Txt } from '@/ui';

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  disabled?: boolean;
  lang?: string;
  arabic?: boolean;
}

/**
 * Settings radio segments (Tema / Dil). Unlike the shared Segmented control it
 * supports disabled options ("yakında") and radio semantics.
 */
export function SegmentRow<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: SegmentOption<T>[];
  value: T;
  onChange: (v: T) => void;
}) {
  const { c, isDark } = useTheme();
  return (
    <View
      role="radiogroup"
      accessibilityLabel={label}
      style={{ flexDirection: 'row', padding: 3, gap: 3, borderRadius: radius.sm, backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(26,28,33,0.06)' }}
    >
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Touch
            key={o.value}
            disabled={o.disabled}
            onPress={() => {
              tapFeedback();
              onChange(o.value);
            }}
            role="radio"
            accessibilityState={{ checked: on, disabled: !!o.disabled }}
            accessibilityLabel={o.disabled ? `${o.label}, yakında` : o.label}
            style={{
              flex: 1,
              minHeight: 36,
              borderRadius: 9,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: on ? (isDark ? 'rgba(255,255,255,0.14)' : '#FFFCF6') : 'transparent',
              ...(on && !isDark ? { shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 4, shadowOffset: { width: 0, height: 1 } } : {}),
            }}
          >
            <Txt
              v="subStrong"
              lang={o.lang}
              color={on ? c.text : c.text2}
              style={o.arabic ? { fontFamily: 'Amiri_400Regular', fontSize: 17, lineHeight: 22 } : { fontSize: 14 }}
            >
              {o.label}
            </Txt>
          </Touch>
        );
      })}
    </View>
  );
}

/** Caption heading above a settings group. */
export function GroupLabel({ children }: { children: string }) {
  return (
    <Txt v="caption" tone="gold" accessibilityRole="header" style={{ marginTop: 24, marginBottom: 10, marginLeft: 4 }}>
      {children}
    </Txt>
  );
}

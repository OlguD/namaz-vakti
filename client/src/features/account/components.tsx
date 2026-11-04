import { useRouter, type Href } from 'expo-router';
import { onlineManager } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Linking, Platform, TextInput, View, type TextInputProps } from 'react-native';
import Svg, { Circle, G, Path, Rect } from 'react-native-svg';
import { useTheme } from '@/theme/theme';
import { fonts, radius } from '@/theme/tokens';
import { Icon, Touch, Txt } from '@/ui';
import { strengthLabel, type Strength } from './validation';

/** Brand mark from the auth design (girih star in a ring). */
export function AuthMark({ size = 60 }: { size?: number }) {
  const { c } = useTheme();
  return (
    <Svg width={size} height={size} viewBox="0 0 128 128" aria-hidden>
      <Circle cx="64" cy="64" r="62" fill="none" stroke={c.gold} strokeWidth={1.5} opacity={0.5} />
      <G fill="none" stroke={c.gold} strokeWidth={2.2}>
        <Rect x="34" y="34" width="60" height="60" />
        <Rect x="34" y="34" width="60" height="60" transform="rotate(45 64 64)" />
        <Circle cx="64" cy="64" r="18" />
      </G>
      <Circle cx="64" cy="64" r="4" fill={c.gold} />
    </Svg>
  );
}

/** Text field matching the auth forms (52pt, 16 radius, label above). */
export function FormField({
  label,
  help,
  error,
  right,
  ...input
}: TextInputProps & { label: string; help?: string | null; error?: string | null; right?: React.ReactNode }) {
  const { c } = useTheme();
  return (
    <View style={{ gap: 6 }}>
      <Txt v="subStrong" tone="secondary">
        {label}
      </Txt>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          minHeight: 52,
          borderRadius: radius.md,
          borderWidth: 1,
          borderColor: error ? c.caution : c.stroke,
          backgroundColor: c.input,
          paddingLeft: 16,
          paddingRight: right ? 4 : 16,
        }}
      >
        <TextInput
          placeholderTextColor={c.text3}
          accessibilityLabel={label}
          accessibilityHint={error ?? help ?? undefined}
          {...input}
          style={[{ flex: 1, minHeight: 50, color: c.text, fontFamily: fonts.regular, fontSize: 16 }, { outlineStyle: 'none' } as object]}
        />
        {right}
      </View>
      {error || help ? (
        <Txt v="small" color={error ? c.caution : c.text2} accessibilityLiveRegion={error ? 'polite' : 'none'} role={error ? 'alert' : undefined}>
          {error ?? help}
        </Txt>
      ) : null}
    </View>
  );
}

export function PasswordField({
  label = 'Şifre',
  value,
  onChangeText,
  strength,
  error,
  autoComplete = 'new-password',
  onSubmitEditing,
}: {
  label?: string;
  value: string;
  onChangeText: (v: string) => void;
  strength?: Strength;
  error?: string | null;
  autoComplete?: 'new-password' | 'current-password';
  onSubmitEditing?: () => void;
}) {
  const { c } = useTheme();
  const [show, setShow] = useState(false);
  const segColor = strength === 1 ? c.caution : c.sage;
  return (
    <View style={{ gap: 8 }}>
      <FormField
        label={label}
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={!show}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete={autoComplete}
        textContentType={autoComplete === 'new-password' ? 'newPassword' : 'password'}
        error={error}
        help={strength != null ? null : undefined}
        onSubmitEditing={onSubmitEditing}
        right={
          <Touch
            onPress={() => setShow((s) => !s)}
            accessibilityRole="button"
            accessibilityLabel={show ? 'Şifreyi gizle' : 'Şifreyi göster'}
            style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
          >
            <EyeIcon off={show} color={c.text2} />
          </Touch>
        }
      />
      {strength != null ? (
        <>
          <View style={{ flexDirection: 'row', gap: 6 }} aria-hidden>
            {[1, 2, 3].map((i) => (
              <View key={i} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: strength >= i ? segColor : c.hair }} />
            ))}
          </View>
          {value ? (
            <Txt v="small" color={strength <= 1 ? c.caution : c.text2} accessibilityLiveRegion="polite">
              {strengthLabel(strength)}
            </Txt>
          ) : (
            <Txt v="small" tone="secondary">
              En az 8 karakter ve bir rakam.
            </Txt>
          )}
        </>
      ) : null}
    </View>
  );
}

function EyeIcon({ off, color }: { off: boolean; color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <Path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
      <Circle cx="12" cy="12" r="3" />
      {off ? <Path d="M4 4l16 16" /> : null}
    </Svg>
  );
}

/** Square-ish checkbox row (terms acceptance). */
export function CheckRow({ checked, onChange, children, label }: { checked: boolean; onChange: (v: boolean) => void; children: React.ReactNode; label: string }) {
  const { c } = useTheme();
  return (
    <Touch
      onPress={() => onChange(!checked)}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={label}
      style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12, minHeight: 44, paddingVertical: 4 }}
    >
      <View
        style={{
          width: 22,
          height: 22,
          marginTop: 1,
          borderRadius: 6,
          borderWidth: 1.5,
          borderColor: checked ? c.gold : c.stroke,
          backgroundColor: checked ? c.gold : 'transparent',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {checked ? <Icon name="check" size={16} color={c.onGold} strokeWidth={2.2} /> : null}
      </View>
      <View style={{ flex: 1 }}>{children}</View>
    </Touch>
  );
}

/** Round initials avatar (gold ring for members, hairline for guests). */
export function Avatar({ text, size = 52, guest }: { text: string; size?: number; guest?: boolean }) {
  const { c } = useTheme();
  return (
    <View
      aria-hidden
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
        borderColor: guest ? c.hair : c.gold,
        backgroundColor: c.goldTint,
      }}
    >
      <Txt v="title" color={guest ? c.text2 : c.goldText} style={{ fontSize: size * 0.38, lineHeight: size * 0.46 }}>
        {text}
      </Txt>
    </View>
  );
}

/**
 * After a successful sign-in: pop the auth screens back to `next` (the screen
 * that sent the user here, e.g. /ayarlar or the chat) or home.
 */
export function useFinishAuth() {
  const router = useRouter();
  return (next?: string | null) => {
    const target = (next && next.startsWith('/') ? next : '/') as Href;
    router.dismissTo(target);
  };
}

/** Online state from React Query's onlineManager (wired to the device in api/query). */
export function useOnline(): boolean {
  const [online, setOnline] = useState(() => onlineManager.isOnline());
  useEffect(() => onlineManager.subscribe(setOnline), []);
  return online;
}

/** Opens the mail app's inbox where the OS allows it (iOS only). */
export const CAN_OPEN_MAIL = Platform.OS === 'ios';
export function openMailApp(): void {
  if (CAN_OPEN_MAIL) void Linking.openURL('message:').catch(() => {});
}

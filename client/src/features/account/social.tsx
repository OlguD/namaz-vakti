import * as AppleAuthentication from 'expo-apple-authentication';
import * as Google from 'expo-auth-session/providers/google';
import * as Crypto from 'expo-crypto';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform } from 'react-native';
import { useTheme } from '@/theme/theme';
import { radius } from '@/theme/tokens';
import { tapFeedback, Touch, Txt } from '@/ui';

WebBrowser.maybeCompleteAuthSession();

const GOOGLE = {
  iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || undefined,
  androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || undefined,
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || undefined,
};

/** Google needs the client id of the platform we run on. */
export const GOOGLE_ENABLED = !!Platform.select({
  ios: GOOGLE.iosClientId,
  android: GOOGLE.androidClientId,
  default: GOOGLE.webClientId,
});

/** Sign in with Apple exists on iOS only (Android/web would need a web flow). */
export function useAppleAvailable(): boolean {
  const [ok, setOk] = useState(false);
  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    void AppleAuthentication.isAvailableAsync().then(setOk).catch(() => setOk(false));
  }, []);
  return ok;
}

export interface AppleResult {
  identityToken: string;
  nonce: string;
  displayName?: string;
}

/** Runs the native Apple sheet. Resolves null when the user cancels. */
export async function signInWithApple(): Promise<AppleResult | null> {
  const nonce = Crypto.randomUUID();
  const hashed = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, nonce);
  try {
    const cred = await AppleAuthentication.signInAsync({
      requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL],
      nonce: hashed,
    });
    if (!cred.identityToken) return null;
    const name = [cred.fullName?.givenName, cred.fullName?.familyName].filter(Boolean).join(' ').trim();
    return { identityToken: cred.identityToken, nonce, displayName: name || undefined };
  } catch (e) {
    if ((e as { code?: string }).code === 'ERR_REQUEST_CANCELED') return null;
    throw e;
  }
}

export function SocialButton({
  label,
  onPress,
  loading,
  kind,
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
  kind: 'apple' | 'google';
}) {
  const { c, isDark } = useTheme();
  const apple = kind === 'apple';
  const bg = apple ? (isDark ? '#F3EEE4' : '#1A1C21') : c.glassStrong;
  const fg = apple ? (isDark ? '#0B0F17' : '#F6F1E7') : c.text;
  return (
    <Touch
      onPress={() => {
        tapFeedback();
        onPress();
      }}
      disabled={loading}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ busy: !!loading }}
      style={{
        minHeight: 54,
        borderRadius: radius.md,
        backgroundColor: bg,
        borderWidth: apple ? 0 : 1,
        borderColor: c.stroke,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {loading ? <ActivityIndicator color={fg} /> : <Txt v="bodyStrong" color={fg} style={{ fontSize: 16 }}>{label}</Txt>}
    </Touch>
  );
}

/** Google button with its own auth request (rendered only when configured). */
export function GoogleButton({ onToken, busy }: { onToken: (idToken: string) => void; busy?: boolean }) {
  const [request, response, promptAsync] = Google.useIdTokenAuthRequest(GOOGLE);
  useEffect(() => {
    if (response?.type === 'success') {
      const token = response.params.id_token ?? response.authentication?.idToken;
      if (token) onToken(token);
    }
  }, [response]); // eslint-disable-line react-hooks/exhaustive-deps
  return <SocialButton kind="google" label="Google ile devam et" loading={busy || !request} onPress={() => void promptAsync()} />;
}

import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Linking, View } from 'react-native';
import { PRIVACY_URL, TERMS_URL } from '@/api/config';
import { errorMessage } from '@/api/errors';
import { isRegistered, useSession } from '@/auth/session';
import { useAppleLogin, useGoogleLogin } from '@/features/account/api';
import { AuthMark, useFinishAuth } from '@/features/account/components';
import { GOOGLE_ENABLED, GoogleButton, signInWithApple, SocialButton, useAppleAvailable } from '@/features/account/social';
import { useTheme } from '@/theme/theme';
import { Header, Icon, Notice, Screen, Touch, Txt } from '@/ui';

export default function SignInScreen() {
  const { c } = useTheme();
  const router = useRouter();
  const { next } = useLocalSearchParams<{ next?: string }>();
  const user = useSession((s) => s.user);
  const finish = useFinishAuth();
  const appleAvailable = useAppleAvailable();
  const apple = useAppleLogin();
  const google = useGoogleLogin();
  const [error, setError] = useState<{ title: string; body: string } | null>(null);

  if (isRegistered(user) && !apple.isPending && !google.isPending) return <Redirect href="/profil" />;

  const onApple = async () => {
    setError(null);
    try {
      const res = await signInWithApple();
      if (!res) return;
      await apple.mutateAsync(res);
      finish(next);
    } catch (e) {
      setError({ title: 'Apple ile giriş tamamlanamadı', body: `${errorMessage(e)} Tekrar deneyin ya da başka bir yöntem seçin.` });
    }
  };
  const onGoogle = async (idToken: string) => {
    setError(null);
    try {
      await google.mutateAsync({ idToken });
      finish(next);
    } catch (e) {
      setError({ title: 'Google ile giriş tamamlanamadı', body: `${errorMessage(e)} Tekrar deneyin ya da başka bir yöntem seçin.` });
    }
  };

  return (
    <Screen sky="ikindi" contentStyle={{ flexGrow: 1 }}>
      <Header />
      <View style={{ alignItems: 'center', gap: 8 }}>
        <AuthMark />
        <Txt v="display" center accessibilityRole="header" style={{ marginTop: 4 }}>
          Hesabınızla devam edin
        </Txt>
        <Txt v="body" tone="sub" center style={{ maxWidth: 300 }}>
          Tercihleriniz ve bildirim ayarlarınız tüm cihazlarınızda aynı kalsın.
        </Txt>
      </View>

      {error ? (
        <View style={{ marginTop: 18 }}>
          <Notice icon="alert" title={error.title} body={error.body} />
        </View>
      ) : null}

      <View style={{ gap: 10, marginTop: 22 }}>
        {appleAvailable ? <SocialButton kind="apple" label="Apple ile devam et" loading={apple.isPending} onPress={() => void onApple()} /> : null}
        {GOOGLE_ENABLED ? <GoogleButton busy={google.isPending} onToken={(t) => void onGoogle(t)} /> : null}
        <Touch
          onPress={() => router.push({ pathname: '/kayit', params: next ? { next } : {} })}
          accessibilityRole="button"
          accessibilityLabel="E-posta ile devam et"
          style={{
            minHeight: 54,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: c.stroke,
            backgroundColor: c.glass,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
          }}
        >
          <Icon name="mail" size={18} color={c.text} strokeWidth={1.6} />
          <Txt v="callout" style={{ fontSize: 16 }}>
            E-posta ile devam et
          </Txt>
        </Touch>
      </View>

      <View aria-hidden style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 14 }}>
        <View style={{ flex: 1, height: 1, backgroundColor: c.hair }} />
        <Txt v="small" tone="secondary">
          veya
        </Txt>
        <View style={{ flex: 1, height: 1, backgroundColor: c.hair }} />
      </View>
      <Touch
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        accessibilityRole="button"
        style={{ alignSelf: 'center', minHeight: 44, justifyContent: 'center', paddingHorizontal: 10 }}
      >
        <Txt v="bodyStrong" tone="gold">
          Misafir olarak devam et
        </Txt>
      </Touch>

      <View style={{ flexDirection: 'row', gap: 12, marginTop: 10, padding: 14, paddingHorizontal: 16, borderRadius: 20, backgroundColor: c.raised, borderWidth: 1, borderColor: c.hair }}>
        <View style={{ width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: c.goldTint }}>
          <Icon name="chat" size={18} color={c.goldText} />
        </View>
        <Txt v="sub" tone="sub" style={{ flex: 1 }}>
          <Txt v="subStrong" style={{ fontFamily: 'Inter_600SemiBold' }}>
            Sohbet için giriş gerekir.
          </Txt>{' '}
          Vakitler, kıble, camiler ve canlı yayınlar misafir olarak da açık.
        </Txt>
      </View>

      <View style={{ flex: 1, minHeight: 24 }} />
      <Txt v="small" tone="secondary" center>
        Devam ederek{' '}
        <Txt v="small" accessibilityRole="link" style={{ textDecorationLine: 'underline' }} onPress={() => void Linking.openURL(TERMS_URL)}>
          Kullanım Koşulları
        </Txt>
        ’nı ve{' '}
        <Txt v="small" accessibilityRole="link" style={{ textDecorationLine: 'underline' }} onPress={() => void Linking.openURL(PRIVACY_URL)}>
          Gizlilik Politikası
        </Txt>
        ’nı kabul etmiş olursunuz.
      </Txt>
    </Screen>
  );
}

import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { errorMessage } from '@/api/errors';
import { refreshSession, useSession } from '@/auth/session';
import { reloadMe, useResendVerification } from '@/features/account/api';
import { CAN_OPEN_MAIL, openMailApp, useFinishAuth, useOnline } from '@/features/account/components';
import { VerifyArt } from '@/features/account/VerifyArt';
import { useTheme } from '@/theme/theme';
import { Button, Header, Icon, Notice, Screen, Touch, Txt } from '@/ui';

const RESEND_COOLDOWN = 60;
const POLL_MS = 5000;

/** "Check your inbox" after registering; continues by itself once verified. */
export default function CheckInboxScreen() {
  const { c } = useTheme();
  const router = useRouter();
  const finish = useFinishAuth();
  const params = useLocalSearchParams<{ email?: string; next?: string }>();
  const user = useSession((s) => s.user);
  const email = params.email ?? user?.email ?? '';
  const online = useOnline();
  const resend = useResendVerification();
  const [left, setLeft] = useState(42);
  const [verified, setVerified] = useState(!!user?.emailVerified);

  useEffect(() => {
    const id = setInterval(() => setLeft((n) => (n > 0 ? n - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, []);

  // Poll the profile; the link may be opened on another device.
  const busy = useRef(false);
  useEffect(() => {
    if (verified || !online) return;
    const id = setInterval(async () => {
      if (busy.current) return;
      busy.current = true;
      try {
        const me = await reloadMe();
        if (me.emailVerified) {
          await refreshSession().catch(() => false);
          setVerified(true);
        }
      } catch {
        // keep waiting
      } finally {
        busy.current = false;
      }
    }, POLL_MS);
    return () => clearInterval(id);
  }, [verified, online]);

  const waiting = left > 0;

  return (
    <Screen sky="aksam" contentStyle={{ flexGrow: 1 }}>
      <Header />
      {!online ? <Notice icon="offline" title="Çevrimdışısınız" body="Bağlantı gelince doğrulamayı kendimiz kontrol edeceğiz." /> : null}
      <View style={{ alignItems: 'center', marginTop: 12, gap: 10 }}>
        <VerifyArt done={verified} />
        <Txt v="display" center accessibilityRole="header" style={{ marginTop: 8 }}>
          {verified ? 'E-postanız doğrulandı' : 'E-postanızı doğrulayın'}
        </Txt>
        {verified ? (
          <Txt v="body" tone="sub" center style={{ maxWidth: 320 }}>
            Hesabınız hazır. Artık sohbete katılabilir ve ayarlarınızı cihazlarınız arasında eşitleyebilirsiniz.
          </Txt>
        ) : (
          <>
            <Txt v="body" tone="sub" center style={{ maxWidth: 320 }}>
              {email ? (
                <>
                  <Txt v="bodyStrong">{email}</Txt> adresine bir bağlantı gönderdik.
                </>
              ) : (
                'E-posta adresinize bir bağlantı gönderdik.'
              )}{' '}
              Bağlantıya dokunduğunuzda burada kendiliğinden devam edeceğiz.
            </Txt>
            <View role="status" style={{ flexDirection: 'row', alignItems: 'center', gap: 8, height: 32, paddingHorizontal: 14, borderRadius: 999, backgroundColor: online ? c.goldTint : c.cautionTint }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: online ? c.gold : c.caution }} />
              <Txt v="subStrong" color={online ? c.goldText : c.caution}>
                {online ? 'Doğrulama bekleniyor' : 'Bağlantı bekleniyor'}
              </Txt>
            </View>
            <Txt v="small" tone="secondary" center>
              Gelmedi mi? Gereksiz / Spam klasörüne de bakın.
            </Txt>
          </>
        )}
      </View>

      {resend.isError ? (
        <View style={{ marginTop: 14 }}>
          <Notice icon="alert" title="Bağlantı gönderilemedi" body={errorMessage(resend.error)} />
        </View>
      ) : null}

      <View style={{ flex: 1, minHeight: 24 }} />
      <View style={{ gap: 6 }}>
        {verified ? (
          <Button label="Devam et" onPress={() => finish(params.next)} />
        ) : (
          <>
            {CAN_OPEN_MAIL ? <Button label="E-posta uygulamasını aç" onPress={openMailApp} /> : null}
            <Touch
              disabled={waiting || !online || resend.isPending}
              onPress={async () => {
                try {
                  await resend.mutateAsync();
                  setLeft(RESEND_COOLDOWN);
                } catch {
                  // shown above
                }
              }}
              accessibilityRole="button"
              accessibilityState={{ disabled: waiting || !online }}
              style={{ minHeight: 48, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 }}
            >
              <Icon name="refresh" size={16} color={waiting || !online ? c.text3 : c.text} />
              <Txt v="callout" color={waiting || !online ? c.text3 : c.text} tnum>
                {waiting ? `Tekrar gönder · 0:${String(left).padStart(2, '0')}` : 'Bağlantıyı tekrar gönder'}
              </Txt>
            </Touch>
            <Touch onPress={() => router.replace('/kayit')} accessibilityRole="button" style={{ minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
              <Txt v="sub" tone="secondary">
                E-posta adresini değiştir
              </Txt>
            </Touch>
          </>
        )}
      </View>
    </Screen>
  );
}

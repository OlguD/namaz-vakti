import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { errorMessage } from '@/api/errors';
import { verifyEmailToken } from '@/features/account/api';
import { VerifyArt } from '@/features/account/VerifyArt';
import { Button, Header, Screen, Skeleton, Txt } from '@/ui';

/** One request per token, even if the effect runs twice (tokens are single-use). */
const inflight = new Map<string, Promise<void>>();
function verifyOnce(token: string): Promise<void> {
  let p = inflight.get(token);
  if (!p) {
    p = verifyEmailToken(token);
    inflight.set(token, p);
  }
  return p;
}

type State = { kind: 'working' } | { kind: 'done' } | { kind: 'error'; message: string };

/** Target of the e-mail link: namazvakti://verify-email?token=… (or the web URL). */
export default function VerifyEmailLinkScreen() {
  const router = useRouter();
  const { token } = useLocalSearchParams<{ token?: string }>();
  const [result, setState] = useState<State>({ kind: 'working' });
  const state: State = token ? result : { kind: 'error', message: 'Bağlantı eksik. E-postadaki bağlantıyı yeniden açın.' };

  useEffect(() => {
    if (!token) return;
    let alive = true;
    verifyOnce(token)
      .then(() => alive && setState({ kind: 'done' }))
      .catch((e: unknown) => alive && setState({ kind: 'error', message: errorMessage(e) }));
    return () => {
      alive = false;
    };
  }, [token]);

  return (
    <Screen sky="aksam" contentStyle={{ flexGrow: 1 }}>
      <Header onBack={() => router.replace('/')} />
      <View style={{ alignItems: 'center', gap: 12, marginTop: 12 }} accessibilityLiveRegion="polite">
        <VerifyArt done={state.kind === 'done'} />
        {state.kind === 'working' ? (
          <>
            <Txt v="display" center accessibilityRole="header">
              Doğrulanıyor…
            </Txt>
            <Skeleton width={220} height={14} />
          </>
        ) : state.kind === 'done' ? (
          <>
            <Txt v="display" center accessibilityRole="header">
              E-postanız doğrulandı
            </Txt>
            <Txt v="body" tone="sub" center style={{ maxWidth: 320 }}>
              Teşekkürler. Artık sohbete katılabilirsiniz.
            </Txt>
          </>
        ) : (
          <>
            <Txt v="display" center accessibilityRole="header">
              Doğrulanamadı
            </Txt>
            <Txt v="body" tone="sub" center style={{ maxWidth: 320 }}>
              {state.message} Gerekirse profilinizden yeni bir bağlantı isteyebilirsiniz.
            </Txt>
          </>
        )}
      </View>
      <View style={{ flex: 1, minHeight: 24 }} />
      {state.kind !== 'working' ? (
        <Button label={state.kind === 'done' ? 'Devam et' : 'Profile git'} onPress={() => router.replace(state.kind === 'done' ? '/' : '/profil')} />
      ) : null}
    </Screen>
  );
}

import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { errorMessage } from '@/api/errors';
import { useResetPassword } from '@/features/account/api';
import { PasswordField } from '@/features/account/components';
import { passwordStrength } from '@/features/account/validation';
import { useTheme } from '@/theme/theme';
import { Button, Header, Icon, Notice, Screen, Txt } from '@/ui';

/** Target of the reset e-mail: namazvakti://reset-password?token=… */
export default function ResetPasswordScreen() {
  const { c } = useTheme();
  const router = useRouter();
  const { token } = useLocalSearchParams<{ token?: string }>();
  const reset = useResetPassword();
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const strength = passwordStrength(pw);
  const mismatch = pw2.length > 0 && pw !== pw2;
  const ok = !!token && strength >= 2 && pw === pw2;

  if (reset.isSuccess) {
    return (
      <Screen sky="gunes">
        <Header back={false} />
        <View style={{ width: 52, height: 52, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: c.sageTint }}>
          <Icon name="check" size={26} color={c.sage} />
        </View>
        <Txt v="display" accessibilityRole="header" style={{ marginTop: 16 }}>
          Şifreniz yenilendi
        </Txt>
        <Txt v="body" tone="sub" style={{ marginTop: 8 }}>
          Güvenliğiniz için tüm cihazlardaki oturumlar kapatıldı. Yeni şifrenizle giriş yapabilirsiniz.
        </Txt>
        <Button label="Giriş yap" style={{ marginTop: 24 }} onPress={() => router.replace({ pathname: '/kayit', params: { mod: 'giris' } })} />
      </Screen>
    );
  }

  return (
    <Screen sky="gunes">
      <Header onBack={() => router.replace('/')} title="Yeni şifre belirleyin" subtitle="En az 8 karakter ve bir rakam kullanın." />
      {!token ? <Notice icon="alert" title="Bağlantı eksik" body="E-postadaki bağlantıyı yeniden açın ya da yeni bir bağlantı isteyin." /> : null}
      <View style={{ gap: 16, marginTop: 8 }}>
        <PasswordField label="Yeni şifre" value={pw} onChangeText={setPw} strength={strength} />
        <PasswordField label="Yeni şifre (tekrar)" value={pw2} onChangeText={setPw2} error={mismatch ? 'Şifreler aynı değil.' : null} />
      </View>
      {reset.isError ? (
        <View style={{ marginTop: 14 }}>
          <Notice icon="alert" title="Şifre yenilenemedi" body={errorMessage(reset.error)} />
        </View>
      ) : null}
      <Button
        label="Şifreyi yenile"
        style={{ marginTop: 24 }}
        disabled={!ok}
        loading={reset.isPending}
        onPress={() => token && reset.mutate({ token, password: pw })}
      />
    </Screen>
  );
}

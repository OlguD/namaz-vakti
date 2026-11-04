import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { errorMessage } from '@/api/errors';
import { useForgotPassword } from '@/features/account/api';
import { CAN_OPEN_MAIL, FormField, openMailApp } from '@/features/account/components';
import { isEmail } from '@/features/account/validation';
import { useTheme } from '@/theme/theme';
import { Button, Header, Icon, Notice, Screen, Touch, Txt } from '@/ui';

export default function ForgotPasswordScreen() {
  const { c } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string }>();
  const [email, setEmail] = useState(params.email ?? '');
  const [sent, setSent] = useState(false);
  const forgot = useForgotPassword();
  const valid = isEmail(email);

  const send = async () => {
    if (!valid) return;
    try {
      await forgot.mutateAsync(email.trim());
      setSent(true);
    } catch {
      // handled by forgot.error
    }
  };

  return (
    <Screen sky="gunes">
      <Header />
      <View style={{ width: 52, height: 52, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: c.goldTint, borderWidth: 1, borderColor: c.goldLine }}>
        <Icon name="lock" size={26} color={c.goldText} />
      </View>
      <Txt v="display" accessibilityRole="header" style={{ marginTop: 16 }}>
        Şifrenizi mi unuttunuz?
      </Txt>
      <Txt v="body" tone="sub" style={{ marginTop: 8 }}>
        Hesabınıza bağlı e-posta adresini yazın; şifrenizi yenilemeniz için bir bağlantı gönderelim.
      </Txt>

      <View style={{ marginTop: 22 }}>
        {sent ? (
          <View
            role="status"
            style={{ flexDirection: 'row', gap: 12, padding: 14, borderRadius: 16, backgroundColor: c.sageTint, borderWidth: 1, borderColor: c.sage }}
          >
            <Icon name="check" size={20} color={c.sage} strokeWidth={1.8} />
            <View style={{ flex: 1, gap: 2 }}>
              <Txt v="bodyStrong">Bağlantı gönderildi</Txt>
              <Txt v="sub" tone="sub">
                <Txt v="subStrong">{email.trim()}</Txt> adresini kontrol edin. Bağlantı sınırlı bir süre geçerlidir.
              </Txt>
            </View>
          </View>
        ) : (
          <FormField
            label="E-posta"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            textContentType="emailAddress"
            onSubmitEditing={() => void send()}
            error={email.includes('@') && !valid ? 'Geçerli bir e-posta adresi girin.' : null}
          />
        )}
        {forgot.isError ? (
          <View style={{ marginTop: 12 }}>
            <Notice icon="alert" title="Bağlantı gönderilemedi" body={errorMessage(forgot.error)} />
          </View>
        ) : null}
      </View>

      <View style={{ marginTop: 24, gap: 6 }}>
        {sent ? (
          CAN_OPEN_MAIL ? <Button label="E-posta uygulamasını aç" onPress={openMailApp} /> : null
        ) : (
          <Button label="Sıfırlama bağlantısı gönder" onPress={() => void send()} disabled={!valid} loading={forgot.isPending} />
        )}
        <Touch
          onPress={() => router.dismissTo('/giris')}
          accessibilityRole="button"
          style={{ alignSelf: 'center', minHeight: 44, justifyContent: 'center', paddingHorizontal: 12 }}
        >
          <Txt v="callout" tone="secondary">
            Giriş ekranına dön
          </Txt>
        </Touch>
      </View>
    </Screen>
  );
}

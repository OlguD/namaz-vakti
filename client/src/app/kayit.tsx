import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Linking, View } from 'react-native';
import { PRIVACY_URL, TERMS_URL } from '@/api/config';
import { errorMessage, isApiError } from '@/api/errors';
import { useEmailLogin, useRegister } from '@/features/account/api';
import { CheckRow, FormField, PasswordField, useFinishAuth } from '@/features/account/components';
import { isEmail, nameError, NAME_MAX, passwordStrength } from '@/features/account/validation';
import { Button, Header, Notice, Screen, Touch, Txt } from '@/ui';

/** E-posta ile kayıt (default) or giriş (`?mod=giris`). */
export default function EmailAuthScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ mod?: string; next?: string }>();
  const [mode, setMode] = useState<'register' | 'login'>(params.mod === 'giris' ? 'login' : 'register');
  const register = useRegister();
  const login = useEmailLogin();
  const finish = useFinishAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [agree, setAgree] = useState(false);
  const [touched, setTouched] = useState(false);
  const [serverError, setServerError] = useState<{ field: 'name' | 'email' | 'password' | 'form'; code: string; message: string } | null>(null);

  const isRegister = mode === 'register';
  const strength = passwordStrength(pw);
  const emailBad = email.length > 0 && !isEmail(email);
  const nameErr = nameError(name);
  const emailTaken = serverError?.code === 'EMAIL_TAKEN';
  const busy = register.isPending || login.isPending;
  const canSubmit = isRegister
    ? name.trim().length > 0 && !nameErr && isEmail(email) && strength >= 2 && agree
    : isEmail(email) && pw.length > 0;

  const submit = async () => {
    setTouched(true);
    setServerError(null);
    if (!canSubmit || busy) return;
    try {
      if (isRegister) {
        await register.mutateAsync({ email: email.trim(), password: pw, displayName: name.trim() });
        router.replace({ pathname: '/dogrula', params: { email: email.trim(), ...(params.next ? { next: params.next } : {}) } });
      } else {
        await login.mutateAsync({ email: email.trim(), password: pw });
        finish(params.next);
      }
    } catch (e) {
      const code = isApiError(e) ? e.code : 'UNKNOWN';
      const field = code === 'EMAIL_TAKEN' ? 'email' : code === 'DISPLAY_NAME_TAKEN' ? 'name' : code === 'INVALID_CREDENTIALS' ? 'password' : 'form';
      setServerError({ field, code, message: errorMessage(e) });
    }
  };

  const switchMode = () => {
    setMode(isRegister ? 'login' : 'register');
    setServerError(null);
    setTouched(false);
  };

  return (
    <Screen sky="ikindi">
      <Header
        title={isRegister ? 'E-posta ile kayıt' : 'E-posta ile giriş'}
        subtitle={isRegister ? 'Sohbete katılmak ve tercihlerinizi eşitlemek için.' : 'Hesabınıza e-posta ve şifrenizle girin.'}
      />
      {serverError?.field === 'form' ? (
        <View style={{ marginBottom: 14 }}>
          <Notice icon="alert" title={isRegister ? 'Hesap oluşturulamadı' : 'Giriş yapılamadı'} body={serverError.message} />
        </View>
      ) : null}

      <View style={{ gap: 16 }}>
        {isRegister ? (
          <FormField
            label="Görünen ad"
            value={name}
            onChangeText={(v) => {
              setName(v);
              if (serverError?.field === 'name') setServerError(null);
            }}
            autoComplete="nickname"
            textContentType="nickname"
            maxLength={NAME_MAX}
            error={serverError?.field === 'name' ? serverError.message : touched || name.length > 2 ? nameErr : null}
            help="Sohbette bu adla görünürsünüz; sonradan değiştirebilirsiniz."
          />
        ) : null}
        <View style={{ gap: 6 }}>
          <FormField
            label="E-posta"
            value={email}
            onChangeText={(v) => {
              setEmail(v);
              if (serverError?.field === 'email') setServerError(null);
            }}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            textContentType="emailAddress"
            error={emailTaken ? serverError!.message : emailBad && (touched || email.includes('@')) ? 'Geçerli bir e-posta adresi girin.' : null}
            help={isRegister ? 'Doğrulama bağlantısı bu adrese gelir.' : null}
          />
          {emailTaken ? (
            <Touch onPress={switchMode} accessibilityRole="button" style={{ alignSelf: 'flex-start', minHeight: 32, justifyContent: 'center' }}>
              <Txt v="subStrong" tone="gold">
                Giriş yapın
              </Txt>
            </Touch>
          ) : null}
        </View>
        <PasswordField
          value={pw}
          onChangeText={(v) => {
            setPw(v);
            if (serverError?.field === 'password') setServerError(null);
          }}
          autoComplete={isRegister ? 'new-password' : 'current-password'}
          strength={isRegister ? strength : undefined}
          error={serverError?.field === 'password' ? serverError.message : null}
          onSubmitEditing={() => void submit()}
        />
        {isRegister ? (
          <CheckRow checked={agree} onChange={setAgree} label="Kullanım Koşulları'nı ve Gizlilik Politikası'nı okudum, kabul ediyorum">
            <Txt v="sub" tone="sub">
              <Txt v="sub" accessibilityRole="link" style={{ textDecorationLine: 'underline' }} onPress={() => void Linking.openURL(TERMS_URL)}>
                Kullanım Koşulları
              </Txt>
              ’nı ve{' '}
              <Txt v="sub" accessibilityRole="link" style={{ textDecorationLine: 'underline' }} onPress={() => void Linking.openURL(PRIVACY_URL)}>
                Gizlilik Politikası
              </Txt>
              ’nı okudum, kabul ediyorum.
            </Txt>
          </CheckRow>
        ) : null}
      </View>

      <View style={{ marginTop: 24, gap: 12 }}>
        <Button label={isRegister ? 'Hesap oluştur' : 'Giriş yap'} onPress={() => void submit()} loading={busy} disabled={!canSubmit} />
        <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <Touch onPress={switchMode} accessibilityRole="button" style={{ minHeight: 44, justifyContent: 'center' }}>
            <Txt v="sub" tone="secondary">
              {isRegister ? 'Hesabınız var mı? ' : 'Hesabınız yok mu? '}
              <Txt v="subStrong" tone="gold">
                {isRegister ? 'Giriş yapın' : 'Kayıt olun'}
              </Txt>
            </Txt>
          </Touch>
          <Txt v="sub" tone="tertiary" aria-hidden>
            ·
          </Txt>
          <Link href={{ pathname: '/sifremi-unuttum', params: email ? { email } : {} }} asChild>
            <Touch accessibilityRole="link" style={{ minHeight: 44, justifyContent: 'center' }}>
              <Txt v="sub" tone="secondary">
                Şifremi unuttum
              </Txt>
            </Touch>
          </Link>
        </View>
      </View>
    </Screen>
  );
}

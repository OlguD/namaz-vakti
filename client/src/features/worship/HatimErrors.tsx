import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { errorMessage, isApiError } from '@/api/errors';
import { Button, Notice } from '@/ui';

/** Explains group-khatm errors and offers the fix (sign in, choose a display name). */
export function HatimError({ error }: { error: unknown }) {
  const router = useRouter();
  if (!error) return null;
  const code = isApiError(error) ? error.code : '';
  const needsName = code === 'DISPLAY_NAME_REQUIRED';
  const needsVerify = code === 'EMAIL_NOT_VERIFIED';
  const needsAccount = code === 'REGISTRATION_REQUIRED' || (code === 'FORBIDDEN' && !needsVerify);
  const notFound = isApiError(error) && error.status === 404;
  return (
    <View style={{ gap: 10 }}>
      <Notice
        icon="alert"
        title={needsName ? 'Önce bir görünen ad seçin' : needsVerify ? 'E-postanızı doğrulayın' : needsAccount ? 'Giriş gerekli' : notFound ? 'Davet kodu bulunamadı' : 'Yapılamadı'}
        body={
          needsName
            ? 'Hatimdeki diğer kişiler sizi bu adla görür.'
            : needsVerify
              ? 'Ortak hatim için e-posta adresinizi doğrulamanız gerekir. Gelen kutunuzdaki bağlantıya dokunun.'
              : needsAccount
              ? 'Ortak hatim için giriş yapmanız gerekir.'
              : notFound
                ? 'Kodu kontrol edip tekrar deneyin.'
                : errorMessage(error)
        }
      />
      {needsVerify ? <Button compact kind="secondary" label="Profili aç" onPress={() => router.push('/profil')} /> : null}
      {needsName ? <Button compact kind="secondary" label="Profili aç" onPress={() => router.push('/profil')} /> : null}
      {needsAccount ? <Button compact kind="secondary" label="Giriş yap" onPress={() => router.push('/giris')} /> : null}
    </View>
  );
}

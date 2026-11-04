import { useRouter, type Href } from 'expo-router';
import { View } from 'react-native';
import { errorMessage, isApiError } from '@/api/errors';
import { Button, Notice } from '@/ui';

/** Explains group-khatm errors and offers the fix (sign in, choose a display name). */
export function HatimError({ error }: { error: unknown }) {
  const router = useRouter();
  if (!error) return null;
  const code = isApiError(error) ? error.code : '';
  const needsName = code === 'DISPLAY_NAME_REQUIRED';
  const needsAccount = code === 'REGISTRATION_REQUIRED' || (isApiError(error) && error.status === 403);
  const notFound = isApiError(error) && error.status === 404;
  return (
    <View style={{ gap: 10 }}>
      <Notice
        icon="alert"
        title={needsName ? 'Önce bir görünen ad seçin' : needsAccount ? 'Giriş gerekli' : notFound ? 'Davet kodu bulunamadı' : 'Yapılamadı'}
        body={
          needsName
            ? 'Hatimdeki diğer kişiler sizi bu adla görür.'
            : needsAccount
              ? 'Ortak hatim için giriş yapmanız gerekir.'
              : notFound
                ? 'Kodu kontrol edip tekrar deneyin.'
                : errorMessage(error)
        }
      />
      {needsName ? <Button compact kind="secondary" label="Profili aç" onPress={() => router.push('/profil' as Href)} /> : null}
      {needsAccount ? <Button compact kind="secondary" label="Giriş yap" onPress={() => router.push('/giris' as Href)} /> : null}
    </View>
  );
}

import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { errorMessage, isApiError } from '@/api/errors';
import { isRegistered, signOut, useSession } from '@/auth/session';
import { useResendVerification, useUpdateProfile } from '@/features/account/api';
import { Avatar, FormField } from '@/features/account/components';
import { initials, nameError, NAME_MAX } from '@/features/account/validation';
import { GroupLabel } from '@/features/settings/components';
import { useTheme } from '@/theme/theme';
import { Button, Glass, Group, Header, Icon, Notice, Row, Screen, Touch, Txt } from '@/ui';

const METHOD: Record<string, { label: string; sub: string }> = {
  apple: { label: 'Apple', sub: 'Apple Kimliği ile bağlı' },
  google: { label: 'Google', sub: 'Google hesabı ile bağlı' },
  email: { label: 'E-posta', sub: 'Şifreyle giriş' },
};

export default function ProfileScreen() {
  const { c } = useTheme();
  const router = useRouter();
  const user = useSession((s) => s.user);
  const registered = isRegistered(user);
  const update = useUpdateProfile();
  const resend = useResendVerification();
  // null = untouched: show the account's current name.
  const [draft, setName] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);
  const name = draft ?? user?.displayName ?? '';

  const saved = user?.displayName ?? '';
  const trimmed = name.trim();
  const localErr = nameError(name);
  const dirty = trimmed !== saved && trimmed.length > 0;
  const serverErr = update.error && isApiError(update.error) && update.error.code === 'DISPLAY_NAME_TAKEN' ? errorMessage(update.error) : null;
  const method = METHOD[user?.providers?.[0] ?? 'email'] ?? METHOD.email!;
  const providerNote = user?.providers?.[0] && user.providers[0] !== 'email' ? ` · ${method.label} üzerinden` : '';

  const save = async () => {
    if (!dirty || localErr) return;
    try {
      await update.mutateAsync({ displayName: trimmed });
      setName(null);
      setJustSaved(true);
    } catch {
      // shown below
    }
  };

  return (
    <Screen sky="ikindi">
      <Header title="Profil" large />

      <View style={{ alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <Avatar text={registered ? initials(name || saved) : 'M'} guest={!registered} size={84} />
        <Txt v="small" tone="secondary" center>
          {registered ? 'Baş harfleriniz sohbette avatar olarak görünür' : 'Misafir'}
        </Txt>
      </View>

      {!registered ? (
        <Glass style={{ gap: 10, marginTop: 12, padding: 18 }}>
          <Txt v="headline">Misafir olarak kullanıyorsunuz</Txt>
          <Txt v="sub" tone="sub">
            Vakitler, kıble ve camiler hesap olmadan da çalışır. Sohbete katılmak ve ayarlarınızı eşitlemek için giriş yapın.
          </Txt>
          <Button label="Giriş yap veya kayıt ol" style={{ marginTop: 6 }} onPress={() => router.push({ pathname: '/giris', params: { next: '/profil' } })} />
        </Glass>
      ) : (
        <>
          <View style={{ marginTop: 12 }}>
            <FormField
              label="Görünen ad"
              value={name}
              onChangeText={(v) => {
                setName(v);
                setJustSaved(false);
                update.reset();
              }}
              autoComplete="nickname"
              maxLength={NAME_MAX}
              onSubmitEditing={() => void save()}
              error={serverErr ?? localErr}
              help="Sohbette bu adla görünürsünüz."
            />
          </View>

          <GroupLabel>HESAP</GroupLabel>
          <Group>
            <Row icon="user" title="Giriş yöntemi" subtitle={method.sub} value={method.label} />
            <Row
              icon="mail"
              title="E-posta"
              subtitle={user?.email ? `${user.email}${providerNote}` : 'Eklenmemiş'}
              right={
                user?.email ? (
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 4,
                      height: 26,
                      paddingHorizontal: 10,
                      borderRadius: 999,
                      backgroundColor: user.emailVerified ? c.sageTint : c.cautionTint,
                    }}
                  >
                    <Icon name={user.emailVerified ? 'check' : 'alert'} size={13} color={user.emailVerified ? c.sage : c.caution} strokeWidth={2} />
                    <Txt v="small" color={user.emailVerified ? c.sage : c.caution} weight="medium">
                      {user.emailVerified ? 'Doğrulandı' : 'Doğrulanmadı'}
                    </Txt>
                  </View>
                ) : undefined
              }
              last
            />
          </Group>

          {user?.email && !user.emailVerified ? (
            <View style={{ marginTop: 12 }}>
              <Notice
                icon="alert"
                title="E-postanız henüz doğrulanmadı."
                body="Doğrulanana kadar sohbette mesaj gönderemezsiniz."
                action={
                  <Touch
                    disabled={resend.isPending}
                    onPress={async () => {
                      try {
                        await resend.mutateAsync();
                        router.push({ pathname: '/dogrula', params: { email: user.email ?? '', next: '/profil' } });
                      } catch {
                        // shown below
                      }
                    }}
                    accessibilityRole="button"
                    style={{ minHeight: 36, justifyContent: 'center' }}
                  >
                    <Txt v="subStrong" tone="gold">
                      Doğrulama bağlantısını gönder
                    </Txt>
                  </Touch>
                }
              />
            </View>
          ) : null}
          {resend.isError ? (
            <Txt v="small" tone="caution" role="alert" style={{ marginTop: 8 }}>
              {errorMessage(resend.error)}
            </Txt>
          ) : null}
          {update.isError && !serverErr ? (
            <View style={{ marginTop: 12 }}>
              <Notice icon="alert" title="Kaydedilemedi" body={errorMessage(update.error)} />
            </View>
          ) : null}

          <Button
            label={justSaved && !dirty ? 'Kaydedildi' : 'Kaydet'}
            icon={justSaved && !dirty ? 'check' : undefined}
            style={{ marginTop: 24 }}
            disabled={!dirty || !!localErr}
            loading={update.isPending}
            onPress={() => void save()}
          />
          <Button label="Çıkış yap" kind="secondary" icon="logout" style={{ marginTop: 10 }} onPress={() => void signOut().then(() => router.dismissTo('/ayarlar'))} />
        </>
      )}
    </Screen>
  );
}

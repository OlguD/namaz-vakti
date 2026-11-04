import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { useSession } from '@/auth/session';
import { useDeleteAccount } from '@/features/account/api';
import { FormField } from '@/features/account/components';
import { GroupLabel } from '@/features/settings/components';
import { useTheme } from '@/theme/theme';
import { Button, Header, Icon, Notice, Screen, Touch, Txt } from '@/ui';

const CONFIRM = 'SİL';

export default function DeleteAccountScreen() {
  const { c } = useTheme();
  const router = useRouter();
  const user = useSession((s) => s.user);
  const providers = user?.providers ?? [];
  const del = useDeleteAccount();
  const [typed, setTyped] = useState('');
  const ok = typed.trim().toLocaleUpperCase('tr') === CONFIRM;

  if (del.isSuccess) {
    return (
      <Screen contentStyle={{ flexGrow: 1, justifyContent: 'center' }}>
        <View role="status" style={{ alignItems: 'center', gap: 14 }}>
          <View style={{ width: 64, height: 64, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: c.sageTint }}>
            <Icon name="check" size={30} color={c.sage} />
          </View>
          <Txt v="display" center accessibilityRole="header">
            Hesabınız silindi
          </Txt>
          <Txt v="body" tone="sub" center style={{ maxWidth: 320 }}>
            Vakit’i misafir olarak kullanmaya devam edebilirsiniz. Dilediğiniz zaman yeniden hesap oluşturabilirsiniz.
          </Txt>
        </View>
        <Button label="Tamam" style={{ marginTop: 32 }} onPress={() => router.dismissTo('/')} />
      </Screen>
    );
  }

  const linked = providers.includes('apple') ? 'Apple Kimliği' : providers.includes('google') ? 'Google hesabı' : 'e-posta ve şifre';
  const gone = [
    'Profiliniz ve görünen adınız',
    `Giriş bağlantınız (${linked} eşleşmesi)`,
    'Sohbette gönderdiğiniz tüm mesajlar',
    'Engellediğiniz kullanıcılar ve bildirdiğiniz içerik kayıtları',
    'İbadet kayıtlarınız, hatim ilerlemeniz ve eşitlenen ayarlarınız',
  ];
  const keep = ['Vakitler, kıble, camiler ve canlı yayınlar misafir olarak çalışır', 'Bu cihazdaki konum, tema ve bildirim tercihleri'];

  return (
    <Screen>
      <Header />
      <View style={{ width: 52, height: 52, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: c.cautionTint, borderWidth: 1, borderColor: c.cautionLine }}>
        <Icon name="trash" size={24} color={c.caution} />
      </View>
      <Txt v="display" accessibilityRole="header" style={{ marginTop: 16 }}>
        Hesabınızı silin
      </Txt>
      <Txt v="body" tone="sub" style={{ marginTop: 8 }}>
        <Txt v="bodyStrong" color={c.caution}>
          Bu işlem geri alınamaz.
        </Txt>{' '}
        Silinen bilgiler kurtarılamaz.
      </Txt>

      {del.isError ? (
        <View style={{ marginTop: 16 }}>
          <Notice icon="alert" title="Hesap silinemedi" body="Bağlantınızı kontrol edip tekrar deneyin. Hiçbir veri silinmedi." />
        </View>
      ) : null}

      <GroupLabel>SİLİNECEKLER</GroupLabel>
      <View style={{ gap: 10 }}>
        {gone.map((t) => (
          <Bullet key={t} text={t} color={c.caution} />
        ))}
      </View>
      <GroupLabel>CİHAZINIZDA KALIR</GroupLabel>
      <View style={{ gap: 10 }}>
        {keep.map((t) => (
          <Bullet key={t} text={t} color={c.sage} />
        ))}
      </View>

      <View style={{ marginTop: 24 }}>
        <FormField
          label={`Onaylamak için ${CONFIRM} yazın`}
          value={typed}
          onChangeText={setTyped}
          autoCapitalize="characters"
          autoCorrect={false}
          autoComplete="off"
        />
      </View>

      <View style={{ marginTop: 20, gap: 4 }}>
        <Button
          label={del.isError ? 'Tekrar dene' : 'Hesabımı kalıcı olarak sil'}
          kind="danger"
          disabled={!ok}
          loading={del.isPending}
          onPress={() => del.mutate()}
        />
        <Touch onPress={() => router.back()} accessibilityRole="button" style={{ minHeight: 48, alignItems: 'center', justifyContent: 'center' }}>
          <Txt v="callout" tone="secondary">
            Vazgeç
          </Txt>
        </Touch>
      </View>
    </Screen>
  );
}

function Bullet({ text, color }: { text: string; color: string }) {
  return (
    <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color, marginTop: 8 }} />
      <Txt v="body" tone="sub" style={{ flex: 1 }}>
        {text}
      </Txt>
    </View>
  );
}

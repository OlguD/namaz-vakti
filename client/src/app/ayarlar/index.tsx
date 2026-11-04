import { useQuery } from '@tanstack/react-query';
import * as Application from 'expo-application';
import Constants from 'expo-constants';
import { Link, useRouter, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, Platform, View } from 'react-native';
import { get } from '@/api/client';
import { PRIVACY_URL, TERMS_URL } from '@/api/config';
import { isRegistered, signOut, useSession } from '@/auth/session';
import { Avatar, useOnline } from '@/features/account/components';
import { initials } from '@/features/account/validation';
import { detectPlace, savePlace, usePlace } from '@/features/location/store';
import { getNotificationPermission, type PermissionState } from '@/features/notifications';
import { useSettings, useSettingsQuery, useUpdateSettings } from '@/features/settings/api';
import { GroupLabel, SegmentRow } from '@/features/settings/components';
import { VAKITS } from '@/lib/prayer';
import { useTheme } from '@/theme/theme';
import { Button, Group, Header, Icon, Notice, Row, Screen, Skeleton, Toggle, Touch, Txt } from '@/ui';

const PROVIDER_LABEL = { apple: 'Apple ile giriş', google: 'Google ile giriş', email: 'E-posta ile giriş' } as const;

export default function SettingsScreen() {
  const { c } = useTheme();
  const router = useRouter();
  const user = useSession((s) => s.user);
  const status = useSession((s) => s.status);
  const registered = isRegistered(user);
  const online = useOnline();
  const settings = useSettings();
  const settingsQuery = useSettingsQuery();
  const update = useUpdateSettings();
  const place = usePlace((s) => s.place);
  const detecting = usePlace((s) => s.detecting);
  const [locError, setLocError] = useState<string | null>(null);
  const [perm, setPerm] = useState<PermissionState | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    void getNotificationPermission().then(setPerm);
  }, []);

  const blocks = useQuery({
    queryKey: ['account', 'blocks'],
    queryFn: () => get<{ id: string }[]>('/me/blocks'),
    enabled: registered,
    staleTime: 60_000,
  });

  const auto = place?.mode !== 'manual';
  const toggleAuto = async (next: boolean) => {
    setLocError(null);
    if (next) {
      const res = await detectPlace();
      if (!res.ok) {
        setLocError(res.reason === 'denied' ? 'Konum izni verilmedi. İlçeyi elle seçebilirsiniz.' : 'Konum bulunamadı. İlçeyi elle seçebilirsiniz.');
        return;
      }
      update.mutate((s) => ({ ...s, location: { mode: 'auto', districtId: res.place.districtId } }));
    } else {
      if (place) await savePlace({ ...place, mode: 'manual' });
      update.mutate((s) => ({ ...s, location: { mode: 'manual', districtId: place?.districtId ?? null } }));
      router.push('/konum');
    }
  };

  const onCount = VAKITS.filter((v) => settings.prayerNotifications[v].enabled).length;
  const version = Application.nativeApplicationVersion ?? Constants.expoConfig?.version ?? '1.0.0';
  const build = Application.nativeBuildVersion;
  const provider = user?.providers?.[0];
  const loadingProfile = status === 'booting' && !user;
  const offline = !online || status === 'offline' || (settingsQuery.isError && !settingsQuery.data);

  return (
    <Screen sky="aksam">
      <Header title="Ayarlar" large />

      {offline ? (
        <View style={{ marginBottom: 14 }}>
          <Notice icon="offline" title="Çevrimdışı" body="Değişiklikler bağlantı gelince hesabınıza eşitlenir." />
        </View>
      ) : null}

      {loadingProfile ? (
        <View aria-busy accessibilityLabel="Profil yükleniyor" style={{ flexDirection: 'row', gap: 14, alignItems: 'center', padding: 16, borderRadius: 20, backgroundColor: c.glass, borderWidth: 1, borderColor: c.stroke }}>
          <Skeleton width={52} height={52} r={26} />
          <View style={{ flex: 1, gap: 8 }}>
            <Skeleton width="60%" height={14} />
            <Skeleton width="80%" height={12} />
          </View>
        </View>
      ) : (
        <Link href={(registered ? '/profil' : { pathname: '/giris', params: { next: '/ayarlar' } }) as Href} asChild>
          <Touch
            accessibilityRole="button"
            accessibilityLabel={registered ? `Profil: ${user?.displayName ?? ''}` : 'Giriş yap veya kayıt ol'}
            style={{ flexDirection: 'row', gap: 14, alignItems: 'center', padding: 16, borderRadius: 20, backgroundColor: c.glass, borderWidth: 1, borderColor: c.stroke }}
          >
            <Avatar text={registered ? initials(user?.displayName) : 'M'} guest={!registered} />
            <View style={{ flex: 1, gap: 3 }}>
              <Txt v="headline">{registered ? (user?.displayName ?? 'Hesabım') : 'Misafir'}</Txt>
              <Txt v="small" tone="secondary" numberOfLines={1}>
                {registered ? [provider ? PROVIDER_LABEL[provider] : null, user?.email].filter(Boolean).join(' · ') : 'Giriş yap veya kayıt ol'}
              </Txt>
              {registered && user?.email ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Icon name={user.emailVerified ? 'check' : 'alert'} size={14} color={user.emailVerified ? c.sage : c.caution} strokeWidth={2} />
                  <Txt v="small" color={user.emailVerified ? c.sage : c.caution}>
                    {user.emailVerified ? 'E-posta doğrulandı' : 'E-posta doğrulanmadı'}
                  </Txt>
                </View>
              ) : null}
            </View>
            <Icon name="forward" size={18} color={c.text3} />
          </Touch>
        </Link>
      )}

      <GroupLabel>KONUM</GroupLabel>
      <Group>
        <Row
          icon="locate"
          title="Otomatik konum"
          subtitle="Konum değiştikçe vakitleri günceller"
          right={detecting ? <Skeleton width={51} height={31} r={16} /> : <Toggle value={auto} onChange={(v) => void toggleAuto(v)} label="Otomatik konum" />}
        />
        <Row
          icon="pin"
          title={auto ? 'Konumdan bulunan ilçe' : 'Seçili ilçe'}
          subtitle={place ? [place.name, place.city && place.city !== place.name ? place.city : null].filter(Boolean).join(', ') : 'Seçilmedi'}
          onPress={() => router.push('/konum')}
        />
        <Row icon="calendar" title="Hesaplama yöntemi" value="Diyanet" last />
      </Group>
      {locError ? (
        <View style={{ marginTop: 10 }}>
          <Notice icon="pin" title="Otomatik konum açılamadı" body={locError} />
        </View>
      ) : null}

      <GroupLabel>BİLDİRİMLER</GroupLabel>
      {perm === 'denied' ? (
        <View style={{ marginBottom: 10 }}>
          <Notice
            icon="bellOff"
            title="Bildirim izni kapalı"
            body="Vakit bildirimleri için cihaz ayarlarından izin verin."
            action={
              <Touch onPress={() => void Linking.openSettings()} accessibilityRole="button" style={{ minHeight: 36, justifyContent: 'center' }}>
                <Txt v="subStrong" tone="gold">
                  Ayarları aç
                </Txt>
              </Touch>
            }
          />
        </View>
      ) : null}
      <Group>
        <Row icon="bell" title="Vakit bildirimleri" subtitle="Ses, hatırlatma ve her vakit ayrı" value={`${onCount} / 6 açık`} onPress={() => router.push('/ayarlar/bildirimler')} />
        <Row
          icon="moon"
          title="İftar ve sahur"
          value={settings.reminders.iftar || settings.reminders.sahur ? 'Ramazan’da açık' : 'Kapalı'}
          onPress={() => router.push('/ayarlar/bildirimler')}
        />
        <Row icon="live" title="Canlı yayınlar" value={settings.reminders.haramainLive ? 'Açık' : 'Kapalı'} onPress={() => router.push('/ayarlar/bildirimler')} last />
      </Group>
      {Platform.OS === 'web' ? (
        <Txt v="small" tone="secondary" style={{ marginTop: 8, marginLeft: 4 }}>
          Vakit bildirimleri telefon uygulamasında çalışır.
        </Txt>
      ) : null}

      <GroupLabel>GÖRÜNÜM</GroupLabel>
      <Group style={{ padding: 16, gap: 16 }}>
        <View style={{ gap: 10 }}>
          <Txt v="callout">Tema</Txt>
          <SegmentRow
            label="Tema"
            value={settings.theme}
            onChange={(theme) => update.mutate((s) => ({ ...s, theme }))}
            options={[
              { value: 'system', label: 'Sistem' },
              { value: 'dark', label: 'Koyu' },
              { value: 'light', label: 'Açık' },
            ]}
          />
        </View>
        <View style={{ gap: 10 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Txt v="callout">Dil</Txt>
            <Txt v="small" tone="secondary">
              English ve العربية yakında
            </Txt>
          </View>
          <SegmentRow
            label="Dil"
            value={settings.language}
            onChange={(language) => update.mutate((s) => ({ ...s, language }))}
            options={[
              { value: 'tr', label: 'Türkçe', lang: 'tr' },
              { value: 'en', label: 'English', lang: 'en', disabled: true },
              { value: 'ar', label: 'العربية', lang: 'ar', arabic: true, disabled: true },
            ]}
          />
        </View>
      </Group>

      <GroupLabel>TOPLULUK VE YASAL</GroupLabel>
      <Group>
        {registered ? (
          <Row
            icon="block"
            title="Engellenen kullanıcılar"
            value={blocks.data ? String(blocks.data.length) : undefined}
            onPress={() => router.push('/sohbet/engellenenler' as Href)}
          />
        ) : null}
        <Row icon="shield" title="Topluluk kuralları" onPress={() => router.push({ pathname: '/sohbet', params: { kurallar: '1' } } as Href)} />
        <Row icon="lock" title="Gizlilik politikası" onPress={() => void Linking.openURL(PRIVACY_URL)} accessibilityLabel="Gizlilik politikası, bağlantı" />
        <Row icon="book" title="Kullanım şartları" onPress={() => void Linking.openURL(TERMS_URL)} accessibilityLabel="Kullanım şartları, bağlantı" last />
      </Group>

      {registered ? (
        <>
          <Group style={{ marginTop: 24 }}>
            <Row
              icon="logout"
              title={signingOut ? 'Çıkış yapılıyor…' : 'Çıkış yap'}
              chevron={false}
              onPress={async () => {
                setSigningOut(true);
                await signOut();
                setSigningOut(false);
              }}
              last
            />
          </Group>
          <Button label="Hesabımı sil" kind="ghost" style={{ marginTop: 12 }} onPress={() => router.push('/hesabi-sil')} />
          <Txt v="small" tone="secondary" center style={{ marginTop: 2, paddingHorizontal: 12 }}>
            Hesabınız silinse de vakitler, kıble ve camiler misafir olarak çalışmaya devam eder.
          </Txt>
        </>
      ) : null}

      <Txt v="small" tone="tertiary" center style={{ marginTop: 24 }}>
        Vakit {version}
        {build ? ` (${build})` : ''}
      </Txt>
    </Screen>
  );
}

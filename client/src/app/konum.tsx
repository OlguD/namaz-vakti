import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Linking, Platform, View } from 'react-native';
import { PlacePicker } from '@/features/location/PlacePicker';
import { detectPlace, usePlace, type SavedPlace } from '@/features/location/store';
import { useUpdateSettings } from '@/features/settings/api';
import { useTheme } from '@/theme/theme';
import { Button, Header, Icon, Notice, Screen, Txt } from '@/ui';

/** Change the place prayer times are shown for (GPS or manual pick). */
export default function LocationScreen() {
  const router = useRouter();
  const { c } = useTheme();
  const place = usePlace((s) => s.place);
  const detecting = usePlace((s) => s.detecting);
  const update = useUpdateSettings();
  const [problem, setProblem] = useState<'denied' | 'failed' | null>(null);

  function mirror(p: SavedPlace) {
    update.mutate((d) => ({ ...d, location: { mode: p.mode, districtId: p.districtId } }));
  }

  async function locate() {
    setProblem(null);
    const r = await detectPlace();
    if (r.ok) {
      mirror(r.place);
      router.back();
    } else setProblem(r.reason === 'denied' ? 'denied' : 'failed');
  }

  return (
    <Screen scroll={false} header={<Header title="Konum" subtitle="Vakitler, kıble ve camiler bu konuma göre gösterilir." />}>
      {place ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <View style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: c.goldTint }}>
            <Icon name="pin" size={18} color={c.goldText} />
          </View>
          <View style={{ flex: 1 }}>
            <Txt v="callout">
              {place.name}
              {place.city && place.city !== place.name ? `, ${place.city}` : ''}
            </Txt>
            <Txt v="small" tone="secondary">
              {place.mode === 'auto' ? 'Otomatik (GPS)' : 'Elle seçildi'}
              {place.country ? ` · ${place.country}` : ''}
            </Txt>
          </View>
        </View>
      ) : null}
      <Button label="Konumumu kullan" kind="secondary" icon="locate" loading={detecting} onPress={() => void locate()} />
      {problem ? (
        <View style={{ marginTop: 12 }}>
          <Notice
            icon="alert"
            title={problem === 'denied' ? 'Konum izni kapalı' : 'Konum alınamadı'}
            body={problem === 'denied' ? 'İzni cihaz ayarlarından açabilir ya da aşağıdan şehrinizi seçebilirsiniz.' : 'Biraz sonra tekrar deneyin ya da aşağıdan şehrinizi seçin.'}
            action={
              problem === 'denied' && Platform.OS !== 'web' ? (
                <Button label="Ayarları aç" kind="ghost" compact onPress={() => void Linking.openSettings()} style={{ alignSelf: 'flex-start', paddingHorizontal: 0 }} />
              ) : undefined
            }
          />
        </View>
      ) : null}
      <View style={{ height: 18 }} />
      <PlacePicker
        ctaLabel="Bu konumu kullan"
        onDone={(p) => {
          mirror(p);
          router.back();
        }}
      />
    </Screen>
  );
}

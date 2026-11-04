import * as Sharing from 'expo-sharing';
import { useRouter } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { Platform, View, type ViewInstance } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import { usePlace } from '@/features/location/store';
import { usePrayerTimes } from '@/features/prayer/api';
import { CARD_H, CARD_W, ShareCard } from '@/features/prayer/ShareCard';
import { useTheme } from '@/theme/theme';
import type { ThemeName } from '@/theme/tokens';
import { Button, Header, Notice, Screen, Segmented, Txt } from '@/ui';

const PREVIEW = 252 / CARD_W;

/** Share the timetable (or the imsakiye in Ramadan) as a 1080×1350 image. */
export default function ShareScreen() {
  const router = useRouter();
  const { name } = useTheme();
  const place = usePlace((s) => s.place);
  const q = usePrayerTimes(30);
  const [cardTheme, setCardTheme] = useState<ThemeName>(name);
  const [busy, setBusy] = useState<'save' | 'share' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<ViewInstance>(null);

  const all = useMemo(() => q.data?.days ?? [], [q.data]);
  const ramadanDays = all.filter((d) => d.hijri?.month === 9);
  const ramadan = ramadanDays.length >= 10;
  const days = ramadan ? ramadanDays : all;
  const label = place ? `${place.name}${place.city && place.city !== place.name ? `, ${place.city}` : ''}` : '';

  async function capture(): Promise<string> {
    return captureRef(ref, { format: 'png', quality: 1, width: 1080, height: 1350, result: Platform.OS === 'web' ? 'data-uri' : 'tmpfile' });
  }

  async function run(kind: 'save' | 'share') {
    setBusy(kind);
    setError(null);
    try {
      const uri = await capture();
      const fileName = ramadan ? 'imsakiye.png' : 'vakitler.png';
      if (Platform.OS === 'web') {
        const blob = await (await fetch(uri)).blob();
        const file = new File([blob], fileName, { type: 'image/png' });
        const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
        if (kind === 'share' && nav.canShare?.({ files: [file] })) {
          await nav.share({ files: [file], title: ramadan ? 'İmsakiye' : 'Vakitler' });
        } else {
          const a = document.createElement('a');
          a.href = uri;
          a.download = fileName;
          a.click();
        }
      } else {
        await Sharing.shareAsync(uri, { mimeType: 'image/png', UTI: 'public.png', dialogTitle: ramadan ? 'İmsakiye kartı' : 'Vakit kartı' });
      }
    } catch (e) {
      if (!(e instanceof Error && /abort|cancel/i.test(e.message))) setError('Görsel hazırlanamadı. Tekrar deneyin.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <Screen header={<Header title={ramadan ? 'İmsakiye kartı' : 'Vakit kartı'} large={false} onBack={() => (router.canGoBack() ? router.back() : router.replace('/aylik'))} />}>
      <View style={{ alignItems: 'center' }}>
        <View
          accessible
          accessibilityRole="image"
          accessibilityLabel={`${ramadan ? 'İmsakiye' : 'Vakit'} kartı önizlemesi, ${label}`}
          style={{ width: CARD_W * PREVIEW, height: CARD_H * PREVIEW, borderRadius: 16, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 24, shadowOffset: { width: 0, height: 16 } }}
        >
          <View style={{ width: CARD_W, height: CARD_H, transform: [{ scale: PREVIEW }], transformOrigin: 'top left' }}>
            <ShareCard ref={ref} days={days} place={label} theme={cardTheme} ramadan={ramadan} />
          </View>
        </View>
        <Txt v="small" tone="secondary" tnum style={{ marginTop: 8 }}>
          1080 × 1350 · PNG
        </Txt>
        <View style={{ width: 220, marginTop: 12 }}>
          <Segmented
            label="Kart teması"
            value={cardTheme}
            onChange={setCardTheme}
            options={[
              { value: 'dark', label: 'Gece' },
              { value: 'light', label: 'Gündüz' },
            ]}
          />
        </View>
      </View>
      {error ? (
        <View style={{ marginTop: 16 }}>
          <Notice title={error} />
        </View>
      ) : null}
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 18 }}>
        {Platform.OS === 'web' ? (
          <Button label="İndir" kind="secondary" icon="down" loading={busy === 'save'} disabled={!days.length} onPress={() => void run('save')} style={{ flex: 1 }} />
        ) : null}
        <Button label="Paylaş" icon="share" loading={busy === 'share'} disabled={!days.length} onPress={() => void run('share')} style={{ flex: 1 }} />
      </View>
    </Screen>
  );
}

import { useQueryClient } from '@tanstack/react-query';
import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePlace } from '@/features/location/store';
import { mosqueName, useMosque, type Mosque, type NearbyMosques } from '@/features/mosques/api';
import { callPhone, openDirections, openWebsite } from '@/features/mosques/directions';
import { distanceLabel, formatDistance, metresBetween, walkTime } from '@/features/mosques/format';
import { MosqueMap } from '@/features/mosques/MosqueMap';
import { LocalIcon } from '@/features/qibla/icons';
import { useVakitState } from '@/features/prayer/api';
import { countdownLabel, VAKIT_LABEL } from '@/lib/prayer';
import { useTheme } from '@/theme/theme';
import { radius } from '@/theme/tokens';
import { Button, Icon, Skeleton, StateView, Touch, Txt, webBlur } from '@/ui';

export default function MosqueDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { c, isDark } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const place = usePlace((s) => s.place);
  const user = place?.lat != null && place?.lng != null ? { lat: place.lat, lng: place.lng } : null;

  // Show the row we already have from the nearby list while the full record loads.
  const cached = useMemo<Mosque | undefined>(() => {
    for (const [, data] of qc.getQueriesData<NearbyMosques>({ queryKey: ['mosques', 'nearby'] })) {
      const hit = data?.mosques.find((m) => m.id === id);
      if (hit) return hit;
    }
    return undefined;
  }, [qc, id]);
  const q = useMosque(id);
  const m = q.data ?? cached;
  const d = m && user ? metresBetween(user, m) : m?.distanceM;

  const close = () => (router.canGoBack() ? router.back() : router.replace('/camiler'));

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      {m ? (
        <MosqueMap center={{ lat: m.lat, lng: m.lng }} radius={500} mosques={[m]} selectedId={m.id} user={user} bottomInset={480} accessibilityLabel={`${mosqueName(m)} haritada`} />
      ) : null}
      <View
        accessibilityViewIsModal
        role="dialog"
        aria-label={m ? mosqueName(m) : 'Cami'}
        style={[
          {
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            maxWidth: 560,
            width: '100%',
            alignSelf: 'center',
            minHeight: 480,
            maxHeight: '86%',
            borderTopLeftRadius: radius.xxl,
            borderTopRightRadius: radius.xxl,
            backgroundColor: isDark ? 'rgba(18,24,38,0.96)' : 'rgba(255,252,246,0.97)',
            borderTopWidth: 1,
            borderColor: c.stroke,
            shadowColor: '#000',
            shadowOpacity: 0.4,
            shadowRadius: 24,
            shadowOffset: { width: 0, height: -12 },
            elevation: 12,
          },
          webBlur,
        ]}
      >
        <View style={{ alignSelf: 'center', width: 40, height: 5, marginTop: 10, borderRadius: 3, backgroundColor: c.grab }} />
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 24, flexGrow: 1 }} showsVerticalScrollIndicator={false}>
          {m ? (
            <MosqueBody m={m} d={d} onClose={close} />
          ) : q.isError ? (
            <StateView
              icon="alert"
              tone="caution"
              title="Cami bulunamadı"
              body="Bu kayıt kaldırılmış ya da bağlantı geçersiz olabilir."
              action={<Button label="Haritaya dön" kind="secondary" onPress={close} />}
            />
          ) : (
            <View style={{ gap: 12, marginTop: 16 }} aria-hidden>
              <Skeleton width="70%" height={28} />
              <Skeleton width="50%" height={14} />
              <Skeleton height={86} r={20} style={{ marginTop: 10 }} />
              <Skeleton height={56} r={16} />
            </View>
          )}
        </ScrollView>
      </View>
    </View>
  );
}

function MosqueBody({ m, d, onClose }: { m: Mosque; d: number | undefined; onClose: () => void }) {
  const { c } = useTheme();
  const place = usePlace((s) => s.place);
  const { next, remainingMs } = useVakitState();
  const name = mosqueName(m);

  return (
    <View style={{ flexGrow: 1 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginTop: 10 }}>
        <View style={{ gap: 6, flex: 1, minWidth: 0 }}>
          <Txt v="title" style={{ fontSize: 28, lineHeight: 34 }} accessibilityRole="header">
            {name}
          </Txt>
          {m.nameAr ? (
            <Txt v="arabicSm" lang="ar" style={{ textAlign: 'left', writingDirection: 'rtl', alignSelf: 'flex-start' }}>
              {m.nameAr}
            </Txt>
          ) : null}
          {m.address ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Icon name="pin" size={14} color={c.goldText} strokeWidth={2} />
              <Txt v="sub" tone="sub" style={{ flex: 1 }}>
                {m.address}
              </Txt>
            </View>
          ) : null}
        </View>
        <Touch onPress={onClose} accessibilityRole="button" accessibilityLabel="Kapat" style={{ width: 44, height: 44, marginTop: -4, marginRight: -10, alignItems: 'center', justifyContent: 'center', borderRadius: 999 }}>
          <Icon name="close" size={20} color={c.text2} />
        </Touch>
      </View>

      {d != null ? (
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
          <Chip icon="ruler" label={formatDistance(d)} a11y={distanceLabel(d)} />
          <Chip icon="walk" label={`${walkTime(d)} yürüme`} />
          {m.wheelchair === 'yes' || m.wheelchair === 'limited' ? <Chip label={m.wheelchair === 'yes' ? 'Engelli erişimi' : 'Kısmi engelli erişimi'} /> : null}
        </View>
      ) : null}

      {next ? (
        <View
          accessible
          accessibilityLabel={`Sonraki namaz ${VAKIT_LABEL[next.vakit]}, saat ${next.day.times[next.vakit]}, ${countdownLabel(remainingMs)} sonra`}
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 14, paddingVertical: 14, paddingHorizontal: 16, borderRadius: 20, backgroundColor: c.goldTint, borderWidth: 1, borderColor: c.goldLine }}
        >
          <View style={{ gap: 3 }}>
            <Txt v="caption" tone="gold" weight="semibold" style={{ fontSize: 10.5 }}>
              SONRAKİ NAMAZ
            </Txt>
            <Txt v="headline">{VAKIT_LABEL[next.vakit]}</Txt>
            <Txt v="small" tone="sub">
              {countdownShort(remainingMs)} sonra{place ? ` · ${place.name} vakti` : ''}
            </Txt>
          </View>
          <Txt v="time" tnum style={{ fontSize: 34, lineHeight: 38, letterSpacing: -0.3 }}>
            {next.day.times[next.vakit]}
          </Txt>
        </View>
      ) : null}

      <View style={{ marginTop: 16 }}>
        <Button label="Yol tarifi" icon="route" onPress={() => void openDirections({ lat: m.lat, lng: m.lng, name })} accessibilityHint="Harita uygulamasında yürüyüş rotasını açar" />
      </View>
      {m.phone || m.website ? (
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
          {m.phone ? <Button label="Ara" icon="phone" kind="secondary" style={{ flex: 1, minHeight: 52 }} onPress={() => callPhone(m.phone!)} /> : null}
          {m.website ? <Button label="Web sitesi" icon="globe" kind="secondary" style={{ flex: 1, minHeight: 52 }} onPress={() => openWebsite(m.website!)} /> : null}
        </View>
      ) : null}

      <Link href={{ pathname: '/cami/oner', params: { mosqueId: m.id, name, lat: String(m.lat), lng: String(m.lng) } }} asChild>
        <Touch accessibilityRole="link" style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 44, marginTop: 'auto', paddingTop: 16 }}>
          <Icon name="flag" size={14} color={c.text2} />
          <Txt v="sub" tone="secondary">
            Bilgi hatalı mı?{' '}
            <Txt v="sub" tone="gold" weight="semibold">
              Düzeltme önerin
            </Txt>
          </Txt>
        </Touch>
      </Link>
    </View>
  );
}

function countdownShort(ms: number): string {
  const min = Math.max(1, Math.round(ms / 60000));
  if (min < 60) return `${min} dk`;
  const h = Math.floor(min / 60);
  const r = min % 60;
  return r ? `${h} sa ${r} dk` : `${h} sa`;
}

function Chip({ icon, label, a11y }: { icon?: 'ruler' | 'walk'; label: string; a11y?: string }) {
  const { c } = useTheme();
  return (
    <View
      accessible
      accessibilityLabel={a11y ?? label}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 6, height: 32, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: c.hair }}
    >
      {icon ? <LocalIcon name={icon} size={16} color={c.goldText} /> : null}
      <Txt v="subStrong" tnum>
        {label}
      </Txt>
    </View>
  );
}


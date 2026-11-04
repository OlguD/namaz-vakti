import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Platform, View } from 'react-native';
import Svg, { Circle, G, Path, Rect } from 'react-native-svg';
import { detectPlace, usePlace } from '@/features/location/store';
import { usePrayerTimes, useQibla } from '@/features/prayer/api';
import { CompassDial } from '@/features/qibla/CompassDial';
import { formatKm, isAligned, normalize, shortestDelta } from '@/features/qibla/compass';
import { LocalIcon, type LocalIconName } from '@/features/qibla/icons';
import { useCompass } from '@/features/qibla/useCompass';
import { localDate } from '@/lib/prayer';
import { compassAbbr, compassName, distanceKm, KAABA, qiblaBearing } from '@/lib/qibla';
import { useTheme } from '@/theme/theme';
import { Button, Glass, Icon, Notice, Screen, Skeleton, Touch, Txt } from '@/ui';

export default function QiblaScreen() {
  const { isDark } = useTheme();
  const place = usePlace((s) => s.place);
  const hasCoords = place?.lat != null && place?.lng != null;
  const [calibrating, setCalibrating] = useState(false);

  return (
    <Screen tabs sky={isDark ? 'yatsi' : 'ogle'}>
      <QiblaHeader placeLabel={hasCoords ? placeLabel(place!) : 'Konum yok'} onCalibrate={hasCoords ? () => setCalibrating(true) : undefined} />
      {hasCoords ? (
        <QiblaBody lat={place!.lat!} lng={place!.lng!} calibrating={calibrating} setCalibrating={setCalibrating} />
      ) : (
        <NoLocation />
      )}
    </Screen>
  );
}

function placeLabel(p: { name: string; city: string | null }): string {
  return p.city && p.city !== p.name ? `${p.name}, ${p.city}` : p.name;
}

function QiblaHeader({ placeLabel: label, onCalibrate }: { placeLabel: string; onCalibrate?: () => void }) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
      <View style={{ gap: 4, flex: 1 }}>
        <Txt v="display" accessibilityRole="header" style={{ lineHeight: 38 }}>
          Kıble
        </Txt>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Icon name="pin" size={14} color={c.goldText} strokeWidth={2} />
          <Txt v="sub" tone="sub" style={{ fontSize: 14 }} numberOfLines={1}>
            {label}
          </Txt>
        </View>
      </View>
      {Platform.OS !== 'web' && onCalibrate ? (
        <Touch
          accessibilityRole="button"
          accessibilityLabel="Pusulayı kalibre et"
          onPress={onCalibrate}
          style={{ width: 44, height: 44, borderRadius: 999, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: c.stroke, backgroundColor: c.glass }}
        >
          <LocalIcon name="infinity" color={c.text} strokeWidth={1.5} />
        </Touch>
      ) : null}
    </View>
  );
}

function QiblaBody({
  lat,
  lng,
  calibrating,
  setCalibrating,
}: {
  lat: number;
  lng: number;
  calibrating: boolean;
  setCalibrating: (v: boolean) => void;
}) {
  const { c } = useTheme();
  const remote = useQibla();
  const qibla = Math.round(remote.data?.bearing ?? qiblaBearing(lat, lng));
  const km = remote.data?.distanceKm ?? distanceKm(lat, lng, KAABA.lat, KAABA.lng);
  const compass = useCompass();
  const calibDismissedAt = useRef(0);
  // Ask for a figure-8 when the OS says the heading is unreliable (not again for 30 s after "Tamamladım").
  useEffect(() => {
    if (compass.accuracy === 'low' && Date.now() - calibDismissedAt.current > 30_000) setCalibrating(true);
  }, [compass.accuracy, setCalibrating]);

  const live = compass.status === 'ok' && compass.heading != null;
  const heading = live ? Math.round(normalize(compass.heading!)) : null;
  const loading = compass.status === 'starting';
  const interference = compass.interference;
  const aligned = live && !interference && isAligned(heading!, qibla);
  const delta = live ? shortestDelta(heading!, qibla) : 0;
  const staticView = compass.status === 'unsupported' || compass.status === 'denied';

  // Haptic + spoken confirmation once per alignment.
  const wasAligned = useRef(false);
  useEffect(() => {
    if (aligned && !wasAligned.current) {
      if (Platform.OS !== 'web') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      AccessibilityInfo.announceForAccessibility('Kıble yönündesiniz');
    }
    wasAligned.current = aligned;
  }, [aligned]);

  const today = useQiblaTime();

  let pill: { text: string; icon: LocalIconName | 'check' | 'alert'; tone: 'sage' | 'caution' | 'plain' | 'muted' } | null = null;
  if (aligned) pill = { text: 'Kıbleye dönüksünüz', icon: 'check', tone: 'sage' };
  else if (loading) pill = { text: 'Pusula hazırlanıyor…', icon: 'spinner', tone: 'muted' };
  else if (calibrating || compass.accuracy === 'low') pill = { text: 'Pusula doğruluğu düşük', icon: 'alert', tone: 'caution' };
  else if (live && !interference) pill = { text: `${delta > 0 ? 'Sağa' : 'Sola'} ${Math.round(Math.abs(delta))}° dönün`, icon: delta > 0 ? 'arrowRight' : 'arrowLeft', tone: 'plain' };

  const accText = compass.accuracy === 'low' ? 'Düşük' : compass.accuracy === 'medium' ? 'Orta' : compass.accuracy === 'high' ? 'Yüksek' : '—';
  const accSub =
    compass.accuracy === 'low'
      ? 'Kalibrasyon gerekli'
      : compass.accuracy
        ? 'Pusula güvenilir'
        : staticView || compass.status === 'needs-permission'
          ? 'Sabit gösterim'
          : 'Sensör bekleniyor';
  const accColor = compass.accuracy === 'low' ? c.caution : compass.accuracy ? c.sage : c.text3;

  return (
    <View>
      {pill && !interference ? <StatusPill {...pill} /> : null}
      {compass.status === 'needs-permission' ? (
        <View style={{ marginTop: 14, alignItems: 'center', gap: 8 }}>
          <Txt v="sub" tone="sub" center>
            Canlı pusula için cihazınızın yön sensörüne erişim gerekiyor.
          </Txt>
          <Button label="Pusulayı başlat" kind="secondary" compact icon="compass" onPress={() => compass.retry?.()} accessibilityHint="Yön sensörüne erişim izni ister" />
        </View>
      ) : null}
      {interference ? (
        <View style={{ marginTop: 14 }}>
          <Notice
            icon="alert"
            title="Manyetik parazit algılandı"
            body="Mıknatıslı kılıf, hoparlör ya da metal yüzeylerden uzaklaşın. Bu sırada kıble saatini kullanabilirsiniz."
          />
        </View>
      ) : null}

      {calibrating ? (
        <CalibrateCard
          onDone={() => {
            calibDismissedAt.current = Date.now();
            setCalibrating(false);
          }}
        />
      ) : (
        <View style={{ marginTop: 10 }}>
          <CompassDial
            qibla={qibla}
            heading={heading}
            aligned={aligned}
            loading={loading}
            dimmed={interference}
            caption="KIBLE AÇISI"
            value={loading ? '—°' : `${qibla}°`}
            footer={
              loading
                ? 'Sensör bekleniyor'
                : live
                  ? `Cihaz ${heading}° ${compassAbbr(heading!)}`
                  : `${qibla}° ${compassName(qibla)} · kuzey yukarıda`
            }
            label={
              loading
                ? 'Pusula hazırlanıyor'
                : live
                  ? `Pusula: kıble ${qibla} derece, cihaz ${heading} derece${aligned ? '. Kıble yönündesiniz' : ''}`
                  : `Kıble, kuzeyden saat yönünde ${qibla} derece, ${compassName(qibla)}`
            }
          />
        </View>
      )}

      {staticView && !calibrating ? (
        <View style={{ marginTop: 12 }}>
          <Notice
            icon="info"
            tone="gold"
            title={compass.status === 'denied' ? 'Yön sensörüne izin verilmedi' : 'Canlı pusula bu cihazda yok'}
            body={`Kâbe, kuzeyden saat yönünde ${qibla}° (${compassName(qibla)}) yöndedir. Canlı pusula için uygulamayı telefonunuzda açın${compass.status === 'denied' ? ' ve hareket iznini verin' : ''}.`}
          />
        </View>
      ) : null}

      {!interference ? (
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
          <Stat label="MESAFE" loading={loading} value={formatKm(km)} sub="Kâbe'ye kuş uçuşu" />
          <Stat
            label="DOĞRULUK"
            loading={loading}
            value={
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: accColor }} />
                <Txt v="time" weight="light" style={{ fontSize: 22, lineHeight: 26 }}>
                  {accText}
                </Txt>
              </View>
            }
            sub={accSub}
          />
        </View>
      ) : null}

      <QiblaTimeCard time={today} loading={loading} alternative={interference || calibrating} />
    </View>
  );
}

function useQiblaTime(): string | null | undefined {
  const q = usePrayerTimes();
  if (!q.data) return q.isLoading ? undefined : null;
  const date = localDate();
  const day = q.data.days.find((d) => d.date === date) ?? q.data.days[0];
  return day?.qiblaTime ?? null;
}

function StatusPill({ text, icon, tone }: { text: string; icon: LocalIconName | 'check' | 'alert'; tone: 'sage' | 'caution' | 'plain' | 'muted' }) {
  const { c } = useTheme();
  const look = {
    sage: { bg: c.sageTint, line: c.sage, color: c.sage },
    caution: { bg: c.cautionTint, line: c.cautionLine, color: c.caution },
    plain: { bg: c.glass, line: c.stroke, color: c.text },
    muted: { bg: c.glass, line: c.stroke, color: c.text2 },
  }[tone];
  return (
    <View
      accessibilityRole="text"
      accessibilityLiveRegion="polite"
      aria-live="polite"
      style={{
        alignSelf: 'center',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginTop: 14,
        height: 36,
        paddingHorizontal: 16,
        borderRadius: 999,
        backgroundColor: look.bg,
        borderWidth: 1,
        borderColor: tone === 'sage' ? 'rgba(157,184,156,0.45)' : look.line,
      }}
    >
      {icon === 'check' || icon === 'alert' ? <Icon name={icon} size={16} color={look.color} strokeWidth={2} /> : <LocalIcon name={icon} size={16} color={look.color} strokeWidth={2} />}
      <Txt v="bodyStrong" color={look.color} style={{ fontSize: 14 }}>
        {text}
      </Txt>
    </View>
  );
}

function Stat({ label, value, sub, loading }: { label: string; value: ReactNode; sub: string; loading: boolean }) {
  return (
    <Glass radius={20} style={{ flex: 1, gap: 4, paddingVertical: 12, paddingHorizontal: 14 }}>
      <Txt v="caption" tone="secondary" style={{ fontSize: 10.5 }}>
        {label}
      </Txt>
      {loading ? (
        <Skeleton width="65%" height={22} r={6} />
      ) : typeof value === 'string' ? (
        <Txt v="time" tnum style={{ fontSize: 22, lineHeight: 26 }}>
          {value}
        </Txt>
      ) : (
        value
      )}
      <Txt v="small" tone="secondary">
        {sub}
      </Txt>
    </Glass>
  );
}

function QiblaTimeCard({ time, loading, alternative }: { time: string | null | undefined; loading: boolean; alternative: boolean }) {
  const { c, isDark } = useTheme();
  if (time === null) return null;
  return (
    <View
      accessible
      accessibilityLabel={`${alternative ? 'Alternatif: ' : ''}Kıble saati bugün ${time ?? ''}. Bu saatte güneş tam kıble yönündedir; güneşe döndüğünüzde kıbleye dönmüş olursunuz.`}
      style={{
        flexDirection: 'row',
        gap: 14,
        marginTop: 10,
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderRadius: 24,
        backgroundColor: c.raised,
        borderWidth: 1,
        borderColor: alternative ? c.goldLine : c.hair,
        shadowColor: '#000',
        shadowOpacity: isDark ? 0.4 : 0.1,
        shadowRadius: 20,
        shadowOffset: { width: 0, height: 12 },
      }}
    >
      <View style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: c.goldTint }}>
        <Icon name="sun" size={22} color={c.goldText} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <Txt v="caption" tone="gold" weight="semibold" style={{ fontSize: 10.5 }}>
            {alternative ? 'ALTERNATİF · KIBLE SAATİ' : 'KIBLE SAATİ'}
          </Txt>
          <Txt v="small" tone="secondary">
            bugün
          </Txt>
        </View>
        {loading || time === undefined ? (
          <Skeleton width="30%" height={24} r={6} style={{ marginVertical: 2 }} />
        ) : (
          <Txt v="time" tnum style={{ fontSize: 24, lineHeight: 28 }}>
            {time}
          </Txt>
        )}
        <Txt v="sub" tone="sub" style={{ lineHeight: 18 }}>
          Bu saatte güneş tam kıble yönündedir; güneşe döndüğünüzde kıbleye dönmüş olursunuz.
        </Txt>
      </View>
    </View>
  );
}

function CalibrateCard({ onDone }: { onDone: () => void }) {
  const { c } = useTheme();
  const eight = 'M120 62C150 18 214 18 214 62S150 106 120 62 26 18 26 62s64 44 94 0z';
  return (
    <Glass radius={28} style={{ marginTop: 10, height: 320, alignItems: 'center', gap: 10, paddingVertical: 18, paddingHorizontal: 16 }}>
      <View accessibilityLabel="Kalibrasyon talimatı" accessibilityRole="summary" style={{ alignItems: 'center', gap: 10, flex: 1 }}>
        <Svg width={240} height={124} viewBox="0 0 240 124" aria-hidden>
          <Path d={eight} fill="none" stroke={c.gold} strokeWidth={1.4} strokeDasharray="2 5" strokeLinecap="round" />
          <G transform="translate(120 62) rotate(-35)">
            <Rect x={-9} y={-15} width={18} height={30} rx={4} fill={c.bg} stroke={c.text} strokeWidth={1.5} />
            <Path d="M-3 -11H3" stroke={c.text} strokeWidth={1.2} strokeLinecap="round" />
          </G>
          <Circle cx={214} cy={62} r={3} fill={c.gold} />
          <Circle cx={26} cy={62} r={3} fill={c.gold} />
        </Svg>
        <Txt v="title" style={{ fontSize: 22, lineHeight: 28, marginTop: 4 }} center accessibilityRole="header">
          Pusulayı kalibre edin
        </Txt>
        <Txt v="sub" tone="sub" center style={{ fontSize: 14, lineHeight: 21 }}>
          Telefonunuzu havada yavaşça büyük bir 8 çizer gibi, birkaç kez hareket ettirin. Bilekten değil, kolunuzla.
        </Txt>
        <View style={{ marginTop: 'auto' }}>
          <Button label="Tamamladım" kind="secondary" compact onPress={onDone} />
        </View>
      </View>
    </Glass>
  );
}

function NoLocation() {
  const { c } = useTheme();
  const router = useRouter();
  const detecting = usePlace((s) => s.detecting);
  const [denied, setDenied] = useState(false);
  return (
    <View style={{ alignItems: 'center', gap: 10, paddingHorizontal: 12, marginTop: 40 }}>
      <Svg width={200} height={200} viewBox="0 0 200 200" aria-hidden>
        <Circle cx={100} cy={100} r={96} fill="none" stroke={c.hair} strokeWidth={1} strokeDasharray="1 6" />
        <Circle cx={100} cy={100} r={68} fill="none" stroke={c.hair} strokeWidth={1} />
        <G fill="none" stroke={c.gold} strokeWidth={0.8} opacity={0.5}>
          <Rect x={66} y={66} width={68} height={68} />
          <Rect x={66} y={66} width={68} height={68} transform="rotate(45 100 100)" />
        </G>
        <Path d="M100 122s-15-13.3-15-25.6a15 15 0 0 1 30 0c0 12.3-15 25.6-15 25.6z" fill={c.bg} stroke={c.text2} strokeWidth={1.6} strokeLinejoin="round" />
        <Circle cx={100} cy={96} r={4} fill={c.text2} />
        <Path d="M80 76l40 40" stroke={c.text2} strokeWidth={1.6} strokeLinecap="round" />
      </Svg>
      <Txt v="title" center style={{ marginTop: 8 }} accessibilityRole="header">
        Kıble için konum gerekli
      </Txt>
      <Txt v="sub" tone="sub" center style={{ fontSize: 14, lineHeight: 21 }}>
        Kâbe yönü ve uzaklığı bulunduğunuz yere göre hesaplanır. İzni açabilir ya da şehrinizi elle seçebilirsiniz.
      </Txt>
      {denied ? (
        <Txt v="small" tone="caution" center accessibilityLiveRegion="polite">
          Konum izni verilmedi. Ayarlardan izin verebilir ya da şehir seçebilirsiniz.
        </Txt>
      ) : null}
      <View style={{ alignSelf: 'stretch', gap: 8, marginTop: 12 }}>
        <Button
          label="Konum iznini aç"
          loading={detecting}
          onPress={async () => {
            const r = await detectPlace();
            setDenied(!r.ok);
          }}
        />
        <Button label="Şehir seç" kind="secondary" onPress={() => router.push('/konum')} />
      </View>
    </View>
  );
}

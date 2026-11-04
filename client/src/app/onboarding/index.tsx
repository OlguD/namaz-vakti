import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Linking, Platform, View } from 'react-native';
import Svg, { Circle, G, Rect, Text as SvgText } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { PlacePicker } from '@/features/location/PlacePicker';
import { requestNotificationPermission } from '@/features/notifications';
import { detectPlace, usePlace } from '@/features/location/store';
import { usePrayerTimes } from '@/features/prayer/api';
import { useSettings, useUpdateSettings } from '@/features/settings/api';
import { setFlag } from '@/lib/flags';
import { VAKITS, VAKIT_LABEL, type Vakit } from '@/lib/prayer';
import { qiblaBearing } from '@/lib/qibla';
import { useTheme } from '@/theme/theme';
import { radius } from '@/theme/tokens';
import { Button, Glass, Icon, IconButton, Notice, Screen, Toggle, Touch, Txt, type IconName } from '@/ui';

type Step = 1 | 2 | 3 | 4;

/** First-run flow: welcome → location → (city) → notifications. */
export default function Onboarding() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);

  async function finish(signIn: boolean) {
    await setFlag('onboarded', true);
    router.replace('/');
    if (signIn) router.push('/giris');
  }

  if (step === 1) return <Welcome onNext={() => setStep(2)} onSignIn={() => void finish(true)} />;
  if (step === 2) return <LocationStep onBack={() => setStep(1)} onDetected={() => setStep(4)} onManual={() => setStep(3)} />;
  if (step === 3)
    return (
      <Screen sky="ogle" scroll={false} header={<Progress step={3} onBack={() => setStep(2)} />}>
        <Txt v="display" accessibilityRole="header" style={{ fontSize: 30, lineHeight: 36, marginBottom: 14 }}>
          Şehrinizi seçin
        </Txt>
        <PlacePicker onDone={() => setStep(4)} />
      </Screen>
    );
  return <NotifyStep onBack={() => setStep(usePlace.getState().place?.mode === 'manual' ? 3 : 2)} onDone={(signIn) => void finish(signIn)} />;
}

function Progress({ step, onBack }: { step: Step; onBack?: () => void }) {
  const { c, isDark } = useTheme();
  const track = isDark ? 'rgba(243,238,228,0.22)' : 'rgba(26,28,33,0.16)';
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 16, minHeight: 44 }}>
      {onBack ? <IconButton icon="back" label="Geri" onPress={onBack} /> : null}
      <View
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={`Adım ${step} / 4`}
        accessibilityValue={{ min: 1, max: 4, now: step }}
        style={{ flex: 1, flexDirection: 'row', gap: 6, paddingRight: onBack ? 60 : 40, paddingLeft: onBack ? 0 : 40 }}
      >
        {[1, 2, 3, 4].map((i) => (
          <View key={i} style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: i <= step ? c.gold : track }} />
        ))}
      </View>
    </View>
  );
}

const SWATCHES: [Vakit, string, string][] = [
  ['imsak', '#2A2350', '#8E7FB5'],
  ['gunes', '#C98C6E', '#F8DEC7'],
  ['ogle', '#3E6585', '#CFE3F1'],
  ['ikindi', '#8A6430', '#F0D7A6'],
  ['aksam', '#8A4B45', '#F0C1A6'],
  ['yatsi', '#05070D', '#142040'],
];

function Welcome({ onNext, onSignIn }: { onNext: () => void; onSignIn: () => void }) {
  const { c } = useTheme();
  return (
    <Screen sky="ikindi" scroll={false} header={<Progress step={1} />}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Svg width={128} height={128} viewBox="0 0 128 128" aria-hidden>
          <G fill="none" stroke={c.gold} strokeWidth={1.1}>
            <Rect x="34" y="34" width="60" height="60" />
            <Rect x="34" y="34" width="60" height="60" transform="rotate(45 64 64)" />
            <Circle cx="64" cy="64" r="18" />
          </G>
          <Circle cx="64" cy="64" r="3" fill={c.gold} />
        </Svg>
        <Txt accessibilityRole="header" style={{ marginTop: 28, fontFamily: 'Fraunces_300Light', fontSize: 76, lineHeight: 80, letterSpacing: -2.2 }}>
          Vakit
        </Txt>
        <Txt tone="gold" style={{ marginTop: 10, fontFamily: 'Fraunces_300Light_Italic', fontSize: 24, lineHeight: 30 }}>
          Gökyüzünün ritminde.
        </Txt>
        <Txt tone="sub" center style={{ marginTop: 18, maxWidth: 300, lineHeight: 23 }}>
          Namaz vakitleri, kıble ve yakındaki camiler — reklamsız, sakin ve size ait bir düzende.
        </Txt>
        <View style={{ alignItems: 'center', gap: 12, marginTop: 40 }}>
          <Txt v="caption" tone="secondary">
            Gün boyu değişen gökyüzü
          </Txt>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            {SWATCHES.map(([v, a, b]) => (
              <View key={v} style={{ alignItems: 'center', gap: 6 }} accessible accessibilityLabel={`${VAKIT_LABEL[v]} gökyüzü`}>
                <LinearGradient colors={[a, b]} style={{ width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderColor: c.hair }} />
                <Txt v="tab" tone="secondary">
                  {VAKIT_LABEL[v]}
                </Txt>
              </View>
            ))}
          </View>
        </View>
      </View>
      <View style={{ gap: 8 }}>
        <Button label="Başlayalım" onPress={onNext} />
        <Touch onPress={onSignIn} accessibilityRole="link" style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <Txt v="body" tone="secondary" style={{ fontSize: 14 }}>
            Hesabınız var mı?
          </Txt>
          <Txt v="bodyStrong" tone="gold" style={{ fontSize: 14 }}>
            Giriş yapın
          </Txt>
        </Touch>
      </View>
    </Screen>
  );
}

function LocationStep({ onBack, onDetected, onManual }: { onBack: () => void; onDetected: () => void; onManual: () => void }) {
  const { c, isDark } = useTheme();
  const detecting = usePlace((s) => s.detecting);
  const [denied, setDenied] = useState(false);
  const [failed, setFailed] = useState(false);
  const line = isDark ? 'rgba(243,238,228,0.24)' : 'rgba(26,28,33,0.22)';
  const place = usePlace((s) => s.place);
  const bearing = place?.lat != null && place?.lng != null ? qiblaBearing(place.lat, place.lng) : 151;
  const rad = ((bearing - 90) * Math.PI) / 180;
  const mx = 140 + 92 * Math.cos(rad);
  const my = 110 + 92 * Math.sin(rad);

  async function detect() {
    if (denied && Platform.OS !== 'web') {
      void Linking.openSettings();
      return;
    }
    setDenied(false);
    setFailed(false);
    const r = await detectPlace();
    if (r.ok) onDetected();
    else if (r.reason === 'denied') setDenied(true);
    else setFailed(true);
  }

  const items: [IconName, string][] = [
    ['clock', 'Günün altı vakti, şehrinize göre dakikası dakikasına'],
    ['compass', 'Kâbe yönü ve uzaklığı'],
    ['mosque', 'Yakındaki camiler ve yürüme mesafesi'],
  ];

  return (
    <Screen sky="ogle" scroll={false} header={<Progress step={2} onBack={onBack} />}>
      <Svg width={280} height={220} viewBox="0 0 280 220" style={{ alignSelf: 'center' }} role="img" accessibilityLabel="Konum ve kıble yönünü gösteren pusula çizimi">
        <Circle cx="140" cy="110" r="100" fill="none" stroke={line} strokeWidth={1} strokeDasharray="1 6" />
        <Circle cx="140" cy="110" r="72" fill="none" stroke={line} strokeWidth={1} />
        <Circle cx="140" cy="110" r="44" fill="none" stroke={line} strokeWidth={1} opacity={0.7} />
        <G fill="none" stroke={c.gold} strokeWidth={0.75} opacity={0.55}>
          <Rect x="122" y="92" width="36" height="36" />
          <Rect x="122" y="92" width="36" height="36" transform="rotate(45 140 110)" />
        </G>
        <Rect x={mx - 5.5} y={my - 5.5} width="11" height="11" rx="1.5" fill={c.gold} opacity={denied ? 0.3 : 1} />
        <SvgText x={Math.min(mx + 12, 230)} y={my + 4} fontSize="11" fill={c.text2} opacity={denied ? 0.3 : 1}>
          {`Kâbe · ${Math.round(bearing)}°`}
        </SvgText>
        <SvgText x="140" y="8" textAnchor="middle" fontSize="10" fontWeight="600" letterSpacing="1.2" fill={c.text2}>
          K
        </SvgText>
        <Circle cx="140" cy="110" r="22" fill={denied ? 'transparent' : c.goldTint} />
        <Circle cx="140" cy="107" r="3.2" fill={denied ? c.text3 : c.gold} />
      </Svg>
      <Txt v="display" accessibilityRole="header" style={{ marginTop: 20, fontSize: 30, lineHeight: 36 }}>
        Vakitler, bulunduğunuz yere göre hesaplanır
      </Txt>
      <Txt tone="sub" style={{ marginTop: 10, lineHeight: 23 }}>
        Konumunuz yalnızca vakit hesabı, kıble yönü ve yakındaki camiler için kullanılır.
      </Txt>
      {denied ? (
        <View style={{ marginTop: 20 }}>
          <Notice
            icon="alert"
            title="Konum izni kapalı"
            body={
              Platform.OS === 'web'
                ? 'Tarayıcınızın site ayarlarından konum iznini açabilir ya da şehrinizi elle seçebilirsiniz. Kıble ve camiler için konum gerekir.'
                : "İzni Ayarlar › Vakit › Konum'dan açabilir ya da şehrinizi elle seçebilirsiniz. Kıble ve camiler için konum gerekir."
            }
          />
        </View>
      ) : failed ? (
        <View style={{ marginTop: 20 }}>
          <Notice icon="offline" title="Konum alınamadı" body="Biraz sonra tekrar deneyin ya da şehrinizi elle seçin." />
        </View>
      ) : (
        <View style={{ marginTop: 20, gap: 12 }}>
          {items.map(([icon, label]) => (
            <View key={label} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: c.goldTint }}>
                <Icon name={icon} size={18} color={c.goldText} />
              </View>
              <Txt v="body" style={{ fontSize: 14, flex: 1 }}>
                {label}
              </Txt>
            </View>
          ))}
        </View>
      )}
      <View style={{ marginTop: 'auto', gap: 8 }}>
        <Button
          label={denied ? (Platform.OS === 'web' ? 'Tekrar dene' : 'Ayarları aç') : 'Konumu kullan'}
          icon="pin"
          loading={detecting}
          onPress={() => void detect()}
        />
        <Button label="Şehir seçeceğim" kind="secondary" onPress={onManual} />
      </View>
    </Screen>
  );
}

const SOUND_LABEL: Record<string, string> = {
  mekke: 'Mekke',
  medine: 'Medine',
  istanbul: 'İstanbul',
  kisa: 'Kısa uyarı',
  cansesi: 'Çan sesi',
  sessiz: 'Sessiz bildirim',
};

function NotifyStep({ onBack, onDone }: { onBack: () => void; onDone: (signIn: boolean) => void }) {
  const { c } = useTheme();
  const settings = useSettings();
  const update = useUpdateSettings();
  const place = usePlace((s) => s.place);
  const times = usePrayerTimes(2);
  const today = times.data?.days[0];
  const [asking, setAsking] = useState(false);

  async function allow() {
    setAsking(true);
    try {
      await requestNotificationPermission();
    } catch {
      // Denied or unavailable: the user can enable it later in Settings.
    } finally {
      setAsking(false);
      onDone(true);
    }
  }

  const sample = today?.times.aksam ?? '18:03';
  return (
    <Screen sky="aksam" scroll={false} header={<Progress step={4} onBack={onBack} />}>
      <Txt v="display" accessibilityRole="header" style={{ fontSize: 28, lineHeight: 34 }}>
        Vakit girdiğinde, sessizce haber verelim
      </Txt>
      <Glass radius={radius.xl} style={{ marginTop: 16, padding: 14, flexDirection: 'row', gap: 12 }}>
        <View accessibilityLabel="Bildirim önizlemesi" style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: '#0B0F17', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(201,169,110,0.35)' }}>
          <Svg width={26} height={26} viewBox="0 0 128 128" aria-hidden>
            <G fill="none" stroke="#C9A96E" strokeWidth={5}>
              <Rect x="34" y="34" width="60" height="60" />
              <Rect x="34" y="34" width="60" height="60" transform="rotate(45 64 64)" />
            </G>
            <Circle cx="64" cy="64" r="8" fill="#C9A96E" />
          </Svg>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Txt v="small" tone="secondary" weight="semibold" style={{ letterSpacing: 0.7 }}>
              VAKİT
            </Txt>
            <Txt v="small" tone="secondary">
              şimdi
            </Txt>
          </View>
          <Txt v="bodyStrong">
            Akşam ezanı · <Txt v="bodyStrong" tnum>{sample}</Txt>
          </Txt>
          <Txt v="sub" tone="sub" style={{ lineHeight: 18 }}>
            {place?.name ?? 'Bulunduğunuz yer'}
            {place?.city && place.city !== place.name ? `, ${place.city}` : ''} için akşam vakti girdi.
          </Txt>
        </View>
      </Glass>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 18 }}>
        <Txt v="caption" tone="secondary">
          Vakit bildirimleri
        </Txt>
        <Txt v="small" tone="secondary">
          Sonradan Ayarlar'dan değişir
        </Txt>
      </View>
      <View style={{ marginTop: 8, paddingLeft: 16, paddingRight: 4, borderRadius: radius.xl, backgroundColor: c.raised, borderWidth: 1, borderColor: c.hair }}>
        {VAKITS.map((v, i) => {
          const pref = settings.prayerNotifications[v];
          const note = pref.sound === 'sessiz' ? 'Sessiz bildirim' : `Ezan · ${SOUND_LABEL[pref.sound] ?? pref.sound}`;
          return (
            <View key={v} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: c.hair }}>
              <View style={{ flex: 1, paddingVertical: 6, gap: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
                  <Txt v="callout">{VAKIT_LABEL[v]}</Txt>
                  <Txt v="sub" tone="secondary" tnum>
                    {today?.times[v] ?? ''}
                  </Txt>
                </View>
                <Txt v="small" tone="secondary">
                  {pref.enabled ? `${note}${pref.remindBeforeMinutes ? ` · ${pref.remindBeforeMinutes} dk önce hatırlat` : ''}` : 'Kapalı'}
                </Txt>
              </View>
              <View style={{ width: 56, alignItems: 'center' }}>
                <Toggle
                  value={pref.enabled}
                  label={`${VAKIT_LABEL[v]} bildirimi`}
                  onChange={(on) =>
                    update.mutate((d) => ({ ...d, prayerNotifications: { ...d.prayerNotifications, [v]: { ...d.prayerNotifications[v], enabled: on } } }))
                  }
                />
              </View>
            </View>
          );
        })}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 44, marginTop: 6, paddingHorizontal: 4 }}>
        <Txt v="sub" tone="secondary">
          Hesaplama: <Txt v="sub">Diyanet İşleri Başkanlığı</Txt>
        </Txt>
      </View>
      <View style={{ marginTop: 'auto', gap: 4 }}>
        <Button label="Bildirimlere izin ver" icon="bell" loading={asking} onPress={() => void allow()} />
        <Touch onPress={() => onDone(true)} accessibilityRole="button" style={{ minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
          <Txt v="callout" tone="secondary" style={{ fontSize: 14 }}>
            Daha sonra
          </Txt>
        </Touch>
      </View>
    </Screen>
  );
}

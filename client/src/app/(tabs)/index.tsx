import { Link, useRouter } from 'expo-router';
import { View } from 'react-native';
import { verseOfDay } from '@/content/verses';
import { usePlace } from '@/features/location/store';
import { CountdownRing } from '@/features/prayer/CountdownRing';
import { useQibla, useVakitState } from '@/features/prayer/api';
import { RamadanHome } from '@/features/prayer/RamadanHome';
import { TodayStrip } from '@/features/prayer/TodayStrip';
import { hijriFromIntl, hijriLabel, longDate } from '@/lib/dates';
import { countdownLabel, formatCountdown, localDate, VAKIT_DATIVE, VAKIT_LABEL } from '@/lib/prayer';
import { compassAbbr, qiblaBearing } from '@/lib/qibla';
import { useTheme } from '@/theme/theme';
import { dark } from '@/theme/tokens';
import { Glass, Icon, IconButton, Notice, Rosette, Screen, Skeleton, StateView, Touch, Txt, type IconName, Button } from '@/ui';

export default function HomeScreen() {
  const place = usePlace((s) => s.place);
  const state = useVakitState();
  const router = useRouter();

  if (!place) {
    return (
      <Screen tabs sky="yatsi">
        <StateView
          icon="pin"
          title="Konumunuzu seçin"
          body="Vakitleri gösterebilmemiz için bulunduğunuz yeri bilmemiz gerekiyor."
          action={<Button label="Konum seç" onPress={() => router.push('/konum')} />}
        />
      </Screen>
    );
  }
  if (state.today?.isRamadan) return <RamadanHome />;
  return <NormalHome />;
}

function NormalHome() {
  const { sky, isDark } = useTheme();
  const place = usePlace((s) => s.place)!;
  const { current, next, progress, remainingMs, today, data, isLoading, isError, refetch, isFetching } = useVakitState();
  const vakit = current?.vakit ?? 'yatsi';
  const s = sky(vakit);
  const ink = s.onDark ? dark : undefined;
  const qibla = useQibla();
  const router = useRouter();
  const bearing = qibla.data?.bearing ?? (place.lat != null && place.lng != null ? qiblaBearing(place.lat, place.lng) : null);
  const hijri = today?.hijri?.long ?? hijriLabel(today?.hijri ?? hijriFromIntl(new Date()));
  const verse = verseOfDay(localDate());

  return (
    <Screen tabs sky={vakit} refreshing={isFetching && !isLoading} onRefresh={refetch}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <Link href="/konum" asChild>
          <Touch accessibilityRole="button" accessibilityLabel={`Konum: ${place.name}. Değiştir`} style={{ flex: 1, gap: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Icon name="pin" size={12} color={ink?.goldText} strokeWidth={2} />
              <Txt v="caption" color={ink?.goldText}>
                {place.mode === 'auto' ? 'KONUMUNUZ' : 'SEÇİLİ KONUM'}
              </Txt>
            </View>
            <Txt v="hero" color={ink?.text} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
              {place.name}
            </Txt>
          </Touch>
        </Link>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <IconButton icon="chat" label="Sohbet" tone={ink?.text} onPress={() => router.push('/sohbet')} />
          <IconButton icon="sliders" label="Ayarlar" tone={ink?.text} onPress={() => router.push('/ayarlar')} />
        </View>
      </View>
      <Txt v="sub" color={ink?.sub} style={{ marginTop: 6 }}>
        {longDate(new Date())}
        {hijri ? (
          <>
            {' · '}
            <Txt v="sub" color={ink?.sub} weight="displayItalic">
              {hijri}
            </Txt>
          </>
        ) : null}
      </Txt>

      <View style={{ marginTop: 8 }}>
        {isLoading && !data ? (
          <View style={{ height: 240, alignItems: 'center', justifyContent: 'center' }}>
            <Skeleton width={200} height={200} r={100} />
          </View>
        ) : next ? (
          <CountdownRing
            progress={progress}
            caption={`${VAKIT_DATIVE[next.vakit]} kalan`.toLocaleUpperCase('tr')}
            countdown={formatCountdown(remainingMs)}
            footer={`${VAKIT_LABEL[vakit]} vakti · ${VAKIT_LABEL[next.vakit]} ${next.day.times[next.vakit]}`}
            accessibilityLabel={`${VAKIT_LABEL[next.vakit]} vaktine ${countdownLabel(remainingMs)} kaldı. Şu an ${VAKIT_LABEL[vakit]} vakti.`}
            onDark={s.onDark}
          />
        ) : (
          <View style={{ height: 240, justifyContent: 'center' }}>
            <StateView icon="offline" tone="caution" title="Vakitler yüklenemedi" body="Bağlantınızı kontrol edip tekrar deneyin." action={<Button label="Tekrar dene" kind="secondary" onPress={refetch} />} />
          </View>
        )}
      </View>

      {data?.stale || (isError && data) ? (
        <View style={{ marginTop: 10 }}>
          <Notice icon="offline" title="Çevrimdışı gösteriliyor" body="Son kaydedilen vakitler gösteriliyor. Bağlantı gelince güncellenecek." />
        </View>
      ) : null}

      <Link href="/aylik" asChild>
        <Touch accessibilityRole="button" accessibilityLabel="Bugünün vakitleri. Aylık tabloyu aç" style={{ marginTop: 14 }}>
          <TodayStrip day={today} current={vakit} />
        </Touch>
      </Link>

      <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }} accessibilityRole="menu">
        <Shortcut href="/kible" icon="compass" title="Kıble" sub={bearing != null ? `${Math.round(bearing)}° ${compassAbbr(bearing)}` : 'Pusula'} />
        <Shortcut href="/camiler" icon="mosque" title="Camiler" sub="Size yakın" />
        <Shortcut href="/ibadet" icon="tesbih" title="İbadet" sub="Zikir · tesbihat" />
        <Shortcut href="/sohbet" icon="chat" title="Sohbet" sub="Genel oda" />
      </View>

      <Glass style={{ marginTop: 12, paddingHorizontal: 18, paddingTop: 16, paddingBottom: 18, gap: 6 }}>
        <Rosette size={140} style={{ right: -36, top: -36 }} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Txt v="caption" tone="gold">
            Günün ayeti
          </Txt>
          <Txt v="small" tone="secondary">
            {verse.ref}
          </Txt>
        </View>
        <Txt v="arabic" lang="ar" style={{ fontSize: 24, lineHeight: 36 }}>
          {verse.arabic}
        </Txt>
        <Txt v="sub" tone="sub">
          “{verse.meaning}”
        </Txt>
      </Glass>
      {!isDark ? <View style={{ height: 4 }} /> : null}
    </Screen>
  );
}

function Shortcut({ href, icon, title, sub }: { href: '/kible' | '/camiler' | '/ibadet' | '/sohbet'; icon: IconName; title: string; sub: string }) {
  const { c } = useTheme();
  return (
    <Link href={href} asChild>
      <Touch accessibilityRole="button" accessibilityLabel={`${title}, ${sub}`} style={{ flex: 1 }}>
        <Glass radius={20} style={{ padding: 12, gap: 10 }}>
          <View style={{ width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: c.goldTint }}>
            <Icon name={icon} size={18} color={c.goldText} />
          </View>
          <View style={{ gap: 2 }}>
            <Txt v="subStrong">{title}</Txt>
            <Txt v="small" tone="secondary" tnum numberOfLines={2} style={{ fontSize: 11, lineHeight: 14 }}>
              {sub}
            </Txt>
          </View>
        </Glass>
      </Touch>
    </Link>
  );
}

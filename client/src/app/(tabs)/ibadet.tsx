import { Link, useRouter, type Href } from 'expo-router';
import { View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useVakitState } from '@/features/prayer/api';
import {
  PRAYER_KEYS,
  usePrayerLog,
  useNextHolyDay,
  useQuranProgress,
  useWorshipSummary,
  weekRange,
} from '@/features/worship/api';
import { unsyncedForDate, useDhikrQueue } from '@/features/worship/dhikrQueue';
import { WIcon, type WorshipIconName } from '@/features/worship/icons';
import { useDhikrSync } from '@/features/worship/useDhikrSync';
import { daysBetween, fmtNum, startedToday } from '@/features/worship/util';
import { hijriFromIntl, hijriLabel, weekday } from '@/lib/dates';
import { localDate } from '@/lib/prayer';
import { useTheme } from '@/theme/theme';
import { dark } from '@/theme/tokens';
import { Glass, IconButton, Screen, Skeleton, Touch, Txt } from '@/ui';

export default function IbadetScreen() {
  useDhikrSync();
  const { c, sky: skyFor } = useTheme();
  const router = useRouter();
  const today = localDate();
  const vakit = useVakitState();
  const summary = useWorshipSummary(today);
  const week = weekRange(today);
  const log = usePrayerLog(week.from, week.to);
  const quran = useQuranProgress(today);
  const holy = useNextHolyDay(today);
  const unsynced = useDhikrQueue((q) => unsyncedForDate(q, today));

  const s = summary.data;
  const dhikrToday = (s?.dhikrToday ?? 0) + unsynced;
  const started = startedToday(vakit.today, new Date());
  const due = 30 + started.size;
  const weekPct = log.data ? Math.round((log.data.totals.done / Math.max(1, due)) * 100) : null;
  const sky = vakit.current?.vakit ?? 'aksam';
  const hijri = vakit.today?.hijri?.long ?? hijriLabel(vakit.today?.hijri ?? hijriFromIntl(new Date()));

  const tiles: { title: string; sub: string; href: Href; icon: WorshipIconName; hero?: boolean }[] = [
    { title: 'Zikirmatik', sub: `Bugün ${fmtNum(dhikrToday)}`, href: '/zikir', icon: 'zikir', hero: true },
    { title: 'Tesbihat', sub: 'Namaz sonrası 4 adım', href: '/tesbihat', icon: 'tesbihat' },
    { title: 'Namaz Takibi', sub: weekPct == null ? 'Bu hafta' : `Bu hafta %${Math.min(100, weekPct)}`, href: '/namaz-takibi', icon: 'namaz' },
    {
      title: 'Kur’an & Hatim',
      sub: quran.data?.pagesPerDay ? `Günde ${quran.data.pagesPerDay} sayfa` : quran.data ? `${quran.data.currentJuz}. cüz · %${quran.data.percent}` : 'Kişisel ve ortak hatim',
      href: '/kuran',
      icon: 'kuran',
    },
    { title: 'Dualar', sub: 'Sabah · akşam · yolculuk', href: '/dualar' as Href, icon: 'dua' },
    { title: 'Esmaü’l-Hüsna', sub: '99 isim', href: '/esma' as Href, icon: 'esma' },
    {
      title: 'Dini Günler',
      sub: holy.data ? `${holy.data.nameTr.replace(/ Kandili$/, '')} · ${Math.max(0, daysBetween(today, holy.data.date))} gün` : 'Kandiller · bayramlar',
      href: '/dini-gunler' as Href,
      icon: 'gunler',
    },
    { title: 'Zekât', sub: 'Hesaplayıcı', href: '/zekat' as Href, icon: 'zekat' },
  ];

  const ink = skyFor(sky).onDark ? dark : c;

  return (
    <Screen tabs sky={sky} refreshing={summary.isRefetching} onRefresh={() => void summary.refetch()} contentStyle={{ paddingHorizontal: 16 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: 4 }}>
        <View style={{ gap: 4, flex: 1 }}>
          <Txt v="display" color={ink.text} accessibilityRole="header">
            İbadet
          </Txt>
          <Txt v="sub" color={ink.sub}>
            {weekday(today)}
            {hijri ? ' · ' : ''}
            {hijri ? (
              <Txt v="sub" color={ink.sub} weight="displayItalic">
                {hijri}
              </Txt>
            ) : null}
          </Txt>
        </View>
        <IconButton icon="chat" label="Sohbet" tone={ink.text} onPress={() => router.push('/sohbet')} />
      </View>

      {s ? (
        <Link href="/zikir/istatistik" asChild>
          <Touch
            accessibilityRole="button"
            accessibilityLabel={`Bugünün özeti: 5 vakitten ${s.prayers.done}'i kılındı, ${fmtNum(dhikrToday)} zikir, hatimde ${s.quran.currentJuz}. cüz, ${s.streakDays} gündür düzenli. İstatistikleri aç`}
            style={{ marginTop: 16 }}
          >
            <Glass radius={24} style={{ flexDirection: 'row', gap: 16, alignItems: 'center' }}>
              <PrayerRing statuses={PRAYER_KEYS.map((k) => !!s.prayers.statuses[k] && s.prayers.statuses[k] !== 'qada')} done={s.prayers.done} />
              <View style={{ flex: 1, gap: 10 }}>
                <Line label="Bugünkü zikir" value={fmtNum(dhikrToday)} big />
                <View style={{ gap: 5 }}>
                  <Line label="Hatim" value={`${s.quran.currentJuz}. cüz · %${s.quran.percent}`} />
                  <View style={{ height: 3, borderRadius: 2, backgroundColor: c.hair }}>
                    <View style={{ width: `${Math.min(100, s.quran.percent)}%`, height: 3, borderRadius: 2, backgroundColor: c.gold }} />
                  </View>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Txt v="small" tone="secondary">
                    Düzenli
                  </Txt>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <WIcon name="flame" size={14} color={c.goldText} />
                    <Txt v="subStrong" tone="gold" style={{ fontSize: 14 }}>
                      {s.streakDays > 0 ? `${s.streakDays} gündür` : 'Bugün başlayın'}
                    </Txt>
                  </View>
                </View>
              </View>
            </Glass>
          </Touch>
        </Link>
      ) : (
        <Glass radius={24} style={{ marginTop: 16, flexDirection: 'row', gap: 16, alignItems: 'center' }}>
          <View accessibilityLabel="Bugünün özeti yükleniyor" style={{ width: 96, height: 96, borderRadius: 48, borderWidth: 8, borderColor: c.hair }} />
          <View style={{ flex: 1, gap: 14 }}>
            <Skeleton width="70%" height={12} r={6} />
            <Skeleton width="55%" height={12} r={6} />
            <Skeleton width="62%" height={12} r={6} />
          </View>
        </Glass>
      )}

      <View accessibilityLabel="İbadet araçları" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 14 }}>
        {tiles.map((t) => (
          <Link key={t.title} href={t.href} asChild>
            <Touch accessibilityRole="button" accessibilityLabel={`${t.title}, ${t.sub}`} style={{ width: '48.5%', flexGrow: 1, flexBasis: '45%' }}>
              <View
                style={{
                  minHeight: 96,
                  padding: 14,
                  borderRadius: 22,
                  gap: 14,
                  justifyContent: 'space-between',
                  backgroundColor: t.hero ? c.goldTint : c.glass,
                  borderWidth: 1,
                  borderColor: t.hero ? c.goldLine : c.stroke,
                }}
              >
                <View style={{ width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: c.goldTint }}>
                  <WIcon name={t.icon} size={20} color={c.goldText} />
                </View>
                <View style={{ gap: 2 }}>
                  <Txt v="bodyStrong">{t.title}</Txt>
                  <Txt v="small" tone="secondary" tnum numberOfLines={1}>
                    {t.sub}
                  </Txt>
                </View>
              </View>
            </Touch>
          </Link>
        ))}
      </View>
    </Screen>
  );
}

function Line({ label, value, big }: { label: string; value: string; big?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
      <Txt v="small" tone="secondary">
        {label}
      </Txt>
      <Txt v={big ? 'callout' : 'subStrong'} tnum style={big ? { fontSize: 17 } : { fontSize: 14 }}>
        {value}
      </Txt>
    </View>
  );
}

/** Five arc segments, one per prayer, sage when prayed today. */
function PrayerRing({ statuses, done }: { statuses: boolean[]; done: number }) {
  const { c } = useTheme();
  return (
    <View style={{ width: 96, height: 96 }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width={96} height={96} viewBox="0 0 96 96" style={{ position: 'absolute' }}>
        {statuses.map((on, i) => (
          <Circle
            key={i}
            cx={48}
            cy={48}
            r={42}
            fill="none"
            stroke={on ? c.sage : c.hair}
            strokeWidth={7}
            strokeLinecap="round"
            strokeDasharray={`${0.17 * 2 * Math.PI * 42} ${2 * Math.PI * 42}`}
            strokeDashoffset={-((i * 20 + 1.5) / 100) * 2 * Math.PI * 42}
            transform="rotate(-90 48 48)"
          />
        ))}
      </Svg>
      <View style={{ position: 'absolute', inset: 0, left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
        <Txt v="time" tnum style={{ fontSize: 26, lineHeight: 28 }}>
          {done}/5
        </Txt>
        <Txt v="small" tone="secondary" style={{ fontSize: 10.5 }}>
          vakit
        </Txt>
      </View>
    </View>
  );
}


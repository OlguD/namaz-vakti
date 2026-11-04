import { LinearGradient } from 'expo-linear-gradient';
import { useMemo } from 'react';
import { View } from 'react-native';
import Svg, { Circle, G, Rect } from 'react-native-svg';
import { errorMessage } from '@/api/errors';
import { useHolyDayReminders, useReligiousDays } from '@/features/content/api';
import { countdownParts, dateLine, eventStart, groupHolyDays, hijriDayMonth, nextEvent, shortMonth, type HolyEvent } from '@/features/content/holyDays';
import { TitleBar } from '@/features/content/ui';
import { useNow } from '@/features/prayer/api';
import { dayMonth, parseDate, weekday } from '@/lib/dates';
import { useTheme } from '@/theme/theme';
import { fonts } from '@/theme/tokens';
import { Button, Screen, Skeleton, StateView, Toggle, Txt } from '@/ui';

export default function HolyDaysScreen() {
  const { c, isDark } = useTheme();
  const { data, isLoading, isError, error, refetch, isFetching } = useReligiousDays();
  const reminders = useHolyDayReminders();
  const now = useNow(30_000);

  const events = useMemo(() => groupHolyDays(data ?? []), [data]);
  const hero = nextEvent(events, now);
  const rest = events.filter((e) => e !== hero);
  const years = [...new Set(events.map((e) => e.hijriYear))].sort();
  const subtitle = years.length ? `${years[0]}${years.length > 1 ? ` – ${years[years.length - 1]}` : ''} · Türkiye takvimi` : 'Türkiye takvimi';

  return (
    <Screen refreshing={isFetching && !isLoading} onRefresh={refetch}>
      <TitleBar title="Dini günler" subtitle={subtitle} backLabel="İbadet’e dön" />

      {isLoading && !data ? (
        <View style={{ gap: 12, marginTop: 16 }}>
          <Skeleton height={260} r={28} />
          <Skeleton height={340} r={24} />
        </View>
      ) : !data ? (
        <StateView icon="offline" tone="caution" title="Takvim yüklenemedi" body={isError ? errorMessage(error) : undefined} action={<Button label="Tekrar dene" kind="secondary" onPress={() => refetch()} />} />
      ) : events.length === 0 ? (
        <StateView icon="calendar" title="Yaklaşan dini gün yok" body="Takvim henüz güncellenmedi. Biraz sonra tekrar bakın." />
      ) : (
        <>
          {hero ? <Hero ev={hero} now={now} on={reminders.isOn(hero.key)} onToggle={(v) => reminders.set(hero.key, v)} /> : null}

          {rest.length ? (
            <>
              <Txt v="titleSm" accessibilityRole="header" style={{ marginTop: 22, marginBottom: 8, marginHorizontal: 4 }}>
                Yılın takvimi
              </Txt>
              <View accessibilityRole="list" style={{ paddingVertical: 4, paddingHorizontal: 14, borderRadius: 24, backgroundColor: c.raised, borderWidth: 1, borderColor: c.hair }}>
                {rest.map((ev, i) => (
                  <DayRow key={`${ev.key}@${ev.date}`} ev={ev} first={i === 0} on={reminders.isOn(ev.key)} onToggle={(v) => reminders.set(ev.key, v)} />
                ))}
              </View>
            </>
          ) : null}
        </>
      )}

      <Txt v="small" tone="secondary" style={{ marginTop: 12, marginHorizontal: 4, lineHeight: 18 }}>
        Tarihler Diyanet takvimine göredir; hilal gözlemine bağlı olarak bir gün değişebilir. Kandiller, belirtilen günün akşamından itibaren (ertesi güne bağlanan gece) idrak edilir.
      </Txt>
      {!isDark ? <View style={{ height: 8 }} /> : null}
    </Screen>
  );
}

function meta(ev: HolyEvent): string {
  const parts = [weekday(ev.date)];
  if (ev.kind === 'bayram') {
    parts.push(`${ev.days} gün`);
    if (ev.arefe) parts.push(`arefe ${dayMonth(ev.arefe).replace(/(\S+)$/, (m) => m.slice(0, 3))}`);
  } else if (ev.key === 'ramazan-baslangici') {
    parts.push('ilk oruç');
  } else {
    const h = hijriDayMonth(ev.hijri);
    if (h) parts.push(h);
  }
  parts.push(String(parseDate(ev.date).getFullYear()));
  return parts.join(' · ');
}

function Hero({ ev, now, on, onToggle }: { ev: HolyEvent; now: Date; on: boolean; onToggle: (v: boolean) => void }) {
  const { c, isDark } = useTheme();
  const start = eventStart(ev);
  const started = start.getTime() <= now.getTime();
  const { days, hours, minutes } = countdownParts(start, now);
  const eyebrow = started ? 'BUGÜN' : ev.alsoMarks ? `YAKLAŞAN · ${ev.alsoMarks.toLocaleUpperCase('tr')}` : 'YAKLAŞAN';
  const when = `${dateLine(ev.date)}${ev.kind === 'night' ? ' · akşam namazından sonra' : ev.kind === 'bayram' ? ` · ${ev.days} gün` : ''}`;
  const gold = isDark ? c.gold : '#9A7A3C';
  const cell = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,252,246,0.7)';

  return (
    <View style={{ marginTop: 16, borderRadius: 28, overflow: 'hidden', borderWidth: 1, borderColor: c.stroke }}>
      <LinearGradient colors={isDark ? ['#05070D', '#0B1224', '#142040'] : ['#C9BEDB', '#E9D9E3', '#F6F1E7']} locations={[0, 0.55, 1]} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
      <Svg width={360} height={300} style={{ position: 'absolute', right: -60, top: -40 }} opacity={0.1} aria-hidden>
        <G fill="none" stroke={gold} strokeWidth={0.8}>
          <Rect x="90" y="60" width="180" height="180" />
          <Rect x="90" y="60" width="180" height="180" transform="rotate(45 180 150)" />
          <Circle cx="180" cy="150" r="70" />
        </G>
      </Svg>
      <View style={{ paddingTop: 22, paddingHorizontal: 18, paddingBottom: 18 }}>
        <Txt v="caption" tone="gold" weight="semibold">
          {eyebrow}
        </Txt>
        <Txt accessibilityRole="header" style={{ fontFamily: fonts.display, fontSize: 30, lineHeight: 36, marginTop: 4 }}>
          {ev.name}
        </Txt>
        <Txt v="body" tone="sub" style={{ fontSize: 14, marginTop: 2 }}>
          {when}
        </Txt>
        {started ? (
          <Txt v="body" tone="gold" style={{ marginTop: 16 }}>
            {ev.kind === 'night' ? 'Mübarek geceniz hayırlara vesile olsun.' : 'Hayırlı bayramlar, hayırlı günler.'}
          </Txt>
        ) : (
          <View accessible accessibilityRole="timer" accessibilityLabel={`${days} gün ${hours} saat ${minutes} dakika kaldı`} style={{ flexDirection: 'row', gap: 8, marginTop: 18 }}>
            {[
              [days, 'gün'],
              [hours, 'saat'],
              [minutes, 'dakika'],
            ].map(([v, l]) => (
              <View key={l as string} style={{ flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 18, backgroundColor: cell }}>
                <Txt tnum style={{ fontFamily: fonts.thin, fontSize: 44, lineHeight: 48 }}>
                  {String(v).padStart(2, '0')}
                </Txt>
                <Txt v="small" tone="secondary" style={{ marginTop: 4 }}>
                  {l as string}
                </Txt>
              </View>
            ))}
          </View>
        )}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: c.hair }}>
          <Txt v="body" style={{ fontSize: 14 }}>
            Bir gün önce hatırlat
          </Txt>
          <Toggle value={on} onChange={onToggle} label={`${ev.name} hatırlatması`} />
        </View>
      </View>
    </View>
  );
}

function DayRow({ ev, first, on, onToggle }: { ev: HolyEvent; first: boolean; on: boolean; onToggle: (v: boolean) => void }) {
  const { c, isDark } = useTheme();
  const bayram = ev.kind === 'bayram';
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64, borderTopWidth: first ? 0 : 1, borderTopColor: c.hair }}>
      <View
        accessible
        accessibilityLabel={`${parseDate(ev.date).getDate()} ${dayMonth(ev.date)}`}
        style={{ width: 46, alignItems: 'center', paddingVertical: 6, borderRadius: 14, backgroundColor: bayram ? c.goldTint : isDark ? 'rgba(255,255,255,0.04)' : 'rgba(26,28,33,0.04)' }}
      >
        <Txt tnum weight="medium" style={{ fontSize: 18, lineHeight: 22 }}>
          {String(parseDate(ev.date).getDate()).padStart(2, '0')}
        </Txt>
        <Txt v="small" tone="secondary" style={{ fontSize: 10.5, lineHeight: 13 }}>
          {shortMonth(ev.date)}
        </Txt>
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 2, paddingVertical: 10 }}>
        <Txt v="callout">{ev.name}</Txt>
        <Txt v="small" tone="secondary" tnum>
          {meta(ev)}
        </Txt>
      </View>
      <Toggle value={on} onChange={onToggle} label={`${ev.name} hatırlatması`} />
    </View>
  );
}

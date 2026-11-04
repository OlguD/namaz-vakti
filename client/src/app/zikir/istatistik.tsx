import { Link } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { useDhikrStats, type DhikrStats } from '@/features/worship/api';
import { unsyncedForDate, useDhikrQueue } from '@/features/worship/dhikrQueue';
import { WIcon } from '@/features/worship/icons';
import { useDhikrSync } from '@/features/worship/useDhikrSync';
import { fmtNum, shortDay } from '@/features/worship/util';
import { MONTHS_TR, parseDate } from '@/lib/dates';
import { localDate } from '@/lib/prayer';
import { useTheme } from '@/theme/theme';
import { Button, Glass, Header, Notice, Screen, Segmented, Skeleton, Txt } from '@/ui';

export default function DhikrStatsScreen() {
  useDhikrSync();
  const { c } = useTheme();
  const [range, setRange] = useState<'week' | 'month'>('week');
  const today = localDate();
  const q = useDhikrStats(range, today);
  const unsynced = useDhikrQueue((s) => unsyncedForDate(s, today));
  const data = q.data ? withLocal(q.data, today, unsynced) : undefined;
  const empty = data != null && data.heatmap.every((d) => d.total === 0);

  return (
    <Screen sky="ikindi" refreshing={q.isRefetching} onRefresh={() => void q.refetch()}>
      <Header title="Zikir istatistikleri" large={false} />
      <Segmented
        label="Zaman aralığı"
        value={range}
        onChange={setRange}
        options={[
          { value: 'week', label: 'Haftalık' },
          { value: 'month', label: 'Aylık' },
        ]}
      />

      {q.isError && !data ? <View style={{ marginTop: 14 }}><Notice icon="offline" title="İstatistikler yüklenemedi" body="Bağlantınızı kontrol edip tekrar deneyin." /></View> : null}

      <Glass radius={24} style={{ marginTop: 14, gap: 14 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <Txt v="subStrong" tone="secondary">
            {range === 'week' ? 'Bu hafta' : 'Son 30 gün'}
          </Txt>
          <Txt v="time" tnum style={{ fontSize: 24, lineHeight: 28 }}>
            {data ? fmtNum(data.total) : '—'}
          </Txt>
        </View>
        {!data ? (
          <Skeleton height={170} r={12} />
        ) : empty ? (
          <View style={{ alignItems: 'center', gap: 8, paddingVertical: 18 }}>
            <WIcon name="zikir" size={28} color={c.goldText} />
            <Txt v="bodyStrong">Henüz kayıt yok</Txt>
            <Txt v="sub" tone="secondary" center style={{ maxWidth: 260 }}>
              Zikirmatikte ilk zikrinizi çektiğinizde burada görünecek.
            </Txt>
            <Link href="/zikir" asChild>
              <Button compact kind="secondary" label="Zikirmatiği aç" style={{ marginTop: 6 }} />
            </Link>
          </View>
        ) : (
          <Bars data={data} range={range} />
        )}
      </Glass>

      {data && !empty ? (
        <>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
            <Stat label="GÜNLÜK ORTALAMA" value={fmtNum(data.average)} />
            <Stat label="DÜZENLİLİK" value={data.streakDays > 0 ? `${data.streakDays} gün` : '—'} />
          </View>

          <Glass radius={24} style={{ marginTop: 12, gap: 12 }}>
            <Txt v="caption" tone="gold" accessibilityRole="header">
              En çok çekilenler
            </Txt>
            {data.top.length === 0 ? (
              <Txt v="sub" tone="secondary">
                Bu dönemde kayıt yok.
              </Txt>
            ) : (
              data.top.map((t) => (
                <View key={t.key} style={{ gap: 6 }} accessible accessibilityLabel={`${t.label}: ${fmtNum(t.total)}`}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Txt v="callout" style={{ fontSize: 14 }}>
                      {t.label}
                    </Txt>
                    <Txt v="sub" tone="secondary" tnum>
                      {fmtNum(t.total)}
                    </Txt>
                  </View>
                  <View style={{ height: 4, borderRadius: 2, backgroundColor: c.hair }}>
                    <View style={{ height: 4, borderRadius: 2, backgroundColor: c.gold, width: `${Math.round((t.total / Math.max(1, data.top[0]!.total)) * 100)}%` }} />
                  </View>
                </View>
              ))
            )}
          </Glass>

          <Glass radius={24} style={{ marginTop: 12, gap: 12 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Txt v="caption" tone="gold" accessibilityRole="header">
                Düzenlilik · son 15 hafta
              </Txt>
              {data.streakDays > 0 ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <WIcon name="flame" size={14} color={c.goldText} />
                  <Txt v="subStrong" tone="gold">
                    {data.streakDays} gündür
                  </Txt>
                </View>
              ) : null}
            </View>
            <Heatmap days={data.heatmap} average={Math.max(1, data.average)} streak={data.streakDays} />
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 4 }} aria-hidden>
              <Txt v="small" tone="secondary" style={{ fontSize: 11 }}>
                Az
              </Txt>
              {[0, 0.45, 1].map((o, i) => (
                <View key={i} style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: i === 0 ? c.hair : c.gold, opacity: i === 0 ? 1 : o }} />
              ))}
              <Txt v="small" tone="secondary" style={{ fontSize: 11 }}>
                Çok
              </Txt>
            </View>
            <Txt v="small" tone="secondary">
              Az da olsa her gün; kaçırılan gün sorun değil, kaldığınız yerden devam edin.
            </Txt>
          </Glass>
        </>
      ) : null}
    </Screen>
  );
}

/** Adds taps not yet uploaded to today's figures, so the screen is never behind the counter. */
function withLocal(s: DhikrStats, today: string, extra: number): DhikrStats {
  if (!extra) return s;
  const bump = (arr: { date: string; total: number }[]) => arr.map((d) => (d.date === today ? { ...d, total: d.total + extra } : d));
  const days = bump(s.days);
  const total = s.total + extra;
  return { ...s, days, heatmap: bump(s.heatmap), total, average: Math.round(total / days.length) };
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Glass radius={20} style={{ flex: 1, gap: 6 }}>
      <Txt v="caption" tone="secondary" style={{ fontSize: 10 }}>
        {label}
      </Txt>
      <Txt v="time" tnum style={{ fontSize: 22, lineHeight: 26 }}>
        {value}
      </Txt>
    </Glass>
  );
}

function Bars({ data, range }: { data: DhikrStats; range: 'week' | 'month' }) {
  const { c } = useTheme();
  const max = Math.max(1, ...data.days.map((d) => d.total));
  const week = range === 'week';
  const labelAt = (i: number) => {
    if (week) return shortDay(data.days[i]!.date);
    const last = data.days.length - 1;
    if (i !== last && (i % 7 !== 0 || i > last - 4)) return null;
    const d = parseDate(data.days[i]!.date);
    return i === 0 || i === last ? `${d.getDate()} ${MONTHS_TR[d.getMonth()]!.slice(0, 3)}` : String(d.getDate());
  };
  return (
    <View>
      <View
        accessible
        accessibilityRole="image"
        accessibilityLabel={`${week ? 'Haftalık' : 'Aylık'} zikir sayıları: ${data.days.map((d) => fmtNum(d.total)).join(', ')}`}
        style={{ height: 150, flexDirection: 'row', alignItems: 'flex-end', gap: week ? 10 : 3 }}
      >
        {data.days.map((d, i) => (
          <View
            key={d.date}
            style={{
              flex: 1,
              height: Math.max(3, Math.round((d.total / max) * 146)),
              borderTopLeftRadius: week ? 8 : 3,
              borderTopRightRadius: week ? 8 : 3,
              borderBottomLeftRadius: week ? 3 : 1,
              borderBottomRightRadius: week ? 3 : 1,
              backgroundColor: i === data.days.length - 1 ? c.gold : c.goldTint,
              opacity: d.total === 0 ? 0.5 : 1,
            }}
          />
        ))}
      </View>
      <View style={{ flexDirection: 'row', gap: week ? 10 : 3, marginTop: 8 }} aria-hidden>
        {data.days.map((d, i) => {
          const l = labelAt(i);
          const last = i === data.days.length - 1;
          return (
            <View key={d.date} style={{ flex: 1, alignItems: week ? 'center' : i === 0 ? 'flex-start' : 'flex-end', overflow: 'visible' }}>
              {l ? (
                <Txt v="small" color={last ? c.goldText : c.text2} weight={last ? 'semibold' : 'regular'} numberOfLines={1} style={{ fontSize: 11, width: week ? undefined : 44, textAlign: week ? 'center' : i === 0 ? 'left' : 'right' }}>
                  {l}
                </Txt>
              ) : null}
            </View>
          );
        })}
      </View>
    </View>
  );
}

function Heatmap({ days, average, streak }: { days: { date: string; total: number }[]; average: number; streak: number }) {
  const { c } = useTheme();
  const weeks: { date: string; total: number }[][] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={`Son 15 haftanın zikir takvimi${streak ? `; son ${streak} gün kesintisiz` : ''}`} style={{ flexDirection: 'row', gap: 4 }}>
      {weeks.map((w, i) => (
        <View key={i} style={{ flex: 1, gap: 4 }}>
          {w.map((d) => {
            const lvl = d.total === 0 ? 0 : d.total < average ? 1 : 2;
            return <View key={d.date} style={{ aspectRatio: 1, borderRadius: 3, backgroundColor: lvl === 0 ? c.hair : c.gold, opacity: lvl === 0 ? 1 : lvl === 1 ? 0.45 : 0.9 }} />;
          })}
        </View>
      ))}
    </View>
  );
}

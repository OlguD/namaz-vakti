import { Link } from 'expo-router';
import { View } from 'react-native';
import { useVakitState } from '@/features/prayer/api';
import {
  NEXT_STATUS,
  PRAYER_KEYS,
  PRAYER_LABEL,
  QADA_KEYS,
  QADA_LABEL,
  useAdjustQada,
  usePrayerLog,
  useQada,
  useSetPrayer,
  weekRange,
  type PrayerKey,
  type PrayerStatus,
} from '@/features/worship/api';
import { WIcon, type WorshipIconName } from '@/features/worship/icons';
import { fmtNum, rangeLabel, shortDay, startedToday, useOnline } from '@/features/worship/util';
import { parseDate } from '@/lib/dates';
import { localDate } from '@/lib/prayer';
import { useTheme } from '@/theme/theme';
import { Glass, Header, Notice, Screen, Skeleton, tapFeedback, Touch, Txt } from '@/ui';

const STATUS_NAME: Record<'none' | PrayerStatus, string> = { none: 'boş', prayed: 'kıldım', jamaah: 'cemaatle', qada: 'kaza' };
const STATUS_ICON: Record<'none' | PrayerStatus, WorshipIconName> = { none: 'dot', prayed: 'prayed', jamaah: 'jamaah', qada: 'qada' };

export default function PrayerLogScreen() {
  const { c } = useTheme();
  const today = localDate();
  const { from, to } = weekRange(today);
  const log = usePrayerLog(from, to);
  const setPrayer = useSetPrayer(from, to);
  const qada = useQada();
  const adjust = useAdjustQada();
  const online = useOnline();
  const vakit = useVakitState();
  const started = startedToday(vakit.today, new Date());
  const due = 30 + started.size;
  const t = log.data?.totals;
  const pct = t ? Math.min(100, Math.round((t.done / Math.max(1, due)) * 100)) : 0;

  const tone = (s: 'none' | PrayerStatus) =>
    ({
      none: { bg: 'transparent', line: c.hair, fg: c.text2 },
      prayed: { bg: c.sageTint, line: c.sage, fg: c.sage },
      jamaah: { bg: c.goldTint, line: c.gold, fg: c.gold },
      qada: { bg: c.cautionTint, line: c.caution, fg: c.caution },
    })[s];

  return (
    <Screen sky="ogle" refreshing={log.isRefetching} onRefresh={() => void Promise.all([log.refetch(), qada.refetch()])}>
      <Header title="Namaz takibi" subtitle={rangeLabel(from, to)} large={false} />

      {!online ? (
        <View style={{ marginBottom: 12 }}>
          <Notice icon="offline" title="Çevrimdışısınız" body="İşaretlemeleriniz bağlantı gelince kaydedilecek." />
        </View>
      ) : null}

      <Glass radius={24} style={{ flexDirection: 'row', gap: 16, alignItems: 'center' }}>
        <View style={{ gap: 2 }}>
          <Txt v="caption" tone="gold">
            Bu hafta
          </Txt>
          <Txt v="time" tnum style={{ fontSize: 34, lineHeight: 40 }}>
            %{pct}
          </Txt>
        </View>
        <View style={{ flex: 1, gap: 8 }}>
          <Txt v="sub" tnum>
            {t?.done ?? 0} / {due} vakit kılındı
          </Txt>
          <View style={{ height: 4, borderRadius: 2, backgroundColor: c.hair }}>
            <View style={{ height: 4, borderRadius: 2, width: `${pct}%`, backgroundColor: c.sage }} />
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Txt v="small" tone="secondary" tnum>
              Cemaatle {t?.jamaah ?? 0}
            </Txt>
            <Txt v="small" tone="secondary" tnum>
              Kaza {t?.qada ?? 0}
            </Txt>
          </View>
        </View>
      </Glass>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 14, marginBottom: 10 }} aria-hidden>
        {(['prayed', 'jamaah', 'qada', 'none'] as const).map((s) => {
          const k = tone(s);
          return (
            <View key={s} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={{ width: 12, height: 12, borderRadius: 4, backgroundColor: k.bg, borderWidth: 1, borderColor: k.line, borderStyle: s === 'none' ? 'dashed' : 'solid' }} />
              <Txt v="small" tone="secondary" style={{ fontSize: 11 }}>
                {s === 'prayed' ? 'Kıldım' : s === 'jamaah' ? 'Cemaatle' : s === 'qada' ? 'Kaza' : 'Boş · dokunarak işaretleyin'}
              </Txt>
            </View>
          );
        })}
      </View>

      <Glass radius={24} padded={false} style={{ padding: 12, gap: 6 }}>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          <View style={{ width: 48 }} />
          {PRAYER_KEYS.map((k) => (
            <Txt key={k} v="small" tone="secondary" center style={{ flex: 1, fontSize: 11 }}>
              {PRAYER_LABEL[k]}
            </Txt>
          ))}
        </View>
        {!log.data
          ? Array.from({ length: 7 }, (_, i) => <Skeleton key={i} height={44} r={12} />)
          : log.data.days.map((d) => {
              const isToday = d.date === today;
              return (
                <View key={d.date} style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                  <View style={{ width: 48 }}>
                    <Txt v="subStrong" color={isToday ? c.goldText : c.text} weight={isToday ? 'semibold' : 'medium'}>
                      {shortDay(d.date)}
                    </Txt>
                    <Txt v="small" tone="secondary" tnum style={{ fontSize: 11 }}>
                      {parseDate(d.date).getDate()}
                    </Txt>
                  </View>
                  {PRAYER_KEYS.map((k: PrayerKey) => {
                    const s: 'none' | PrayerStatus = d[k] ?? 'none';
                    const look = tone(s);
                    const future = isToday && !started.has(k);
                    return (
                      <Touch
                        key={k}
                        onPress={() => {
                          tapFeedback();
                          setPrayer.mutate({ date: d.date, vakit: k, status: NEXT_STATUS[s] });
                        }}
                        accessibilityRole="button"
                        accessibilityLabel={`${shortDay(d.date)} ${PRAYER_LABEL[k]}: ${STATUS_NAME[s]}. Değiştirmek için dokunun.`}
                        style={{
                          flex: 1,
                          height: 44,
                          borderRadius: 12,
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: look.bg,
                          borderWidth: 1,
                          borderColor: look.line,
                          borderStyle: s === 'none' ? 'dashed' : 'solid',
                          opacity: future && s === 'none' ? 0.45 : 1,
                        }}
                      >
                        {s !== 'none' ? <WIcon name={STATUS_ICON[s]} size={18} color={look.fg} strokeWidth={1.8} /> : null}
                      </Touch>
                    );
                  })}
                </View>
              );
            })}
      </Glass>

      <Glass radius={24} style={{ marginTop: 14, gap: 12 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View style={{ gap: 2 }}>
            <Txt v="caption" tone="gold" accessibilityRole="header">
              Kaza borcu
            </Txt>
            <Txt v="time" tnum style={{ fontSize: 22, lineHeight: 28 }}>
              {qada.data ? fmtNum(qada.data.total) : '—'}{' '}
              <Txt v="sub" tone="secondary">
                vakit
              </Txt>
            </Txt>
          </View>
          <Link href="/kaza" asChild>
            <Touch accessibilityRole="button" style={{ minHeight: 40, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, borderColor: c.goldLine, backgroundColor: c.goldTint, justifyContent: 'center' }}>
              <Txt v="subStrong" tone="gold">
                Hesapla
              </Txt>
            </Touch>
          </Link>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {QADA_KEYS.map((k) => {
            const n = qada.data?.[k] ?? 0;
            return (
              <Touch
                key={k}
                disabled={!qada.data || n === 0}
                onPress={() => {
                  tapFeedback();
                  adjust.mutate({ key: k, delta: -1 });
                }}
                accessibilityRole="button"
                accessibilityLabel={`${QADA_LABEL[k]} kazası ${n}. Bir kaza kıldım.`}
                style={{ flexBasis: '30%', flexGrow: 1, minHeight: 60, padding: 10, borderRadius: 16, borderWidth: 1, borderColor: c.hair, backgroundColor: c.glass, justifyContent: 'space-between' }}
              >
                <Txt v="small" tone="secondary">
                  {QADA_LABEL[k]}
                </Txt>
                <Txt v="time" tnum style={{ fontSize: 18 }}>
                  {fmtNum(n)}
                </Txt>
              </Touch>
            );
          })}
        </View>
        <Txt v="small" tone="secondary">
          Bir kaza namazı kıldığınızda ilgili vakte dokunun; sayaç bir azalır.
        </Txt>
      </Glass>
    </Screen>
  );
}

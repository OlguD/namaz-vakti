import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { usePlace } from '@/features/location/store';
import { usePrayerTimes } from '@/features/prayer/api';
import { TimesTable } from '@/features/prayer/TimesTable';
import { HIJRI_MONTHS_TR, MONTHS_TR, parseDate } from '@/lib/dates';
import { useTheme } from '@/theme/theme';
import { radius } from '@/theme/tokens';
import { Button, Glass, Icon, IconButton, Notice, Screen, StateView, Touch, Txt } from '@/ui';

/**
 * Monthly table / imsakiye. Diyanet publishes about 30 days ahead, so the
 * month switcher covers the months that fall inside the published window.
 */
export function TimesScreen({ mode }: { mode: 'normal' | 'ramazan' }) {
  const router = useRouter();
  const { c } = useTheme();
  const place = usePlace((s) => s.place);
  const q = usePrayerTimes(30);
  const all = useMemo(() => q.data?.days ?? [], [q.data]);

  const months = useMemo(() => {
    const keys: string[] = [];
    for (const d of all) {
      const k = d.date.slice(0, 7);
      if (!keys.includes(k)) keys.push(k);
    }
    return keys;
  }, [all]);
  const [idx, setIdx] = useState(0);
  const month = months[Math.min(idx, Math.max(0, months.length - 1))];

  const ramadanDays = useMemo(() => all.filter((d) => d.hijri?.month === 9), [all]);
  const days = mode === 'ramazan' ? ramadanDays : all.filter((d) => d.date.slice(0, 7) === month);
  const first = days[0];
  const hijriSpan = useMemo(() => {
    const ms = [...new Set(days.map((d) => d.hijri && `${HIJRI_MONTHS_TR[d.hijri.month - 1]} ${d.hijri.year}`).filter(Boolean))];
    return ms.join(' – ');
  }, [days]);

  const title = mode === 'ramazan' ? 'İmsakiye' : 'Aylık vakitler';
  const monthLabel = month ? `${MONTHS_TR[parseDate(`${month}-01`).getMonth()]} ${month.slice(0, 4)}` : '';
  const offline = q.data?.stale || (q.isError && !!q.data);

  return (
    <Screen
      sky={mode === 'ramazan' ? 'aksam' : 'ogle'}
      scroll={false}
      header={
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 44 }}>
          <IconButton icon="back" label="Geri" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
          <IconButton icon="share" label="Görsel olarak paylaş" onPress={() => router.push('/paylas')} style={{ opacity: days.length ? 1 : 0.45 }} />
        </View>
      }
      contentStyle={{ paddingHorizontal: 16 }}
    >
      <View style={{ gap: 4, paddingHorizontal: 4 }}>
        <Txt v="display" accessibilityRole="header" style={{ fontSize: 32, lineHeight: 38 }}>
          {title}
        </Txt>
        <Touch onPress={() => router.push('/konum')} accessibilityRole="button" accessibilityLabel={`Konum: ${place?.name ?? 'seçilmedi'}. Değiştir`} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 28, alignSelf: 'flex-start' }}>
          <Icon name="pin" size={14} color={c.sub} />
          <Txt v="body" tone="sub" style={{ fontSize: 14 }}>
            {place ? `${place.name}${place.city && place.city !== place.name ? `, ${place.city}` : ''}` : 'Konum seçilmedi'}
          </Txt>
          <Icon name="down" size={14} color={c.sub} />
        </Touch>
      </View>

      {mode === 'normal' ? (
        <Glass radius={radius.lg} padded={false} style={{ marginTop: 10, padding: 6, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <MonthArrow dir="back" disabled={idx <= 0} onPress={() => setIdx((i) => Math.max(0, i - 1))} />
          <View style={{ flex: 1, alignItems: 'center', gap: 1 }} accessibilityLiveRegion="polite">
            <Txt v="bodyStrong">{monthLabel || '—'}</Txt>
            <Txt v="small" tone="secondary">
              {hijriSpan || ' '}
            </Txt>
          </View>
          <MonthArrow dir="forward" disabled={idx >= months.length - 1} onPress={() => setIdx((i) => Math.min(months.length - 1, i + 1))} />
        </Glass>
      ) : first ? (
        <Glass radius={radius.lg} style={{ marginTop: 10, alignItems: 'center', gap: 1 }}>
          <Txt v="bodyStrong">Ramazan {first.hijri?.year ?? ''}</Txt>
          <Txt v="small" tone="secondary">
            {days.length} günlük tablo · Sahur imsakla biter, iftar akşam vaktidir
          </Txt>
        </Glass>
      ) : null}

      {offline ? (
        <View style={{ marginTop: 10 }}>
          <Notice icon="offline" title="Çevrimdışı — kayıtlı vakitler gösteriliyor" />
        </View>
      ) : null}

      <View style={{ flex: 1, minHeight: 0, marginTop: 12 }}>
        {!place ? (
          <EmptyCard title="Önce konumunuzu seçin" body="Vakitler seçtiğiniz ilçeye göre hesaplanır. Konum seçildiğinde tablo burada görünür." action={<Button label="Şehir seç" onPress={() => router.push('/konum')} />} />
        ) : q.isError && !q.data ? (
          <EmptyCard title="Vakitler yüklenemedi" body="Bağlantınızı kontrol edip tekrar deneyin." action={<Button label="Tekrar dene" kind="secondary" onPress={() => void q.refetch()} />} />
        ) : mode === 'ramazan' && !q.isLoading && days.length === 0 ? (
          <EmptyCard
            title="İmsakiye Ramazan’da yayınlanır"
            body="Diyanet vakit tablosu yaklaşık 30 gün ileriye kadar yayınlanır. Ramazan yaklaştığında imsakiye burada görünecek."
            action={<Button label="Aylık tabloya git" kind="secondary" onPress={() => router.replace('/aylik')} />}
          />
        ) : (
          <TimesTable days={days} ramadan={mode === 'ramazan'} loading={q.isLoading && !q.data} />
        )}
      </View>
      {mode === 'normal' && months.length > 0 && idx === months.length - 1 && all.length < 31 ? (
        <Txt v="small" tone="tertiary" center style={{ marginTop: 8 }}>
          Diyanet vakitleri yaklaşık 30 gün ileriye kadar yayınlanır.
        </Txt>
      ) : null}
    </Screen>
  );
}

function MonthArrow({ dir, disabled, onPress }: { dir: 'back' | 'forward'; disabled: boolean; onPress: () => void }) {
  const { c } = useTheme();
  return (
    <Touch
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={dir === 'back' ? 'Önceki ay' : 'Sonraki ay'}
      style={{ width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }}
    >
      <Icon name={dir} size={20} color={c.text} />
    </Touch>
  );
}

function EmptyCard({ title, body, action }: { title: string; body: string; action: React.ReactNode }) {
  const { c } = useTheme();
  return (
    <View style={{ flex: 1, borderRadius: radius.xl, backgroundColor: c.raised, borderWidth: 1, borderColor: c.hair, justifyContent: 'center' }}>
      <StateView icon="calendar" title={title} body={body} action={action} />
    </View>
  );
}

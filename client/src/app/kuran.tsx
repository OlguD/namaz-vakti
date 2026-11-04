import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { errorMessage, isApiError } from '@/api/errors';
import { isRegistered, useSession } from '@/auth/session';
import { useHatims, useQuranProgress, useReadPages, useSetQuranProgress, type QuranProgress } from '@/features/worship/api';
import { dayMonthLabel } from '@/features/worship/util';
import { addDays, localDate } from '@/lib/prayer';
import { useTheme } from '@/theme/theme';
import { Button, Chip, Glass, Header, Icon, Notice, Screen, SectionTitle, Sheet, Skeleton, Touch, Txt } from '@/ui';

export default function QuranScreen() {
  const { c } = useTheme();
  const router = useRouter();
  const user = useSession((s) => s.user);
  const registered = isRegistered(user);
  const q = useQuranProgress();
  const hatims = useHatims(registered);
  const read = useReadPages();
  const [readOpen, setReadOpen] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
  const p = q.data;

  return (
    <Screen sky="ikindi" refreshing={q.isRefetching} onRefresh={() => void Promise.all([q.refetch(), registered ? hatims.refetch() : null])}>
      <Header title="Kur’an & Hatim" large={false} />

      <Glass radius={24} style={{ gap: 16 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Txt v="caption" tone="gold" accessibilityRole="header">
            Kişisel hatim
          </Txt>
          {p && p.completedKhatms > 0 ? (
            <Txt v="small" tone="secondary">
              {p.completedKhatms} hatim tamamlandı
            </Txt>
          ) : null}
        </View>

        {read.data?.khatmCompleted ? <Notice icon="star" tone="sage" title="Hatminiz tamamlandı" body="Allah kabul etsin. Yeni hatim kaldığınız yerden başladı." /> : null}

        {p ? <JuzWheel p={p} /> : <Skeleton width={220} height={220} r={110} style={{ alignSelf: 'center' }} />}

        <Touch onPress={() => setPlanOpen(true)} accessibilityRole="button" accessibilityLabel="Hedef ve konum ayarları">
          <View style={{ flexDirection: 'row', borderRadius: 16, borderWidth: 1, borderColor: c.hair, overflow: 'hidden' }}>
            <Cell label="Hedef" value={p?.targetDate ? dayMonthLabel(p.targetDate) : 'Yok'} />
            <Cell label="Kalan" value={p ? `${p.pagesLeft} sayfa` : '—'} border />
            <Cell label="Günde" value={p?.pagesPerDay ? `${p.pagesPerDay} sayfa` : '—'} border />
          </View>
        </Touch>

        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Button label="Devam et" compact style={{ flex: 1 }} disabled={!p} onPress={() => setReadOpen(true)} />
          <Button
            label="Cüzü bitirdim"
            kind="secondary"
            compact
            style={{ flex: 1 }}
            disabled={!p}
            loading={read.isPending}
            onPress={() => p && read.mutate(20 - p.page)}
          />
        </View>
        {read.error ? <Notice icon="alert" title="Kaydedilemedi" body={errorMessage(read.error)} /> : null}
        <Txt v="small" tone="secondary">
          {p?.targetDate ? 'Hedefinize göre günlük sayfa sayısı hesaplanır. Hedefinizi istediğiniz an değiştirebilirsiniz.' : 'Bir hedef tarih seçerseniz günde kaç sayfa okumanız gerektiğini hesaplarız.'}
        </Txt>
      </Glass>

      <SectionTitle
        action={
          registered ? (
            <View style={{ flexDirection: 'row', gap: 4 }}>
              <Link href="/hatim/katil" asChild>
                <Touch accessibilityRole="button" style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 }}>
                  <Txt v="subStrong" tone="gold">
                    Katıl
                  </Txt>
                </Touch>
              </Link>
              <Link href="/hatim/yeni" asChild>
                <Touch accessibilityRole="button" style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 }}>
                  <Txt v="subStrong" tone="gold">
                    Yeni başlat
                  </Txt>
                </Touch>
              </Link>
            </View>
          ) : undefined
        }
      >
        Ortak hatimler
      </SectionTitle>

      {!registered ? (
        <Glass radius={20} style={{ gap: 12 }}>
          <Txt v="bodyStrong">Aileniz ve cemaatinizle hatim</Txt>
          <Txt v="sub" tone="secondary">
            Ortak hatim başlatmak ya da bir davete katılmak için giriş yapın. Kişisel hatminiz giriş yapmadan da kaydedilir.
          </Txt>
          <Button compact kind="secondary" label="Giriş yap" onPress={() => router.push('/giris')} />
        </Glass>
      ) : hatims.isLoading ? (
        <Skeleton height={76} r={20} />
      ) : hatims.isError ? (
        <Notice icon="offline" title="Ortak hatimler yüklenemedi" body={isApiError(hatims.error) ? errorMessage(hatims.error) : undefined} />
      ) : (hatims.data?.length ?? 0) === 0 ? (
        <Glass radius={20} style={{ gap: 6 }}>
          <Txt v="bodyStrong">Henüz ortak hatim yok</Txt>
          <Txt v="sub" tone="secondary">
            Yeni bir hatim başlatın ve davet koduyla yakınlarınızı çağırın.
          </Txt>
        </Glass>
      ) : (
        <View style={{ gap: 8 }}>
          {hatims.data!.map((g) => (
            <Link key={g.id} href={`/hatim/${g.id}`} asChild>
              <Touch accessibilityRole="button" accessibilityLabel={`${g.name}: ${g.members} kişi, ${g.read} cüz okundu, ${g.taken} alındı`}>
                <Glass radius={20} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View style={{ flex: 1, gap: 4 }}>
                    <Txt v="callout">{g.name}</Txt>
                    <Txt v="small" tone="secondary" numberOfLines={1}>
                      {g.members} kişi · {g.read} cüz okundu · {g.taken} alındı
                      {g.myJuz.length ? ` · sizde ${g.myJuz.join(', ')}. cüz` : ''}
                    </Txt>
                    <View style={{ height: 3, borderRadius: 2, backgroundColor: c.hair, marginTop: 4 }}>
                      <View style={{ height: 3, borderRadius: 2, backgroundColor: c.gold, width: `${(g.read / 30) * 100}%` }} />
                    </View>
                  </View>
                  <Txt v="time" tnum tone="gold">
                    {g.read}/30
                  </Txt>
                  <Icon name="forward" size={18} color={c.text3} />
                </Glass>
              </Touch>
            </Link>
          ))}
        </View>
      )}

      <ReadSheet visible={readOpen} onClose={() => setReadOpen(false)} onRead={(n) => read.mutate(n, { onSuccess: () => setReadOpen(false) })} busy={read.isPending} />
      {p ? <PlanSheet key={`${p.juz}-${p.page}-${p.targetDate}`} visible={planOpen} onClose={() => setPlanOpen(false)} p={p} /> : null}
    </Screen>
  );
}

function Cell({ label, value, border }: { label: string; value: string; border?: boolean }) {
  const { c } = useTheme();
  return (
    <View style={{ flex: 1, paddingVertical: 10, paddingHorizontal: 12, gap: 2, borderLeftWidth: border ? 1 : 0, borderLeftColor: c.hair }}>
      <Txt v="small" tone="secondary" style={{ fontSize: 11 }}>
        {label}
      </Txt>
      <Txt v="subStrong" tnum numberOfLines={1}>
        {value}
      </Txt>
    </View>
  );
}

/** 30 segments around a circle: read juz gold, the current one outlined. */
function JuzWheel({ p }: { p: QuranProgress }) {
  const { c } = useTheme();
  const size = 220;
  const cx = size / 2;
  const r = 96;
  const seg = (i: number) => {
    const gap = 2.2;
    const a0 = ((i * 12 + gap / 2 - 90) * Math.PI) / 180;
    const a1 = (((i + 1) * 12 - gap / 2 - 90) * Math.PI) / 180;
    return `M${cx + r * Math.cos(a0)} ${cx + r * Math.sin(a0)} A${r} ${r} 0 0 1 ${cx + r * Math.cos(a1)} ${cx + r * Math.sin(a1)}`;
  };
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={`30 cüzden ${p.juz} cüz okundu, ${p.currentJuz}. cüz devam ediyor, sayfa ${p.page}`}
      style={{ width: size, height: size, alignSelf: 'center' }}
    >
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        {Array.from({ length: 30 }, (_, i) => (
          <Path
            key={i}
            d={seg(i)}
            fill="none"
            strokeWidth={14}
            strokeLinecap="butt"
            stroke={i < p.juz ? c.gold : i === p.juz ? c.goldLine : c.hair}
          />
        ))}
      </Svg>
      <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', gap: 2 }}>
        <Txt v="time" tnum style={{ fontSize: 40, lineHeight: 44, fontFamily: 'Inter_200ExtraLight' }}>
          {p.juz}
          <Txt v="time" tone="secondary" style={{ fontSize: 18 }}>
            /30
          </Txt>
        </Txt>
        <Txt v="small" tone="secondary">
          cüz okundu
        </Txt>
        <Txt v="subStrong" tone="gold" tnum>
          {p.currentJuz}. cüz · sayfa {p.page + 1}
        </Txt>
      </View>
    </View>
  );
}

function ReadSheet({ visible, onClose, onRead, busy }: { visible: boolean; onClose: () => void; onRead: (n: number) => void; busy: boolean }) {
  const [n, setN] = useState(2);
  return (
    <Sheet visible={visible} onClose={onClose} title="Bugün kaç sayfa okudunuz?">
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {[1, 2, 4, 5, 10, 20].map((v) => (
          <Chip key={v} label={`${v} sayfa`} selected={v === n} onPress={() => setN(v)} />
        ))}
      </View>
      <Button label={`${n} sayfa ekle`} loading={busy} style={{ marginTop: 18 }} onPress={() => onRead(n)} />
    </Sheet>
  );
}

function PlanSheet({ visible, onClose, p }: { visible: boolean; onClose: () => void; p: QuranProgress }) {
  const { c } = useTheme();
  const set = useSetQuranProgress();
  const [juz, setJuz] = useState(p.juz);
  const [page, setPage] = useState(p.page);
  const [target, setTarget] = useState<string | null>(p.targetDate);
  const today = localDate();
  const presets: [string, string | null][] = [
    ['30 gün', addDays(today, 30)],
    ['60 gün', addDays(today, 60)],
    ['90 gün', addDays(today, 90)],
    ['Hedef yok', null],
  ];
  return (
    <Sheet visible={visible} onClose={onClose} title="Hatim planı">
      <Txt v="subStrong" tone="secondary">
        Hedef tarih
      </Txt>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
        {presets.map(([label, d]) => (
          <Chip key={label} label={label} selected={target === d || (d != null && target === d)} onPress={() => setTarget(d)} />
        ))}
      </View>
      {target ? (
        <Txt v="small" tone="secondary" style={{ marginTop: 6 }}>
          Bitiş: {dayMonthLabel(target)}
        </Txt>
      ) : null}
      <Txt v="subStrong" tone="secondary" style={{ marginTop: 18 }}>
        Kaldığınız yer
      </Txt>
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
        <Counter label="Biten cüz" value={juz} min={0} max={29} onChange={setJuz} c={c} />
        <Counter label="Sayfa" value={page} min={0} max={19} onChange={setPage} c={c} />
      </View>
      {set.error ? <View style={{ marginTop: 10 }}><Notice icon="alert" title="Kaydedilemedi" body={errorMessage(set.error)} /></View> : null}
      <Button label="Kaydet" loading={set.isPending} style={{ marginTop: 18 }} onPress={() => set.mutate({ juz, page, targetDate: target }, { onSuccess: onClose })} />
    </Sheet>
  );
}

function Counter({ label, value, min, max, onChange, c }: { label: string; value: number; min: number; max: number; onChange: (n: number) => void; c: ReturnType<typeof useTheme>['c'] }) {
  return (
    <View style={{ flex: 1, gap: 6 }}>
      <Txt v="small" tone="secondary">
        {label}
      </Txt>
      <View style={{ flexDirection: 'row', alignItems: 'center', borderRadius: 14, borderWidth: 1, borderColor: c.stroke }}>
        <Touch onPress={() => onChange(Math.max(min, value - 1))} accessibilityRole="button" accessibilityLabel={`${label} azalt`} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="minus" size={18} color={c.text} />
        </Touch>
        <Txt v="time" tnum center style={{ flex: 1 }} accessibilityLabel={`${label} ${value}`}>
          {value}
        </Txt>
        <Touch onPress={() => onChange(Math.min(max, value + 1))} accessibilityRole="button" accessibilityLabel={`${label} artır`} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="plus" size={18} color={c.text} />
        </Touch>
      </View>
    </View>
  );
}

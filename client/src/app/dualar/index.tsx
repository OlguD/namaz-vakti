import { Link } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { errorMessage } from '@/api/errors';
import { useDuas, useFavorites, type Dua, type DuasResponse } from '@/features/content/api';
import { DuaCard } from '@/features/content/DuaCard';
import { CategoryIcon, HeartIcon, norm, SearchField, TabSwitch, TitleBar, TopWash, WASH } from '@/features/content/ui';
import { useTheme } from '@/theme/theme';
import { Button, Screen, Skeleton, StateView, Touch, Txt } from '@/ui';

type Tab = 'all' | 'fav';

export default function DuasScreen() {
  const { data, isLoading, isError, error, refetch, isFetching } = useDuas();
  const fav = useFavorites();
  const [tab, setTab] = useState<Tab>('all');
  const [q, setQ] = useState('');

  const favDuas = useMemo(() => (data ? fav.duas.map((k) => data.duas.find((d) => d.key === k)).filter((d): d is Dua => !!d) : []), [data, fav.duas]);
  const results = useMemo(() => {
    const nq = norm(q);
    if (!nq || !data) return null;
    return data.duas.filter((d) => [d.title, d.transliteration, d.meaningTr, d.source].some((f) => norm(f).includes(nq)));
  }, [q, data]);

  return (
    <Screen refreshing={isFetching && !isLoading} onRefresh={refetch} pattern={false}>
      <TopWash colors={WASH.dusk} />
      <TitleBar title="Dualar" backLabel="İbadet’e dön" />
      <SearchField value={q} onChangeText={setQ} placeholder="Dua, sure veya kelime ara" label="Dua ara" />

      {results ? (
        <View style={{ marginTop: 14, gap: 8 }}>
          {results.length ? (
            results.map((d) => <DuaCard key={d.key} dua={d} data={data!} />)
          ) : (
            <Txt v="body" tone="secondary" center style={{ marginTop: 32 }}>
              “{q}” ile eşleşen dua bulunamadı.
            </Txt>
          )}
        </View>
      ) : (
        <>
          <TabSwitch
            label="Görünüm"
            value={tab}
            onChange={setTab}
            tabs={[
              { value: 'all', label: 'Kategoriler' },
              { value: 'fav', label: `Favoriler · ${favDuas.length}` },
            ]}
          />
          {isLoading && !data ? (
            <Loading />
          ) : !data ? (
            <StateView icon="offline" tone="caution" title="Dualar yüklenemedi" body={isError ? errorMessage(error) : undefined} action={<Button label="Tekrar dene" kind="secondary" onPress={() => refetch()} />} />
          ) : tab === 'all' ? (
            <Categories data={data} />
          ) : favDuas.length ? (
            <View style={{ marginTop: 14, gap: 8 }}>
              {favDuas.map((d) => (
                <DuaCard key={d.key} dua={d} data={data} />
              ))}
            </View>
          ) : (
            <EmptyFav onBrowse={() => setTab('all')} />
          )}
        </>
      )}
    </Screen>
  );
}

/** Morning / evening / night suggestion for the featured card. */
function featured(data: DuasResponse, hour: number): { label: string; dua: Dua } | null {
  const pick = (cat: string) => data.duas.find((d) => d.categoryId === cat && d.arabic);
  if (hour >= 4 && hour < 12) {
    const d = pick('sabah-aksam');
    return d ? { label: 'SABAH · ŞİMDİ OKUNABİLİR', dua: d } : null;
  }
  if (hour >= 15 && hour < 21) {
    const d = data.duas.filter((x) => x.categoryId === 'sabah-aksam' && x.arabic)[1] ?? pick('sabah-aksam');
    return d ? { label: 'AKŞAM · ŞİMDİ OKUNABİLİR', dua: d } : null;
  }
  if (hour >= 21 || hour < 4) {
    const d = pick('uyku');
    return d ? { label: 'GECE · YATMADAN ÖNCE', dua: d } : null;
  }
  const d = data.duas.find((x) => x.arabic);
  return d ? { label: 'GÜNÜN DUASI', dua: d } : null;
}

function Categories({ data }: { data: DuasResponse }) {
  const { c } = useTheme();
  const f = featured(data, new Date().getHours());
  return (
    <>
      {f ? (
        <Link href={{ pathname: '/dualar/[key]', params: { key: f.dua.key } }} asChild>
          <Touch
            accessibilityRole="link"
            accessibilityLabel={`${f.label}. ${f.dua.title}`}
            style={{ marginTop: 14, padding: 16, gap: 8, borderRadius: 24, backgroundColor: c.goldTint, borderWidth: 1, borderColor: c.goldLine }}
          >
            <Txt v="caption" tone="gold" weight="semibold">
              {f.label}
            </Txt>
            <Txt v="arabicSm" lang="ar" numberOfLines={2} style={{ fontSize: 22, lineHeight: 38 }}>
              {f.dua.arabic}
            </Txt>
            <Txt v="sub" tone="sub" numberOfLines={1}>
              {f.dua.meaningTr}
            </Txt>
          </Touch>
        </Link>
      ) : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
        {data.categories.map((k) => (
          <Link key={k.id} href={{ pathname: '/dualar/kategori/[id]', params: { id: k.id } }} asChild>
            <Touch
              accessibilityRole="link"
              accessibilityLabel={`${k.nameTr}, ${k.count} dua`}
              style={{ flexBasis: '48%', flexGrow: 1, minHeight: 104, padding: 14, gap: 10, borderRadius: 20, backgroundColor: c.raised, borderWidth: 1, borderColor: c.hair }}
            >
              <CategoryIcon name={k.icon} color={c.goldText} />
              <View style={{ gap: 2 }}>
                <Txt v="callout">{k.nameTr}</Txt>
                <Txt v="small" tone="secondary" tnum>
                  {k.count} dua
                </Txt>
              </View>
            </Touch>
          </Link>
        ))}
      </View>
    </>
  );
}

function EmptyFav({ onBrowse }: { onBrowse: () => void }) {
  const { c } = useTheme();
  return (
    <View style={{ alignItems: 'center', gap: 10, marginTop: 70, paddingHorizontal: 30 }}>
      <View style={{ width: 72, height: 72, borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: c.goldTint }}>
        <HeartIcon filled={false} color={c.goldText} size={30} />
      </View>
      <Txt v="titleSm" center style={{ marginTop: 6, fontSize: 21 }}>
        Henüz favori dua yok
      </Txt>
      <Txt v="body" tone="sub" center style={{ fontSize: 14, lineHeight: 21 }}>
        Bir duanın detayında kalp simgesine dokunduğunuzda burada, çevrimdışı da okunabilir şekilde saklanır.
      </Txt>
      <Button label="Kategorilere göz at" kind="secondary" compact onPress={onBrowse} style={{ marginTop: 8 }} />
    </View>
  );
}

function Loading() {
  return (
    <View style={{ marginTop: 14, gap: 12 }}>
      <Skeleton height={130} r={24} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} width="48%" height={104} r={20} />
        ))}
      </View>
    </View>
  );
}

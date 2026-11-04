import { Link } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { errorMessage } from '@/api/errors';
import { useEsma, useFavorites, type EsmaName } from '@/features/content/api';
import { HeartIcon, norm, SearchField, TabSwitch, TitleBar, TopWash, WASH } from '@/features/content/ui';
import { useTheme } from '@/theme/theme';
import { Button, Girih, Screen, Skeleton, StateView, Touch, Txt } from '@/ui';

type Tab = 'all' | 'fav';

export default function EsmaScreen() {
  const { data, isLoading, isError, error, refetch, isFetching } = useEsma();
  const fav = useFavorites();
  const [q, setQ] = useState('');
  const [tab, setTab] = useState<Tab>('all');

  const names = useMemo(() => {
    const nq = norm(q);
    let list = data ?? [];
    if (tab === 'fav') list = list.filter((n) => fav.esma.includes(n.no));
    if (nq) list = list.filter((n) => norm(n.transliteration).includes(nq) || norm(n.meaningTr).includes(nq) || String(n.no) === q.trim());
    return list;
  }, [data, q, tab, fav.esma]);

  return (
    <Screen refreshing={isFetching && !isLoading} onRefresh={refetch} pattern={false}>
      <TopWash colors={WASH.night} height={320} />
      <Girih width="100%" height={320} style={{ left: -20, right: -20 }} />
      <TitleBar title="Esmaü’l-Hüsna" subtitle="Allah’ın 99 güzel ismi · Tirmizî rivayeti" backLabel="İbadet’e dön" />
      <SearchField value={q} onChangeText={setQ} placeholder="İsim veya anlam ara" label="İsim ara" />
      <TabSwitch
        label="Görünüm"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'all', label: 'Tüm isimler' },
          { value: 'fav', label: `Favoriler · ${fav.esma.length}` },
        ]}
      />

      {isLoading && !data ? (
        <Grid>
          {Array.from({ length: 12 }, (_, i) => (
            <Skeleton key={i} width="31.5%" height={112} r={20} />
          ))}
        </Grid>
      ) : !data ? (
        <StateView icon="offline" tone="caution" title="İsimler yüklenemedi" body={isError ? errorMessage(error) : undefined} action={<Button label="Tekrar dene" kind="secondary" onPress={() => refetch()} />} />
      ) : names.length === 0 ? (
        tab === 'fav' && !q ? (
          <StateView icon="heart" title="Henüz favori isim yok" body="Bir ismin detayında kalp simgesine dokunarak buraya ekleyebilirsiniz." action={<Button label="Tüm isimlere göz at" kind="secondary" onPress={() => setTab('all')} />} />
        ) : (
          <Txt v="body" tone="secondary" center style={{ marginTop: 40, fontSize: 14 }}>
            “{q}” ile eşleşen isim bulunamadı.
          </Txt>
        )
      ) : (
        <Grid>
          {names.map((n) => (
            <NameCell key={n.no} n={n} fav={fav.isEsmaFav(n.no)} />
          ))}
        </Grid>
      )}
    </Screen>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return (
    <View accessibilityRole="list" accessibilityLabel="99 isim" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
      {children}
    </View>
  );
}

function NameCell({ n, fav }: { n: EsmaName; fav: boolean }) {
  const { c } = useTheme();
  const len = n.arabic.length;
  const size = len > 12 ? 17 : len > 7 ? 24 : 30;
  return (
    <Link href={{ pathname: '/esma/[no]', params: { no: String(n.no) } }} asChild>
      <Touch
        accessibilityRole="link"
        accessibilityLabel={`${n.no}. ${n.transliteration}${fav ? ', favori' : ''}`}
        style={{
          width: '31.5%',
          flexGrow: 1,
          height: 112,
          paddingVertical: 8,
          paddingHorizontal: 6,
          gap: 4,
          borderRadius: 20,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: fav ? c.goldTint : c.raised,
          borderWidth: 1,
          borderColor: fav ? c.goldLine : c.hair,
        }}
      >
        <Txt v="small" tone="tertiary" tnum style={{ position: 'absolute', top: 8, left: 10, fontSize: 10, lineHeight: 12 }}>
          {n.no}
        </Txt>
        {fav ? (
          <View style={{ position: 'absolute', top: 8, right: 10 }}>
            <HeartIcon filled color={c.goldText} size={11} />
          </View>
        ) : null}
        <Txt v="arabic" lang="ar" center color={fav ? c.goldText : c.text} style={{ fontSize: size, lineHeight: Math.round(size * 1.5) }} numberOfLines={1}>
          {n.arabic}
        </Txt>
        <Txt v="small" tone="secondary" center numberOfLines={2} style={{ lineHeight: 15 }}>
          {n.transliteration}
        </Txt>
      </Touch>
    </Link>
  );
}

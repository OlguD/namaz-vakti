import { useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { useDuas } from '@/features/content/api';
import { TitleBar, TopWash, WASH } from '@/features/content/ui';
import { Button, Screen, Skeleton, StateView } from '@/ui';
import { DuaCard } from '@/features/content/DuaCard';

export default function DuaCategoryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, isLoading, refetch } = useDuas();
  const cat = data?.categories.find((k) => k.id === id);
  const list = data?.duas.filter((d) => d.categoryId === id) ?? [];

  return (
    <Screen pattern={false}>
      <TopWash colors={WASH.dusk} />
      <TitleBar title={cat?.nameTr ?? 'Dualar'} subtitle={cat ? `${cat.count} dua` : undefined} backLabel="Dualara dön" />
      <View style={{ marginTop: 16, gap: 8 }}>
        {isLoading && !data ? (
          [0, 1, 2].map((i) => <Skeleton key={i} height={140} r={20} />)
        ) : !data ? (
          <StateView icon="offline" tone="caution" title="Dualar yüklenemedi" action={<Button label="Tekrar dene" kind="secondary" onPress={() => refetch()} />} />
        ) : list.length ? (
          list.map((d) => <DuaCard key={d.key} dua={d} data={data} />)
        ) : (
          <StateView icon="book" title="Bu kategoride henüz dua yok" />
        )}
      </View>
    </Screen>
  );
}

import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDuas, useFavorites } from '@/features/content/api';
import { shareText } from '@/features/content/share';
import { FavButton, TopWash, WASH } from '@/features/content/ui';
import { kv } from '@/lib/storage';
import { useTheme } from '@/theme/theme';
import { fonts } from '@/theme/tokens';
import { Button, Glass, Icon, IconButton, Screen, Skeleton, StateView, Touch, Txt, webBlur } from '@/ui';

const SIZE_KEY = 'vakit.content.text-size';
const AR = [24, 28, 32, 38, 44];
const TR = [14, 15, 16, 18, 20];

export default function DuaDetailScreen() {
  const { key } = useLocalSearchParams<{ key: string }>();
  const router = useRouter();
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { data, isLoading, refetch } = useDuas();
  const fav = useFavorites();
  const [size, setSize] = useState(3);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    void kv.get<number>(SIZE_KEY).then((s) => s && setSize(s));
  }, []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  const dua = data?.duas.find((d) => d.key === key);
  const cat = data?.categories.find((k) => k.id === dua?.categoryId);
  const siblings = data && dua ? data.duas.filter((d) => d.categoryId === dua.categoryId) : [];
  const idx = dua ? siblings.findIndex((d) => d.key === dua.key) : -1;
  const next = siblings.length > 1 ? siblings[(idx + 1) % siblings.length] : undefined;

  const changeSize = (s: number) => {
    const v = Math.min(5, Math.max(1, s));
    setSize(v);
    void kv.set(SIZE_KEY, v);
  };

  const onShare = async () => {
    if (!dua) return;
    const text = [dua.title, dua.arabic, dua.transliteration, dua.meaningTr, dua.source ? `Kaynak: ${dua.source}` : null].filter(Boolean).join('\n\n');
    const r = await shareText(text, dua.title);
    if (r === 'copied') setToast('Dua panoya kopyalandı');
  };

  const header = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
      <TopWash colors={WASH.dusk} height={300} inHeader />
      <IconButton icon="back" label="Dualara dön" onPress={() => (router.canGoBack() ? router.back() : router.replace('/dualar'))} />
      <Txt v="sub" tone="secondary" style={{ flex: 1 }} numberOfLines={1} tnum>
        {cat && idx >= 0 ? `${cat.nameTr} · ${idx + 1} / ${siblings.length}` : ''}
      </Txt>
      {dua ? <FavButton on={fav.isDuaFav(dua.key)} onPress={() => fav.toggleDua(dua.key)} label={fav.isDuaFav(dua.key) ? 'Favorilerden çıkar' : 'Favorilere ekle'} /> : null}
      {dua ? <IconButton icon="share" label="Paylaş" onPress={onShare} /> : null}
    </View>
  );

  const dock = dua ? (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom: insets.bottom + 20, alignItems: 'center' }}>
      {toast ? (
        <View accessibilityLiveRegion="polite" style={{ marginBottom: 10, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: c.raised, borderWidth: 1, borderColor: c.stroke }}>
          <Txt v="subStrong">{toast}</Txt>
        </View>
      ) : null}
      <View
        style={[
          { width: '100%', maxWidth: 528, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, paddingHorizontal: 10, borderRadius: 22, backgroundColor: c.name === 'dark' ? 'rgba(18,24,38,0.86)' : 'rgba(255,252,246,0.88)', borderWidth: 1, borderColor: c.stroke },
          webBlur,
        ]}
      >
        <Touch onPress={() => changeSize(size - 1)} disabled={size <= 1} accessibilityRole="button" accessibilityLabel="Yazıyı küçült" style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 14 }}>
          <Txt v="callout" style={{ fontSize: 14 }}>A−</Txt>
        </Touch>
        <View
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel="Yazı boyutu"
          accessibilityValue={{ min: 1, max: 5, now: size }}
          accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
          onAccessibilityAction={(e) => changeSize(size + (e.nativeEvent.actionName === 'increment' ? 1 : -1))}
          style={{ flex: 1, flexDirection: 'row', gap: 4 }}
        >
          {[1, 2, 3, 4, 5].map((i) => (
            <View key={i} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: i <= size ? (c.name === 'dark' ? c.gold : '#9A7A3C') : c.name === 'dark' ? 'rgba(243,238,228,0.14)' : 'rgba(26,28,33,0.12)' }} />
          ))}
        </View>
        <Touch onPress={() => changeSize(size + 1)} disabled={size >= 5} accessibilityRole="button" accessibilityLabel="Yazıyı büyüt" style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 14 }}>
          <Txt v="callout" style={{ fontSize: 19 }}>A+</Txt>
        </Touch>
        {next ? (
          <Touch
            onPress={() => router.replace({ pathname: '/dualar/[key]', params: { key: next.key } })}
            accessibilityRole="button"
            accessibilityLabel={`Sonraki dua: ${next.title}`}
            style={{ minHeight: 44, paddingHorizontal: 14, borderRadius: 14, backgroundColor: c.gold, justifyContent: 'center' }}
          >
            <Txt v="bodyStrong" tone="onGold" style={{ fontSize: 14 }}>
              Sonraki
            </Txt>
          </Touch>
        ) : null}
      </View>
    </View>
  ) : null;

  return (
    <Screen header={header} footer={dock} pattern={false} contentStyle={{ paddingBottom: insets.bottom + 120 }}>
      {isLoading && !data ? (
        <View style={{ gap: 14 }}>
          <Skeleton width={200} height={30} />
          <Skeleton height={160} r={24} />
          <Skeleton height={80} />
        </View>
      ) : !dua ? (
        <StateView
          icon="book"
          title={data ? 'Dua bulunamadı' : 'Dua yüklenemedi'}
          body={data ? 'Bu dua kaldırılmış ya da bağlantı hatalı olabilir.' : 'Bağlantınızı kontrol edip tekrar deneyin.'}
          action={data ? <Button label="Dualara dön" kind="secondary" onPress={() => router.replace('/dualar')} /> : <Button label="Tekrar dene" kind="secondary" onPress={() => refetch()} />}
        />
      ) : (
        <>
          <Txt accessibilityRole="header" style={{ fontFamily: fonts.display, fontSize: 26, lineHeight: 32 }}>
            {dua.title}
          </Txt>
          {dua.arabic ? (
            <Glass style={{ marginTop: 16, paddingVertical: 20, paddingHorizontal: 18 }}>
              <Txt v="arabic" lang="ar" style={{ fontSize: AR[size - 1], lineHeight: Math.round(AR[size - 1]! * 1.85) }}>
                {dua.arabic}
              </Txt>
            </Glass>
          ) : null}
          {dua.transliteration ? (
            <>
              <Label>Okunuşu</Label>
              <Txt style={{ fontFamily: fonts.displayItalic, fontSize: TR[size - 1], lineHeight: Math.round(TR[size - 1]! * 1.55) }}>{dua.transliteration}</Txt>
            </>
          ) : null}
          <Label>Anlamı</Label>
          <Txt tone="sub" style={{ fontSize: TR[size - 1], lineHeight: Math.round(TR[size - 1]! * 1.6) }}>
            {dua.meaningTr}
          </Txt>
          {dua.source ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 18, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 14, borderWidth: 1, borderColor: c.hair }}>
              <Icon name="book" size={16} color={c.text2} strokeWidth={1.6} />
              <Txt v="small" tone="secondary" style={{ flex: 1, fontSize: 12.5 }}>
                Kaynak: {dua.source}
              </Txt>
            </View>
          ) : null}
        </>
      )}
    </Screen>
  );
}

function Label({ children }: { children: string }) {
  return (
    <Txt v="caption" tone="secondary" accessibilityRole="header" style={{ marginTop: 20, marginBottom: 6 }}>
      {children}
    </Txt>
  );
}

import { onlineManager } from '@tanstack/react-query';
import { Link, useRouter } from 'expo-router';
import { useCallback, useMemo, useState, useSyncExternalStore } from 'react';
import { ActivityIndicator, FlatList, Linking, TextInput, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, G, Path, Rect } from 'react-native-svg';
import { detectPlace, usePlace } from '@/features/location/store';
import { mosqueName, useNearbyMosques, type Mosque } from '@/features/mosques/api';
import { MapSheet, type Snap } from '@/features/mosques/BottomSheet';
import { openDirections } from '@/features/mosques/directions';
import { distanceLabel, formatDistance, matchesQuery, metresBetween, walkTime, type LatLng } from '@/features/mosques/format';
import { MosqueMap } from '@/features/mosques/MosqueMap';
import { LocalIcon } from '@/features/qibla/icons';
import { useVakitState } from '@/features/prayer/api';
import { VAKIT_LABEL } from '@/lib/prayer';
import { useTheme } from '@/theme/theme';
import { fonts } from '@/theme/tokens';
import { Button, Icon, Skeleton, StateView, TAB_BAR_SPACE, Touch, Txt, webBlur } from '@/ui';

const RADIUS = 3000;
/** Fallback centre (Istanbul) when the user has not set a place yet. */
const DEFAULT_CENTER: LatLng = { lat: 41.0082, lng: 28.9784 };

export default function MosquesScreen() {
  const { c, isDark } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height: H } = useWindowDimensions();
  const place = usePlace((s) => s.place);
  const detecting = usePlace((s) => s.detecting);
  const pLat = place?.lat;
  const pLng = place?.lng;
  const user = useMemo<LatLng | null>(() => (pLat != null && pLng != null ? { lat: pLat, lng: pLng } : null), [pLat, pLng]);

  const [queryCenter, setQueryCenter] = useState<LatLng>(user ?? DEFAULT_CENTER);
  const [recenterKey, setRecenterKey] = useState(0);
  const [snap, setSnap] = useState<Snap>('peek');
  const [search, setSearch] = useState('');
  const online = useSyncExternalStore(onlineManager.subscribe.bind(onlineManager), () => onlineManager.isOnline(), () => true);

  const q = useNearbyMosques(queryCenter, RADIUS);
  const origin = user ?? queryCenter;
  const sorted = useMemo(() => {
    const list = (q.data?.mosques ?? []).map((m) => ({ ...m, d: user ? metresBetween(user, m) : (m.distanceM ?? metresBetween(origin, m)) }));
    return list.sort((a, b) => a.d - b.d);
  }, [q.data, user, origin]);
  const filtered = useMemo(
    () => (search.trim() ? sorted.filter((m) => matchesQuery(`${mosqueName(m)} ${m.address ?? ''}`, search)) : sorted),
    [sorted, search],
  );
  const nearest = sorted[0];

  const loading = q.isLoading || (q.data?.partial && sorted.length === 0);
  const empty = !loading && !q.isError && sorted.length === 0;
  const offline = (!online || q.isError) && !!q.data;
  const failed = q.isError && !q.data;

  const { next } = useVakitState();
  const nextLabel = next ? `${VAKIT_LABEL[next.vakit]} ${next.day.times[next.vakit]}` : null;

  const bottomSpace = TAB_BAR_SPACE + insets.bottom;
  const heights = useMemo<Record<Snap, number>>(
    () => ({ peek: 174 + bottomSpace, half: Math.min(H - 200, Math.round(H * 0.63)), full: H - insets.top - 10 }),
    [H, bottomSpace, insets.top],
  );
  const sheetSnap: Snap = loading || empty || failed ? 'peek' : snap;
  const sheetHeights = useMemo(() => (empty || failed ? { ...heights, peek: 260 + bottomSpace } : heights), [empty, failed, heights, bottomSpace]);

  const onRegionChange = useCallback(
    (center: LatLng) => {
      // Re-query when the view moved well away from the area we have.
      if (metresBetween(center, queryCenter) > RADIUS * 0.6) setQueryCenter(center);
    },
    [queryCenter],
  );

  const goToMe = async () => {
    const r = await detectPlace();
    const p = r.ok ? r.place : usePlace.getState().place;
    if (p?.lat != null && p?.lng != null) setQueryCenter({ lat: p.lat, lng: p.lng });
    setRecenterKey((k) => k + 1);
  };

  const openMosque = (m: Mosque) => router.push({ pathname: '/cami/[id]', params: { id: m.id } });
  const countLabel = loading
    ? 'Bölge taranıyor…'
    : empty
      ? `${RADIUS / 1000} km içinde sonuç yok`
      : failed
        ? 'Camiler yüklenemedi'
        : `${sorted.length} cami · ${RADIUS / 1000} km içinde · mesafeye göre`;

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <MosqueMap
        center={queryCenter}
        recenterKey={recenterKey}
        radius={1200}
        mosques={loading ? [] : sorted}
        nearestId={user ? nearest?.id : null}
        nearestLabel={nearest ? `${formatDistance(nearest.d)} · ${walkTime(nearest.d)}` : undefined}
        user={user}
        onSelect={openMosque}
        onRegionChange={onRegionChange}
        bottomInset={sheetHeights[sheetSnap]}
        accessibilityLabel={`${place?.name ?? 'Bölge'} çevresinin haritası`}
      />

      {/* Search + locate */}
      <View style={{ position: 'absolute', left: 16, right: 16, top: insets.top + 14, flexDirection: 'row', gap: 8 }}>
        <View
          style={[
            {
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
              height: 48,
              paddingHorizontal: 16,
              borderRadius: 999,
              backgroundColor: isDark ? 'rgba(22,29,44,0.82)' : 'rgba(255,252,246,0.9)',
              borderWidth: 1,
              borderColor: c.stroke,
            },
            webBlur,
          ]}
        >
          <Icon name="search" size={18} color={c.text2} strokeWidth={1.6} />
          <TextInput
            value={search}
            onChangeText={(t) => {
              setSearch(t);
              if (t && snap === 'peek') setSnap('half');
            }}
            placeholder="Cami veya semt ara"
            placeholderTextColor={c.text3}
            accessibilityLabel="Cami veya semt ara"
            returnKeyType="search"
            style={{ flex: 1, minWidth: 0, color: c.text, fontFamily: fonts.regular, fontSize: 15, height: 46 }}
          />
          {search ? (
            <Touch onPress={() => setSearch('')} accessibilityRole="button" accessibilityLabel="Aramayı temizle" hitSlop={10}>
              <Icon name="close" size={16} color={c.text2} />
            </Touch>
          ) : null}
        </View>
        <Touch
          onPress={goToMe}
          accessibilityRole="button"
          accessibilityLabel="Konumuma git"
          style={[
            {
              width: 48,
              height: 48,
              borderRadius: 999,
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 1,
              borderColor: c.stroke,
              backgroundColor: isDark ? 'rgba(22,29,44,0.82)' : 'rgba(255,252,246,0.9)',
            },
            webBlur,
          ]}
        >
          {detecting ? <ActivityIndicator color={c.goldText} /> : <LocalIcon name="locate" color={c.goldText} />}
        </Touch>
      </View>

      {offline ? (
        <View
          accessibilityRole="alert"
          style={{
            position: 'absolute',
            left: 16,
            right: 16,
            top: insets.top + 72,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            paddingVertical: 10,
            paddingHorizontal: 14,
            borderRadius: 16,
            backgroundColor: isDark ? '#2A2119' : '#F6E6DC',
            borderWidth: 1,
            borderColor: c.cautionLine,
          }}
        >
          <Icon name="offline" size={18} color={c.caution} strokeWidth={1.6} />
          <Txt v="sub" style={{ flex: 1 }}>
            Çevrimdışı — son kaydedilen camiler gösteriliyor
          </Txt>
        </View>
      ) : null}

      {loading ? (
        <View
          accessibilityRole="progressbar"
          accessibilityLabel="Bu bölgedeki camiler yükleniyor"
          style={[
            {
              position: 'absolute',
              top: insets.top + 188,
              alignSelf: 'center',
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
              height: 40,
              paddingHorizontal: 16,
              borderRadius: 999,
              backgroundColor: isDark ? 'rgba(22,29,44,0.82)' : 'rgba(255,252,246,0.9)',
              borderWidth: 1,
              borderColor: c.stroke,
            },
            webBlur,
          ]}
        >
          <ActivityIndicator size="small" color={c.gold} />
          <Txt v="subStrong">Bu bölgedeki camiler yükleniyor</Txt>
        </View>
      ) : null}

      <Touch
        onPress={() => void Linking.openURL('https://www.openstreetmap.org/copyright')}
        accessibilityRole="link"
        accessibilityLabel="Harita verisi: OpenStreetMap katkıcıları"
        style={{
          position: 'absolute',
          left: 12,
          bottom: sheetHeights[sheetSnap] + 10,
          paddingVertical: 3,
          paddingHorizontal: 8,
          borderRadius: 8,
          backgroundColor: isDark ? 'rgba(22,29,44,0.82)' : 'rgba(255,252,246,0.9)',
        }}
      >
        <Txt v="small" tone="secondary" style={{ fontSize: 10, lineHeight: 13 }}>
          © OpenStreetMap katkıcıları
        </Txt>
      </Touch>

      <MapSheet
        snap={sheetSnap}
        onSnap={setSnap}
        heights={sheetHeights}
        locked={loading || empty || failed}
        header={
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, paddingTop: 2, paddingBottom: 10 }}>
            <View style={{ gap: 2, flex: 1 }}>
              <Txt v="title" style={{ fontSize: 22, lineHeight: 28 }} accessibilityRole="header">
                Yakındaki camiler
              </Txt>
              <Txt v="small" tone="secondary">
                {countLabel}
              </Txt>
            </View>
            <Link href="/cami/oner" asChild>
              <Touch
                accessibilityRole="button"
                style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 36, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: c.stroke, backgroundColor: c.glass }}
              >
                <Icon name="plus" size={14} strokeWidth={2} />
                <Txt v="subStrong">Cami öner</Txt>
              </Touch>
            </Link>
          </View>
        }
      >
        <View style={{ flex: 1, paddingBottom: bottomSpace - 8 }}>
          {loading ? (
            <ListSkeleton />
          ) : failed ? (
            <StateView
              icon="offline"
              tone="caution"
              title="Camiler yüklenemedi"
              body="Bağlantınızı kontrol edip tekrar deneyin."
              action={<Button label="Tekrar dene" kind="secondary" compact onPress={() => q.refetch()} />}
            />
          ) : empty ? (
            <EmptyArea />
          ) : sheetSnap === 'peek' && nearest ? (
            <NearestCard m={nearest} d={nearest.d} nextLabel={nextLabel} onOpen={() => openMosque(nearest)} isNearest={!!user} />
          ) : (
            <MosqueList items={filtered} full={sheetSnap === 'full'} search={search} setSearch={setSearch} onOpen={openMosque} firstId={user ? nearest?.id : undefined} />
          )}
        </View>
      </MapSheet>
    </View>
  );
}

function NearestCard({ m, d, nextLabel, onOpen, isNearest }: { m: Mosque; d: number; nextLabel: string | null; onOpen: () => void; isNearest: boolean }) {
  const { c } = useTheme();
  const meta = [formatDistance(d), `${walkTime(d)} yürüme`, nextLabel].filter(Boolean).join(' · ');
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 20, backgroundColor: c.goldTint, borderWidth: 1, borderColor: c.goldLine }}>
      <View style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: c.gold }}>
        <Icon name="mosque" size={22} color={c.onGold} strokeWidth={1.7} />
      </View>
      <Touch onPress={onOpen} accessibilityRole="button" accessibilityLabel={`${isNearest ? 'En yakın: ' : ''}${mosqueName(m)}, ${distanceLabel(d)}, ${walkTime(d)} yürüme`} style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Txt v="caption" tone="gold" weight="semibold" style={{ fontSize: 10.5 }}>
          {isNearest ? 'EN YAKIN' : 'BU BÖLGEDE'}
        </Txt>
        <Txt v="bodyStrong" numberOfLines={1} style={{ fontSize: 16 }}>
          {mosqueName(m)}
        </Txt>
        <Txt v="small" tone="sub" tnum numberOfLines={1}>
          {meta}
        </Txt>
      </Touch>
      <Touch
        onPress={() => void openDirections({ lat: m.lat, lng: m.lng, name: mosqueName(m) })}
        accessibilityRole="button"
        accessibilityLabel="Yol tarifi"
        style={{ width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: c.gold }}
      >
        <LocalIcon name="directions" color={c.onGold} strokeWidth={1.8} />
      </Touch>
    </View>
  );
}

function MosqueList({
  items,
  full,
  search,
  setSearch,
  onOpen,
  firstId,
}: {
  items: (Mosque & { d: number })[];
  full: boolean;
  search: string;
  setSearch: (s: string) => void;
  onOpen: (m: Mosque) => void;
  firstId?: string;
}) {
  const { c } = useTheme();
  return (
    <View style={{ flex: 1 }}>
      {full ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, height: 44, marginBottom: 8, paddingHorizontal: 14, borderRadius: 14, backgroundColor: c.input, borderWidth: 1, borderColor: c.stroke }}>
          <Icon name="search" size={16} color={c.text2} strokeWidth={1.6} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Listede ara"
            placeholderTextColor={c.text3}
            accessibilityLabel="Listede ara"
            style={{ flex: 1, minWidth: 0, color: c.text, fontFamily: fonts.regular, fontSize: 15, height: 42 }}
          />
        </View>
      ) : null}
      <FlatList
        data={items}
        keyExtractor={(m) => m.id}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <Txt v="sub" tone="secondary" center style={{ paddingVertical: 24 }}>
            “{search}” ile eşleşen cami yok.
          </Txt>
        }
        ListFooterComponent={
          full ? (
            <View style={{ borderTopWidth: 1, borderTopColor: c.hair, paddingTop: 16, paddingBottom: 8, flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', gap: 4 }}>
              <Txt v="sub" tone="secondary">
                Listede olmayan bir cami mi var?
              </Txt>
              <Link href="/cami/oner" asChild>
                <Touch accessibilityRole="link">
                  <Txt v="sub" tone="gold" weight="semibold">
                    Cami öner
                  </Txt>
                </Touch>
              </Link>
            </View>
          ) : undefined
        }
        renderItem={({ item: m, index }) => {
          const first = m.id === firstId;
          return (
            <Touch
              onPress={() => onOpen(m)}
              accessibilityRole="button"
              accessibilityLabel={`${mosqueName(m)}${first ? ', en yakın' : ''}, ${distanceLabel(m.d)}, ${walkTime(m.d)} yürüme`}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64, borderTopWidth: index === 0 ? 0 : 1, borderTopColor: c.hair }}
            >
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: first ? c.gold : c.goldTint,
                  borderWidth: 1,
                  borderColor: first ? 'transparent' : c.goldLine,
                }}
              >
                <Icon name="mosque" size={19} color={first ? c.onGold : c.goldText} strokeWidth={1.6} />
              </View>
              <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Txt v="callout" numberOfLines={1} style={{ flexShrink: 1 }}>
                    {mosqueName(m)}
                  </Txt>
                  {first ? (
                    <View style={{ paddingVertical: 2, paddingHorizontal: 6, borderRadius: 6, backgroundColor: c.goldTint }}>
                      <Txt v="caption" tone="gold" weight="semibold" style={{ fontSize: 9.5, lineHeight: 12, letterSpacing: 0.8 }}>
                        EN YAKIN
                      </Txt>
                    </View>
                  ) : null}
                </View>
                <Txt v="sub" tone="secondary" tnum>
                  {formatDistance(m.d)} · {walkTime(m.d)} yürüme
                </Txt>
              </View>
              <Icon name="forward" size={16} color={c.text2} strokeWidth={1.6} />
            </Touch>
          );
        }}
      />
    </View>
  );
}

function ListSkeleton() {
  return (
    <View aria-hidden style={{ gap: 4 }}>
      {[60, 48].map((w, i) => (
        <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64 }}>
          <Skeleton width={40} height={40} r={20} />
          <View style={{ flex: 1, gap: 8 }}>
            <Skeleton width={`${w}%`} height={12} r={6} />
            <Skeleton width={`${w - 22}%`} height={10} r={5} />
          </View>
        </View>
      ))}
    </View>
  );
}

function EmptyArea() {
  const { c } = useTheme();
  return (
    <View style={{ alignItems: 'center', gap: 8, paddingHorizontal: 8, paddingTop: 4 }}>
      <Svg width={64} height={64} viewBox="0 0 64 64" aria-hidden>
        <Circle cx={32} cy={32} r={30} fill="none" stroke={c.hair} strokeWidth={1} strokeDasharray="1 5" />
        <G fill="none" stroke={c.gold} strokeWidth={0.9} opacity={0.7}>
          <Rect x={18} y={18} width={28} height={28} />
          <Rect x={18} y={18} width={28} height={28} transform="rotate(45 32 32)" />
        </G>
        <Path d="M23 42h18M25 42v-5a7 7 0 0 1 14 0v5" fill="none" stroke={c.text2} strokeWidth={1.4} strokeLinecap="round" />
      </Svg>
      <Txt v="titleSm" center>
        Bu bölgede kayıtlı cami yok
      </Txt>
      <Txt v="sub" tone="sub" center>
        Haritayı kaydırarak başka bir bölgeye bakın ya da bildiğiniz bir camiyi önerin.
      </Txt>
    </View>
  );
}

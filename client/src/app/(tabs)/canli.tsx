import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Platform, ScrollView, View } from 'react-native';
import Svg, { Circle, G, Path, Rect } from 'react-native-svg';
import { useChannels, useStreams, type LiveStream } from '@/features/live/api';
import { BellButton, ChannelMono, FeaturedStream, OfflineStrip, StreamArt, CategoryGlyph } from '@/features/live/components';
import { CATEGORY_CHIPS, compactCount, monogram, splitStreams, startsLabel, type CategoryFilter } from '@/features/live/format';
import { hydrateLiveReminders, toggleLiveReminder, useLiveReminders } from '@/features/live/reminders';
import { useOnline } from '@/features/live/useOnline';
import { useNow } from '@/features/prayer/api';
import { useTheme } from '@/theme/theme';
import { Chip, Glass, IconButton, Screen, Skeleton, Touch, Txt } from '@/ui';

export default function LiveScreen() {
  const { c, isDark } = useTheme();
  const router = useRouter();
  const streams = useStreams();
  const channels = useChannels();
  const online = useOnline();
  const [cat, setCat] = useState<CategoryFilter>('all');
  const now = useNow(1000);
  const reminders = useLiveReminders((s) => s.reminders);
  useEffect(() => {
    void hydrateLiveReminders();
  }, []);

  const all = useMemo(() => streams.data ?? [], [streams.data]);
  const { live, upcoming } = useMemo(() => splitStreams(all, cat), [all, cat]);
  const liveChannelIds = useMemo(() => new Set(all.filter((s) => s.status === 'live').map((s) => s.channel.id)), [all]);
  const loading = streams.isLoading && !streams.data;
  const offline = !online || (streams.isError && !!streams.data);
  const featured = live[0];
  const otherLive = live.slice(1);
  const nothingAtAll = !loading && all.length === 0;

  const onToggle = async (s: LiveStream) => {
    const r = await toggleLiveReminder(s);
    if (r === 'denied') {
      Alert.alert('Bildirim izni gerekli', 'Hatırlatma için Ayarlar’dan bildirimlere izin verin.');
    }
  };

  return (
    <Screen
      tabs
      sky="aksam"
      refreshing={streams.isFetching && !loading}
      onRefresh={() => {
        void streams.refetch();
        void channels.refetch();
      }}
      contentStyle={{ paddingHorizontal: 0 }}
    >
      <View style={{ paddingHorizontal: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <View style={{ flex: 1, gap: 4 }}>
          <Txt v="display" accessibilityRole="header" style={{ fontSize: 32, lineHeight: 38 }}>
            Canlı Yayınlar
          </Txt>
          <Txt v="sub" tone="sub">
            Harameyn, dua, Kur’an ve sohbet yayınları
          </Txt>
        </View>
        <IconButton icon="chat" label="Sohbet" onPress={() => router.push('/sohbet')} />
      </View>

      {offline ? (
        <View style={{ marginHorizontal: 20, marginTop: 12 }}>
          <OfflineStrip text="Çevrimdışı — yayınları izlemek için bağlantı gerekli" />
        </View>
      ) : null}

      <View accessibilityLabel="Şu an canlı" style={{ marginHorizontal: 20, marginTop: 14 }}>
        {loading ? (
          <View accessibilityLabel="Yayınlar yükleniyor" accessibilityState={{ busy: true }} style={{ height: 214, borderRadius: 26, backgroundColor: c.glass, padding: 14, justifyContent: 'space-between' }}>
            <Skeleton width={74} height={28} r={14} />
            <View style={{ gap: 10 }}>
              <Skeleton width="62%" height={16} />
              <Skeleton width="38%" height={11} />
            </View>
          </View>
        ) : featured ? (
          <FeaturedStream stream={featured} offline={offline} />
        ) : nothingAtAll ? (
          <EmptyLive />
        ) : (
          <Glass radius={24} style={{ height: 96, flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 18 }}>
            <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: c.goldTint, alignItems: 'center', justifyContent: 'center' }}>
              <CategoryGlyph category="other" size={20} color={c.goldText} />
            </View>
            <View style={{ flex: 1, gap: 3 }}>
              <Txt v="bodyStrong">Bu kategoride şu an canlı yok</Txt>
              <Txt v="sub" tone="sub">
                Yaklaşan yayınlara aşağıdan göz atabilirsiniz.
              </Txt>
            </View>
          </Glass>
        )}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} accessibilityLabel="Kategoriler" contentContainerStyle={{ gap: 8, paddingHorizontal: 20, marginTop: 16 }}>
        {CATEGORY_CHIPS.map((k) => (
          <Chip key={k.id} label={k.label} selected={cat === k.id} onPress={() => !loading && setCat(k.id)} />
        ))}
      </ScrollView>

      {otherLive.length > 0 ? (
        <Section title="Şu an canlı">
          <List>
            {otherLive.map((s, i) => (
              <StreamRow key={s.videoId} stream={s} first={i === 0} meta={`${compactCount(s.concurrentViewers) ? `${compactCount(s.concurrentViewers)} izliyor · ` : ''}${s.channel.title}`} live />
            ))}
          </List>
        </Section>
      ) : null}

      <Section title="Yaklaşan yayınlar">
        <List>
          {loading ? (
            [0, 1].map((i) => (
              <View key={i} aria-hidden style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 76, borderTopWidth: i ? 1 : 0, borderTopColor: c.hair }}>
                <Skeleton width={52} height={52} r={14} />
                <View style={{ flex: 1, gap: 8 }}>
                  <Skeleton width="70%" height={12} />
                  <Skeleton width="40%" height={10} />
                </View>
              </View>
            ))
          ) : upcoming.length === 0 ? (
            <View style={{ minHeight: 64, justifyContent: 'center', paddingRight: 12 }}>
              <Txt v="sub" tone="secondary">
                Planlanmış bir yayın yok.
              </Txt>
            </View>
          ) : (
            upcoming.slice(0, 6).map((s, i) => {
              const on = !!reminders[s.videoId];
              return (
                <View key={s.videoId} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 76, borderTopWidth: i ? 1 : 0, borderTopColor: c.hair }}>
                  <StreamArt stream={s} style={{ width: 52, height: 52, borderRadius: 14 }} />
                  <View style={{ flex: 1, gap: 3 }}>
                    <Txt v="callout" numberOfLines={1}>
                      {s.title}
                    </Txt>
                    <Txt v="small" tone="secondary" numberOfLines={1}>
                      {s.channel.title}
                    </Txt>
                    <Txt v="small" tone="gold" weight="semibold" tnum>
                      {startsLabel(s.scheduledStartAt, now)}
                    </Txt>
                  </View>
                  <BellButton on={on} label={on ? 'Hatırlatıcıyı kapat' : 'Başladığında hatırlat'} onPress={() => void onToggle(s)} />
                </View>
              );
            })
          )}
        </List>
        {Platform.OS === 'web' && Object.keys(reminders).length > 0 ? (
          <Txt v="small" tone="tertiary" style={{ marginTop: 8 }}>
            Hatırlatmalar mobil uygulamada bildirim olarak gelir.
          </Txt>
        ) : null}
      </Section>

      {(channels.data?.length ?? 0) > 0 ? (
        <View style={{ marginTop: 22 }}>
          <Txt v="titleSm" accessibilityRole="header" style={{ marginHorizontal: 20 }}>
            Kanallar
          </Txt>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingHorizontal: 20, marginTop: 10 }}>
            {channels.data!.map((ch) => {
              const isLive = liveChannelIds.has(ch.id);
              return (
                <Touch
                  key={ch.id}
                  accessibilityRole="button"
                  accessibilityLabel={`${ch.title}, ${isLive ? 'canlı yayında' : 'yayında değil'}`}
                  onPress={() => {
                    const s = all.find((x) => x.channel.id === ch.id && x.status === 'live');
                    if (s) router.push({ pathname: '/yayin/[videoId]', params: { videoId: s.videoId } });
                    else setCat(ch.category);
                  }}
                >
                  <Glass radius={22} style={{ width: 116, alignItems: 'center', gap: 8, paddingVertical: 14, paddingHorizontal: 10 }}>
                    <ChannelMono text={monogram(ch.title)} live={isLive} />
                    <Txt v="subStrong" center numberOfLines={2} weight="semibold" style={{ lineHeight: 17 }}>
                      {ch.title}
                    </Txt>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                      {isLive ? <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: c.gold }} /> : null}
                      <Txt v="small" color={isLive ? c.goldText : c.text2} style={{ fontSize: 11 }}>
                        {isLive ? 'Canlı yayında' : 'Yayında değil'}
                      </Txt>
                    </View>
                  </Glass>
                </Touch>
              );
            })}
          </ScrollView>
        </View>
      ) : null}
      {!isDark ? <View style={{ height: 4 }} /> : null}
    </Screen>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ marginTop: 22, marginHorizontal: 20 }}>
      <Txt v="titleSm" accessibilityRole="header">
        {title}
      </Txt>
      <View style={{ marginTop: 10 }}>{children}</View>
    </View>
  );
}

function List({ children }: { children: React.ReactNode }) {
  const { c } = useTheme();
  return <View style={{ borderRadius: 22, backgroundColor: c.raised, borderWidth: 1, borderColor: c.hair, paddingVertical: 4, paddingLeft: 12, paddingRight: 8 }}>{children}</View>;
}

function StreamRow({ stream, first, meta, live }: { stream: LiveStream; first: boolean; meta: string; live?: boolean }) {
  const { c } = useTheme();
  const router = useRouter();
  return (
    <Touch
      accessibilityRole="button"
      accessibilityLabel={`${live ? 'Canlı: ' : ''}${stream.title}, ${meta}. İzle`}
      onPress={() => router.push({ pathname: '/yayin/[videoId]', params: { videoId: stream.videoId } })}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 72, borderTopWidth: first ? 0 : 1, borderTopColor: c.hair }}
    >
      <StreamArt stream={stream} style={{ width: 64, height: 44, borderRadius: 12 }} />
      <View style={{ flex: 1, gap: 3 }}>
        <Txt v="callout" numberOfLines={1}>
          {stream.title}
        </Txt>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {live ? <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: c.gold }} /> : null}
          <Txt v="small" color={live ? c.goldText : c.text2} weight={live ? 'semibold' : 'regular'} tnum numberOfLines={1} style={{ flex: 1 }}>
            {meta}
          </Txt>
        </View>
      </View>
      <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={c.text3} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <Path d="m9 6 6 6-6 6" />
      </Svg>
    </Touch>
  );
}

function EmptyLive() {
  const { c } = useTheme();
  return (
    <Glass radius={26} style={{ height: 214, alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 28 }}>
      <Svg width={88} height={88} viewBox="0 0 88 88" aria-hidden>
        <Circle cx="44" cy="44" r="42" fill="none" stroke={c.hair} strokeWidth={0.8} strokeDasharray="1 5" />
        <G fill="none" stroke={c.gold} strokeWidth={0.8} opacity={0.6}>
          <Rect x="24" y="24" width="40" height="40" />
          <Rect x="24" y="24" width="40" height="40" transform="rotate(45 44 44)" />
        </G>
        <Circle cx="44" cy="44" r="4" fill={c.goldText} opacity={0.85} />
      </Svg>
      <Txt v="titleSm" center>
        Şu an canlı yayın yok
      </Txt>
      <Txt v="sub" tone="sub" center>
        Sıradaki yayın başladığında size sessizce haber verebiliriz.
      </Txt>
    </Glass>
  );
}

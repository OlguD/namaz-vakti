import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { hydrateSeen, useRoomPreviews, useRooms, useSeen } from '@/features/chat/api';
import { clockOf, isArabicText } from '@/features/chat/messages';
import { RulesSheet } from '@/features/chat/sheets';
import type { ChatRoom, ServerMessage } from '@/features/chat/types';
import { OfflineStrip } from '@/features/live/components';
import { useOnline } from '@/features/live/useOnline';
import { useFlags } from '@/lib/flags';
import { useTheme } from '@/theme/theme';
import { fonts } from '@/theme/tokens';
import { Glass, Header, Icon, Screen, Skeleton, StateView, Button, Touch, Txt } from '@/ui';

const MONO: Record<string, string> = { genel: 'G', tr: 'TR', en: 'EN', ar: 'ع' };

export default function ChatRoomsScreen() {
  const { c, isDark } = useTheme();
  const router = useRouter();
  const rooms = useRooms();
  const online = useOnline();
  const accepted = useFlags((s) => s.chatRulesAccepted);
  // Settings links here with ?kurallar=1 to show the rules again.
  const { kurallar } = useLocalSearchParams<{ kurallar?: string }>();
  const [rulesOpen, setRulesOpen] = useState(!accepted || kurallar === '1');
  const [pending, setPending] = useState<string | null>(null);
  const list = rooms.data ?? [];
  const previews = useRoomPreviews(list.map((r) => r.id));
  const seen = useSeen((s) => s.seen);

  useEffect(() => {
    void hydrateSeen();
  }, []);

  const anySlow = list.some((r) => r.slowModeSeconds > 0);
  const offline = !online || (rooms.isError && !!rooms.data);
  const open = (room: ChatRoom) => {
    if (!accepted) {
      setPending(room.id);
      setRulesOpen(true);
      return;
    }
    router.push({ pathname: '/sohbet/[roomId]', params: { roomId: room.id } });
  };

  return (
    <Screen
      sky={isDark ? 'yatsi' : 'ogle'}
      header={<Header title="Sohbet" subtitle="Dünyanın dört bir yanından, saygıyla" />}
      refreshing={rooms.isFetching && !rooms.isLoading}
      onRefresh={() => {
        void rooms.refetch();
        previews.forEach((p) => void p.refetch());
      }}
    >
      {offline ? (
        <View style={{ marginBottom: 14 }}>
          <OfflineStrip text="Çevrimdışı — son görülen mesajlar gösteriliyor" />
        </View>
      ) : null}

      <Touch
        accessibilityRole="button"
        accessibilityLabel={`Topluluk kuralları${anySlow ? ', yavaş mod açık' : ''}`}
        onPress={() => setRulesOpen(true)}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52, paddingHorizontal: 14, borderRadius: 18, backgroundColor: c.goldTint, borderWidth: 1, borderColor: c.goldLine }}
      >
        <Icon name="shield" size={20} color={c.goldText} />
        <Txt v="callout" style={{ flex: 1, fontSize: 14 }}>
          Topluluk kuralları
        </Txt>
        {anySlow ? (
          <Txt v="small" tone="secondary">
            Yavaş mod açık
          </Txt>
        ) : null}
        <Icon name="forward" size={18} color={c.text3} />
      </Touch>

      <Txt v="caption" tone="secondary" accessibilityRole="header" style={{ marginTop: 22, letterSpacing: 1.5 }}>
        Odalar
      </Txt>
      <View style={{ marginTop: 10, gap: 10 }}>
        {rooms.isLoading && !rooms.data ? (
          ['40%', '52%', '46%', '36%'].map((w) => (
            <Glass key={w} radius={22} style={{ flexDirection: 'row', gap: 14 }}>
              <Skeleton width={48} height={48} r={16} />
              <View style={{ flex: 1, gap: 9, paddingTop: 4 }}>
                <Skeleton width={w as `${number}%`} height={12} />
                <Skeleton width="80%" height={10} />
                <Skeleton width="56%" height={10} />
              </View>
            </Glass>
          ))
        ) : list.length === 0 ? (
          <StateView
            icon="chat"
            tone={rooms.isError ? 'caution' : 'gold'}
            title={rooms.isError ? 'Odalar yüklenemedi' : 'Şu an açık oda yok'}
            body={rooms.isError ? 'Bağlantınızı kontrol edip tekrar deneyin.' : undefined}
            action={rooms.isError ? <Button label="Tekrar dene" kind="secondary" onPress={() => void rooms.refetch()} /> : undefined}
          />
        ) : (
          list.map((room, i) => <RoomTile key={room.id} room={room} recent={previews[i]?.data} seenId={seen[room.id] ?? 0} offline={offline} onPress={() => open(room)} />)
        )}
      </View>

      <Touch accessibilityRole="button" onPress={() => router.push('/sohbet/engellenenler')} style={{ marginTop: 18, minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'center' }}>
        <Icon name="block" size={16} color={c.text2} />
        <Txt v="sub" tone="secondary">
          Engellenen kullanıcılar
        </Txt>
      </Touch>

      <RulesSheet
        visible={rulesOpen}
        onClose={() => setRulesOpen(false)}
        onAccepted={() => {
          if (pending) {
            const id = pending;
            setPending(null);
            setTimeout(() => router.push({ pathname: '/sohbet/[roomId]', params: { roomId: id } }), 350);
          }
        }}
      />
    </Screen>
  );
}

function RoomTile({ room, recent, seenId, offline, onPress }: { room: ChatRoom; recent?: ServerMessage[]; seenId: number; offline: boolean; onPress: () => void }) {
  const { c } = useTheme();
  const arabic = room.language === 'ar';
  const last = recent?.[recent.length - 1];
  const unread = seenId > 0 && recent ? recent.filter((m) => Number(m.id) > seenId).length : 0;
  const unreadLabel = unread >= 30 ? '30+' : String(unread);
  const preview = last ? `${last.author.displayName}: ${last.body}` : 'Henüz mesaj yok';
  const previewArabic = last ? isArabicText(last.body) : false;
  const mono = MONO[room.id] ?? room.name.slice(0, 2).toLocaleUpperCase('tr');
  return (
    <Touch
      accessibilityRole="button"
      accessibilityLabel={`${room.name} odası. ${room.description ?? ''}. ${last ? `Son mesaj: ${preview}` : 'Henüz mesaj yok'}${unread ? `. ${unreadLabel} okunmamış mesaj` : ''}`}
      onPress={onPress}
    >
      <Glass radius={22} style={{ flexDirection: 'row', gap: 14 }}>
        <View aria-hidden style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: c.raised, borderWidth: 1, borderColor: c.goldLine, alignItems: 'center', justifyContent: 'center' }}>
          <Txt v="titleSm" tone="gold" style={arabic ? { fontFamily: fonts.arabic, fontSize: 26, lineHeight: 40 } : { fontSize: 18, lineHeight: 22 }}>
            {mono}
          </Txt>
        </View>
        <View style={{ flex: 1, gap: 3 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
            <Txt v="headline" style={arabic ? { fontFamily: fonts.arabicBold, fontSize: 19, lineHeight: 26 } : undefined} numberOfLines={1}>
              {room.name}
            </Txt>
            {last ? (
              <Txt v="small" tone="secondary" tnum>
                {clockOf(last.createdAt)}
              </Txt>
            ) : null}
          </View>
          {room.description ? (
            <Txt v="small" tone="secondary" numberOfLines={1}>
              {room.description}
            </Txt>
          ) : null}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
            <Txt
              v="sub"
              tone="sub"
              numberOfLines={1}
              style={[{ flex: 1 }, previewArabic ? { fontFamily: fonts.arabic, fontSize: 15, writingDirection: 'rtl', textAlign: 'right' } : null]}
            >
              {preview}
            </Txt>
            {unread > 0 ? (
              <View style={{ minWidth: 20, height: 20, paddingHorizontal: 6, borderRadius: 10, backgroundColor: c.gold, alignItems: 'center', justifyContent: 'center' }}>
                <Txt v="small" color={c.onGold} weight="semibold" tnum style={{ fontSize: 11, lineHeight: 14 }}>
                  {unreadLabel}
                </Txt>
              </View>
            ) : null}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: offline ? c.text2 : c.sage }} />
            <Txt v="small" tone="secondary" tnum style={{ fontSize: 11 }}>
              {offline ? `Son görülme ${last ? clockOf(last.createdAt) : '—'}` : room.slowModeSeconds > 0 ? `Yavaş mod ${room.slowModeSeconds} sn` : 'Açık'}
            </Txt>
          </View>
        </View>
      </Glass>
    </Touch>
  );
}

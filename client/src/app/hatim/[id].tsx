import * as Clipboard from 'expo-clipboard';
import * as Linking from 'expo-linking';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Platform, Share, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { errorMessage, isApiError } from '@/api/errors';
import { useHatim, useHatimAction, useLeaveHatim, type HatimDetail } from '@/features/worship/api';
import { WIcon } from '@/features/worship/icons';
import { dayMonthLabel, useOnline } from '@/features/worship/util';
import { useTheme } from '@/theme/theme';
import { Button, Glass, Group, Header, Icon, IconButton, Notice, Row, Screen, SectionTitle, Sheet, Skeleton, StateView, tapFeedback, Touch, Txt } from '@/ui';

export default function GroupHatimScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { c } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const online = useOnline();
  const q = useHatim(id);
  const act = useHatimAction(id);
  const leave = useLeaveHatim(id);
  const [juzSheet, setJuzSheet] = useState<number | null>(null);
  const [menu, setMenu] = useState(false);
  const [shared, setShared] = useState(false);
  const h = q.data;

  if (!h) {
    return (
      <Screen header={<Header />}>
        {q.isError ? (
          <StateView
            icon={isApiError(q.error) && q.error.status === 404 ? 'info' : 'offline'}
            tone="caution"
            title={isApiError(q.error) && q.error.status === 404 ? 'Bu hatme erişiminiz yok' : 'Hatim yüklenemedi'}
            body={isApiError(q.error) && q.error.status === 404 ? 'Hatimden ayrılmış ya da çıkarılmış olabilirsiniz.' : errorMessage(q.error)}
            action={<Button kind="secondary" label="Tekrar dene" onPress={() => void q.refetch()} />}
          />
        ) : (
          <View style={{ gap: 12 }}>
            <Skeleton height={34} width="70%" />
            <Skeleton height={80} r={20} />
            <Skeleton height={300} r={20} />
          </View>
        )}
      </Screen>
    );
  }

  const owner = h.members.find((m) => m.role === 'owner');
  const mine = h.juz.filter((j) => j.status === 'taken' && j.holder?.isMe).map((j) => j.juz);
  const myRead = h.juz.filter((j) => j.status === 'read' && j.holder?.isMe).map((j) => j.juz);
  const nextOpen = h.juz.find((j) => j.status === 'open');
  const allRead = h.counts.read === 30;
  const link = Linking.createURL('/hatim/katil', { queryParams: { kod: h.inviteCode } });

  const share = async () => {
    const message = `“${h.name}” ortak hatmine katılın. Davet kodu: ${h.inviteCode}\n${link}`;
    try {
      if (Platform.OS === 'web') {
        await Clipboard.setStringAsync(message);
        setShared(true);
      } else {
        await Share.share({ message });
      }
    } catch {
      await Clipboard.setStringAsync(message).catch(() => {});
      setShared(true);
    }
  };

  const onJuz = (j: HatimDetail['juz'][number]) => {
    if (!online) return;
    if (j.status === 'open') {
      tapFeedback();
      act.mutate({ type: 'take', juz: j.juz });
    } else if (j.status === 'taken' && j.holder?.isMe) setJuzSheet(j.juz);
  };

  return (
    <Screen
      sky="ikindi"
      refreshing={q.isRefetching}
      onRefresh={() => void q.refetch()}
      footer={
        <View style={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 16, paddingTop: 8, maxWidth: 560, width: '100%', alignSelf: 'center' }}>
          <Button
            label={!online ? 'Çevrimdışı · cüz alınamıyor' : allRead ? 'Yeni tur başlat' : nextOpen ? `Cüz al · ${nextOpen.juz}. cüz` : 'Tüm cüzler dağıtıldı'}
            disabled={!online || (!nextOpen && !(allRead && h.isOwner))}
            loading={act.isPending}
            onPress={() => act.mutate(allRead ? { type: 'new-round' } : { type: 'take-next' })}
          />
        </View>
      }
    >
      <Header
        title={h.name}
        large={false}
        subtitle={[owner ? `Yöneten: ${owner.displayName ?? 'Anonim'}` : null, `${h.members.length} kişi`, h.targetDate ? `hedef ${dayMonthLabel(h.targetDate)}` : null, h.round > 1 ? `${h.round}. tur` : null]
          .filter(Boolean)
          .join(' · ')}
        right={<IconButton icon="more" label="Hatim seçenekleri" onPress={() => setMenu(true)} />}
      />

      {!online ? (
        <View style={{ marginBottom: 12 }}>
          <Notice icon="offline" title="Çevrimdışısınız" body="Son eşitlenen durum gösteriliyor; cüz almak için bağlantı gerekli." />
        </View>
      ) : null}
      {act.error ? (
        <View style={{ marginBottom: 12 }}>
          <Notice icon="alert" title="İşlem yapılamadı" body={isApiError(act.error) && act.error.status === 409 ? 'Bu cüz az önce başkası tarafından alındı.' : errorMessage(act.error)} />
        </View>
      ) : null}

      <Glass radius={24} style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
        <Txt v="time" tnum style={{ fontSize: 40, lineHeight: 44, fontFamily: 'Inter_200ExtraLight' }} accessibilityLabel={`30 cüzden ${h.counts.read} cüz okundu`}>
          {h.counts.read}
          <Txt v="time" tone="secondary" style={{ fontSize: 18 }}>
            /30
          </Txt>
        </Txt>
        <View style={{ flex: 1, gap: 8 }}>
          <View style={{ flexDirection: 'row', height: 6, borderRadius: 3, backgroundColor: c.hair, overflow: 'hidden' }}>
            <View style={{ width: `${(h.counts.read / 30) * 100}%`, backgroundColor: c.sage }} />
            <View style={{ width: `${(h.counts.taken / 30) * 100}%`, backgroundColor: c.gold }} />
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Txt v="small" tone="secondary" tnum>
              {h.counts.read} okundu
            </Txt>
            <Txt v="small" tone="secondary" tnum>
              {h.counts.taken} alındı
            </Txt>
            <Txt v="small" tone="secondary" tnum>
              {h.counts.open} boş
            </Txt>
          </View>
        </View>
      </Glass>

      <View style={{ flexDirection: 'row', gap: 14, marginTop: 14, marginBottom: 10 }} aria-hidden>
        {[
          ['Okundu', c.sageTint, 'transparent'],
          ['Alındı', c.goldTint, c.gold],
          ['Boş', 'transparent', c.hair],
        ].map(([label, bg, line]) => (
          <View key={label} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={{ width: 12, height: 12, borderRadius: 4, backgroundColor: bg, borderWidth: 1, borderColor: line, borderStyle: label === 'Boş' ? 'dashed' : 'solid' }} />
            <Txt v="small" tone="secondary" style={{ fontSize: 11 }}>
              {label}
            </Txt>
          </View>
        ))}
      </View>

      <View accessibilityLabel="30 cüz" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {h.juz.map((j) => {
          const me = !!j.holder?.isMe;
          const read = j.status === 'read';
          const taken = j.status === 'taken';
          const label = `${j.juz}. cüz: ${read ? 'okundu' : taken ? (me ? 'sizde' : `${j.holder?.displayName ?? 'bir üye'} aldı`) : 'boş'}`;
          const tappable = online && (j.status === 'open' || (taken && me));
          return (
            <Touch
              key={j.juz}
              disabled={!tappable}
              onPress={() => onJuz(j)}
              accessibilityRole={tappable ? 'button' : undefined}
              accessibilityLabel={tappable ? `${label}. ${j.status === 'open' ? 'Almak için dokunun' : 'Seçenekler'}` : label}
              style={{
                width: '15.4%',
                flexGrow: 1,
                aspectRatio: 0.9,
                borderRadius: 14,
                padding: 6,
                justifyContent: 'space-between',
                backgroundColor: read ? c.sageTint : taken && me ? c.goldTint : 'transparent',
                borderWidth: 1,
                borderColor: read ? 'transparent' : taken ? c.gold : c.hair,
                borderStyle: j.status === 'open' ? 'dashed' : 'solid',
                opacity: 1,
              }}
            >
              <Txt v="subStrong" tnum color={read ? c.text2 : c.text}>
                {j.juz}
              </Txt>
              <View style={{ alignItems: 'flex-end' }}>
                {taken ? (
                  <View style={{ minWidth: 22, height: 22, paddingHorizontal: 3, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: me ? '#C9A96E' : c.goldTint }}>
                    <Txt v="small" color={me ? '#1A1408' : c.goldText} weight="semibold" style={{ fontSize: 9, lineHeight: 11 }}>
                      {j.holder?.initials ?? '?'}
                    </Txt>
                  </View>
                ) : read ? (
                  <WIcon name="prayed" size={16} color={c.sage} strokeWidth={1.8} />
                ) : null}
              </View>
            </Touch>
          );
        })}
      </View>

      <SectionTitle>Sizin cüzleriniz</SectionTitle>
      <Txt v="sub" tone="sub">
        {mine.length
          ? `Okunacak: ${mine.join('. ve ')}. cüz. Okuduğunuzda cüze dokunup “Okudum” deyin.`
          : myRead.length
            ? `${myRead.join(' ve ')}. cüzleri okudunuz. Allah kabul etsin.`
            : 'Henüz cüz almadınız. Boş bir cüze dokunarak alabilirsiniz.'}
      </Txt>

      <Touch onPress={() => void share()} accessibilityRole="button" accessibilityLabel={shared ? 'Davet metni kopyalandı' : 'Davet bağlantısını paylaş'} style={{ marginTop: 16 }}>
        <Glass radius={20} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: c.goldTint }}>
            <WIcon name="link" color={c.goldText} />
          </View>
          <View style={{ flex: 1 }}>
            <Txt v="callout">{shared ? 'Davet metni kopyalandı' : 'Davet bağlantısını paylaş'}</Txt>
            <Txt v="small" tone="secondary" tnum>
              Kod: {h.inviteCode}
            </Txt>
          </View>
          <Txt v="subStrong" tone="gold">
            {shared ? 'Tamam' : 'Paylaş'}
          </Txt>
        </Glass>
      </Touch>

      <SectionTitle>Üyeler</SectionTitle>
      <Group>
        {h.members.map((m, i) => (
          <Row
            key={m.id}
            title={`${m.displayName ?? 'Anonim'}${m.isMe ? ' (siz)' : ''}`}
            subtitle={m.role === 'owner' ? 'Yönetici' : undefined}
            last={i === h.members.length - 1}
            right={
              h.isOwner && !m.isMe ? (
                <Touch onPress={() => act.mutate({ type: 'kick', userId: m.id })} accessibilityRole="button" accessibilityLabel={`${m.displayName ?? 'Üye'} hatimden çıkar`} style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 6 }}>
                  <Txt v="small" tone="caution">
                    Çıkar
                  </Txt>
                </Touch>
              ) : undefined
            }
          />
        ))}
      </Group>

      <Sheet visible={juzSheet != null} onClose={() => setJuzSheet(null)} title={`${juzSheet}. cüz`}>
        <Txt v="sub" tone="sub">
          Bu cüz sizde. Okumayı bitirdiyseniz işaretleyin; okuyamayacaksanız başkası alabilsin diye bırakın.
        </Txt>
        <View style={{ gap: 8, marginTop: 18 }}>
          <Button label="Okudum" onPress={() => juzSheet && act.mutate({ type: 'read', juz: juzSheet }, { onSettled: () => setJuzSheet(null) })} />
          <Button kind="secondary" label="Cüzü bırak" onPress={() => juzSheet && act.mutate({ type: 'release', juz: juzSheet }, { onSettled: () => setJuzSheet(null) })} />
        </View>
      </Sheet>

      <Sheet visible={menu} onClose={() => setMenu(false)} title="Hatim seçenekleri">
        <Group>
          {h.isOwner ? (
            <Row
              icon="refresh"
              title="Davet kodunu yenile"
              subtitle="Eski kod artık çalışmaz"
              onPress={() => act.mutate({ type: 'rotate' }, { onSettled: () => setMenu(false) })}
            />
          ) : null}
          {h.isOwner && allRead ? <Row icon="history" title="Yeni tur başlat" onPress={() => act.mutate({ type: 'new-round' }, { onSettled: () => setMenu(false) })} /> : null}
          <Row
            icon="logout"
            title="Hatimden ayrıl"
            subtitle={h.isOwner ? 'Yöneticilik bir sonraki üyeye geçer' : undefined}
            danger
            last={!h.isOwner}
            onPress={() => leave.mutate('leave', { onSuccess: () => router.replace('/kuran') })}
          />
          {h.isOwner ? <Row icon="trash" title="Hatmi sil" subtitle="Herkes için kaldırılır" danger last onPress={() => leave.mutate('delete', { onSuccess: () => router.replace('/kuran') })} /> : null}
        </Group>
        {leave.error ? (
          <View style={{ marginTop: 10 }}>
            <Notice icon="alert" title="Yapılamadı" body={errorMessage(leave.error)} />
          </View>
        ) : null}
        <Touch onPress={() => setMenu(false)} accessibilityRole="button" style={{ minHeight: 48, alignItems: 'center', justifyContent: 'center', marginTop: 6 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Icon name="close" size={16} color={c.text2} />
            <Txt v="callout" tone="secondary">
              Kapat
            </Txt>
          </View>
        </Touch>
      </Sheet>
    </Screen>
  );
}

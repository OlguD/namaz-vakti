import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useMemo, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { errorMessage } from '@/api/errors';
import { useSession } from '@/auth/session';
import { deleteMessageRest, reportMessage, resendVerification, saveDisplayName, useBlock, useRooms } from '@/features/chat/api';
import { Bubble, bubbleColors, DaySeparator, useAvatarColors } from '@/features/chat/Bubble';
import { avatarSlot, buildRows, clockOf, cooldownLeft, muteLeftLabel, type Row } from '@/features/chat/messages';
import { ReportSheet, RulesSheet } from '@/features/chat/sheets';
import { MAX_MESSAGE_LENGTH, type ChatMessage } from '@/features/chat/types';
import { useChatRoom } from '@/features/chat/useChatRoom';
import { useNow } from '@/features/prayer/api';
import { useTheme } from '@/theme/theme';
import { fonts } from '@/theme/tokens';
import { Button, Field, Girih, Icon, IconButton, Skeleton, Touch, Txt, webBlur } from '@/ui';

export default function ChatRoomScreen() {
  const { roomId = 'genel' } = useLocalSearchParams<{ roomId: string }>();
  const { c, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const rooms = useRooms();
  const room = rooms.data?.find((r) => r.id === roomId);
  const me = useSession((s) => s.user);
  const [draft, setDraft] = useState('');
  const chat = useChatRoom(roomId, room, { onRestoreDraft: (t) => setDraft((d) => d || t) });
  const now = useNow(1000);
  const [menuFor, setMenuFor] = useState<ChatMessage | null>(null);
  const [reportFor, setReportFor] = useState<ChatMessage | null>(null);
  const [rulesOpen, setRulesOpen] = useState(false);
  const block = useBlock();
  const listRef = useRef<FlatList<Row>>(null);

  const arabicRoom = room?.language === 'ar';
  const rows = useMemo(() => buildRows(chat.messages, me?.id, now).reverse(), [chat.messages, me?.id, now]);
  const cooldown = cooldownLeft(chat.cooldownUntil, now.getTime());
  const offline = chat.connection === 'offline';
  const blocker = chat.blocker;
  const muteLeft = blocker?.kind === 'muted' ? muteLeftLabel(blocker.until, now) : null;
  const muted = blocker?.kind === 'muted' && (muteLeft !== null || !blocker.until);
  const guest = blocker?.kind === 'guest';
  const headerH = insets.top + 12 + 44 + 10;

  const send = useCallback(() => {
    const text = draft.trim();
    if (!text || cooldown > 0) return;
    chat.send(text.slice(0, MAX_MESSAGE_LENGTH));
    setDraft('');
  }, [chat, cooldown, draft]);

  const status = offline
    ? 'Bağlantı yok'
    : chat.connection === 'connecting'
      ? 'Bağlanıyor…'
      : room?.slowModeSeconds
        ? `Bağlı · Yavaş mod ${room.slowModeSeconds} sn`
        : 'Bağlı';

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <LinearGradient
        colors={isDark ? ['#05070D', '#0B1224', c.bg] : ['#9CC4E4', '#D6E7F2', c.bg]}
        locations={[0, 0.45, 1]}
        style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 300 }}
      />
      <Girih width="100%" height={852} tile={96} opacity={isDark ? 0.025 : 0.035} fade={false} />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* Header */}
        <View
          style={[
            {
              paddingTop: insets.top + 12,
              paddingBottom: 10,
              paddingHorizontal: 16,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              borderBottomWidth: 1,
              borderBottomColor: c.hair,
              backgroundColor: isDark ? 'rgba(11,15,23,0.72)' : 'rgba(246,241,231,0.82)',
              zIndex: 2,
            },
            webBlur,
          ]}
        >
          <IconButton icon="back" label="Odalara dön" onPress={() => (router.canGoBack() ? router.back() : router.replace('/sohbet'))} />
          <View style={{ flex: 1, gap: 1 }}>
            <Txt
              v="title"
              accessibilityRole="header"
              numberOfLines={1}
              style={arabicRoom ? { fontFamily: fonts.arabic, fontSize: 24, lineHeight: 32, textAlign: 'left' } : { fontSize: 22, lineHeight: 27 }}
            >
              {room?.name ?? ''}
            </Txt>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }} accessibilityLiveRegion="polite">
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: offline ? c.text2 : chat.connection === 'online' ? c.sage : c.goldText }} />
              <Txt v="small" tone="secondary" tnum>
                {status}
              </Txt>
            </View>
          </View>
          <IconButton icon="shield" label="Topluluk kuralları" onPress={() => setRulesOpen(true)} />
        </View>

        {/* Floating banners */}
        {muted || offline ? (
          <View style={{ position: 'absolute', left: 12, right: 12, top: headerH + 9, zIndex: 3 }}>
            {muted ? (
              <Banner icon="bellOff" title={`Bu odada susturuldunuz${muteLeft ? ` · ${muteLeft}` : ''}`} body="Topluluk kurallarına uymayan mesajlar nedeniyle. Mesajları okumaya devam edebilirsiniz." action={{ label: 'Kurallar', onPress: () => setRulesOpen(true) }} />
            ) : (
              <Banner icon="offline" title="Çevrimdışı — yeni mesajlar şu an gelmiyor" />
            )}
          </View>
        ) : null}

        {/* Messages (inverted: newest at the bottom, older pages load on scroll up) */}
        {!chat.loaded && chat.messages.length === 0 ? (
          <LoadingBubbles />
        ) : chat.messages.length === 0 ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 36 }}>
            <Icon name="chat" size={40} color={c.goldText} strokeWidth={1.2} />
            <Txt v="title" center style={{ fontSize: 22, lineHeight: 28 }}>
              Bu odada henüz mesaj yok
            </Txt>
            <Txt v="body" tone="sub" center style={{ fontSize: 14, lineHeight: 21 }}>
              Bir selamla sohbeti siz başlatın.
            </Txt>
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={rows}
            inverted
            keyExtractor={(r) => r.key}
            accessibilityLabel="Mesajlar"
            contentContainerStyle={{ paddingHorizontal: 12, paddingTop: 12, paddingBottom: muted ? 96 : offline ? 62 : 4, maxWidth: 680, width: '100%', alignSelf: 'center' }}
            keyboardShouldPersistTaps="handled"
            onEndReached={() => void chat.loadOlder()}
            onEndReachedThreshold={0.3}
            ListFooterComponent={chat.loadingOlder ? <LoadingOlder /> : undefined}
            renderItem={({ item }) =>
              item.kind === 'day' ? (
                <DaySeparator label={item.label.toLocaleUpperCase('tr')} />
              ) : (
                <Bubble
                  msg={item.msg}
                  own={item.own}
                  joinPrev={item.joinPrev}
                  joinNext={item.joinNext}
                  onShowRules={() => setRulesOpen(true)}
                  onPress={(m) => {
                    if (m.status === 'failed' || m.status === 'queued') {
                      if (m.status === 'failed') chat.retry(m);
                      else setMenuFor(m);
                    } else setMenuFor(m);
                  }}
                />
              )
            }
          />
        )}

        {/* Composer */}
        <View style={[{ paddingTop: guest ? 12 : 8, paddingHorizontal: 12, paddingBottom: Math.max(insets.bottom, 12) + 8, borderTopWidth: 1, borderTopColor: c.hair, backgroundColor: isDark ? 'rgba(11,15,23,0.82)' : 'rgba(246,241,231,0.9)' }, webBlur]}>
          <View style={{ maxWidth: 680, width: '100%', alignSelf: 'center' }}>
            <ComposerArea
              guest={guest}
              blocker={blocker?.kind ?? null}
              muted={muted}
              cooldown={cooldown}
              offline={offline}
              arabic={arabicRoom}
              draft={draft}
              setDraft={setDraft}
              onSend={send}
              onLogin={() => router.push({ pathname: '/giris', params: { next: `/sohbet/${roomId}` } })}
              onRefreshAccount={chat.refreshAccount}
            />
          </View>
        </View>
      </KeyboardAvoidingView>

      <MessageMenu
        msg={menuFor}
        own={!!menuFor && menuFor.author.id === me?.id}
        onClose={() => setMenuFor(null)}
        onReport={(m) => {
          setMenuFor(null);
          setTimeout(() => setReportFor(m), 250);
        }}
        onBlock={async (m) => {
          setMenuFor(null);
          try {
            await block.mutateAsync(m.author.id);
            chat.hideAuthor(m.author.id);
          } catch {
            // the sheet-less path: nothing to show besides keeping messages
          }
        }}
        onDelete={async (m) => {
          setMenuFor(null);
          if (m.status !== 'sent') {
            chat.discard(m);
            return;
          }
          chat.removeLocal(m.id);
          await deleteMessageRest(m.id).catch(() => undefined);
        }}
        onRetry={(m) => {
          setMenuFor(null);
          chat.retry(m);
        }}
      />
      <ReportSheet
        message={reportFor}
        onClose={() => setReportFor(null)}
        onSubmit={async (reason, note, alsoBlock) => {
          if (!reportFor) return;
          await reportMessage(reportFor.id, reason, note);
          if (alsoBlock) {
            await block.mutateAsync(reportFor.author.id);
            chat.hideAuthor(reportFor.author.id);
          }
        }}
      />
      <RulesSheet visible={rulesOpen} onClose={() => setRulesOpen(false)} />
    </View>
  );
}

function Banner({ icon, title, body, action }: { icon: 'bellOff' | 'offline'; title: string; body?: string; action?: { label: string; onPress: () => void } }) {
  const { c, isDark } = useTheme();
  return (
    <View
      accessibilityRole="alert"
      style={{
        flexDirection: 'row',
        gap: 12,
        alignItems: body ? 'flex-start' : 'center',
        paddingVertical: body ? 12 : 10,
        paddingHorizontal: 14,
        borderRadius: body ? 18 : 14,
        backgroundColor: isDark ? 'rgba(40,30,26,0.94)' : 'rgba(255,246,238,0.97)',
        borderWidth: 1,
        borderColor: c.cautionLine,
        shadowColor: '#000',
        shadowOpacity: isDark ? 0.5 : 0.15,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: 10 },
      }}
    >
      <Icon name={icon} size={18} color={c.caution} strokeWidth={1.6} />
      <View style={{ flex: 1, gap: 3 }}>
        <Txt v={body ? 'bodyStrong' : 'sub'} tnum style={body ? { fontSize: 14 } : undefined}>
          {title}
        </Txt>
        {body ? (
          <Txt v="small" tone="sub" style={{ lineHeight: 17 }}>
            {body}{' '}
            {action ? (
              <Txt v="small" tone="gold" weight="semibold" onPress={action.onPress} accessibilityRole="link">
                {action.label}
              </Txt>
            ) : null}
          </Txt>
        ) : null}
      </View>
    </View>
  );
}

function ComposerArea({
  guest,
  blocker,
  muted,
  cooldown,
  offline,
  arabic,
  draft,
  setDraft,
  onSend,
  onLogin,
  onRefreshAccount,
}: {
  guest: boolean;
  blocker: string | null;
  muted: boolean;
  cooldown: number;
  offline: boolean;
  arabic: boolean;
  draft: string;
  setDraft: (s: string) => void;
  onSend: () => void;
  onLogin: () => void;
  onRefreshAccount: () => Promise<void>;
}) {
  const { c, isDark } = useTheme();
  const field = isDark ? 'rgba(255,255,255,0.06)' : '#FFFCF6';
  const fieldLine = isDark ? 'rgba(255,255,255,0.14)' : 'rgba(26,28,33,0.14)';

  if (guest) {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, paddingLeft: 16, borderRadius: 22, backgroundColor: c.goldTint, borderWidth: 1, borderColor: c.goldLine }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Txt v="bodyStrong" style={{ fontSize: 14 }}>
            Sohbete katılın
          </Txt>
          <Txt v="small" tone="sub" style={{ lineHeight: 17 }}>
            Misafir olarak okuyabilirsiniz; yazmak için giriş gerekir.
          </Txt>
        </View>
        <Button label="Giriş yap" compact onPress={onLogin} style={{ borderRadius: 14 }} />
      </View>
    );
  }
  if (blocker === 'verify') return <VerifyPrompt onDone={onRefreshAccount} />;
  if (blocker === 'name') return <NamePrompt onDone={onRefreshAccount} />;
  if (blocker === 'banned') {
    return (
      <View style={{ minHeight: 48, borderRadius: 24, backgroundColor: field, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 }}>
        <Txt v="sub" tone="secondary" center>
          Hesabınız sohbet kurallarını ihlal ettiği için kapatıldı.
        </Txt>
      </View>
    );
  }
  if (muted) {
    return (
      <View style={{ flexDirection: 'row', minHeight: 48, borderRadius: 24, backgroundColor: field, alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        <Icon name="lock" size={16} color={c.text2} />
        <Txt v="sub" tone="secondary" style={{ fontSize: 14 }}>
          Susturulduğunuz için şu an yazamazsınız
        </Txt>
      </View>
    );
  }
  const hasText = draft.trim().length > 0;
  const waiting = cooldown > 0;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      {waiting ? (
        <View
          accessibilityLiveRegion="polite"
          style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48, paddingHorizontal: 16, borderRadius: 24, backgroundColor: field, borderWidth: 1, borderStyle: 'dashed', borderColor: fieldLine }}
        >
          <Icon name="clock" size={18} color={c.text2} />
          <Txt v="sub" tone="secondary" tnum style={{ fontSize: 14 }}>
            {cooldown} sn sonra yazabilirsin
          </Txt>
        </View>
      ) : (
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', minHeight: 48, paddingHorizontal: 16, borderRadius: 24, backgroundColor: field, borderWidth: 1, borderColor: fieldLine }}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            accessibilityLabel="Mesaj"
            placeholder={offline ? 'Bağlantı gelince gönderilir' : arabic ? 'اكتب رسالة…' : 'Mesaj yaz…'}
            placeholderTextColor={c.text3}
            maxLength={MAX_MESSAGE_LENGTH}
            multiline
            numberOfLines={1}
            onSubmitEditing={onSend}
            blurOnSubmit={false}
            onKeyPress={(e) => {
              // Web: Enter sends, Shift+Enter adds a line.
              const ne = e.nativeEvent as unknown as { key: string; shiftKey?: boolean };
              if (Platform.OS === 'web' && ne.key === 'Enter' && !ne.shiftKey) {
                (e as unknown as { preventDefault: () => void }).preventDefault();
                onSend();
              }
            }}
            style={{
              flex: 1,
              minHeight: 46,
              maxHeight: 120,
              paddingVertical: 12,
              color: c.text,
              fontFamily: arabic && !draft ? fonts.arabic : fonts.regular,
              fontSize: 16,
              textAlign: arabic ? 'right' : 'left',
              ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : {}),
            }}
          />
        </View>
      )}
      <Touch
        accessibilityRole="button"
        accessibilityLabel="Gönder"
        disabled={!hasText || waiting}
        onPress={onSend}
        style={{
          width: 48,
          height: 48,
          borderRadius: 24,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: hasText && !waiting ? '#C9A96E' : c.glass,
          borderWidth: 1,
          borderColor: hasText && !waiting ? 'transparent' : c.stroke,
        }}
      >
        <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={hasText && !waiting ? '#1A1408' : c.text2} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <Path d="M12 19V5M6 11l6-6 6 6" />
        </Svg>
      </Touch>
    </View>
  );
}

function VerifyPrompt({ onDone }: { onDone: () => Promise<void> }) {
  const { c } = useTheme();
  const [state, setState] = useState<'idle' | 'sent' | 'checking'>('idle');
  const [err, setErr] = useState<string | null>(null);
  return (
    <View style={{ gap: 10, padding: 12, paddingLeft: 16, borderRadius: 22, backgroundColor: c.goldTint, borderWidth: 1, borderColor: c.goldLine }}>
      <View style={{ gap: 2 }}>
        <Txt v="bodyStrong" style={{ fontSize: 14 }}>
          E-posta adresinizi doğrulayın
        </Txt>
        <Txt v="small" tone="sub" style={{ lineHeight: 17 }}>
          {state === 'sent' ? 'Doğrulama bağlantısını gönderdik. Doğruladıktan sonra “Doğruladım”a dokunun.' : 'Sohbette yazmak için e-posta adresinizin doğrulanmış olması gerekir.'}
        </Txt>
        {err ? (
          <Txt v="small" tone="caution">
            {err}
          </Txt>
        ) : null}
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Button
          label="Bağlantıyı gönder"
          kind="secondary"
          compact
          style={{ flex: 1 }}
          onPress={async () => {
            setErr(null);
            try {
              await resendVerification();
              setState('sent');
            } catch (e) {
              setErr(errorMessage(e));
            }
          }}
        />
        <Button
          label="Doğruladım"
          compact
          style={{ flex: 1 }}
          loading={state === 'checking'}
          onPress={async () => {
            setState('checking');
            await onDone();
            setState('sent');
          }}
        />
      </View>
    </View>
  );
}

function NamePrompt({ onDone }: { onDone: () => Promise<void> }) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const valid = name.trim().length >= 3 && name.trim().length <= 24;
  return (
    <View style={{ gap: 10 }}>
      <Field label="Sohbette görünecek adınız" value={name} onChangeText={setName} placeholder="Örn. Ahmet K." maxLength={24} error={err} hint="3–24 karakter. Herkes bu adı görür." autoCapitalize="words" />
      <Button
        label="Kaydet ve sohbete katıl"
        compact
        disabled={!valid}
        loading={busy}
        onPress={async () => {
          setBusy(true);
          setErr(null);
          try {
            await saveDisplayName(name);
            await onDone();
          } catch (e) {
            setErr(errorMessage(e));
          } finally {
            setBusy(false);
          }
        }}
      />
    </View>
  );
}

function MessageMenu({
  msg,
  own,
  onClose,
  onReport,
  onBlock,
  onDelete,
  onRetry,
}: {
  msg: ChatMessage | null;
  own: boolean;
  onClose: () => void;
  onReport: (m: ChatMessage) => void;
  onBlock: (m: ChatMessage) => void;
  onDelete: (m: ChatMessage) => void;
  onRetry: (m: ChatMessage) => void;
}) {
  const { c, isDark } = useTheme();
  const avatars = useAvatarColors();
  const { bubble } = bubbleColors(isDark);
  if (!msg) return null;
  type Item = { label: string; icon: 'flag' | 'block' | 'trash' | 'refresh'; color: string; act: () => void };
  const items: Item[] = own
    ? [
        ...(msg.status === 'queued' || msg.status === 'failed' ? [{ label: 'Tekrar gönder', icon: 'refresh' as const, color: c.text, act: () => onRetry(msg) }] : []),
        { label: msg.status === 'sent' ? 'Sil' : 'Vazgeç', icon: 'trash', color: c.caution, act: () => onDelete(msg) },
      ]
    : [
        { label: 'Bildir', icon: 'flag', color: c.text, act: () => onReport(msg) },
        { label: 'Kullanıcıyı engelle', icon: 'block', color: c.caution, act: () => onBlock(msg) },
      ];
  const nameColor = avatars[avatarSlot(msg.author.id)]![1];
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable accessibilityRole="button" accessibilityLabel="Menüyü kapat" onPress={onClose} style={[StyleSheet.absoluteFill, { backgroundColor: c.scrim }, webBlur]} />
      <View pointerEvents="box-none" style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 16 }}>
        <View pointerEvents="box-none" style={{ alignItems: own ? 'flex-end' : 'flex-start', gap: 10, maxWidth: 560, width: '100%', alignSelf: 'center' }}>
          <View
            style={{
              maxWidth: 280,
              gap: 3,
              paddingTop: 8,
              paddingBottom: 7,
              paddingHorizontal: 12,
              borderRadius: 18,
              backgroundColor: own ? '#C9A96E' : bubble,
              borderWidth: 1,
              borderColor: own ? 'transparent' : c.stroke,
              transform: [{ scale: 1.03 }],
              shadowColor: '#000',
              shadowOpacity: 0.5,
              shadowRadius: 20,
              shadowOffset: { width: 0, height: 16 },
            }}
          >
            {!own ? (
              <Txt v="small" color={nameColor} weight="semibold">
                {msg.author.displayName}
              </Txt>
            ) : null}
            <Txt v="body" color={own ? '#1A1408' : c.text} numberOfLines={6}>
              {msg.body}
            </Txt>
            <Txt v="small" color={own ? 'rgba(26,20,8,0.72)' : c.text2} tnum style={{ alignSelf: 'flex-end', fontSize: 10.5 }}>
              {msg.status === 'sent' ? clockOf(msg.createdAt) : 'Şimdi'}
            </Txt>
          </View>
          <View
            accessibilityRole="menu"
            accessibilityLabel="Mesaj seçenekleri"
            style={{ width: 248, padding: 6, borderRadius: 20, backgroundColor: isDark ? '#1A2233' : '#FFFCF6', borderWidth: 1, borderColor: c.stroke, shadowColor: '#000', shadowOpacity: 0.45, shadowRadius: 24, shadowOffset: { width: 0, height: 16 } }}
          >
            {items.map((it, i) => (
              <Touch
                key={it.label}
                accessibilityRole="menuitem"
                onPress={it.act}
                style={{ minHeight: 48, paddingHorizontal: 12, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: i ? 1 : 0, borderTopColor: c.hair }}
              >
                <Txt v="callout" color={it.color}>
                  {it.label}
                </Txt>
                <Icon name={it.icon} size={18} color={it.color} />
              </Touch>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

function LoadingOlder() {
  const { c } = useTheme();
  return (
    <View accessibilityRole="progressbar" accessibilityLabel="Eski mesajlar yükleniyor">
      <View style={{ alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4, marginBottom: 6, height: 32, paddingHorizontal: 12, borderRadius: 16, backgroundColor: c.glass, borderWidth: 1, borderColor: c.stroke }}>
        <Icon name="refresh" size={14} color={c.text2} />
        <Txt v="small" tone="secondary">
          Eski mesajlar yükleniyor
        </Txt>
      </View>
      <View aria-hidden style={{ gap: 10, marginVertical: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
          <Skeleton width={32} height={32} r={16} />
          <Skeleton width={200} height={44} r={18} />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
          <Skeleton width={32} height={32} r={16} />
          <Skeleton width={150} height={36} r={18} />
        </View>
      </View>
    </View>
  );
}

function LoadingBubbles() {
  return (
    <View accessibilityLabel="Mesajlar yükleniyor" style={{ flex: 1, justifyContent: 'flex-end', padding: 12, gap: 12 }}>
      {[200, 150, 230, 120].map((w, i) => (
        <View key={i} style={{ flexDirection: i === 2 ? 'row-reverse' : 'row', alignItems: 'flex-end', gap: 8 }}>
          {i === 2 ? null : <Skeleton width={32} height={32} r={16} />}
          <Skeleton width={w} height={i % 2 ? 36 : 44} r={18} />
        </View>
      ))}
    </View>
  );
}

import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import { BackHandler, Linking, Platform, Share, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { useSettings, useUpdateSettings } from '@/features/settings/api';
import { useStreams, type LiveStream } from '@/features/live/api';
import { ChannelMono, EyeIcon, LivePill, StreamArt, ViewersPill } from '@/features/live/components';
import { compactCount, isVideoId, liveSinceLabel, monogram, startsLabel } from '@/features/live/format';
import { YouTubePlayer } from '@/features/live/YouTubePlayer';
import { useOnline } from '@/features/live/useOnline';
import { useTheme } from '@/theme/theme';
import { Button, Glass, Header, IconButton, Screen, StateView, Toggle, Touch, Txt } from '@/ui';

const INK = '#F3EEE4';

export default function LivePlayerScreen() {
  const { videoId: raw } = useLocalSearchParams<{ videoId: string }>();
  const videoId = isVideoId(raw) ? raw : null;
  const { c } = useTheme();
  const router = useRouter();
  const streams = useStreams();
  const online = useOnline();
  const { width: winW } = useWindowDimensions();
  const [full, setFull] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const settings = useSettings();
  const update = useUpdateSettings();

  const stream = useMemo(() => streams.data?.find((s) => s.videoId === videoId) ?? null, [streams.data, videoId]);
  const related = useMemo(
    () => (streams.data ?? []).filter((s) => s.videoId !== videoId && (!stream || s.channel.category === stream.channel.category)).slice(0, 4),
    [streams.data, videoId, stream],
  );

  useEffect(() => {
    if (!full || Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setFull(false);
      return true;
    });
    return () => sub.remove();
  }, [full]);

  if (!videoId) {
    return (
      <Screen header={<Header />}>
        <StateView icon="alert" tone="caution" title="Yayın bulunamadı" body="Bağlantı geçersiz görünüyor." action={<Button label="Canlı yayınlara dön" kind="secondary" onPress={() => router.replace('/canli')} />} />
      </Screen>
    );
  }

  const title = stream?.title ?? 'Canlı yayın';
  const channel = stream?.channel.title ?? '';
  const isLive = stream ? stream.status === 'live' : true;
  const share = async () => {
    const url = stream?.watchUrl ?? `https://www.youtube.com/watch?v=${videoId}`;
    try {
      if (Platform.OS === 'web' && !(typeof navigator !== 'undefined' && 'share' in navigator)) {
        await Clipboard.setStringAsync(url);
        return;
      }
      await Share.share({ message: `${title} — ${url}`, url, title });
    } catch {
      // user cancelled
    }
  };

  const playerW = Math.min(winW, 560) - 32;
  const playerH = Math.round((playerW * 9) / 16);
  const playerBox = (
    <View
      accessibilityLabel="Video oynatıcı"
      style={{ height: playerH, borderRadius: 24, overflow: 'hidden', backgroundColor: '#05070D', borderWidth: 1, borderColor: c.hair, marginTop: 10 }}
    >
      {error || !online ? (
        <PlayerError
          offline={!online}
          onRetry={() => {
            setError(null);
            setAttempt((a) => a + 1);
          }}
        />
      ) : (
        <>
          <YouTubePlayer key={attempt} videoId={videoId} width={playerW} height={playerH} title={title} onError={(e) => setError(e)} />
          {isLive ? (
            <View pointerEvents="none" style={{ position: 'absolute', left: 12, top: 12 }}>
              <LivePill small />
            </View>
          ) : null}
        </>
      )}
    </View>
  );

  if (full) {
    return (
      <FullScreen
        stream={stream}
        videoId={videoId}
        title={title}
        channel={channel}
        attempt={attempt}
        onExit={() => setFull(false)}
        onError={setError}
        onRetry={() => {
          setError(null);
          setAttempt((a) => a + 1);
        }}
        error={error}
      />
    );
  }

  const haramain = stream?.channel.category === 'haramain';
  return (
    <Screen
      sky="aksam"
      header={
        <Header
          right={<IconButton icon="share" label="Paylaş" onPress={() => void share()} />}
        />
      }
      contentStyle={{ paddingHorizontal: 16 }}
    >
      {playerBox}

      <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
        <Touch
          accessibilityRole="button"
          accessibilityLabel="Tam ekran"
          onPress={() => setFull(true)}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 40, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, borderColor: c.stroke, backgroundColor: c.glass }}
        >
          <ExpandIcon color={c.text} />
          <Txt v="subStrong">Tam ekran</Txt>
        </Touch>
        <Touch
          accessibilityRole="link"
          accessibilityLabel="YouTube’da aç"
          onPress={() => void Linking.openURL(stream?.watchUrl ?? `https://www.youtube.com/watch?v=${videoId}`)}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 40, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, borderColor: c.stroke, backgroundColor: c.glass }}
        >
          <Txt v="subStrong">YouTube’da aç</Txt>
        </Touch>
      </View>

      <Txt v="title" accessibilityRole="header" style={{ marginTop: 16, marginHorizontal: 4 }}>
        {title}
      </Txt>
      {stream ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10, marginHorizontal: 4 }}>
          <ChannelMono text={monogram(stream.channel.title)} live={isLive} size={36} />
          <View style={{ flex: 1, gap: 1 }}>
            <Txt v="bodyStrong" style={{ fontSize: 14 }}>
              {channel}
            </Txt>
            <Txt v="small" tone="secondary">
              {isLive ? liveSinceLabel(stream.actualStartAt) : startsLabel(stream.scheduledStartAt)}
            </Txt>
          </View>
          {compactCount(stream.concurrentViewers) ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }} accessible accessibilityLabel={`${compactCount(stream.concurrentViewers)} kişi izliyor`}>
              <EyeIcon color={c.sub} />
              <Txt v="sub" tone="sub" tnum>
                {compactCount(stream.concurrentViewers)}
              </Txt>
            </View>
          ) : null}
        </View>
      ) : null}

      {haramain ? (
        <Glass radius={20} style={{ marginTop: 14, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingLeft: 16, paddingRight: 12 }}>
          <View style={{ flex: 1, gap: 2 }}>
            <Txt v="callout">Yayın başladığında bildir</Txt>
            <Txt v="small" tone="secondary">
              Harameyn yayınları canlıya geçtiğinde sessiz bildirim
            </Txt>
          </View>
          <Toggle
            label="Yayın başladığında bildir"
            value={settings.reminders.haramainLive}
            onChange={(v) => update.mutate((s) => ({ ...s, reminders: { ...s.reminders, haramainLive: v } }))}
          />
        </Glass>
      ) : null}

      {related.length > 0 ? (
        <>
          <Txt v="titleSm" accessibilityRole="header" style={{ marginTop: 22, marginHorizontal: 4 }}>
            {haramain ? 'Harameyn’den diğer yayınlar' : 'Diğer yayınlar'}
          </Txt>
          <View style={{ marginTop: 10, borderRadius: 22, backgroundColor: c.raised, borderWidth: 1, borderColor: c.hair, paddingVertical: 4, paddingLeft: 12, paddingRight: 8 }}>
            {related.map((r, i) => (
              <Touch
                key={r.videoId}
                accessibilityRole="button"
                accessibilityLabel={`${r.status === 'live' ? 'Canlı: ' : ''}${r.title}. İzle`}
                onPress={() => router.replace({ pathname: '/yayin/[videoId]', params: { videoId: r.videoId } })}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 72, borderTopWidth: i ? 1 : 0, borderTopColor: c.hair }}
              >
                <StreamArt stream={r} style={{ width: 64, height: 44, borderRadius: 12 }} />
                <View style={{ flex: 1, gap: 3 }}>
                  <Txt v="callout" numberOfLines={1}>
                    {r.title}
                  </Txt>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: c.gold, opacity: r.status === 'live' ? 1 : 0 }} />
                    <Txt v="small" color={r.status === 'live' ? c.goldText : c.text2} weight={r.status === 'live' ? 'semibold' : 'regular'} tnum numberOfLines={1}>
                      {r.status === 'live' ? `Canlı${compactCount(r.concurrentViewers) ? ` · ${compactCount(r.concurrentViewers)} izliyor` : ''}` : startsLabel(r.scheduledStartAt)}
                    </Txt>
                  </View>
                </View>
                <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={c.text3} strokeWidth={1.5} strokeLinecap="round" aria-hidden>
                  <Path d="m9 6 6 6-6 6" />
                </Svg>
              </Touch>
            ))}
          </View>
        </>
      ) : null}
    </Screen>
  );
}

function PlayerError({ onRetry, offline }: { onRetry: () => void; offline?: boolean }) {
  return (
    <View accessibilityRole="alert" style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 24, backgroundColor: '#0B1224' }]}>
      <Svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke="#D9A37A" strokeWidth={1.6} strokeLinecap="round" aria-hidden>
        <Path d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7.5v5.5M12 16.5v.01" />
      </Svg>
      <Txt v="bodyStrong" color={INK} center>
        {offline ? 'Bağlantı bekleniyor' : 'Yayın şu anda kullanılamıyor'}
      </Txt>
      <Txt v="small" color="rgba(243,238,228,0.75)" center>
        {offline ? 'Yayını izlemek için internet bağlantısı gerekli.' : 'Kanal yayını durdurmuş ya da bölgenizde kısıtlamış olabilir.'}
      </Txt>
      <Touch
        accessibilityRole="button"
        onPress={onRetry}
        style={{ marginTop: 6, minHeight: 40, paddingHorizontal: 16, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', backgroundColor: 'rgba(255,255,255,0.08)', justifyContent: 'center' }}
      >
        <Txt v="subStrong" color={INK}>
          Tekrar dene
        </Txt>
      </Touch>
    </View>
  );
}

function ExpandIcon({ color, collapse }: { color: string; collapse?: boolean }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <Path d={collapse ? 'M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5' : 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5'} />
    </Svg>
  );
}

/** Immersive view (design: LiveLandscape). Rotating the device fills the screen. */
function FullScreen({
  stream,
  videoId,
  title,
  channel,
  attempt,
  onExit,
  onError,
  onRetry,
  error,
}: {
  stream: LiveStream | null;
  videoId: string;
  title: string;
  channel: string;
  attempt: number;
  onExit: () => void;
  onError: (e: string) => void;
  onRetry: () => void;
  error: string | null;
}) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const landscape = width > height;
  const bar = landscape ? 0 : 72;
  const pw = width;
  const ph = Math.min(height - (landscape ? 0 : bar * 2 + insets.top), Math.round((width * 9) / 16));
  const sidePad = landscape ? Math.max(insets.left, insets.right, 24) + 16 : 16;
  return (
    <View style={{ flex: 1, backgroundColor: '#05070D' }}>
      <StatusBar hidden style="light" />
      {stream ? <StreamArt stream={stream} stars style={StyleSheet.absoluteFill} /> : null}
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        {error ? (
          <View style={{ width: pw, height: ph }}>
            <PlayerError onRetry={onRetry} />
          </View>
        ) : (
          <YouTubePlayer key={attempt} videoId={videoId} width={pw} height={ph} title={title} onError={onError} />
        )}
      </View>
      <View style={{ position: 'absolute', left: sidePad, right: sidePad, top: Math.max(insets.top, 20), flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <Touch
          accessibilityRole="button"
          accessibilityLabel="Tam ekrandan çık"
          onPress={onExit}
          style={{ width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)', backgroundColor: 'rgba(11,15,23,0.45)', alignItems: 'center', justifyContent: 'center' }}
        >
          <ExpandIcon color={INK} collapse />
        </Touch>
        <View style={{ flex: 1, gap: 2 }}>
          <Txt v="titleSm" color={INK} numberOfLines={1}>
            {title}
          </Txt>
          {channel ? (
            <Txt v="small" color="rgba(243,238,228,0.78)" numberOfLines={1}>
              {channel}
            </Txt>
          ) : null}
        </View>
        {stream?.status === 'live' ? <LivePill /> : null}
        {landscape && stream ? <ViewersPill count={stream.concurrentViewers} /> : null}
      </View>
    </View>
  );
}

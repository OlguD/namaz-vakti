import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '@/theme/theme';
import { fonts } from '@/theme/tokens';
import { Touch, Txt } from '@/ui';
import { avatarSlot, clockOf, initials, isArabicText } from './messages';
import type { ChatMessage } from './types';

export function useAvatarColors(): [string, string][] {
  const { isDark } = useTheme();
  return isDark
    ? [
        ['rgba(201,169,110,0.18)', '#E3CFA4'],
        ['rgba(157,184,156,0.18)', '#9DB89C'],
        ['rgba(62,101,133,0.40)', '#CFE3F1'],
      ]
    : [
        ['rgba(201,169,110,0.24)', '#84652C'],
        ['rgba(94,125,98,0.16)', '#5E7D62'],
        ['rgba(62,101,133,0.16)', '#1F3A57'],
      ];
}

const CHECK = 'm5 12.5 4.5 4.5L19 7.5';
const CLOCK = 'M12 7.5V12l3 2M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z';
const WARN = 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7.5v5.5M12 16.5v.01';

function StatusIcon({ d, color }: { d: string; color: string }) {
  return (
    <Svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <Path d={d} />
    </Svg>
  );
}

export function bubbleColors(isDark: boolean) {
  return isDark
    ? { bubble: '#161D2C', bubbleLine: 'rgba(255,255,255,0.06)' }
    : { bubble: '#FFFCF6', bubbleLine: 'rgba(26,28,33,0.05)' };
}

/** One chat bubble (design: ChatRoom). Tapping opens the message menu. */
export function Bubble({
  msg,
  own,
  joinPrev,
  joinNext,
  onPress,
  onShowRules,
}: {
  msg: ChatMessage;
  own: boolean;
  joinPrev: boolean;
  joinNext: boolean;
  onPress: (m: ChatMessage) => void;
  onShowRules: () => void;
}) {
  const { c, isDark } = useTheme();
  const av = useAvatarColors()[avatarSlot(msg.author.id)]!;
  const ar = isArabicText(msg.body);
  const time = msg.status === 'sent' ? clockOf(msg.createdAt) : 'Şimdi';
  const textStyle = ar
    ? { fontFamily: fonts.arabic, fontSize: 19, lineHeight: 30, writingDirection: 'rtl' as const, textAlign: 'right' as const }
    : { fontSize: 15, lineHeight: 21 };
  const { bubble, bubbleLine } = bubbleColors(isDark);

  if (own) {
    const bad = msg.status === 'rejected' || msg.status === 'failed';
    const pend = msg.status === 'sending' || msg.status === 'queued';
    const meta = bad ? c.caution : 'rgba(26,20,8,0.72)';
    const status = bad ? 'gönderilemedi' : pend ? (msg.status === 'queued' ? 'bağlantı bekliyor' : 'gönderiliyor') : 'gönderildi';
    return (
      <View style={{ alignItems: 'flex-end', gap: 4, marginTop: joinPrev ? 3 : 12 }}>
        <Touch
          onPress={() => onPress(msg)}
          accessibilityRole="button"
          accessibilityHint="Seçenekler için dokunun"
          accessibilityLabel={`Sizin mesajınız, ${time}, ${status}: ${msg.body}`}
          style={{ maxWidth: '80%' }}
        >
          <View
            style={{
              gap: 3,
              paddingTop: 8,
              paddingBottom: 7,
              paddingHorizontal: 12,
              borderTopLeftRadius: 18,
              borderBottomLeftRadius: 18,
              borderTopRightRadius: joinPrev ? 6 : 18,
              borderBottomRightRadius: 6,
              backgroundColor: bad ? 'transparent' : '#C9A96E',
              borderWidth: 1,
              borderStyle: bad ? 'dashed' : 'solid',
              borderColor: bad ? c.caution : 'transparent',
              opacity: bad ? 0.75 : pend ? 0.7 : 1,
            }}
          >
            <Txt v="body" color={bad ? c.text : '#1A1408'} style={textStyle} lang={ar ? 'ar' : undefined}>
              {msg.body}
            </Txt>
            <View style={{ alignSelf: 'flex-end', flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Txt v="small" color={meta} tnum style={{ fontSize: 10.5, lineHeight: 13 }}>
                {time}
              </Txt>
              <StatusIcon d={bad ? WARN : pend ? CLOCK : CHECK} color={meta} />
            </View>
          </View>
        </Touch>
        {msg.status === 'rejected' ? (
          <View accessibilityRole="alert" style={{ flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: 300, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <StatusIcon d={WARN} color={c.caution} />
            <Txt v="small" color={c.caution} style={{ lineHeight: 16 }}>
              {msg.error ?? 'Mesajın topluluk kurallarına uymuyor'} ·{' '}
            </Txt>
            <Touch accessibilityRole="link" onPress={onShowRules} hitSlop={10}>
              <Txt v="small" color={c.caution} weight="semibold" style={{ textDecorationLine: 'underline' }}>
                Neden?
              </Txt>
            </Touch>
          </View>
        ) : msg.status === 'failed' ? (
          <Txt v="small" tone="caution">
            {msg.error ?? 'Gönderilemedi'}
          </Txt>
        ) : msg.status === 'queued' ? (
          <Txt v="small" tone="secondary">
            Bağlantı gelince gönderilecek
          </Txt>
        ) : null}
      </View>
    );
  }

  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginTop: joinPrev ? 3 : 12 }}>
      <View aria-hidden style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: av[0], alignItems: 'center', justifyContent: 'center', opacity: joinNext ? 0 : 1 }}>
        <Txt v="small" color={av[1]} weight="semibold" style={isArabicText(msg.author.displayName) ? { fontFamily: fonts.arabicBold, fontSize: 14 } : { fontSize: 12 }}>
          {initials(msg.author.displayName)}
        </Txt>
      </View>
      <Touch
        onPress={() => onPress(msg)}
        accessibilityRole="button"
        accessibilityHint="Seçenekler için dokunun"
        accessibilityLabel={`${msg.author.displayName}, ${time}: ${msg.body}`}
        style={{ maxWidth: '78%' }}
      >
        <View
          style={{
            gap: 3,
            paddingTop: 8,
            paddingBottom: 7,
            paddingHorizontal: 12,
            borderTopLeftRadius: joinPrev ? 6 : 6,
            borderBottomLeftRadius: joinPrev ? 6 : 18,
            borderTopRightRadius: 18,
            borderBottomRightRadius: 18,
            backgroundColor: bubble,
            borderWidth: 1,
            borderColor: bubbleLine,
            ...(isDark ? {} : { shadowColor: '#463719', shadowOpacity: 0.12, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } }),
          }}
        >
          {!joinPrev ? (
            <Txt v="small" color={av[1]} weight="semibold" style={isArabicText(msg.author.displayName) ? { fontFamily: fonts.arabicBold, fontSize: 14 } : { fontSize: 12 }}>
              {msg.author.displayName}
            </Txt>
          ) : null}
          <Txt v="body" style={textStyle} lang={ar ? 'ar' : undefined}>
            {msg.body}
          </Txt>
          <Txt v="small" tone="secondary" tnum style={{ alignSelf: 'flex-end', fontSize: 10.5, lineHeight: 13 }}>
            {time}
          </Txt>
        </View>
      </Touch>
    </View>
  );
}

export function DaySeparator({ label }: { label: string }) {
  const { c } = useTheme();
  return (
    <View accessibilityRole="header" accessibilityLabel={label} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 18, marginBottom: 8, marginHorizontal: 4 }}>
      <View style={{ flex: 1, height: 1, backgroundColor: c.hair }} />
      <Txt v="caption" tone="secondary" weight="semibold">
        {label}
      </Txt>
      <View style={{ flex: 1, height: 1, backgroundColor: c.hair }} />
    </View>
  );
}

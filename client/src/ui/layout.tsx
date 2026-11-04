import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, type ReactNode } from 'react';
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
  type ScrollViewProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Vakit } from '@/lib/prayer';
import { useTheme } from '@/theme/theme';
import { radius, space } from '@/theme/tokens';
import { Glass, IconButton, Touch } from './controls';
import { Girih, Rosette, SkyBackdrop } from './Decor';
import { Icon, type IconName } from './Icon';
import { Txt } from './Text';

/** Space the floating tab bar takes at the bottom (bar + margin). */
export const TAB_BAR_SPACE = 66 + 20 + 16;

export interface ScreenProps {
  children: ReactNode;
  /** Paint the vakit sky behind the screen (tab roots); otherwise a calm girih header. */
  sky?: Vakit;
  scroll?: boolean;
  /** Leave room for the floating tab bar. */
  tabs?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  contentStyle?: StyleProp<ViewStyle>;
  scrollProps?: ScrollViewProps;
  /** Rendered above the scroll view, pinned (e.g. a header). */
  header?: ReactNode;
  footer?: ReactNode;
  pattern?: boolean;
}

/**
 * Page shell. Handles safe areas, the background (sky or plain + girih),
 * the status bar style and pull-to-refresh. Content is centred and capped
 * at 560pt so the same screens read well on tablets and the web.
 */
export function Screen({
  children,
  sky,
  scroll = true,
  tabs,
  refreshing,
  onRefresh,
  contentStyle,
  scrollProps,
  header,
  footer,
  pattern = true,
}: ScreenProps) {
  const { c, isDark, sky: skyFor } = useTheme();
  const insets = useSafeAreaInsets();
  const s = sky ? skyFor(sky) : null;
  const lightText = s ? s.onDark : isDark;
  const pad: ViewStyle = {
    paddingTop: header ? 8 : insets.top + 14,
    paddingBottom: (tabs ? TAB_BAR_SPACE : 24) + insets.bottom,
    paddingHorizontal: space.gutter,
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
  };
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <StatusBar style={lightText ? 'light' : 'dark'} />
      {s ? <SkyBackdrop sky={s} /> : pattern ? <Girih width="100%" height={460} /> : null}
      {header ? <View style={{ paddingTop: insets.top + 8, paddingHorizontal: space.gutter, maxWidth: 560, width: '100%', alignSelf: 'center' }}>{header}</View> : null}
      {scroll ? (
        <ScrollView
          contentContainerStyle={[pad, contentStyle]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={c.gold} colors={[c.gold]} /> : undefined
          }
          {...scrollProps}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[{ flex: 1 }, pad, contentStyle]}>{children}</View>
      )}
      {footer}
    </View>
  );
}

/** Stack-screen header: back button, optional title block and right actions. */
export function Header({
  title,
  eyebrow,
  subtitle,
  right,
  back = true,
  onBack,
  large = true,
}: {
  title?: string;
  eyebrow?: string;
  subtitle?: string;
  right?: ReactNode;
  back?: boolean;
  onBack?: () => void;
  large?: boolean;
}) {
  const router = useRouter();
  return (
    <View style={{ gap: 14, marginBottom: 18 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 44 }}>
        {back ? (
          <IconButton
            icon="back"
            label="Geri"
            onPress={() => (onBack ? onBack() : router.canGoBack() ? router.back() : router.replace('/'))}
          />
        ) : (
          <View />
        )}
        <View style={{ flexDirection: 'row', gap: 8 }}>{right}</View>
      </View>
      {title ? (
        <View style={{ gap: 6 }}>
          {eyebrow ? (
            <Txt v="caption" tone="gold">
              {eyebrow}
            </Txt>
          ) : null}
          <Txt v={large ? 'display' : 'title'} accessibilityRole="header">
            {title}
          </Txt>
          {subtitle ? (
            <Txt v="sub" tone="sub">
              {subtitle}
            </Txt>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

export function SectionTitle({ children, action }: { children: string; action?: ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 22, marginBottom: 10 }}>
      <Txt v="caption" tone="gold" accessibilityRole="header">
        {children}
      </Txt>
      {action}
    </View>
  );
}

/** Grouped list container (settings style). */
export function Group({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const { c, isDark } = useTheme();
  return (
    <View
      style={[
        { borderRadius: radius.lg, backgroundColor: isDark ? c.glass : c.raised, borderWidth: 1, borderColor: c.hair, overflow: 'hidden' },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function Row({
  title,
  subtitle,
  icon,
  value,
  right,
  onPress,
  chevron = !!onPress,
  last,
  danger,
  accessibilityLabel,
}: {
  title: string;
  subtitle?: string;
  icon?: IconName;
  value?: string;
  right?: ReactNode;
  onPress?: () => void;
  chevron?: boolean;
  last?: boolean;
  danger?: boolean;
  accessibilityLabel?: string;
}) {
  const { c } = useTheme();
  const body = (
    <View
      style={{
        minHeight: 56,
        paddingHorizontal: 16,
        paddingVertical: 10,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth,
        borderBottomColor: c.hair,
      }}
    >
      {icon ? (
        <View style={{ width: 32, height: 32, borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: danger ? c.cautionTint : c.goldTint }}>
          <Icon name={icon} size={18} color={danger ? c.caution : c.goldText} />
        </View>
      ) : null}
      <View style={{ flex: 1, gap: 2 }}>
        <Txt v="callout" color={danger ? c.caution : c.text}>
          {title}
        </Txt>
        {subtitle ? (
          <Txt v="small" tone="secondary">
            {subtitle}
          </Txt>
        ) : null}
      </View>
      {value ? (
        <Txt v="sub" tone="secondary">
          {value}
        </Txt>
      ) : null}
      {right}
      {chevron ? <Icon name="forward" size={18} color={c.text3} /> : null}
    </View>
  );
  if (!onPress) return body;
  return (
    <Touch onPress={onPress} accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? (value ? `${title}, ${value}` : title)}>
      {body}
    </Touch>
  );
}

/** Bottom sheet built on Modal (works on iOS, Android and web). */
export function Sheet({
  visible,
  onClose,
  children,
  title,
  height,
}: {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: string;
  height?: number | `${number}%`;
}) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const y = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.timing(y, {
      toValue: visible ? 0 : 1,
      duration: 400,
      easing: Easing.bezier(0.22, 0.61, 0.36, 1),
      useNativeDriver: true,
    }).start();
  }, [visible, y]);
  return (
    <Modal visible={visible} transparent onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: c.scrim }]} onPress={onClose} accessibilityLabel="Kapat" accessibilityRole="button" />
      <Animated.View
        accessibilityViewIsModal
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          maxWidth: 560,
          alignSelf: 'center',
          width: '100%',
          height,
          maxHeight: '92%',
          paddingHorizontal: space.gutter,
          paddingTop: 10,
          paddingBottom: insets.bottom + 24,
          borderTopLeftRadius: radius.xxl,
          borderTopRightRadius: radius.xxl,
          backgroundColor: c.sheet,
          borderTopWidth: 1,
          borderColor: c.stroke,
          overflow: 'hidden',
          transform: [{ translateY: y.interpolate({ inputRange: [0, 1], outputRange: [0, 700] }) }],
        }}
      >
        <Rosette size={220} style={{ right: -60, top: -60 }} />
        <View style={{ alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: c.grab, marginBottom: 14 }} />
        {title ? (
          <Txt v="title" accessibilityRole="header" style={{ marginBottom: 12 }}>
            {title}
          </Txt>
        ) : null}
        {children}
      </Animated.View>
    </Modal>
  );
}

/** Gold "CANLI" badge with a slow pulse (never red, per the design). */
export function LiveBadge({ label = 'CANLI' }: { label?: string }) {
  const { c } = useTheme();
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(pulse, { toValue: 1, duration: 2400, easing: Easing.out(Easing.ease), useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, height: 28, paddingHorizontal: 12, borderRadius: 999, backgroundColor: c.goldTint, borderWidth: 1, borderColor: c.goldLine, alignSelf: 'flex-start' }}>
      <View style={{ width: 6, height: 6 }}>
        <Animated.View
          style={{
            position: 'absolute',
            inset: 0,
            width: 6,
            height: 6,
            borderRadius: 3,
            backgroundColor: c.gold,
            opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.7, 0] }),
            transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 2.6] }) }],
          }}
        />
        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: c.gold }} />
      </View>
      <Txt v="caption" tone="gold" style={{ fontSize: 11, fontFamily: 'Inter_600SemiBold' }}>
        {label}
      </Txt>
    </View>
  );
}

/** Calm full-width state: empty list, error, permission needed. */
export function StateView({
  icon = 'info',
  title,
  body,
  action,
  tone = 'gold',
}: {
  icon?: IconName;
  title: string;
  body?: string;
  action?: ReactNode;
  tone?: 'gold' | 'caution' | 'sage';
}) {
  const { c } = useTheme();
  const col = tone === 'caution' ? c.caution : tone === 'sage' ? c.sage : c.goldText;
  const bg = tone === 'caution' ? c.cautionTint : tone === 'sage' ? c.sageTint : c.goldTint;
  return (
    <View style={{ alignItems: 'center', paddingVertical: 36, paddingHorizontal: 12, gap: 12 }}>
      <View style={{ width: 56, height: 56, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: bg }}>
        <Icon name={icon} size={26} color={col} />
      </View>
      <Txt v="titleSm" center>
        {title}
      </Txt>
      {body ? (
        <Txt v="sub" tone="secondary" center style={{ maxWidth: 300 }}>
          {body}
        </Txt>
      ) : null}
      {action ? <View style={{ marginTop: 6, alignSelf: 'stretch' }}>{action}</View> : null}
    </View>
  );
}

/** Inline notice strip (offline, stale data, calibration…). */
export function Notice({ icon = 'info', title, body, tone = 'caution', action }: { icon?: IconName; title: string; body?: string; tone?: 'caution' | 'gold' | 'sage'; action?: ReactNode }) {
  const { c } = useTheme();
  const col = tone === 'caution' ? c.caution : tone === 'sage' ? c.sage : c.goldText;
  const bg = tone === 'caution' ? c.cautionTint : tone === 'sage' ? c.sageTint : c.goldTint;
  const line = tone === 'caution' ? c.cautionLine : c.goldLine;
  return (
    <View accessibilityRole="alert" style={{ flexDirection: 'row', gap: 10, padding: 12, paddingHorizontal: 14, borderRadius: 16, backgroundColor: bg, borderWidth: 1, borderColor: line }}>
      <View style={{ paddingTop: 1 }}>
        <Icon name={icon} size={18} color={col} strokeWidth={1.7} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Txt v="bodyStrong" style={{ fontSize: 14 }}>
          {title}
        </Txt>
        {body ? (
          <Txt v="sub" tone="sub" style={{ fontSize: 13, lineHeight: 18 }}>
            {body}
          </Txt>
        ) : null}
        {action}
      </View>
    </View>
  );
}

/** Shimmer-free skeleton block (calm pulse). */
export function Skeleton({ width = '100%', height = 16, r = 8, style }: { width?: number | `${number}%`; height?: number; r?: number; style?: StyleProp<ViewStyle> }) {
  const { c } = useTheme();
  const o = useRef(new Animated.Value(0.5)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(o, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(o, { toValue: 0.5, duration: 900, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [o]);
  return <Animated.View aria-hidden style={[{ width, height, borderRadius: r, backgroundColor: c.glassStrong, opacity: o }, style]} />;
}

export { Glass };

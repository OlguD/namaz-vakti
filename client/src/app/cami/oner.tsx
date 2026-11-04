import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, G, Path, Rect } from 'react-native-svg';
import { errorMessage, isApiError } from '@/api/errors';
import { isRegistered, useSession } from '@/auth/session';
import { usePlace } from '@/features/location/store';
import { useSuggestMosque, type SuggestionInput } from '@/features/mosques/api';
import { formatCoords, type LatLng } from '@/features/mosques/format';
import { PinPickerMap } from '@/features/mosques/MosqueMap';
import { LocalIcon } from '@/features/qibla/icons';
import { useTheme } from '@/theme/theme';
import { fonts, radius } from '@/theme/tokens';
import { Button, Girih, Notice, Touch, Txt } from '@/ui';

type Mode = 'new' | 'fix';
type Issue = 'konum' | 'ad' | 'iletisim' | 'kapali';
const ISSUES: { key: Issue; label: string }[] = [
  { key: 'konum', label: 'Konum' },
  { key: 'ad', label: 'Ad' },
  { key: 'iletisim', label: 'Telefon / web' },
  { key: 'kapali', label: 'Kalıcı olarak kapalı' },
];

/** /cami/oner — suggest a new mosque, or (with ?mosqueId) a correction. */
export default function SuggestMosqueScreen() {
  const params = useLocalSearchParams<{ mosqueId?: string; name?: string; lat?: string; lng?: string }>();
  const { c, isDark } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const place = usePlace((s) => s.place);
  const user = useSession((s) => s.user);
  const registered = isRegistered(user);
  const canFix = !!params.mosqueId;

  const [mode, setMode] = useState<Mode>(canFix ? 'fix' : 'new');
  const [name, setName] = useState(canFix ? (params.name ?? '') : '');
  const [note, setNote] = useState('');
  const [issues, setIssues] = useState<Set<Issue>>(new Set(['konum']));
  // A correction starts at the mosque; a new mosque at the user's place.
  const pLat = Number(params.lat);
  const pLng = Number(params.lng);
  const start: LatLng =
    Number.isFinite(pLat) && Number.isFinite(pLng) && params.lat
      ? { lat: pLat, lng: pLng }
      : { lat: place?.lat ?? 41.0082, lng: place?.lng ?? 28.9784 };
  const [pin, setPin] = useState<LatLng>(start);
  const [pinCenter, setPinCenter] = useState<LatLng>(start);
  const [recenter, setRecenter] = useState<number | undefined>(undefined);
  const [locating, setLocating] = useState(false);
  const [sentName, setSentName] = useState<string | null>(null);
  const mutation = useSuggestMosque();

  const isFix = mode === 'fix';
  const needsPin = !isFix || issues.has('konum');
  const ok = name.trim().length > 0 && (!isFix || issues.size > 0);
  const close = () => (router.canGoBack() ? router.back() : router.replace('/camiler'));

  const useMyLocation = async () => {
    setLocating(true);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== 'granted') return;
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      setPin(p);
      setPinCenter(p);
      setRecenter((k) => (k ?? 0) + 1);
    } catch {
      // Keep the current pin.
    } finally {
      setLocating(false);
    }
  };

  const submit = () => {
    if (!ok || mutation.isPending) return;
    const lat = Math.round(pin.lat * 1e6) / 1e6;
    const lng = Math.round(pin.lng * 1e6) / 1e6;
    let input: SuggestionInput;
    if (!isFix) {
      input = { kind: 'add', name: name.trim(), lat, lng, note: note.trim() || undefined };
    } else {
      const picked = ISSUES.filter((i) => issues.has(i.key)).map((i) => i.label);
      const closed = issues.has('kapali');
      input = {
        kind: closed ? 'closed' : 'edit',
        mosqueId: params.mosqueId,
        name: issues.has('ad') ? name.trim() : undefined,
        ...(needsPin ? { lat, lng } : {}),
        note: [`Hatalı: ${picked.join(', ')}`, note.trim()].filter(Boolean).join('\n').slice(0, 500),
      };
    }
    mutation.mutate(input, { onSuccess: () => setSentName(name.trim()) });
  };

  const regErr = mutation.error && isApiError(mutation.error) && (mutation.error.code === 'REGISTRATION_REQUIRED' || mutation.error.status === 403);

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <View aria-hidden style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 360, overflow: 'hidden' }}>
        <LinearGradient
          colors={isDark ? ['#05070D', '#0B1224', '#0E1528', '#0B0F17'] : ['#9CC4E4', '#C6DDEE', '#E6ECEC', '#F6F1E7']}
          locations={[0, 0.34, 0.64, 1]}
          style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
        />
        <Girih width="100%" height={360} />
      </View>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ flexGrow: 1, paddingTop: insets.top + 14, paddingBottom: insets.bottom + 24, paddingHorizontal: 20, maxWidth: 560, width: '100%', alignSelf: 'center' }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', height: 44 }}>
            <Touch onPress={close} accessibilityRole="button" style={{ width: 80, minHeight: 44, justifyContent: 'center' }}>
              <Txt v="body" tone="secondary">
                {sentName ? 'Kapat' : 'İptal'}
              </Txt>
            </Touch>
            <Txt v="titleSm" center style={{ flex: 1 }} accessibilityRole="header">
              {sentName ? '' : isFix ? 'Bilgi düzelt' : 'Cami öner'}
            </Txt>
            <View style={{ width: 80 }} />
          </View>

          {sentName ? (
            <Sent name={sentName} onDone={close} />
          ) : (
            <View style={{ flex: 1 }}>
              {canFix ? (
                <View accessibilityRole="radiogroup" accessibilityLabel="Öneri türü" style={{ flexDirection: 'row', gap: 4, marginTop: 12, padding: 4, borderRadius: 14, backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(26,28,33,0.06)' }}>
                  {(['new', 'fix'] as Mode[]).map((m) => {
                    const on = mode === m;
                    return (
                      <Touch
                        key={m}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: on }}
                        onPress={() => {
                          setMode(m);
                          setName(m === 'fix' ? (params.name ?? '') : '');
                        }}
                        style={{
                          flex: 1,
                          minHeight: 36,
                          borderRadius: 10,
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: on ? (isDark ? 'rgba(255,255,255,0.12)' : '#FFFFFF') : 'transparent',
                        }}
                      >
                        <Txt v="callout" color={on ? c.text : c.text2} style={{ fontSize: 14 }}>
                          {m === 'new' ? 'Yeni cami' : 'Bilgi düzelt'}
                        </Txt>
                      </Touch>
                    );
                  })}
                </View>
              ) : null}

              <Label text="Cami adı" />
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Ör. Yenisahra Merkez Camii"
                placeholderTextColor={c.text3}
                accessibilityLabel="Cami adı"
                maxLength={120}
                style={inputStyle(c, isDark)}
              />

              {isFix ? (
                <View style={{ marginTop: 16, gap: 6 }} accessibilityRole="list" accessibilityLabel="Ne hatalı?">
                  <Txt v="subStrong">Ne hatalı?</Txt>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {ISSUES.map((i) => {
                      const on = issues.has(i.key);
                      return (
                        <Touch
                          key={i.key}
                          accessibilityRole="checkbox"
                          accessibilityState={{ checked: on }}
                          onPress={() =>
                            setIssues((prev) => {
                              const n = new Set(prev);
                              if (on) n.delete(i.key);
                              else n.add(i.key);
                              return n;
                            })
                          }
                          style={{ minHeight: 36, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: on ? c.goldLine : c.hair, backgroundColor: on ? c.goldTint : 'transparent', justifyContent: 'center' }}
                        >
                          <Txt v="subStrong" color={on ? c.goldText : c.text}>
                            {i.label}
                          </Txt>
                        </Touch>
                      );
                    })}
                  </View>
                </View>
              ) : null}

              {needsPin ? (
                <View style={{ marginTop: 16, gap: 6 }}>
                  <Txt v="subStrong" nativeID="msLocLabel">
                    Konum
                  </Txt>
                  <View>
                    <PinPickerMap center={pinCenter} recenterKey={recenter} onChange={setPin} />
                    <Touch
                      onPress={useMyLocation}
                      accessibilityRole="button"
                      style={{
                        position: 'absolute',
                        right: 10,
                        bottom: 10,
                        zIndex: 600,
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 6,
                        minHeight: 36,
                        paddingHorizontal: 12,
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: c.stroke,
                        backgroundColor: isDark ? 'rgba(22,29,44,0.86)' : 'rgba(255,252,246,0.92)',
                      }}
                    >
                      {locating ? <ActivityIndicator size="small" color={c.goldText} /> : <LocalIcon name="locate" size={16} color={c.goldText} />}
                      <Txt v="subStrong">Konumumu kullan</Txt>
                    </Touch>
                    <View pointerEvents="none" style={{ position: 'absolute', left: 10, bottom: 10, zIndex: 600, paddingVertical: 2, paddingHorizontal: 6, borderRadius: 6, backgroundColor: isDark ? 'rgba(22,29,44,0.86)' : 'rgba(255,252,246,0.92)' }}>
                      <Txt v="small" tone="secondary" style={{ fontSize: 9.5, lineHeight: 12 }}>
                        © OpenStreetMap katkıcıları
                      </Txt>
                    </View>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                    <Txt v="small" tone="secondary" style={{ flex: 1, lineHeight: 16 }}>
                      Haritayı sürükleyip iğneyi caminin girişine getirin.
                    </Txt>
                    <Txt v="small" tone="secondary" tnum accessibilityLabel={`Seçilen konum ${formatCoords(pin)}`}>
                      {formatCoords(pin)}
                    </Txt>
                  </View>
                </View>
              ) : null}

              <Label text="Not" optional />
              <TextInput
                value={note}
                onChangeText={setNote}
                placeholder="Ör. Giriş Atatürk Caddesi tarafında, kadınlar bölümü üst katta."
                placeholderTextColor={c.text3}
                accessibilityLabel="Not, isteğe bağlı"
                multiline
                maxLength={450}
                style={[inputStyle(c, isDark), { minHeight: 76, height: undefined, paddingTop: 12, paddingBottom: 12, lineHeight: 22, fontSize: 15, textAlignVertical: 'top' }]}
              />

              <View style={{ marginTop: 'auto', paddingTop: 20, gap: 8 }}>
                {!registered || regErr ? (
                  <Notice
                    icon="user"
                    tone="gold"
                    title="Öneri göndermek için giriş yapın"
                    body="Önerilerin kötüye kullanılmaması için hesabınızla gönderilir."
                    action={
                      <Touch onPress={() => router.push({ pathname: '/giris', params: { next: '/cami/oner' } })} accessibilityRole="button" style={{ minHeight: 36, justifyContent: 'center' }}>
                        <Txt v="subStrong" tone="gold">
                          Giriş yap
                        </Txt>
                      </Touch>
                    }
                  />
                ) : null}
                {mutation.isError && !regErr ? <Notice icon="alert" title="Öneri gönderilemedi" body={errorMessage(mutation.error)} /> : null}
                <Txt v="small" tone="secondary" center>
                  Öneriniz incelendikten sonra haritaya yansır.
                </Txt>
                <Button label="Gönder" onPress={submit} disabled={!ok || !registered} loading={mutation.isPending} />
              </View>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function inputStyle(c: ReturnType<typeof useTheme>['c'], isDark: boolean) {
  return {
    height: 52,
    paddingHorizontal: 16,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: isDark ? 'rgba(255,255,255,0.16)' : 'rgba(26,28,33,0.16)',
    backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#FFFCF6',
    color: c.text,
    fontFamily: fonts.regular,
    fontSize: 16,
  } as const;
}

function Label({ text, optional }: { text: string; optional?: boolean }) {
  return (
    <Txt v="subStrong" style={{ marginTop: 16, marginBottom: 6 }}>
      {text}
      {optional ? (
        <Txt v="sub" tone="secondary">
          {' · isteğe bağlı'}
        </Txt>
      ) : null}
    </Txt>
  );
}

function Sent({ name, onDone }: { name: string; onDone: () => void }) {
  const { c } = useTheme();
  return (
    <View accessibilityRole="alert" accessibilityLiveRegion="polite" style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 12 }}>
      <Svg width={120} height={120} viewBox="0 0 120 120" aria-hidden>
        <Circle cx={60} cy={60} r={56} fill="none" stroke={c.hair} strokeWidth={1} strokeDasharray="1 6" />
        <G fill="none" stroke={c.gold} strokeWidth={1} opacity={0.6}>
          <Rect x={34} y={34} width={52} height={52} />
          <Rect x={34} y={34} width={52} height={52} transform="rotate(45 60 60)" />
        </G>
        <Circle cx={60} cy={60} r={22} fill={c.goldTint} />
        <Path d="m50 60.5 7 7 13-14" fill="none" stroke={c.goldText} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
      <Txt v="display" center style={{ fontSize: 30, lineHeight: 36, marginTop: 8 }}>
        Teşekkürler
      </Txt>
      <Txt v="body" tone="sub" center style={{ lineHeight: 23 }}>
        <Txt v="bodyStrong">{name || 'Cami'}</Txt> için öneriniz alındı. İncelendikten sonra haritada görünecek.
      </Txt>
      <Button label="Haritaya dön" onPress={onDone} style={{ alignSelf: 'stretch', marginTop: 24 }} />
    </View>
  );
}

import { useState } from 'react';
import { ScrollView, TextInput, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { errorMessage } from '@/api/errors';
import { setFlag, useFlags } from '@/lib/flags';
import { useTheme } from '@/theme/theme';
import { fonts } from '@/theme/tokens';
import { Button, Icon, Sheet, tapFeedback, Touch, Txt } from '@/ui';
import { initials } from './messages';
import { REPORT_REASONS, type ChatMessage, type ReportReason } from './types';

const RULES = [
  { title: 'Saygılı olun', body: 'Kişilere, mezheplere ve görüşlere hakaret etmeyin.' },
  { title: 'Sohbet edin, kavga etmeyin', body: 'Siyasi ve mezhepsel tartışmalar bu odaların konusu değil.' },
  { title: 'Reklam ve spam yok', body: 'Bağlantılar ve tekrarlanan mesajlar otomatik incelenir.' },
  { title: 'Kişisel bilgilerinizi koruyun', body: 'Telefon, adres ya da hesap bilgisi paylaşmayın.' },
  { title: 'Kaynak belirtin', body: 'Dini bilgi paylaşırken ayet, hadis ya da kaynağını yazın.' },
];

export function Checkbox({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  const { c } = useTheme();
  return (
    <Touch
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={label}
      onPress={() => {
        tapFeedback();
        onChange(!checked);
      }}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44 }}
    >
      <View
        style={{
          width: 22,
          height: 22,
          borderRadius: 6,
          borderWidth: 1.5,
          borderColor: checked ? c.gold : c.text3,
          backgroundColor: checked ? c.gold : 'transparent',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {checked ? <Icon name="check" size={16} color={c.onGold} strokeWidth={2.2} /> : null}
      </View>
      <Txt v="body" style={{ flex: 1, fontSize: 14 }}>
        {label}
      </Txt>
    </Touch>
  );
}

/** Community rules (design: ChatRules). First visit must accept before chatting. */
export function RulesSheet({ visible, onClose, onAccepted }: { visible: boolean; onClose: () => void; onAccepted?: () => void }) {
  const { c } = useTheme();
  const accepted = useFlags((s) => s.chatRulesAccepted);
  const [agree, setAgree] = useState(false);
  return (
    <Sheet visible={visible} onClose={onClose} height="88%">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 8 }}>
        <View style={{ width: 52, height: 52, marginTop: 4, borderRadius: 18, backgroundColor: c.goldTint, borderWidth: 1, borderColor: c.goldLine, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="shield" size={26} color={c.goldText} />
        </View>
        <Txt v="display" accessibilityRole="header" style={{ marginTop: 16, fontSize: 30, lineHeight: 36 }}>
          Topluluk kuralları
        </Txt>
        <Txt v="sub" tone="sub" style={{ marginTop: 8, fontSize: 14, lineHeight: 21 }}>
          Bu odalar dünyanın her yerinden insanları buluşturur. Katılmadan önce lütfen birkaç dakikanızı ayırın.
        </Txt>
        <View style={{ marginTop: 18, gap: 14 }} accessibilityRole="list">
          {RULES.map((r, i) => (
            <View key={r.title} style={{ flexDirection: 'row', gap: 14 }} accessible accessibilityLabel={`${i + 1}. ${r.title}. ${r.body}`}>
              <Txt v="title" tone="gold" style={{ width: 28, fontSize: 22, lineHeight: 24 }}>
                {String(i + 1)}
              </Txt>
              <View style={{ flex: 1, gap: 2 }}>
                <Txt v="bodyStrong">{r.title}</Txt>
                <Txt v="sub" tone="sub">
                  {r.body}
                </Txt>
              </View>
            </View>
          ))}
        </View>
        <View style={{ marginTop: 16, padding: 12, paddingHorizontal: 14, borderRadius: 16, backgroundColor: c.glass }}>
          <Txt v="small" tone="secondary" style={{ lineHeight: 18 }}>
            Kurallara uymayan mesajlar otomatik olarak engellenebilir. Tekrarlayan ihlallerde hesabınız bir süre susturulur. Yavaş mod açıkken iki mesaj arasında birkaç saniye beklemeniz gerekir.
          </Txt>
        </View>
      </ScrollView>
      <View style={{ gap: 10, marginTop: 8 }}>
        {accepted ? (
          <Button label="Tamam" onPress={onClose} />
        ) : (
          <>
            <Checkbox checked={agree} onChange={setAgree} label="Okudum, kurallara uyacağım" />
            <Button
              label="Sohbete katıl"
              disabled={!agree}
              onPress={() => {
                void setFlag('chatRulesAccepted', true);
                onAccepted?.();
                onClose();
              }}
            />
          </>
        )}
      </View>
    </Sheet>
  );
}

/** Report a message (design: ChatReport / ChatReportSent). */
export function ReportSheet({
  message,
  onClose,
  onSubmit,
}: {
  message: ChatMessage | null;
  onClose: () => void;
  /** Sends the report (and block); resolves when done. */
  onSubmit: (reason: ReportReason, note: string, block: boolean) => Promise<void>;
}) {
  const { c } = useTheme();
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [note, setNote] = useState('');
  const [block, setBlock] = useState(true);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<{ blocked: boolean } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const close = () => {
    onClose();
    setTimeout(() => {
      setReason(null);
      setNote('');
      setBlock(true);
      setSent(null);
      setErr(null);
    }, 450);
  };
  const name = message?.author.displayName ?? '';

  return (
    <Sheet visible={!!message} onClose={close} height="88%">
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 }}>
        <Touch accessibilityRole="button" onPress={close} style={{ minHeight: 44, justifyContent: 'center', minWidth: 64 }}>
          <Txt v="callout" tone="gold">
            {sent ? 'Kapat' : 'Vazgeç'}
          </Txt>
        </Touch>
        <Txt v="headline" accessibilityRole="header">
          {sent ? '' : 'Mesajı bildir'}
        </Txt>
        <View style={{ minWidth: 64 }} />
      </View>

      {sent ? (
        <View accessibilityRole="alert" style={{ alignItems: 'center', gap: 10, paddingTop: 36, paddingHorizontal: 12 }}>
          <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: c.sageTint, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="check" size={30} color={c.sage} strokeWidth={1.8} />
          </View>
          <Txt v="title" center>
            Bildiriminiz alındı
          </Txt>
          <Txt v="sub" tone="sub" center style={{ fontSize: 14, lineHeight: 21 }}>
            Teşekkürler. Mesaj incelenecek; kimin bildirdiği karşı tarafa gösterilmez.
          </Txt>
          {sent.blocked ? (
            <Txt v="sub" tone="secondary" center>
              {name} engellendi. Mesajlarını artık görmeyeceksiniz.
            </Txt>
          ) : null}
          <Button label="Sohbete dön" kind="secondary" onPress={close} style={{ alignSelf: 'stretch', marginTop: 16 }} />
        </View>
      ) : (
        <>
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 8 }}>
            {message ? (
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 10, padding: 12, borderRadius: 16, backgroundColor: c.glass, borderWidth: 1, borderColor: c.stroke }}>
                <View aria-hidden style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: c.goldTint, alignItems: 'center', justifyContent: 'center' }}>
                  <Txt v="small" tone="gold" weight="semibold">
                    {initials(name)}
                  </Txt>
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Txt v="small" tone="secondary" weight="semibold">
                    {name}
                  </Txt>
                  <Txt v="sub" numberOfLines={3}>
                    {message.body}
                  </Txt>
                </View>
              </View>
            ) : null}
            <Txt v="caption" tone="secondary" style={{ marginTop: 18, marginBottom: 8 }}>
              Bildirme sebebi
            </Txt>
            <View accessibilityRole="radiogroup" style={{ borderRadius: 18, backgroundColor: c.raised, borderWidth: 1, borderColor: c.hair, overflow: 'hidden' }}>
              {REPORT_REASONS.map((r, i) => {
                const on = reason === r.id;
                return (
                  <Touch
                    key={r.id}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: on }}
                    onPress={() => {
                      tapFeedback();
                      setReason(r.id);
                    }}
                    style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, borderTopWidth: i ? 1 : 0, borderTopColor: c.hair }}
                  >
                    <Txt v="body" color={on ? c.goldText : c.text} weight={on ? 'semibold' : 'regular'}>
                      {r.label}
                    </Txt>
                    <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: on ? c.gold : c.text3, alignItems: 'center', justifyContent: 'center' }}>
                      {on ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: c.gold }} /> : null}
                    </View>
                  </Touch>
                );
              })}
            </View>
            <Txt v="subStrong" tone="secondary" style={{ marginTop: 16, marginBottom: 6 }}>
              Not <Txt v="sub" tone="tertiary">· isteğe bağlı</Txt>
            </Txt>
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="Neyin sorun olduğunu kısaca anlatın"
              placeholderTextColor={c.text3}
              accessibilityLabel="Not, isteğe bağlı"
              multiline
              maxLength={500}
              style={{ minHeight: 72, borderRadius: 16, borderWidth: 1, borderColor: c.stroke, backgroundColor: c.input, paddingHorizontal: 14, paddingVertical: 12, color: c.text, fontFamily: fonts.regular, fontSize: 15, textAlignVertical: 'top' }}
            />
            {message ? <Checkbox checked={block} onChange={setBlock} label={`${name} kullanıcısını da engelle`} /> : null}
            {err ? (
              <Txt v="small" tone="caution" accessibilityLiveRegion="polite">
                {err}
              </Txt>
            ) : null}
          </ScrollView>
          <Button
            label="Bildir"
            disabled={!reason}
            loading={busy}
            style={{ marginTop: 8 }}
            onPress={async () => {
              if (!reason) return;
              setBusy(true);
              setErr(null);
              try {
                await onSubmit(reason, note, block);
                setSent({ blocked: block });
              } catch (e) {
                setErr(errorMessage(e));
              } finally {
                setBusy(false);
              }
            }}
          />
        </>
      )}
    </Sheet>
  );
}

export function FlagIcon({ color, size = 18 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <Path d="M5 21V4M5 4h11l-2 4 2 4H5" />
    </Svg>
  );
}

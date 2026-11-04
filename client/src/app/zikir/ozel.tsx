import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { TextInput, View } from 'react-native';
import { errorMessage } from '@/api/errors';
import { useUpdateSettings } from '@/features/settings/api';
import { useCreateDhikr, useDeleteDhikr, useDhikrs, useUpdateDhikr, type Dhikr } from '@/features/worship/api';
import { setRound } from '@/features/worship/dhikrQueue';
import { useTheme } from '@/theme/theme';
import { fonts, radius } from '@/theme/tokens';
import { Button, Glass, Group, Icon, Notice, Rosette, Row, Screen, SectionTitle, Touch, Txt } from '@/ui';

const PRESETS = [33, 99, 100, 500];

/** Create (or, with ?id=, edit) a custom dhikr. */
export default function CustomDhikrScreen() {
  const { c } = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const list = useDhikrs();
  const editing = id ? list.data?.custom.find((d) => d.id === id) : undefined;
  const create = useCreateDhikr();
  const update = useUpdateDhikr();
  const remove = useDeleteDhikr();
  const settings = useUpdateSettings();

  // Re-keyed when the dhikr being edited loads, so the form starts from its values.
  return <Form key={editing?.id ?? 'new'} editing={editing} list={list} create={create} update={update} remove={remove} settings={settings} router={router} c={c} />;
}

function Form({
  editing,
  list,
  create,
  update,
  remove,
  settings,
  router,
  c,
}: {
  editing: Dhikr | undefined;
  list: ReturnType<typeof useDhikrs>;
  create: ReturnType<typeof useCreateDhikr>;
  update: ReturnType<typeof useUpdateDhikr>;
  remove: ReturnType<typeof useDeleteDhikr>;
  settings: ReturnType<typeof useUpdateSettings>;
  router: ReturnType<typeof useRouter>;
  c: ReturnType<typeof useTheme>['c'];
}) {
  const [ar, setAr] = useState(editing?.arabic ?? '');
  const [tr, setTr] = useState(editing?.transliteration ?? '');
  const [mean, setMean] = useState(editing?.meaning ?? '');
  const [target, setTarget] = useState(editing?.target ?? 100);

  const ok = tr.trim().length > 0 && target >= 1;
  const busy = create.isPending || update.isPending;
  const error = create.error ?? update.error;

  const save = async () => {
    if (!ok) return;
    const body = { arabic: ar.trim() || undefined, transliteration: tr.trim(), meaning: mean.trim() || undefined, target };
    if (editing?.id) {
      await update.mutateAsync({ id: editing.id, ...body, arabic: ar.trim() || null, meaning: mean.trim() || null });
      router.back();
      return;
    }
    const d = await create.mutateAsync(body);
    // Start counting the new dhikr right away.
    setRound({ key: d.key, count: 0, tours: 1 });
    settings.mutate((s) => ({ ...s, zikirmatik: { ...s.zikirmatik, lastDhikrKey: d.key, target: d.target } }));
    router.back();
  };

  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 }}>
        <Touch onPress={() => router.back()} accessibilityRole="button" style={{ minHeight: 44, justifyContent: 'center', paddingRight: 12 }}>
          <Txt v="callout" tone="secondary">
            Vazgeç
          </Txt>
        </Touch>
        <Txt v="headline" accessibilityRole="header">
          {editing ? 'Zikri düzenle' : 'Yeni zikir'}
        </Txt>
        <View style={{ width: 60 }} />
      </View>

      <Glass radius={24} style={{ marginTop: 18, alignItems: 'center', gap: 6, paddingVertical: 22 }}>
        <Rosette size={160} style={{ right: -50, top: -50 }} />
        <Txt v="caption" tone="gold">
          Önizleme
        </Txt>
        <Txt v="arabic" center style={{ fontSize: 30, lineHeight: 48 }}>
          {ar || '—'}
        </Txt>
        <Txt v="title" tone="gold" weight="titleItalic" center style={{ fontSize: 18, lineHeight: 24 }}>
          {tr || 'Okunuş'}
        </Txt>
        <Txt v="small" tone="secondary" tnum>
          Hedef {target}
        </Txt>
      </Glass>

      <View style={{ gap: 16, marginTop: 20 }}>
        <Input label="Arapça metin" optional value={ar} onChange={setAr} placeholder="اكتب الذكر هنا" rtl />
        <Input label="Okunuşu" value={tr} onChange={setTr} placeholder="Ör. Hasbünallâhu ve ni’mel vekîl" />
        <Input label="Anlamı" optional value={mean} onChange={setMean} placeholder="Kısa bir anlam" />

        <View style={{ gap: 8 }}>
          <Txt v="subStrong" tone="secondary" nativeID="zcTarget">
            Hedef
          </Txt>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Stepper label="Azalt" icon="minus" onPress={() => setTarget((t) => Math.max(1, t - 1))} />
            <View style={{ flex: 1, minHeight: 52, borderRadius: radius.md, borderWidth: 1, borderColor: c.stroke, backgroundColor: c.input, alignItems: 'center', justifyContent: 'center' }}>
              <Txt v="time" tnum style={{ fontSize: 22, lineHeight: 28 }} accessibilityLabel={`Hedef ${target}`}>
                {target}
              </Txt>
            </View>
            <Stepper label="Artır" icon="plus" onPress={() => setTarget((t) => Math.min(100_000, t + 1))} />
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {PRESETS.map((p) => {
              const on = p === target;
              return (
                <Touch
                  key={p}
                  onPress={() => setTarget(p)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  style={{ flex: 1, minHeight: 40, borderRadius: 12, borderWidth: 1, borderColor: on ? c.goldLine : c.hair, backgroundColor: on ? c.goldTint : 'transparent', alignItems: 'center', justifyContent: 'center' }}
                >
                  <Txt v="callout" tnum color={on ? c.goldText : c.text} style={{ fontSize: 14 }}>
                    {p}
                  </Txt>
                </Touch>
              );
            })}
          </View>
        </View>

        {error ? <Notice icon="alert" title="Kaydedilemedi" body={errorMessage(error)} /> : null}
        <Button label={editing ? 'Değişiklikleri kaydet' : 'Kaydet'} disabled={!ok} loading={busy} onPress={() => void save().catch(() => {})} />
      </View>

      {!editing && (list.data?.custom.length ?? 0) > 0 ? (
        <>
          <SectionTitle>Zikirleriniz</SectionTitle>
          <Group>
            {list.data!.custom.map((d, i, arr) => (
              <Row
                key={d.key}
                title={d.transliteration}
                subtitle={`Hedef ${d.target}${d.meaning ? ` · ${d.meaning}` : ''}`}
                last={i === arr.length - 1}
                onPress={() => router.setParams({ id: d.id })}
                right={
                  <Touch onPress={() => d.id && remove.mutate(d.id)} accessibilityRole="button" accessibilityLabel={`${d.transliteration} zikrini sil`} hitSlop={8} style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name="trash" size={18} color={c.caution} />
                  </Touch>
                }
                chevron={false}
              />
            ))}
          </Group>
        </>
      ) : null}
    </Screen>
  );
}

function Input({ label, optional, value, onChange, placeholder, rtl }: { label: string; optional?: boolean; value: string; onChange: (v: string) => void; placeholder: string; rtl?: boolean }) {
  const { c } = useTheme();
  return (
    <View style={{ gap: 6 }}>
      <Txt v="subStrong" tone="secondary">
        {label}
        {optional ? (
          <Txt v="sub" tone="tertiary">
            {' '}
            · isteğe bağlı
          </Txt>
        ) : null}
      </Txt>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={c.text3}
        accessibilityLabel={label}
        maxLength={rtl ? 300 : 120}
        style={{
          minHeight: 52,
          borderRadius: radius.md,
          borderWidth: 1,
          borderColor: c.stroke,
          backgroundColor: c.input,
          paddingHorizontal: 16,
          color: c.text,
          fontFamily: rtl ? fonts.arabic : fonts.regular,
          fontSize: rtl ? 22 : 16,
          textAlign: rtl ? 'right' : 'left',
          writingDirection: rtl ? 'rtl' : 'ltr',
        }}
      />
    </View>
  );
}

function Stepper({ label, icon, onPress }: { label: string; icon: 'plus' | 'minus'; onPress: () => void }) {
  const { c } = useTheme();
  return (
    <Touch onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={{ width: 52, height: 52, borderRadius: radius.md, borderWidth: 1, borderColor: c.stroke, backgroundColor: c.glass, alignItems: 'center', justifyContent: 'center' }}>
      <Icon name={icon} size={20} color={c.text} />
    </Touch>
  );
}

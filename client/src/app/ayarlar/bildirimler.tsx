import { useEffect, useState } from 'react';
import { Linking, Platform, StyleSheet, View } from 'react-native';
import type { AdhanSound, SettingsData } from '@/api/types';
import {
  getNotificationPermission,
  requestNotificationPermission,
  SOUND_LABEL,
  SOUND_SUB,
  SOUNDS,
  type PermissionState,
} from '@/features/notifications';
import { IFTAR_BEFORE_MIN, SAHUR_BEFORE_MIN } from '@/features/notifications/schedule';
import { usePrayerTimes } from '@/features/prayer/api';
import { useSettings, useUpdateSettings } from '@/features/settings/api';
import { GroupLabel } from '@/features/settings/components';
import { localDate, VAKITS, VAKIT_LABEL, type Vakit } from '@/lib/prayer';
import { useTheme } from '@/theme/theme';
import { Button, Chip, Group, Header, Icon, Notice, Screen, Sheet, Toggle, Touch, Txt } from '@/ui';

const REMIND_OPTIONS = [0, 5, 10, 15, 30] as const;
type ReminderKey = keyof SettingsData['reminders'];

export default function NotificationSettingsScreen() {
  const { c } = useTheme();
  const settings = useSettings();
  const update = useUpdateSettings();
  const { data } = usePrayerTimes();
  const today = data?.days.find((d) => d.date === localDate()) ?? data?.days[0];
  const [open, setOpen] = useState<Vakit | null>(null);
  const [soundFor, setSoundFor] = useState<Vakit | null>(null);
  const [perm, setPerm] = useState<PermissionState | null>(null);

  useEffect(() => {
    void getNotificationPermission().then(setPerm);
  }, []);

  const setVakit = (v: Vakit, patch: Partial<SettingsData['prayerNotifications'][Vakit]>) =>
    update.mutate((s) => ({ ...s, prayerNotifications: { ...s.prayerNotifications, [v]: { ...s.prayerNotifications[v], ...patch } } }));
  const setReminder = (k: ReminderKey, on: boolean) => update.mutate((s) => ({ ...s, reminders: { ...s.reminders, [k]: on } }));

  const reminderRow = (k: ReminderKey, name: string, sub: string, first: boolean) => (
    <View key={k} style={[styles.row, { borderTopWidth: first ? 0 : StyleSheet.hairlineWidth, borderTopColor: c.hair }]}>
      <View style={{ flex: 1, gap: 2 }}>
        <Txt v="callout">{name}</Txt>
        <Txt v="small" tone="secondary">
          {sub}
        </Txt>
      </View>
      <Toggle value={settings.reminders[k]} onChange={(on) => setReminder(k, on)} label={name} />
    </View>
  );

  return (
    <Screen sky="aksam">
      <Header title="Bildirimler" large />

      {Platform.OS === 'web' ? (
        <Notice icon="info" tone="gold" title="Telefonda çalışır" body="Vakit bildirimleri iOS ve Android uygulamasında, internet olmadan da zamanında gelir. Seçimleriniz hesabınıza kaydedilir." />
      ) : perm === 'denied' || perm === 'undetermined' ? (
        <Notice
          icon="bellOff"
          title="Bildirim izni kapalı"
          body="Seçimleriniz kaydedilir ama izin verilene kadar bildirim gelmez."
          action={
            <Touch
              onPress={async () => {
                if (perm === 'denied') void Linking.openSettings();
                else setPerm((await requestNotificationPermission()) ? 'granted' : await getNotificationPermission());
              }}
              accessibilityRole="button"
              style={{ minHeight: 36, justifyContent: 'center' }}
            >
              <Txt v="subStrong" tone="gold">
                {perm === 'denied' ? 'Ayarları aç' : 'İzin ver'}
              </Txt>
            </Touch>
          }
        />
      ) : null}

      <GroupLabel>VAKİT BİLDİRİMLERİ</GroupLabel>
      <Group>
        {VAKITS.map((v, i) => {
          const pref = settings.prayerNotifications[v];
          const expanded = open === v && pref.enabled;
          const summary = pref.enabled
            ? SOUND_LABEL[pref.sound] + (pref.remindBeforeMinutes ? ` · ${pref.remindBeforeMinutes} dk önce` : '')
            : 'Kapalı';
          return (
            <View key={v} style={{ borderTopWidth: i === 0 ? 0 : StyleSheet.hairlineWidth, borderTopColor: c.hair, backgroundColor: expanded ? c.goldTint : 'transparent' }}>
              <View style={[styles.row, { paddingRight: 16 }]}>
                <Touch
                  onPress={() => setOpen(open === v ? null : v)}
                  disabled={!pref.enabled}
                  accessibilityRole="button"
                  accessibilityState={{ expanded, disabled: !pref.enabled }}
                  accessibilityLabel={`${VAKIT_LABEL[v]}, ${summary}`}
                  accessibilityHint={pref.enabled ? 'Hatırlatma ve ses seçeneklerini açar' : undefined}
                  style={{ flex: 1, gap: 2, minHeight: 44, justifyContent: 'center', opacity: 1 }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
                    <Txt v="callout">{VAKIT_LABEL[v]}</Txt>
                    {today ? (
                      <Txt v="sub" tone="secondary" tnum>
                        {today.times[v]}
                      </Txt>
                    ) : null}
                    {pref.enabled ? <Icon name={expanded ? 'up' : 'down'} size={14} color={c.text3} /> : null}
                  </View>
                  <Txt v="small" color={pref.enabled ? c.text2 : c.text3}>
                    {summary}
                  </Txt>
                </Touch>
                <Toggle
                  value={pref.enabled}
                  onChange={(on) => {
                    setVakit(v, { enabled: on });
                    if (on) setOpen(v);
                    else if (open === v) setOpen(null);
                  }}
                  label={`${VAKIT_LABEL[v]} bildirimi`}
                />
              </View>
              {expanded ? (
                <View style={{ paddingHorizontal: 16, paddingBottom: 16, gap: 12 }}>
                  <Txt v="small" tone="secondary">
                    Vakitten önce hatırlat
                  </Txt>
                  <View role="radiogroup" accessibilityLabel={`${VAKIT_LABEL[v]} için hatırlatma süresi`} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {REMIND_OPTIONS.map((m) => (
                      <Chip key={m} label={m === 0 ? 'Yok' : `${m} dk`} selected={pref.remindBeforeMinutes === m} onPress={() => setVakit(v, { remindBeforeMinutes: m })} />
                    ))}
                  </View>
                  <Touch
                    onPress={() => setSoundFor(v)}
                    accessibilityRole="button"
                    accessibilityLabel={`Ses: ${SOUND_LABEL[pref.sound]}. Değiştir`}
                    style={{ flexDirection: 'row', alignItems: 'center', minHeight: 48, paddingHorizontal: 14, borderRadius: 14, backgroundColor: c.glass, borderWidth: 1, borderColor: c.stroke, gap: 10 }}
                  >
                    <Icon name="volume" size={18} color={c.goldText} />
                    <Txt v="callout" style={{ flex: 1 }}>
                      Ses
                    </Txt>
                    <Txt v="sub" tone="secondary">
                      {SOUND_LABEL[pref.sound]}
                    </Txt>
                    <Icon name="forward" size={16} color={c.text3} />
                  </Touch>
                </View>
              ) : null}
            </View>
          );
        })}
      </Group>

      <GroupLabel>RAMAZAN</GroupLabel>
      <Group>
        {reminderRow('iftar', 'İftar hatırlatması', `Akşam ezanından ${IFTAR_BEFORE_MIN} dk önce`, true)}
        {reminderRow('sahur', 'Sahur hatırlatması', `İmsaktan ${SAHUR_BEFORE_MIN} dk önce`, false)}
      </Group>
      <Txt v="small" tone="secondary" style={{ marginTop: 8, marginLeft: 4 }}>
        Ramazan ayı başladığında kendiliğinden devreye girer.
      </Txt>

      <GroupLabel>CANLI YAYINLAR</GroupLabel>
      <Group>{reminderRow('haramainLive', 'Harameyn yayınları', 'Mekke ve Medine canlıya geçtiğinde', true)}</Group>

      <GroupLabel>DİĞER</GroupLabel>
      <Group>
        {reminderRow('friday', 'Cuma hatırlatması', 'Cuma namazından 1 saat önce', true)}
        {reminderRow('dailyQuran', 'Günlük Kur’an', 'Yatsıdan sonra okumanızı hatırlatır', false)}
      </Group>

      <SoundSheet
        vakit={soundFor}
        current={soundFor ? settings.prayerNotifications[soundFor].sound : 'mekke'}
        onPick={(s) => soundFor && setVakit(soundFor, { sound: s })}
        onClose={() => setSoundFor(null)}
      />
    </Screen>
  );
}

function SoundSheet({ vakit, current, onPick, onClose }: { vakit: Vakit | null; current: AdhanSound; onPick: (s: AdhanSound) => void; onClose: () => void }) {
  const { c } = useTheme();
  return (
    <Sheet visible={!!vakit} onClose={onClose}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
        <View style={{ gap: 2 }}>
          <Txt v="title" accessibilityRole="header">
            Ses seçimi
          </Txt>
          <Txt v="sub" tone="secondary">
            {vakit ? `${VAKIT_LABEL[vakit]} vakti` : ''}
          </Txt>
        </View>
        <Touch onPress={onClose} accessibilityRole="button" style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 6 }}>
          <Txt v="bodyStrong" tone="gold">
            Bitti
          </Txt>
        </Touch>
      </View>
      <View role="radiogroup" accessibilityLabel="Ses seçimi">
        {SOUNDS.map((s, i) => {
          const on = s === current;
          return (
            <Touch
              key={s}
              onPress={() => onPick(s)}
              role="radio"
              accessibilityState={{ checked: on }}
              accessibilityLabel={`${SOUND_LABEL[s]}, ${SOUND_SUB[s]}`}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 56, borderTopWidth: i === 0 ? 0 : StyleSheet.hairlineWidth, borderTopColor: c.hair }}
            >
              <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: on ? c.gold : c.stroke, alignItems: 'center', justifyContent: 'center' }}>
                {on ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: c.gold }} /> : null}
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Txt v="callout" weight={on ? 'semibold' : 'regular'}>
                  {SOUND_LABEL[s]}
                </Txt>
                <Txt v="small" tone="secondary">
                  {SOUND_SUB[s]}
                </Txt>
              </View>
            </Touch>
          );
        })}
      </View>
      <Button label="Tamam" kind="secondary" style={{ marginTop: 12 }} onPress={onClose} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 60, paddingHorizontal: 16, paddingVertical: 10 },
});

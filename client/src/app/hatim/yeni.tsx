import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { useCreateHatim } from '@/features/worship/api';
import { HatimError } from '@/features/worship/HatimErrors';
import { dayMonthLabel } from '@/features/worship/util';
import { addDays, localDate } from '@/lib/prayer';
import { Button, Chip, Field, Header, Screen, Txt } from '@/ui';

export default function NewHatimScreen() {
  const router = useRouter();
  const create = useCreateHatim();
  const [name, setName] = useState('');
  const [target, setTarget] = useState<string | null>(null);
  const today = localDate();
  const ok = name.trim().length >= 2 && name.trim().length <= 60;
  return (
    <Screen header={<Header title="Ortak hatim başlat" subtitle="30 cüzü aileniz ya da cemaatinizle paylaşın." large={false} />}>
      <View style={{ gap: 18 }}>
        <Field label="Hatmin adı" value={name} onChangeText={setName} placeholder="Ör. Ailecek hatim" maxLength={60} autoFocus />
        <View style={{ gap: 8 }}>
          <Txt v="subStrong" tone="secondary">
            Hedef tarih · isteğe bağlı
          </Txt>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {([['Yok', null], ['1 hafta', addDays(today, 7)], ['30 gün', addDays(today, 30)], ['60 gün', addDays(today, 60)]] as const).map(([label, d]) => (
              <Chip key={label} label={label} selected={target === d} onPress={() => setTarget(d)} />
            ))}
          </View>
          {target ? (
            <Txt v="small" tone="secondary">
              Bitiş: {dayMonthLabel(target)}
            </Txt>
          ) : null}
        </View>
        <HatimError error={create.error} />
        <Button
          label="Başlat"
          disabled={!ok}
          loading={create.isPending}
          onPress={() => create.mutate({ name: name.trim(), targetDate: target }, { onSuccess: (h) => router.replace(`/hatim/${h.id}`) })}
        />
      </View>
    </Screen>
  );
}

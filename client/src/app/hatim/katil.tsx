import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { ApiError } from '@/api/errors';
import { isRegistered, useSession } from '@/auth/session';
import { useJoinHatim } from '@/features/worship/api';
import { HatimError } from '@/features/worship/HatimErrors';
import { Button, Field, Header, Screen } from '@/ui';

/** Join with an invite code (also the target of shared links: /hatim/katil?kod=XXXX). */
export default function JoinHatimScreen() {
  const router = useRouter();
  const { kod } = useLocalSearchParams<{ kod?: string }>();
  const registered = isRegistered(useSession((s) => s.user));
  const join = useJoinHatim();
  const [code, setCode] = useState((kod ?? '').toUpperCase());
  const ok = /^[A-Za-z0-9]{6,12}$/.test(code.trim());
  return (
    <Screen header={<Header title="Hatme katıl" subtitle="Size gönderilen davet kodunu girin." large={false} />}>
      <View style={{ gap: 18 }}>
        <Field
          label="Davet kodu"
          value={code}
          onChangeText={(t) => setCode(t.replace(/[^A-Za-z0-9]/g, '').toUpperCase())}
          placeholder="Ör. 7K2QX9AB"
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={12}
          autoFocus
        />
        <HatimError error={join.error ?? (!registered ? new ApiError(403, 'REGISTRATION_REQUIRED', '') : null)} />
        <Button
          label="Katıl"
          disabled={!ok || !registered}
          loading={join.isPending}
          onPress={() => join.mutate(code, { onSuccess: (h) => router.replace(`/hatim/${h.id}`) })}
        />
      </View>
    </Screen>
  );
}

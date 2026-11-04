import { View } from 'react-native';
import { errorMessage } from '@/api/errors';
import { useSession } from '@/auth/session';
import { useBlocks, useUnblock } from '@/features/chat/api';
import { initials } from '@/features/chat/messages';
import { dayMonth } from '@/lib/dates';
import { useTheme } from '@/theme/theme';
import { Button, Header, Icon, Notice, Screen, Skeleton, StateView, Touch, Txt } from '@/ui';

export default function BlockedUsersScreen() {
  const { c, isDark } = useTheme();
  const registered = useSession((s) => s.user?.kind === 'registered');
  const blocks = useBlocks();
  const unblock = useUnblock();
  const list = blocks.data ?? [];
  const loading = registered && blocks.isLoading && !blocks.data;

  return (
    <Screen sky={isDark ? 'yatsi' : 'ogle'} header={<Header title="Engellenen kullanıcılar" large={false} />}>
      <Txt v="sub" tone="sub" style={{ fontSize: 14, lineHeight: 21, marginTop: -6 }}>
        Engellediğiniz kişilerin mesajlarını görmezsiniz. Engellendiklerine dair bir bildirim almazlar.
      </Txt>

      {unblock.isError ? (
        <View style={{ marginTop: 12 }}>
          <Notice title="Engel kaldırılamadı" body={errorMessage(unblock.error)} />
        </View>
      ) : null}

      {loading ? (
        <View accessibilityLabel="Yükleniyor" style={{ marginTop: 18, borderRadius: 22, backgroundColor: c.raised, borderWidth: 1, borderColor: c.hair, paddingHorizontal: 16 }}>
          {['44%', '36%', '50%'].map((w, i) => (
            <View key={w} aria-hidden style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 68, borderTopWidth: i ? 1 : 0, borderTopColor: c.hair }}>
              <Skeleton width={40} height={40} r={20} />
              <View style={{ flex: 1, gap: 8 }}>
                <Skeleton width={w as `${number}%`} height={12} />
                <Skeleton width="30%" height={10} />
              </View>
              <Skeleton width={104} height={36} r={12} />
            </View>
          ))}
        </View>
      ) : blocks.isError && !blocks.data ? (
        <StateView icon="offline" tone="caution" title="Liste yüklenemedi" body={errorMessage(blocks.error)} action={<Button label="Tekrar dene" kind="secondary" onPress={() => void blocks.refetch()} />} />
      ) : list.length === 0 ? (
        <StateView icon="shield" title="Engellediğiniz kimse yok" body="Sohbette bir mesaja dokunup “Kullanıcıyı engelle”yi seçerek birini engelleyebilirsiniz." />
      ) : (
        <View style={{ marginTop: 18, borderRadius: 22, backgroundColor: c.raised, borderWidth: 1, borderColor: c.hair, paddingLeft: 16, paddingRight: 10 }}>
          {list.map((u, i) => {
            const name = u.displayName ?? 'Silinmiş kullanıcı';
            return (
              <View key={u.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 68, borderTopWidth: i ? 1 : 0, borderTopColor: c.hair }}>
                <View aria-hidden style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: c.goldTint, alignItems: 'center', justifyContent: 'center' }}>
                  <Txt v="subStrong" tone="gold" weight="semibold">
                    {initials(name)}
                  </Txt>
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Txt v="callout">{name}</Txt>
                  <Txt v="small" tone="secondary">
                    Engellendi · {dayMonth(new Date(u.blockedAt))}
                  </Txt>
                </View>
                <Touch
                  accessibilityRole="button"
                  accessibilityLabel={`${name} engelini kaldır`}
                  onPress={() => unblock.mutate(u.id)}
                  style={{ minHeight: 40, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, borderColor: c.stroke, backgroundColor: c.glass, flexDirection: 'row', alignItems: 'center', gap: 6 }}
                >
                  <Icon name="block" size={14} color={c.text} />
                  <Txt v="subStrong">Engeli kaldır</Txt>
                </Touch>
              </View>
            );
          })}
        </View>
      )}
    </Screen>
  );
}

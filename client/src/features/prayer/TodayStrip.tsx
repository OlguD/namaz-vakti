import { View } from 'react-native';
import { VAKITS, VAKIT_LABEL, type PrayerDay, type Vakit } from '@/lib/prayer';
import { useTheme } from '@/theme/theme';
import { Glass, Skeleton, Txt } from '@/ui';

/** Six-column strip of today's times with the current vakit highlighted. */
export function TodayStrip({ day, current }: { day: PrayerDay | null; current: Vakit }) {
  const { c } = useTheme();
  const currentIdx = VAKITS.indexOf(current);
  return (
    <Glass radius={24} padded={false} style={{ flexDirection: 'row', padding: 6, gap: 2 }}>
      {VAKITS.map((v, i) => {
        const on = v === current;
        const past = i < currentIdx;
        return (
          <View
            key={v}
            accessible
            accessibilityLabel={`${VAKIT_LABEL[v]} ${day?.times[v] ?? ''}${on ? ', şu anki vakit' : ''}`}
            style={{
              flex: 1,
              alignItems: 'center',
              gap: 6,
              paddingVertical: 12,
              borderRadius: 18,
              backgroundColor: on ? c.goldTint : 'transparent',
              borderWidth: 1,
              borderColor: on ? c.goldLine : 'transparent',
            }}
          >
            <Txt v="small" color={on ? c.goldText : past ? c.text2 : c.text} weight={on ? 'semibold' : 'medium'} style={{ fontSize: 11 }}>
              {VAKIT_LABEL[v]}
            </Txt>
            {day ? (
              <Txt v="time" tnum color={past ? c.text2 : c.text} weight={on ? 'medium' : 'light'} style={{ fontSize: 15 }}>
                {day.times[v]}
              </Txt>
            ) : (
              <Skeleton width={36} height={14} />
            )}
          </View>
        );
      })}
    </Glass>
  );
}

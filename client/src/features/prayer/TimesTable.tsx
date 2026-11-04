import { useEffect, useRef } from 'react';
import { FlatList, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { HIJRI_MONTHS_TR, parseDate, weekday, MONTHS_TR } from '@/lib/dates';
import { VAKITS, VAKIT_LABEL, localDate, type PrayerDay, type Vakit } from '@/lib/prayer';
import { useTheme } from '@/theme/theme';
import { radius } from '@/theme/tokens';
import { Skeleton, Txt } from '@/ui';
import { moonName, moonPath } from './moon';

const ROW_H = 52;

/**
 * Day-by-day vakit table (aylık tablo / imsakiye). In Ramadan mode the İmsak
 * and Akşam columns become Sahur and İftar and are tinted gold.
 */
export function TimesTable({ days, ramadan, loading, currentVakit }: { days: PrayerDay[]; ramadan?: boolean; loading?: boolean; currentVakit?: Vakit }) {
  const { c, isDark } = useTheme();
  const today = localDate();
  const listRef = useRef<FlatList<PrayerDay>>(null);
  const todayIdx = days.findIndex((d) => d.date === today);
  const colTint = isDark ? 'rgba(201,169,110,0.07)' : 'rgba(201,169,110,0.10)';
  const moonLine = isDark ? 'rgba(243,238,228,0.35)' : 'rgba(26,28,33,0.35)';
  const gold = (v: Vakit) => !!ramadan && (v === 'imsak' || v === 'aksam');

  useEffect(() => {
    if (todayIdx > 3) listRef.current?.scrollToIndex({ index: todayIdx - 2, animated: false });
  }, [todayIdx]);

  return (
    <View style={{ flex: 1, minHeight: 0, padding: 4, borderRadius: radius.xl, backgroundColor: c.raised, borderWidth: 1, borderColor: c.hair }}>
      <View accessibilityRole="header" style={{ flexDirection: 'row', alignItems: 'center', minHeight: 40, paddingBottom: 2, borderBottomWidth: 1, borderBottomColor: c.hair }}>
        <View style={{ flex: 2, paddingLeft: 10 }}>
          <Txt v="small" tone="secondary" weight="semibold" style={{ fontSize: 10.5, letterSpacing: 0.8 }}>
            TARİH
          </Txt>
        </View>
        {VAKITS.map((v) => {
          const on = gold(v) || v === currentVakit;
          const color = on ? c.goldText : c.text2;
          return (
            <View key={v} style={{ flex: 1, alignItems: 'center', marginHorizontal: 1, paddingVertical: 5, borderRadius: 10, backgroundColor: gold(v) ? c.goldTint : 'transparent' }}>
              <Txt v="small" color={color} weight="semibold" style={{ fontSize: 10.5 }}>
                {VAKIT_LABEL[v]}
              </Txt>
              {ramadan && (v === 'imsak' || v === 'aksam') ? (
                <Txt v="small" color={color} weight="medium" style={{ fontSize: 9.5, lineHeight: 12 }}>
                  {v === 'imsak' ? 'Sahur' : 'İftar'}
                </Txt>
              ) : null}
            </View>
          );
        })}
      </View>
      {loading ? (
        <View style={{ paddingTop: 4 }}>
          {['46%', '58%', '40%', '52%', '62%', '44%', '56%', '48%', '60%'].map((w, i) => (
            <View key={i} aria-hidden style={{ flexDirection: 'row', alignItems: 'center', minHeight: ROW_H }}>
              <View style={{ flex: 2, gap: 6, paddingLeft: 10 }}>
                <Skeleton width={w as `${number}%`} height={10} r={5} />
                <Skeleton width="70%" height={8} r={4} />
              </View>
              {VAKITS.map((v) => (
                <View key={v} style={{ flex: 1, paddingHorizontal: 6 }}>
                  <Skeleton height={10} r={5} />
                </View>
              ))}
            </View>
          ))}
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={days}
          keyExtractor={(d) => d.date}
          contentContainerStyle={{ paddingTop: 4, gap: 2 }}
          getItemLayout={(_, i) => ({ length: ROW_H + 2, offset: (ROW_H + 2) * i, index: i })}
          onScrollToIndexFailed={() => {}}
          showsVerticalScrollIndicator={false}
          renderItem={({ item: d }) => {
            const isToday = d.date === today;
            const past = d.date < today;
            const date = parseDate(d.date);
            const wd = weekday(d.date, true);
            const fri = date.getDay() === 5;
            const h = d.hijri;
            const sub = ramadan && h?.month === 9 ? `Ramazan’ın ${h.day}. günü` : h ? `${h.day} ${HIJRI_MONTHS_TR[h.month - 1]}` : '';
            return (
              <View
                accessible
                accessibilityLabel={`${date.getDate()} ${MONTHS_TR[date.getMonth()]} ${weekday(d.date)}${isToday ? ', bugün' : ''}. ${VAKITS.map((v) => `${VAKIT_LABEL[v]} ${d.times[v]}`).join(', ')}`}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  minHeight: ROW_H,
                  borderRadius: 14,
                  backgroundColor: isToday ? c.goldTint : 'transparent',
                  borderWidth: 1,
                  borderColor: isToday ? c.goldLine : 'transparent',
                }}
              >
                {fri && !isToday ? <FridayRule color={c.goldLine} /> : null}
                <View style={{ flex: 2, flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 7, minWidth: 0 }}>
                  {h ? (
                    <Svg width={12} height={12} viewBox="0 0 14 14" role="img" accessibilityLabel={moonName(h.day)}>
                      <Circle cx="7" cy="7" r="5.5" fill="none" stroke={moonLine} strokeWidth={0.9} />
                      <Path d={moonPath(h.day)} fill={isDark ? '#E3CFA4' : '#84652C'} opacity={0.85} />
                    </Svg>
                  ) : (
                    <View style={{ width: 12 }} />
                  )}
                  <View style={{ minWidth: 0, flexShrink: 1 }}>
                    <Txt v="sub" numberOfLines={1} color={past ? c.text2 : c.text} weight={isToday ? 'semibold' : 'medium'} style={{ fontSize: 13 }}>
                      {date.getDate()} {MONTHS_TR[date.getMonth()]!.slice(0, 3)}{' '}
                      <Txt v="sub" color={fri ? c.goldText : c.text2} weight={fri ? 'semibold' : 'regular'} style={{ fontSize: 13 }}>
                        {wd}
                      </Txt>
                    </Txt>
                    <Txt v="small" numberOfLines={1} color={isToday ? c.goldText : c.text2} style={{ fontSize: 10, lineHeight: 13 }}>
                      {sub}
                    </Txt>
                  </View>
                </View>
                {VAKITS.map((v) => (
                  <View key={v} style={{ flex: 1, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center', backgroundColor: gold(v) ? colTint : 'transparent' }}>
                    <Txt v="time" tnum color={past ? c.text2 : gold(v) ? c.goldText : c.text} weight={isToday ? 'medium' : 'light'} style={{ fontSize: 13 }}>
                      {d.times[v]}
                    </Txt>
                  </View>
                ))}
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

/** Dashed gold rule above Fridays (RN web ignores per-side border styles). */
function FridayRule({ color }: { color: string }) {
  return (
    <View aria-hidden style={{ position: 'absolute', left: 6, right: 6, top: -1, height: 1, overflow: 'hidden' }}>
      <View style={{ height: 2, borderWidth: 1, borderColor: color, borderStyle: 'dashed' }} />
    </View>
  );
}

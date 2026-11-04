import { LinearGradient } from 'expo-linear-gradient';
import { forwardRef } from 'react';
import { Text, View, type TextStyle, type ViewInstance } from 'react-native';
import Svg, { Circle, G, Rect } from 'react-native-svg';
import { MONTHS_TR, parseDate, weekday } from '@/lib/dates';
import { VAKITS, VAKIT_LABEL, type PrayerDay } from '@/lib/prayer';
import { dark, fonts, light, skyFor, type ThemeName } from '@/theme/tokens';
import { Girih } from '@/ui';

/** Logical size; captured at 3× → 1080 × 1350 PNG (Instagram portrait). */
export const CARD_W = 360;
export const CARD_H = 450;

/**
 * Shareable timetable card. Self-contained styles (no theme context) so it
 * renders identically whatever the app theme is.
 */
export const ShareCard = forwardRef<ViewInstance, { days: PrayerDay[]; place: string; theme: ThemeName; ramadan: boolean }>(function ShareCard(
  { days, place, theme, ramadan },
  ref,
) {
  const c = theme === 'dark' ? dark : light;
  const sky = skyFor(ramadan ? 'aksam' : theme === 'dark' ? 'yatsi' : 'ogle', theme);
  const t = (s: TextStyle): TextStyle => ({ color: c.text, ...s });
  const first = days[0];
  const last = days[days.length - 1];
  const range = first && last ? `${parseDate(first.date).getDate()} ${MONTHS_TR[parseDate(first.date).getMonth()]} – ${parseDate(last.date).getDate()} ${MONTHS_TR[parseDate(last.date).getMonth()]} ${last.date.slice(0, 4)}` : '';
  const goldText = c.goldText;

  return (
    <View ref={ref} collapsable={false} style={{ width: CARD_W, height: CARD_H, backgroundColor: c.bg, overflow: 'hidden' }}>
      <LinearGradient colors={sky.colors} locations={sky.locations} style={{ position: 'absolute', left: 0, right: 0, top: 0, height: CARD_H }} />
      <Girih width={CARD_W} height={233} tile={40} color={theme === 'dark' ? '#E3CFA4' : '#84652C'} opacity={theme === 'dark' ? 0.05 : 0.07} />
      <View style={{ flex: 1, paddingVertical: 24, paddingHorizontal: 26 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <Svg width={15} height={15} viewBox="0 0 128 128">
              <Circle cx="64" cy="64" r="62" fill="none" stroke={c.gold} strokeWidth={2} opacity={0.5} />
              <G fill="none" stroke={c.gold} strokeWidth={3}>
                <Rect x="34" y="34" width="60" height="60" />
                <Rect x="34" y="34" width="60" height="60" transform="rotate(45 64 64)" />
                <Circle cx="64" cy="64" r="18" />
              </G>
            </Svg>
            <Text style={t({ fontFamily: fonts.title, fontSize: 11.3 })}>Vakit</Text>
          </View>
          <Text style={t({ fontFamily: fonts.regular, fontSize: 8, color: c.sub })}>{place}</Text>
        </View>
        <Text style={t({ marginTop: 14, fontFamily: fonts.display, fontSize: 37, lineHeight: 38, letterSpacing: -1.1 })}>{ramadan ? 'İmsakiye' : 'Vakitler'}</Text>
        <Text style={t({ marginTop: 5, fontFamily: fonts.displayItalic, fontSize: 10.7, lineHeight: 13, color: goldText })}>
          {ramadan && first?.hijri ? `Ramazan ${first.hijri.year} · ` : ''}
          {range}
        </Text>

        <View style={{ marginTop: 13, paddingVertical: 8, paddingHorizontal: 9, borderRadius: 13, backgroundColor: c.glass, borderWidth: 0.5, borderColor: c.stroke, flexDirection: 'row', gap: 9 }}>
          {ramadan ? (
            [days.slice(0, 15), days.slice(15, 30)].map((col, ci) => (
              <View key={ci} style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', height: 13, alignItems: 'center', borderBottomWidth: 0.5, borderBottomColor: c.hair }}>
                  <Head w={20} c={c.text2}>GÜN</Head>
                  <Head flex c={c.text2}>TARİH</Head>
                  <Head w={36} c={goldText} center>SAHUR</Head>
                  <Head w={36} c={goldText} center>İFTAR</Head>
                </View>
                {col.map((d) => {
                  const fri = parseDate(d.date).getDay() === 5;
                  return (
                    <View key={d.date} style={{ flexDirection: 'row', height: 14.7, alignItems: 'center', borderTopWidth: 0.5, borderTopColor: fri ? c.goldLine : 'transparent', borderStyle: fri ? 'dashed' : 'solid' }}>
                      <Text style={t({ width: 20, fontFamily: fonts.title, fontSize: 8.7, color: goldText })}>{d.hijri?.day ?? ''}</Text>
                      <Text numberOfLines={1} style={t({ flex: 1, fontFamily: fonts.regular, fontSize: 7, color: c.sub })}>
                        {parseDate(d.date).getDate()} {MONTHS_TR[parseDate(d.date).getMonth()]!.slice(0, 3)}{' '}
                        <Text style={{ color: fri ? goldText : c.text2, fontFamily: fri ? fonts.semibold : fonts.regular }}>{weekday(d.date, true)}</Text>
                      </Text>
                      <Text style={t({ width: 36, textAlign: 'center', fontFamily: fonts.regular, fontSize: 8.3, fontVariant: ['tabular-nums'] })}>{d.times.imsak}</Text>
                      <Text style={t({ width: 36, textAlign: 'center', fontFamily: fonts.regular, fontSize: 8.3, fontVariant: ['tabular-nums'] })}>{d.times.aksam}</Text>
                    </View>
                  );
                })}
              </View>
            ))
          ) : (
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', height: 13, alignItems: 'center', borderBottomWidth: 0.5, borderBottomColor: c.hair }}>
                <Head flex c={c.text2}>TARİH</Head>
                {VAKITS.map((v) => (
                  <Head key={v} w={34} c={c.text2} center>
                    {VAKIT_LABEL[v].toLocaleUpperCase('tr')}
                  </Head>
                ))}
              </View>
              {days.slice(0, 16).map((d) => {
                const fri = parseDate(d.date).getDay() === 5;
                return (
                  <View key={d.date} style={{ flexDirection: 'row', height: 14.5, alignItems: 'center', borderTopWidth: 0.5, borderTopColor: fri ? c.goldLine : 'transparent', borderStyle: fri ? 'dashed' : 'solid' }}>
                    <Text numberOfLines={1} style={t({ flex: 1, fontFamily: fonts.regular, fontSize: 7, color: c.sub })}>
                      {parseDate(d.date).getDate()} {MONTHS_TR[parseDate(d.date).getMonth()]!.slice(0, 3)}{' '}
                      <Text style={{ color: fri ? goldText : c.text2, fontFamily: fri ? fonts.semibold : fonts.regular }}>{weekday(d.date, true)}</Text>
                    </Text>
                    {VAKITS.map((v) => (
                      <Text key={v} style={t({ width: 34, textAlign: 'center', fontFamily: fonts.regular, fontSize: 8, fontVariant: ['tabular-nums'] })}>
                        {d.times[v]}
                      </Text>
                    ))}
                  </View>
                );
              })}
            </View>
          )}
        </View>

        <View style={{ marginTop: 'auto', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', gap: 13 }}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={t({ fontFamily: fonts.arabic, fontSize: 11.3, lineHeight: 17, writingDirection: 'rtl', textAlign: 'left' })}>
              {ramadan ? 'شَهْرُ رَمَضَانَ الَّذِي أُنْزِلَ فِيهِ الْقُرْآنُ' : 'إِنَّ الصَّلَاةَ كَانَتْ عَلَى الْمُؤْمِنِينَ كِتَابًا مَوْقُوتًا'}
            </Text>
            <Text style={t({ fontFamily: fonts.regular, fontSize: 6.7, color: c.sub })}>
              {ramadan ? '“Ramazan ayı, Kur’an’ın indirildiği aydır.” · Bakara 185' : '“Namaz, müminlere belirli vakitlere bağlı olarak farz kılınmıştır.” · Nisâ 103'}
            </Text>
          </View>
          <Text style={t({ fontFamily: fonts.regular, fontSize: 6, color: c.text2 })}>Hesaplama: Diyanet</Text>
        </View>
      </View>
    </View>
  );
});

function Head({ children, w, flex, c, center }: { children: string; w?: number; flex?: boolean; c: string; center?: boolean }) {
  return (
    <Text style={{ width: w, flex: flex ? 1 : undefined, color: c, fontFamily: fonts.semibold, fontSize: 5.7, letterSpacing: 0.7, textAlign: center ? 'center' : 'left' }}>
      {children}
    </Text>
  );
}

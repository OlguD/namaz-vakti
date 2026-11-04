import { useRouter } from 'expo-router';
import { Share, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { usePlace } from '@/features/location/store';
import { clock, hijriLabel, longDate } from '@/lib/dates';
import { countdownLabel, formatCountdown, vakitState } from '@/lib/prayer';
import { useTheme } from '@/theme/theme';
import { dark } from '@/theme/tokens';
import { Glass, Icon, IconButton, Rosette, Screen, Touch, Txt } from '@/ui';
import { useNow, usePrayerTimes } from './api';

const NIYET_AR = 'وَبِصَوْمِ غَدٍ نَوَيْتُ مِنْ شَهْرِ رَمَضَانَ';
const NIYET_TR = 'Ramazan ayının bugünkü orucunu tutmaya niyet ettim.';

// Fasting arc: chord (16,112)→(337,112) on a circle of r=186 centred below.
const CX = 176.5;
const CY = 112 + Math.sqrt(186 ** 2 - 160.5 ** 2);
const A0 = Math.atan2(112 - CY, 16 - CX);
const A1 = Math.atan2(112 - CY, 337 - CX);

type Phase = 'sahur' | 'fasting' | 'iftar';

/** Ramadan mode of the home screen: sahur / iftar countdown and the fasting arc. */
export function RamadanHome() {
  const router = useRouter();
  const place = usePlace((s) => s.place)!;
  const q = usePrayerTimes();
  const now = useNow();
  const { isDark } = useTheme();
  const ink = dark; // Ramadan sky is always dark enough for light text.
  const days = q.data?.days ?? [];
  const { today } = vakitState(days, now);
  const tomorrow = today ? days[days.indexOf(today) + 1] : undefined;

  const at = (iso: string | undefined, date: string, hhmm: string) => (iso ? new Date(iso) : new Date(`${date}T${hhmm}:00`));
  const imsak = today ? at(today.instants?.imsak, today.date, today.times.imsak) : null;
  const iftar = today ? at(today.instants?.aksam, today.date, today.times.aksam) : null;
  const nextImsak = tomorrow ? at(tomorrow.instants?.imsak, tomorrow.date, tomorrow.times.imsak) : null;

  let phase: Phase = 'sahur';
  if (imsak && iftar) phase = now < imsak ? 'sahur' : now < iftar ? 'fasting' : 'iftar';
  const target = phase === 'sahur' ? imsak : phase === 'fasting' ? iftar : nextImsak;
  const remaining = target ? target.getTime() - now.getTime() : 0;
  const progress = imsak && iftar ? Math.min(1, Math.max(0, (now.getTime() - imsak.getTime()) / (iftar.getTime() - imsak.getTime()))) : 0;
  const reminder = imsak ? clock(new Date(imsak.getTime() - 30 * 60_000)) : '';
  const ramadanDay = today?.hijri?.day ?? 1;

  const a = A0 + (A1 - A0) * (phase === 'sahur' ? 0 : phase === 'iftar' ? 1 : progress);
  const dot = { x: CX + 186 * Math.cos(a), y: CY + 186 * Math.sin(a) };
  const caption = phase === 'fasting' ? 'İFTARA KALAN' : 'SAHURA KALAN';
  const footer =
    phase === 'fasting' ? `İftar akşam ezanıyla · ${today?.times.aksam ?? ''}` : `Sahur imsakla biter · ${(phase === 'iftar' ? tomorrow?.times.imsak : today?.times.imsak) ?? ''}`;
  const middle =
    phase === 'sahur'
      ? ['Oruç başlamadı', `Hatırlatma ${reminder}`]
      : phase === 'fasting'
        ? ['Oruçlusunuz', `%${Math.round(progress * 100)} tamamlandı`]
        : ['Oruç tamamlandı', 'Hayırlı iftarlar'];
  const hijri = today?.hijri?.long ?? hijriLabel(today?.hijri);

  return (
    <Screen tabs sky="aksam" refreshing={q.isFetching && !q.isLoading} onRefresh={q.refetch}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ gap: 6, flex: 1 }}>
          <View style={{ alignSelf: 'flex-start', height: 24, paddingHorizontal: 10, borderRadius: 999, backgroundColor: 'rgba(201,169,110,0.16)', borderWidth: 1, borderColor: 'rgba(201,169,110,0.45)', justifyContent: 'center' }}>
            <Txt v="caption" color={ink.goldText} weight="semibold" style={{ letterSpacing: 1.1 }}>
              {`Ramazan · ${ramadanDay}. gün`}
            </Txt>
          </View>
          <Touch onPress={() => router.push('/konum')} accessibilityRole="button" accessibilityLabel={`Konum: ${place.name}. Değiştir`}>
            <Txt v="hero" color={ink.text} numberOfLines={1}>
              {place.name}
            </Txt>
          </Touch>
          <Txt v="sub" color={ink.sub}>
            {longDate(now)}
            {hijri ? (
              <>
                {' · '}
                <Txt v="sub" color={ink.sub} weight="displayItalic">
                  {hijri}
                </Txt>
              </>
            ) : null}
          </Txt>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <IconButton icon="chat" label="Sohbet" tone={ink.text} onPress={() => router.push('/sohbet')} />
          <IconButton icon="sliders" label="Ayarlar" tone={ink.text} onPress={() => router.push('/ayarlar')} />
        </View>
      </View>

      <View accessible accessibilityRole="timer" accessibilityLabel={`${phase === 'fasting' ? 'İftara' : 'Sahura'} ${countdownLabel(remaining)} kaldı`} style={{ alignItems: 'center', gap: 8, marginTop: 22 }}>
        <Txt v="caption" color={ink.goldText}>
          {caption}
        </Txt>
        <Txt v="countdown" tnum color={ink.text} style={{ fontSize: 60, lineHeight: 64, letterSpacing: -1.5 }}>
          {formatCountdown(remaining)}
        </Txt>
        <Txt v="sub" color={ink.sub} tnum>
          {footer}
        </Txt>
      </View>

      <View accessible accessibilityLabel={`Bugünkü oruç: ${middle[0]}`} style={{ marginTop: 14 }}>
        <Svg width="100%" height={132} viewBox="0 0 353 132" aria-hidden>
          <Path d="M0 112H353" stroke="rgba(243,238,228,0.18)" strokeWidth={1} />
          <Path d="M16 112A186 186 0 0 1 337 112" fill="none" stroke="rgba(243,238,228,0.30)" strokeWidth={1.5} strokeLinecap="round" strokeDasharray="1.5 6" />
          {phase !== 'sahur' ? (
            <Path
              d={`M16 112A186 186 0 0 1 ${dot.x.toFixed(1)} ${dot.y.toFixed(1)}`}
              fill="none"
              stroke="#C9A96E"
              strokeWidth={2}
              strokeLinecap="round"
            />
          ) : null}
          <Circle cx={dot.x} cy={dot.y} r={16} fill="rgba(201,169,110,0.20)" />
          <Circle cx={dot.x} cy={dot.y} r={6} fill={phase === 'fasting' ? '#E3CFA4' : '#0B0F17'} stroke="#C9A96E" strokeWidth={1.5} />
        </Svg>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: 8 }}>
          <View style={{ gap: 2 }}>
            <Txt v="caption" color={phase === 'sahur' ? ink.goldText : ink.text2} style={{ letterSpacing: 1.1 }}>
              İmsak
            </Txt>
            <Txt v="time" tnum color={ink.text} style={{ fontSize: 15 }}>
              {today?.times.imsak ?? '--:--'}
            </Txt>
          </View>
          <View style={{ alignItems: 'center', gap: 2, paddingTop: 2 }}>
            <Txt v="small" color={ink.text2}>
              {middle[0]}
            </Txt>
            <Txt v="small" color={ink.text2} tnum>
              {middle[1]}
            </Txt>
          </View>
          <View style={{ alignItems: 'flex-end', gap: 2 }}>
            <Txt v="caption" color={phase === 'fasting' ? ink.goldText : ink.text2} style={{ letterSpacing: 1.1 }}>
              İftar
            </Txt>
            <Txt v="time" tnum color={ink.text} style={{ fontSize: 15 }}>
              {today?.times.aksam ?? '--:--'}
            </Txt>
          </View>
        </View>
      </View>

      <Glass style={{ marginTop: 18, paddingHorizontal: 18, gap: 8 }}>
        <Rosette size={140} style={{ right: -36, top: -36 }} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Txt v="caption" tone="gold">
            Oruç niyeti
          </Txt>
          <Touch
            onPress={() => void Share.share({ message: `${NIYET_AR}\n“${NIYET_TR}”` })}
            accessibilityRole="button"
            accessibilityLabel="Niyeti paylaş"
            style={{ width: 44, height: 44, margin: -12, alignItems: 'center', justifyContent: 'center' }}
          >
            <Icon name="share" size={18} color={isDark ? ink.text2 : undefined} />
          </Touch>
        </View>
        <Txt v="arabic" lang="ar" style={{ fontSize: 24, lineHeight: 40 }}>
          {NIYET_AR}
        </Txt>
        <Txt v="sub" tone="sub">
          “{NIYET_TR}”
        </Txt>
      </Glass>

      <Touch onPress={() => router.push('/imsakiye')} accessibilityRole="button" accessibilityLabel="İmsakiye, 30 günlük tablo" style={{ marginTop: 12 }}>
        <Glass radius={20} style={{ minHeight: 56, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <View style={{ width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(201,169,110,0.14)' }}>
            <Icon name="calendar" size={18} color="#E3CFA4" />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Txt v="callout">İmsakiye</Txt>
            <Txt v="small" tone="secondary">
              Ramazan {today?.hijri?.year ?? ''} · 30 günlük tablo
            </Txt>
          </View>
          <Icon name="forward" size={18} color={ink.text2} />
        </Glass>
      </Touch>
    </Screen>
  );
}

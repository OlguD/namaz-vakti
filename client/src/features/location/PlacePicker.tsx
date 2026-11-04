import { onlineManager } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, TextInput, View } from 'react-native';
import type { LocationEntry } from '@/api/types';
import { titleTr } from '@/lib/text';
import { useTheme } from '@/theme/theme';
import { fonts, radius } from '@/theme/tokens';
import { Button, Icon, Notice, Skeleton, StateView, Touch, Txt, tapFeedback } from '@/ui';
import { fetchDistrict, loadRecents, matches, pushRecent, useCities, useCountries, useDistricts } from './api';
import { placeFromDistrict, savePlace, type SavedPlace } from './store';

const TURKIYE = '2';

type Step = 'country' | 'city' | 'district';

/**
 * Country → city → district picker with search and recent places. Ends by
 * saving the district as a manual place and calling onDone.
 */
export function PlacePicker({
  onDone,
  initialCityId,
  ctaLabel = 'Devam et',
}: {
  onDone: (place: SavedPlace) => void;
  initialCityId?: string | null;
  ctaLabel?: string;
}) {
  const { c } = useTheme();
  const [countryId, setCountryId] = useState<string>(TURKIYE);
  const [cityId, setCityId] = useState<string | null>(initialCityId ?? null);
  const [step, setStep] = useState<Step>(initialCityId ? 'district' : 'city');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<LocationEntry | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recents, setRecents] = useState<SavedPlace[]>([]);

  const countries = useCountries();
  const cities = useCities(countryId);
  const districts = useDistricts(cityId);

  useEffect(() => {
    void loadRecents().then(setRecents);
  }, []);

  const country = countries.data?.find((x) => x.id === countryId);
  const city = cities.data?.find((x) => x.id === cityId);

  const source = step === 'country' ? countries : step === 'city' ? cities : districts;
  const rows = useMemo(
    () => (source.data ?? []).filter((r) => matches(titleTr(r.name), query)),
    [source.data, query],
  );
  const offline = !onlineManager.isOnline() || (source.isError && !!source.data);
  const stepNoun = step === 'country' ? 'ülke' : step === 'city' ? 'şehir' : 'ilçe';

  function go(next: Step) {
    setQuery('');
    setSelected(null);
    setStep(next);
  }

  function pick(row: LocationEntry) {
    tapFeedback();
    if (step === 'country') {
      setCountryId(row.id);
      setCityId(null);
      go('city');
    } else if (step === 'city') {
      setCityId(row.id);
      go('district');
    } else {
      setSelected(row);
    }
  }

  async function confirm(districtId: string) {
    setSaving(true);
    setError(null);
    try {
      const d = await fetchDistrict(districtId);
      const place = placeFromDistrict(d, 'manual');
      await savePlace(place);
      await pushRecent(place);
      onDone(place);
    } catch {
      setError('Konum kaydedilemedi. Bağlantınızı kontrol edip tekrar deneyin.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={{ flex: 1, minHeight: 0 }}>
      <View accessibilityRole="toolbar" accessibilityLabel="Konum adımları" style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
        <Crumb label={country ? titleTr(country.name) : 'Ülke'} active={step === 'country'} onPress={() => go('country')} />
        {step !== 'country' ? <Crumb label={city ? titleTr(city.name) : 'Şehir'} active={step === 'city'} onPress={() => go('city')} /> : null}
        {step === 'district' ? <Crumb label="İlçe" active /> : null}
      </View>

      {offline ? (
        <View style={{ marginTop: 12 }}>
          <Notice icon="offline" title={`Çevrimdışı — kayıtlı ${stepNoun} listesi gösteriliyor`} />
        </View>
      ) : null}

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          height: 48,
          marginTop: 12,
          paddingLeft: 14,
          paddingRight: 6,
          borderRadius: radius.md,
          backgroundColor: c.input,
          borderWidth: 1,
          borderColor: c.stroke,
          opacity: source.isLoading ? 0.5 : 1,
        }}
      >
        <Icon name="search" size={18} color={c.text2} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          editable={!source.isLoading}
          placeholder={`${titleTr(stepNoun)} ara`}
          placeholderTextColor={c.text3}
          accessibilityLabel={`${titleTr(stepNoun)} ara`}
          autoCorrect={false}
          returnKeyType="search"
          style={{ flex: 1, minWidth: 0, color: c.text, fontFamily: fonts.regular, fontSize: 15, height: 46 }}
        />
        {query ? (
          <Touch onPress={() => setQuery('')} accessibilityRole="button" accessibilityLabel="Aramayı temizle" style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: c.hair }}>
            <Icon name="close" size={16} color={c.text2} />
          </Touch>
        ) : null}
      </View>

      {!query && recents.length > 0 ? (
        <View style={{ marginTop: 18, gap: 8 }}>
          <Txt v="caption" tone="secondary">
            Son kullanılanlar
          </Txt>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            {recents.slice(0, 3).map((r) => (
              <Touch
                key={r.districtId}
                onPress={() => void confirm(r.districtId!)}
                accessibilityRole="button"
                accessibilityLabel={`${r.name}, ${r.city ?? ''} seç`}
                style={{ minHeight: 36, paddingHorizontal: 12, borderRadius: radius.sm, borderWidth: 1, borderColor: c.stroke, backgroundColor: c.glass, flexDirection: 'row', alignItems: 'center', gap: 6 }}
              >
                <Icon name="history" size={14} color={c.text2} />
                <Txt v="subStrong">
                  {r.name}
                  {r.city && r.city !== r.name ? ` · ${r.city}` : ''}
                </Txt>
              </Touch>
            ))}
          </View>
        </View>
      ) : null}

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 18 }}>
        <Txt v="caption" tone="secondary">
          {query ? 'Arama sonuçları' : step === 'district' && city ? `${titleTr(city.name)} ilçeleri` : step === 'city' ? `${country ? titleTr(country.name) : ''} şehirleri` : 'Ülkeler'}
        </Txt>
        <Txt v="small" tone="secondary" tnum>
          {source.isLoading ? 'Yükleniyor…' : String(rows.length)}
        </Txt>
      </View>

      <View
        accessibilityState={{ busy: source.isLoading }}
        style={{ flex: 1, minHeight: 160, marginTop: 8, marginBottom: 12, padding: 4, borderRadius: radius.xl, backgroundColor: c.raised, borderWidth: 1, borderColor: c.hair, overflow: 'hidden' }}
      >
        {source.isLoading ? (
          <View>
            {['42%', '58%', '36%', '50%', '64%', '40%', '54%'].map((w, i) => (
              <View key={i} style={{ minHeight: 52, justifyContent: 'center', paddingHorizontal: 16 }}>
                <Skeleton width={w as `${number}%`} height={12} r={6} />
              </View>
            ))}
          </View>
        ) : source.isError && !source.data ? (
          <StateView icon="offline" tone="caution" title="Liste yüklenemedi" body="Bağlantınızı kontrol edip tekrar deneyin." action={<Button label="Tekrar dene" kind="secondary" onPress={() => void source.refetch()} />} />
        ) : rows.length === 0 ? (
          <StateView
            icon="search"
            title="Sonuç bulunamadı"
            body={`“${query}” ile eşleşen ${stepNoun} yok. Yazımı kontrol edin ya da üst adımdan değiştirin.`}
            action={<Button label="Aramayı temizle" kind="secondary" compact onPress={() => setQuery('')} />}
          />
        ) : (
          <FlatList
            data={rows}
            keyExtractor={(r) => r.id}
            keyboardShouldPersistTaps="handled"
            initialNumToRender={20}
            renderItem={({ item }) => {
              const on = selected?.id === item.id;
              return (
                <Touch
                  onPress={() => pick(item)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={titleTr(item.name)}
                  style={{ minHeight: 52, paddingHorizontal: 16, borderRadius: radius.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: on ? c.goldTint : 'transparent' }}
                >
                  <Txt v="body" weight={on ? 'semibold' : 'regular'}>
                    {titleTr(item.name)}
                  </Txt>
                  {on ? <Icon name="check" size={18} color={c.goldText} /> : step !== 'district' ? <Icon name="forward" size={16} color={c.text3} /> : null}
                </Touch>
              );
            }}
          />
        )}
      </View>

      {error ? (
        <View style={{ marginBottom: 10 }}>
          <Notice title={error} />
        </View>
      ) : null}
      <Button
        label={selected ? `${ctaLabel} · ${titleTr(selected.name)}${city ? `, ${titleTr(city.name)}` : ''}` : ctaLabel}
        disabled={!selected}
        loading={saving}
        onPress={() => selected && void confirm(selected.id)}
      />
    </View>
  );
}

function Crumb({ label, active, onPress }: { label: string; active?: boolean; onPress?: () => void }) {
  const { c } = useTheme();
  return (
    <Touch
      onPress={active ? undefined : onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: !!active }}
      accessibilityLabel={active ? `${label}, geçerli adım` : `${label}, değiştir`}
      style={{
        minHeight: 36,
        paddingHorizontal: 12,
        borderRadius: radius.sm,
        borderWidth: 1,
        borderColor: active ? c.goldLine : c.hair,
        backgroundColor: active ? c.goldTint : 'transparent',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
      }}
    >
      <Txt v="subStrong" color={active ? c.goldText : c.text} weight={active ? 'semibold' : 'medium'}>
        {label}
      </Txt>
      {!active ? <Icon name="forward" size={12} color={c.text3} /> : null}
    </Touch>
  );
}

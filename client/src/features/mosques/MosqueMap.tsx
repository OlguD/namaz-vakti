import { useEffect, useRef } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT, type Region } from 'react-native-maps';
import { useTheme } from '@/theme/theme';
import { mosqueName } from './api';
import { radiusForSpan, regionFor } from './format';
import type { MosqueMapProps, PinPickerProps } from './map-types';
import { MosquePin, NearestPin, UserDot } from './pins';

/** Muted night style for Google Maps on Android (Apple Maps follows the system theme). */
const DARK_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#0B0F17' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#A9A59C' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0B0F17' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#262C3A' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#5A4A2C' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0D1B2E' }] },
  { featureType: 'landscape.natural', elementType: 'geometry', stylers: [{ color: '#111823' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
];

const LIGHT_STYLE = [
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { elementType: 'geometry', stylers: [{ saturation: -40 }] },
];

/** Native map (Apple Maps on iOS, Google Maps on Android). Web: MosqueMap.web.tsx. */
export function MosqueMap({
  center,
  recenterKey,
  radius = 1500,
  mosques,
  nearestId,
  selectedId,
  user,
  onSelect,
  onRegionChange,
  bottomInset = 0,
  nearestLabel,
  accessibilityLabel,
}: MosqueMapProps) {
  const { isDark } = useTheme();
  const ref = useRef<MapView>(null);

  useEffect(() => {
    if (recenterKey == null) return;
    ref.current?.animateToRegion(regionFor(center, radius), 400);
    // Only when asked to recenter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recenterKey]);

  return (
    <View style={StyleSheet.absoluteFill} accessibilityLabel={accessibilityLabel}>
      <MapView
        ref={ref}
        style={StyleSheet.absoluteFill}
        provider={PROVIDER_DEFAULT}
        initialRegion={regionFor(center, radius)}
        userInterfaceStyle={isDark ? 'dark' : 'light'}
        customMapStyle={Platform.OS === 'android' ? (isDark ? DARK_STYLE : LIGHT_STYLE) : undefined}
        showsPointsOfInterests={false}
        showsCompass={false}
        toolbarEnabled={false}
        pitchEnabled={false}
        mapPadding={{ top: 0, right: 0, left: 0, bottom: bottomInset }}
        onRegionChangeComplete={(r: Region, details?: { isGesture?: boolean }) => {
          if (details && details.isGesture === false) return;
          onRegionChange?.({ lat: r.latitude, lng: r.longitude }, radiusForSpan(r.latitudeDelta, r.longitudeDelta, r.latitude));
        }}
      >
        {user ? (
          <Marker coordinate={{ latitude: user.lat, longitude: user.lng }} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false} accessibilityLabel="Konumunuz">
            <UserDot />
          </Marker>
        ) : null}
        {mosques.map((m) => {
          const nearest = m.id === nearestId;
          return (
            <Marker
              key={m.id}
              coordinate={{ latitude: m.lat, longitude: m.lng }}
              anchor={nearest ? { x: 0.11, y: 0.5 } : { x: 0.5, y: 0.5 }}
              onPress={() => onSelect?.(m)}
              tracksViewChanges={false}
              accessibilityLabel={`${mosqueName(m)}${nearest ? ', en yakın' : ''}`}
              zIndex={nearest ? 2 : m.id === selectedId ? 3 : 1}
            >
              {nearest ? <NearestPin name={mosqueName(m)} label={nearestLabel} /> : <MosquePin selected={m.id === selectedId} />}
            </Marker>
          );
        })}
      </MapView>
    </View>
  );
}

/** Map with a fixed centre pin: drag the map to move the pin (suggestion form). */
export function PinPickerMap({ center, recenterKey, onChange, height = 172 }: PinPickerProps) {
  const { isDark, c } = useTheme();
  const ref = useRef<MapView>(null);
  useEffect(() => {
    if (recenterKey == null) return;
    ref.current?.animateToRegion(regionFor(center, 150), 400);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recenterKey]);
  return (
    <View style={{ height, borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: c.stroke }}>
      <MapView
        ref={ref}
        style={StyleSheet.absoluteFill}
        initialRegion={regionFor(center, 150)}
        userInterfaceStyle={isDark ? 'dark' : 'light'}
        customMapStyle={Platform.OS === 'android' ? (isDark ? DARK_STYLE : LIGHT_STYLE) : undefined}
        showsPointsOfInterests={false}
        toolbarEnabled={false}
        onRegionChangeComplete={(r: Region) => onChange({ lat: r.latitude, lng: r.longitude })}
      />
      <CenterPin />
    </View>
  );
}

function CenterPin() {
  const { c } = useTheme();
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ marginTop: -36, alignItems: 'center' }}>
        <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: c.gold, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: '#FFFCF6' }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c.onGold }} />
        </View>
        <View style={{ width: 2, height: 12, backgroundColor: c.gold }} />
        <View style={{ width: 12, height: 5, borderRadius: 6, backgroundColor: 'rgba(0,0,0,0.35)' }} />
      </View>
    </View>
  );
}

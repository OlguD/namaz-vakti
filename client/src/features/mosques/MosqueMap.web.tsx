import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useEffect, useMemo, useRef } from 'react';
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import { View } from 'react-native';
import { useTheme } from '@/theme/theme';
import { mosqueName } from './api';
import { zoomFor, type LatLng } from './format';
import type { MosqueMapProps, PinPickerProps } from './map-types';

/**
 * Web map: Leaflet + OpenStreetMap tiles. Tiles are toned with a CSS filter so
 * they sit calmly under the dark / ivory UI (OSM forbids nothing here; the
 * attribution is shown by the screen).
 */
const STYLE_ID = 'vakit-leaflet-theme';
function useTileTheme() {
  useEffect(() => {
    if (document.getElementById(STYLE_ID)) return;
    const el = document.createElement('style');
    el.id = STYLE_ID;
    el.textContent = `
      .vakit-map{background:#0B0F17}
      .vakit-map.light{background:#F6F1E7}
      .vakit-map .leaflet-tile-pane{filter:invert(1) hue-rotate(180deg) brightness(.78) contrast(.92) saturate(.35)}
      .vakit-map.light .leaflet-tile-pane{filter:saturate(.45) sepia(.18) brightness(1.02)}
      .vakit-map .leaflet-control-attribution{display:none}
      .vakit-map .leaflet-marker-icon{background:none;border:none}
      .vakit-map .leaflet-control-zoom{display:none}
      .vakit-pin{width:44px;height:44px;display:flex;align-items:center;justify-content:center;cursor:pointer}
      .vakit-pin span.dot{width:34px;height:34px;border-radius:999px;display:flex;align-items:center;justify-content:center;box-shadow:0 6px 14px -6px rgba(0,0,0,.5)}
      .vakit-near{display:flex;align-items:center;gap:8px;cursor:pointer;font-family:Inter_400Regular,Inter,system-ui,sans-serif}
      .vakit-near .big{width:44px;height:44px;flex:none;border-radius:999px;display:flex;align-items:center;justify-content:center;background:#C9A96E;color:#1A1408}
      .vakit-near .lbl{display:flex;flex-direction:column;padding:5px 10px;border-radius:12px;white-space:nowrap;box-shadow:0 8px 18px -10px rgba(0,0,0,.5);backdrop-filter:blur(16px)}
      .vakit-near .lbl b{font-family:Inter_600SemiBold,Inter,system-ui,sans-serif;font-weight:600;font-size:12px}
      .vakit-near .lbl i{font-style:normal;font-size:11px}
      .vakit-user{width:60px;height:60px;border-radius:999px;display:flex;align-items:center;justify-content:center}
      .vakit-user span{width:16px;height:16px;border-radius:999px}
    `;
    document.head.appendChild(el);
  }, []);
}

const MOSQUE_SVG = (color: string, size: number, sw: number) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 20h17M5.5 20v-5.5a6.5 6.5 0 0 1 13 0V20M12 3v4.5M10 20v-3a2 2 0 0 1 4 0v3"/></svg>`;

const esc = (s: string) => s.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!);

function Recenter({ center, zoom, k }: { center: LatLng; zoom: number; k?: number }) {
  const map = useMap();
  useEffect(() => {
    if (k == null) return;
    map.flyTo([center.lat, center.lng], zoom, { duration: 0.4 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [k]);
  return null;
}

/** Moves the view so the centre sits in the part not covered by a bottom sheet. */
function InsetPan({ bottom }: { bottom: number }) {
  const map = useMap();
  const done = useRef(false);
  useEffect(() => {
    if (done.current || bottom <= 0) return;
    done.current = true;
    map.panBy([0, bottom / 2], { animate: false });
  }, [map, bottom]);
  return null;
}

function Events({ onMove }: { onMove?: (c: LatLng, radius: number) => void }) {
  const map = useMapEvents({
    moveend: () => {
      const b = map.getBounds();
      const ctr = map.getCenter();
      const radius = Math.max(b.getNorthEast().distanceTo(ctr), 500);
      onMove?.({ lat: ctr.lat, lng: ctr.lng }, Math.round(Math.min(10_000, radius)));
    },
  });
  return null;
}

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
  useTileTheme();
  const { c, isDark } = useTheme();
  const zoom = zoomFor(center.lat, radius, typeof window !== 'undefined' ? window.innerWidth : 393);
  // Ignore the moveend Leaflet fires for its own initial setView.
  const ready = useRef(false);

  const icons = useMemo(() => {
    const pin = (selected: boolean) =>
      L.divIcon({
        className: '',
        iconSize: [44, 44],
        iconAnchor: [22, 22],
        html: `<div class="vakit-pin"><span class="dot" style="background:${selected ? c.gold : isDark ? '#161D2C' : '#FFFCF6'};border:1.5px solid ${isDark ? c.gold : '#9A7A3C'}">${MOSQUE_SVG(selected ? c.onGold : c.goldText, 18, 1.6)}</span></div>`,
      });
    return { normal: pin(false), selected: pin(true) };
  }, [c, isDark]);

  const userIcon = useMemo(
    () =>
      L.divIcon({
        className: '',
        iconSize: [60, 60],
        iconAnchor: [30, 30],
        html: `<div class="vakit-user" style="background:${isDark ? 'rgba(243,238,228,0.10)' : 'rgba(26,28,33,0.08)'}"><span style="background:${isDark ? '#F3EEE4' : '#1A1C21'};box-shadow:0 0 0 3px ${isDark ? '#0B0F17' : '#F6F1E7'},0 2px 8px rgba(0,0,0,.35)"></span></div>`,
      }),
    [isDark],
  );

  const nearestIcon = (name: string) =>
    L.divIcon({
      className: '',
      iconSize: [260, 44],
      iconAnchor: [22, 22],
      html: `<div class="vakit-near"><span class="big" style="box-shadow:0 0 0 4px ${c.goldTint},0 10px 22px -8px rgba(0,0,0,.55)">${MOSQUE_SVG('#1A1408', 22, 1.7)}</span><span class="lbl" style="background:${isDark ? 'rgba(22,29,44,0.85)' : 'rgba(255,252,246,0.92)'};border:1px solid ${c.stroke};color:${c.text}"><b>${esc(name)}</b>${nearestLabel ? `<i style="color:${c.text2}">${esc(nearestLabel)}</i>` : ''}</span></div>`,
    });

  return (
    <View style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 }} accessibilityLabel={accessibilityLabel} role="region">
      <MapContainer
        center={[center.lat, center.lng]}
        zoom={zoom}
        zoomControl={false}
        attributionControl={false}
        className={`vakit-map${isDark ? '' : ' light'}`}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
        whenReady={() => {
          setTimeout(() => (ready.current = true), 300);
        }}
      >
        <InsetPan bottom={bottomInset} />
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="© OpenStreetMap katkıcıları" maxZoom={19} />
        <Recenter center={center} zoom={zoom} k={recenterKey} />
        <Events onMove={(ctr, r) => ready.current && onRegionChange?.(ctr, r)} />
        {user ? <Marker position={[user.lat, user.lng]} icon={userIcon} interactive={false} keyboard={false} /> : null}
        {mosques.map((m) => {
          const nearest = m.id === nearestId;
          return (
            <Marker
              key={m.id}
              position={[m.lat, m.lng]}
              icon={nearest ? nearestIcon(mosqueName(m)) : m.id === selectedId ? icons.selected : icons.normal}
              title={mosqueName(m)}
              alt={`${mosqueName(m)}${nearest ? ', en yakın' : ''}`}
              zIndexOffset={nearest ? 500 : m.id === selectedId ? 1000 : 0}
              eventHandlers={{ click: () => onSelect?.(m) }}
            />
          );
        })}
      </MapContainer>
    </View>
  );
}

function PickerEvents({ onChange }: { onChange: (p: LatLng) => void }) {
  const map = useMapEvents({
    moveend: () => {
      const ctr = map.getCenter();
      onChange({ lat: ctr.lat, lng: ctr.lng });
    },
  });
  return null;
}

export function PinPickerMap({ center, recenterKey, onChange, height = 172 }: PinPickerProps) {
  useTileTheme();
  const { c, isDark } = useTheme();
  return (
    <View style={{ height, borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: c.stroke }}>
      <MapContainer
        center={[center.lat, center.lng]}
        zoom={17}
        zoomControl={false}
        attributionControl={false}
        className={`vakit-map${isDark ? '' : ' light'}`}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" maxZoom={19} />
        <Recenter center={center} zoom={17} k={recenterKey} />
        <PickerEvents onChange={onChange} />
      </MapContainer>
      <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', zIndex: 500 }}>
        <View style={{ marginTop: -36, alignItems: 'center' }}>
          <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: c.gold, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: '#FFFCF6' }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c.onGold }} />
          </View>
          <View style={{ width: 2, height: 12, backgroundColor: c.gold }} />
          <View style={{ width: 12, height: 5, borderRadius: 6, backgroundColor: 'rgba(0,0,0,0.35)' }} />
        </View>
      </View>
    </View>
  );
}

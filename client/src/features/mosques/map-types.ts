import type { Mosque } from './api';
import type { LatLng } from './format';

export interface MosqueMapProps {
  /** Where the map opens; changing `recenterKey` flies back here. */
  center: LatLng;
  recenterKey?: number;
  /** Initial visible radius in metres. */
  radius?: number;
  mosques: Mosque[];
  /** Highlighted as the gold "en yakın" pin with a name label. */
  nearestId?: string | null;
  /** Mosque the detail sheet is showing. */
  selectedId?: string | null;
  user?: LatLng | null;
  onSelect?: (m: Mosque) => void;
  /** After the user pans/zooms: the new centre and a radius covering the view. */
  onRegionChange?: (center: LatLng, radiusM: number) => void;
  /** Space covered by a bottom sheet, so the centre sits in the visible part. */
  bottomInset?: number;
  /** Distance/walk label under the nearest pin. */
  nearestLabel?: string;
  accessibilityLabel?: string;
}

export interface PinPickerProps {
  center: LatLng;
  recenterKey?: number;
  onChange: (p: LatLng) => void;
  height?: number;
}

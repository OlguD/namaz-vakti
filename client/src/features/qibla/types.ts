import type { Accuracy } from './compass';

export type CompassStatus =
  /** Waiting for the first reading. */
  | 'starting'
  | 'ok'
  /** No orientation sensor (desktop browsers). */
  | 'unsupported'
  /** Permission refused. */
  | 'denied'
  /** iOS Safari: motion access must be requested from a tap. */
  | 'needs-permission';

export interface CompassState {
  status: CompassStatus;
  /** Degrees from north, smoothed. */
  heading: number | null;
  accuracy: Accuracy | null;
  interference: boolean;
  /** True when the heading is relative to true north (no declination error). */
  trueNorth: boolean;
  /** Ask again for permission / restart the sensors (must be called from a tap on iOS web). */
  retry?: () => void;
}

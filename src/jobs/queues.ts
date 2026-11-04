/** BullMQ queue names. Producers live in the API process, consumers in the worker. */
export const QUEUES = {
  locations: 'locations',
  geocode: 'geocode',
  prayerTimes: 'prayer-times',
  mosques: 'mosques',
  live: 'live',
  notifications: 'notifications',
  maintenance: 'maintenance',
} as const;

export const JOBS = {
  syncAllLocations: 'sync-all-locations',
  syncCityDistricts: 'sync-city-districts',
  geocodeDistrict: 'geocode-district',
  enqueuePendingGeocodes: 'enqueue-pending-geocodes',
  refreshDistrictTimes: 'refresh-district-times',
  refreshActiveDistricts: 'refresh-active-districts',
  importMosqueTile: 'import-mosque-tile',
  pollLiveStreams: 'poll-live-streams',
  sendPushBatch: 'send-push-batch',
  checkPushReceipts: 'check-push-receipts',
  broadcast: 'broadcast',
  pruneSyncBatches: 'prune-sync-batches',
} as const;

/** Deterministic job id for de-duplication. BullMQ forbids ':' in custom ids. */
export function jobId(...parts: Array<string | number>): string {
  return parts.map((part) => String(part).replace(/:/g, '_')).join('-');
}

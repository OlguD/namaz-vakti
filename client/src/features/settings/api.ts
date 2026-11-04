import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { get, put } from '@/api/client';
import { isApiError } from '@/api/errors';
import type { SettingsData, SettingsDocument } from '@/api/types';
import { useSession } from '@/auth/session';

export const settingsKey = ['settings'] as const;

export const DEFAULT_SETTINGS: SettingsData = {
  theme: 'system',
  language: 'tr',
  location: { mode: 'auto', districtId: null },
  prayerNotifications: {
    imsak: { enabled: true, remindBeforeMinutes: 0, sound: 'mekke' },
    gunes: { enabled: false, remindBeforeMinutes: 0, sound: 'sessiz' },
    ogle: { enabled: true, remindBeforeMinutes: 0, sound: 'mekke' },
    ikindi: { enabled: true, remindBeforeMinutes: 0, sound: 'mekke' },
    aksam: { enabled: true, remindBeforeMinutes: 0, sound: 'mekke' },
    yatsi: { enabled: true, remindBeforeMinutes: 0, sound: 'mekke' },
  },
  reminders: { iftar: true, sahur: true, haramainLive: true, dailyQuran: false, friday: true },
  holyDayReminders: {},
  favorites: { duas: [], esma: [] },
  zikirmatik: { lastDhikrKey: null, target: 33, view: 'ring', haptics: true, nightMode: false },
};

export function useSettingsQuery() {
  const ready = useSession((s) => s.status !== 'booting');
  return useQuery({
    queryKey: settingsKey,
    queryFn: () => get<SettingsDocument>('/me/settings'),
    enabled: ready,
    staleTime: 5 * 60_000,
  });
}

/** Current settings (server copy, else defaults). Never undefined. */
export function useSettings(): SettingsData {
  const { data } = useSettingsQuery();
  return data?.data ?? DEFAULT_SETTINGS;
}

type Patch = (current: SettingsData) => SettingsData;

/**
 * Optimistic settings update. The API uses optimistic concurrency: on a 409
 * we re-apply the same change on top of the server's latest copy.
 */
export function useUpdateSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (change: Patch) => {
      const doc = qc.getQueryData<SettingsDocument>(settingsKey);
      const base = doc ?? (await get<SettingsDocument>('/me/settings'));
      try {
        return await put<SettingsDocument>('/me/settings', {
          version: base.version,
          data: change(base.data),
        });
      } catch (e) {
        const current = isApiError(e) && e.status === 409 ? conflictCurrent(e.details) : null;
        if (!current) throw e;
        return put<SettingsDocument>('/me/settings', {
          version: current.version,
          data: change(current.data),
        });
      }
    },
    onMutate: async (change) => {
      await qc.cancelQueries({ queryKey: settingsKey });
      const prev = qc.getQueryData<SettingsDocument>(settingsKey);
      qc.setQueryData<SettingsDocument>(settingsKey, (d) =>
        d
          ? { ...d, data: change(d.data) }
          : { version: 0, data: change(DEFAULT_SETTINGS), updatedAt: null },
      );
      return { prev };
    },
    onError: (_e, _c, ctx) => {
      if (ctx?.prev) qc.setQueryData(settingsKey, ctx.prev);
    },
    onSuccess: (doc) => qc.setQueryData(settingsKey, doc),
  });
}

function conflictCurrent(details: unknown): SettingsDocument | null {
  const d = details as { current?: SettingsDocument } | undefined;
  return d?.current && typeof d.current.version === 'number' ? d.current : null;
}

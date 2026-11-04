import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { del, get, patch, post, put } from '@/api/client';
import { useSession } from '@/auth/session';
import { addDays, localDate } from '@/lib/prayer';

/** Types mirror src/worship and src/quran in the API project. */

export const PRAYER_KEYS = ['sabah', 'ogle', 'ikindi', 'aksam', 'yatsi'] as const;
export type PrayerKey = (typeof PRAYER_KEYS)[number];
export type PrayerStatus = 'prayed' | 'jamaah' | 'qada';

export const PRAYER_LABEL: Record<PrayerKey, string> = {
  sabah: 'Sabah',
  ogle: 'Öğle',
  ikindi: 'İkindi',
  aksam: 'Akşam',
  yatsi: 'Yatsı',
};

export const QADA_KEYS = ['sabah', 'ogle', 'ikindi', 'aksam', 'yatsi', 'vitir'] as const;
export type QadaKey = (typeof QADA_KEYS)[number];
export const QADA_LABEL: Record<QadaKey, string> = { ...PRAYER_LABEL, vitir: 'Vitir' };

export interface WorshipSummary {
  date: string;
  prayers: { done: number; total: number; statuses: Record<PrayerKey, PrayerStatus | null> };
  dhikrToday: number;
  quran: { currentJuz: number; percent: number };
  streakDays: number;
}

export type PrayerDayLog = { date: string } & Record<PrayerKey, PrayerStatus | null>;

export interface PrayerLogRange {
  from: string;
  to: string;
  days: PrayerDayLog[];
  totals: { done: number; jamaah: number; qada: number };
}

export type QadaCounters = Record<QadaKey, number> & { total: number; updatedAt: string | null };

export interface QadaEstimateInput {
  birthYear: number;
  pubertyAge: number;
  regularSince: number;
  prayedPercent: number;
}

export interface QadaEstimate {
  perVakit: number;
  total: number;
  fromYear: number;
  years: number;
}

export interface Dhikr {
  key: string;
  id?: string;
  arabic: string | null;
  transliteration: string;
  meaning: string | null;
  target: number;
  custom: boolean;
}

export interface DhikrList {
  builtin: Dhikr[];
  custom: Dhikr[];
}

export interface DhikrStats {
  range: 'week' | 'month';
  from: string;
  to: string;
  days: { date: string; total: number }[];
  total: number;
  average: number;
  top: { key: string; label: string; total: number }[];
  heatmap: { date: string; total: number }[];
  streakDays: number;
}

export interface QuranProgress {
  juz: number;
  page: number;
  currentJuz: number;
  completedKhatms: number;
  targetDate: string | null;
  pagesLeft: number;
  pagesPerDay: number | null;
  percent: number;
  khatmCompleted?: boolean;
}

export interface HatimSummary {
  id: string;
  name: string;
  round: number;
  completedRounds: number;
  targetDate: string | null;
  role: 'owner' | 'member';
  members: number;
  read: number;
  taken: number;
  open: number;
  myJuz: number[];
}

export interface HatimPerson {
  id: string;
  displayName: string | null;
  initials: string;
  isMe: boolean;
}

export interface HatimDetail {
  id: string;
  name: string;
  round: number;
  completedRounds: number;
  targetDate: string | null;
  inviteCode: string;
  isOwner: boolean;
  counts: { open: number; taken: number; read: number };
  members: (HatimPerson & { role: 'owner' | 'member' })[];
  juz: { juz: number; status: 'open' | 'taken' | 'read'; holder: HatimPerson | null }[];
}

export const worshipKeys = {
  summary: (date: string) => ['worship', 'summary', date] as const,
  prayers: (from: string, to: string) => ['worship', 'prayers', from, to] as const,
  qada: ['worship', 'qada'] as const,
  dhikrs: ['worship', 'dhikrs'] as const,
  stats: (range: string, today: string) => ['worship', 'dhikr-stats', range, today] as const,
  quran: ['quran', 'progress'] as const,
  hatims: ['quran', 'hatims'] as const,
  hatim: (id: string) => ['quran', 'hatims', id] as const,
};

function useReady(): boolean {
  return useSession((s) => s.status !== 'booting');
}

// --- summary & prayers -------------------------------------------------------

export function useWorshipSummary(date = localDate()) {
  const ready = useReady();
  return useQuery({
    queryKey: worshipKeys.summary(date),
    queryFn: () => get<WorshipSummary>('/worship/summary', { date }),
    enabled: ready,
  });
}

/** The last seven days ending today. */
export function weekRange(today = localDate()): { from: string; to: string } {
  return { from: addDays(today, -6), to: today };
}

export function usePrayerLog(from: string, to: string) {
  const ready = useReady();
  return useQuery({
    queryKey: worshipKeys.prayers(from, to),
    queryFn: () => get<PrayerLogRange>('/worship/prayers', { from, to }),
    enabled: ready,
  });
}

/** Optimistic mark of one prayer. */
export function useSetPrayer(from: string, to: string) {
  const qc = useQueryClient();
  const key = worshipKeys.prayers(from, to);
  return useMutation({
    mutationFn: (v: { date: string; vakit: PrayerKey; status: PrayerStatus | null }) =>
      put<void>(`/worship/prayers/${v.date}/${v.vakit}`, { status: v.status }),
    onMutate: async (v) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<PrayerLogRange>(key);
      if (prev) qc.setQueryData<PrayerLogRange>(key, applyPrayerMark(prev, v.date, v.vakit, v.status));
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev);
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ['worship', 'summary'] });
    },
  });
}

/** Pure update used for the optimistic cache write (and unit-tested). */
export function applyPrayerMark(
  log: PrayerLogRange,
  date: string,
  vakit: PrayerKey,
  status: PrayerStatus | null,
): PrayerLogRange {
  const days = log.days.map((d) => (d.date === date ? { ...d, [vakit]: status } : d));
  const totals = { done: 0, jamaah: 0, qada: 0 };
  for (const d of days) {
    for (const k of PRAYER_KEYS) {
      const s = d[k];
      if (s === 'qada') totals.qada += 1;
      else if (s) totals.done += 1;
      if (s === 'jamaah') totals.jamaah += 1;
    }
  }
  return { ...log, days, totals };
}

export const NEXT_STATUS: Record<'none' | PrayerStatus, PrayerStatus | null> = {
  none: 'prayed',
  prayed: 'jamaah',
  jamaah: 'qada',
  qada: null,
};

// --- qada -------------------------------------------------------------------

export function useQada() {
  const ready = useReady();
  return useQuery({ queryKey: worshipKeys.qada, queryFn: () => get<QadaCounters>('/worship/qada'), enabled: ready });
}

export function useAdjustQada() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { key: QadaKey; delta: -1 | 1 }) =>
      post<QadaCounters>(`/worship/qada/${v.key}/adjust`, { delta: v.delta }),
    onMutate: async (v) => {
      await qc.cancelQueries({ queryKey: worshipKeys.qada });
      const prev = qc.getQueryData<QadaCounters>(worshipKeys.qada);
      if (prev) {
        const n = Math.max(0, prev[v.key] + v.delta);
        qc.setQueryData<QadaCounters>(worshipKeys.qada, { ...prev, [v.key]: n, total: prev.total - prev[v.key] + n });
      }
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(worshipKeys.qada, ctx.prev);
    },
    onSuccess: (data) => qc.setQueryData(worshipKeys.qada, data),
  });
}

export function useApplyQadaEstimate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: QadaEstimateInput) =>
      post<{ estimate: QadaEstimate; counters: QadaCounters }>('/worship/qada/estimate', { ...input, apply: true }),
    onSuccess: (res) => qc.setQueryData(worshipKeys.qada, res.counters),
  });
}

/** Same formula as the API (src/worship/qada.ts) so the wizard updates instantly. */
export function estimateQada(input: QadaEstimateInput): QadaEstimate {
  const fromYear = input.birthYear + input.pubertyAge;
  const years = Math.max(0, input.regularSince - fromYear);
  const perVakit = Math.max(0, Math.round(years * 365 * (1 - input.prayedPercent / 100)));
  return { perVakit, total: perVakit * QADA_KEYS.length, fromYear, years };
}

// --- dhikr ------------------------------------------------------------------

export function useDhikrs() {
  const ready = useReady();
  return useQuery({
    queryKey: worshipKeys.dhikrs,
    queryFn: () => get<DhikrList>('/worship/dhikrs'),
    enabled: ready,
    staleTime: 10 * 60_000,
  });
}

export interface DhikrInput {
  arabic?: string;
  transliteration: string;
  meaning?: string;
  target: number;
}

export function useCreateDhikr() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: DhikrInput) => post<Dhikr>('/worship/dhikrs', input),
    onSuccess: (d) => {
      qc.setQueryData<DhikrList>(worshipKeys.dhikrs, (l) => (l ? { ...l, custom: [...l.custom, d] } : l));
      void qc.invalidateQueries({ queryKey: worshipKeys.dhikrs });
    },
  });
}

export function useUpdateDhikr() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: { id: string; arabic?: string | null; transliteration?: string; meaning?: string | null; target?: number }) => patch<Dhikr>(`/worship/dhikrs/${id}`, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: worshipKeys.dhikrs }),
  });
}

export function useDeleteDhikr() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => del(`/worship/dhikrs/${id}`),
    onMutate: async (id) => {
      const prev = qc.getQueryData<DhikrList>(worshipKeys.dhikrs);
      if (prev) qc.setQueryData<DhikrList>(worshipKeys.dhikrs, { ...prev, custom: prev.custom.filter((d) => d.id !== id) });
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(worshipKeys.dhikrs, ctx.prev);
    },
  });
}

export function useDhikrStats(range: 'week' | 'month', today = localDate()) {
  const ready = useReady();
  return useQuery({
    queryKey: worshipKeys.stats(range, today),
    queryFn: () => get<DhikrStats>('/worship/dhikr-stats', { range, today }),
    enabled: ready,
    placeholderData: (prev) => prev,
  });
}

// --- quran ------------------------------------------------------------------

export function useQuranProgress(today = localDate()) {
  const ready = useReady();
  return useQuery({
    queryKey: worshipKeys.quran,
    queryFn: () => get<QuranProgress>('/quran/progress', { today }),
    enabled: ready,
  });
}

export function useReadPages() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (pages: number) => post<QuranProgress>('/quran/progress/read', { pages, date: localDate() }),
    onSuccess: (p) => {
      qc.setQueryData(worshipKeys.quran, p);
      void qc.invalidateQueries({ queryKey: ['worship', 'summary'] });
    },
  });
}

export function useSetQuranProgress() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { juz: number; page: number; targetDate: string | null }) => put<QuranProgress>('/quran/progress', v),
    onSuccess: () => qc.invalidateQueries({ queryKey: worshipKeys.quran }),
  });
}

/** Group khatms need a registered account; anonymous users get a sign-in prompt. */
export function useHatims(enabled: boolean) {
  const ready = useReady();
  return useQuery({
    queryKey: worshipKeys.hatims,
    queryFn: () => get<HatimSummary[]>('/quran/hatims'),
    enabled: ready && enabled,
  });
}

export function useHatim(id: string) {
  const ready = useReady();
  return useQuery({
    queryKey: worshipKeys.hatim(id),
    queryFn: () => get<HatimDetail>(`/quran/hatims/${id}`),
    enabled: ready && !!id,
    refetchInterval: 30_000,
  });
}

type HatimAction =
  | { type: 'take-next' }
  | { type: 'take' | 'read' | 'release'; juz: number }
  | { type: 'new-round' }
  | { type: 'rotate' }
  | { type: 'kick'; userId: string };

export function useHatimAction(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (a: HatimAction): Promise<HatimDetail> => {
      const base = `/quran/hatims/${id}`;
      switch (a.type) {
        case 'take-next':
          return post(`${base}/take-next`);
        case 'take':
        case 'read':
        case 'release':
          return post(`${base}/juz/${a.juz}/${a.type}`);
        case 'new-round':
          return post(`${base}/new-round`);
        case 'rotate':
          return post(`${base}/invite/rotate`);
        case 'kick':
          return del<HatimDetail>(`${base}/members/${a.userId}`);
      }
    },
    onSuccess: (d) => {
      if (d) qc.setQueryData(worshipKeys.hatim(id), d);
      else void qc.invalidateQueries({ queryKey: worshipKeys.hatim(id) });
      void qc.invalidateQueries({ queryKey: worshipKeys.hatims, exact: true });
    },
  });
}

export function useCreateHatim() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { name: string; targetDate: string | null }) => post<HatimDetail>('/quran/hatims', v),
    onSuccess: (d) => {
      qc.setQueryData(worshipKeys.hatim(d.id), d);
      void qc.invalidateQueries({ queryKey: worshipKeys.hatims, exact: true });
    },
  });
}

export function useJoinHatim() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (code: string) => post<HatimDetail>('/quran/hatims/join', { code: code.trim().toUpperCase() }),
    onSuccess: (d) => {
      qc.setQueryData(worshipKeys.hatim(d.id), d);
      void qc.invalidateQueries({ queryKey: worshipKeys.hatims, exact: true });
    },
  });
}

export function useLeaveHatim(id: string) {
  const qc = useQueryClient();
  return useMutation({
    // An owner who leaves hands the group to the next member; "delete" removes it for everyone.
    mutationFn: (mode: 'leave' | 'delete') =>
      del(mode === 'delete' ? `/quran/hatims/${id}` : `/quran/hatims/${id}/members/me`),
    onSuccess: () => {
      qc.removeQueries({ queryKey: worshipKeys.hatim(id) });
      void qc.invalidateQueries({ queryKey: worshipKeys.hatims, exact: true });
    },
  });
}

// --- hub extras -------------------------------------------------------------

export interface HolyDayLite {
  key: string;
  date: string;
  nameTr: string;
}

/** Next holy day for the hub tile (the full list lives in the content screens). */
export function useNextHolyDay(today = localDate()) {
  return useQuery({
    queryKey: ['content', 'religious-days', 'next', today],
    queryFn: async () => {
      const list = await get<HolyDayLite[]>('/content/religious-days', { from: today, to: addDays(today, 400) });
      return list.filter((d) => d.date >= today).sort((a, b) => a.date.localeCompare(b.date))[0] ?? null;
    },
    staleTime: 6 * 3600_000,
  });
}

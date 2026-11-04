import { MONTHS_TR } from '@/lib/dates';
import type { LiveCategory, LiveStream } from './api';

export type CategoryFilter = 'all' | LiveCategory;

export const CATEGORY_CHIPS: { id: CategoryFilter; label: string }[] = [
  { id: 'all', label: 'Tümü' },
  { id: 'haramain', label: 'Harameyn' },
  { id: 'dua', label: 'Dua' },
  { id: 'quran', label: 'Kur’an' },
  { id: 'sohbet', label: 'Sohbet' },
  { id: 'other', label: 'Diğer' },
];

/** Gradient used behind a stream when its thumbnail is missing or still loading. */
export const CATEGORY_ART: Record<LiveCategory, [string, string, string]> = {
  haramain: ['#0E1230', '#2A2350', '#4B3566'],
  dua: ['#05070D', '#0B1224', '#142040'],
  quran: ['#1A1222', '#3D2230', '#8A4B45'],
  sohbet: ['#1A1408', '#4A3416', '#8A6430'],
  other: ['#0D1B2E', '#1F3A57', '#3E6585'],
};

/** "12,4B" — Turkish compact viewer count (B = bin, Mn = milyon). */
export function compactCount(n: number | null | undefined): string | null {
  if (n == null || !Number.isFinite(n)) return null;
  const fmt = (v: number) => (v >= 100 ? String(Math.round(v)) : v.toFixed(1).replace(/\.0$/, '').replace('.', ','));
  if (n >= 1_000_000) return `${fmt(n / 1_000_000)}Mn`;
  if (n >= 1_000) return `${fmt(n / 1_000)}B`;
  return String(n);
}

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * When an upcoming stream starts, relative to now:
 * "24:12 sonra başlıyor" (< 1 h), "2 sa 10 dk sonra" (< 6 h), "Bugün 22:30", "Yarın 20:15", "12 Kasım 20:15".
 */
export function startsLabel(iso: string | null, now: Date = new Date()): string {
  if (!iso) return 'Yakında';
  const at = new Date(iso);
  const ms = at.getTime() - now.getTime();
  if (Number.isNaN(ms)) return 'Yakında';
  if (ms <= 0) return 'Birazdan başlıyor';
  const totalSec = Math.floor(ms / 1000);
  if (totalSec < 3600) return `${pad(Math.floor(totalSec / 60))}:${pad(totalSec % 60)} sonra başlıyor`;
  if (totalSec < 6 * 3600) {
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    return m ? `${h} sa ${m} dk sonra` : `${h} sa sonra`;
  }
  const time = `${pad(at.getHours())}:${pad(at.getMinutes())}`;
  const dayDiff = calendarDayDiff(now, at);
  if (dayDiff === 0) return `Bugün ${time}`;
  if (dayDiff === 1) return `Yarın ${time}`;
  return `${at.getDate()} ${MONTHS_TR[at.getMonth()]} ${time}`;
}

/** "Yayın 2 sa önce başladı" for live streams. */
export function liveSinceLabel(iso: string | null, now: Date = new Date()): string {
  if (!iso) return 'Şu an yayında';
  const min = Math.floor((now.getTime() - new Date(iso).getTime()) / 60000);
  if (!Number.isFinite(min) || min < 1) return 'Yayın az önce başladı';
  if (min < 60) return `Yayın ${min} dk önce başladı`;
  const h = Math.floor(min / 60);
  if (h < 48) return `Yayın ${h} sa önce başladı`;
  return `Yayın ${Math.floor(h / 24)} gün önce başladı`;
}

function calendarDayDiff(a: Date, b: Date): number {
  const da = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const db = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((db - da) / 86_400_000);
}

/** "HY" from "Harameyn Yayın". */
export function monogram(title: string): string {
  const words = title
    .replace(/['’]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1);
  const letters = words.slice(0, 2).map((w) => w.charAt(0).toLocaleUpperCase('tr'));
  return letters.join('') || '•';
}

export function splitStreams(streams: readonly LiveStream[], filter: CategoryFilter) {
  const inCat = (s: LiveStream) => filter === 'all' || s.channel.category === filter;
  const live = streams.filter((s) => s.status === 'live' && inCat(s));
  const upcoming = streams
    .filter((s) => s.status === 'upcoming' && inCat(s))
    .sort((a, b) => (a.scheduledStartAt ?? '').localeCompare(b.scheduledStartAt ?? ''));
  return { live, upcoming };
}

/** youtube-nocookie embed URL with the parameters we rely on. */
export function embedSrc(videoId: string, opts: { autoplay?: boolean; origin?: string } = {}): string {
  const params = new URLSearchParams({
    autoplay: opts.autoplay ? '1' : '0',
    playsinline: '1',
    rel: '0',
    modestbranding: '1',
    ...(opts.origin ? { origin: opts.origin } : {}),
  });
  return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}?${params.toString()}`;
}

/** YouTube video ids are 11 chars of [A-Za-z0-9_-]; anything else is rejected before embedding. */
export function isVideoId(v: unknown): v is string {
  return typeof v === 'string' && /^[A-Za-z0-9_-]{11}$/.test(v);
}

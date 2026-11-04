import { useIsFocused } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { get } from '@/api/client';

/** Mirrors the backend's LIVE_CATEGORIES (src/live/live.controller.ts). */
export type LiveCategory = 'haramain' | 'dua' | 'quran' | 'sohbet' | 'other';

export interface LiveChannelRef {
  id: string;
  title: string;
  thumbnailUrl: string | null;
  category: LiveCategory;
  language: string | null;
}

export interface LiveStream {
  videoId: string;
  title: string;
  thumbnailUrl: string | null;
  status: 'live' | 'upcoming';
  scheduledStartAt: string | null;
  actualStartAt: string | null;
  concurrentViewers: number | null;
  channel: LiveChannelRef;
  /** Play only through the YouTube IFrame player. */
  embedUrl: string;
  watchUrl: string;
}

export interface LiveChannel extends LiveChannelRef {
  youtubeChannelId: string;
}

export const streamsKey = ['live', 'streams'] as const;
export const channelsKey = ['live', 'channels'] as const;

/** All live + upcoming streams; polled every minute while the screen is focused. */
export function useStreams() {
  const focused = useIsFocused();
  return useQuery({
    queryKey: streamsKey,
    queryFn: () => get<LiveStream[]>('/live/streams', undefined, { auth: false }),
    staleTime: 30_000,
    refetchInterval: focused ? 60_000 : false,
  });
}

export function useChannels() {
  return useQuery({
    queryKey: channelsKey,
    queryFn: () => get<LiveChannel[]>('/live/channels', undefined, { auth: false }),
    staleTime: 10 * 60_000,
  });
}

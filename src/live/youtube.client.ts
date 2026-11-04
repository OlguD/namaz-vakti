import { HttpStatus, Injectable } from '@nestjs/common';
import { XMLParser } from 'fast-xml-parser';
import { AppConfig } from '../config/app-config.service.js';
import { AppError } from '../common/errors.js';
import { HttpClient } from '../common/http-client.js';

export interface YoutubeChannelInfo {
  id: string;
  title: string;
  thumbnailUrl: string | null;
}

export interface YoutubeVideoStatus {
  videoId: string;
  title: string;
  thumbnailUrl: string | null;
  status: 'live' | 'upcoming' | 'ended' | 'none';
  scheduledStartAt: Date | null;
  actualStartAt: Date | null;
  actualEndAt: Date | null;
  concurrentViewers: number | null;
}

interface VideosResponse {
  items?: Array<{
    id: string;
    snippet?: {
      title?: string;
      liveBroadcastContent?: 'live' | 'upcoming' | 'none';
      thumbnails?: Record<string, { url: string }>;
    };
    liveStreamingDetails?: {
      scheduledStartTime?: string;
      actualStartTime?: string;
      actualEndTime?: string;
      concurrentViewers?: string;
    };
  }>;
}

interface ChannelsResponse {
  items?: Array<{
    id: string;
    snippet?: { title?: string; thumbnails?: Record<string, { url: string }> };
  }>;
}

const API = 'https://www.googleapis.com/youtube/v3';

/**
 * Quota-aware YouTube access. Discovery uses each channel's public RSS feed (no
 * quota); status checks use videos.list, which costs 1 unit per 50 videos. We never
 * call search.list — it has its own tiny daily bucket (100 calls).
 */
@Injectable()
export class YoutubeClient {
  private readonly http: HttpClient;
  private readonly xml = new XMLParser({ ignoreAttributes: false, removeNSPrefix: false });

  constructor(private readonly config: AppConfig) {
    this.http = new HttpClient({
      service: 'youtube',
      userAgent: config.get('OUTBOUND_USER_AGENT'),
      timeoutMs: 10_000,
      retries: 1,
    });
  }

  get enabled(): boolean {
    return Boolean(this.config.get('YOUTUBE_API_KEY'));
  }

  /** Accepts a channel id (UC…), an @handle, or a youtube.com channel/handle URL. */
  async resolveChannel(input: string): Promise<YoutubeChannelInfo> {
    const ref = parseChannelRef(input);
    if (!ref) {
      throw AppError.badRequest(
        'VALIDATION_FAILED',
        'Expected a channel id (UC…), @handle or channel URL',
      );
    }
    const params = new URLSearchParams({ part: 'snippet', key: this.key() });
    params.set(ref.kind === 'id' ? 'id' : 'forHandle', ref.value);
    const response = await this.http.json<ChannelsResponse>(`${API}/channels?${params}`);
    const item = response.items?.[0];
    if (!item) {
      throw AppError.notFound('YouTube channel');
    }
    return {
      id: item.id,
      title: item.snippet?.title ?? item.id,
      thumbnailUrl: bestThumbnail(item.snippet?.thumbnails),
    };
  }

  /** Latest ~15 video ids from the channel's public feed (includes streams). */
  async recentVideoIds(channelId: string): Promise<string[]> {
    const body = await this.http.text(
      `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`,
    );
    return parseFeedVideoIds(body, this.xml);
  }

  async videoStatuses(videoIds: string[]): Promise<Map<string, YoutubeVideoStatus>> {
    const result = new Map<string, YoutubeVideoStatus>();
    for (let i = 0; i < videoIds.length; i += 50) {
      const batch = videoIds.slice(i, i + 50);
      const params = new URLSearchParams({
        part: 'snippet,liveStreamingDetails',
        id: batch.join(','),
        maxResults: '50',
        key: this.key(),
      });
      const response = await this.http.json<VideosResponse>(`${API}/videos?${params}`);
      for (const item of response.items ?? []) {
        result.set(item.id, toStatus(item));
      }
    }
    return result;
  }

  private key(): string {
    const key = this.config.get('YOUTUBE_API_KEY');
    if (!key) {
      throw new AppError(
        'FEATURE_DISABLED',
        'YOUTUBE_API_KEY is not configured',
        HttpStatus.NOT_IMPLEMENTED,
      );
    }
    return key;
  }
}

export function parseChannelRef(input: string): { kind: 'id' | 'handle'; value: string } | null {
  const trimmed = input.trim();
  const fromUrl = /youtube\.com\/(?:channel\/(UC[\w-]{22})|(@[\w.-]{3,30}))/i.exec(trimmed);
  if (fromUrl) {
    return fromUrl[1] ? { kind: 'id', value: fromUrl[1] } : { kind: 'handle', value: fromUrl[2]! };
  }
  if (/^UC[\w-]{22}$/.test(trimmed)) {
    return { kind: 'id', value: trimmed };
  }
  if (/^@?[\w.-]{3,30}$/.test(trimmed)) {
    return { kind: 'handle', value: trimmed.startsWith('@') ? trimmed : `@${trimmed}` };
  }
  return null;
}

export function parseFeedVideoIds(xml: string, parser = new XMLParser()): string[] {
  const doc = parser.parse(xml) as { feed?: { entry?: unknown } };
  const entries = doc.feed?.entry;
  const list = Array.isArray(entries) ? entries : entries ? [entries] : [];
  return list
    .map((entry) => (entry as Record<string, unknown>)['yt:videoId'])
    .filter((id): id is string => typeof id === 'string' && /^[\w-]{11}$/.test(id));
}

export function toStatus(item: NonNullable<VideosResponse['items']>[number]): YoutubeVideoStatus {
  const details = item.liveStreamingDetails;
  const broadcast = item.snippet?.liveBroadcastContent ?? 'none';
  let status: YoutubeVideoStatus['status'] = broadcast;
  if (broadcast === 'none' && details?.actualEndTime) {
    status = 'ended';
  }
  const viewers = details?.concurrentViewers ? Number(details.concurrentViewers) : null;
  return {
    videoId: item.id,
    title: item.snippet?.title ?? '',
    thumbnailUrl: bestThumbnail(item.snippet?.thumbnails),
    status,
    scheduledStartAt: details?.scheduledStartTime ? new Date(details.scheduledStartTime) : null,
    actualStartAt: details?.actualStartTime ? new Date(details.actualStartTime) : null,
    actualEndAt: details?.actualEndTime ? new Date(details.actualEndTime) : null,
    concurrentViewers: Number.isFinite(viewers) ? viewers : null,
  };
}

function bestThumbnail(thumbnails?: Record<string, { url: string }>): string | null {
  if (!thumbnails) {
    return null;
  }
  for (const size of ['maxres', 'standard', 'high', 'medium', 'default']) {
    if (thumbnails[size]?.url) {
      return thumbnails[size].url;
    }
  }
  return null;
}

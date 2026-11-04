import { describe, expect, it } from '@jest/globals';
import type { LiveStream } from './api';
import { compactCount, embedSrc, isVideoId, liveSinceLabel, monogram, splitStreams, startsLabel } from './format';

describe('live format', () => {
  const now = new Date(2026, 10, 4, 14, 0, 0);

  it('formats viewer counts the Turkish way', () => {
    expect(compactCount(950)).toBe('950');
    expect(compactCount(12_400)).toBe('12,4B');
    expect(compactCount(5_000)).toBe('5B');
    expect(compactCount(250_000)).toBe('250B');
    expect(compactCount(1_200_000)).toBe('1,2Mn');
    expect(compactCount(null)).toBeNull();
  });

  it('describes when an upcoming stream starts', () => {
    expect(startsLabel(new Date(2026, 10, 4, 14, 24, 12).toISOString(), now)).toBe('24:12 sonra başlıyor');
    expect(startsLabel(new Date(2026, 10, 4, 16, 10).toISOString(), now)).toBe('2 sa 10 dk sonra');
    expect(startsLabel(new Date(2026, 10, 4, 22, 30).toISOString(), now)).toBe('Bugün 22:30');
    expect(startsLabel(new Date(2026, 10, 5, 20, 15).toISOString(), now)).toBe('Yarın 20:15');
    expect(startsLabel(new Date(2026, 10, 12, 20, 15).toISOString(), now)).toBe('12 Kasım 20:15');
    expect(startsLabel(null, now)).toBe('Yakında');
    expect(startsLabel(new Date(2026, 10, 4, 13, 0).toISOString(), now)).toBe('Birazdan başlıyor');
  });

  it('describes how long a stream has been live', () => {
    expect(liveSinceLabel(new Date(2026, 10, 4, 13, 20).toISOString(), now)).toBe('Yayın 40 dk önce başladı');
    expect(liveSinceLabel(new Date(2026, 10, 4, 11, 0).toISOString(), now)).toBe('Yayın 3 sa önce başladı');
    expect(liveSinceLabel(null, now)).toBe('Şu an yayında');
  });

  it('builds monograms', () => {
    expect(monogram('Harameyn Yayın')).toBe('HY');
    expect(monogram("Kur'an-ı Kerim Tilaveti")).toBe('KK');
    expect(monogram('İlim Sohbetleri')).toBe('İS');
  });

  it('splits by status and category, upcoming sorted by start', () => {
    const mk = (id: string, status: 'live' | 'upcoming', category: LiveStream['channel']['category'], at?: string): LiveStream => ({
      videoId: id,
      title: id,
      thumbnailUrl: null,
      status,
      scheduledStartAt: at ?? null,
      actualStartAt: null,
      concurrentViewers: null,
      channel: { id: 'c', title: 'C', thumbnailUrl: null, category, language: null },
      embedUrl: '',
      watchUrl: '',
    });
    const all = [mk('a', 'live', 'haramain'), mk('b', 'upcoming', 'dua', '2026-11-05T10:00:00Z'), mk('c', 'upcoming', 'quran', '2026-11-04T20:00:00Z'), mk('d', 'live', 'quran')];
    expect(splitStreams(all, 'all').live.map((s) => s.videoId)).toEqual(['a', 'd']);
    expect(splitStreams(all, 'all').upcoming.map((s) => s.videoId)).toEqual(['c', 'b']);
    expect(splitStreams(all, 'quran').live.map((s) => s.videoId)).toEqual(['d']);
    expect(splitStreams(all, 'haramain').upcoming).toEqual([]);
  });

  it('only embeds real video ids', () => {
    expect(isVideoId('d1ULIyt90A1')).toBe(true);
    expect(isVideoId('../../evil')).toBe(false);
    expect(isVideoId('abc')).toBe(false);
    expect(embedSrc('d1ULIyt90A1', { autoplay: true })).toBe(
      'https://www.youtube-nocookie.com/embed/d1ULIyt90A1?autoplay=1&playsinline=1&rel=0&modestbranding=1',
    );
  });
});

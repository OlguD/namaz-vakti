import { parseChannelRef, parseFeedVideoIds, toStatus } from './youtube.client.js';

describe('parseChannelRef', () => {
  it.each([
    ['UCabcdefghijklmnopqrstuv', { kind: 'id', value: 'UCabcdefghijklmnopqrstuv' }],
    [
      'https://www.youtube.com/channel/UCabcdefghijklmnopqrstuv',
      { kind: 'id', value: 'UCabcdefghijklmnopqrstuv' },
    ],
    ['https://youtube.com/@diyanettv', { kind: 'handle', value: '@diyanettv' }],
    ['@diyanettv', { kind: 'handle', value: '@diyanettv' }],
    ['diyanettv', { kind: 'handle', value: '@diyanettv' }],
  ])('parses %s', (input, expected) => {
    expect(parseChannelRef(input)).toEqual(expected);
  });

  it('rejects garbage', () => {
    expect(parseChannelRef('not a channel!!')).toBeNull();
  });
});

describe('parseFeedVideoIds', () => {
  it('reads video ids from an Atom feed', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns:yt="http://www.youtube.com/xml/schemas/2015" xmlns="http://www.w3.org/2005/Atom">
  <entry><id>yt:video:AAAAAAAAAAA</id><yt:videoId>AAAAAAAAAAA</yt:videoId><title>Canlı</title></entry>
  <entry><id>yt:video:BBBBBBBBBBB</id><yt:videoId>BBBBBBBBBBB</yt:videoId><title>Dua</title></entry>
</feed>`;
    expect(parseFeedVideoIds(xml)).toEqual(['AAAAAAAAAAA', 'BBBBBBBBBBB']);
  });

  it('handles a single entry and an empty feed', () => {
    expect(
      parseFeedVideoIds('<feed><entry><yt:videoId>CCCCCCCCCCC</yt:videoId></entry></feed>'),
    ).toEqual(['CCCCCCCCCCC']);
    expect(parseFeedVideoIds('<feed></feed>')).toEqual([]);
  });
});

describe('toStatus', () => {
  it('maps a live broadcast', () => {
    const status = toStatus({
      id: 'AAAAAAAAAAA',
      snippet: {
        title: 'Kâbe Canlı',
        liveBroadcastContent: 'live',
        thumbnails: { high: { url: 'https://i.ytimg.com/hq.jpg' } },
      },
      liveStreamingDetails: { actualStartTime: '2026-11-04T08:00:00Z', concurrentViewers: '12345' },
    });
    expect(status).toMatchObject({
      status: 'live',
      concurrentViewers: 12345,
      thumbnailUrl: 'https://i.ytimg.com/hq.jpg',
    });
  });

  it('marks finished streams as ended and plain uploads as none', () => {
    expect(
      toStatus({
        id: 'x',
        snippet: { liveBroadcastContent: 'none' },
        liveStreamingDetails: { actualEndTime: '2026-11-04T09:00:00Z' },
      }).status,
    ).toBe('ended');
    expect(toStatus({ id: 'y', snippet: { liveBroadcastContent: 'none' } }).status).toBe('none');
  });
});

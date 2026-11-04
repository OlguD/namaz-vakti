import { createElement } from 'react';
import { embedSrc } from './format';
import type { PlayerProps } from './YouTubePlayer';

export type { PlayerProps };

/**
 * Web player: a privacy-enhanced (youtube-nocookie) iframe. The video id is
 * validated by the caller (isVideoId), so it cannot inject into the URL.
 */
export function YouTubePlayer({ videoId, width, height, title }: PlayerProps) {
  const origin = typeof window !== 'undefined' ? window.location.origin : undefined;
  return createElement('iframe', {
    src: embedSrc(videoId, { autoplay: true, origin }),
    title,
    width,
    height,
    allow: 'autoplay; encrypted-media; picture-in-picture; fullscreen',
    allowFullScreen: true,
    referrerPolicy: 'strict-origin-when-cross-origin',
    style: { border: 0, display: 'block', width, height, background: '#05070D' },
  });
}

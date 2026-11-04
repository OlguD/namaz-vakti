import YoutubePlayer from 'react-native-youtube-iframe';

export interface PlayerProps {
  videoId: string;
  width: number;
  height: number;
  title: string;
  onError: (reason: string) => void;
}

/**
 * Native player: the official YouTube IFrame player inside a WebView
 * (YouTube's terms: never extract the raw stream).
 */
export function YouTubePlayer({ videoId, width, height, onError }: PlayerProps) {
  return (
    <YoutubePlayer
      videoId={videoId}
      width={width}
      height={height}
      play
      forceAndroidAutoplay
      onError={onError}
      initialPlayerParams={{ rel: false, modestbranding: true, controls: true, playerLang: 'tr' }}
      webViewProps={{ allowsInlineMediaPlayback: true, mediaPlaybackRequiresUserAction: false }}
      webViewStyle={{ backgroundColor: '#05070D' }}
    />
  );
}

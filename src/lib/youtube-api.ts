export type YTPlayer = {
  getPlaylist: () => string[] | null;
  playVideo: () => void;
  pauseVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  getPlayerState: () => number;
  mute: () => void;
  unMute: () => void;
  setVolume: (volume: number) => void;
  destroy: () => void;
};

export type YTPlayerOptions = {
  width?: number | string;
  height?: number | string;
  videoId?: string;
  host?: string;
  playerVars: Record<string, string | number>;
  events: {
    onReady?: () => void;
    onError?: (event: { data: number }) => void;
    onStateChange?: (event: { data: number }) => void;
  };
};

type YTNamespace = { Player: new (element: HTMLElement, options: YTPlayerOptions) => YTPlayer };

declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

export const YT_PLAYING = 1;
export const YT_ENDED = 0;

let apiPromise: Promise<YTNamespace> | undefined;

export const loadYouTubeApi = () => {
  apiPromise ??= new Promise<YTNamespace>((resolve, reject) => {
    if (window.YT?.Player) return resolve(window.YT);
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      if (window.YT) resolve(window.YT);
    };
    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    script.onerror = () => {
      apiPromise = undefined;
      reject(new Error('YouTube player could not load'));
    };
    document.head.appendChild(script);
  });
  return apiPromise;
};

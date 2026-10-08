export type SpotifyPlayback = {
  isPaused: boolean;
  isBuffering: boolean;
  duration: number;
  position: number;
};

export type SpotifyController = {
  play: () => void;
  pause: () => void;
  resume: () => void;
  togglePlay: () => void;
  seek: (seconds: number) => void;
  destroy: () => void;
  addListener: (
    event: 'ready' | 'playback_update',
    callback: (event: { data: SpotifyPlayback }) => void
  ) => void;
};

type SpotifyIFrameAPI = {
  createController: (
    element: HTMLElement,
    options: { uri: string; width?: string | number; height?: string | number },
    callback: (controller: SpotifyController) => void
  ) => void;
};

declare global {
  interface Window {
    onSpotifyIframeApiReady?: (api: SpotifyIFrameAPI) => void;
  }
}

let apiPromise: Promise<SpotifyIFrameAPI> | undefined;

export const loadSpotifyApi = () => {
  apiPromise ??= new Promise<SpotifyIFrameAPI>((resolve, reject) => {
    window.onSpotifyIframeApiReady = resolve;
    const script = document.createElement('script');
    script.src = 'https://open.spotify.com/embed/iframe-api/v1';
    script.async = true;
    script.onerror = () => {
      apiPromise = undefined;
      reject(new Error('Spotify player could not load'));
    };
    document.head.appendChild(script);
  });
  return apiPromise;
};

export const createSpotifyController = async (
  host: HTMLElement,
  uri: string,
  height: number
): Promise<SpotifyController> => {
  const api = await loadSpotifyApi();
  const target = document.createElement('div');
  host.appendChild(target);
  return new Promise((resolve) => {
    api.createController(target, { uri, width: '100%', height }, (controller) => {
      controller.addListener('ready', () => resolve(controller));
    });
  });
};

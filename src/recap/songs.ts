import { parseMedia } from '~/lib/media';
import { YT_ENDED, loadYouTubeApi } from '~/lib/youtube-api';
import type { YTPlayer } from '~/lib/youtube-api';

export type Song = {
  start: () => void;
  stop: () => void;
  pause: () => void;
  resume: () => void;
  setMuted: (muted: boolean) => void;
  destroy: () => void;
};

const HOOK_FRACTION = 0.35;
const FADE_IN = 700;
const FADE_OUT = 450;

const ramp = (
  from: number,
  to: number,
  ms: number,
  apply: (v: number) => void,
  done?: () => void
) => {
  const started = performance.now();
  let frame = 0;
  const tick = () => {
    const t = Math.min(1, (performance.now() - started) / ms);
    apply(from + (to - from) * t);
    if (t < 1) frame = requestAnimationFrame(tick);
    else done?.();
  };
  frame = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(frame);
};

const createYouTube = async (host: HTMLElement, id: string, start?: number): Promise<Song> => {
  const YT = await loadYouTubeApi();
  const target = document.createElement('div');
  host.appendChild(target);
  return new Promise((resolve) => {
    let player: YTPlayer;
    let cancel = () => {};
    const hook = () =>
      start ?? Math.max(0, Math.floor((player.getDuration() || 120) * HOOK_FRACTION));
    player = new YT.Player(target, {
      width: '100%',
      height: '100%',
      videoId: id,
      host: 'https://www.youtube-nocookie.com',
      playerVars: {
        autoplay: 0,
        controls: 0,
        disablekb: 1,
        fs: 0,
        iv_load_policy: 3,
        rel: 0,
        playsinline: 1
      },
      events: {
        onStateChange: (event) => {
          if (event.data === YT_ENDED) {
            player.seekTo(0, true);
            player.playVideo();
          }
        },
        onReady: () =>
          resolve({
            start: () => {
              cancel();
              player.setVolume(0);
              player.seekTo(hook(), true);
              player.playVideo();
              cancel = ramp(0, 100, FADE_IN, (v) => player.setVolume(v));
            },
            stop: () => {
              cancel();
              cancel = ramp(
                80,
                0,
                FADE_OUT,
                (v) => player.setVolume(v),
                () => player.pauseVideo()
              );
            },
            pause: () => player.pauseVideo(),
            resume: () => player.playVideo(),
            setMuted: (muted) => (muted ? player.mute() : player.unMute()),
            destroy: () => {
              cancel();
              player.destroy();
            }
          })
      }
    });
  });
};

const createAudio = (url: string, start?: number): Song => {
  const audio = new Audio(url.split('#')[0]);
  audio.preload = 'auto';
  audio.loop = true;
  let cancel = () => {};
  return {
    start: () => {
      cancel();
      audio.volume = 0;
      audio.currentTime = start ?? (audio.duration ? audio.duration * HOOK_FRACTION : 0);
      void audio.play();
      cancel = ramp(0, 1, FADE_IN, (v) => (audio.volume = v));
    },
    stop: () => {
      cancel();
      cancel = ramp(
        audio.volume,
        0,
        FADE_OUT,
        (v) => (audio.volume = v),
        () => audio.pause()
      );
    },
    pause: () => audio.pause(),
    resume: () => void audio.play(),
    setMuted: (muted) => {
      audio.muted = muted;
    },
    destroy: () => {
      cancel();
      audio.pause();
      audio.src = '';
    }
  };
};

export const createSong = async (host: HTMLElement | null, url: string | undefined) => {
  const media = parseMedia(url);
  if (media?.kind === 'youtube' && host) return createYouTube(host, media.id, media.start);
  if (media?.kind === 'audio') return createAudio(media.url, media.start);
  return undefined;
};

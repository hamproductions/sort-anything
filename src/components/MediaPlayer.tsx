import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import type { MouseEvent, ReactNode } from 'react';
import {
  fetchMediaInfo,
  isArtTrack,
  mediaThumbnail,
  parseMedia,
  thumbnailFallback
} from '~/lib/media';
import type { Media, MediaInfo } from '~/lib/media';
import { YT_ENDED, YT_PLAYING, loadYouTubeApi } from '~/lib/youtube-api';
import { createSpotifyController } from '~/lib/spotify-api';
import type { SpotifyController } from '~/lib/spotify-api';
import type { YTPlayer } from '~/lib/youtube-api';
import type { Item } from '~/lib/types';

type Playback = { paused: boolean; time: number; duration: number };

type Controller = { toggle: () => void; seek: (fraction: number) => void };

type PlayerApi = {
  playingKey?: string;
  playback?: Playback;
  controller?: Controller;
  toggle: (item: Item) => void;
  stop: () => void;
  report: (key: string, playback: Playback) => void;
  register: (key: string, controller: Controller | undefined) => void;
};

const PlayerContext = createContext<PlayerApi>({
  toggle: () => {},
  stop: () => {},
  report: () => {},
  register: () => {}
});

export const usePlayer = () => useContext(PlayerContext);

export const playerKey = (item: Item) => `${item.id}:${item.media}`;

export const PlayerProvider = ({ children }: { children: ReactNode }) => {
  const [playingKey, setPlayingKey] = useState<string>();
  const [playback, setPlayback] = useState<Playback>();
  const [controller, setController] = useState<Controller>();
  const keyRef = useRef<string>(undefined);
  keyRef.current = playingKey;

  const toggle = useCallback((item: Item) => {
    if (!parseMedia(item.media)) return;
    const key = playerKey(item);
    setPlayback(undefined);
    setController(undefined);
    setPlayingKey((current) => (current === key ? undefined : key));
  }, []);

  const stop = useCallback(() => {
    setPlayingKey(undefined);
    setPlayback(undefined);
    setController(undefined);
  }, []);

  const report = useCallback((key: string, next: Playback) => {
    if (keyRef.current === key) setPlayback(next);
  }, []);

  const register = useCallback((key: string, next: Controller | undefined) => {
    if (keyRef.current === key) setController(() => next);
  }, []);

  const api = useMemo(
    () => ({ playingKey, playback, controller, toggle, stop, report, register }),
    [playingKey, playback, controller, toggle, stop, report, register]
  );

  return <PlayerContext.Provider value={api}>{children}</PlayerContext.Provider>;
};

export const useItemPlayback = (item: Item | undefined) => {
  const { playingKey, playback, controller } = usePlayer();
  const active = !!item && playingKey === playerKey(item);
  return {
    active,
    playback: active ? playback : undefined,
    controller: active ? controller : undefined
  };
};

const YouTubeSurface = ({
  media,
  itemKey
}: {
  media: Extract<Media, { kind: 'youtube' }>;
  itemKey: string;
}) => {
  const { report, register, stop } = usePlayer();
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const target = document.createElement('div');
    host.appendChild(target);
    let player: YTPlayer | undefined;
    let timer: number | undefined;
    let cancelled = false;

    const read = () => {
      if (!player?.getPlayerState) return;
      report(itemKey, {
        paused: player.getPlayerState() !== YT_PLAYING,
        time: player.getCurrentTime() || 0,
        duration: player.getDuration() || 0
      });
    };

    void loadYouTubeApi().then((YT) => {
      if (cancelled) return;
      player = new YT.Player(target, {
        width: '100%',
        height: '100%',
        videoId: media.id,
        host: 'https://www.youtube-nocookie.com',
        playerVars: {
          autoplay: 1,
          controls: 0,
          disablekb: 1,
          fs: 0,
          iv_load_policy: 3,
          rel: 0,
          playsinline: 1,
          ...(media.start ? { start: media.start } : {})
        },
        events: {
          onReady: () => {
            player?.playVideo();
            register(itemKey, {
              toggle: () =>
                player?.getPlayerState() === YT_PLAYING ? player.pauseVideo() : player?.playVideo(),
              seek: (fraction) => {
                const duration = player?.getDuration() ?? 0;
                if (duration) player?.seekTo(duration * fraction, true);
              }
            });
            timer = window.setInterval(read, 250);
          },
          onStateChange: (event) => {
            read();
            if (event.data === YT_ENDED) stop();
          }
        }
      });
    });

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      player?.destroy();
      host.replaceChildren();
    };
  }, [media.id, media.start, itemKey, report, register, stop]);

  return <div className="surface surface-video" ref={hostRef} />;
};

const AudioSurface = ({
  media,
  itemKey
}: {
  media: Extract<Media, { kind: 'audio' }>;
  itemKey: string;
}) => {
  const { report, register, stop } = usePlayer();
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    register(itemKey, {
      toggle: () => (audio.paused ? void audio.play() : audio.pause()),
      seek: (fraction) => {
        if (audio.duration) audio.currentTime = audio.duration * fraction;
      }
    });
  }, [itemKey, register]);

  const sync = () => {
    const audio = audioRef.current;
    if (audio) {
      report(itemKey, {
        paused: audio.paused,
        time: audio.currentTime,
        duration: audio.duration || 0
      });
    }
  };

  return (
    <audio
      ref={audioRef}
      className="surface-audio"
      src={media.start ? `${media.url.split('#')[0]}#t=${media.start}` : media.url}
      autoPlay
      onPlay={sync}
      onPause={sync}
      onTimeUpdate={sync}
      onLoadedMetadata={sync}
      onEnded={stop}
    />
  );
};

const SpotifySurface = ({
  media,
  itemKey,
  compact
}: {
  media: Extract<Media, { kind: 'spotify' }>;
  itemKey: string;
  compact?: boolean;
}) => {
  const { report, register, stop } = usePlayer();
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let controller: SpotifyController | undefined;
    let cancelled = false;
    let duration = 0;
    void createSpotifyController(
      host,
      `spotify:${media.type}:${media.id}`,
      compact ? 80 : 152
    ).then((created) => {
      if (cancelled) return created.destroy();
      controller = created;
      let wanted = true;
      let lastPosition = 0;
      created.addListener('playback_update', ({ data }) => {
        duration = data.duration / 1000;
        report(itemKey, { paused: data.isPaused, time: data.position / 1000, duration });
        const ended =
          data.duration > 0 &&
          (data.position >= data.duration - 250 ||
            (data.isPaused && data.position === 0 && lastPosition > data.duration - 1500));
        lastPosition = data.position;
        if (ended && wanted) {
          created.seek(0);
          created.resume();
        }
      });
      register(itemKey, {
        toggle: () => {
          wanted = !wanted;
          created.togglePlay();
        },
        seek: (fraction) => {
          if (duration) created.seek(duration * fraction);
        }
      });
      created.play();
    });
    return () => {
      cancelled = true;
      controller?.destroy();
      host.replaceChildren();
    };
  }, [media.type, media.id, compact, itemKey, report, register, stop]);

  return <div className={`surface-spotify${compact ? ' compact' : ''}`} ref={hostRef} />;
};

export const MediaSurface = ({ item, compact }: { item: Item; compact?: boolean }) => {
  const media = parseMedia(item.media);
  const key = playerKey(item);
  if (!media) return null;
  if (media.kind === 'youtube') return <YouTubeSurface key={key} media={media} itemKey={key} />;
  if (media.kind === 'audio') return <AudioSurface key={key} media={media} itemKey={key} />;
  return <SpotifySurface key={key} media={media} itemKey={key} compact={compact} />;
};

export const useMediaInfo = (url: string | undefined) => {
  const [info, setInfo] = useState<{ url: string; info?: MediaInfo }>();
  useEffect(() => {
    if (!url || !parseMedia(url)) return;
    let cancelled = false;
    void fetchMediaInfo(url).then((result) => {
      if (!cancelled) setInfo({ url, info: result });
    });
    return () => {
      cancelled = true;
    };
  }, [url]);
  return info && info.url === url ? info.info : undefined;
};

export const useCoverVisible = (item: Item | undefined) => {
  const { active, playback } = useItemPlayback(item);
  const info = useMediaInfo(active ? item?.media : undefined);
  const media = parseMedia(item?.media);
  if (!active || media?.kind !== 'youtube') return true;
  return !playback || playback.paused || playback.time < 3 || isArtTrack(info);
};

const formatTime = (seconds: number) => {
  const total = Math.max(0, Math.floor(seconds));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
};

export const ProgressStrip = ({ item, className }: { item: Item; className?: string }) => {
  const { playback, controller } = useItemPlayback(item);
  if (!playback || !controller) return null;
  const fraction = playback.duration ? playback.time / playback.duration : 0;
  const seek = (event: MouseEvent<HTMLDivElement>) => {
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();
    controller.seek(Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)));
  };
  return (
    <div
      className={`progress-strip${className ? ` ${className}` : ''}`}
      onClick={seek}
      role="slider"
      aria-label={`Position in ${item.label}`}
      aria-valuemin={0}
      aria-valuemax={Math.round(playback.duration)}
      aria-valuenow={Math.round(playback.time)}
      data-no-capture
    >
      <span style={{ width: `${fraction * 100}%` }} />
    </div>
  );
};

const PlayIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M8 5.5v13l11-6.5z" fill="currentColor" />
  </svg>
);

const PauseIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" fill="currentColor" />
  </svg>
);

const StopIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <rect x="7" y="7" width="10" height="10" rx="1.5" fill="currentColor" />
  </svg>
);

export const PlaybackButtons = ({ item, className }: { item: Item; className?: string }) => {
  const { toggle } = usePlayer();
  const { active, playback, controller } = useItemPlayback(item);
  if (!parseMedia(item.media)) return null;
  const extra = className ? ` ${className}` : '';
  if (!active) {
    return (
      <button
        className={`play-button small${extra}`}
        onClick={(event) => {
          event.stopPropagation();
          toggle(item);
        }}
        aria-label={`Play ${item.label}`}
        data-no-capture
      >
        <PlayIcon /> Play
      </button>
    );
  }
  return (
    <span className={`playback-buttons${extra}`} data-no-capture>
      {controller && (
        <button
          className="play-button small"
          onClick={(event) => {
            event.stopPropagation();
            controller.toggle();
          }}
          aria-label={playback?.paused ? `Resume ${item.label}` : `Pause ${item.label}`}
        >
          {playback?.paused ? <PlayIcon /> : <PauseIcon />}
        </button>
      )}
      {playback && playback.duration > 0 && (
        <span className="playback-time">
          {formatTime(playback.time)} / {formatTime(playback.duration)}
        </span>
      )}
      <button
        className="ghost small stop-button"
        onClick={(event) => {
          event.stopPropagation();
          toggle(item);
        }}
        aria-label={`Stop ${item.label}`}
      >
        <StopIcon /> Stop
      </button>
    </span>
  );
};

export const useItemImage = (item: Item | undefined, size: 'large' | 'small' = 'large') => {
  const direct = item?.image ?? mediaThumbnail(item?.media, size);
  const spotify = !direct && parseMedia(item?.media)?.kind === 'spotify' ? item?.media : undefined;
  const [fetched, setFetched] = useState<{ url: string; thumbnail?: string }>();

  useEffect(() => {
    if (!spotify) return;
    let cancelled = false;
    void fetchMediaInfo(spotify).then((info) => {
      if (!cancelled) setFetched({ url: spotify, thumbnail: info?.thumbnail });
    });
    return () => {
      cancelled = true;
    };
  }, [spotify]);

  return direct ?? (fetched?.url === spotify ? fetched?.thumbnail : undefined);
};

export const Thumb = ({ src, className }: { src: string; className?: string }) => {
  const [failed, setFailed] = useState<string>();
  const fallback = thumbnailFallback(src);
  const current = failed === src && fallback ? fallback : src;
  return (
    <img
      className={className}
      src={current}
      alt=""
      loading="lazy"
      onError={() => setFailed(src)}
      onLoad={(event) => {
        if (event.currentTarget.naturalWidth <= 120 && current === src) setFailed(src);
      }}
    />
  );
};

export const MediaThumb = ({ item, className }: { item: Item; className?: string }) => {
  const { toggle } = usePlayer();
  const { active } = useItemPlayback(item);
  const cover = useCoverVisible(item);
  const info = useMediaInfo(active && !item.image ? item.media : undefined);
  const square = parseMedia(item.media)?.kind === 'spotify' || isArtTrack(info);
  const media = parseMedia(item.media);
  const src = useItemImage(item, 'small');
  const large = useItemImage(item, 'large');
  const classes = `media-thumb${className ? ` ${className}` : ''}`;
  if (!media) return src ? <Thumb src={src} className={classes} /> : null;
  if (active) {
    return (
      <div
        className={`${classes} is-playing playing-${media.kind}${cover ? ' show-cover' : ''}`}
        data-no-capture
      >
        <div className="media-stage">
          <MediaSurface item={item} compact />
          {large && (
            <>
              <Thumb className="stage-fill" src={large} />
              <Thumb className={`stage-cover${square ? ' is-square' : ''}`} src={large} />
            </>
          )}
          <ProgressStrip item={item} className="stage-progress" />
        </div>
        <PlaybackButtons item={item} className="stage-buttons" />
      </div>
    );
  }
  return (
    <button
      className={`${classes} media-thumb-button`}
      onClick={() => toggle(item)}
      aria-label={`Play ${item.label}`}
    >
      {src ? <Thumb src={src} /> : <span className="media-thumb-empty" />}
      <span className="media-thumb-icon">
        <PlayIcon />
      </span>
    </button>
  );
};

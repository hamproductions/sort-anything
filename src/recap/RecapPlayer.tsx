import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent } from 'react';
import { Player } from '@remotion/player';
import type { PlayerRef } from '@remotion/player';
import {
  fetchMediaInfo,
  isArtTrack,
  mediaThumbnail,
  parseMedia,
  thumbnailFallback
} from '~/lib/media';
import type { RankedGroup } from '~/lib/format';
import type { Item, Pick } from '~/lib/types';
import { FPS, HEIGHT, RecapComposition, WIDTH, recapTimeline } from './RecapComposition';
import type { RecapData, RecapDecision, RecapEntry } from './RecapComposition';
import { createSong } from './songs';
import type { Song } from './songs';

export type RecapStats = {
  picks: number;
  durationMs: number;
  removed: number;
  log: Pick[];
};

const TOP = 5;

const loads = (src: string) =>
  new Promise<boolean>((resolve) => {
    const image = new Image();
    image.onload = () => resolve(image.naturalWidth > 120);
    image.onerror = () => resolve(false);
    image.src = src;
  });

const toEntry = async (item: Item, rank: number): Promise<RecapEntry> => {
  const media = parseMedia(item.media);
  const base = {
    rank,
    label: item.label,
    video: media?.kind === 'youtube',
    song: media?.kind === 'youtube' || media?.kind === 'audio'
  };
  if (item.image) return { ...base, image: item.image };
  if (!media) return base;
  const info = await fetchMediaInfo(item.media!);
  if (media.kind === 'spotify') return { ...base, image: info?.thumbnail, square: true };
  const large = mediaThumbnail(item.media, 'large');
  if (!large) return base;
  const image = (await loads(large)) ? large : (thumbnailFallback(large) ?? large);
  return { ...base, image, square: isArtTrack(info) };
};

const buildData = async (
  title: string,
  ranked: RankedGroup[],
  stats: RecapStats | undefined
): Promise<{ data: RecapData; songs: (string | undefined)[] }> => {
  const flat = ranked.flatMap(({ rank, items }) => items.map((item) => ({ rank, item })));
  const top = flat.filter(({ rank }) => rank <= TOP).slice(0, TOP);
  const entries = await Promise.all(top.map(({ item, rank }) => toEntry(item, rank)));
  const byId = new Map(flat.map(({ item, rank }) => [item.id, { item, rank }]));

  const decision = async (pick: Pick | undefined): Promise<RecapDecision | undefined> => {
    if (!pick) return undefined;
    const left = byId.get(pick.left[0]);
    const right = byId.get(pick.right[0]);
    if (!left || !right) return undefined;
    const [winner, loser] = pick.choice === 'right' ? [right, left] : [left, right];
    return {
      winner: await toEntry(winner.item, winner.rank),
      loser: await toEntry(loser.item, loser.rank),
      tie: pick.choice === 'tie',
      ms: pick.ms
    };
  };

  const timed = (stats?.log ?? []).filter((pick) => pick.ms > 0);
  const toughest = timed.reduce<Pick | undefined>((a, b) => (!a || b.ms > a.ms ? b : a), undefined);
  const easiest = timed.reduce<Pick | undefined>((a, b) => (!a || b.ms < a.ms ? b : a), undefined);

  return {
    data: {
      title: title || 'My ranking',
      total: flat.length,
      picks: stats?.picks,
      durationMs: stats?.durationMs,
      removed: stats?.removed,
      ties: ranked.filter((group) => group.items.length > 1).length,
      toughest: timed.length >= 2 ? await decision(toughest) : undefined,
      easiest: timed.length >= 2 && easiest !== toughest ? await decision(easiest) : undefined,
      entries
    },
    songs: top.map(({ item }) => item.media)
  };
};

export const RecapPlayer = ({
  title,
  ranked,
  stats,
  onClose
}: {
  title: string;
  ranked: RankedGroup[];
  stats?: RecapStats;
  onClose: () => void;
}) => {
  const [built, setBuilt] = useState<{ data: RecapData; songs: (string | undefined)[] }>();
  const [ready, setReady] = useState(false);
  const [frame, setFrame] = useState(0);
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(false);
  const [ended, setEnded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [needsTap, setNeedsTap] = useState(false);
  const playerRef = useRef<PlayerRef>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const layerRefs = useRef<(HTMLDivElement | null)[]>([]);
  const songs = useRef<(Song | undefined)[]>([]);
  const current = useRef<number>(undefined);
  const hold = useRef<{ timer: number; held: boolean }>(undefined);

  useEffect(() => {
    let cancelled = false;
    void buildData(title, ranked, stats).then((result) => {
      if (!cancelled) setBuilt(result);
    });
    return () => {
      cancelled = true;
    };
  }, [title, ranked, stats]);

  const timeline = useMemo(() => (built ? recapTimeline(built.data) : undefined), [built]);

  useEffect(() => {
    if (!built) return;
    let cancelled = false;
    void Promise.all(built.songs.map((url, i) => createSong(layerRefs.current[i], url))).then(
      (created) => {
        if (cancelled) return created.forEach((song) => song?.destroy());
        songs.current = created;
        setReady(true);
      }
    );
    return () => {
      cancelled = true;
      songs.current.forEach((song) => song?.destroy());
      songs.current = [];
      layerRefs.current.forEach((layer) => layer?.replaceChildren());
    };
  }, [built]);

  const switchSong = useCallback((index: number | undefined) => {
    if (current.current === index) return;
    if (current.current !== undefined) songs.current[current.current]?.stop();
    current.current = index;
    if (index !== undefined) songs.current[index]?.start();
  }, []);

  const slideAt = useCallback(
    (at: number) =>
      timeline?.slides.findIndex((slide) => at >= slide.from && at < slide.from + slide.length) ??
      -1,
    [timeline]
  );

  useEffect(() => {
    const player = playerRef.current;
    if (!ready || !player || !timeline) return;
    const onFrame = (event: { detail: { frame: number } }) => {
      setFrame(event.detail.frame);
      const slide = timeline.slides[slideAt(event.detail.frame)];
      switchSong(slide?.song);
    };
    const onEnded = () => setEnded(true);
    player.addEventListener('frameupdate', onFrame);
    player.addEventListener('ended', onEnded);
    player.seekTo(0);
    player.play();
    const check = window.setTimeout(() => {
      if (!player.isPlaying()) setNeedsTap(true);
    }, 700);
    return () => {
      window.clearTimeout(check);
      player.removeEventListener('frameupdate', onFrame);
      player.removeEventListener('ended', onEnded);
      switchSong(undefined);
    };
  }, [ready, timeline, slideAt, switchSong]);

  useEffect(() => {
    songs.current.forEach((song) => song?.setMuted(muted));
  }, [muted, ready]);

  const go = useCallback(
    (direction: 1 | -1) => {
      const player = playerRef.current;
      if (!player || !timeline) return;
      const at = player.getCurrentFrame();
      const index = slideAt(at);
      const slide = timeline.slides[index];
      const target =
        direction === 1
          ? timeline.slides[index + 1]
          : slide && at - slide.from > FPS
            ? slide
            : timeline.slides[Math.max(0, index - 1)];
      if (!target) {
        player.seekTo(timeline.duration - 1);
        player.pause();
        setEnded(true);
        return;
      }
      setEnded(false);
      player.seekTo(target.from);
      if (!paused) player.play();
    },
    [timeline, slideAt, paused]
  );

  const togglePause = useCallback(() => {
    const player = playerRef.current;
    if (!player) return;
    const index = current.current;
    if (paused) {
      player.play();
      if (index !== undefined) songs.current[index]?.resume();
    } else {
      player.pause();
      if (index !== undefined) songs.current[index]?.pause();
    }
    setPaused((p) => !p);
  }, [paused]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      else if (event.key === 'ArrowRight') go(1);
      else if (event.key === 'ArrowLeft') go(-1);
      else if (event.key === ' ') togglePause();
      else if (event.key.toLowerCase() === 'm') setMuted((m) => !m);
      else return;
      event.preventDefault();
      event.stopPropagation();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [go, togglePause, onClose]);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  const onPointerDown = () => {
    const player = playerRef.current;
    hold.current = {
      held: false,
      timer: window.setTimeout(() => {
        if (!hold.current) return;
        hold.current.held = true;
        player?.pause();
        if (current.current !== undefined) songs.current[current.current]?.pause();
      }, 220)
    };
  };

  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (needsTap) {
      if (hold.current) window.clearTimeout(hold.current.timer);
      hold.current = undefined;
      setNeedsTap(false);
      playerRef.current?.play();
      return;
    }
    const state = hold.current;
    hold.current = undefined;
    if (!state) return;
    window.clearTimeout(state.timer);
    if (state.held) {
      if (!paused) {
        playerRef.current?.play();
        if (current.current !== undefined) songs.current[current.current]?.resume();
      }
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    go(event.clientX - rect.left < rect.width * 0.3 ? -1 : 1);
  };

  const saveImage = async () => {
    const node = stageRef.current?.querySelector<HTMLElement>('.recap-canvas');
    if (!node) return;
    setSaving(true);
    try {
      const { domToBlob } = await import('modern-screenshot');
      const blob = await domToBlob(node, { scale: 2 });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${(built?.data.title ?? 'ranking').replace(/[^\p{L}\p{N}]+/gu, '-')}-top.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } finally {
      setSaving(false);
    }
  };

  const activeIndex = slideAt(frame);
  const activeSlide = timeline?.slides[activeIndex];
  const videoIndex =
    activeSlide?.kind === 'rank' && built?.data.entries[activeSlide.entry]?.video
      ? activeSlide.entry
      : undefined;

  return (
    <div className="recap-backdrop" role="dialog" aria-modal="true" aria-label="Ranking recap">
      <div className="recap-stage" ref={stageRef}>
        {timeline && (
          <div className="recap-segments" aria-hidden="true">
            {timeline.slides.map((slide, i) => (
              <span key={i}>
                <span
                  style={{
                    width: `${
                      i < activeIndex || ended
                        ? 100
                        : i > activeIndex
                          ? 0
                          : Math.min(100, ((frame - slide.from) / slide.length) * 100)
                    }%`
                  }}
                />
              </span>
            ))}
          </div>
        )}
        <div className="recap-videos" aria-hidden="true">
          {(built?.songs ?? []).map((_, i) => (
            <div
              key={i}
              className={`recap-video${videoIndex === i ? ' is-current' : ''}`}
              ref={(element) => {
                layerRefs.current[i] = element;
              }}
            />
          ))}
        </div>
        {built && timeline ? (
          <div className="recap-canvas">
            <Player
              ref={playerRef}
              component={RecapComposition}
              inputProps={{ data: built.data }}
              durationInFrames={timeline.duration}
              fps={FPS}
              compositionWidth={WIDTH}
              compositionHeight={HEIGHT}
              style={{ width: '100%', height: '100%', background: 'transparent' }}
              controls={false}
              clickToPlay={false}
              acknowledgeRemotionLicense
            />
          </div>
        ) : null}
        <div
          className="recap-tap"
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          onPointerLeave={() => {
            if (hold.current) window.clearTimeout(hold.current.timer);
          }}
        />
        {(!built || !ready) && <div className="recap-wait">Loading your recap…</div>}
        {needsTap && ready && <div className="recap-wait recap-tap-hint">Tap to start</div>}
        <div className="recap-top">
          <button className="recap-chip" onClick={() => setMuted((m) => !m)}>
            {muted ? 'Sound off' : 'Sound on'}
          </button>
          <button className="recap-chip" disabled={saving} onClick={() => void saveImage()}>
            {saving ? 'Saving…' : 'Save image'}
          </button>
          <button className="recap-chip" onClick={togglePause}>
            {paused ? 'Play' : 'Pause'}
          </button>
          <button className="recap-chip" onClick={onClose} aria-label="Close recap">
            Close
          </button>
        </div>
        {ended && (
          <div className="recap-end">
            <button className="primary" disabled={saving} onClick={() => void saveImage()}>
              {saving ? 'Saving…' : 'Save image'}
            </button>
            <button
              onClick={() => {
                setEnded(false);
                playerRef.current?.seekTo(0);
                playerRef.current?.play();
              }}
            >
              Watch again
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

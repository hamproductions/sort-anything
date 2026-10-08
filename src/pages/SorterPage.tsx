import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { navigate, useHotkeys } from '~/lib/hooks';
import { estimateRemaining, getPair, getProgress } from '~/lib/engine';
import type { Choice } from '~/lib/merge-sort';
import { applyChoice, applyDrop, applyUndo } from '~/lib/session';
import { loadSession, saveSession } from '~/lib/storage';
import type { Item, Session } from '~/lib/types';
import { useToast } from '~/components/Toast';
import { NotFound } from '~/components/NotFound';
import {
  MediaSurface,
  PlaybackButtons,
  ProgressStrip,
  Thumb,
  playerKey,
  useCoverVisible,
  useItemImage,
  useMediaInfo,
  usePlayer
} from '~/components/MediaPlayer';
import { isArtTrack, parseMedia } from '~/lib/media';

const Side = ({
  side,
  items,
  outcome,
  onPick,
  onDrop
}: {
  side: 'left' | 'right';
  items: Item[];
  outcome?: 'won' | 'lost' | 'tie';
  onPick: () => void;
  onDrop: () => void;
}) => {
  const { playingKey } = usePlayer();
  const coverItem = items.find((item) => item.image || item.media);
  const image = useItemImage(coverItem);
  const coverUrl = coverItem?.image ? undefined : coverItem?.media;
  const coverInfo = useMediaInfo(coverUrl);
  const square = parseMedia(coverUrl)?.kind === 'spotify' || isArtTrack(coverInfo);
  const playingItem = items.find((item) => playingKey === playerKey(item));
  const media = parseMedia(playingItem?.media);
  const cover = useCoverVisible(playingItem);
  return (
    <div
      className={`side side-${side}${outcome ? ` ${outcome}` : ''}${media ? ` is-playing playing-${media.kind}${cover ? ' show-cover' : ''}` : ''}`}
    >
      <div className="side-card">
        {playingItem && (
          <div className="side-media">
            <MediaSurface item={playingItem} />
          </div>
        )}
        <button
          className={`side-pick${image ? ' has-art' : ''}`}
          onClick={onPick}
          aria-keyshortcuts={side === 'left' ? 'ArrowLeft' : 'ArrowRight'}
          aria-label={`Pick ${items.map((item) => item.label).join(' and ')}`}
        >
          {image && (
            <span className="side-art">
              <Thumb className="side-image-fill" src={image} />
              <Thumb className={`side-image${square ? ' is-square' : ''}`} src={image} />
            </span>
          )}
          <span className="side-labels">
            {items.map((item) => (
              <span key={item.id} className="side-label" title={item.label}>
                {item.label}
              </span>
            ))}
          </span>
        </button>
        {playingItem && <ProgressStrip item={playingItem} className="side-progress" />}
      </div>
      <div className="side-tools">
        {items.map((item) => (
          <PlaybackButtons key={item.id} item={item} />
        ))}
        <button className="ghost small" onClick={onDrop}>
          {items.length > 1 ? 'Remove these' : 'Remove'}
        </button>
      </div>
    </div>
  );
};

export const SorterPage = ({ id }: { id: string }) => {
  const toast = useToast();
  const [session, setSession] = useState<Session | undefined>(() => loadSession(id));
  const [exiting, setExiting] = useState<Choice>();
  const pending = useRef<{ choice: Choice; ms: number; timer: number }>(undefined);
  const { toggle, stop } = usePlayer();

  useEffect(() => {
    if (!session) return;
    saveSession(session);
    if (session.finishedAt) navigate(`/done/${session.id}`);
  }, [session]);

  const byId = useMemo(
    () => new Map(session?.items.map((item) => [item.id, item])),
    [session?.items]
  );
  const pair = session ? getPair(session.engine) : undefined;
  const pairKey = pair ? `${pair.left.join()}|${pair.right.join()}` : '';

  useEffect(() => stop, [pairKey, stop]);

  const shownAt = useRef(0);
  useEffect(() => {
    shownAt.current = performance.now();
  }, [pairKey]);

  const playSide = useCallback(
    (side: 'left' | 'right') => {
      const ids = pair?.[side] ?? [];
      const item = ids.map((x) => byId.get(x)).find((candidate) => candidate?.media);
      if (item) toggle(item);
    },
    [pair, byId, toggle]
  );

  const commit = useCallback(() => {
    const current = pending.current;
    if (!current) return;
    window.clearTimeout(current.timer);
    pending.current = undefined;
    setExiting(undefined);
    setSession((s) => (s && getPair(s.engine) ? applyChoice(s, current.choice, current.ms) : s));
  }, []);

  const sessionRef = useRef(session);
  sessionRef.current = session;

  useEffect(
    () => () => {
      const current = pending.current;
      if (!current) return;
      window.clearTimeout(current.timer);
      const latest = sessionRef.current;
      if (latest && getPair(latest.engine))
        saveSession(applyChoice(latest, current.choice, current.ms));
    },
    []
  );

  const pick = useCallback(
    (choice: Choice) => {
      commit();
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      pending.current = {
        choice,
        ms: Math.round(performance.now() - shownAt.current),
        timer: window.setTimeout(commit, reduced ? 0 : 190)
      };
      setExiting(choice);
    },
    [commit]
  );

  const undo = useCallback(() => {
    commit();
    setSession((s) => {
      if (!s || s.history.length === 0) return s;
      return applyUndo(s);
    });
  }, [commit]);

  const drop = (ids: string[]) => {
    const labels = ids.map((x) => byId.get(x)?.label).join(', ');
    setSession((s) => (s ? applyDrop(s, ids) : s));
    toast(`Removed ${labels}. Undo brings it back.`);
  };

  const onKey = useCallback(
    (event: KeyboardEvent) => {
      const map: Record<string, () => void> = {
        ArrowLeft: () => pick('left'),
        a: () => pick('left'),
        '1': () => pick('left'),
        ArrowRight: () => pick('right'),
        d: () => pick('right'),
        '2': () => pick('right'),
        ArrowDown: () => pick('tie'),
        s: () => pick('tie'),
        '3': () => pick('tie'),
        ArrowUp: undo,
        w: undo,
        Backspace: undo,
        z: undo,
        q: () => playSide('left'),
        e: () => playSide('right'),
        Escape: () => navigate('/')
      };
      const action = map[event.key.length === 1 ? event.key.toLowerCase() : event.key];
      if (!action || event.repeat) return;
      if (event.ctrlKey && event.key.toLowerCase() !== 'z') return;
      event.preventDefault();
      action();
    },
    [pick, undo, playSide]
  );

  useHotkeys(onKey, !!session);

  if (!session) return <NotFound what="sorting session" />;
  if (!pair) return null;

  const left = pair.left.map((x) => byId.get(x)).filter((item): item is Item => !!item);
  const right = pair.right.map((x) => byId.get(x)).filter((item): item is Item => !!item);
  const progress = getProgress(session.engine, session.comparisons);
  const hasMedia = [...left, ...right].some((item) => item.media);
  const remaining = estimateRemaining(session.engine);

  return (
    <div className="sorter">
      <div className="sorter-head">
        <h1 className="sorter-title">{session.title}</h1>
        <div className="sorter-stats">
          <span>Pick {session.comparisons + 1}</span>
          <span className="muted">about {remaining} to go</span>
        </div>
      </div>
      <div
        className="progress"
        role="progressbar"
        aria-valuenow={Math.round(progress * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Sorting progress"
      >
        <span style={{ width: `${progress * 100}%` }} />
      </div>

      <div className="faceoff" key={pairKey}>
        <Side
          side="left"
          items={left}
          outcome={
            exiting === 'tie' ? 'tie' : exiting ? (exiting === 'left' ? 'won' : 'lost') : undefined
          }
          onPick={() => pick('left')}
          onDrop={() => drop(pair.left)}
        />
        <div className="versus" aria-hidden="true">
          vs
        </div>
        <Side
          side="right"
          items={right}
          outcome={
            exiting === 'tie' ? 'tie' : exiting ? (exiting === 'right' ? 'won' : 'lost') : undefined
          }
          onPick={() => pick('right')}
          onDrop={() => drop(pair.right)}
        />
      </div>

      <div className="sorter-actions">
        <button className="ghost" onClick={undo} disabled={session.history.length === 0}>
          Undo <kbd>↑</kbd>
        </button>
        <button className={`tie${exiting === 'tie' ? ' flash' : ''}`} onClick={() => pick('tie')}>
          Tie, or can’t decide <kbd>↓</kbd>
        </button>
        <button className="ghost" onClick={() => navigate('/')}>
          Save and leave <kbd>Esc</kbd>
        </button>
      </div>
      <p className="sorter-hint">
        <kbd>←</kbd> <kbd>→</kbd> pick, <kbd>↓</kbd> tie, <kbd>↑</kbd> undo
        {hasMedia && (
          <>
            , <kbd>Q</kbd> <kbd>E</kbd> play
          </>
        )}
        . Progress saves on this device.
      </p>
    </div>
  );
};

import {
  choose,
  createInsertEngine,
  createMergeEngine,
  dropItem,
  getPair,
  getResult,
  isDone
} from './engine';
import type { Choice } from './merge-sort';
import type { ParsedItem } from './parse';
import { createId } from './storage';
import type { Item, Pick, Session } from './types';

export type StartOptions = {
  title: string;
  items: ParsedItem[];
  ranking?: number[][];
  unranked?: number[];
  mode: 'fresh' | 'insert';
  shuffle: boolean;
};

const shuffled = <T>(list: T[]) => {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

export const startSession = ({ title, items, ranking, unranked, mode, shuffle }: StartOptions) => {
  const sessionItems: Item[] = items.map((item, i) => ({ ...item, id: String(i) }));
  const ids = sessionItems.map((item) => item.id);
  const rankedOrder = ranking ? [...ranking.flat(), ...(unranked ?? [])].map(String) : ids;
  const engine =
    mode === 'insert' && ranking
      ? createInsertEngine(
          ranking.map((g) => g.map(String)),
          (shuffle ? shuffled(unranked ?? []) : (unranked ?? [])).map(String)
        )
      : createMergeEngine(shuffle ? shuffled(ids) : rankedOrder);
  const now = Date.now();
  const session: Session = {
    id: createId(),
    title: title.trim() || 'Untitled ranking',
    items: sessionItems,
    engine,
    history: [],
    comparisons: 0,
    createdAt: now,
    updatedAt: now,
    finishedAt: isDone(engine) ? now : undefined
  };
  return session;
};

const finish = (session: Session): Session => ({
  ...session,
  updatedAt: Date.now(),
  finishedAt: isDone(session.engine) ? (session.finishedAt ?? Date.now()) : undefined
});

export const applyChoice = (session: Session, choice: Choice, ms?: number) => {
  const pair = getPair(session.engine);
  const pick: Pick | undefined =
    pair && ms !== undefined ? { ...pair, choice, ms: Math.min(ms, 120_000) } : undefined;
  return finish({
    ...session,
    history: [
      ...session.history,
      { engine: session.engine, comparisons: session.comparisons, pick }
    ],
    engine: choose(session.engine, choice),
    comparisons: session.comparisons + 1
  });
};

export const sessionPicks = (session: Session) =>
  session.history.flatMap((entry) => (entry.pick ? [entry.pick] : []));

export const applyDrop = (session: Session, ids: string[]) =>
  finish({
    ...session,
    history: [...session.history, { engine: session.engine, comparisons: session.comparisons }],
    engine: ids.reduce(dropItem, session.engine)
  });

export const applyUndo = (session: Session) => {
  const previous = session.history.at(-1);
  if (!previous) return session;
  return finish({
    ...session,
    history: session.history.slice(0, -1),
    engine: previous.engine,
    comparisons: previous.comparisons,
    finishedAt: undefined,
    override: undefined
  });
};

export const sessionResult = (session: Session) => session.override ?? getResult(session.engine);

export const restartSession = (session: Session) => {
  const kept = new Set(sessionResult(session).flat());
  return startSession({
    title: session.title,
    items: session.items
      .filter((item) => kept.has(item.id))
      .map(({ label, image, media }) => ({ label, image, media })),
    mode: 'fresh',
    shuffle: true
  });
};

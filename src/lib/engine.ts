import type { Choice, SortState } from './merge-sort';
import {
  calculateMaxComparisons,
  estimateComparisonsMade,
  getCurrentPair,
  initSort,
  removeItem,
  step
} from './merge-sort';

export type MergeEngine = { kind: 'merge'; state: SortState<string> };

export type InsertEngine = {
  kind: 'insert';
  ranked: string[][];
  pending: string[];
  lo: number;
  hi: number;
};

export type Engine = MergeEngine | InsertEngine;

export type Pair = { left: string[]; right: string[] };

const settle = (engine: InsertEngine): InsertEngine => {
  const next = { ...engine };
  while (next.pending.length > 0 && next.lo >= next.hi) {
    next.ranked = [
      ...next.ranked.slice(0, next.lo),
      [next.pending[0]],
      ...next.ranked.slice(next.lo)
    ];
    next.pending = next.pending.slice(1);
    next.lo = 0;
    next.hi = next.ranked.length;
  }
  return next;
};

export const createMergeEngine = (ids: string[]): Engine => ({
  kind: 'merge',
  state: initSort(ids)
});

export const createInsertEngine = (ranked: string[][], pending: string[]): Engine =>
  settle({ kind: 'insert', ranked, pending, lo: 0, hi: ranked.length });

export const getPair = (engine: Engine): Pair | undefined => {
  if (engine.kind === 'merge') return getCurrentPair(engine.state);
  if (engine.pending.length === 0) return undefined;
  const mid = Math.floor((engine.lo + engine.hi) / 2);
  return { left: [engine.pending[0]], right: engine.ranked[mid] };
};

export const isDone = (engine: Engine) => getPair(engine) === undefined;

export const choose = (engine: Engine, choice: Choice): Engine => {
  if (engine.kind === 'merge') {
    return { kind: 'merge', state: step(choice, structuredClone(engine.state)) };
  }
  if (engine.pending.length === 0) return engine;
  const mid = Math.floor((engine.lo + engine.hi) / 2);
  if (choice === 'tie') {
    const ranked = engine.ranked.map((g, i) => (i === mid ? [...g, engine.pending[0]] : g));
    const pending = engine.pending.slice(1);
    return settle({ ...engine, ranked, pending, lo: 0, hi: ranked.length });
  }
  return settle(choice === 'left' ? { ...engine, hi: mid } : { ...engine, lo: mid + 1 });
};

export const getResult = (engine: Engine): string[][] =>
  (engine.kind === 'merge'
    ? engine.state.arr
    : [...engine.ranked, ...engine.pending.map((p) => [p])]
  ).filter((g) => g.length > 0);

const insertRemaining = (engine: InsertEngine) => {
  if (engine.pending.length === 0) return 0;
  const current = Math.ceil(Math.log2(engine.hi - engine.lo + 1));
  return engine.pending
    .slice(1)
    .reduce((sum, _, i) => sum + Math.ceil(Math.log2(engine.ranked.length + i + 2)), current);
};

export const estimateRemaining = (engine: Engine) =>
  engine.kind === 'merge'
    ? isDone(engine)
      ? 0
      : Math.max(
          1,
          calculateMaxComparisons(engine.state.arr.length) - estimateComparisonsMade(engine.state)
        )
    : insertRemaining(engine);

export const getProgress = (engine: Engine, comparisons: number) => {
  const remaining = estimateRemaining(engine);
  return remaining === 0 ? 1 : comparisons / (comparisons + remaining);
};

export const dropItem = (engine: Engine, id: string): Engine => {
  if (engine.kind === 'merge') {
    return { kind: 'merge', state: removeItem(id, structuredClone(engine.state)) };
  }
  const ranked = engine.ranked.map((g) => g.filter((x) => x !== id)).filter((g) => g.length > 0);
  const pending = engine.pending.filter((x) => x !== id);
  return settle({ ...engine, ranked, pending, lo: 0, hi: ranked.length });
};

import { describe, expect, it } from 'vitest';
import {
  choose,
  createInsertEngine,
  createMergeEngine,
  dropItem,
  estimateRemaining,
  getPair,
  getProgress,
  getResult,
  isDone
} from './engine';
import type { Engine } from './engine';
import { calculateMaxComparisons } from './merge-sort';

const value = (group: string[]) => Number(group[0]);

const runToEnd = (
  engine: Engine,
  prefer: (left: string[], right: string[]) => 'left' | 'right' | 'tie'
) => {
  let current = engine;
  let picks = 0;
  for (let pair = getPair(current); pair; pair = getPair(current)) {
    current = choose(current, prefer(pair.left, pair.right));
    picks++;
    if (picks > 10_000) throw new Error('sort did not finish');
  }
  return { engine: current, picks };
};

const shuffled = (n: number, seed: number) => {
  const ids = Array.from({ length: n }, (_, i) => String(i + 1));
  let state = seed;
  for (let i = ids.length - 1; i > 0; i--) {
    state = (state * 9301 + 49297) % 233280;
    const j = Math.floor((state / 233280) * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  return ids;
};

describe('merge engine', () => {
  it('finishes immediately for zero or one item', () => {
    expect(isDone(createMergeEngine([]))).toBe(true);
    expect(getResult(createMergeEngine(['a']))).toEqual([['a']]);
  });

  it.each([2, 3, 5, 8, 13, 31])('sorts %i items within the comparison bound', (n) => {
    const { engine, picks } = runToEnd(createMergeEngine(shuffled(n, n)), (l, r) =>
      value(l) < value(r) ? 'left' : 'right'
    );
    expect(getResult(engine).flat().map(Number)).toEqual(
      Array.from({ length: n }, (_, i) => i + 1)
    );
    expect(picks).toBeLessThanOrEqual(calculateMaxComparisons(n));
    expect(estimateRemaining(engine)).toBe(0);
  });

  it('groups ties together', () => {
    const num = (group: string[]) => Number(group[0].replace('b', ''));
    const { engine } = runToEnd(createMergeEngine(['1', '2', '2b', '3']), (l, r) =>
      num(l) === num(r) ? 'tie' : num(l) < num(r) ? 'left' : 'right'
    );
    expect(getResult(engine)).toEqual([['1'], ['2', '2b'], ['3']]);
  });

  it('drops an item mid-sort and keeps sorting the rest', () => {
    let engine = createMergeEngine(['4', '1', '3', '2', '5']);
    engine = choose(engine, 'right');
    engine = dropItem(engine, '3');
    const { engine: done } = runToEnd(engine, (l, r) => (value(l) < value(r) ? 'left' : 'right'));
    expect(getResult(done).flat()).toEqual(['1', '2', '4', '5']);
  });

  it('never mutates the engine it was given', () => {
    const engine = createMergeEngine(['2', '1', '3']);
    const before = JSON.stringify(engine);
    choose(engine, 'left');
    choose(engine, 'tie');
    expect(JSON.stringify(engine)).toBe(before);
  });

  it('reports progress between 0 and 1 that reaches 1', () => {
    let engine = createMergeEngine(shuffled(10, 3));
    let picks = 0;
    let last = 0;
    for (let pair = getPair(engine); pair; pair = getPair(engine)) {
      const progress = getProgress(engine, picks);
      expect(progress).toBeGreaterThanOrEqual(0);
      expect(progress).toBeLessThan(1);
      last = progress;
      engine = choose(engine, value(pair.left) < value(pair.right) ? 'left' : 'right');
      picks++;
    }
    expect(last).toBeGreaterThan(0.5);
    expect(getProgress(engine, picks)).toBe(1);
  });
});

describe('insert engine', () => {
  it('places new items into an existing ranking', () => {
    const start = createInsertEngine([['1'], ['3'], ['5'], ['7']], ['4', '0', '9']);
    const { engine, picks } = runToEnd(start, (l, r) => (value(l) < value(r) ? 'left' : 'right'));
    expect(getResult(engine).flat()).toEqual(['0', '1', '3', '4', '5', '7', '9']);
    expect(picks).toBeLessThanOrEqual(3 * 3);
  });

  it('ties a new item into an existing group', () => {
    const { engine } = runToEnd(createInsertEngine([['1'], ['5'], ['9']], ['5b']), (l, r) => {
      const a = Number(l[0].replace('b', ''));
      const b = value(r);
      return a === b ? 'tie' : a < b ? 'left' : 'right';
    });
    expect(getResult(engine)).toEqual([['1'], ['5', '5b'], ['9']]);
  });

  it('places items straight away when the ranking is empty', () => {
    const engine = createInsertEngine([], ['a']);
    expect(isDone(engine)).toBe(true);
    expect(getResult(engine)).toEqual([['a']]);
  });

  it('drops ranked and pending items', () => {
    let engine = createInsertEngine([['1'], ['3']], ['2', '4']);
    engine = dropItem(engine, '3');
    engine = dropItem(engine, '4');
    const { engine: done } = runToEnd(engine, (l, r) => (value(l) < value(r) ? 'left' : 'right'));
    expect(getResult(done).flat()).toEqual(['1', '2']);
  });
});

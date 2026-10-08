import { describe, expect, it } from 'vitest';
import { getPair } from './engine';
import {
  applyChoice,
  applyDrop,
  applyUndo,
  restartSession,
  sessionPicks,
  sessionResult,
  startSession
} from './session';

const start = () =>
  startSession({
    title: 'Test',
    items: [{ label: 'A' }, { label: 'B' }, { label: 'C', media: 'https://youtu.be/dQw4w9WgXcQ' }],
    mode: 'fresh',
    shuffle: false
  });

describe('session', () => {
  it('records each pick with how long it took', () => {
    const session = start();
    const pair = getPair(session.engine)!;
    const next = applyChoice(session, 'left', 1500);
    expect(next.comparisons).toBe(1);
    expect(sessionPicks(next)).toEqual([{ ...pair, choice: 'left', ms: 1500 }]);
  });

  it('caps idle pick times at two minutes', () => {
    expect(sessionPicks(applyChoice(start(), 'right', 600_000))[0].ms).toBe(120_000);
  });

  it('undo removes the last pick', () => {
    const picked = applyChoice(applyChoice(start(), 'left', 100), 'right', 200);
    const undone = applyUndo(picked);
    expect(undone.comparisons).toBe(1);
    expect(sessionPicks(undone).map((pick) => pick.ms)).toEqual([100]);
  });

  it('finishes and sets finishedAt', () => {
    let session = start();
    while (getPair(session.engine)) session = applyChoice(session, 'left', 10);
    expect(session.finishedAt).toBeDefined();
    expect(sessionResult(session).flat()).toHaveLength(3);
  });

  it('starts an insert session from a ranking', () => {
    const session = startSession({
      title: 'Insert',
      items: [{ label: 'A' }, { label: 'B' }, { label: 'New' }],
      ranking: [[0], [1]],
      unranked: [2],
      mode: 'insert',
      shuffle: false
    });
    expect(getPair(session.engine)?.left).toEqual(['2']);
  });

  it('sort again keeps songs and leaves out removed items', () => {
    let session = applyDrop(start(), ['1']);
    while (getPair(session.engine)) session = applyChoice(session, 'left', 10);
    const again = restartSession(session);
    expect(again.items.map((item) => item.label).sort()).toEqual(['A', 'C']);
    expect(again.items.find((item) => item.label === 'C')?.media).toBe(
      'https://youtu.be/dQw4w9WgXcQ'
    );
  });
});

import { describe, expect, it } from 'vitest';
import { draftFromItems, draftFromText, draftRanking, draftToText, mergeItems } from './draft';

describe('draft', () => {
  it('puts a pasted ranking first and new items after it', () => {
    const draft = draftFromText('', 'Snacks:\n2. B\n1. A\n2. C\nD');
    expect(draft.title).toBe('Snacks');
    expect(draft.items.map((item) => [item.label, item.rank])).toEqual([
      ['A', 1],
      ['B', 2],
      ['C', 2],
      ['D', undefined]
    ]);
    expect(draftRanking(draft.items)).toEqual([[0], [1, 2]]);
  });

  it('merges pasted items into the list without duplicates', () => {
    const base = draftFromText('', 'Apple\nBanana').items;
    const { items, added, merged } = mergeItems(
      base,
      draftFromText('', 'banana | https://youtu.be/dQw4w9WgXcQ\nCherry').items
    );
    expect(added).toBe(1);
    expect(merged).toBe(1);
    expect(items.map((item) => [item.label, item.media])).toEqual([
      ['Apple', undefined],
      ['Banana', 'https://youtu.be/dQw4w9WgXcQ'],
      ['Cherry', undefined]
    ]);
  });

  it('turns results back into a ranked draft', () => {
    const draft = draftFromItems(
      'Results',
      [
        { id: 'x', label: 'X' },
        { id: 'y', label: 'Y' },
        { id: 'z', label: 'Z' }
      ],
      [['y'], ['x', 'z']]
    );
    expect(draft.items.map((item) => [item.label, item.rank])).toEqual([
      ['Y', 1],
      ['X', 2],
      ['Z', 2]
    ]);
  });

  it('round-trips through edit-as-text', () => {
    const draft = draftFromText('', '1. A | https://x.com/a.png\n2. B\nC');
    const again = draftFromText('', draftToText(draft.items));
    expect(again.items.map(({ label, image, rank }) => ({ label, image, rank }))).toEqual(
      draft.items.map(({ label, image, rank }) => ({ label, image, rank }))
    );
  });
});

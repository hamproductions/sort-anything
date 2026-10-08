import { describe, expect, it } from 'vitest';
import { moveInRanking, rankGroups, toCsv, toEditorText, toPasteList, toPlainText } from './format';
import { parseInput } from './parse';
import type { Item } from './types';

const items: Item[] = [
  {
    id: '0',
    label: 'Dandelion',
    media: 'https://www.youtube.com/watch?v=9gT3_crPQik&list=OLAK5uy_x'
  },
  { id: '1', label: 'スターチス [Remix] | live', media: 'https://youtu.be/dQw4w9WgXcQ?t=30' },
  {
    id: '2',
    label: '向日葵 *extended*',
    media: 'https://open.spotify.com/intl-ja/track/4cOdK2wGLETKBW3PvgPWqT?si=abc'
  },
  { id: '3', label: 'プルメリア', image: 'https://x.com/a.png' },
  {
    id: '4',
    label: 'baby blue eyes',
    image: 'https://x.com/b.png',
    media: 'https://youtu.be/jNQXAC9IVRw'
  },
  { id: '5', label: 'レモンスノー' }
];
const groups = [['0'], ['1', '2'], ['3'], ['4'], ['5']];
const APP = 'https://hamproductions.github.io/sort-anything/';

describe('rankGroups', () => {
  it('numbers ties the same and skips the next ranks', () => {
    expect(rankGroups(groups, items).map(({ rank }) => rank)).toEqual([1, 2, 4, 5, 6]);
  });
});

describe('toPasteList', () => {
  const text = toPasteList('Floweriry', rankGroups(groups, items), APP);

  it('writes Discord-friendly Markdown with short, wrapped links', () => {
    expect(text.split('\n')).toEqual([
      '## Floweriry',
      '**1.** [Dandelion](<https://youtu.be/9gT3_crPQik>)',
      '**2.** [スターチス \\[Remix\\] \\| live](<https://youtu.be/dQw4w9WgXcQ?t=30>)',
      '**2.** [向日葵 \\*extended\\*](<https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT>)',
      '**4.** [プルメリア](<https://x.com/a.png>)',
      '**5.** [baby blue eyes](<https://youtu.be/jNQXAC9IVRw>) | <https://x.com/b.png>',
      '**6.** レモンスノー',
      `-# Sorted with [Sort Anything](<${APP}>)`
    ]);
  });

  it('pastes back into the same list, ranks and songs', () => {
    const parsed = parseInput(text);
    expect(parsed.title).toBe('Floweriry');
    expect(parsed.ranking).toEqual([[0], [1, 2], [3], [4], [5]]);
    expect(parsed.items).toEqual([
      { label: 'Dandelion', media: 'https://youtu.be/9gT3_crPQik' },
      { label: 'スターチス [Remix] | live', media: 'https://youtu.be/dQw4w9WgXcQ?t=30' },
      {
        label: '向日葵 *extended*',
        media: 'https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT'
      },
      { label: 'プルメリア', image: 'https://x.com/a.png' },
      {
        label: 'baby blue eyes',
        image: 'https://x.com/b.png',
        media: 'https://youtu.be/jNQXAC9IVRw'
      },
      { label: 'レモンスノー' }
    ]);
  });

  it('leaves out the title and link when not given', () => {
    expect(toPasteList('  ', rankGroups([['5']], items))).toBe('**1.** レモンスノー');
  });
});

describe('toEditorText', () => {
  it('round-trips through the parser with ranks', () => {
    const parsed = parseInput(toEditorText(items, groups));
    expect(parsed.ranking).toEqual([[0], [1, 2], [3], [4], [5]]);
    expect(parsed.items.map((item) => item.label)).toEqual(items.map((item) => item.label));
  });
});

describe('toPlainText', () => {
  it('lists names only, with an optional limit', () => {
    expect(toPlainText('T', rankGroups(groups, items), undefined, 2)).toBe(
      'T\n1. Dandelion\n2. スターチス [Remix] | live'
    );
  });
});

describe('toCsv', () => {
  it('quotes every field and escapes quotes', () => {
    const csv = toCsv(rankGroups([['0']], [{ id: '0', label: 'Say "hi", ok' }]));
    expect(csv).toBe('rank,item,image,media\n"1","Say ""hi"", ok","",""');
  });
});

describe('moveInRanking', () => {
  const groups = [['a'], ['b', 'c'], ['d'], ['e']];

  it('moves an item to a new place and keeps other ties', () => {
    expect(moveInRanking(groups, 'e', 0)).toEqual([['e'], ['a'], ['b', 'c'], ['d']]);
    expect(moveInRanking(groups, 'a', 4)).toEqual([['b', 'c'], ['d'], ['e'], ['a']]);
  });

  it('takes a tied item out of its tie', () => {
    expect(moveInRanking(groups, 'c', 0)).toEqual([['c'], ['a'], ['b'], ['d'], ['e']]);
    expect(moveInRanking(groups, 'b', 3)).toEqual([['a'], ['c'], ['d'], ['b'], ['e']]);
  });

  it('does not join a tie when dropped inside one', () => {
    expect(moveInRanking(groups, 'e', 2)).toEqual([['a'], ['b'], ['e'], ['c'], ['d']]);
  });

  it('leaves the ranking alone when nothing moves', () => {
    expect(moveInRanking(groups, 'd', 3)).toBe(groups);
  });
});

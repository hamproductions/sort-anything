import { describe, expect, it } from 'vitest';
import {
  decodeCompact,
  decodeList,
  decodeShared,
  encodeCompact,
  encodeList,
  toSharedList
} from './share';

describe('share links', () => {
  it('round-trips titles, pictures, songs and rankings', () => {
    const list = {
      title: 'Floweriry',
      items: [
        { label: 'Dandelion', media: 'https://youtu.be/9gT3_crPQik' },
        { label: 'Bear', image: 'https://x.com/b.png' },
        { label: 'Both', image: 'https://x.com/c.png', media: 'https://youtu.be/jNQXAC9IVRw' },
        { label: 'Plain' }
      ],
      ranking: [[2], [0, 1], [3]]
    };
    expect(decodeList(encodeList(list))).toEqual(list);
  });

  it('rejects broken data', () => {
    expect(decodeList('not-a-real-payload')).toBeUndefined();
    expect(decodeList('')).toBeUndefined();
  });

  it('leaves removed items out of the shared list', () => {
    const items = [
      { id: 'a', label: 'A' },
      { id: 'b', label: 'B' },
      { id: 'c', label: 'C' }
    ];
    expect(toSharedList('T', items, [['c'], ['a']])).toEqual({
      title: 'T',
      items: [{ label: 'A' }, { label: 'C' }],
      ranking: [[1], [0]]
    });
  });
});

describe('compact share links', () => {
  const list = {
    title: 'Floweriry',
    items: [
      { label: 'Dandelion', media: 'https://youtu.be/9gT3_crPQik?t=30' },
      {
        label: 'ひっさつマイマイモード',
        media: 'https://open.spotify.com/track/7n7JBYchOMRQX431dswTR7'
      },
      { label: 'Bear', image: 'https://x.com/b.png' },
      { label: 'Both', image: 'https://x.com/c.png', media: 'https://youtu.be/jNQXAC9IVRw' },
      { label: 'Audio', media: 'https://x.com/a.mp3' },
      { label: 'Plain' }
    ],
    ranking: [[2], [0, 1], [3], [4], [5]]
  };

  it('round-trips a ranking with ties, songs and pictures', () => {
    const data = encodeCompact(list);
    expect(data).toMatch(/^[0-9A-Z$+\-./:]+$/);
    const decoded = decodeCompact(data, true)!;
    expect(decoded.title).toBe('Floweriry');
    expect(decoded.ranking).toEqual([[0], [1, 2], [3], [4], [5]]);
    expect(decoded.items).toEqual([
      { label: 'Bear', image: 'https://x.com/b.png' },
      { label: 'Dandelion', media: 'https://youtu.be/9gT3_crPQik?t=30' },
      {
        label: 'ひっさつマイマイモード',
        media: 'https://open.spotify.com/track/7n7JBYchOMRQX431dswTR7'
      },
      { label: 'Both', image: 'https://x.com/c.png', media: 'https://youtu.be/jNQXAC9IVRw' },
      { label: 'Audio', media: 'https://x.com/a.mp3' },
      { label: 'Plain' }
    ]);
  });

  it('is shorter than the old format', () => {
    expect(encodeCompact(list).length).toBeLessThan(encodeList(list).length);
  });

  it('leaves out an empty title and decodes lists without ranking', () => {
    const decoded = decodeCompact(encodeCompact({ title: ' ', items: list.items }), false)!;
    expect(decoded.title).toBe('');
    expect(decoded.ranking).toBeUndefined();
    expect(decoded.items).toHaveLength(6);
  });

  it('still opens old links and survives trailing punctuation', () => {
    expect(decodeShared('r', encodeList(list))?.items).toHaveLength(6);
    expect(decodeShared('R', `${encodeCompact(list)}.`)?.items).toHaveLength(6);
    expect(decodeShared('R', 'NOT-VALID')).toBeUndefined();
  });
});

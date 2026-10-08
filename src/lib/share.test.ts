import { describe, expect, it } from 'vitest';
import { decodeList, encodeList, toSharedList } from './share';

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

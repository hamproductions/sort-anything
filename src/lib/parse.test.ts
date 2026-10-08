import { describe, expect, it } from 'vitest';
import { parseInput } from './parse';
import { encodeList } from './share';

const labels = (text: string) => parseInput(text).items.map((item) => item.label);

describe('parseInput', () => {
  it('reads one item per line and skips blank lines', () => {
    expect(labels('Apple\n\nBanana\n  Cherry  ')).toEqual(['Apple', 'Banana', 'Cherry']);
  });

  it('drops duplicates case-insensitively and reports them', () => {
    const result = parseInput('Apple\napple\nBanana');
    expect(result.items.map((item) => item.label)).toEqual(['Apple', 'Banana']);
    expect(result.duplicates).toEqual(['apple']);
  });

  it('splits a single line on commas, semicolons, slashes and 、', () => {
    expect(labels('Mercury, Venus, Earth')).toEqual(['Mercury', 'Venus', 'Earth']);
    expect(labels('A; B; C')).toEqual(['A', 'B', 'C']);
    expect(labels('A / B')).toEqual(['A', 'B']);
    expect(labels('赤、青、黄')).toEqual(['赤', '青', '黄']);
  });

  it('strips bullets and checkboxes', () => {
    expect(labels('- One\n* Two\n• Three\n[ ] Four')).toEqual(['One', 'Two', 'Three', 'Four']);
  });

  it('reads numbered rankings with ties and the line above as title', () => {
    const result = parseInput('My snacks:\n1. Chips\n2. Pocky\n2. Oreo\n4) Gum');
    expect(result.title).toBe('My snacks');
    expect(result.items.map((item) => item.label)).toEqual(['Chips', 'Pocky', 'Oreo', 'Gum']);
    expect(result.ranking).toEqual([[0], [1, 2], [3]]);
    expect(result.unranked).toEqual([]);
  });

  it('treats unnumbered lines under a ranking as new items', () => {
    const result = parseInput('1. A\n2. B\nC');
    expect(result.ranking).toEqual([[0], [1]]);
    expect(result.unranked).toEqual([2]);
  });

  it('accepts #N, Nst and 位 rank markers', () => {
    expect(parseInput('#1 Best\n#2 Second').ranking).toEqual([[0], [1]]);
    expect(parseInput('1st Gold\n2nd Silver').ranking).toEqual([[0], [1]]);
    expect(parseInput('1位 りんご\n2位 みかん').ranking).toEqual([[0], [1]]);
  });

  it('keeps leading numbers in names when the list is not a ranking', () => {
    expect(labels('21st Century Schizoid Man\nStarless\nRed')).toEqual([
      '21st Century Schizoid Man',
      'Starless',
      'Red'
    ]);
    expect(labels('1. Plain dot\nAnother\nThird')).toEqual(['1. Plain dot', 'Another', 'Third']);
  });

  it('does not mistake names that start with numbers for ranks', () => {
    const result = parseInput('21 Savage\n1984');
    expect(result.items.map((item) => item.label)).toEqual(['21 Savage', '1984']);
    expect(result.ranking).toBeUndefined();
  });

  it('uses a Markdown heading as the title', () => {
    const result = parseInput('# Good dogs\nBear\nMochi');
    expect(result.title).toBe('Good dogs');
    expect(result.items).toHaveLength(2);
  });

  it('reads Markdown tables and skips the header row', () => {
    const result = parseInput('| Rank | Name |\n|---|---|\n| 1 | X |\n| 2 | Y |');
    expect(result.title).toBeUndefined();
    expect(result.items.map((item) => item.label)).toEqual(['X', 'Y']);
    expect(result.ranking).toEqual([[0], [1]]);
  });

  it('reads tab separated spreadsheet rows', () => {
    const result = parseInput('1\tFoo\thttps://i.imgur.com/abc.png\n2\tBar');
    expect(result.items).toEqual([
      { label: 'Foo', image: 'https://i.imgur.com/abc.png' },
      { label: 'Bar' }
    ]);
  });

  it('attaches images from pipes, Markdown and bare image links', () => {
    const result = parseInput(
      'Alice | https://x.com/a.png\n![Bob](https://x.com/b.jpg)\nhttps://x.com/carol_smith.webp\nDan | https://picsum.photos/id/1/200'
    );
    expect(result.items).toEqual([
      { label: 'Alice', image: 'https://x.com/a.png' },
      { label: 'Bob', image: 'https://x.com/b.jpg' },
      { label: 'carol smith', image: 'https://x.com/carol_smith.webp' },
      { label: 'Dan', image: 'https://picsum.photos/id/1/200' }
    ]);
  });

  it('attaches YouTube, Spotify and audio links as songs', () => {
    const result = parseInput(
      [
        'A | https://youtu.be/dQw4w9WgXcQ?t=30',
        'B - https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=x',
        'C | https://open.spotify.com/intl-ja/track/4cOdK2wGLETKBW3PvgPWqT?si=abc',
        'D | https://example.com/song.mp3',
        '[E](https://music.youtube.com/watch?v=jNQXAC9IVRw)',
        'F | https://x.com/f.png | https://youtu.be/jNQXAC9IVRw'
      ].join('\n')
    );
    expect(result.items).toEqual([
      { label: 'A', media: 'https://youtu.be/dQw4w9WgXcQ?t=30' },
      { label: 'B', media: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=x' },
      {
        label: 'C',
        media: 'https://open.spotify.com/intl-ja/track/4cOdK2wGLETKBW3PvgPWqT?si=abc'
      },
      { label: 'D', media: 'https://example.com/song.mp3' },
      { label: 'E', media: 'https://music.youtube.com/watch?v=jNQXAC9IVRw' },
      { label: 'F', image: 'https://x.com/f.png', media: 'https://youtu.be/jNQXAC9IVRw' }
    ]);
  });

  it('keeps a bare song link as its own label so a title can be filled in', () => {
    expect(parseInput('https://youtu.be/dQw4w9WgXcQ').items).toEqual([
      { label: 'https://youtu.be/dQw4w9WgXcQ', media: 'https://youtu.be/dQw4w9WgXcQ' }
    ]);
  });

  it('keeps bare non-media links in plain lists but drops them under a ranking', () => {
    expect(labels('https://example.com/a\nhttps://example.com/b')).toEqual([
      'https://example.com/a',
      'https://example.com/b'
    ]);
    expect(labels('1. A\n2. B\nhttps://example.com/')).toEqual(['A', 'B']);
  });

  it('collects YouTube playlists and Spotify collections instead of items', () => {
    const result = parseInput(
      'https://www.youtube.com/playlist?list=PLGn8fPyz7QsoNe_c-F6Z5HPP7GhbyOcJ6\nhttps://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M\nSong'
    );
    expect(result.playlists).toEqual([
      'https://www.youtube.com/playlist?list=PLGn8fPyz7QsoNe_c-F6Z5HPP7GhbyOcJ6'
    ]);
    expect(result.spotifyCollections).toEqual([
      'https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M'
    ]);
    expect(result.items.map((item) => item.label)).toEqual(['Song']);
  });

  it('reads Discord-style lists with bold ranks, escaped labels and wrapped links', () => {
    const result = parseInput(
      [
        '## Floweriry',
        '**1.** [Dandelion](<https://youtu.be/9gT3_crPQik>)',
        '**2.** [スターチス \\[Remix\\] \\| live](<https://youtu.be/dQw4w9WgXcQ>)',
        '**2.** 向日葵 \\*extended\\*',
        '-# Sorted with [Sort Anything](<https://hamproductions.github.io/sort-anything/>)'
      ].join('\n')
    );
    expect(result.title).toBe('Floweriry');
    expect(result.items).toEqual([
      { label: 'Dandelion', media: 'https://youtu.be/9gT3_crPQik' },
      { label: 'スターチス [Remix] | live', media: 'https://youtu.be/dQw4w9WgXcQ' },
      { label: '向日葵 *extended*' }
    ]);
    expect(result.ranking).toEqual([[0], [1, 2]]);
  });

  it('reads shared links, including their ranking and title', () => {
    const data = encodeList({
      title: 'Shared',
      items: [{ label: 'P' }, { label: 'Q' }, { label: 'R' }],
      ranking: [[1], [0, 2]]
    });
    const result = parseInput(`Shared\n1. Q\n2. P\n2. R\n\nhttps://host/#/r/${data}\nS new`);
    expect(result.fromLink).toBe(true);
    expect(result.title).toBe('Shared');
    expect(result.items.map((item) => item.label)).toEqual(['P', 'Q', 'R', 'S new']);
    expect(result.ranking).toEqual([[1], [0, 2]]);
    expect(result.unranked).toEqual([3]);
    expect(result.duplicates).toEqual([]);
  });

  it('reads a ranking copied from a rendered Discord message', () => {
    const result = parseInput(
      'Floweriry\n1. スターチス\n2. レモンスノー\n3. Dandelion\n4. シクラメンにそよ風を\n5. baby blue eyes\n6. 桜理論値\n7. 青いアマリリス\n8. プルメリア\n9. 向日葵\n10. 彗星が咲くには\nSorted with Sort Anything'
    );
    expect(result.title).toBe('Floweriry');
    expect(result.items).toHaveLength(10);
    expect(result.items[0]).toEqual({ label: 'スターチス' });
    expect(result.ranking).toEqual(Array.from({ length: 10 }, (_, i) => [i]));
    expect(result.unranked).toEqual([]);
  });

  it('drops a placeholder title instead of using it', () => {
    const result = parseInput(
      'Untitled ranking\n1. 向日葵\n2. プルメリア\n3. baby blue eyes\nSorted with Sort Anything'
    );
    expect(result.title).toBeUndefined();
    expect(result.items.map((item) => item.label)).toEqual([
      '向日葵',
      'プルメリア',
      'baby blue eyes'
    ]);
    expect(result.unranked).toEqual([]);
  });

  it('skips chat headers when several messages are copied', () => {
    const result = parseInput(
      'hamza — Today at 3:04 PM\n1. A\n2. B\nfriend — Yesterday at 11:20 PM\n3. C'
    );
    expect(result.items.map((item) => item.label)).toEqual(['A', 'B', 'C']);
    expect(result.ranking).toEqual([[0], [1], [2]]);
  });
});

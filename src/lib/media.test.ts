import { describe, expect, it } from 'vitest';
import {
  cleanTitle,
  isArtTrack,
  isSpotifyCollection,
  mediaThumbnail,
  parseMedia,
  thumbnailFallback,
  youtubePlaylistId
} from './media';

describe('parseMedia', () => {
  it.each([
    ['https://youtu.be/dQw4w9WgXcQ', 'dQw4w9WgXcQ', undefined],
    ['https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=1m5s', 'dQw4w9WgXcQ', 65],
    ['https://m.youtube.com/watch?feature=share&v=dQw4w9WgXcQ', 'dQw4w9WgXcQ', undefined],
    ['https://music.youtube.com/watch?v=jNQXAC9IVRw', 'jNQXAC9IVRw', undefined],
    ['https://www.youtube.com/shorts/jNQXAC9IVRw', 'jNQXAC9IVRw', undefined],
    ['https://youtu.be/dQw4w9WgXcQ?t=90', 'dQw4w9WgXcQ', 90]
  ])('reads YouTube link %s', (url, id, start) => {
    expect(parseMedia(url)).toMatchObject({ kind: 'youtube', id, start });
  });

  it('normalizes Spotify links and URIs', () => {
    expect(
      parseMedia('https://open.spotify.com/intl-ja/track/4cOdK2wGLETKBW3PvgPWqT?si=x')
    ).toEqual({
      kind: 'spotify',
      type: 'track',
      id: '4cOdK2wGLETKBW3PvgPWqT',
      url: 'https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT'
    });
    expect(parseMedia('spotify:album:abc123')).toMatchObject({ kind: 'spotify', type: 'album' });
  });

  it('reads direct audio files with an optional start', () => {
    expect(parseMedia('https://x.com/a.mp3')).toEqual({
      kind: 'audio',
      url: 'https://x.com/a.mp3'
    });
    expect(parseMedia('https://x.com/a.ogg#t=30')).toMatchObject({ kind: 'audio', start: 30 });
  });

  it('ignores everything else', () => {
    expect(parseMedia('https://example.com/page')).toBeUndefined();
    expect(parseMedia('https://x.com/a.png')).toBeUndefined();
    expect(parseMedia(undefined)).toBeUndefined();
  });
});

describe('thumbnails', () => {
  it('uses the large YouTube thumbnail and falls back to the medium one', () => {
    const large = mediaThumbnail('https://youtu.be/dQw4w9WgXcQ');
    expect(large).toBe('https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg');
    expect(thumbnailFallback(large!)).toBe('https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg');
    expect(mediaThumbnail('https://youtu.be/dQw4w9WgXcQ', 'small')).toContain('mqdefault');
    expect(mediaThumbnail('https://x.com/a.mp3')).toBeUndefined();
  });
});

describe('playlists', () => {
  it('finds YouTube playlist ids but ignores mixes', () => {
    expect(
      youtubePlaylistId('https://www.youtube.com/playlist?list=PLGn8fPyz7QsoNe_c-F6Z5HPP7GhbyOcJ6')
    ).toBe('PLGn8fPyz7QsoNe_c-F6Z5HPP7GhbyOcJ6');
    expect(
      youtubePlaylistId('https://music.youtube.com/playlist?list=OLAK5uy_abcdefghijklmnop')
    ).toBe('OLAK5uy_abcdefghijklmnop');
    expect(
      youtubePlaylistId('https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=RDdQw4w9WgXcQ')
    ).toBeUndefined();
    expect(youtubePlaylistId('https://example.com/?list=PLabcdefghijk')).toBeUndefined();
  });

  it('recognizes Spotify playlists, albums and artists', () => {
    expect(isSpotifyCollection('https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M')).toBe(
      true
    );
    expect(isSpotifyCollection('https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT')).toBe(
      false
    );
  });
});

describe('cleanTitle', () => {
  it.each([
    ['【MV】Dandelion / FloweRiRy', 'Dandelion / FloweRiRy'],
    [
      'Rick Astley - Never Gonna Give You Up (Official Music Video)',
      'Rick Astley - Never Gonna Give You Up'
    ],
    ['スターチス (Lyric Video) [4K]', 'スターチス'],
    ['Song Title - Official MV', 'Song Title'],
    ['青木陽菜「Ephemeral」Music Video', '青木陽菜「Ephemeral」'],
    ['「MV」青いアマリリス', '青いアマリリス'],
    ['Me at the zoo', 'Me at the zoo'],
    ['ALBUM「XMV」', 'ALBUM「XMV」']
  ])('cleans %s', (input, expected) => {
    expect(cleanTitle(input)).toBe(expected);
  });
});

describe('isArtTrack', () => {
  it('detects YouTube Topic channels in English and Japanese', () => {
    expect(isArtTrack({ author: 'FloweRiЯy - Topic' })).toBe(true);
    expect(isArtTrack({ author: 'FloweRiЯy - トピック' })).toBe(true);
    expect(isArtTrack({ author: 'Rick Astley' })).toBe(false);
    expect(isArtTrack(undefined)).toBe(false);
  });
});

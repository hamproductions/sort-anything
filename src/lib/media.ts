export type Media =
  | { kind: 'youtube'; id: string; start?: number; url: string }
  | { kind: 'spotify'; type: string; id: string; url: string }
  | { kind: 'audio'; url: string; start?: number };

const YOUTUBE =
  /^https?:\/\/(?:(?:www|m|music)\.)?(?:youtube\.com\/(?:watch\?(?:\S*&)?v=|shorts\/|embed\/|live\/|v\/)|youtu\.be\/|youtube-nocookie\.com\/embed\/)([\w-]{11})/i;
const SPOTIFY =
  /^https?:\/\/open\.spotify\.com\/(?:intl-[a-z-]+\/)?(?:embed\/)?(track|album|playlist|episode|artist)\/([A-Za-z0-9]+)/i;
const SPOTIFY_URI = /^spotify:(track|album|playlist|episode|artist):([A-Za-z0-9]+)$/i;
const AUDIO = /^https?:\/\/\S+?\.(mp3|m4a|aac|ogg|oga|opus|wav|flac|weba)(?:[?#]\S*)?$/i;

const parseTime = (value: string | null) => {
  if (!value) return undefined;
  if (/^\d+$/.test(value)) return Number(value);
  const match = value.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s?)?$/);
  if (!match) return undefined;
  const [, h = '0', m = '0', s = '0'] = match;
  return Number(h) * 3600 + Number(m) * 60 + Number(s) || undefined;
};

const searchParams = (url: string) => {
  try {
    const parsed = new URL(url);
    return { query: parsed.searchParams, hash: new URLSearchParams(parsed.hash.slice(1)) };
  } catch {
    return undefined;
  }
};

export const parseMedia = (url: string | undefined): Media | undefined => {
  if (!url) return undefined;
  const youtube = url.match(YOUTUBE);
  if (youtube) {
    const params = searchParams(url);
    return {
      kind: 'youtube',
      id: youtube[1],
      start: parseTime(
        params?.query.get('t') ?? params?.query.get('start') ?? params?.hash.get('t') ?? null
      ),
      url
    };
  }
  const spotify = url.match(SPOTIFY) ?? url.match(SPOTIFY_URI);
  if (spotify) {
    return {
      kind: 'spotify',
      type: spotify[1].toLowerCase(),
      id: spotify[2],
      url: `https://open.spotify.com/${spotify[1].toLowerCase()}/${spotify[2]}`
    };
  }
  if (AUDIO.test(url))
    return { kind: 'audio', url, start: parseTime(searchParams(url)?.hash.get('t') ?? null) };
  return undefined;
};

export const isMediaUrl = (url: string) => parseMedia(url) !== undefined;

export const mediaThumbnail = (url: string | undefined, size: 'large' | 'small' = 'large') => {
  const media = parseMedia(url);
  if (media?.kind !== 'youtube') return undefined;
  return `https://i.ytimg.com/vi/${media.id}/${size === 'large' ? 'maxresdefault' : 'mqdefault'}.jpg`;
};

export const thumbnailFallback = (src: string) =>
  src.includes('/maxresdefault.jpg')
    ? src.replace('/maxresdefault.jpg', '/mqdefault.jpg')
    : undefined;

const YOUTUBE_HOST = /^https?:\/\/(?:(?:www|m|music)\.)?(?:youtube\.com|youtu\.be)\//i;

export const youtubePlaylistId = (url: string) => {
  if (!YOUTUBE_HOST.test(url)) return undefined;
  const id = searchParams(url)?.query.get('list');
  return id && /^[\w-]{10,}$/.test(id) && !id.startsWith('RD') ? id : undefined;
};

export const isSpotifyCollection = (url: string) => {
  const media = parseMedia(url);
  return media?.kind === 'spotify' && ['playlist', 'album', 'artist'].includes(media.type);
};

const TITLE_NOISE =
  /\s*[[(【「『（〔]\s*[^\])】」』）〕]*?(?:official|music\s*video|\bmv\b|\bpv\b|lyric|audio|visuali[sz]er|full\s*ver|\bhd\b|\b4k\b|歌詞|公式)[^\])】」』）〕]*[\])】」』）〕]\s*/gi;

export const cleanTitle = (title: string) =>
  title
    .replace(TITLE_NOISE, ' ')
    .replace(
      /(?:official\s+)?(?:music\s*video|lyric\s*video|リリックビデオ|ミュージックビデオ)/gi,
      ' '
    )
    .replace(/(?:^|[\s\-–—|/」』】)]+)(?:official\s+)?(?:mv|pv|audio)$/i, (match) =>
      match.replace(/(?:official\s+)?(?:mv|pv|audio)$/i, '')
    )
    .replace(/[\s\-–—|/]+$/, '')
    .replace(/\s{2,}/g, ' ')
    .trim() || title.trim();

export const mediaLabel = (media: Media) =>
  media.kind === 'youtube' ? 'YouTube' : media.kind === 'spotify' ? 'Spotify' : 'Audio';

export type MediaInfo = { title?: string; thumbnail?: string; author?: string };

export const isArtTrack = (info: MediaInfo | undefined) =>
  !!info?.author && /\s-\s(?:topic|トピック)$/i.test(info.author);

const CACHE_KEY = 'sa:media-info:v2';

const readCache = (): Record<string, MediaInfo> => {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) ?? '{}') as Record<string, MediaInfo>;
  } catch {
    return {};
  }
};

const writeCache = (cache: Record<string, MediaInfo>) => {
  try {
    const entries = Object.entries(cache).slice(-500);
    localStorage.setItem(CACHE_KEY, JSON.stringify(Object.fromEntries(entries)));
  } catch {
    return;
  }
};

const fileTitle = (url: string) => {
  try {
    const name = decodeURIComponent(new URL(url).pathname.split('/').pop() ?? '');
    return (
      name
        .replace(/\.[a-z0-9]+$/i, '')
        .replace(/[-_]+/g, ' ')
        .trim() || undefined
    );
  } catch {
    return undefined;
  }
};

export const fetchMediaInfo = async (url: string): Promise<MediaInfo | undefined> => {
  const media = parseMedia(url);
  if (!media) return undefined;
  if (media.kind === 'audio') return { title: fileTitle(media.url) };
  const cache = readCache();
  if (cache[media.url]) return cache[media.url];
  const endpoint =
    media.kind === 'youtube'
      ? `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${media.id}`)}`
      : `https://open.spotify.com/oembed?url=${encodeURIComponent(media.url)}`;
  try {
    const response = await fetch(endpoint);
    if (!response.ok) return undefined;
    const data = (await response.json()) as {
      title?: string;
      thumbnail_url?: string;
      author_name?: string;
    };
    const info = {
      title: data.title && (media.kind === 'youtube' ? cleanTitle(data.title) : data.title.trim()),
      thumbnail: data.thumbnail_url,
      author: data.author_name
    };
    writeCache({ ...readCache(), [media.url]: info });
    return info;
  } catch {
    return undefined;
  }
};

export const searchUrl = (query: string) =>
  `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;

import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string';
import { deflateSync, inflateSync, strFromU8, strToU8 } from 'fflate';
import { parseMedia } from './media';
import type { Item, SharedList } from './types';

type Entry = string | [string, string] | [string, string, string];

type Payload = { v: 1; t: string; i: Entry[]; r?: number[][] };

export const SHARE_LINK_PATTERN = /#\/(?:(r|l)\/([A-Za-z0-9+\-$]+)|(R|L)\/([0-9A-Z$+\-./:]+))/g;

export const encodeList = (list: SharedList) => {
  const payload: Payload = {
    v: 1,
    t: list.title,
    i: list.items.map((item): Entry =>
      item.media
        ? [item.label, item.image ?? '', item.media]
        : item.image
          ? [item.label, item.image]
          : item.label
    ),
    ...(list.ranking ? { r: list.ranking } : {})
  };
  return compressToEncodedURIComponent(JSON.stringify(payload));
};

const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ$+-./:';
const RADIX = BigInt(ALPHABET.length);

const toBase = (bytes: Uint8Array) => {
  let value = BigInt(`0x01${Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')}`);
  let out = '';
  while (value > 0n) {
    out = ALPHABET[Number(value % RADIX)] + out;
    value /= RADIX;
  }
  return out;
};

const fromBase = (text: string) => {
  let value = 0n;
  for (const char of text) {
    const digit = ALPHABET.indexOf(char);
    if (digit < 0) throw new Error('bad character');
    value = value * RADIX + BigInt(digit);
  }
  const hex = value.toString(16);
  if (!hex.startsWith('1') || hex.length % 2 === 0) throw new Error('bad payload');
  const bytes = new Uint8Array((hex.length - 1) / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
  return bytes;
};

type CompactEntry = string | [string, string] | [string, string, string];
type CompactPayload = { t?: string; i: CompactEntry[]; g?: number[] };

const mediaToken = (url: string) => {
  const media = parseMedia(url);
  if (media?.kind === 'youtube') return `y${media.id}${media.start ? `@${media.start}` : ''}`;
  if (media?.kind === 'spotify' && media.type === 'track') return `s${media.id}`;
  return url;
};

const mediaFromToken = (token: string) => {
  if (token.startsWith('y')) {
    const [id, start] = token.slice(1).split('@');
    return `https://youtu.be/${id}${start ? `?t=${start}` : ''}`;
  }
  if (token.startsWith('s')) return `https://open.spotify.com/track/${token.slice(1)}`;
  return token;
};

export const encodeCompact = (list: SharedList) => {
  const order = list.ranking ? list.ranking.flat() : list.items.map((_, i) => i);
  const groups = list.ranking?.map((group) => group.length);
  const payload: CompactPayload = {
    ...(list.title.trim() ? { t: list.title.trim() } : {}),
    i: order.map((index): CompactEntry => {
      const { label, image, media } = list.items[index];
      if (!media && !image) return label;
      if (!image) return [label, mediaToken(media!)];
      return [label, media ? mediaToken(media) : '', image];
    }),
    ...(groups && groups.some((size) => size > 1) ? { g: groups } : {})
  };
  return toBase(deflateSync(strToU8(JSON.stringify(payload)), { level: 9 }));
};

export const decodeCompact = (data: string, ranked: boolean): SharedList | undefined => {
  try {
    const payload = JSON.parse(strFromU8(inflateSync(fromBase(data)))) as CompactPayload;
    if (!Array.isArray(payload.i)) return undefined;
    const items = payload.i.map((entry) => {
      if (!Array.isArray(entry)) return { label: String(entry) };
      const [label, media, image] = entry.map(String);
      return {
        label,
        ...(image ? { image } : {}),
        ...(media ? { media: mediaFromToken(media) } : {})
      };
    });
    let next = 0;
    const sizes = payload.g ?? items.map(() => 1);
    const ranking = ranked
      ? sizes.map((size) => Array.from({ length: size }, () => next++))
      : undefined;
    return { title: typeof payload.t === 'string' ? payload.t : '', items, ranking };
  } catch {
    return undefined;
  }
};

export const decodeShared = (route: string, data: string): SharedList | undefined => {
  if (route === 'R' || route === 'L') {
    return (
      decodeCompact(data, route === 'R') ?? decodeCompact(data.replace(/[.:]+$/, ''), route === 'R')
    );
  }
  return decodeList(data);
};

export const decodeList = (data: string): SharedList | undefined => {
  try {
    const payload = JSON.parse(decompressFromEncodedURIComponent(data) ?? '') as Payload;
    if (payload?.v !== 1 || !Array.isArray(payload.i)) return undefined;
    return {
      title: typeof payload.t === 'string' ? payload.t : '',
      items: payload.i.map((entry) => {
        if (!Array.isArray(entry)) return { label: String(entry) };
        const [label, image, media] = entry.map(String);
        return { label, ...(image ? { image } : {}), ...(media ? { media } : {}) };
      }),
      ranking: Array.isArray(payload.r) ? payload.r : undefined
    };
  } catch {
    return undefined;
  }
};

export const toSharedList = (title: string, all: Item[], ranking?: string[][]): SharedList => {
  const included = ranking && new Set(ranking.flat());
  const items = included ? all.filter((item) => included.has(item.id)) : all;
  const index = new Map(items.map((item, i) => [item.id, i]));
  return {
    title,
    items: items.map(({ label, image, media }) => ({
      label,
      ...(image ? { image } : {}),
      ...(media ? { media } : {})
    })),
    ranking: ranking?.map((group) => group.map((id) => index.get(id) ?? -1).filter((i) => i >= 0))
  };
};

export const baseUrl = () => `${location.origin}${location.pathname}`;

export const resultLink = (list: SharedList) => `${baseUrl()}#/R/${encodeCompact(list)}`;

export const listLink = (list: SharedList) =>
  `${baseUrl()}#/L/${encodeCompact({ title: list.title, items: list.items })}`;

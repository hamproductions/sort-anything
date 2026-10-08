import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string';
import type { Item, SharedList } from './types';

type Entry = string | [string, string] | [string, string, string];

type Payload = { v: 1; t: string; i: Entry[]; r?: number[][] };

export const SHARE_LINK_PATTERN = /#\/(r|l)\/([A-Za-z0-9+\-$]+)/g;

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

export const resultLink = (list: SharedList) => `${baseUrl()}#/r/${encodeList(list)}`;

export const listLink = (list: SharedList) =>
  `${baseUrl()}#/l/${encodeList({ title: list.title, items: list.items })}`;

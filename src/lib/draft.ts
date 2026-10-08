import { toEditorText } from './format';
import { parseInput } from './parse';
import type { ParseResult, ParsedItem } from './parse';
import { readJson } from './storage';
import type { Item } from './types';

export type DraftItem = ParsedItem & { key: string; rank?: number };

export type Draft = { v: 2; title: string; items: DraftItem[] };

export const DRAFT_KEY = 'sa:draft';

export const EMPTY_DRAFT: Draft = { v: 2, title: '', items: [] };

let counter = 0;
export const newKey = () => `${Date.now().toString(36)}-${(counter++).toString(36)}`;

const keyOf = (label: string) => label.normalize('NFKC').trim().toLowerCase();

const ranksOf = (ranking: number[][] | undefined) => {
  const ranks = new Map<number, number>();
  let rank = 1;
  for (const group of ranking ?? []) {
    for (const index of group) ranks.set(index, rank);
    rank += group.length;
  }
  return ranks;
};

export const draftItemsFrom = (parsed: Pick<ParseResult, 'items' | 'ranking'>): DraftItem[] => {
  const ranks = ranksOf(parsed.ranking);
  const order = parsed.ranking
    ? [...parsed.ranking.flat(), ...parsed.items.map((_, i) => i).filter((i) => !ranks.has(i))]
    : parsed.items.map((_, i) => i);
  return order.map((i) => ({ ...parsed.items[i], key: newKey(), rank: ranks.get(i) }));
};

export const mergeItems = (current: DraftItem[], incoming: DraftItem[]) => {
  const index = new Map(current.map((item, i) => [keyOf(item.label), i]));
  const next = [...current];
  let added = 0;
  let merged = 0;
  for (const item of incoming) {
    const existing = index.get(keyOf(item.label));
    if (existing === undefined) {
      index.set(keyOf(item.label), next.length);
      next.push(item);
      added++;
    } else {
      const old = next[existing];
      next[existing] = {
        ...old,
        image: old.image ?? item.image,
        media: old.media ?? item.media,
        rank: old.rank ?? item.rank
      };
      merged++;
    }
  }
  return { items: next, added, merged };
};

export const draftFromText = (title: string, text: string): Draft => {
  const parsed = parseInput(text);
  return { v: 2, title: title || parsed.title || '', items: draftItemsFrom(parsed) };
};

export const loadDraft = (): Draft => {
  const stored = readJson<Draft | { title: string; text: string }>(DRAFT_KEY);
  if (!stored) return EMPTY_DRAFT;
  if ('v' in stored && stored.v === 2 && Array.isArray(stored.items)) return stored;
  if ('text' in stored) return draftFromText(stored.title ?? '', stored.text ?? '');
  return EMPTY_DRAFT;
};

export const draftFromItems = (title: string, items: Item[], groups?: string[][]): Draft => {
  const byId = new Map(items.map((item) => [item.id, item]));
  const strip = ({ label, image, media }: Item) => ({ label, image, media });
  if (!groups)
    return { v: 2, title, items: items.map((item) => ({ ...strip(item), key: newKey() })) };
  const result: DraftItem[] = [];
  let rank = 1;
  for (const group of groups) {
    for (const id of group) {
      const item = byId.get(id);
      if (item) result.push({ ...strip(item), key: newKey(), rank });
    }
    rank += group.length;
  }
  return { v: 2, title, items: result };
};

export const draftRanking = (items: DraftItem[]) => {
  const ranked = items
    .map((item, index) => ({ index, rank: item.rank }))
    .filter((entry): entry is { index: number; rank: number } => entry.rank !== undefined)
    .sort((a, b) => a.rank - b.rank || a.index - b.index);
  if (ranked.length === 0) return undefined;
  const groups: number[][] = [];
  let last: number | undefined;
  for (const { index, rank } of ranked) {
    if (rank === last) groups[groups.length - 1].push(index);
    else groups.push([index]);
    last = rank;
  }
  return groups;
};

export const draftToText = (items: DraftItem[]) => {
  const asItems = items.map((item, i) => ({ ...item, id: String(i) }));
  const ranking = draftRanking(items)?.map((g) => g.map(String));
  if (!ranking) return toEditorText(asItems);
  const rankedIds = new Set(ranking.flat());
  const extra = toEditorText(asItems.filter((item) => !rankedIds.has(item.id)));
  return [toEditorText(asItems, ranking), extra].filter(Boolean).join('\n');
};

import { parseMedia } from './media';
import type { Item } from './types';

export type RankedGroup = { rank: number; items: Item[] };

export const rankGroups = (groups: string[][], items: Item[]): RankedGroup[] => {
  const byId = new Map(items.map((item) => [item.id, item]));
  let rank = 1;
  return groups.map((group) => {
    const entry = {
      rank,
      items: group.map((id) => byId.get(id)).filter((item): item is Item => !!item)
    };
    rank += group.length;
    return entry;
  });
};

const withImage = (item: Item) => [item.label, item.image, item.media].filter(Boolean).join(' | ');

export const toEditorText = (items: Item[], groups?: string[][]) =>
  groups
    ? rankGroups(groups, items)
        .flatMap(({ rank, items }) => items.map((item) => `${rank}. ${withImage(item)}`))
        .join('\n')
    : items.map(withImage).join('\n');

const shortMedia = (url: string) => {
  const media = parseMedia(url);
  if (media?.kind === 'youtube')
    return `https://youtu.be/${media.id}${media.start ? `?t=${media.start}` : ''}`;
  if (media?.kind === 'spotify') return media.url;
  return url;
};

const escapeLabel = (label: string) => label.replace(/([[\]*_`~|])/g, '\\$1');

export const toPasteList = (title: string, ranked: RankedGroup[], appLink?: string) =>
  [
    ...(title.trim() ? [`## ${title.trim()}`] : []),
    ...ranked.flatMap(({ rank, items }) =>
      items.map((item) => {
        const link = item.media ? shortMedia(item.media) : item.image;
        const name = link ? `[${escapeLabel(item.label)}](<${link}>)` : escapeLabel(item.label);
        const extra = item.media && item.image ? ` | <${item.image}>` : '';
        return `**${rank}.** ${name}${extra}`;
      })
    ),
    ...(appLink ? [`-# Sorted with [Sort Anything](<${appLink}>)`] : [])
  ].join('\n');

export const toPlainText = (title: string, ranked: RankedGroup[], link?: string, limit?: number) =>
  [
    title,
    ...ranked
      .flatMap(({ rank, items }) => items.map((item) => `${rank}. ${item.label}`))
      .slice(0, limit),
    ...(link ? ['', link] : [])
  ].join('\n');

export const toCsv = (ranked: RankedGroup[]) =>
  [
    'rank,item,image,media',
    ...ranked.flatMap(({ rank, items }) =>
      items.map((item) =>
        [rank, item.label, item.image ?? '', item.media ?? '']
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(',')
      )
    )
  ].join('\n');

export const formatDuration = (ms: number) => {
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.round((ms % 60000) / 1000);
  return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
};

export const formatRelative = (time: number) => {
  const diff = Date.now() - time;
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} min ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} h ago`;
  return new Date(time).toLocaleDateString();
};

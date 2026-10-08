import { isMediaUrl, isSpotifyCollection, youtubePlaylistId } from './media';
import { SHARE_LINK_PATTERN, decodeShared } from './share';

export type ParsedItem = { label: string; image?: string; media?: string };

export type ParseResult = {
  title?: string;
  items: ParsedItem[];
  ranking?: number[][];
  unranked: number[];
  duplicates: string[];
  fromLink: boolean;
  playlists: string[];
  spotifyCollections: string[];
};

type Line = ParsedItem & {
  rank?: number;
  plain?: ParsedItem;
  bareUrl?: boolean;
  collection?: 'youtube' | 'spotify';
};

const IMAGE_URL =
  /^https?:\/\/\S+?(\.(png|jpe?g|gif|webp|avif|svg|bmp)(\?\S*)?$|(imgur\.com|twimg\.com|googleusercontent\.com|discordapp\.(com|net)\/attachments|wikia\.nocookie\.net)\/\S*)/i;
const URL_ONLY = /^<?(?:https?:\/\/\S+|spotify:[a-z]+:[A-Za-z0-9]+)>?$/i;
const PIPE = /\s+\|\s+/;
const TRAILING_URL = /^(.*?)\s*(?:[-–—:|,]\s*)?<?(https?:\/\/\S+?)>?$/i;
const MD_IMAGE = /!\[([^\]]*)\]\(<?([^)\s>]+)>?[^)]*\)/;
const MD_LINK = /\[((?:\\.|[^\]\\])+)\]\(<?([^)\s>]+)>?[^)]*\)/g;
const HEADING = /^#{1,6}\s+(.+)$/;
const RANK =
  /^(?:(?:#|no\.?\s*|rank\s*)(\d{1,4})\s+|(\d{1,4})(?:(?:st|nd|rd|th)\s+|(?:st|nd|rd|th)?(?:\s*[.):：、]|\s*位|\s+[-–—]\s+|\t)\s*))(.+)$/i;
const BULLET = /^(?:[-*+•·▪◦●○►▶]|\[[ xX]\])\s+/;
const NUMERIC = /^(?:#|no\.?\s*)?\d{1,4}(?:st|nd|rd|th|位|\.)?$/i;
const SEPARATOR_ROW = /^\|?[\s:|-]+\|?$/;

const keyOf = (label: string) => label.normalize('NFKC').trim().toLowerCase();

export const isImageUrl = (url: string) => IMAGE_URL.test(url);

const labelFromUrl = (url: string) => {
  try {
    const name = decodeURIComponent(new URL(url).pathname.split('/').filter(Boolean).pop() ?? '');
    return (
      name
        .replace(/\.[a-z0-9]+$/i, '')
        .replace(/[-_]+/g, ' ')
        .trim() || url
    );
  } catch {
    return url;
  }
};

const unwrap = (url: string) => url.trim().replace(/^<|>$/g, '');

const fromUrl = (url: string): Line =>
  youtubePlaylistId(url)
    ? { label: url, collection: 'youtube' }
    : isSpotifyCollection(url)
      ? { label: url, collection: 'spotify' }
      : isMediaUrl(url)
        ? { label: url, media: url }
        : isImageUrl(url)
          ? { label: labelFromUrl(url), image: url }
          : { label: url, bareUrl: true };

const splitParts = (text: string): Line | undefined => {
  let label: string | undefined;
  let image: string | undefined;
  let media: string | undefined;
  for (const part of text.split(PIPE)) {
    const value = part.trim();
    if (!value) continue;
    if (URL_ONLY.test(value)) {
      const url = unwrap(value);
      if (isMediaUrl(url)) media ??= url;
      else image ??= url;
    } else {
      const inner = splitLabelAndImage(value);
      label ??= inner?.label;
      image ??= inner?.image;
      media ??= inner?.media;
    }
  }
  if (!label) {
    if (media) return { label: media, image, media };
    return image ? { label: labelFromUrl(image), image } : undefined;
  }
  return { label, image, media };
};

const splitLabelAndImage = (text: string): Line | undefined => {
  if (PIPE.test(text)) return splitParts(text);
  let media: string | undefined;
  const withoutMediaLinks = text.replace(MD_LINK, (whole, label: string, url: string) => {
    if (!isMediaUrl(url)) return whole;
    media ??= url;
    return label;
  });
  const mdImage = withoutMediaLinks.match(MD_IMAGE);
  if (mdImage) {
    const rest = withoutMediaLinks
      .replace(MD_IMAGE, '')
      .replace(MD_LINK, '$1')
      .replace(/^[\s|:–—-]+|[\s|:–—-]+$/g, '');
    return { label: rest || mdImage[1] || labelFromUrl(mdImage[2]), image: mdImage[2], media };
  }
  const plain = withoutMediaLinks.replace(MD_LINK, (_, label: string, url: string) =>
    isImageUrl(url) ? `${label} ${url}` : label
  );
  const trailing = plain.match(TRAILING_URL);
  if (trailing) {
    const [, rawLabel, url] = trailing;
    const label = rawLabel.trim();
    if (isMediaUrl(url)) return { label: label || url, media: url };
    if (isImageUrl(url)) return { label: label || labelFromUrl(url), image: url, media };
    return label ? { label, media } : undefined;
  }
  const label = plain.replace(/\*\*|__|`/g, '').trim();
  return label ? { label, media } : media ? { label: media, media } : undefined;
};

const parseCells = (cells: string[]): Line | undefined => {
  const values = cells.map((c) => c.trim()).filter(Boolean);
  const rankCell = values.find((c) => NUMERIC.test(c));
  const mediaCell = values.find((c) => isMediaUrl(unwrap(c)));
  const imageCell = values.find((c) => c !== mediaCell && (isImageUrl(c) || MD_IMAGE.test(c)));
  const labelCell = values.find(
    (c) => c !== rankCell && c !== imageCell && c !== mediaCell && !URL_ONLY.test(c)
  );
  const image = imageCell?.match(MD_IMAGE)?.[2] ?? imageCell;
  const media = mediaCell ? unwrap(mediaCell) : undefined;
  const inner = labelCell ? splitLabelAndImage(labelCell) : undefined;
  if (!labelCell && !image && !media) return undefined;
  return {
    label: inner?.label ?? labelCell ?? media ?? labelFromUrl(image!),
    image: image ?? inner?.image,
    media: media ?? inner?.media,
    rank: rankCell ? Number(rankCell.replace(/\D/g, '')) : undefined
  };
};

const APP_FOOTER = /^(?:-#\s*)?(?:sorted|made|ranked) with \[?sort anything\b/i;
const CHAT_HEADER =
  /^.{1,60}\s[—–-]\s(?:today|yesterday|\d{1,4}[/.-]\d{1,2}[/.-]\d{1,4}|\d{1,2}:\d{2}|今日|昨日)\b.*$/i;
const PLACEHOLDER_TITLE = /^(?:untitled ranking|my ranking)$/i;

const BOLD_RANK = /^\*\*(\d{1,4}[.)]?)\*\*\s*/;

const parseLine = (raw: string): Line | undefined => {
  const line = raw.trim().replace(BULLET, '').replace(BOLD_RANK, '$1 ');
  if (!line) return undefined;
  if (line.includes('\t')) return parseCells(line.split('\t'));
  if (line.startsWith('|')) return parseCells(line.replace(/^\||\|$/g, '').split('|'));
  if (URL_ONLY.test(line)) return fromUrl(unwrap(line));
  const ranked = line.match(RANK);
  if (ranked) {
    const item = splitLabelAndImage(ranked[3].replace(BULLET, ''));
    return (
      item && { ...item, rank: Number(ranked[1] ?? ranked[2]), plain: splitLabelAndImage(line) }
    );
  }
  return splitLabelAndImage(line);
};

const splitInline = (text: string) => {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length !== 1 || lines[0].includes('\t') || lines[0].trim().startsWith('|'))
    return lines;
  const [line] = lines;
  for (const separator of [/\s*;\s*/, /\s*,\s*/, /\s+\/\s+/, /\s*、\s*/]) {
    const parts = line.split(separator).filter(Boolean);
    if (parts.length > 1) return parts;
  }
  return lines;
};

export const parseInput = (text: string): ParseResult => {
  const items: ParsedItem[] = [];
  const index = new Map<string, number>();
  const duplicates: string[] = [];
  let title: string | undefined;
  let linkRanking: number[][] | undefined;

  let linkedCount = 0;
  const playlists: string[] = [];
  const spotifyCollections: string[] = [];

  const add = ({ label: raw, image, media }: ParsedItem) => {
    const label = raw.replace(/\\([[\]*_`~|\\])/g, '$1');
    const key = keyOf(label);
    const existing = index.get(key);
    if (existing !== undefined) {
      const current = items[existing];
      items[existing] = {
        ...current,
        image: current.image ?? image,
        media: current.media ?? media
      };
      if (existing >= linkedCount) duplicates.push(label);
      return existing;
    }
    index.set(key, items.length);
    items.push({
      label: label.trim(),
      ...(image ? { image } : {}),
      ...(media ? { media } : {})
    });
    return items.length - 1;
  };

  const links = [...text.matchAll(SHARE_LINK_PATTERN)];
  for (const [, legacyRoute, legacyData, route, data] of links) {
    const list = decodeShared(route ?? legacyRoute, data ?? legacyData);
    if (!list) continue;
    title ??= list.title || undefined;
    const ids = list.items.map((item) => add(item));
    if (list.ranking && !linkRanking) {
      linkRanking = list.ranking.map((group) =>
        group.map((i) => ids[i]).filter((i) => i !== undefined)
      );
    }
  }

  linkedCount = items.length;
  duplicates.length = 0;

  const rawLines = splitInline(
    text
      .split(/\r?\n/)
      .filter((l) => !l.match(SHARE_LINK_PATTERN))
      .join('\n')
  );

  const lines: (Line | { heading: string })[] = [];
  rawLines.forEach((raw, i) => {
    const trimmed = raw.trim();
    if (!trimmed || SEPARATOR_ROW.test(trimmed) || trimmed.startsWith('-# ')) return;
    if (APP_FOOTER.test(trimmed) || CHAT_HEADER.test(trimmed)) return;
    if (trimmed.startsWith('|') && SEPARATOR_ROW.test(rawLines[i + 1]?.trim() ?? '')) return;
    const heading = trimmed.match(HEADING);
    if (heading && !RANK.test(trimmed)) {
      lines.push({ heading: heading[1].trim() });
      return;
    }
    const line = parseLine(trimmed);
    if (line) lines.push(line);
  });

  const parsed = lines.filter((l): l is Line => 'label' in l && !l.collection);
  const rankedCount = parsed.filter((l) => l.rank !== undefined).length;
  const isRankedList = rankedCount >= 2 && rankedCount * 2 >= parsed.length;
  const firstRanked = lines.findIndex((l) => 'label' in l && l.rank !== undefined);
  const firstLabel = lines.findIndex((l) => 'label' in l);

  const textRanks = new Map<number, number>();
  lines.forEach((line, i) => {
    if ('heading' in line) {
      title ??= line.heading;
      return;
    }
    const label = line.label.replace(/[:：]$/, '');
    if (title && keyOf(label) === keyOf(title)) return;
    if (
      isRankedList &&
      line.rank === undefined &&
      i === firstLabel &&
      i === firstRanked - 1 &&
      !title
    ) {
      title = label;
      return;
    }
    if (line.collection === 'youtube') return void playlists.push(line.label);
    if (line.collection === 'spotify') return void spotifyCollections.push(line.label);
    if (line.bareUrl && isRankedList) return;
    const source = !isRankedList && line.plain ? line.plain : line;
    const id = add({ label: source.label, image: source.image, media: source.media });
    if (isRankedList && line.rank !== undefined && !textRanks.has(id)) textRanks.set(id, line.rank);
  });

  let ranking = linkRanking;
  if (!ranking && isRankedList) {
    const byRank = new Map<number, number[]>();
    for (const [id, rank] of textRanks) byRank.set(rank, [...(byRank.get(rank) ?? []), id]);
    ranking = [...byRank.entries()].sort((a, b) => a[0] - b[0]).map(([, ids]) => ids);
  }
  ranking = ranking?.filter((g) => g.length > 0);

  const rankedIds = new Set(ranking?.flat());
  const unranked = items.map((_, i) => i).filter((i) => !rankedIds.has(i));

  return {
    title: title && !PLACEHOLDER_TITLE.test(title.trim()) ? title : undefined,
    items,
    ranking: ranking && ranking.length > 0 ? ranking : undefined,
    unranked,
    duplicates,
    fromLink: links.length > 0,
    playlists,
    spotifyCollections
  };
};

import type { ParsedItem } from './parse';
import { listSessions } from './storage';
import type { Session } from './types';

type Remembered = Pick<ParsedItem, 'image' | 'media'>;

const keyOf = (label: string) => label.normalize('NFKC').trim().toLowerCase();

export const buildMemory = (sessions: Session[]) => {
  const memory = new Map<string, Remembered>();
  for (const session of sessions) {
    for (const { label, image, media } of session.items) {
      const key = keyOf(label);
      if ((image || media) && !memory.has(key)) memory.set(key, { image, media });
    }
  }
  return memory;
};

export const restoreMedia = <T extends ParsedItem>(
  items: T[],
  memory: Map<string, Remembered> = buildMemory(listSessions())
) => {
  let restored = 0;
  const result = items.map((item) => {
    if (item.media || item.image) return item;
    const found = memory.get(keyOf(item.label));
    if (!found) return item;
    restored++;
    return {
      ...item,
      ...(found.image ? { image: found.image } : {}),
      ...(found.media ? { media: found.media } : {})
    };
  });
  return { items: result, restored };
};

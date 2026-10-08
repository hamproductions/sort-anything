import type { Engine } from './engine';
import type { Choice } from './merge-sort';

export type Item = { id: string; label: string; image?: string; media?: string };

export type Session = {
  id: string;
  title: string;
  items: Item[];
  engine: Engine;
  history: { engine: Engine; comparisons: number; pick?: Pick }[];
  comparisons: number;
  createdAt: number;
  updatedAt: number;
  finishedAt?: number;
  override?: string[][];
};

export type Pick = { left: string[]; right: string[]; choice: Choice; ms: number };

export type SharedList = { title: string; items: Omit<Item, 'id'>[]; ranking?: number[][] };

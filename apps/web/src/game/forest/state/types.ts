import type { Appearance } from '../data/appearance';
import type { PlacedDecor } from '../data/decor';
import type { QuestStatus } from '../data/quests';

export const SAVE_VERSION = 1;

export interface BagSlot {
  id: string;
  qty: number;
}

export interface ResidentState {
  affinity: number;
  talkedDay: number;
  giftDay: number;
}

export interface Plot {
  seed: string | null;
  plantedAt: number;
}

export interface Memory {
  id: string;
  title: string;
  day: number;
  text: string;
  photoId: string | null;
}

export interface Letter {
  id: string;
  from: string;
  title: string;
  body: string;
  day: number;
  read: boolean;
}

export interface Settings {
  master: number;
  music: number;
  sfx: number;
  textSpeed: number; // 1 느리게 · 2 보통 · 3 빠르게
  bigText: boolean;
  shake: boolean;
  flash: boolean;
  dof: boolean;
  quality: 'high' | 'low';
  dayMinutes: 12 | 24 | 48;
}

export interface GameData {
  version: number;
  started: boolean;
  createdAt: number;
  savedAt: number;
  me: { name: string; look: Appearance };
  partner: { name: string; look: Appearance };
  pos: [number, number];
  dir: number;
  money: number;
  bag: Array<BagSlot | null>;
  storage: Record<string, number>;
  recipes: string[];
  quests: Record<string, QuestStatus>;
  rewards: string[];
  residents: Record<string, ResidentState>;
  flowers: Record<string, number>;
  trees: Record<string, number>;
  rocks: Record<string, number>;
  logs: number;
  plots: Record<string, Plot>;
  decor: { garden: PlacedDecor[]; home: PlacedDecor[] };
  wedding: { count: number; firstDay: number | null; inProgress: boolean };
  memories: Memory[];
  letters: Letter[];
  photos: string[];
  framePhoto: string | null;
  promiseTree: number | null;
  clock: number;
  settings: Settings;
  stats: { picked: number; crafted: number; playSeconds: number };
}

export const DEFAULT_SETTINGS: Settings = {
  master: 0.8,
  music: 0.5,
  sfx: 0.8,
  textSpeed: 2,
  bigText: false,
  shake: true,
  flash: true,
  dof: true,
  quality: 'high',
  dayMinutes: 24,
};

// 화면 상태(저장하지 않음) — 열린 창 · 대화 · 행동 힌트 · 알림 · 모드.
import { create } from 'zustand';
import type { DNode, Line } from '../data/dialogue';
import type { DecorArea } from '../data/decor';
import type { Station } from '../data/recipes';

export type Panel = null | 'bag' | 'craft' | 'wardrobe' | 'map' | 'album' | 'settings' | 'shop' | 'storage' | 'ready' | 'letters' | 'gift' | 'board' | 'help';
export type Mode = 'play' | 'decor' | 'ceremony' | 'photo';

export interface Toast {
  id: number;
  text: string;
  item?: string;
  tone: 'ok' | 'warn' | 'info' | 'gold';
}

export interface DialogueState {
  node: DNode;
  index: number;
  /** 타자 효과가 끝났는지 */
  typed: boolean;
  onAction: (action: string) => void;
}

export interface DecorUI {
  area: DecorArea;
  selected: string | null; // 장식 ID(가방에서 고른 것)
  moving: string | null; // 옮기는 중인 배치 uid
  hover: string | null; // 커서 아래 배치 uid
  rot: number;
  status: string;
  tone: 'ok' | 'bad' | 'warn';
  snap: boolean;
}

export interface CeremonyUI {
  caption: string | null;
  speaker: string | null;
  step: string;
  progress: number;
  countdown: string | null;
}

export interface PhotoUI {
  pose: string;
  expr: string;
  frame: 'none' | 'polaroid' | 'flower';
  dof: number;
  zoom: number;
  last: { id: string; thumb: string; ok: boolean } | null;
}

interface UIStore {
  screen: 'loading' | 'title' | 'create' | 'play';
  panel: Panel;
  panelArg: any;
  wardrobeFor: 'me' | 'partner';
  wardrobeMode: 'daily' | 'wedding' | 'create';
  craftStation: Station;
  dialogue: DialogueState | null;
  hint: { label: string; key: string } | null;
  toasts: Toast[];
  saving: 'idle' | 'saving' | 'saved' | 'error';
  saveError: string | null;
  mode: Mode;
  decor: DecorUI | null;
  ceremony: CeremonyUI | null;
  photo: PhotoUI | null;
  zoneBanner: { name: string; at: number } | null;
  fade: number; // 0~1 화면 전환 덮개
  loadIssue: string | null;
  open: (p: Panel, arg?: any) => void;
  close: () => void;
  say: (node: DNode, onAction: (a: string) => void) => void;
  sayLines: (lines: Line[], onAction?: (a: string) => void) => void;
  toast: (text: string, tone?: Toast['tone'], item?: string) => void;
  set: (p: Partial<UIStore>) => void;
}

let toastSeq = 1;

export const useUI = create<UIStore>((set, get) => ({
  screen: 'loading',
  panel: null,
  panelArg: null,
  wardrobeFor: 'me',
  wardrobeMode: 'daily',
  craftStation: 'workbench',
  dialogue: null,
  hint: null,
  toasts: [],
  saving: 'idle',
  saveError: null,
  mode: 'play',
  decor: null,
  ceremony: null,
  photo: null,
  zoneBanner: null,
  fade: 0,
  loadIssue: null,
  open: (panel, arg = null) => set({ panel, panelArg: arg }),
  close: () => set({ panel: null, panelArg: null }),
  say: (node, onAction) => set({ dialogue: { node, index: 0, typed: false, onAction } }),
  sayLines: (lines, onAction = () => {}) => set({ dialogue: { node: { lines }, index: 0, typed: false, onAction } }),
  toast: (text, tone = 'info', item) => {
    const id = toastSeq++;
    set({ toasts: [...get().toasts.slice(-3), { id, text, tone, item }] });
    setTimeout(() => set({ toasts: get().toasts.filter((t) => t.id !== id) }), 2600);
  },
  set: (p) => set(p),
}));

/** 입력을 막아야 하는 상태(창·대화·연출) */
export function uiBlocking(): boolean {
  const u = useUI.getState();
  return u.screen !== 'play' || !!u.panel || !!u.dialogue || u.mode === 'ceremony' || u.fade > 0.5;
}

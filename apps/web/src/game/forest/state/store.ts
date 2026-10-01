// 게임 진행 상태(저장 대상) + 한 번의 논리적 처리로 묶인 행동들.
//  · 재료 차감과 아이템 지급, 퀘스트 완료와 보상 지급, 예식 완료와 기념품 지급은 각각 set() 한 번으로 끝난다.
//  · 보상은 rewards[] 에 ID 를 남겨 한 번만 지급(재진입·연타·재접속에도 중복 없음).
import { create } from 'zustand';
import { BAG_SIZE, ITEMS } from '../data/items';
import { RECIPES, WORKSHOP_RECIPES } from '../data/recipes';
import { DECOR, footprint, type DecorArea, type PlacedDecor } from '../data/decor';
import { DEFAULT_PARTNER, DEFAULT_PLAYER, type Appearance } from '../data/appearance';
import { MAIN_CHAIN, MEMORY_DEFS, QUESTS, type QuestStatus } from '../data/quests';
import { RESIDENT_IDS, RESIDENTS, GUESTS } from '../data/residents';
import { FLOWER_SPOTS, GARDEN, HOME, GREENHOUSE, SPAWN } from '../data/world';
import { DEFAULT_SETTINGS, SAVE_VERSION, type BagSlot, type GameData, type Letter, type Settings } from './types';
import { josa } from '../data/josa';

export const START_CLOCK = 9 * 60; // 1일차 오전 9시
export const FLOWER_REGROW = 90; // 게임 분
export const TREE_COOLDOWN = 180;
export const ROCK_COOLDOWN = 240;
export const LOG_COOLDOWN = 120;
export const PLOT_STAGES = [0, 60, 150]; // 새싹 · 봉오리 · 개화(게임 분)
/** 대화에서 수락해야 시작하는 부탁 */
const NEEDS_ACCEPT = new Set(['sodam_flowers', 'woody_arch']);

export function newGameData(): GameData {
  const quests: Record<string, QuestStatus> = {};
  for (const id of MAIN_CHAIN) quests[id] = 'locked';
  quests.welcome = 'active';
  const residents: GameData['residents'] = {};
  for (const id of RESIDENT_IDS) residents[id] = { affinity: 0, talkedDay: 0, giftDay: 0 };
  const plots: GameData['plots'] = {};
  HOME.plots.forEach((_, i) => (plots[`home${i}`] = { seed: null, plantedAt: 0 }));
  GREENHOUSE.plots.forEach((_, i) => (plots[`gh${i}`] = { seed: null, plantedAt: 0 }));
  return {
    version: SAVE_VERSION,
    started: false,
    createdAt: Date.now(),
    savedAt: 0,
    me: { name: '지우', look: { ...DEFAULT_PLAYER } },
    partner: { name: '하루', look: { ...DEFAULT_PARTNER } },
    pos: [...SPAWN.pos] as [number, number],
    dir: SPAWN.dir,
    money: 100,
    bag: new Array(BAG_SIZE).fill(null),
    storage: {},
    recipes: [],
    quests,
    rewards: [],
    residents,
    flowers: {},
    trees: {},
    rocks: {},
    logs: 0,
    plots,
    decor: { garden: [], home: [] },
    wedding: { count: 0, firstDay: null, inProgress: false },
    memories: [],
    letters: [],
    photos: [],
    framePhoto: null,
    promiseTree: null,
    clock: START_CLOCK,
    settings: { ...DEFAULT_SETTINGS },
    stats: { picked: 0, crafted: 0, playSeconds: 0 },
  };
}

// ── 순수 계산 ───────────────────────────────────────────
export function countIn(bag: Array<BagSlot | null>, id: string): number {
  let n = 0;
  for (const s of bag) if (s && s.id === id) n += s.qty;
  return n;
}

/** 가방에 넣어 본다(새 배열 반환). 다 못 넣으면 남은 수량 */
export function bagAdd(bag: Array<BagSlot | null>, id: string, qty: number): { bag: Array<BagSlot | null>; left: number } {
  const next = bag.map((s) => (s ? { ...s } : null));
  const max = ITEMS[id]?.stack ?? 99;
  let left = qty;
  for (const s of next) {
    if (left <= 0) break;
    if (s && s.id === id && s.qty < max) {
      const put = Math.min(max - s.qty, left);
      s.qty += put;
      left -= put;
    }
  }
  for (let i = 0; i < next.length && left > 0; i++) {
    if (!next[i]) {
      const put = Math.min(max, left);
      next[i] = { id, qty: put };
      left -= put;
    }
  }
  return { bag: next, left };
}

export function bagRemove(bag: Array<BagSlot | null>, id: string, qty: number): Array<BagSlot | null> | null {
  if (countIn(bag, id) < qty) return null;
  const next = bag.map((s) => (s ? { ...s } : null));
  let left = qty;
  for (let i = next.length - 1; i >= 0 && left > 0; i--) {
    const s = next[i];
    if (s && s.id === id) {
      const take = Math.min(s.qty, left);
      s.qty -= take;
      left -= take;
      if (s.qty <= 0) next[i] = null;
    }
  }
  return next;
}

export function dayOf(clock: number): number {
  return Math.floor(clock / 1440) + 1;
}
export function hourOf(clock: number): number {
  return (clock % 1440) / 60;
}

export function plotStage(p: { seed: string | null; plantedAt: number }, clock: number): number {
  if (!p.seed) return -1;
  const age = clock - p.plantedAt;
  if (age >= PLOT_STAGES[2]) return 3; // 개화
  if (age >= PLOT_STAGES[1]) return 2; // 봉오리
  return 1; // 새싹
}

/** 회전 반영 사각형 겹침 */
function rectOverlap(a: { x: number; z: number; hw: number; hd: number }, b: { x: number; z: number; hw: number; hd: number }, pad = 0): boolean {
  return Math.abs(a.x - b.x) < a.hw + b.hw + pad && Math.abs(a.z - b.z) < a.hd + b.hd + pad;
}

export type PlaceCheck = { ok: boolean; tone: 'ok' | 'bad' | 'warn'; reason: string };

/** 배치 미리보기 판정 — 유효 · 충돌 · 통로 막힘 · 구역 밖 */
export function checkPlacement(area: DecorArea, placed: PlacedDecor[], id: string, x: number, z: number, rot: number, ignoreUid?: string): PlaceCheck {
  const def = DECOR[id];
  if (!def) return { ok: false, tone: 'bad', reason: '알 수 없는 장식이에요' };
  if (!def.areas.includes(area)) return { ok: false, tone: 'bad', reason: area === 'garden' ? '이 장식은 집 앞마당에만 놓을 수 있어요' : '이 장식은 서약의 정원에만 놓을 수 있어요' };
  const fp = footprint(def, rot);
  const bounds = area === 'garden' ? GARDEN.edit : HOME.yard;
  if (x - fp.hw < bounds.minX || x + fp.hw > bounds.maxX || z - fp.hd < bounds.minZ || z + fp.hd > bounds.maxZ) {
    return { ok: false, tone: 'bad', reason: area === 'garden' ? '정원 밖이에요' : '앞마당 밖이에요' };
  }
  const me = { x, z, ...fp };
  for (const p of placed) {
    if (p.uid === ignoreUid) continue;
    const d = DECOR[p.id];
    if (!d) continue;
    // 러그는 다른 장식과 겹쳐도 된다(바닥 장식)
    if (def.role === 'aisle' || d.role === 'aisle') continue;
    if (rectOverlap(me, { x: p.x, z: p.z, ...footprint(d, p.rot) }, 0.02)) return { ok: false, tone: 'bad', reason: `${josa(d.name, '와/과')} 겹쳐요` };
  }
  if (area === 'home') {
    // 집 몸체·문 앞·화단 자리 비우기
    const plotsHit = HOME.plots.some(([px, pz]) => rectOverlap(me, { x: px, z: pz, hw: 0.55, hd: 0.55 }));
    if (plotsHit) return { ok: false, tone: 'bad', reason: '화단 자리와 겹쳐요' };
    if (rectOverlap(me, { x: HOME.door[0], z: HOME.door[1] + 0.9, hw: 0.8, hd: 0.9 })) return { ok: false, tone: 'warn', reason: '현관 앞을 막아요' };
    if (rectOverlap(me, { x: HOME.mailbox[0], z: HOME.mailbox[1], hw: 0.4, hd: 0.4 }) || rectOverlap(me, { x: HOME.storage[0], z: HOME.storage[1], hw: 0.45, hd: 0.4 })) {
      return { ok: false, tone: 'bad', reason: '우편함·보관함과 겹쳐요' };
    }
  }
  if (area === 'garden' && !def.aisleOk) {
    const a = GARDEN.aisle;
    const aisle = { x: (a.minX + a.maxX) / 2, z: (a.minZ + a.maxZ) / 2, hw: (a.maxX - a.minX) / 2, hd: (a.maxZ - a.minZ) / 2 };
    if (rectOverlap(me, aisle)) return { ok: false, tone: 'warn', reason: '입장 통로를 막아요' };
  }
  if (area === 'garden' && def.role === 'arch') {
    const [ax, az] = GARDEN.archSpot;
    if (Math.hypot(x - ax, z - az) > 1.6 || rot % 2 === 1) return { ok: true, tone: 'warn', reason: '놓을 수 있어요 · 예식엔 통로 끝 아치 자리에 정면으로' };
  }
  return { ok: true, tone: 'ok', reason: '놓을 수 있어요' };
}

export interface ReadyItem {
  key: string;
  label: string;
  ok: boolean;
  detail: string;
  fix: 'decor' | 'wardrobe' | null;
  optional?: boolean;
}

/** 예식 시작 조건 — 장식 수량과 배치 유효성만 본다(가격·특정 외형 강제 없음) */
export function ceremonyReadiness(d: GameData): { ok: boolean; items: ReadyItem[] } {
  const g = d.decor.garden;
  const arches = g.filter((p) => DECOR[p.id]?.role === 'arch');
  const [ax, az] = GARDEN.archSpot;
  const archOk = arches.some((p) => Math.hypot(p.x - ax, p.z - az) <= 1.6 && p.rot % 2 === 0);
  const a = GARDEN.aisle;
  const aisle = { x: (a.minX + a.maxX) / 2, z: (a.minZ + a.maxZ) / 2, hw: (a.maxX - a.minX) / 2, hd: (a.maxZ - a.minZ) / 2 };
  const blockers = g.filter((p) => {
    const def = DECOR[p.id];
    if (!def || def.aisleOk) return false;
    return rectOverlap({ x: p.x, z: p.z, ...footprint(def, p.rot) }, aisle);
  });
  const seats = g.filter((p) => DECOR[p.id]?.role === 'seat').length;
  const need = GUESTS.length + 2;
  const dressed = !!d.me.look.wedding && !!d.partner.look.wedding;
  const items: ReadyItem[] = [
    {
      key: 'arch',
      label: '웨딩 아치',
      ok: archOk,
      detail: archOk ? '통로 끝 아치 자리에 놓였어요' : arches.length ? '아치를 통로 끝 표시 자리에 정면으로 옮겨 주세요' : '작업대에서 만든 아치를 정원에 놓아 주세요',
      fix: 'decor',
    },
    { key: 'aisle', label: '입장 통로', ok: blockers.length === 0, detail: blockers.length ? `통로를 막는 장식 ${blockers.length}개를 옮겨 주세요` : '두 사람이 걸어 들어올 길이 비어 있어요', fix: 'decor' },
    { key: 'seats', label: '하객 자리', ok: seats >= need, detail: `하객 의자 ${Math.min(seats, need)}/${need}`, fix: 'decor' },
    { key: 'outfit', label: '웨딩 의상', ok: dressed, detail: dressed ? '두 사람 모두 골랐어요' : '햇살 의상실 거울에서 두 사람의 웨딩 의상을 골라 주세요', fix: 'wardrobe' },
    { key: 'bouquet', label: '숲속 부케', ok: countIn(d.bag, 'bouquet') > 0, detail: countIn(d.bag, 'bouquet') > 0 ? '부케를 들고 입장해요' : '있으면 들고 입장해요(선택)', fix: null, optional: true },
  ];
  return { ok: items.every((i) => i.ok || i.optional), items };
}

// ── 이벤트(엔진·UI 가 듣는다) ─────────────────────────────
type GameEvent =
  | { type: 'gain'; id: string; qty: number; toStorage?: number }
  | { type: 'quest'; id: string; status: QuestStatus }
  | { type: 'memory'; id: string; title: string }
  | { type: 'reward'; text: string }
  | { type: 'bagFull'; id: string }
  | { type: 'save' };
type Listener = (e: GameEvent) => void;
const listeners = new Set<Listener>();
export function onGameEvent(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function emit(e: GameEvent) {
  listeners.forEach((fn) => {
    try {
      fn(e);
    } catch (err) {
      console.error(err);
    }
  });
}

let uidSeq = 0;
export function newUid(prefix = 'd'): string {
  uidSeq = (uidSeq + 1) % 1e6;
  return `${prefix}${Date.now().toString(36)}${uidSeq.toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`;
}

// ── 꾸미기 편집 세션(취소하면 이전 배치로 복원 · 실행 취소) ──
interface EditSession {
  area: DecorArea;
  before: { decor: GameData['decor']; bag: GameData['bag']; storage: GameData['storage'] };
  undo: Array<{ decor: GameData['decor']; bag: GameData['bag']; storage: GameData['storage'] }>;
}

export interface GameStore extends GameData {
  edit: EditSession | null;
  /** 전체 상태를 갈아 끼운다(불러오기) */
  hydrate: (d: GameData) => void;
  snapshot: () => GameData;
  count: (id: string) => number;
  canAdd: (id: string, qty: number) => boolean;
  /** 퀘스트 보상 등 잃으면 안 되는 지급 — 가방이 차면 보관함으로 */
  give: (id: string, qty: number) => { toStorage: number };
  /** 채집 — 가방이 차면 획득 취소 */
  gather: (id: string, qty: number) => boolean;
  setPose: (pos: [number, number], dir: number) => void;
  tick: (gameMinutes: number, realSeconds: number) => void;
  setSettings: (s: Partial<Settings>) => void;
  setLook: (who: 'me' | 'partner', look: Appearance) => void;
  setNames: (me: string, partner: string) => void;
  startGame: () => void;
  // 채집
  pickFlower: (spotId: string) => { ok: boolean; reason?: string; item?: string };
  shakeTree: (treeId: string, fruit: boolean) => { ok: boolean; drops: Array<{ id: string; qty: number }>; reason?: string };
  hitRock: (rockId: string) => { ok: boolean; reason?: string };
  takeLogs: () => { ok: boolean; reason?: string };
  plant: (plotId: string, seed: string) => boolean;
  harvest: (plotId: string) => { ok: boolean; reason?: string };
  // 제작·상점·선물
  craft: (recipeId: string) => { ok: boolean; reason?: string };
  buy: (id: string, qty: number) => { ok: boolean; reason?: string };
  sell: (id: string, qty: number) => { ok: boolean; reason?: string };
  takeFromStorage: (id: string, qty: number) => { ok: boolean; reason?: string };
  putToStorage: (id: string, qty: number) => boolean;
  gift: (resident: string, id: string) => { ok: boolean; liked: boolean; already: boolean };
  talk: (resident: string) => void;
  // 퀘스트
  quest: (id: string) => QuestStatus;
  acceptQuest: (id: string) => void;
  completeQuest: (id: string) => boolean;
  refreshQuests: () => void;
  // 꾸미기
  beginEdit: (area: DecorArea) => void;
  placeDecor: (id: string, x: number, z: number, rot: number) => PlaceCheck;
  moveDecor: (uid: string, x: number, z: number, rot: number) => PlaceCheck;
  retrieveDecor: (uid: string) => boolean;
  undoEdit: () => boolean;
  cancelEdit: () => void;
  commitEdit: () => void;
  // 예식·추억
  ceremonyBegin: () => void;
  ceremonyAbort: () => void;
  ceremonyComplete: (photoId: string | null) => { first: boolean };
  addMemory: (id: string, photoId?: string | null) => void;
  addPhoto: (id: string) => void;
  removePhoto: (id: string) => void;
  setFramePhoto: (id: string | null) => void;
  readLetter: (id: string) => void;
}

const DATA_KEYS: Array<keyof GameData> = Object.keys(newGameData()) as Array<keyof GameData>;

function pickData(s: GameStore): GameData {
  const out = {} as GameData;
  for (const k of DATA_KEYS) (out as any)[k] = (s as any)[k];
  return out;
}

export const useGame = create<GameStore>((set, get) => {
  /** 보상 한 번만 — 이미 받았으면 false */
  const once = (rewardId: string): boolean => !get().rewards.includes(rewardId);

  const activateNext = (quests: Record<string, QuestStatus>, id: string) => {
    const nxt = QUESTS[id]?.next;
    if (!nxt) return;
    // 주민이 주는 부탁은 대화에서 수락해야 진행(수락 가능 → 진행 중), 나머지는 바로 진행
    if (quests[nxt] === 'locked') quests[nxt] = NEEDS_ACCEPT.has(nxt) ? 'available' : 'active';
  };

  const memory = (state: GameData, id: string, photoId: string | null = null) => {
    if (state.memories.some((m) => m.id === id)) return state.memories;
    const def = MEMORY_DEFS[id];
    if (!def) return state.memories;
    const m = { id, title: def.title, day: dayOf(state.clock), text: def.text({ me: state.me.name, partner: state.partner.name }), photoId };
    setTimeout(() => emit({ type: 'memory', id, title: def.title }), 0);
    return [...state.memories, m];
  };

  return {
    ...newGameData(),
    edit: null,

    hydrate: (d) => set({ ...d, edit: null }),
    snapshot: () => pickData(get()),
    count: (id) => countIn(get().bag, id),
    canAdd: (id, qty) => bagAdd(get().bag, id, qty).left === 0,

    give: (id, qty) => {
      const s = get();
      const r = bagAdd(s.bag, id, qty);
      const storage = { ...s.storage };
      if (r.left > 0) storage[id] = (storage[id] || 0) + r.left;
      set({ bag: r.bag, storage });
      emit({ type: 'gain', id, qty, toStorage: r.left });
      get().refreshQuests();
      return { toStorage: r.left };
    },

    gather: (id, qty) => {
      const s = get();
      const r = bagAdd(s.bag, id, qty);
      if (r.left > 0) {
        emit({ type: 'bagFull', id });
        return false;
      }
      set({ bag: r.bag, stats: { ...s.stats, picked: s.stats.picked + qty } });
      emit({ type: 'gain', id, qty });
      get().refreshQuests();
      return true;
    },

    setPose: (pos, dir) => set({ pos, dir }),

    tick: (gm, rs) => {
      const s = get();
      set({ clock: s.clock + gm, stats: { ...s.stats, playSeconds: s.stats.playSeconds + rs } });
    },

    setSettings: (p) => set({ settings: { ...get().settings, ...p } }),

    setLook: (who, look) => {
      if (who === 'me') set({ me: { ...get().me, look: { ...look } } });
      else set({ partner: { ...get().partner, look: { ...look } } });
      get().refreshQuests();
    },

    setNames: (me, partner) => set({ me: { ...get().me, name: me.trim() || '지우' }, partner: { ...get().partner, name: partner.trim() || '하루' } }),

    startGame: () => {
      const s = get();
      set({ started: true, memories: memory(s, 'first_meet') });
    },

    pickFlower: (spotId) => {
      const s = get();
      const spot = FLOWER_SPOTS.find((f) => f.id === spotId);
      if (!spot) return { ok: false, reason: 'none' };
      if ((s.flowers[spotId] || 0) > s.clock) return { ok: false, reason: 'growing' };
      if (!get().gather(spot.item, 1)) return { ok: false, reason: 'full' };
      set({ flowers: { ...get().flowers, [spotId]: get().clock + FLOWER_REGROW } });
      return { ok: true, item: spot.item };
    },

    shakeTree: (treeId, fruit) => {
      const s = get();
      if ((s.trees[treeId] || 0) > s.clock) return { ok: false, drops: [], reason: 'cooldown' };
      // 결정적 무작위(같은 나무·같은 날 같은 결과)
      const seed = (treeId.charCodeAt(treeId.length - 1) * 31 + dayOf(s.clock) * 17 + Math.floor(s.clock / 180)) % 7;
      const drops: Array<{ id: string; qty: number }> = fruit ? [{ id: 'fruit', qty: 1 + (seed % 2) }, { id: 'wood', qty: 1 }] : [{ id: 'wood', qty: 2 + (seed % 2) }];
      if (seed % 3 === 0) drops.push({ id: 'branch', qty: 1 });
      // 가방 공간 확인 — 모두 들어가야 흔든다(일부만 들어가는 일 없음). 들어가면 한 번에 지급
      let bag = s.bag;
      for (const d of drops) {
        const r = bagAdd(bag, d.id, d.qty);
        if (r.left > 0) {
          emit({ type: 'bagFull', id: d.id });
          return { ok: false, drops: [], reason: 'full' };
        }
        bag = r.bag;
      }
      set({ bag, trees: { ...s.trees, [treeId]: s.clock + TREE_COOLDOWN }, stats: { ...s.stats, picked: s.stats.picked + drops.length } });
      for (const d of drops) emit({ type: 'gain', id: d.id, qty: d.qty });
      get().refreshQuests();
      return { ok: true, drops };
    },

    hitRock: (rockId) => {
      const s = get();
      if ((s.rocks[rockId] || 0) > s.clock) return { ok: false, reason: 'cooldown' };
      if (!get().gather('stone', 1)) return { ok: false, reason: 'full' };
      set({ rocks: { ...get().rocks, [rockId]: get().clock + ROCK_COOLDOWN } });
      return { ok: true };
    },

    takeLogs: () => {
      const s = get();
      if (s.logs > s.clock) return { ok: false, reason: 'cooldown' };
      if (!get().gather('wood', 2)) return { ok: false, reason: 'full' };
      set({ logs: get().clock + LOG_COOLDOWN });
      return { ok: true };
    },

    plant: (plotId, seed) => {
      const s = get();
      const p = s.plots[plotId];
      if (!p || p.seed) return false;
      const bag = bagRemove(s.bag, seed, 1);
      if (!bag) return false;
      set({ bag, plots: { ...s.plots, [plotId]: { seed, plantedAt: s.clock } } });
      return true;
    },

    harvest: (plotId) => {
      const s = get();
      const p = s.plots[plotId];
      if (!p || !p.seed || plotStage(p, s.clock) < 3) return { ok: false, reason: 'notyet' };
      const item = p.seed === 'seed_pink' ? 'pink_flower' : 'white_flower';
      const r = bagAdd(s.bag, item, 2);
      if (r.left > 0) {
        emit({ type: 'bagFull', id: item });
        return { ok: false, reason: 'full' };
      }
      set({ bag: r.bag, plots: { ...s.plots, [plotId]: { seed: null, plantedAt: 0 } } });
      emit({ type: 'gain', id: item, qty: 2 });
      get().refreshQuests();
      return { ok: true };
    },

    craft: (recipeId) => {
      const s = get();
      const rec = RECIPES[recipeId];
      if (!rec) return { ok: false, reason: '알 수 없는 제작법이에요' };
      if (!s.recipes.includes(recipeId)) return { ok: false, reason: '아직 배우지 않은 제작법이에요' };
      let bag = s.bag;
      for (const inp of rec.inputs) {
        const next = bagRemove(bag, inp.id, inp.qty);
        if (!next) {
          const have = countIn(s.bag, inp.id);
          return { ok: false, reason: `${josa(ITEMS[inp.id]?.name ?? inp.id, '이/가')} ${inp.qty - have}개 모자라요` };
        }
        bag = next;
      }
      const r = bagAdd(bag, rec.output.id, rec.output.qty);
      if (r.left > 0) return { ok: false, reason: '가방이 가득 찼어요. 몇 가지를 보관함에 맡겨 주세요' };
      // 재료 차감 + 완성품 지급 + 퀘스트 진행 = 한 번에
      const quests = { ...s.quests };
      let memories = s.memories;
      if (recipeId === 'bouquet' && quests.first_bouquet === 'active') {
        quests.first_bouquet = 'done';
        activateNext(quests, 'first_bouquet');
        memories = memory(s, 'first_bouquet');
      }
      if (recipeId === 'arch' && quests.woody_arch === 'active') {
        quests.woody_arch = 'done';
        activateNext(quests, 'woody_arch');
      }
      set({ bag: r.bag, quests, memories, stats: { ...s.stats, crafted: s.stats.crafted + 1 } });
      emit({ type: 'gain', id: rec.output.id, qty: rec.output.qty });
      if (quests.first_bouquet !== s.quests.first_bouquet) emit({ type: 'quest', id: 'first_bouquet', status: 'done' });
      if (quests.woody_arch !== s.quests.woody_arch) emit({ type: 'quest', id: 'woody_arch', status: 'done' });
      get().refreshQuests();
      return { ok: true };
    },

    buy: (id, qty) => {
      const s = get();
      const def = ITEMS[id];
      if (!def?.buy) return { ok: false, reason: '팔지 않는 물건이에요' };
      const cost = def.buy * qty;
      if (s.money < cost) return { ok: false, reason: `도토리가 ${cost - s.money}개 모자라요` };
      const r = bagAdd(s.bag, id, qty);
      if (r.left > 0) return { ok: false, reason: '가방이 가득 찼어요' };
      set({ bag: r.bag, money: s.money - cost });
      emit({ type: 'gain', id, qty });
      return { ok: true };
    },

    sell: (id, qty) => {
      const s = get();
      const def = ITEMS[id];
      if (!def?.sell) return { ok: false, reason: '팔 수 없는 물건이에요' };
      const bag = bagRemove(s.bag, id, qty);
      if (!bag) return { ok: false, reason: '수량이 모자라요' };
      set({ bag, money: s.money + def.sell * qty });
      get().refreshQuests();
      return { ok: true };
    },

    takeFromStorage: (id, qty) => {
      const s = get();
      const have = s.storage[id] || 0;
      if (have < qty) return { ok: false, reason: '보관함에 그만큼 없어요' };
      const r = bagAdd(s.bag, id, qty);
      if (r.left > 0) return { ok: false, reason: '가방이 가득 찼어요' };
      const storage = { ...s.storage, [id]: have - qty };
      if (storage[id] <= 0) delete storage[id];
      set({ bag: r.bag, storage });
      get().refreshQuests();
      return { ok: true };
    },

    putToStorage: (id, qty) => {
      const s = get();
      const bag = bagRemove(s.bag, id, qty);
      if (!bag) return false;
      set({ bag, storage: { ...s.storage, [id]: (s.storage[id] || 0) + qty } });
      get().refreshQuests();
      return true;
    },

    gift: (resident, id) => {
      const s = get();
      const r = s.residents[resident];
      const day = dayOf(s.clock);
      if (!r) return { ok: false, liked: false, already: false };
      if (r.giftDay === day) return { ok: false, liked: false, already: true };
      const bag = bagRemove(s.bag, id, 1);
      if (!bag) return { ok: false, liked: false, already: false };
      const liked = RESIDENTS[resident]?.likes.includes(id) ?? false;
      set({ bag, residents: { ...s.residents, [resident]: { ...r, giftDay: day, affinity: r.affinity + (liked ? 2 : 1) } } });
      get().refreshQuests();
      return { ok: true, liked, already: false };
    },

    talk: (resident) => {
      const s = get();
      const r = s.residents[resident];
      if (!r) return;
      const day = dayOf(s.clock);
      if (r.talkedDay !== day) set({ residents: { ...s.residents, [resident]: { ...r, talkedDay: day, affinity: r.affinity + 1 } } });
    },

    quest: (id) => get().quests[id] || 'locked',

    acceptQuest: (id) => {
      const s = get();
      if (s.quests[id] !== 'available') return;
      const quests = { ...s.quests, [id]: 'active' as QuestStatus };
      let bag = s.bag;
      let storage = s.storage;
      let recipes = s.recipes;
      const rewards = [...s.rewards];
      // 우디: 수락하면 공방 제작법 + 하객 의자 6개(한 번만)
      if (id === 'woody_arch' && !rewards.includes('woody_gift')) {
        rewards.push('woody_gift');
        recipes = Array.from(new Set([...recipes, ...WORKSHOP_RECIPES]));
        const r = bagAdd(bag, 'chair', 6);
        bag = r.bag;
        if (r.left > 0) storage = { ...storage, chair: (storage.chair || 0) + r.left };
        setTimeout(() => {
          emit({ type: 'gain', id: 'chair', qty: 6, toStorage: r.left });
          emit({ type: 'reward', text: '공방 장식 제작법 8가지를 배웠어요' });
        }, 0);
      }
      set({ quests, bag, storage, recipes, rewards });
      emit({ type: 'quest', id, status: 'active' });
      get().refreshQuests();
    },

    completeQuest: (id) => {
      const s = get();
      const st = s.quests[id];
      if (st === 'done' || st === 'locked') return false;
      if (id === 'sodam_flowers' && countIn(s.bag, 'white_flower') < 3) return false;
      const quests = { ...s.quests, [id]: 'done' as QuestStatus };
      activateNext(quests, id);
      let bag = s.bag;
      let storage = s.storage;
      let money = s.money;
      let recipes = s.recipes;
      const rewards = [...s.rewards];
      const residents = { ...s.residents };
      const grant = (rid: string, fn: () => void) => {
        if (rewards.includes(rid)) return;
        rewards.push(rid);
        fn();
      };
      const giveItem = (item: string, qty: number) => {
        const r = bagAdd(bag, item, qty);
        bag = r.bag;
        if (r.left > 0) storage = { ...storage, [item]: (storage[item] || 0) + r.left };
        setTimeout(() => emit({ type: 'gain', id: item, qty, toStorage: r.left }), 0);
      };
      if (id === 'sodam_flowers') {
        // 꽃은 보여 주기만(소모하지 않음) — 리본 보상 + 부케 제작법
        grant('sodam_flowers', () => {
          giveItem('ribbon', 1);
          money += 50;
          recipes = Array.from(new Set([...recipes, 'bouquet']));
          residents.sodam = { ...residents.sodam, affinity: residents.sodam.affinity + 2 };
          setTimeout(() => emit({ type: 'reward', text: '부케 제작법을 배웠어요 · 도토리 50' }), 0);
        });
      }
      if (id === 'meet_woody') {
        residents.woody = { ...residents.woody, affinity: residents.woody.affinity + 1 };
      }
      if (id === 'place_frame') {
        grant('place_frame', () => {
          money += 100;
          setTimeout(() => emit({ type: 'reward', text: '도토리 100' }), 0);
        });
      }
      set({ quests, bag, storage, money, recipes, rewards, residents });
      emit({ type: 'quest', id, status: 'done' });
      get().refreshQuests();
      return true;
    },

    refreshQuests: () => {
      const s = get();
      const quests = { ...s.quests };
      let changed = false;
      const to = (id: string, st: QuestStatus) => {
        if (quests[id] !== st) {
          quests[id] = st;
          changed = true;
        }
      };
      // 소담의 부탁: 흰 꽃 3송이를 가지고 있으면 '완료 가능'
      if (quests.sodam_flowers === 'active' && countIn(s.bag, 'white_flower') >= 3) to('sodam_flowers', 'ready');
      else if (quests.sodam_flowers === 'ready' && countIn(s.bag, 'white_flower') < 3) to('sodam_flowers', 'active');
      // 웨딩 의상: 두 사람 다 고르면 완료
      if (quests.wedding_outfit === 'active' && s.me.look.wedding && s.partner.look.wedding) {
        to('wedding_outfit', 'done');
        activateNext(quests, 'wedding_outfit');
        changed = true;
      }
      if (changed) {
        set({ quests });
        for (const id of Object.keys(quests)) if (quests[id] !== s.quests[id]) emit({ type: 'quest', id, status: quests[id] });
      }
    },

    beginEdit: (area) => {
      const s = get();
      set({ edit: { area, before: { decor: s.decor, bag: s.bag, storage: s.storage }, undo: [] } });
    },

    placeDecor: (id, x, z, rot) => {
      const s = get();
      const ed = s.edit;
      if (!ed) return { ok: false, tone: 'bad', reason: '꾸미기 중이 아니에요' };
      const def = DECOR[id];
      const chk = checkPlacement(ed.area, s.decor[ed.area], id, x, z, rot);
      if (!chk.ok) return chk;
      const bag = bagRemove(s.bag, def.item, 1);
      if (!bag) return { ok: false, tone: 'bad', reason: '가방에 남은 장식이 없어요' };
      const placed: PlacedDecor = { uid: newUid(), id, x, z, rot };
      set({
        bag,
        decor: { ...s.decor, [ed.area]: [...s.decor[ed.area], placed] },
        edit: { ...ed, undo: [...ed.undo, { decor: s.decor, bag: s.bag, storage: s.storage }] },
      });
      return chk;
    },

    moveDecor: (uid, x, z, rot) => {
      const s = get();
      const ed = s.edit;
      if (!ed) return { ok: false, tone: 'bad', reason: '꾸미기 중이 아니에요' };
      const p = s.decor[ed.area].find((d) => d.uid === uid);
      if (!p) return { ok: false, tone: 'bad', reason: '장식을 찾을 수 없어요' };
      const chk = checkPlacement(ed.area, s.decor[ed.area], p.id, x, z, rot, uid);
      if (!chk.ok) return chk;
      set({
        decor: { ...s.decor, [ed.area]: s.decor[ed.area].map((d) => (d.uid === uid ? { ...d, x, z, rot } : d)) },
        edit: { ...ed, undo: [...ed.undo, { decor: s.decor, bag: s.bag, storage: s.storage }] },
      });
      return chk;
    },

    retrieveDecor: (uid) => {
      const s = get();
      const ed = s.edit;
      if (!ed) return false;
      const p = s.decor[ed.area].find((d) => d.uid === uid);
      if (!p) return false;
      const def = DECOR[p.id];
      const r = bagAdd(s.bag, def.item, 1);
      const storage = r.left > 0 ? { ...s.storage, [def.item]: (s.storage[def.item] || 0) + 1 } : s.storage;
      set({
        bag: r.bag,
        storage,
        decor: { ...s.decor, [ed.area]: s.decor[ed.area].filter((d) => d.uid !== uid) },
        edit: { ...ed, undo: [...ed.undo, { decor: s.decor, bag: s.bag, storage: s.storage }] },
      });
      if (r.left > 0) emit({ type: 'gain', id: def.item, qty: 1, toStorage: 1 });
      return true;
    },

    undoEdit: () => {
      const s = get();
      const ed = s.edit;
      if (!ed || ed.undo.length === 0) return false;
      const prev = ed.undo[ed.undo.length - 1];
      set({ decor: prev.decor, bag: prev.bag, storage: prev.storage, edit: { ...ed, undo: ed.undo.slice(0, -1) } });
      return true;
    },

    cancelEdit: () => {
      const s = get();
      if (!s.edit) return;
      set({ decor: s.edit.before.decor, bag: s.edit.before.bag, storage: s.edit.before.storage, edit: null });
    },

    commitEdit: () => {
      const s = get();
      const ed = s.edit;
      if (!ed) return;
      set({ edit: null });
      const quests = { ...get().quests };
      let changed: string | null = null;
      if (ed.area === 'garden' && quests.decorate_garden === 'active') {
        const r = ceremonyReadiness(get().snapshot());
        const decoOk = r.items.filter((i) => i.key === 'arch' || i.key === 'aisle' || i.key === 'seats').every((i) => i.ok);
        if (decoOk) {
          quests.decorate_garden = 'done';
          activateNext(quests, 'decorate_garden');
          changed = 'decorate_garden';
        }
      }
      if (changed) {
        set({ quests });
        emit({ type: 'quest', id: changed, status: 'done' });
        get().refreshQuests();
      }
      if (ed.area === 'home' && quests.place_frame === 'active' && get().decor.home.some((d) => d.id === 'photo_frame')) {
        get().completeQuest('place_frame');
        set({ memories: memory(get(), 'first_home', get().framePhoto) });
      }
    },

    ceremonyBegin: () => set({ wedding: { ...get().wedding, inProgress: true } }),
    ceremonyAbort: () => set({ wedding: { ...get().wedding, inProgress: false } }),

    ceremonyComplete: (photoId) => {
      const s = get();
      const first = s.wedding.count === 0 || !s.rewards.includes('first_wedding');
      const day = dayOf(s.clock);
      let bag = s.bag;
      let storage = s.storage;
      let money = s.money;
      let letters = s.letters;
      let memories = s.memories;
      let promiseTree = s.promiseTree;
      let framePhoto = s.framePhoto;
      const rewards = [...s.rewards];
      const quests = { ...s.quests };
      const photos = photoId && !s.photos.includes(photoId) ? [...s.photos, photoId] : s.photos;
      if (!rewards.includes('first_wedding')) {
        rewards.push('first_wedding');
        const r = bagAdd(bag, 'photo_frame', 1);
        bag = r.bag;
        if (r.left > 0) storage = { ...storage, photo_frame: (storage.photo_frame || 0) + 1 };
        money += 200;
        promiseTree = day;
        framePhoto = photoId || framePhoto;
        const L = (from: string, title: string, body: string): Letter => ({ id: newUid('l'), from, title, body, day, read: false });
        letters = [
          ...letters,
          L('소담', '꽃잎처럼 고운 날', `${s.me.name} 님, ${s.partner.name} 님. 오늘 두 분이 꽃길을 걸을 때 온실의 꽃들도 다 같이 고개를 들었어요. 결혼 정말 축하해요!`),
          L('우디', '튼튼한 아치처럼', `허허, 아치가 참 잘 어울렸다. ${s.me.name}, ${s.partner.name}. 서로에게 든든히 기대면서도 무겁지 않은 사이로 오래오래 지내렴.`),
          L('도담', '내 인생 최고의 사회!', `신랑 신부 입장~! 그 순간 내 목소리가 떨린 거 알았어? 너무 감동이라 그랬지롱. 축하해!`),
          L('루루 · 모리 · 보리 · 하랑', '하객 일동', '초대해 줘서 고마워요. 단체 사진은 모리가 잘 나왔다고 자랑하고 다녀요!'),
        ];
        memories = memory({ ...s, memories }, 'first_wedding', photoId);
        memories = memory({ ...s, memories }, 'promise_tree', null);
        if (quests.first_wedding !== 'done') {
          quests.first_wedding = 'done';
          activateNext(quests, 'first_wedding');
        }
        setTimeout(() => {
          emit({ type: 'gain', id: 'photo_frame', qty: 1, toStorage: r.left });
          emit({ type: 'reward', text: '축하 편지 4통 · 기념 액자 · 약속의 나무 · 도토리 200' });
          emit({ type: 'quest', id: 'first_wedding', status: 'done' });
        }, 0);
      }
      set({ bag, storage, money, letters, memories, promiseTree, framePhoto, rewards, quests, photos, wedding: { count: s.wedding.count + 1, firstDay: s.wedding.firstDay ?? day, inProgress: false } });
      return { first };
    },

    addMemory: (id, photoId = null) => set({ memories: memory(get(), id, photoId) }),
    addPhoto: (id) => set({ photos: get().photos.includes(id) ? get().photos : [...get().photos, id] }),
    removePhoto: (id) => set({ photos: get().photos.filter((p) => p !== id), framePhoto: get().framePhoto === id ? null : get().framePhoto }),
    setFramePhoto: (id) => set({ framePhoto: id }),
    readLetter: (id) => set({ letters: get().letters.map((l) => (l.id === id ? { ...l, read: true } : l)) }),
  };
});

export function emitSave() {
  emit({ type: 'save' });
}

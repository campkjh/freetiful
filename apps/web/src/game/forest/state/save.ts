// 저장 — 이 브라우저(localStorage)에만 저장한다. 이전 정상 저장본을 :prev 로 보존하고,
// 불러올 때 필수 항목·버전을 검사해 손상되면 이전 저장본으로 복구하거나 새로 시작을 안내한다.
// 존재하지 않는 아이템·장식 ID 는 안전하게 제외한다(표기 이름이 바뀌어도 ID 참조는 유지).
import { ITEMS, BAG_SIZE } from '../data/items';
import { DECOR } from '../data/decor';
import { OUTFITS, DEFAULT_PLAYER, DEFAULT_PARTNER, type Appearance } from '../data/appearance';
import { MAIN_CHAIN, type QuestStatus } from '../data/quests';
import { newGameData } from './store';
import { DEFAULT_SETTINGS, SAVE_VERSION, type GameData } from './types';

const KEY = 'wedding-forest:save:v1';
const PREV = 'wedding-forest:save:v1:prev';

export interface SaveResult {
  ok: boolean;
  error?: string;
}

export function hasSave(): boolean {
  try {
    return !!localStorage.getItem(KEY) || !!localStorage.getItem(PREV);
  } catch {
    return false;
  }
}

export function saveGame(data: GameData): SaveResult {
  try {
    const json = JSON.stringify({ ...data, savedAt: Date.now(), version: SAVE_VERSION });
    const cur = localStorage.getItem(KEY);
    // 지금 저장본이 정상일 때만 이전본으로 밀어 둔다(깨진 걸 이전본으로 덮지 않게)
    if (cur && validate(safeParse(cur))) localStorage.setItem(PREV, cur);
    localStorage.setItem(KEY, json);
    return { ok: true };
  } catch (e: any) {
    const quota = e?.name === 'QuotaExceededError' || /quota/i.test(String(e?.message));
    return { ok: false, error: quota ? '브라우저 저장 공간이 가득 찼어요. 앨범 사진을 몇 장 지운 뒤 다시 저장해 주세요.' : '저장하지 못했어요. 잠시 뒤 다시 시도해 주세요.' };
  }
}

function safeParse(s: string | null): any {
  if (!s) return null;
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

export function loadGame(): { data: GameData | null; source: 'main' | 'prev' | 'none'; damaged: boolean } {
  let main: any = null;
  let prev: any = null;
  try {
    main = safeParse(localStorage.getItem(KEY));
    prev = safeParse(localStorage.getItem(PREV));
  } catch {
    return { data: null, source: 'none', damaged: false };
  }
  const a = validate(main);
  if (a) return { data: a, source: 'main', damaged: false };
  const b = validate(prev);
  if (b) return { data: b, source: 'prev', damaged: !!main || hasRaw(KEY) };
  return { data: null, source: 'none', damaged: !!main || !!prev || hasRaw(KEY) };
}

function hasRaw(k: string): boolean {
  try {
    return !!localStorage.getItem(k);
  } catch {
    return false;
  }
}

export function clearSave() {
  try {
    localStorage.removeItem(KEY);
    localStorage.removeItem(PREV);
  } catch {
    /* 무시 */
  }
}

const num = (v: any, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d);

function fixLook(v: any, d: Appearance): Appearance {
  if (!v || typeof v !== 'object') return { ...d };
  const out = { ...d, ...v } as Appearance;
  if (!OUTFITS[out.outfit] || OUTFITS[out.outfit].wedding) out.outfit = d.outfit;
  if (out.wedding && (!OUTFITS[out.wedding] || !OUTFITS[out.wedding].wedding)) out.wedding = null;
  return out;
}

/** 필수 항목·버전 검사 + 빠진 값은 기본값으로 */
export function validate(raw: any): GameData | null {
  if (!raw || typeof raw !== 'object') return null;
  if (typeof raw.version !== 'number' || raw.version > SAVE_VERSION) return null;
  if (!raw.me || !raw.partner || !Array.isArray(raw.bag) || typeof raw.clock !== 'number') return null;
  const base = newGameData();
  const d: GameData = { ...base, ...raw };
  d.version = SAVE_VERSION;
  d.me = { name: String(raw.me.name || '지우').slice(0, 10), look: fixLook(raw.me.look, DEFAULT_PLAYER) };
  d.partner = { name: String(raw.partner.name || '하루').slice(0, 10), look: fixLook(raw.partner.look, DEFAULT_PARTNER) };
  d.pos = Array.isArray(raw.pos) && raw.pos.length === 2 ? [num(raw.pos[0], base.pos[0]), num(raw.pos[1], base.pos[1])] : base.pos;
  d.dir = num(raw.dir, base.dir);
  d.money = Math.max(0, Math.floor(num(raw.money, base.money)));
  // 가방: 알 수 없는 아이템은 제외
  const bag = new Array(BAG_SIZE).fill(null);
  (raw.bag as any[]).slice(0, BAG_SIZE).forEach((s, i) => {
    if (s && ITEMS[s.id] && s.qty > 0) bag[i] = { id: s.id, qty: Math.min(Math.floor(s.qty), ITEMS[s.id].stack) };
  });
  d.bag = bag;
  d.storage = {};
  for (const [k, v] of Object.entries(raw.storage || {})) if (ITEMS[k] && typeof v === 'number' && v > 0) d.storage[k] = Math.floor(v);
  d.recipes = Array.isArray(raw.recipes) ? raw.recipes.filter((r: any) => typeof r === 'string') : [];
  d.quests = { ...base.quests };
  const OK_STATUS: QuestStatus[] = ['locked', 'available', 'active', 'ready', 'done'];
  for (const id of MAIN_CHAIN) if (raw.quests && OK_STATUS.includes(raw.quests[id])) d.quests[id] = raw.quests[id] as QuestStatus;
  d.rewards = Array.isArray(raw.rewards) ? raw.rewards.filter((r: any) => typeof r === 'string') : [];
  d.residents = { ...base.residents, ...(raw.residents || {}) };
  d.decor = {
    garden: (raw.decor?.garden || []).filter((p: any) => p && DECOR[p.id] && Number.isFinite(p.x) && Number.isFinite(p.z)),
    home: (raw.decor?.home || []).filter((p: any) => p && DECOR[p.id] && Number.isFinite(p.x) && Number.isFinite(p.z)),
  };
  // 예식 도중에 끊겼으면 시작 전 상태로(완료 처리 전이므로 보상 없음)
  d.wedding = { count: num(raw.wedding?.count, 0), firstDay: raw.wedding?.firstDay ?? null, inProgress: false };
  d.memories = Array.isArray(raw.memories) ? raw.memories : [];
  d.letters = Array.isArray(raw.letters) ? raw.letters : [];
  d.photos = Array.isArray(raw.photos) ? raw.photos.filter((p: any) => typeof p === 'string') : [];
  d.settings = { ...DEFAULT_SETTINGS, ...(raw.settings || {}) };
  d.plots = { ...base.plots, ...(raw.plots || {}) };
  d.stats = { ...base.stats, ...(raw.stats || {}) };
  return d;
}

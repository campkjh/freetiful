'use client';

// 송년회 '나' — PUT /guest 응답(ReceptionMe: 명단 자리 · 럭키드로우 응모권)을 받아 두는 곳. 자리 탭 · 퀴즈 탭 · 공용 틀이 같이 쓴다.
// 마지막 응답을 기기에 남겨 다음에 열 때 바로 그린다(자리가 임시 → 명단으로 깜빡 바뀌지 않게). 이름이 바뀌면 남긴 것은 안 쓴다.
// 실시간(261123 사장 '자리랑 이름 바뀌면 앱에서도 실시간으로 바로 바뀌어야함') — 화면이 보이는 동안 2초마다 명단 지문(GET pulse)만 보고,
// 바뀌면 바로 PUT /guest 로 다시 받는다(onSeatsChange). 어드민이 이름을 고쳤으면 서버가 새 이름으로 답하고(renamedFrom) 기기 이름도 바꾼다(adoptRename).
import { useCallback, useEffect, useRef, useState } from 'react';
import { receptionApi, type ReceptionMe, type ReceptionSameName, type ReceptionTicket } from './api';
import { RECEPTION_EVENT_KEY, seatFor } from './event';
import { cleanGuestName, readGuest, saveGuestName, type ReceptionGuest } from './guest';

const CACHE_KEY = `freetiful-reception-${RECEPTION_EVENT_KEY}-me`;
/** 동명이인일 때 고른 테이블 — 이름별(이름을 바꾸면 안 씀) */
const SAME_PICK_KEY = `freetiful-reception-${RECEPTION_EVENT_KEY}-same`;

/** 서버 nameKey(reception.rules.ts)와 같은 규칙 — NFKC → 공백 · 폭 없는 문자(U+200B~200D · FEFF) 빼고 소문자. '김 솔' == '김솔' */
export const receptionNameKey = (name: string) => name.normalize('NFKC').replace(/[\s​-‍﻿]+/g, '').toLowerCase();

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

function normalizeTicket(v: any): ReceptionTicket | null {
  if (!v || num(v.number) === null) return null;
  const win = v.win && typeof v.win.prize === 'string' ? { prize: v.win.prize, at: typeof v.win.at === 'string' ? v.win.at : '' } : null;
  return { number: v.number, name: typeof v.name === 'string' ? v.name : '', issuedAt: typeof v.issuedAt === 'string' ? v.issuedAt : '', win };
}

/** 동명이인 고를 목록 — 2줄 이상일 때만(모양이 틀린 줄은 버림) */
function normalizeSameName(v: unknown): ReceptionSameName[] | null {
  if (!Array.isArray(v)) return null;
  const out: ReceptionSameName[] = [];
  for (const o of v) {
    const table = num(o?.table);
    if (table === null) continue;
    const mates = Array.isArray(o?.mates) ? o.mates.filter((m: unknown): m is string => typeof m === 'string') : [];
    out.push({ table, seat: num(o?.seat), mates });
  }
  return out.length > 1 ? out : null;
}

/** 옛 서버({ ok } 만)나 빠진 칸이 와도 화면이 깨지지 않게 채운다 — 명단 없음 = 임시 자리, 응모권 없음 */
export function normalizeMe(raw: any, name: string): ReceptionMe {
  const table = num(raw?.seat?.table);
  return {
    ok: true,
    name: typeof raw?.name === 'string' && raw.name ? raw.name : name,
    seatListLoaded: raw?.seatListLoaded === true,
    seat: table !== null ? { table, seat: num(raw?.seat?.seat) } : null,
    sameName: normalizeSameName(raw?.sameName),
    ticketsOpen: raw?.ticketsOpen === true,
    ticket: normalizeTicket(raw?.ticket),
  };
}

export function readCachedMe(name: string): ReceptionMe | null {
  if (!name) return null;
  try {
    const v = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
    if (v && typeof v.key === 'string' && v.key === receptionNameKey(name) && v.me) return normalizeMe(v.me, name);
  } catch {}
  return null;
}

export function cacheMe(name: string, me: ReceptionMe) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify({ key: receptionNameKey(name), me })); } catch {}
}

/** 동명이인일 때 이 이름으로 고른 테이블(없으면 null) */
export function readSamePick(name: string): number | null {
  if (!name) return null;
  try {
    const v = JSON.parse(localStorage.getItem(SAME_PICK_KEY) || 'null');
    if (v && v.key === receptionNameKey(name) && Number.isInteger(v.table) && v.table >= 1) return v.table;
  } catch {}
  return null;
}

function saveSamePick(name: string, table: number | null) {
  try {
    if (table) localStorage.setItem(SAME_PICK_KEY, JSON.stringify({ key: receptionNameKey(name), table }));
    else localStorage.removeItem(SAME_PICK_KEY);
  } catch {}
}

/** 손님에게 보여 줄 자리 — 명단이 있으면 명단(동명이인인데 안 골랐으면 choose, 못 찾으면 missing), 없으면 이름으로 정한 임시 자리 */
export type ResolvedSeat =
  | { kind: 'listed'; table: number; seat: number | null }
  | { kind: 'choose'; choices: ReceptionSameName[] }
  | { kind: 'missing' }
  | { kind: 'temp'; table: number; seat: number };

export function resolveSeat(me: ReceptionMe | null, name: string): ResolvedSeat | null {
  if (!name) return null;
  if (me?.seatListLoaded) {
    if (me.seat) return { kind: 'listed', table: me.seat.table, seat: me.seat.seat };
    return me.sameName ? { kind: 'choose', choices: me.sameName } : { kind: 'missing' };
  }
  if (!me) return null;
  const s = seatFor(name);
  return { kind: 'temp', table: s.table, seat: s.seat };
}

/**
 * 어드민이 이름을 고쳤으면(서버가 보낸 옛 이름을 새 이름으로 이어 답함 — renamedFrom) 이 기기에 남긴 이름을 새 이름으로 바꾼다(261123).
 * 새 이름으로 받은 값을 먼저 남겨 두니 이름이 바뀐 뒤 첫 그리기도 깜빡이지 않는다. 새 이름이 동명이인이면 서버가 고른 자리를 기기에도 남긴다.
 * 그 사이 손님이 직접 다른 이름을 넣었으면(보낸 이름 ≠ 지금 저장된 이름) 덮지 않는다. 바꿨으면 새 이름, 아니면 null
 */
export function adoptRename(raw: unknown, sentName: string, me: ReceptionMe): string | null {
  const from = (raw as { renamedFrom?: unknown } | null)?.renamedFrom;
  const to = cleanGuestName(me.name);
  if (typeof from !== 'string' || !from || !to || receptionNameKey(to) === receptionNameKey(sentName)) return null;
  if (readGuest().name !== sentName) return null;
  cacheMe(to, me);
  saveSamePick(to, me.sameName && me.seat ? me.seat.table : null);
  saveGuestName(to);
  return to;
}

/* ─── 바뀜 신호 — 화면이 보일 때 2초마다 명단 지문(GET pulse). 구독이 하나라도 있을 때만 돈다(공용 틀이 늘 하나 구독) ─── */
const PULSE_MS = 2000;
const pulseSubs = new Set<() => void>();
let pulseTimer: ReturnType<typeof setInterval> | null = null;
let pulseLast: string | null = null;
let pulseBusy = false;

async function pulseTick() {
  if (pulseBusy || typeof document === 'undefined' || document.visibilityState === 'hidden') return;
  pulseBusy = true;
  try {
    const { v } = await receptionApi.pulse(readGuest().deviceId);
    if (typeof v !== 'string' || !v) return;
    const changed = pulseLast !== null && pulseLast !== v;
    pulseLast = v;
    if (changed) for (const fn of [...pulseSubs]) fn();
  } catch {
    /* 망 오류 · 옛 서버(404) — 다음 번에 다시. 15초 폴링은 그대로 돈다 */
  } finally {
    pulseBusy = false;
  }
}

/** 자리 명단이 바뀌면(어드민이 자리 · 이름을 고침) fn. 반환 = 끊기 */
export function onSeatsChange(fn: () => void): () => void {
  pulseSubs.add(fn);
  if (!pulseTimer) {
    pulseTimer = setInterval(pulseTick, PULSE_MS);
    void pulseTick();
  }
  return () => {
    pulseSubs.delete(fn);
    if (!pulseSubs.size && pulseTimer) {
      clearInterval(pulseTimer);
      pulseTimer = null;
    }
  };
}

/** 손님 140명이 한꺼번에 PUT /guest 로 몰리지 않게 — 바뀜을 본 뒤 0~1.5초 흩어서 */
export const pulseJitter = () => Math.random() * 1500;

/** 지금 화면에 useReceptionMe 가 몇 개 떠 있나 — 공용 틀은 0 일 때만(사진 · 순서 · 설문 탭) 스스로 다시 받아 이름 고침을 잇는다 */
let meHooks = 0;
export const meHookCount = () => meHooks;

export type MeStatus = 'idle' | 'loading' | 'ready' | 'error';

/** 요청 열쇠 — 이름 + 동명이인 고른 테이블(둘 중 하나라도 바뀌면 다른 요청) */
const reqKey = (name: string, pick: number | null) => `${name}\u0000${pick ?? ''}`;

/**
 * 이름이 있으면 PUT /guest 로 '나'를 받는다. pollMs 를 주면 그 간격으로 다시 받는다(화면이 숨으면 멈춤, 다시 보이면 바로 한 번).
 * 실패해도 받아 둔 값은 그대로 둔다(status 만 error).
 * 동명이인이면 choose(테이블)로 고른 자리를 기기에 남기고 그 자리로 다시 받는다(choose(null) = 다시 고르기).
 */
export function useReceptionMe(guest: ReceptionGuest | null, pollMs?: number) {
  const name = guest?.name || '';
  const deviceId = guest?.deviceId || '';
  const [me, setMe] = useState<ReceptionMe | null>(null);
  const [status, setStatus] = useState<MeStatus>('idle');
  // 고른 자리는 이름과 묶어 둔다 — 이름이 바뀐 그 그리기에서 바로 새 이름의 고른 자리를 쓴다(옛 이름 자리로 한 번 부르지 않게)
  const [picked, setPicked] = useState<{ name: string; table: number | null }>({ name: '', table: null });
  const pick = picked.name === name ? picked.table : readSamePick(name);
  // 같은 이름·같은 고름으로 가는 중이면 겹쳐 부르지 않는다(바뀌면 바로 새로). 바뀜 신호로 부를 땐 겹쳐도 새로(force) — 늦게 온 옛 답은 순번으로 버림
  const inflight = useRef<string | null>(null);
  const current = useRef('');
  const seq = useRef(0);
  const applied = useRef(0);

  // 이름이 바뀌면 그 이름으로 남겨 둔 값·고른 자리부터
  useEffect(() => {
    const p = readSamePick(name);
    current.current = reqKey(name, p);
    setPicked({ name, table: p });
    setMe(readCachedMe(name));
    setStatus(name ? 'loading' : 'idle');
  }, [name]);

  const load = useCallback(async (force = false) => {
    const k = reqKey(name, pick);
    if (!name || !deviceId || (!force && inflight.current === k)) return;
    inflight.current = k;
    const my = ++seq.current;
    try {
      const raw = await receptionApi.guest(deviceId, name, pick);
      if (current.current !== k || my < applied.current) return;
      applied.current = my;
      const next = normalizeMe(raw, name);
      // 어드민이 이름을 고침 — 기기 이름을 바꾸면 이 훅이 새 이름으로 다시 시작한다(남겨 둔 새 이름 값으로 바로 그림)
      if (adoptRename(raw, name, next)) {
        setMe(next);
        return;
      }
      cacheMe(name, next);
      setMe(next);
      setStatus('ready');
    } catch {
      if (current.current === k && my >= applied.current) setStatus('error');
    } finally {
      if (inflight.current === k && my === seq.current) inflight.current = null;
    }
  }, [name, deviceId, pick]);

  /** 동명이인 자리 고르기 — 바로 그 자리로 보이고(응답 오면 서버 값으로) 고른 것은 기기에 남긴다. null = 다시 고르기 */
  const choose = useCallback((table: number | null) => {
    if (!name) return;
    saveSamePick(name, table);
    current.current = reqKey(name, table);
    setPicked({ name, table });
    setMe((prev) => {
      if (!prev) return prev;
      const c = table ? prev.sameName?.find((x) => x.table === table) : null;
      return { ...prev, seat: c ? { table: c.table, seat: c.seat } : null };
    });
  }, [name]);

  useEffect(() => {
    if (!name || !deviceId) return;
    load();
    if (!pollMs) return;
    const t = setInterval(() => { if (document.visibilityState !== 'hidden') load(); }, pollMs);
    const onVis = () => { if (document.visibilityState !== 'hidden') load(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', onVis); };
  }, [name, deviceId, pollMs, load]);

  // 바뀜 신호 — 명단이 바뀌면 흩어서 바로 다시 받는다(폴링 간격과 무관 · 퀴즈 탭처럼 폴링이 없는 곳도)
  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  }, [load]);
  useEffect(() => {
    meHooks += 1;
    let t: ReturnType<typeof setTimeout> | null = null;
    const off = onSeatsChange(() => {
      if (t) return;
      t = setTimeout(() => {
        t = null;
        void loadRef.current(true);
      }, pulseJitter());
    });
    return () => {
      meHooks -= 1;
      off();
      if (t) clearTimeout(t);
    };
  }, []);

  const reload = useCallback(() => load(), [load]);
  return { me, status, reload, choose };
}

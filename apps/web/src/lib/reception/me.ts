'use client';

// 송년회 '나' — PUT /guest 응답(ReceptionMe: 명단 자리 · 럭키드로우 응모권)을 받아 두는 곳. 자리 탭 · 퀴즈 탭 · 공용 틀이 같이 쓴다.
// 마지막 응답을 기기에 남겨 다음에 열 때 바로 그린다(자리가 임시 → 명단으로 깜빡 바뀌지 않게). 이름이 바뀌면 남긴 것은 안 쓴다.
import { useCallback, useEffect, useRef, useState } from 'react';
import { receptionApi, type ReceptionMe, type ReceptionTicket } from './api';
import { RECEPTION_EVENT_KEY, seatFor } from './event';
import type { ReceptionGuest } from './guest';

const CACHE_KEY = `freetiful-reception-${RECEPTION_EVENT_KEY}-me`;

/** 서버 nameKey(reception.rules.ts)와 같은 규칙 — NFKC → 공백 · 폭 없는 문자(U+200B~200D · FEFF) 빼고 소문자. '김 솔' == '김솔' */
export const receptionNameKey = (name: string) => name.normalize('NFKC').replace(/[\s​-‍﻿]+/g, '').toLowerCase();

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

function normalizeTicket(v: any): ReceptionTicket | null {
  if (!v || num(v.number) === null) return null;
  const win = v.win && typeof v.win.prize === 'string' ? { prize: v.win.prize, at: typeof v.win.at === 'string' ? v.win.at : '' } : null;
  return { number: v.number, name: typeof v.name === 'string' ? v.name : '', issuedAt: typeof v.issuedAt === 'string' ? v.issuedAt : '', win };
}

/** 옛 서버({ ok } 만)나 빠진 칸이 와도 화면이 깨지지 않게 채운다 — 명단 없음 = 임시 자리, 응모권 없음 */
export function normalizeMe(raw: any, name: string): ReceptionMe {
  const table = num(raw?.seat?.table);
  return {
    ok: true,
    name: typeof raw?.name === 'string' && raw.name ? raw.name : name,
    seatListLoaded: raw?.seatListLoaded === true,
    seat: table !== null ? { table, seat: num(raw?.seat?.seat) } : null,
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

/** 손님에게 보여 줄 자리 — 명단이 있으면 명단(못 찾으면 missing), 없으면 이름으로 정한 임시 자리 */
export type ResolvedSeat =
  | { kind: 'listed'; table: number; seat: number | null }
  | { kind: 'missing' }
  | { kind: 'temp'; table: number; seat: number };

export function resolveSeat(me: ReceptionMe | null, name: string): ResolvedSeat | null {
  if (!name) return null;
  if (me?.seatListLoaded) return me.seat ? { kind: 'listed', table: me.seat.table, seat: me.seat.seat } : { kind: 'missing' };
  if (!me) return null;
  const s = seatFor(name);
  return { kind: 'temp', table: s.table, seat: s.seat };
}

export type MeStatus = 'idle' | 'loading' | 'ready' | 'error';

/**
 * 이름이 있으면 PUT /guest 로 '나'를 받는다. pollMs 를 주면 그 간격으로 다시 받는다(화면이 숨으면 멈춤, 다시 보이면 바로 한 번).
 * 실패해도 받아 둔 값은 그대로 둔다(status 만 error).
 */
export function useReceptionMe(guest: ReceptionGuest | null, pollMs?: number) {
  const name = guest?.name || '';
  const deviceId = guest?.deviceId || '';
  const [me, setMe] = useState<ReceptionMe | null>(null);
  const [status, setStatus] = useState<MeStatus>('idle');
  // 같은 이름으로 가는 중이면 겹쳐 부르지 않는다(이름이 바뀌면 바로 새로)
  const inflight = useRef<string | null>(null);
  const current = useRef('');

  // 이름이 바뀌면 그 이름으로 남겨 둔 값부터
  useEffect(() => {
    current.current = name;
    setMe(readCachedMe(name));
    setStatus(name ? 'loading' : 'idle');
  }, [name]);

  const load = useCallback(async () => {
    if (!name || !deviceId || inflight.current === name) return;
    inflight.current = name;
    try {
      const raw = await receptionApi.guest(deviceId, name);
      if (current.current !== name) return;
      const next = normalizeMe(raw, name);
      cacheMe(name, next);
      setMe(next);
      setStatus('ready');
    } catch {
      if (current.current === name) setStatus('error');
    } finally {
      if (inflight.current === name) inflight.current = null;
    }
  }, [name, deviceId]);

  useEffect(() => {
    if (!name || !deviceId) return;
    load();
    if (!pollMs) return;
    const t = setInterval(() => { if (document.visibilityState !== 'hidden') load(); }, pollMs);
    const onVis = () => { if (document.visibilityState !== 'hidden') load(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', onVis); };
  }, [name, deviceId, pollMs, load]);

  return { me, status, reload: load };
}

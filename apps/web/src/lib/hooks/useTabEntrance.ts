'use client';

// 탭 화면(새요청·웨딩숲·채팅·마이) 첫 진입 인터랙션 = 퀵매칭 곡선(260926 사장 "처음 들어갈 때 인터렉션 퀵매칭처럼").
//  · 제목은 아래→위 페이드(.qd-a-title), 탭·부제는 0.18초 뒤(.qd-a-sub), 목록 칸은 오른쪽→왼쪽 22px 순차(0.3초 + i*0.06초).
//  · 탭을 눌러 들어올 때만 튼다 — 뒤로가기로 돌아오거나 떠난 지 30초 안에 다시 오면 그냥 보여 준다(마이의 재진입 규칙과 같음).
//  · 목록은 처음 그려진 한 묶음(최대 12칸)만 움직이고, 나중에 붙는 칸(더 보기·새 글·폴링)은 그냥 뜬다.
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';

const RECENT_MS = 30_000;
const BACK_NAV_MS = 1500;
const EASE = 'cubic-bezier(.22,.61,.36,1)';

let lastPopAt = 0;
let hydrated = false;
if (typeof window !== 'undefined') {
  window.addEventListener('popstate', () => { lastPopAt = Date.now(); });
}

const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;
const leftAtKey = (key: string) => `tab-entrance-left:${key}`;

function prefersReducedMotion() {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
}

/** 이 화면에 들어오며 등장 인터랙션을 틀지 — 마운트 때 한 번만 정한다.
 *  첫 로드(하이드레이션)는 서버 HTML 과 같게 늘 true. */
export function useTabEntrance(key: string): boolean {
  const [play] = useState(() => {
    if (typeof window === 'undefined' || !hydrated) return true;
    if (Date.now() - lastPopAt < BACK_NAV_MS) return false;
    try {
      const left = Number(sessionStorage.getItem(leftAtKey(key)) || '0');
      return !(left && Date.now() - left < RECENT_MS);
    } catch {
      return true;
    }
  });
  useEffect(() => {
    hydrated = true;
    const mark = () => { try { sessionStorage.setItem(leftAtKey(key), String(Date.now())); } catch { /* 저장 불가는 무시 */ } };
    window.addEventListener('pagehide', mark);
    return () => {
      window.removeEventListener('pagehide', mark);
      mark();
    };
  }, [key]);
  return play;
}

/** 들어온 직후 잠깐만 true — 빈 화면 안내처럼 칸 id 가 없는 덩어리에 쓴다(나중에 탭을 바꿔 뜰 땐 그냥 보인다) */
export function useEntranceWindow(entrance: boolean, ms = 1800): boolean {
  const [open, setOpen] = useState(entrance);
  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => setOpen(false), ms);
    return () => window.clearTimeout(t);
  }, [open, ms]);
  return open;
}

/** 목록 첫 묶음 순차 등장. 반환 함수에 칸 id 를 주면 그 칸에 넣을 style(없으면 undefined).
 *  끝난 칸은 animation:none 으로 묶어 둔다 — 칸 자체 등장 애니(.tcard 등)로 이름이 바뀌며 다시 깜빡이지 않게. */
export function useListEntrance(
  ids: readonly string[],
  enabled: boolean,
  { base = 0.3, step = 0.06, max = 12 }: { base?: number; step?: number; max?: number } = {},
) {
  const [batch, setBatch] = useState<Map<string, number> | null>(null);
  const [done, setDone] = useState(false);
  const startedRef = useRef(!enabled);
  const head = ids.slice(0, max).join('\n');

  // 처음 칸이 생긴 커밋에서 화면에 그리기 전에 묶음을 정한다 → 깜빡임 없이 투명에서 시작
  useIsoLayoutEffect(() => {
    if (startedRef.current || !head) return;
    startedRef.current = true;
    if (prefersReducedMotion()) return;
    setBatch(new Map(head.split('\n').map((id, i) => [id, i])));
  }, [head]);

  useEffect(() => {
    if (!batch || done) return;
    const t = window.setTimeout(() => setDone(true), (base + max * step + 0.7) * 1000);
    return () => window.clearTimeout(t);
  }, [batch, done, base, step, max]);

  return useCallback((id: string): CSSProperties | undefined => {
    const i = batch?.get(id);
    if (i === undefined) return undefined;
    if (done) return { animation: 'none' };
    return { animation: `qdSlideIn .46s ${EASE} ${(base + i * step).toFixed(2)}s backwards` };
  }, [batch, done, base, step]);
}

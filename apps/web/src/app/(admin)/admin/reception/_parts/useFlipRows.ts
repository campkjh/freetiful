'use client';

/* 표 줄 자리 옮김을 부드럽게(FLIP) — 새 입장자가 맨 위에 끼면 아래 줄들이 툭 내려가지 않고 스르르 밀린다.
 *  · tr 에는 어드민 전역 등장 애니메이션(admRowIn, fill both)이 걸려 있어 tr 의 transform 은 안 먹는다 → 칸(td)을 옮긴다.
 *  · 줄 키 = tr[data-k]. 위치는 표 기준 offsetTop(본문 스크롤과 상관없게).
 *  · tbody 가 새로 그려지면(보기 바꿈) 이전 위치를 버린다 — 처음 그림은 촤라락 등장이 맡는다. */
import { useLayoutEffect, useRef, type RefObject } from 'react';

export function useFlipRows(tbodyRef: RefObject<HTMLTableSectionElement | null>, deps: unknown[], disabled = false) {
  const pos = useRef<{ el: HTMLTableSectionElement | null; map: Map<string, number> }>({ el: null, map: new Map() });

  useLayoutEffect(() => {
    const tbody = tbodyRef.current;
    if (!tbody) {
      pos.current = { el: null, map: new Map() };
      return;
    }
    const prev = pos.current.el === tbody ? pos.current.map : null;
    const next = new Map<string, number>();
    const moved: HTMLTableCellElement[] = [];
    for (const tr of Array.from(tbody.rows)) {
      const k = tr.dataset.k;
      if (!k) continue;
      const top = tr.offsetTop;
      next.set(k, top);
      const old = prev?.get(k);
      if (disabled || old == null || old === top) continue;
      const dy = old - top;
      for (const td of Array.from(tr.cells)) {
        td.style.transition = 'none';
        td.style.transform = `translate3d(0, ${dy}px, 0)`;
        moved.push(td);
      }
    }
    pos.current = { el: tbody, map: next };
    if (!moved.length) return;
    // 한 프레임 뒤 제자리로 — 먼저 옛 자리에 그려 놓아야 전환이 보인다
    void tbody.offsetHeight;
    const raf = requestAnimationFrame(() => {
      for (const td of moved) {
        td.style.transition = 'transform .45s cubic-bezier(.22, .61, .36, 1)';
        td.style.transform = '';
      }
    });
    const clean = window.setTimeout(() => {
      for (const td of moved) td.style.transition = '';
    }, 600);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(clean);
      for (const td of moved) {
        td.style.transition = '';
        td.style.transform = '';
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

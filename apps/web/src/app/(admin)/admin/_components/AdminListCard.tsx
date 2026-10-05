'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

/* ─────────────────────────────────────────────────────────────
 * 목록 카드 = 거르기 패널(검색·칩·건수 + 조회기간) + 표를 흰 카드 하나로(261005 사장 '각 페이지의 테이블이랑 필터링 패널이랑 합쳐줘').
 *  · 거르기 줄은 카드 맨 위, 모서리 없이 납작하게 + 아래 가는 선으로 표와 가른다(.adm-listcard > .adm-filter).
 *  · 오류 칸·고른 줄 일괄 처리 막대(.adm-selbar)는 카드 위(바깥)에 둔다 — 페이지 맨 바깥 div 의 자식 = 섹션.
 *  · 표는 AdminTableScroll 로 감싼다(가로 스크롤 + 양 끝 그림자).
 * ──────────────────────────────────────────────────────────── */
export function AdminListCard({
  filter,
  children,
  className = '',
}: {
  /** 거르기 패널 안쪽(.adm-toolbar 줄들 · AdminDateFilter) — 없으면 표만 */
  filter?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`adm-listcard ${className}`}>
      {filter ? <div className="adm-filter">{filter}</div> : null}
      {children}
    </div>
  );
}

/** 표 가로 스크롤 칸 — 좁은 화면에서 표가 카드보다 넓으면 옆으로 민다.
 *  더 볼 게 남은 쪽 가장자리에 옅은 그림자(왼쪽 = 지나온 칸, 오른쪽 = 남은 칸). 첫·끝 칸은 양옆 24px 여백(CSS).
 *  세로는 잘라 둔다(줄 등장 애니메이션이 아래로 8px 밀려 세로 스크롤바가 깜빡이지 않게 — 표 안에 뜨는 말풍선은 포털이라 상관없다). */
export function AdminTableScroll({
  children,
  className = '',
  edge = true,
}: {
  children: ReactNode;
  className?: string;
  /** 첫·끝 칸 양옆 24px(카드 가장자리에 붙은 표). 안쪽 여백이 있는 카드 안 표면 false */
  edge?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [shadow, setShadow] = useState<{ l: boolean; r: boolean }>({ l: false, r: false });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const max = el.scrollWidth - el.clientWidth;
      const l = el.scrollLeft > 1;
      const r = max > 1 && el.scrollLeft < max - 1;
      setShadow((prev) => (prev.l === l && prev.r === r ? prev : { l, r }));
    };
    update();
    el.addEventListener('scroll', update, { passive: true });
    let ro: ResizeObserver | null = null;
    let mo: MutationObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(update);
      ro.observe(el);
      Array.from(el.children).forEach((c) => ro?.observe(c));
    }
    // 줄이 더 붙거나(무한 스크롤) 표가 바뀌면 다시 잰다
    if (typeof MutationObserver !== 'undefined') {
      mo = new MutationObserver(() => {
        if (ro) Array.from(el.children).forEach((c) => ro?.observe(c));
        update();
      });
      mo.observe(el, { childList: true });
    }
    return () => {
      el.removeEventListener('scroll', update);
      ro?.disconnect();
      mo?.disconnect();
    };
  }, []);

  return (
    <div className={`adm-tscroll ${edge ? 'edge' : ''} ${shadow.l ? 'is-l' : ''} ${shadow.r ? 'is-r' : ''} ${className}`}>
      <div ref={ref} className="adm-tscroll-in">{children}</div>
    </div>
  );
}

'use client';

import { useEffect, useRef } from 'react';

/**
 * 'admin:refresh' 이벤트가 오면 화면이 지금 거르기·검색 그대로 다시 받는다(useAdminRefresh).
 * 머리 오른쪽 새로고침 버튼(261004)은 261005 사장 요청으로 뺐다 — 지금은 이 이벤트를 쏘는 곳이 없어
 * 훅은 그냥 기다리기만 한다(해 없음). 다시 쏘는 곳을 만들면 받은 화면은 preventDefault 로 '내가 했다'고 알린다.
 */
export const ADMIN_REFRESH_EVENT = 'admin:refresh';

export function useAdminRefresh(fn: () => void) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    const on = (e: Event) => {
      e.preventDefault();
      ref.current();
    };
    window.addEventListener(ADMIN_REFRESH_EVENT, on);
    return () => window.removeEventListener(ADMIN_REFRESH_EVENT, on);
  }, []);
}

const INK = '#191F28';

/** 새로고침 — 홈 헤더 종·돋보기와 같은 선(2px, #191F28) */
export function LineRefreshIcon({ size = 24, spinning = false }: { size?: number; spinning?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" className={spinning ? 'adm-spin' : undefined}>
      <path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3" stroke={INK} strokeWidth="2" strokeLinecap="round" />
      <path d="M19.6 4.2v3.6h-3.6" stroke={INK} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** 꺾쇠 › — 목록 줄 끝(→ 대신) */
export function LineChevron({ size = 18, color = '#B0B8C1' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" className="shrink-0">
      <path d="M9 5.5 15.5 12 9 18.5" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

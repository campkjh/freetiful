import type { Viewport } from 'next';

/**
 * 어드민 묶음 서버 레이아웃 — viewport 만 따로 준다(admin/layout.tsx 는 'use client' 라 거기선 export 못 함).
 * theme-color = 어드민 바탕색(#F2F4F6, 261005 사장 '모바일은 헤더를 백그라운드 색상으로') —
 * 루트엔 theme-color 메타가 없어(루트 metadata.themeColor 는 Next 14 가 무시한다) 아이폰 사파리 상태바·아래 툴바가
 * 파랗게(manifest theme_color #3180F7) 칠해져 회색 머리 위에 파란 띠가 졌다. 나머지 viewport 값(width·viewportFit 등)은 루트 것을 물려받는다.
 */
export const viewport: Viewport = {
  themeColor: '#F2F4F6',
};

export default function AdminGroupLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

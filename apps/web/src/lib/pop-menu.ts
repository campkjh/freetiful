import type { CSSProperties } from 'react';

/** 툴팁 메뉴 항목 순차 등장 — globals.css `.pop-menu-item` 과 짝. 메뉴가 커지는 동안 오른쪽→왼쪽으로 촤라락. */
export const popItemDelay = (i: number): CSSProperties => ({ animationDelay: `${0.07 + i * 0.035}s` });

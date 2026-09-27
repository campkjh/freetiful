'use client';

import { useEffect } from 'react';

/**
 * 모달이 떠 있는 동안 뒤 화면이 스크롤되지 않게 문서(body)를 잠근다(260927 사장 'AI 응답설정 모달 뜨면 뒤가 스크롤되면 안 됨').
 *  · body 를 position:fixed + top:-스크롤값 으로 붙잡는다 — iOS(사파리·WKWebView 앱)는 overflow:hidden 만으로는 손가락 스크롤이 샌다.
 *    풀 때 원래 자리로 즉시 돌려놓는다(html 이 scroll-behavior:smooth 라 'instant' 로).
 *  · 여러 모달이 겹쳐 열려도 꼬이지 않게 개수로 센다 — 마지막 모달이 닫힐 때만 푼다.
 *    (body.style.overflow 를 저장했다 되돌리는 식은 두 모달이 엇갈리면 '잠김'을 원래 값으로 저장해 영구히 잠겼다 — VilladegdEventOverlay 주석)
 */
let lockCount = 0;
let savedScrollY = 0;
let savedStyle: Partial<CSSStyleDeclaration> = {};

export function useBodyScrollLock(active: boolean) {
  useEffect(() => {
    if (!active || typeof document === 'undefined') return;
    const body = document.body;
    if (lockCount === 0) {
      savedScrollY = window.scrollY;
      savedStyle = { position: body.style.position, top: body.style.top, left: body.style.left, right: body.style.right, width: body.style.width, overflow: body.style.overflow };
      body.style.position = 'fixed';
      body.style.top = `-${savedScrollY}px`;
      body.style.left = '0';
      body.style.right = '0';
      body.style.width = '100%';
      body.style.overflow = 'hidden';
    }
    lockCount += 1;
    return () => {
      lockCount = Math.max(0, lockCount - 1);
      if (lockCount > 0) return;
      Object.assign(body.style, savedStyle);
      window.scrollTo({ top: savedScrollY, left: 0, behavior: 'instant' as ScrollBehavior });
    };
  }, [active]);
}

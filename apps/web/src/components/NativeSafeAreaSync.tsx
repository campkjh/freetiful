'use client';

// iOS 앱 표시·키보드 표시 맞추기(261014 iOS 앱 화면 끝까지) — 루트 layout 에 하나만 둔다((main) 밖 경로도 덮게).
//  ① html[data-ios-app]: head 스크립트가 첫 페인트 전에 달지만 하이드레이션·레이아웃 전환에 html 속성이 지워지는 일이 있어
//     (네이티브 주석의 웨딩숲 사례) 마운트 때 다시 달고, 지워지면 바로 되단다.
//  ② html[data-kb="1"]: 키보드가 떠 있는 동안 — globals.css 가 --ft-sab 와 .pb-safe 의 홈 표시줄 칸을 뺀다(키보드가 그 자리를 덮음).
//     판정 = innerHeight - visualViewport.height > 120. iOS 는 키보드가 떠도 innerHeight(레이아웃 뷰포트)는 그대로고
//     보이는 높이만 준다. offsetTop 은 빼지 않는다 — iOS 가 화면을 밀어 올리면(아래 입력 줄) offsetTop 이 커져
//     키보드가 떠 있는데도 표시가 떨어진다. 확대는 막혀 있어(maximumScale 1) 보이는 높이가 주는 건 키보드뿐.
//  · 앱(nativeNavState 핸들러)일 때만 동작 — 안드·사파리는 아무것도 안 단다.
import { useEffect } from 'react';

const KB_MIN_PX = 120;

function isIosApp(): boolean {
  try {
    return !!(window as unknown as { webkit?: { messageHandlers?: { nativeNavState?: unknown } } }).webkit?.messageHandlers
      ?.nativeNavState;
  } catch {
    return false;
  }
}

export default function NativeSafeAreaSync() {
  useEffect(() => {
    if (!isIosApp()) return;
    const root = document.documentElement;

    const mark = () => {
      if (root.getAttribute('data-ios-app') !== '1') root.setAttribute('data-ios-app', '1');
    };
    mark();
    const mo = typeof MutationObserver !== 'undefined' ? new MutationObserver(mark) : null;
    mo?.observe(root, { attributes: true, attributeFilter: ['data-ios-app'] });

    const vv = window.visualViewport;
    let raf = 0;
    const syncKb = () => {
      raf = 0;
      if (!vv) return;
      const open = window.innerHeight - vv.height > KB_MIN_PX;
      const has = root.getAttribute('data-kb') === '1';
      if (open && !has) root.setAttribute('data-kb', '1');
      else if (!open && has) root.removeAttribute('data-kb');
    };
    const schedule = () => {
      if (!raf) raf = window.requestAnimationFrame(syncKb);
    };
    syncKb();
    vv?.addEventListener('resize', schedule);
    vv?.addEventListener('scroll', schedule);
    window.addEventListener('resize', schedule);

    return () => {
      mo?.disconnect();
      vv?.removeEventListener('resize', schedule);
      vv?.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      if (raf) window.cancelAnimationFrame(raf);
      root.removeAttribute('data-kb');
    };
  }, []);

  return null;
}

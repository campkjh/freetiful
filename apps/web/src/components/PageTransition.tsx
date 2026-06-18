'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';

const DETAIL_PATTERNS = [
  /^\/chat\/.+/,
  /^\/pros\/.+/,
  /^\/businesses\/.+/,
  /^\/my\/.+/,
  /^\/notifications/,
  /^\/pro-register/,
  /^\/pros$/,
  /^\/businesses$/,
  /^\/biz/,
  /^\/quote/,
  /^\/careers$/,
  /^\/schedule\/.+/,
];

const ROUTES_WITH_LOCAL_ENTRY_MOTION = [
  /^\/pros\/[^/]+$/,
];

function isDetailPath(path: string): boolean {
  return DETAIL_PATTERNS.some((p) => p.test(path));
}

function hasLocalEntryMotion(path: string): boolean {
  return ROUTES_WITH_LOCAL_ENTRY_MOTION.some((p) => p.test(path));
}

export default function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const prevPath = useRef<string | null>(null);
  const lastAnimAt = useRef<number>(0);
  const [animClass, setAnimClass] = useState<string | null>(null);

  useEffect(() => {
    const prev = prevPath.current;
    prevPath.current = pathname;
    if (prev === null || prev === pathname) return;

    // 사회자 상세는 페이지 내부 Reveal이 이미 진입 모션을 담당한다.
    // 공통 슬라이드까지 같이 걸리면 진입 애니메이션이 두 번 보인다.
    if (hasLocalEntryMotion(prev) || hasLocalEntryMotion(pathname)) return;

    // 같은 루트 섹션 내 이동(예: /chat/pending-xxx → /chat/real-id, /chat → /chat/xxx)
    // 은 애니메이션 생략 — 채팅방 진입 시 router.push + router.replace 로
    // 두 번 파이어되던 문제 방지.
    const prevTop = prev.split('/')[1] || '';
    const currTop = pathname.split('/')[1] || '';
    if (prevTop === currTop) return;

    // 최근 400ms 내에 이미 한번 애니메이션했으면 중복 방지
    if (Date.now() - lastAnimAt.current < 400) return;

    const prevDetail = isDetailPath(prev);
    const currDetail = isDetailPath(pathname);
    let cls: string | null = null;
    if (!prevDetail && currDetail) cls = 'page-slide-in-right';
    else if (prevDetail && !currDetail) cls = 'page-slide-in-left';

    if (cls) {
      lastAnimAt.current = Date.now();
      setAnimClass(cls);
      const t = setTimeout(() => setAnimClass(null), 420);
      return () => clearTimeout(t);
    }
  }, [pathname]);

  // 래퍼 div 를 항상 동일하게 유지한다. 예전엔 애니메이션 중에만 <div> 로 감싸고
  // 평소엔 <>{children}</> 로 렌더 → children 의 DOM 부모가 fragment↔div 로 바뀌며
  // React 가 페이지 전체를 매번 언마운트/리마운트 → 진입 시 "두 번(세 번) 로딩" 발생.
  // 애니메이션이 없을 땐 display:contents 로 레이아웃 박스를 없애 sticky/fixed 위치를 보존.
  return (
    <>
      <div className={animClass ?? undefined} style={animClass ? undefined : { display: 'contents' }}>
        {children}
      </div>
      <style jsx global>{`
        @keyframes pageSlideInRight {
          from { transform: translateX(100%); opacity: 0.4; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes pageSlideInLeft {
          from { transform: translateX(-100%); opacity: 0.4; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes pageFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .page-slide-in-right {
          animation: pageSlideInRight 0.4s cubic-bezier(0.22, 1, 0.36, 1);
        }
        .page-slide-in-left {
          animation: pageSlideInLeft 0.4s cubic-bezier(0.22, 1, 0.36, 1);
        }
        .page-fade-in {
          animation: pageFadeIn 0.3s ease;
        }
      `}</style>
    </>
  );
}

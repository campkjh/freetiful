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

function isDetailPath(path: string): boolean {
  return DETAIL_PATTERNS.some((p) => p.test(path));
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

  // 애니메이션 중이 아닐 때는 래퍼 없이 그대로 (sticky/fixed 위치 보장)
  if (animClass === null) {
    return <>{children}</>;
  }

  return (
    <>
      <div className={animClass}>
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

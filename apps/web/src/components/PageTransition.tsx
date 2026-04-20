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
  const [animClass, setAnimClass] = useState<string | null>(null);

  useEffect(() => {
    const prev = prevPath.current;
    if (prev !== null && prev !== pathname) {
      const prevDetail = isDetailPath(prev);
      const currDetail = isDetailPath(pathname);

      let cls: string | null = null;
      if (!prevDetail && currDetail) cls = 'page-slide-in-right';
      else if (prevDetail && !currDetail) cls = 'page-slide-in-left';
      // 메인↔메인(네비게이션 탭 전환)과 상세↔상세는 애니메이션 없음 (깜빡임 방지)

      if (cls) {
        setAnimClass(cls);
        const t = setTimeout(() => setAnimClass(null), 420);
        prevPath.current = pathname;
        return () => clearTimeout(t);
      }
      prevPath.current = pathname;
    }
    prevPath.current = pathname;
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

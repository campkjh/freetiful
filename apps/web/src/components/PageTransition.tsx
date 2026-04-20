'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';

// 네비게이션 바가 숨겨지는 상세 페이지 패턴 (layout.tsx와 동일)
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
  const [animClass, setAnimClass] = useState('');

  useEffect(() => {
    const prev = prevPath.current;
    if (prev !== null && prev !== pathname) {
      const prevDetail = isDetailPath(prev);
      const currDetail = isDetailPath(pathname);

      if (!prevDetail && currDetail) {
        // 메인 → 상세: 오른쪽에서 슬라이드 인
        setAnimClass('page-slide-in-right');
      } else if (prevDetail && !currDetail) {
        // 상세 → 메인: 왼쪽에서 슬라이드 인 (뒤로가기 느낌)
        setAnimClass('page-slide-in-left');
      } else if (prevDetail && currDetail) {
        // 상세 ↔ 상세: 페이드
        setAnimClass('page-fade-in');
      } else {
        // 메인 ↔ 메인: 페이드
        setAnimClass('page-fade-in');
      }

      // 애니메이션 후 클래스 제거
      const t = setTimeout(() => setAnimClass(''), 450);
      prevPath.current = pathname;
      return () => clearTimeout(t);
    }
    prevPath.current = pathname;
  }, [pathname]);

  return (
    <>
      <div key={pathname} className={animClass} style={{ willChange: 'transform, opacity' }}>
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
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
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

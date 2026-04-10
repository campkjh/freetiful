'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';

export default function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [current, setCurrent] = useState(children);
  const [prev, setPrev] = useState<React.ReactNode>(null);
  const [animating, setAnimating] = useState(false);
  const prevPathname = useRef(pathname);

  useEffect(() => {
    if (prevPathname.current !== pathname) {
      setPrev(current);
      setCurrent(children);
      setAnimating(true);
      prevPathname.current = pathname;
      const t = setTimeout(() => {
        setAnimating(false);
        setPrev(null);
      }, 350);
      return () => clearTimeout(t);
    } else {
      setCurrent(children);
    }
  }, [pathname, children]);

  return (
    <div className="relative" style={{ minHeight: '100vh' }}>
      {/* 이전 페이지 - 뒤로 밀려남 */}
      {animating && prev && (
        <div
          className="absolute inset-0"
          style={{
            animation: 'pageOut 0.35s ease forwards',
            zIndex: 0,
          }}
        >
          {prev}
        </div>
      )}

      {/* 현재 페이지 - 위에서 덮으며 올라옴 */}
      <div
        className="relative"
        style={{
          animation: animating ? 'pageIn 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards' : 'none',
          zIndex: 1,
        }}
      >
        {current}
      </div>
    </div>
  );
}

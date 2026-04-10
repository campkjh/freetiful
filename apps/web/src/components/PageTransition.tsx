'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';

export default function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [displayChildren, setDisplayChildren] = useState(children);
  const [transitioning, setTransitioning] = useState(false);
  const prevPathname = useRef(pathname);

  useEffect(() => {
    if (prevPathname.current !== pathname) {
      setTransitioning(true);
      const t = setTimeout(() => {
        setDisplayChildren(children);
        setTransitioning(false);
        prevPathname.current = pathname;
      }, 150);
      return () => clearTimeout(t);
    } else {
      setDisplayChildren(children);
    }
  }, [pathname, children]);

  return (
    <div
      style={{
        opacity: transitioning ? 0 : 1,
        transform: transitioning ? 'translateY(8px)' : 'translateY(0)',
        filter: transitioning ? 'blur(4px)' : 'blur(0)',
        transition: 'opacity 0.3s ease, transform 0.3s ease, filter 0.3s ease',
      }}
    >
      {displayChildren}
    </div>
  );
}

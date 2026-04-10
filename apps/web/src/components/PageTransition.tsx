'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';

export default function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [displayChildren, setDisplayChildren] = useState(children);
  const [sliding, setSliding] = useState(false);
  const prevPathname = useRef(pathname);

  useEffect(() => {
    if (prevPathname.current !== pathname) {
      setSliding(true);
      setDisplayChildren(children);
      prevPathname.current = pathname;
      const t = setTimeout(() => setSliding(false), 300);
      return () => clearTimeout(t);
    } else {
      setDisplayChildren(children);
    }
  }, [pathname, children]);

  return (
    <div
      style={{
        animation: sliding ? 'slideFromRight 0.3s ease-out forwards' : 'none',
      }}
    >
      {displayChildren}
    </div>
  );
}

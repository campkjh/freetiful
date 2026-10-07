'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { endPageView, startPageView } from '@/lib/page-view-track';

/** 페이지별 인사이트(261007) — 화면(경로)이 바뀔 때마다 조회 1건, 떠날 때 체류시간. 루트 레이아웃에 하나만 둔다 */
export default function PageViewTracker() {
  const pathname = usePathname();
  useEffect(() => {
    if (!pathname) return undefined;
    startPageView(pathname);
    return () => endPageView();
  }, [pathname]);
  return null;
}

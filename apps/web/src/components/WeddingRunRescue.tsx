'use client';

/**
 * 안드 앱 회전 튕김 구제(261018 사장 '웨딩런 가로로 돌린 다음 메인화면으로 튕긴다').
 * 안드 앱(2.0.7 이하)은 Manifest 에 configChanges 가 없어 폰을 돌리면 화면(Activity)이 새로 만들어지고 새 웹뷰가 홈(/main)을 연다.
 * 웨딩런은 화면에 있는 동안 1초마다 '살아 있음' 시각을 남기고(나가기 단추 · 화면 떠남이면 지움), 홈이 앱에서 '새 문서'로 막 열렸는데
 * 그 시각이 12초 안이면 웨딩런으로 되돌려 보낸다(게임은 첫 화면부터 — 이미 가로라 다시 튕기지 않는다).
 * 앱 새 빌드(configChanges + 마지막 주소 복원)가 퍼지면 필요 없다.
 */
import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';

export const WR_ALIVE_KEY = 'ft-wr-alive';
const WR_RESCUE_WINDOW_MS = 12_000;

/** 한 문서에서 한 번만 본다(홈을 오가는 다음 이동은 대상 아님) */
let checkedThisDocument = false;

export default function WeddingRunRescue() {
  const pathname = usePathname();
  const router = useRouter();
  useEffect(() => {
    if (checkedThisDocument || pathname !== '/main') return;
    checkedThisDocument = true;
    try {
      const w = window as unknown as { Android?: unknown; FreetifulAndroid?: unknown };
      if (!w.Android && !w.FreetifulAndroid) return;
      const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
      if (!nav || (nav.type !== 'navigate' && nav.type !== 'reload')) return;
      const at = Number(localStorage.getItem(WR_ALIVE_KEY) || 0);
      localStorage.removeItem(WR_ALIVE_KEY);
      if (at && Date.now() - at < WR_RESCUE_WINDOW_MS) router.replace('/wedding-run');
    } catch {
      /* 저장소 막힘 — 그대로 홈 */
    }
  }, [pathname, router]);
  return null;
}

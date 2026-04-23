'use client';

import { useEffect, useRef } from 'react';
import toast from 'react-hot-toast';

export default function UpdateNotifier() {
  const currentRef = useRef<string | null>(null);
  const notifiedRef = useRef(false);

  useEffect(() => {
    const check = async () => {
      if (notifiedRef.current) return;
      try {
        const res = await fetch(`/api/build-id?t=${Date.now()}`, {
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache, no-store', Pragma: 'no-cache' },
        });
        if (!res.ok) return;
        const data = await res.json();
        const buildId = data.buildId;
        if (!buildId) return;

        if (currentRef.current === null) {
          currentRef.current = buildId;
          return;
        }
        if (buildId !== currentRef.current) {
          notifiedRef.current = true;
          showUpdateToast();
        }
      } catch {}
    };

    const showUpdateToast = () => {
      toast.custom(
        (t) => (
          <div
            className="bg-white rounded-2xl shadow-xl border border-gray-100 px-4 py-3 flex items-center gap-3 max-w-[90vw]"
            style={{ opacity: t.visible ? 1 : 0, transform: t.visible ? 'translateY(0)' : 'translateY(-20px)', transition: 'all 0.3s' }}
          >
            <div className="w-9 h-9 rounded-full bg-[#3180F7]/10 flex items-center justify-center shrink-0">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3180F7" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 11-6.219-8.56"/></svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[14px] font-bold text-gray-900">새 버전이 배포되었습니다</p>
              <p className="text-[12px] text-gray-500">업데이트해주세요</p>
            </div>
            <button
              onClick={() => {
                toast.dismiss(t.id);
                const reload = () => window.location.reload();
                if (typeof caches !== 'undefined') {
                  caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k)))).finally(reload);
                } else {
                  reload();
                }
              }}
              className="bg-[#3180F7] text-white text-[13px] font-bold px-4 py-2 rounded-full active:scale-95 shrink-0"
            >
              업데이트
            </button>
          </div>
        ),
        { duration: Infinity, position: 'top-center' },
      );
    };

    check();
    const interval = setInterval(check, 30_000);

    const onVisibility = () => { if (document.visibilityState === 'visible') check(); };
    const onFocus = () => check();
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', onFocus);

    // 전역 트리거: window.showUpdateToast() 호출로 강제 표시 가능
    (window as any).__showUpdateToast = showUpdateToast;

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  return null;
}

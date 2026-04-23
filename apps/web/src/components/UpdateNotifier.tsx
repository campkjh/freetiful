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
          headers: { 'Cache-Control': 'no-cache, no-store' },
        });
        if (!res.ok) return;
        const { buildId } = await res.json();
        if (!buildId) return;
        if (currentRef.current === null) {
          currentRef.current = buildId;
          return;
        }
        if (buildId !== currentRef.current) {
          notifiedRef.current = true;
          toast(
            (t) => (
              <div className="flex items-center gap-3">
                <span className="text-[14px] font-semibold">새 버전이 배포되었습니다</span>
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
                  className="bg-[#3180F7] text-white text-[13px] font-bold px-3 py-1.5 rounded-full active:scale-95"
                >
                  업데이트
                </button>
              </div>
            ),
            { duration: Infinity, position: 'top-center' },
          );
        }
      } catch {}
    };

    check();
    const interval = setInterval(check, 30_000);

    // 앱이 포그라운드로 돌아올 때 즉시 체크
    const onVisibility = () => { if (document.visibilityState === 'visible') check(); };
    const onFocus = () => check();
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', onFocus);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  return null;
}

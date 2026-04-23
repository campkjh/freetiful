'use client';

import { useEffect } from 'react';
import toast from 'react-hot-toast';

export default function UpdateNotifier() {
  useEffect(() => {
    let currentBuildId: string | null = null;
    let notified = false;

    const check = async () => {
      try {
        const res = await fetch('/api/build-id', { cache: 'no-store' });
        if (!res.ok) return;
        const { buildId } = await res.json();
        if (!buildId) return;
        if (currentBuildId === null) {
          currentBuildId = buildId;
          return;
        }
        if (buildId !== currentBuildId && !notified) {
          notified = true;
          toast(
            (t) => (
              <div className="flex items-center gap-3">
                <span className="text-[14px] font-semibold">새 버전이 배포되었습니다</span>
                <button
                  onClick={() => { toast.dismiss(t.id); window.location.reload(); }}
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
    const t = setInterval(check, 60_000);
    return () => clearInterval(t);
  }, []);

  return null;
}

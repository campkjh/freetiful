'use client';

import { useEffect, useState } from 'react';
import { CloseIcon } from '@/components/icons/mono';

/**
 * 홈에서 사회자를 눌렀을 때 오른쪽에서 나오는 상세 화면.
 *
 * 예전엔 바로 상세페이지로 넘어가 홈이 통째로 사라졌다. PC 에선 홈을 그대로 둔 채
 * 오른쪽 패널에서 상세페이지 전체를 본다. 요약이 아니라 실제 /pros/[id] 를 띄우는데,
 * iframe 인 이유는 Tailwind 반응형이 '뷰포트' 기준이라 그냥 끼워 넣으면 PC 레이아웃이
 * 좁은 패널 안에서 깨지기 때문. iframe 은 제 뷰포트를 가져서 모바일 레이아웃 그대로 나온다.
 * (모바일은 화면이 좁아 예전처럼 상세페이지로 이동한다)
 */
export type QuickViewPro = { id: string; name: string };

export default function ProQuickView({ pro, onClose }: { pro: QuickViewPro | null; onClose: () => void }) {
  const open = Boolean(pro);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => { setLoaded(false); }, [pro?.id]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <>
      <div
        onClick={onClose}
        className={`fixed inset-0 z-[60] hidden bg-black/30 transition-opacity duration-300 lg:block ${
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        aria-hidden={!open}
      />
      <aside
        className={`fixed right-0 top-0 z-[61] hidden h-full w-[440px] max-w-[94vw] flex-col overflow-hidden bg-white shadow-[-12px_0_40px_rgba(15,23,42,0.14)] transition-transform duration-300 ease-out lg:flex ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
        aria-hidden={!open}
      >
        {pro && (
          <>
            <button
              type="button"
              onClick={onClose}
              aria-label="닫기"
              className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-[#51535C] shadow-[0_4px_16px_rgba(15,23,42,0.12)] backdrop-blur transition-colors hover:bg-white"
            >
              <CloseIcon size={18} />
            </button>

            {!loaded && (
              <div className="absolute inset-0 flex items-center justify-center bg-white">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#E9EBEF] border-t-[#A4ABBA]" />
              </div>
            )}

            {/* 상세페이지 전체 — 좁은 뷰포트라 모바일 레이아웃 그대로 나온다 */}
            <iframe
              key={pro.id}
              src={`/pros/${pro.id}`}
              title={`사회자 ${pro.name} 상세`}
              className="h-full w-full border-0"
              onLoad={() => setLoaded(true)}
            />
          </>
        )}
      </aside>
    </>
  );
}

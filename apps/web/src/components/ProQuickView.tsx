'use client';

import { useEffect, useRef, useState } from 'react';
import { CloseIcon } from '@/components/icons/mono';

/**
 * 홈에서 사회자를 눌렀을 때 오른쪽에서 나오는 상세 화면.
 *
 * 예전엔 바로 상세페이지로 넘어가 홈이 통째로 사라졌다. PC 에선 홈을 그대로 둔 채
 * 오른쪽 패널에서 상세페이지 전체를 본다. 요약이 아니라 실제 /pros/[id] 를 띄우는데,
 * iframe 인 이유는 Tailwind 반응형이 '뷰포트' 기준이라 그냥 끼워 넣으면 PC 레이아웃이
 * 좁은 패널 안에서 깨지기 때문. iframe 은 제 뷰포트를 가져서 모바일 레이아웃 그대로 나온다.
 *
 * 속도 — 클릭하고 나서 불러오면 1초쯤 흰 화면을 보게 된다. 그래서 카드에 마우스를
 * 올리는 순간 뒤에서 미리 띄워 두고(preloadId), 클릭 때는 이미 그려진 걸 밀어 올린다.
 * 여는 동안 카드에 있던 사진·이름을 먼저 깔아 빈 화면을 없앴다.
 * (모바일은 화면이 좁아 예전처럼 상세페이지로 이동한다)
 */
export type QuickViewPro = { id: string; name: string; image?: string };

export default function ProQuickView({
  pro,
  preloadId,
  onClose,
}: {
  pro: QuickViewPro | null;
  /** 마우스를 올린 사회자 — 열기 전에 미리 받아 둔다 */
  preloadId?: string | null;
  onClose: () => void;
}) {
  const open = Boolean(pro);
  const [loadedId, setLoadedId] = useState<string | null>(null);
  // 패널이 열려 있는 동안에는 다른 카드에 마우스가 지나가도 내용이 바뀌면 안 된다
  const targetRef = useRef<string | null>(null);
  if (pro) targetRef.current = pro.id;
  else if (preloadId) targetRef.current = preloadId;
  const target = targetRef.current;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const ready = Boolean(target && loadedId === target);

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
        <button
          type="button"
          onClick={onClose}
          aria-label="닫기"
          className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-[#51535C] shadow-[0_4px_16px_rgba(15,23,42,0.12)] backdrop-blur transition-colors hover:bg-white"
        >
          <CloseIcon size={18} />
        </button>

        {/* 아직 다 못 받았을 때 — 카드에 있던 사진을 먼저 깔아 흰 화면을 없앤다 */}
        {!ready && (
          <div className="absolute inset-0 bg-white">
            {pro?.image && (
              <img src={pro.image} alt="" className="h-[46%] w-full object-cover opacity-90" />
            )}
            <div className="px-5 pt-5">
              {pro?.name && <div className="text-[20px] font-bold text-[#2B313D]">사회자 {pro.name}</div>}
              <div className="mt-4 h-3 w-2/3 animate-pulse rounded-full bg-[#F2F3F5]" />
              <div className="mt-2 h-3 w-1/2 animate-pulse rounded-full bg-[#F2F3F5]" />
            </div>
          </div>
        )}

        {/* 상세페이지 전체 — 좁은 뷰포트라 모바일 레이아웃 그대로 나온다 */}
        {target && (
          <iframe
            key={target}
            src={`/pros/${target}`}
            title="사회자 상세"
            className={`h-full w-full border-0 transition-opacity duration-200 ${ready ? 'opacity-100' : 'opacity-0'}`}
            onLoad={() => setLoadedId(target)}
          />
        )}
      </aside>
    </>
  );
}

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CloseIcon, ChevronLeftIcon, ChevronRightIcon, PinLocationIcon, StarIcon, MicIcon } from '@/components/icons/mono';

/**
 * 홈에서 사회자를 눌렀을 때 오른쪽에서 나오는 미리보기.
 *
 * 예전엔 바로 상세페이지로 넘어가 홈이 통째로 사라졌다. PC 에선 홈을 그대로 둔 채
 * 사진·경력·태그·소개만 훑어보고, 더 볼 때만 상세로 넘어가게 한다.
 * (모바일은 화면이 좁아 예전처럼 상세페이지로 이동한다)
 */
export type QuickViewPro = {
  id: string;
  name: string;
  image: string;
  images: string[];
  intro: string;
  price: number;
  experience: number;
  tags: string[];
  regions: string[];
  languages: string[];
  isNationwide: boolean;
  avgRating?: number;
  reviewCount?: number;
  isPartner?: boolean;
};

export default function ProQuickView({ pro, onClose }: { pro: QuickViewPro | null; onClose: () => void }) {
  const open = Boolean(pro);
  const [shot, setShot] = useState(0);

  useEffect(() => { setShot(0); }, [pro?.id]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const shots = pro ? (pro.images.length > 0 ? pro.images : [pro.image]).slice(0, 6) : [];
  const region = pro ? (pro.isNationwide ? '전국 가능' : pro.regions.slice(0, 3).join(' · ')) : '';

  return (
    <>
      <div
        onClick={onClose}
        className={`fixed inset-0 z-[60] hidden bg-black/25 transition-opacity duration-300 lg:block ${
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        aria-hidden={!open}
      />
      <aside
        className={`fixed right-0 top-0 z-[61] hidden h-full w-[420px] max-w-[92vw] flex-col bg-white shadow-[-12px_0_40px_rgba(15,23,42,0.12)] transition-transform duration-300 ease-out lg:flex ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
        aria-hidden={!open}
      >
        {pro && (
          <>
            <div className="flex h-[64px] shrink-0 items-center justify-between px-5">
              <span className="text-[15px] font-bold text-[#2B313D]">사회자 미리보기</span>
              <button
                type="button"
                onClick={onClose}
                aria-label="미리보기 닫기"
                className="flex h-9 w-9 items-center justify-center rounded-full text-[#A4ABBA] transition-colors hover:bg-[#F2F3F5] hover:text-[#2B313D]"
              >
                <CloseIcon size={18} />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">
              {/* 사진 */}
              <div className="relative overflow-hidden rounded-[24px] bg-[#F2F3F5]" style={{ aspectRatio: '4 / 3' }}>
                <div
                  className="flex h-full"
                  style={{
                    width: `${shots.length * 100}%`,
                    transform: `translateX(-${shot * (100 / shots.length)}%)`,
                    transition: 'transform 0.45s cubic-bezier(0.22, 1, 0.36, 1)',
                  }}
                >
                  {shots.map((src, i) => (
                    <img
                      key={`${src}-${i}`}
                      src={src}
                      alt=""
                      className="h-full object-cover"
                      style={{ width: `${100 / shots.length}%` }}
                      loading={i === 0 ? undefined : 'lazy'}
                    />
                  ))}
                </div>
                {shots.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={() => setShot((v) => Math.max(0, v - 1))}
                      disabled={shot === 0}
                      aria-label="이전 사진"
                      className="absolute left-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-[#51535C] backdrop-blur transition hover:bg-white disabled:opacity-0"
                    >
                      <ChevronLeftIcon size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setShot((v) => Math.min(shots.length - 1, v + 1))}
                      disabled={shot >= shots.length - 1}
                      aria-label="다음 사진"
                      className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-[#51535C] backdrop-blur transition hover:bg-white disabled:opacity-0"
                    >
                      <ChevronRightIcon size={16} />
                    </button>
                    <div className="absolute bottom-3 right-3 rounded-full bg-black/35 px-2.5 py-1 text-[11px] font-medium text-white">
                      {shot + 1} / {shots.length}
                    </div>
                  </>
                )}
              </div>

              {/* 이름 */}
              <div className="mt-4 flex items-center gap-2">
                {pro.isPartner && (
                  <span className="rounded-full bg-[#EAF2FF] px-2 py-[3px] text-[10px] font-bold text-[#3180F7]">Partners</span>
                )}
                <h3 className="text-[20px] font-bold tracking-tight text-[#2B313D]">사회자 {pro.name}</h3>
              </div>

              {/* 요약 지표 */}
              <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px] text-[#51535C]">
                {pro.avgRating ? (
                  <span className="flex items-center gap-1 font-semibold">
                    <StarIcon size={14} className="text-[#FFB020]" />
                    {pro.avgRating.toFixed(1)}
                    <span className="font-medium text-[#A4ABBA]">({pro.reviewCount || 0})</span>
                  </span>
                ) : null}
                {pro.experience > 0 && (
                  <span className="flex items-center gap-1.5">
                    <MicIcon size={14} className="text-[#C8CEDA]" />
                    경력 {pro.experience}년
                  </span>
                )}
                {region && (
                  <span className="flex items-center gap-1.5">
                    <PinLocationIcon size={14} className="text-[#C8CEDA]" />
                    {region}
                  </span>
                )}
              </div>

              {/* 태그 */}
              {pro.tags.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {pro.tags.slice(0, 8).map((tag) => (
                    <span key={tag} className="rounded-[6px] bg-[#F2F3F5] px-2 py-1 text-[11px] font-medium text-[#51535C]">
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              {/* 소개 */}
              {pro.intro && (
                <p className="mt-4 whitespace-pre-line text-[13.5px] leading-6 text-[#51535C]">{pro.intro}</p>
              )}

              {pro.languages.length > 0 && (
                <p className="mt-4 text-[12px] text-[#A4ABBA]">가능 언어 · {pro.languages.join(', ')}</p>
              )}
            </div>

            <div className="shrink-0 border-t border-gray-100 p-4">
              {pro.price > 0 && (
                <p className="mb-2.5 text-center text-[13px] text-[#A4ABBA]">
                  <b className="text-[15px] font-bold text-[#2B313D]">{pro.price.toLocaleString()}원</b> 부터
                </p>
              )}
              <Link
                href={`/pros/${pro.id}`}
                onClick={onClose}
                className="flex h-12 w-full items-center justify-center rounded-[14px] bg-[#3180F7] text-[15px] font-bold text-white transition-colors hover:bg-[#2470E6] active:scale-[0.98]"
              >
                상세페이지에서 문의하기
              </Link>
            </div>
          </>
        )}
      </aside>
    </>
  );
}

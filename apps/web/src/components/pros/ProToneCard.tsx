'use client';

// 사회자 '사진 색 카드' — 홈 사회자 카드(main/page.tsx ProCard)와 같은 모양을 사회자 목록 PC(/pros)에서도 쓴다
// (260928 사장 'PC 결혼식·행사 사회자 페이지 카드를 지금 톤앤매너로').
//  카드 바탕·테두리 = 프로필 사진에서 뽑은 색(lib/image-tone), 사진(4:5) 아래쪽이 그 색으로 녹아 이어진다.
//  왼쪽 위 경력 배지(검은 반투명 유리) · 이름 17 굵게 + 파트너 체크 · 한 줄 정보(★ 평점 (리뷰) | 지역) · 소개 한 줄 · 흰 반투명 칩(한 줄만).
//  PC 는 누르면 페이지를 떠나지 않고 오른쪽 미리보기(onQuickView), 모바일·새 탭은 상세로 이동.
import type { CSSProperties } from 'react';
import Link from 'next/link';
import { discoveryApi } from '@/lib/api/discovery.api';
import { useImageTone } from '@/lib/image-tone';

export type ProToneCardData = {
  id: string;
  name: string;
  image: string;
  /** 경력(년) — 0 이면 배지 없음 */
  experience: number;
  isPartner?: boolean;
  rating: number;
  reviews: number;
  /** 짧은 지역 이름('전국' · '수도권' …) */
  region: string;
  intro: string;
  tags: string[];
};

/** 사진 아래쪽을 카드 바탕색으로 녹여 이어지게(마스크) — 58% 까지 그대로, 끝에서 완전히 투명 */
const PRO_CARD_FADE = 'linear-gradient(to bottom, #000 0%, #000 58%, rgba(0,0,0,.4) 82%, transparent 100%)';

const GLASS: CSSProperties = {
  backgroundColor: 'rgba(0, 0, 0, 0.36)',
  WebkitBackdropFilter: 'blur(10px) saturate(140%)',
  backdropFilter: 'blur(10px) saturate(140%)',
  boxShadow: 'inset 0 0 0 0.5px rgba(255, 255, 255, 0.18)',
};

export default function ProToneCard({
  pro,
  index = 0,
  className = '',
  style,
  onQuickView,
  onPreload,
}: {
  pro: ProToneCardData;
  index?: number;
  className?: string;
  style?: CSSProperties;
  onQuickView?: (pro: ProToneCardData) => void;
  onPreload?: (proId: string) => void;
}) {
  const image = pro.image || '/images/default-profile.png';
  const tone = useImageTone(image);
  const sub = tone?.sub || '#6B7684';
  return (
    <Link
      href={`/pros/${pro.id}`}
      onTouchStart={() => discoveryApi.getProDetail(pro.id).catch(() => {})}
      onMouseEnter={() => {
        discoveryApi.getProDetail(pro.id).catch(() => {});
        if (typeof window !== 'undefined' && window.innerWidth >= 1024) onPreload?.(pro.id);
      }}
      onClick={(e) => {
        // PC 는 목록을 두고 오른쪽 미리보기로(새 탭·수정키 클릭은 그대로 링크)
        if (!onQuickView || typeof window === 'undefined' || window.innerWidth < 1024) return;
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        onQuickView(pro);
      }}
      className={`group card-press block h-full overflow-hidden rounded-[20px] border ${className}`}
      style={{
        backgroundColor: tone?.bg || '#F2F4F6',
        borderColor: tone?.line || '#EAEDF0',
        transition: 'background-color .5s ease, border-color .5s ease',
        ...style,
      }}
    >
      <div className="relative overflow-hidden" style={{ aspectRatio: '4 / 5' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={image}
          alt={pro.name}
          loading={index < 10 ? 'eager' : 'lazy'}
          decoding="async"
          className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
          style={{ objectPosition: 'center 20%', WebkitMaskImage: PRO_CARD_FADE, maskImage: PRO_CARD_FADE }}
          onError={(e) => {
            // 한 번은 잠깐 뒤 다시 받아 보고(일시적 실패), 그래도 안 되면 기본 사진
            const el = e.currentTarget;
            if (el.dataset.fb) return;
            const base = (pro.image || '').split('?')[0];
            if (!el.dataset.retry && base) {
              el.dataset.retry = '1';
              window.setTimeout(() => { el.src = `${base}?r=1`; }, 500);
            } else {
              el.dataset.fb = '1';
              el.src = '/images/default-profile.png';
            }
          }}
        />
        {pro.experience > 0 && (
          <span className="absolute left-2.5 top-2.5 inline-flex h-[26px] items-center rounded-[8px] px-2 text-[12.5px] font-bold tracking-[-0.2px] text-white" style={GLASS}>
            경력 {pro.experience}년
          </span>
        )}
      </div>
      <div className="relative -mt-3 px-3.5 pb-3.5">
        <p className="flex items-center gap-1 break-keep text-[17px] font-bold leading-[1.4] tracking-[-0.4px] text-[#191F28]">
          <span className="min-w-0 truncate">{pro.name}</span>
          {pro.isPartner && (
            <svg width="15" height="15" viewBox="0 0 24 24" className="shrink-0" aria-label="프리티풀 파트너">
              <path d="M12 1.8l2.6 1.9 3.2-.1 1 3.1 2.6 1.9-1 3.1 1 3.1-2.6 1.9-1 3.1-3.2-.1L12 22.2l-2.6-1.9-3.2.1-1-3.1-2.6-1.9 1-3.1-1-3.1 2.6-1.9 1-3.1 3.2.1z" fill="#3182F6" />
              <path d="M8.2 12.2l2.5 2.5 5-5.2" stroke="#fff" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </p>
        <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-[13px] leading-[1.5] tracking-[-0.2px]" style={{ color: sub }}>
          {pro.reviews > 0 ? (
            <span className="inline-flex items-center gap-[3px]">
              <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true" className="shrink-0">
                <path d="M12 2.8l2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 16.6l-5.4 2.9 1.1-6.1-4.5-4.2 6.1-.8z" fill="currentColor" />
              </svg>
              {Number(pro.rating || 0).toFixed(1)} ({pro.reviews})
            </span>
          ) : (
            <span>새로 온 사회자</span>
          )}
          {pro.region && (
            <>
              <span aria-hidden="true" className="h-2.5 w-px" style={{ backgroundColor: sub, opacity: 0.35 }} />
              <span>{pro.region}</span>
            </>
          )}
        </p>
        {pro.intro && (
          <p className="mt-0.5 line-clamp-1 break-all text-[13px] leading-[1.65] tracking-[-0.2px]" style={{ color: sub }}>{pro.intro}</p>
        )}
        {pro.tags.length > 0 && (
          <div className="mt-2.5 flex h-[26px] flex-wrap gap-1 overflow-hidden">
            {pro.tags.slice(0, 3).map((tag) => (
              <span key={tag} className="flex h-[26px] items-center whitespace-nowrap rounded-[8px] bg-white/60 px-2 text-[12.5px] font-semibold tracking-[-0.2px] text-[#333D4B]">{tag}</span>
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}

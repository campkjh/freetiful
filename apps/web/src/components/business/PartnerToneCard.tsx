'use client';

// 웨딩 파트너 '사진 색 카드'(가로형) — 홈 웨딩파트너 섹션과 웨딩파트너 목록(/businesses)이 같이 쓴다
// (260926 사장 "웨딩홀·드레스도 사회자 카드처럼, 다만 가로형" → "목록 카드도 홈 웨딩파트너 카드처럼").
import { useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { useImageTone } from '@/lib/image-tone';
import { PinLocationIcon } from '@/components/icons/mono';

export type PartnerToneCardData = {
  id: string;
  name: string;
  /** 지역(주소 첫 단어) */
  location: string;
  /** 첫 장이 대표 사진 */
  images: string[];
  /** 사진 총 장수(없으면 images 길이) */
  photoCount?: number;
  tags: string[];
  discountPercent?: number;
};

/** 업체 사진 아래쪽을 카드 색으로 녹인다(가로 사진이라 절반부터) */
const BIZ_CARD_FADE = 'linear-gradient(to bottom, #000 0%, #000 50%, rgba(0,0,0,.4) 78%, transparent 100%)';

/**
 * 웨딩 파트너 카드(웨딩홀·드레스·스튜디오…) — 홈 사회자 카드와 같은 '사진 색 카드'를 가로형으로(260926 사장 "사회자 카드처럼, 다만 가로형으로").
 *  바탕·테두리 = 대표 사진에서 뽑은 색(lib/image-tone 'scene' — 외부 블로그 사진은 API 가 대신 뽑는다),
 *  가로로 넓은 사진(16:9) 아래쪽이 그 색으로 녹아 이어진다. 이름 17 굵게 · 한 줄 정보(지역 | 사진 N장) · 흰 반투명 칩(한 줄만).
 *  할인율이 실제로 있을 때만 왼쪽 위 검은 반투명 유리 배지. 옛 알약 사진 더미·4초 넘김은 뺐다(사진 한 장이 색 카드의 주인공).
 */
export default function PartnerToneCard({
  biz,
  index = 0,
  wrapperClassName,
  wrapperStyle,
}: {
  biz: PartnerToneCardData;
  index?: number;
  /** 가로열의 한 칸. 카드가 렌더되지 않을 땐 이 칸도 같이 사라져야 빈칸이 안 남는다 */
  wrapperClassName?: string;
  wrapperStyle?: CSSProperties;
}) {
  const [hidden, setHidden] = useState(false);
  const image = biz.images[0];
  const tone = useImageTone(image, 'scene');
  const sub = tone?.sub || '#6B7684';

  if (hidden || !image) return null;

  const chips = Array.from(new Set(biz.tags.filter((tag) => tag && tag !== '인기')));
  const photoCount = biz.photoCount ?? biz.images.length;
  const card = (
    <Link
      href={`/businesses/${biz.id}`}
      className="group block h-full overflow-hidden rounded-[20px] border"
      style={{
        backgroundColor: tone?.bg || '#F2F4F6',
        borderColor: tone?.line || '#EAEDF0',
        transition: 'background-color .5s ease, border-color .5s ease',
      }}
    >
      <div className="relative w-full overflow-hidden" style={{ aspectRatio: '16 / 9' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={image}
          alt={biz.name}
          loading={index < 2 ? 'eager' : 'lazy'}
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
          style={{ WebkitMaskImage: BIZ_CARD_FADE, maskImage: BIZ_CARD_FADE }}
          onError={() => setHidden(true)}
        />
        {(biz.discountPercent ?? 0) > 0 && (
          <span
            className="absolute left-2.5 top-2.5 inline-flex h-[26px] items-center rounded-[8px] px-2 text-[12.5px] font-bold tracking-[-0.2px] text-white"
            style={{ backgroundColor: 'rgba(0, 0, 0, 0.36)', WebkitBackdropFilter: 'blur(10px) saturate(140%)', backdropFilter: 'blur(10px) saturate(140%)', boxShadow: 'inset 0 0 0 0.5px rgba(255, 255, 255, 0.18)' }}
          >
            {biz.discountPercent}% 할인
          </span>
        )}
      </div>
      <div className="relative -mt-4 px-4 pb-4">
        <p className="break-keep text-[17px] font-bold leading-[1.4] tracking-[-0.4px] text-[#191F28]">{biz.name}</p>
        <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-[13px] leading-[1.5] tracking-[-0.2px]" style={{ color: sub }}>
          <span className="inline-flex items-center gap-[3px]">
            <PinLocationIcon size={13} className="shrink-0" />
            {biz.location}
          </span>
          {photoCount > 1 && (
            <>
              <span aria-hidden="true" className="h-2.5 w-px" style={{ backgroundColor: sub, opacity: 0.35 }} />
              <span>사진 {photoCount}장</span>
            </>
          )}
        </p>
        {/* 칩 — 흰 반투명, 한 줄 높이만(넘치는 칩은 통째로 가려진다) · '인기' 는 노출하지 않는다 */}
        {chips.length > 0 && (
          <div className="mt-2.5 flex h-[26px] flex-wrap gap-1 overflow-hidden">
            {chips.map((tag) => (
              <span key={tag} className="flex h-[26px] items-center whitespace-nowrap rounded-[8px] bg-white/60 px-2 text-[12.5px] font-semibold tracking-[-0.2px] text-[#333D4B]">{tag}</span>
            ))}
          </div>
        )}
      </div>
    </Link>
  );

  if (!wrapperClassName && !wrapperStyle) return card;
  return <div className={wrapperClassName} style={wrapperStyle}>{card}</div>;
}

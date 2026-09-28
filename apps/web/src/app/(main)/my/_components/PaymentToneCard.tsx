'use client';

// 구매·결제내역 카드 — 홈 웨딩파트너 '사진 색 카드'(PartnerToneCard, 빌라드지디 카드)와 같은 결
// (260928 사장 "구매내역 카드 디자인을 가로형 빌라드지디 카드처럼, 사회자 사진 넣어줘" · "결제/환불내역도 동일하게").
//  · 위 = 사회자 사진 16:9(얼굴이 보이게 위쪽 기준으로 자름), 아래쪽이 사진에서 뽑은 색으로 녹아 글씨 칸으로 이어진다.
//  · 바탕·테두리 = 사진 색(lib/image-tone 'portrait' — 홈 사회자 카드와 같은 계산), 상태 = 사진 왼쪽 위 검은 반투명 유리 배지(색 점).
//  · 사진이 없거나 깨지면 회색 칸에 이름 첫 글자.
import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useImageTone } from '@/lib/image-tone';

const PHOTO_FADE = 'linear-gradient(to bottom, #000 0%, #000 50%, rgba(0,0,0,.4) 78%, transparent 100%)';

export type PaymentToneRow = { label: ReactNode; value: ReactNode; tone?: 'default' | 'danger' };

export default function PaymentToneCard({
  href,
  image,
  name,
  badge,
  meta,
  rows,
  footer,
  index = 0,
}: {
  href?: string;
  image?: string | null;
  name: string;
  badge: { label: string; dot: string };
  /** 이름 아래 한 줄(날짜 | 서비스 등) */
  meta: ReactNode[];
  /** 금액 줄(결제금액·환불금액) */
  rows: PaymentToneRow[];
  footer?: ReactNode;
  index?: number;
}) {
  const [broken, setBroken] = useState(false);
  const photo = image && !broken ? image : null;
  const tone = useImageTone(photo || undefined, 'portrait');
  const sub = tone?.sub || '#6B7684';

  const body = (
    <>
      <div className="relative w-full overflow-hidden" style={{ aspectRatio: '16 / 9' }}>
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photo}
            alt={name}
            loading={index < 2 ? 'eager' : 'lazy'}
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
            style={{ objectPosition: '50% 24%', WebkitMaskImage: PHOTO_FADE, maskImage: PHOTO_FADE }}
            onError={() => setBroken(true)}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-[44px] font-bold text-[#C9CED6]" style={{ WebkitMaskImage: PHOTO_FADE, maskImage: PHOTO_FADE }}>
            {name.slice(0, 1) || '·'}
          </div>
        )}
        <span
          className="absolute left-2.5 top-2.5 inline-flex h-[26px] items-center gap-1.5 rounded-[8px] px-2 text-[12.5px] font-bold tracking-[-0.2px] text-white"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.36)', WebkitBackdropFilter: 'blur(10px) saturate(140%)', backdropFilter: 'blur(10px) saturate(140%)', boxShadow: 'inset 0 0 0 0.5px rgba(255, 255, 255, 0.18)' }}
        >
          <span aria-hidden className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: badge.dot }} />
          {badge.label}
        </span>
      </div>
      <div className="relative -mt-4 px-4 pb-4">
        <p className="truncate text-[17px] font-bold leading-[1.4] tracking-[-0.4px] text-[#191F28]">{name}</p>
        {meta.length > 0 && (
          <p className="mt-1 flex min-w-0 items-center gap-x-1.5 text-[13px] leading-[1.5] tracking-[-0.2px]" style={{ color: sub }}>
            {meta.map((m, i) => (
              <span key={i} className={`flex min-w-0 items-center gap-x-1.5 ${i === meta.length - 1 ? 'truncate' : 'shrink-0'}`}>
                {i > 0 && <span aria-hidden="true" className="h-2.5 w-px shrink-0" style={{ backgroundColor: sub, opacity: 0.35 }} />}
                <span className={i === meta.length - 1 ? 'truncate' : ''}>{m}</span>
              </span>
            ))}
          </p>
        )}
        {rows.length > 0 && (
          <div className="mt-3 space-y-1 rounded-[12px] bg-white/60 px-3 py-2.5">
            {rows.map((r, i) => (
              <div key={i} className="flex items-center justify-between gap-3">
                <span className={`text-[13px] tracking-[-0.2px] ${r.tone === 'danger' ? 'text-[#F04452]' : 'text-[#4E5968]'}`}>{r.label}</span>
                <span className={`text-[16px] font-bold tabular-nums tracking-[-0.3px] ${r.tone === 'danger' ? 'text-[#F04452]' : 'text-[#191F28]'}`}>{r.value}</span>
              </div>
            ))}
          </div>
        )}
        {footer}
      </div>
    </>
  );

  const className = 'group block overflow-hidden rounded-[20px] border';
  const style = {
    backgroundColor: tone?.bg || '#F2F4F6',
    borderColor: tone?.line || '#EAEDF0',
    transition: 'background-color .5s ease, border-color .5s ease',
  };
  return href ? (
    <Link href={href} className={`${className} transition-transform duration-200 active:scale-[0.99]`} style={style}>{body}</Link>
  ) : (
    <div className={className} style={style}>{body}</div>
  );
}

/** 헤더 거르기 메뉴 아이콘(토스 mono, 채팅 목록과 같은 24) */
export function TossMenuIcon({ name }: { name: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={`/icons/toss/${name}.svg`} alt="" width={24} height={24} className="h-6 w-6" />;
}

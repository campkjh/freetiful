'use client';

// 리뷰 한 줄 — 웨딩숲 댓글(.tcm) 계층(260926 사장 "리뷰를 댓글처럼", "상세 리뷰 카드도 모달처럼").
//  · 목록 리뷰 시트(ProReviewsSheet)·사회자 상세 '전체 리뷰'·상세 위쪽 흘러가는 리뷰 카드가 같이 쓴다.
//  · 프사 36 · 이름 15 굵게 + 별 · 본문 16 · 사진 · 회색 시간 13.5, 사회자 답글은 한 칸 들여 프사 28 + '사회자' 표시.
//  · compact = 흘러가는 카드용(프사 28 · 본문 14.5 세 줄 · 사진·답글 없음).
import type { ReactNode } from 'react';
import { getProfileImageUrl } from '@/lib/default-profile';
import { formatRelativeTime } from '@/lib/relativeTime';

export type ReviewRowData = {
  id: string;
  name: string;
  avatar?: string | null;
  rating: number;
  /** 원본 시각 — 있으면 '방금·N시간 전·날짜', 없으면 date 문자열 그대로 */
  createdAt?: string;
  date?: string;
  content: string;
  photos?: string[];
  proReply?: { content: string; at?: string; date?: string };
};

export type ReviewRowPro = { id: string; name: string; image?: string };

export function ReviewStars({ value, size = 13 }: { value: number; size?: number }) {
  const full = Math.round(value);
  return (
    <span className="inline-flex items-center gap-px" aria-label={`별점 ${value.toFixed(1)}`}>
      {[0, 1, 2, 3, 4].map((i) => (
        <svg key={i} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 2.8l2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 16.6l-5.4 2.9 1.1-6.1-4.5-4.2 6.1-.8z" fill={i < full ? '#FFC933' : '#E5E8EB'} />
        </svg>
      ))}
    </span>
  );
}

export function reviewWhen(at?: string, fallback?: string) {
  const t = at ? formatRelativeTime(at) : '';
  return t || fallback || '';
}

export default function ReviewCommentRow({
  review,
  pro,
  first = false,
  menu,
  compact = false,
}: {
  review: ReviewRowData;
  pro: ReviewRowPro;
  first?: boolean;
  /** 이름 줄 오른쪽(⋯ 신고·차단 메뉴 등) */
  menu?: ReactNode;
  compact?: boolean;
}) {
  const photos = review.photos || [];
  return (
    <div className={compact ? '' : `py-4 ${first ? '' : 'border-t border-[#F2F4F6]'}`}>
      <div className={`flex ${compact ? 'gap-2' : 'gap-2.5'}`}>
        <div className={`shrink-0 overflow-hidden rounded-full bg-[#F2F4F6] ${compact ? 'h-7 w-7' : 'h-9 w-9'}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={getProfileImageUrl(review.avatar, review.id)} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className={`flex flex-wrap items-center gap-x-1.5 gap-y-1 ${compact ? 'min-h-[28px]' : 'min-h-[20px]'}`}>
              <span className={`font-bold tracking-[-0.2px] text-[#333D4B] ${compact ? 'text-[14px]' : 'text-[15px]'}`}>{review.name}</span>
              {review.rating > 0 && <ReviewStars value={review.rating} size={compact ? 12 : 13} />}
            </div>
            {menu}
          </div>
          {review.content && (
            <p
              className={`whitespace-pre-wrap break-words tracking-[-0.2px] text-[#191F28] [overflow-wrap:anywhere] ${
                compact ? 'mt-1 line-clamp-3 text-[14.5px] leading-[1.55]' : 'mt-1 text-[16px] leading-[1.6]'
              }`}
            >
              {review.content}
            </p>
          )}
          {!compact && photos.length > 0 && (
            <div className="mt-2.5 flex gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {photos.slice(0, 6).map((src, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={src + i} src={src} alt="" loading="lazy" decoding="async" className="h-[84px] w-[84px] shrink-0 rounded-[12px] bg-[#F2F4F6] object-cover" />
              ))}
            </div>
          )}
          <p className={`tracking-[-0.2px] text-[#8B95A1] ${compact ? 'mt-1 text-[12.5px]' : 'mt-1.5 text-[13.5px]'}`}>
            {reviewWhen(review.createdAt, review.date)}
          </p>

          {/* 사회자 답글 — 한 칸 들여(프사 28) */}
          {!compact && review.proReply && (
            <div className="mt-3 flex gap-2">
              <div className="h-7 w-7 shrink-0 overflow-hidden rounded-full bg-[#F2F4F6]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={getProfileImageUrl(pro.image, pro.id)} alt="" loading="lazy" className="h-full w-full object-cover" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-[14.5px] font-bold tracking-[-0.2px] text-[#333D4B]">{pro.name}</span>
                  <span className="inline-flex h-5 items-center rounded-[5px] bg-[#E8F3FF] px-1.5 text-[12px] font-bold text-[#3182F6]">사회자</span>
                </div>
                <p className="mt-0.5 whitespace-pre-wrap break-words text-[15px] leading-[1.6] tracking-[-0.2px] text-[#191F28]">{review.proReply.content}</p>
                <p className="mt-1 text-[13px] text-[#8B95A1]">{reviewWhen(review.proReply.at, review.proReply.date)}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

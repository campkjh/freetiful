'use client';

// 사회자 한 줄 카드 — 사회자 목록(/pros)과 홈 남성·여성·외국어 사회자 탭이 같이 쓴다
// (260926 사장 "홈 리스트도 결혼식 사회자 리스트 페이지랑 똑같이"). 카드 모양은 아래 ProFeedCard 설명 참고.
import { useRef } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { discoveryApi, type ProListItem } from '@/lib/api/discovery.api';
import { TossCommentIcon, TossShareIcon } from '@/components/community/TossIcons';

/** 등장 효과 지연을 몇 장 단위로 되풀이할지(목록이 10장씩 이어 그려진다) */
const STAGGER_GROUP = 10;

/** 사회자 전체 목록(리뷰순) — /pros 와 홈 탭이 같은 값으로 불러 캐시를 같이 쓴다(키 순서까지 같아야 한다) */
export const PRO_FEED_LIST_PARAMS = { limit: 500, sort: 'reviews' as const, withTotal: true };

export interface ProFeedItem {
  id: string;
  name: string;
  categories: string[];
  regions: string[];
  languages: string[];
  isNationwide: boolean;
  rating: number;
  reviews: number;
  rank: number;
  image: string;
  intro: string;
  price: number;
  experience: number;
  tags: string[];
  /** 'male'·'female' 또는 '남성'·'여성'(가입 시기마다 표기가 다름) · 빈 값 */
  gender: string;
  /** 포트폴리오 사진(목록 API 최대 4장, 첫 장은 보통 프로필) */
  images: string[];
  /** 소개 영상 — 여러 개면 줄바꿈으로 이어 붙어 온다 */
  youtubeUrl: string;
}

/** 남성/여성 사회자 거르기 — DB 값이 male/female 과 남성/여성 두 가지라 둘 다 본다 */
export function matchesGender(value: string, want: 'male' | 'female') {
  const v = (value || '').trim().toLowerCase();
  return want === 'male' ? v === 'male' || v.includes('남') : v === 'female' || v.includes('여');
}

/** 소개 영상 첫 주소(여러 개면 줄바꿈으로 이어 붙어 온다) */
function firstVideoUrl(value: string) {
  return String(value || '').split(/\s+/).find((u) => /^https?:\/\//i.test(u)) || '';
}

/** '수도권(서울/인천/경기)' → '수도권' */
function shortRegionLabel(region?: string) {
  return String(region || '').replace(/\(.*?\)/g, '').trim();
}

/** 목록 API 행 → 카드 값(같은 사람 중복 제거, rank = 받은 순서 = 리뷰순 순위) */
export function mapProFeedItems(items: ProListItem[]): ProFeedItem[] {
  const seen = new Set<string>();
  return items
    .filter((p) => {
      const key = p.userId || p.id;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((p, idx) => ({
      id: p.id,
      name: p.name,
      categories: p.categories || [],
      regions: p.regions || [],
      languages: p.languages || [],
      isNationwide: p.isNationwide ?? false,
      rating: p.avgRating || 0,
      reviews: p.reviewCount || 0,
      rank: idx + 1,
      image: p.profileImageUrl || p.images?.[0] || '',
      intro: p.shortIntro || '',
      price: 0,
      experience: p.careerYears || 1,
      tags: (p as any).tags || [],
      gender: p.gender || '',
      images: Array.isArray(p.images) ? p.images.filter(Boolean) : [],
      youtubeUrl: p.youtubeUrl || '',
    }));
}

/**
 * 사회자 한 줄 — 웨딩숲 글 카드(.tcard) 계층(260926 사장 "사회자 리스트도 웨딩숲 느낌으로").
 *  프사 42 · 이름 16 굵게 + TOP 뱃지('열혈 작가' 노랑 톤) · 한 줄 정보 14 회색 · 오른쪽 '문의'(팔로우 버튼 톤) ·
 *  소개 16.5 · 사진 3장(세로 3:4 · 모서리 16 · 3px 틈 — 웨딩숲 사진 모음) · 행사 태그 칩(회색 · 모서리 6) · 아래 리뷰·영상·공유 줄.
 *  카드 전체가 상세로 가는 링크(바닥에 깔고), 버튼·링크만 위로 누를 수 있게 둔다.
 */
export default function ProFeedCard({
  pro,
  index,
  onOpenReviews,
}: {
  pro: ProFeedItem;
  index: number;
  /** 리뷰 — 페이지 이동 없이 댓글처럼 시트로(260926) */
  onOpenReviews?: (pro: ProFeedItem) => void;
}) {
  const prefetchStarted = useRef(false);
  const warmDetail = () => {
    if (prefetchStarted.current || pro.id === 'my-pro') return;
    prefetchStarted.current = true;
    discoveryApi.getProDetail(pro.id).catch(() => {});
  };
  const detailHref = `/pros/${pro.id}`;
  const avatar = pro.image || pro.images[0] || '/images/default-profile.png';
  // 사진 모음 — 프로필과 같은 첫 장은 빼고 최대 3장
  const photos = pro.images.filter((src) => src && src !== pro.image).slice(0, 3);
  const region = pro.isNationwide ? '전국' : shortRegionLabel(pro.regions[0]);
  const chips = Array.from(new Set([
    ...pro.tags.slice(0, 3),
    ...pro.languages.filter((l) => /[가-힣]/.test(l) && l !== '한국어').slice(0, 1).map((l) => `${l} 진행`),
  ])).slice(0, 4);
  const video = firstVideoUrl(pro.youtubeUrl);
  const share = async (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    const url = `${window.location.origin}${detailHref}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: `${pro.name} 사회자 · 프리티풀`, url });
      } else {
        await navigator.clipboard.writeText(url);
        toast('링크를 복사했어요');
      }
    } catch { /* 공유 창을 닫았다 */ }
  };
  const actCls = 'pointer-events-auto inline-flex items-center gap-1.5 px-0.5 py-1 text-[16px] font-medium tracking-[-0.2px] text-[#6B7684] transition-transform active:scale-[0.92]';
  // 사진이 한 번 실패하면 0.5초 뒤 한 번 더(안드 웹뷰 일시 실패), 그래도 안 되면 기본 그림 — 옛 카드의 처리 유지
  const onImgError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const el = e.currentTarget;
    if (el.dataset.fb) return;
    const base = (el.getAttribute('src') || '').split('?')[0];
    if (!el.dataset.retry && base && !base.includes('default-profile')) {
      el.dataset.retry = '1';
      window.setTimeout(() => { el.src = `${base}?r=1`; }, 500);
      return;
    }
    el.dataset.fb = '1';
    el.src = '/images/default-profile.png';
  };

  return (
    <article
      className="qd-a-item relative flex gap-2.5 border-b border-[#F2F4F6] px-4 pb-3.5 pt-[18px] transition-colors active:bg-[#FAFBFC]"
      style={{ animationDelay: `${0.06 + (index % STAGGER_GROUP) * 0.045}s` }}
      onMouseEnter={warmDetail}
      onTouchStart={warmDetail}
    >
      <Link href={detailHref} onFocus={warmDetail} className="absolute inset-0 z-0" aria-label={`${pro.name} 사회자 보기`} />
      {/* 왼쪽 — 프사 42 */}
      <div className="pointer-events-none relative z-[1] w-[42px] shrink-0">
        <div className="h-[42px] w-[42px] overflow-hidden rounded-full bg-[#F2F4F6]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={avatar} alt="" loading={index < 6 ? 'eager' : 'lazy'} decoding="async" onError={onImgError} className="h-full w-full object-cover" />
        </div>
      </div>
      <div className="pointer-events-none relative z-[1] min-w-0 flex-1">
        {/* 이름 줄 + 한 줄 정보 / 오른쪽 '문의' */}
        <div className="flex items-start justify-between gap-2.5">
          <div className="min-w-0 pt-px">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="truncate text-[16px] font-bold tracking-[-0.3px] text-[#191F28]">{pro.name}</span>
              {pro.rank > 0 && pro.rank <= 10 && (
                <span className="inline-flex h-6 shrink-0 items-center rounded-[6px] bg-[#FFF6DB] px-[7px] text-[13.5px] font-semibold tracking-[-0.2px] text-[#D99A00]">
                  TOP {pro.rank}
                </span>
              )}
            </div>
            <p className="mt-1 flex flex-wrap items-center gap-1 text-[14px] tracking-[-0.2px] text-[#8B95A1]">
              {pro.reviews > 0 ? (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" className="shrink-0">
                    <path d="M12 2.8l2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 16.6l-5.4 2.9 1.1-6.1-4.5-4.2 6.1-.8z" fill="#FFC933" />
                  </svg>
                  <span className="font-semibold text-[#4E5968]">{Number(pro.rating || 0).toFixed(1)}</span>
                  <span>· 리뷰 {pro.reviews}</span>
                </>
              ) : (
                <span className="font-semibold text-[#3182F6]">새로 온 사회자</span>
              )}
              {pro.experience > 0 && <span>· 경력 {pro.experience}년</span>}
              {region && <span>· {region}</span>}
            </p>
          </div>
          {/* 웨딩숲 '팔로우' 자리 — 문의(상세의 문의 창을 바로 연다) */}
          <Link
            href={`${detailHref}?inquiry=1`}
            onClick={warmDetail}
            className="pointer-events-auto flex h-[34px] shrink-0 items-center rounded-[10px] bg-[#E8F3FF] px-3 text-[15px] font-semibold tracking-[-0.2px] text-[#3182F6] transition active:scale-[0.97] active:bg-[#D6E9FF]"
          >
            문의
          </Link>
        </div>

        {/* 본문 — 소개 */}
        <p className="mt-3 line-clamp-2 whitespace-pre-line break-words text-[16.5px] leading-[1.65] tracking-[-0.3px] text-[#191F28]">
          {pro.intro || '프리티풀 인증 사회자예요'}
        </p>

        {/* 사진 모음 — 웨딩숲 사진 칸(모서리 16 · 3px 틈), 세로 3:4 */}
        {photos.length > 0 && (
          <div className="mt-3.5 grid max-w-[420px] grid-cols-3 gap-[3px] overflow-hidden rounded-[16px]">
            {photos.map((src, i) => (
              <div key={src + i} className="aspect-[3/4] overflow-hidden bg-[#F2F4F6]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="" loading={index < 3 ? 'eager' : 'lazy'} decoding="async" onError={onImgError} className="h-full w-full object-cover" />
              </div>
            ))}
          </div>
        )}

        {/* 태그 칩 — 웨딩숲 카테고리 칩 */}
        {chips.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1.5">
            {chips.map((chip) => (
              <span key={chip} className="rounded-[6px] bg-[#F2F4F6] px-[9px] py-1 text-[13px] font-semibold text-[#6B7684]">{chip}</span>
            ))}
          </div>
        )}

        {/* 아래 줄 — 리뷰 · 영상 · 공유(웨딩숲 좋아요·댓글·공유 줄 어법) */}
        <div className="mt-3.5 flex items-center gap-5">
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onOpenReviews?.(pro); }}
            className={actCls}
            aria-label={`리뷰 ${pro.reviews}개 보기`}
          >
            <TossCommentIcon />
            {pro.reviews}
          </button>
          {video && (
            <a href={video} target="_blank" rel="noopener noreferrer" className={actCls} onClick={(e) => e.stopPropagation()}>
              <svg viewBox="0 0 24 24" width="24" height="24" fill="none" aria-hidden="true">
                <rect x="3.6" y="5.6" width="16.8" height="12.8" rx="3.4" stroke="currentColor" strokeWidth="1.8" />
                <path d="M10.4 9.4v5.2l4.4-2.6-4.4-2.6Z" fill="currentColor" />
              </svg>
              영상
            </a>
          )}
          <button type="button" onClick={share} className={actCls} aria-label="공유하기">
            <TossShareIcon />
            공유
          </button>
        </div>
      </div>
    </article>
  );
}

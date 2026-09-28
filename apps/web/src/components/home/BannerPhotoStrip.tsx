'use client';

// PC 첫 화면 배너 아래 사진 줄(260928 사장 — 오늘의집 카드처럼 사진 몇 장 + '더보기', 흰 부분은 흐린 유리로 고급스럽게, 나올 때 인터랙션).
//  · 장이 들어올 때마다(animKey) 유리 판이 아래에서 떠오르고 사진이 차례로 톡톡 올라온다. 나가는 장은 그대로 밀려 나간다.
//  · 사진에 마우스를 올리면 사진이 천천히 커지고 아래에 이름 알약(지점 이름)이 뜬다. 누르면 그 업체 상세로.
//  · 배너를 끌어 넘긴 직후엔 눌림을 막는다(canNavigate) — 넘기려다 사진이 열리지 않게.
//  · 유리(backdrop-filter)는 이 판 자신에만 — 조상에 filter/opacity 애니를 걸면 흐림이 사진을 못 본다.
import Link from 'next/link';
import type { CSSProperties } from 'react';

export type BannerStrip = {
  photos: Array<{ src: string; href: string; label?: string }>;
  moreHref: string;
  moreLabel?: string;
  /** 아래에서 띄울 거리(CSS) — 사진 속 아래 글씨를 피할 때(슈슈몽드 안내 문구). 기본 20px */
  bottom?: string;
};

// 어두운 흐린 유리(260928 사장 '화이트 말고 어두운 블러') · 테두리 선 없이('보더 빼줘') — 흐림 + 짙은 반투명 그라데이션 + 옅은 그림자만
const GLASS: CSSProperties = {
  background: 'linear-gradient(135deg, rgba(14,16,22,0.5) 0%, rgba(14,16,22,0.32) 100%)',
  WebkitBackdropFilter: 'blur(24px) saturate(160%)',
  backdropFilter: 'blur(24px) saturate(160%)',
  boxShadow: '0 10px 28px rgba(0,0,0,0.18)',
};

export default function BannerPhotoStrip({
  strip,
  active,
  leaving,
  animKey,
  canNavigate,
}: {
  strip: BannerStrip;
  /** 지금 보이는 장 — 등장 애니를 건다 */
  active: boolean;
  /** 밀려 나가는 중인 장 — 애니 없이 그대로 보인다 */
  leaving: boolean;
  /** 장이 들어올 때마다 바뀌는 값 — 바뀌면 등장 애니를 다시 */
  animKey: string;
  canNavigate: () => boolean;
}) {
  const guard = (e: React.MouseEvent) => { if (!canNavigate()) e.preventDefault(); };
  return (
    <div
      key={animKey}
      data-banner-strip
      // 왼쪽 아래에 내용만큼만(오른쪽 아래 로고를 가리지 않게, 260928 사장 'PC 배너 로고 안 가려지게') — 사진 4장 + 더보기
      className="absolute left-6 z-[2] w-max"
      // 바깥 칸은 위치·크기만 움직이고(transform), 투명도는 유리 판 자신에 — 조상에 opacity 가 걸리면 그동안 흐림이 사진을 못 본다
      style={{
        bottom: strip.bottom || '20px',
        ...(active ? { animation: 'bannerStripRise 0.72s cubic-bezier(0.22, 1, 0.36, 1) 0.26s both' } : { visibility: leaving ? 'visible' : 'hidden' }),
      }}
    >
      <div
        className="flex items-center gap-2 rounded-[16px] p-2"
        style={{ ...GLASS, ...(active ? { animation: 'bannerGlassIn 0.6s ease-out 0.26s both' } : {}) }}
      >
        {strip.photos.map((p, i) => (
          <Link
            key={p.src}
            href={p.href}
            onClick={guard}
            draggable={false}
            aria-label={p.label ? `${p.label} 보기` : '사진 보기'}
            // 1024~1279 는 배너가 좁아(484~592px) 48 — 줄이 배너 폭의 2/3 안쪽에서 끝나야 오른쪽 아래 로고를 안 가린다
            className="group/ph relative aspect-square w-[48px] shrink-0 overflow-hidden rounded-[9px] bg-black/20 transition-transform duration-300 hover:-translate-y-0.5 xl:w-[64px] xl:rounded-[10px]"
            style={active ? { animation: `bannerThumbIn 0.62s cubic-bezier(0.34, 1.36, 0.64, 1) ${0.4 + i * 0.06}s both` } : undefined}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={p.src}
              alt=""
              loading="lazy"
              decoding="async"
              draggable={false}
              referrerPolicy="no-referrer"
              className="h-full w-full object-cover transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover/ph:scale-110"
            />
            {p.label && (
              <span
                className="pointer-events-none absolute inset-x-1 bottom-1 flex h-[20px] translate-y-1 items-center justify-center rounded-full text-[11.5px] font-semibold tracking-[-0.2px] text-white opacity-0 transition-all duration-300 group-hover/ph:translate-y-0 group-hover/ph:opacity-100"
                style={{ backgroundColor: 'rgba(0,0,0,0.38)', WebkitBackdropFilter: 'blur(8px)', backdropFilter: 'blur(8px)' }}
              >
                {p.label}
              </span>
            )}
          </Link>
        ))}
        <Link
          href={strip.moreHref}
          onClick={guard}
          draggable={false}
          className="group/more flex h-[48px] shrink-0 items-center gap-0.5 rounded-[9px] pl-2.5 pr-1.5 text-[14px] font-semibold tracking-[-0.3px] text-white transition-colors hover:bg-white/10 xl:h-[64px] xl:pl-3 xl:pr-2 xl:text-[15px]"
          style={{
            textShadow: '0 1px 4px rgba(0,0,0,0.2)',
            ...(active ? { animation: `bannerThumbIn 0.62s cubic-bezier(0.22, 1, 0.36, 1) ${0.4 + strip.photos.length * 0.06}s both` } : {}),
          }}
        >
          {strip.moreLabel || '더보기'}
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="transition-transform duration-300 group-hover/more:translate-x-0.5">
            <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
      </div>
    </div>
  );
}

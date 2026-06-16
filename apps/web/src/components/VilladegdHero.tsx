'use client';

// 웨딩홀 리스트 히어로 — 빌라드지디 청담 (풀스크린 영상 배경 + 로고 + 소개)
// 영상/로고: Vercel Blob CDN
const VILLADEGD_VIDEO =
  'https://jnhwlzeyberhyv7s.public.blob.vercel-storage.com/villadegd/villadegd-hero.mp4';
const VILLADEGD_LOGO =
  'https://jnhwlzeyberhyv7s.public.blob.vercel-storage.com/villadegd/villadegd-logo-white.png';

const TAGS = ['색으로 소통하는 공간', '나이트웨딩', '웨딩 뮤지컬'];

export default function VilladegdHero() {
  return (
    <section className="relative w-full overflow-hidden bg-black">
      {/* 화면 세로를 꽉 채우는 영상 (헤더+탭 아래 영역) */}
      <div className="relative h-[calc(100svh-98px)] w-full">
        <video
          className="absolute inset-0 h-full w-full object-cover"
          src={VILLADEGD_VIDEO}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
        />
        {/* 가독성 그라데이션 */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/15 to-black/40" />

        {/* 하단 콘텐츠 */}
        <div className="absolute inset-x-0 bottom-0 px-6 pb-9">
          <img
            src={VILLADEGD_LOGO}
            alt="빌라드지디 청담"
            className="mb-4 h-[34px] w-auto drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)]"
          />
          <h2 className="text-[26px] font-bold leading-[1.25] text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)]">
            웨딩의 가장 완벽한 색감
          </h2>
          <p className="mt-1.5 text-[14px] leading-snug text-white/85">
            도심 안에서 펼쳐지는 숲 속 웨딩, 신랑신부를 더욱 빛나게 하는 청담 빌라드지디
          </p>
          <div className="mt-2 flex items-center gap-1 text-[12px] text-white/65">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0Z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            서울 강남구 학동로 519 · 02-542-7513
          </div>
          <div className="mt-4 flex flex-wrap gap-1.5">
            {TAGS.map((t) => (
              <span
                key={t}
                className="rounded-full border border-white/25 bg-white/10 px-3 py-1.5 text-[12px] font-semibold text-white backdrop-blur-md"
              >
                {t}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

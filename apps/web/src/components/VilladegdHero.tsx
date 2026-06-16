'use client';

// 웨딩홀 리스트 히어로 — 빌라드지디 청담 (영상 배경 + 로고 + 소개)
// 영상: Vercel Blob CDN, 로고: /images/villadegd-logo.svg
const VILLADEGD_VIDEO =
  'https://jnhwlzeyberhyv7s.public.blob.vercel-storage.com/villadegd/villadegd-hero.mp4';

const TAGS = ['색으로 소통하는 공간', '나이트웨딩', '웨딩 뮤지컬'];

export default function VilladegdHero() {
  return (
    <section className="relative mx-4 mt-3 mb-1 overflow-hidden rounded-[24px] bg-black shadow-[0_10px_30px_rgba(15,23,42,0.18)]">
      <div className="relative aspect-[16/11] w-full">
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
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/15 to-black/35" />

        {/* 상단 라벨 */}
        <div className="absolute left-4 top-4 flex items-center gap-1.5">
          <span className="rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-bold tracking-[0.14em] text-white backdrop-blur-md">
            PREMIUM WEDDING HALL
          </span>
        </div>

        {/* 하단 콘텐츠 */}
        <div className="absolute inset-x-0 bottom-0 p-5">
          <img
            src="/images/villadegd-logo.svg"
            alt="빌라드지디 청담"
            className="mb-2.5 h-[26px] w-auto"
            style={{ filter: 'brightness(0) invert(1)' }}
          />
          <h2 className="text-[21px] font-bold leading-[1.25] text-white">
            웨딩의 가장 완벽한 색감
          </h2>
          <p className="mt-1 text-[13px] leading-snug text-white/85">
            도심 안에서 펼쳐지는 숲 속 웨딩, 신랑신부를 더욱 빛나게 하는 청담 빌라드지디
          </p>
          <div className="mt-1.5 flex items-center gap-1 text-[11.5px] text-white/65">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0Z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            서울 강남구 학동로 519 · 02-542-7513
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {TAGS.map((t) => (
              <span
                key={t}
                className="rounded-full border border-white/25 bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur-md"
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

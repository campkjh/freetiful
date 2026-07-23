'use client';

/**
 * 빌라드지디 전용 이벤트 오버레이 — 앱 초기 진입 시 1회 노출(X로 닫기, localStorage 기억).
 * 톤앤매너/인터랙션: corporate-mc 기준(풀스크린 히어로 영상 + 커튼 리빌, 블루 #3182F6,
 * 스크롤 리빌, 라운드 카드). 5개 지점(청담·수서·안양·안산·논현) 갤러리 + 영상(Vercel Blob).
 */

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { X, ChevronRight, MapPin, ChevronDown } from 'lucide-react';
import { getWeddingPartnerImages } from '@/lib/wedding-partner-images';

const BLOB = 'https://jnhwlzeyberhyv7s.public.blob.vercel-storage.com/villadegd';
const HERO_VIDEO = `${BLOB}/villadegd-hero.mp4`;
const LOGO_WHITE = `${BLOB}/villadegd-logo-white.png`;
const DISMISS_KEY = 'villadegd_event_v1'; // 버전 올리면 다시 노출

type Branch = { key: string; name: string; hall?: string; loc: string; address?: string; video?: string };
const BRANCHES: Branch[] = [
  { key: '빌라드지디청담', name: '청담', loc: '서울 강남구 청담' },
  { key: '빌라드지디수서', name: '수서', hall: '르씨엘홀', loc: '서울 강남구 수서', video: `${BLOB}/villadegd-suseo.mp4` },
  { key: '빌라드지디안양', name: '안양', hall: '갤러리아홀', loc: '경기 안양시 동안구', address: '경기 안양시 동안구 관악대로 254', video: `${BLOB}/villadegd-anyang.mp4` },
  { key: '빌라드지디안산', name: '안산', hall: '그레이스켈리홀', loc: '경기 안산시 단원구', address: '경기 안산시 단원구 광덕4로 140', video: `${BLOB}/villadegd-ansan.mp4` },
  { key: '빌라드지디논현', name: '논현', loc: '서울 강남구 논현', video: `${BLOB}/villadegd-nonhyeon.mp4` },
];

const CSS = `
.vgd-scroll{-webkit-overflow-scrolling:touch}
.vgd-reveal{opacity:0;transform:translateY(28px);transition:opacity .9s cubic-bezier(.22,1,.36,1),transform .9s cubic-bezier(.22,1,.36,1);will-change:opacity,transform}
.vgd-reveal.in{opacity:1;transform:none}
.vgd-d1{transition-delay:.07s}.vgd-d2{transition-delay:.15s}.vgd-d3{transition-delay:.23s}
.vgd-curtain{animation:vgdCurtain 1.35s cubic-bezier(.65,0,.35,1) forwards}
@keyframes vgdCurtain{0%{transform:translateY(0)}100%{transform:translateY(-101%)}}
.vgd-hint{animation:vgdHint 1.8s ease-in-out infinite}
@keyframes vgdHint{0%,100%{transform:translateY(0);opacity:.65}50%{transform:translateY(7px);opacity:1}}
.vgd-gal{scrollbar-width:none}.vgd-gal::-webkit-scrollbar{display:none}
.vgd-in{animation:vgdIn .5s cubic-bezier(.22,1,.36,1) both}
@keyframes vgdIn{0%{opacity:0}100%{opacity:1}}
@media (prefers-reduced-motion: reduce){
  .vgd-reveal{opacity:1 !important;transform:none !important}
  .vgd-curtain,.vgd-hint,.vgd-in{animation:none !important}
}
`;

export default function VilladegdEventOverlay() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);

  // 초기 진입 1회 노출(닫으면 기억)
  useEffect(() => {
    try {
      if (localStorage.getItem(DISMISS_KEY) !== 'closed') setOpen(true);
    } catch { setOpen(true); }
  }, []);

  // 열려 있는 동안 body 스크롤 잠금 + 스크롤 리빌 옵저버
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const root = rootRef.current;
    const els = root ? Array.from(root.querySelectorAll<HTMLElement>('.vgd-reveal')) : [];
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { threshold: 0.16 });
    els.forEach((el) => io.observe(el));
    return () => { document.body.style.overflow = prev; io.disconnect(); };
  }, [open]);

  const close = () => {
    try { localStorage.setItem(DISMISS_KEY, 'closed'); } catch {}
    setOpen(false);
  };
  const goWeddingHalls = () => { close(); router.push('/businesses?category=웨딩홀'); };

  if (!open) return null;

  return (
    <div ref={rootRef} className="vgd-scroll vgd-in fixed inset-0 z-[120] overflow-y-auto overscroll-contain bg-white" role="dialog" aria-modal="true" aria-label="빌라드지디 이벤트">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      {/* 닫기 버튼 — 항상 우상단 고정 */}
      <button
        onClick={close}
        aria-label="닫기"
        className="fixed right-4 top-[calc(env(safe-area-inset-top,0px)+14px)] z-[130] flex h-11 w-11 items-center justify-center rounded-full bg-black/35 text-white backdrop-blur-md transition active:scale-95 hover:bg-black/55"
      >
        <X size={22} strokeWidth={2.4} />
      </button>

      {/* ── 히어로 ── */}
      <section className="relative flex h-[100svh] min-h-[560px] w-full items-center justify-center overflow-hidden bg-black">
        <video className="absolute inset-0 h-full w-full object-cover" src={HERO_VIDEO} autoPlay muted loop playsInline preload="metadata" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/25 to-black/80" />
        <div className="vgd-curtain pointer-events-none absolute inset-0 z-20 bg-black" />

        <div className="relative z-10 px-6 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={LOGO_WHITE} alt="빌라드지디" className="mx-auto mb-6 h-[38px] w-auto drop-shadow-[0_2px_10px_rgba(0,0,0,0.6)] md:h-[46px]" />
          <p className="mb-3 text-[13px] font-semibold uppercase tracking-[0.22em] text-white/70 md:text-[15px]">Villa de GD · Wedding</p>
          <h1 className="text-[30px] font-extrabold leading-[1.28] tracking-[-0.02em] text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.5)] md:text-[52px]">
            빛과 웨딩이<br />어우러지다
          </h1>
          <p className="mx-auto mt-4 max-w-[520px] text-[15px] leading-[1.7] text-white/85 md:text-[18px]">
            미디어아트 웨딩의 정수, 전국 <b className="text-white">5개 지점</b>에서<br className="hidden sm:block" />
            신랑신부의 스토리를 빛으로 담습니다
          </p>
          <button onClick={goWeddingHalls} className="mt-8 inline-flex items-center gap-2 rounded-full bg-white/15 px-8 py-3.5 text-[15px] font-bold text-white ring-1 ring-white/30 backdrop-blur-md transition active:scale-95 hover:bg-white/25 md:text-[17px]">
            웨딩홀 둘러보기 <ChevronRight size={18} strokeWidth={2.4} className="opacity-80" />
          </button>
        </div>

        <div className="vgd-hint pointer-events-none absolute bottom-8 left-1/2 z-10 -translate-x-1/2 text-white/70">
          <ChevronDown size={26} strokeWidth={2.2} />
        </div>
      </section>

      {/* ── 인트로 ── */}
      <section className="px-5 py-16 text-center md:py-24">
        <p className="vgd-reveal mb-3 text-[14px] font-semibold uppercase tracking-[0.18em] text-[#B7C0CC] md:text-[16px]">Villa de GD</p>
        <h2 className="vgd-reveal vgd-d1 text-[24px] font-extrabold leading-[1.32] tracking-[-0.02em] text-[#191F28] md:text-[42px]">
          하나뿐인 웨딩을<br />빛으로 완성하는 공간
        </h2>
        <p className="vgd-reveal vgd-d2 mx-auto mt-5 max-w-[560px] text-[15px] leading-[1.75] text-[#8B95A1] md:text-[18px]">
          청담 · 수서 · 안양 · 안산 · 논현.<br />
          각 지점만의 감각적인 홀과 미디어아트 연출로<br className="hidden sm:block" />
          두 사람의 특별한 순간을 담아냅니다.
        </p>
      </section>

      {/* ── 지점별 섹션 ── */}
      {BRANCHES.map((b, i) => {
        const images = getWeddingPartnerImages(b.key).slice(0, 10);
        return (
          <section key={b.key} className={`px-5 pb-16 md:pb-24 ${i === 0 ? '' : 'pt-2'}`}>
            <div className="mx-auto max-w-[860px]">
              <div className="vgd-reveal mb-5">
                <p className="mb-2 text-[13px] font-semibold uppercase tracking-[0.16em] text-[#3182F6] md:text-[15px]">
                  Branch {String(i + 1).padStart(2, '0')}{b.hall ? ` · ${b.hall}` : ''}
                </p>
                <h3 className="text-[24px] font-extrabold leading-[1.25] tracking-[-0.02em] text-[#191F28] md:text-[38px]">
                  빌라드지디 <span className="text-[#3182F6]">{b.name}</span>
                </h3>
                <p className="mt-2 inline-flex items-center gap-1.5 text-[14px] text-[#8B95A1] md:text-[16px]">
                  <MapPin size={15} strokeWidth={2.2} className="text-[#B0B8C1]" />
                  {b.address || b.loc}
                </p>
              </div>

              {/* 영상(있으면) */}
              {b.video && (
                <div className="vgd-reveal vgd-d1 mb-4 overflow-hidden rounded-[22px] bg-black shadow-[0_10px_40px_rgba(0,0,0,0.12)]">
                  <video
                    className="aspect-video h-full w-full object-cover"
                    src={b.video}
                    controls
                    muted
                    loop
                    playsInline
                    preload="none"
                  />
                </div>
              )}

              {/* 이미지 갤러리 — 가로 스냅 스크롤 */}
              {images.length > 0 && (
                <div className="vgd-gal vgd-reveal vgd-d2 -mx-5 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-1">
                  {images.map((src, k) => (
                    <div key={src} className="relative aspect-[3/4] w-[62%] shrink-0 snap-start overflow-hidden rounded-[20px] bg-[#F2F4F6] sm:w-[38%] md:w-[30%]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={src} alt={`빌라드지디 ${b.name} ${k + 1}`} loading="lazy" className="h-full w-full object-cover" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        );
      })}

      {/* ── 클로징 CTA ── */}
      <section className="relative overflow-hidden bg-[#0B1220] px-5 py-20 text-center md:py-28">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_60%_at_50%_0%,rgba(49,130,246,0.35),transparent)]" />
        <div className="relative">
          <h2 className="vgd-reveal text-[26px] font-extrabold leading-[1.3] tracking-[-0.02em] text-white md:text-[42px]">
            당신의 웨딩,<br />빌라드지디에서 시작하세요
          </h2>
          <p className="vgd-reveal vgd-d1 mx-auto mt-4 max-w-[440px] text-[15px] leading-[1.7] text-white/70 md:text-[18px]">
            원하는 지점의 홀과 상담을 프리티풀에서 바로 확인하세요.
          </p>
          <div className="vgd-reveal vgd-d2 mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <button onClick={goWeddingHalls} className="inline-flex items-center gap-2 rounded-full bg-[#3182F6] px-9 py-4 text-[16px] font-bold text-white transition active:scale-95 hover:bg-[#2f78e6]">
              웨딩홀 둘러보기 <ChevronRight size={18} strokeWidth={2.4} />
            </button>
            <button onClick={close} className="rounded-full px-6 py-4 text-[15px] font-semibold text-white/60 transition hover:text-white/90">
              닫기
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

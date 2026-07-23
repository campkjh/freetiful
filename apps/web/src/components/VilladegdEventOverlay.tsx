'use client';

/**
 * 빌라드지디 첫 랜딩 이벤트 오버레이 — 앱 초기 진입 시 1회 노출(글래스 X로 닫기, localStorage 기억).
 * 톤앤매너/인터랙션: corporate-mc(풀스크린 시네마틱 히어로 영상 + 커튼 리빌 + 스크롤 리빌/팝).
 * 지점별 대표 영상 자동재생 · 갤러리 좌→우 촤라락 리빌. 실제 빌라드지디 자산(Blob 영상 + webp).
 */

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { X, Check, ChevronRight, ChevronDown, MapPin } from 'lucide-react';
import { getWeddingPartnerImages } from '@/lib/wedding-partner-images';

const BLOB = 'https://jnhwlzeyberhyv7s.public.blob.vercel-storage.com/villadegd';
const HERO_VIDEO = `${BLOB}/villadegd-hero.mp4`;
const LOGO_WHITE = `${BLOB}/villadegd-logo-white.png`;
const DISMISS_KEY = 'villadegd_event_v3'; // 재설계 — 재노출

const STRENGTHS = [
  { t: '전국 5개 지점', d: '청담 · 수서 · 안양 · 안산 · 논현, 가까운 곳에서 편하게' },
  { t: '미디어아트 웨딩', d: '빛과 영상으로 완성하는 단 하나뿐인 예식' },
  { t: '커스터마이징 하우스 웨딩', d: '신랑신부의 스토리를 공간과 연출로 담아내요' },
  { t: '프리미엄 플라워 브랜딩', d: '감각적인 홀과 스페셜 플라워로 품격을 더해요' },
];

type Branch = { key: string; name: string; en: string; hall?: string; address: string; phone: string; intro: string; video: string };
const BRANCHES: Branch[] = [
  { key: '빌라드지디청담', name: '청담', en: 'CHUNGDAM', address: '서울 강남구 학동로 519', phone: '02-542-7513',
    intro: '청담동, 도심 속 프리미엄 하우스 웨딩. 감각적인 공간에서 품격 있는 하루를 완성합니다.', video: HERO_VIDEO },
  { key: '빌라드지디수서', name: '수서', en: 'SUSEO', hall: '르씨엘홀', address: '서울 강남구 밤고개로21길 79', phone: '02-543-2555',
    intro: '자연광 가득한 르씨엘홀. 빛으로 물드는 로맨틱한 분위기 속에서 특별한 예식을 담습니다.', video: `${BLOB}/villadegd-suseo.mp4` },
  { key: '빌라드지디안양', name: '안양', en: 'ANYANG', hall: '갤러리아홀', address: '경기 안양시 동안구 관악대로 254', phone: '031-382-3838',
    intro: '빛과 컨셉이 어우러진 갤러리아홀. 미디어아트로 완성하는 가장 감각적인 웨딩.', video: `${BLOB}/villadegd-anyang.mp4` },
  { key: '빌라드지디안산', name: '안산', en: 'ANSAN', hall: '그레이스켈리홀', address: '경기 안산시 단원구 광덕4로 140', phone: '031-487-8100',
    intro: '스페셜 플라워 브랜딩이 빛나는 그레이스켈리홀. 우아함이 흐르는 프리미엄 예식.', video: `${BLOB}/villadegd-ansan.mp4` },
  { key: '빌라드지디논현', name: '논현', en: 'NONHYEON', address: '서울 강남구 언주로126길 23', phone: '02-547-3381',
    intro: '2024 리뉴얼로 새롭게 태어난 논현. 세련된 도심형 웨딩홀에서의 완벽한 하루.', video: `${BLOB}/villadegd-nonhyeon.mp4` },
];

const CSS = `
.vgd-reveal{opacity:0;transform:translateY(30px);transition:opacity 1s cubic-bezier(.22,1,.36,1),transform 1s cubic-bezier(.22,1,.36,1);will-change:opacity,transform}
.vgd-reveal.in{opacity:1;transform:none}
.vgd-pop{opacity:0;transform:scale(1.14);transform-origin:center;transition:opacity .85s cubic-bezier(.22,1,.36,1),transform .85s cubic-bezier(.22,1,.36,1);will-change:opacity,transform}
.vgd-pop.in{opacity:1;transform:none}
.vgd-d1{transition-delay:.09s}.vgd-d2{transition-delay:.18s}.vgd-d3{transition-delay:.27s}
.vgd-rise{opacity:0;transform:translateY(30px) scale(.98);transition:opacity .8s cubic-bezier(.22,1,.36,1),transform .8s cubic-bezier(.22,1,.36,1);will-change:opacity,transform}
.vgd-rise.in{opacity:1;transform:none}
.vgd-rise-sm{opacity:0;transform:translateY(20px);transition:opacity .75s cubic-bezier(.22,1,.36,1),transform .75s cubic-bezier(.22,1,.36,1);will-change:opacity,transform}
.vgd-rise-sm.in{opacity:1;transform:none}
.vgd-curtain{animation:vgdCurtain 1.5s cubic-bezier(.65,0,.35,1) forwards}
@keyframes vgdCurtain{0%{transform:translateY(0)}100%{transform:translateY(-101%)}}
.vgd-hint{animation:vgdHint 1.8s ease-in-out infinite}
@keyframes vgdHint{0%,100%{transform:translateY(0);opacity:.6}50%{transform:translateY(7px);opacity:1}}
.vgd-fade{animation:vgdFade .5s ease both}
@keyframes vgdFade{from{opacity:0}to{opacity:1}}
.vgd-marquee-track{animation:vgdMarquee 34s linear infinite}
@keyframes vgdMarquee{from{transform:translateX(-50%)}to{transform:translateX(0)}}
.vgd-marquee:hover .vgd-marquee-track,.vgd-marquee:active .vgd-marquee-track{animation-play-state:paused}
@media (prefers-reduced-motion: reduce){
  .vgd-reveal,.vgd-pop,.vgd-rise,.vgd-rise-sm{opacity:1 !important;transform:none !important}
  .vgd-curtain,.vgd-hint,.vgd-fade,.vgd-marquee-track{animation:none !important}
}
`;

export default function VilladegdEventOverlay() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try { if (localStorage.getItem(DISMISS_KEY) !== 'closed') setOpen(true); } catch { setOpen(true); }
  }, []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const root = rootRef.current;
    const els = root ? Array.from(root.querySelectorAll<HTMLElement>('.vgd-reveal, .vgd-pop, .vgd-rise, .vgd-rise-sm')) : [];
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { threshold: 0.14 });
    els.forEach((el) => io.observe(el));
    return () => { document.body.style.overflow = prev; io.disconnect(); };
  }, [open]);

  const close = () => { try { localStorage.setItem(DISMISS_KEY, 'closed'); } catch {} setOpen(false); };
  const goWeddingHalls = () => { close(); router.push('/businesses?category=웨딩홀'); };

  if (!open) return null;

  return (
    <div ref={rootRef} className="vgd-fade fixed inset-0 z-[120] overflow-y-auto overscroll-contain bg-white" role="dialog" aria-modal="true" aria-label="빌라드지디">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      {/* 글래스 X (우상단 고정) */}
      <button onClick={close} aria-label="닫기"
        className="fixed right-4 top-[calc(env(safe-area-inset-top,0px)+14px)] z-[130] flex h-11 w-11 items-center justify-center rounded-full bg-black/35 text-white backdrop-blur-md transition active:scale-95 hover:bg-black/55">
        <X size={22} strokeWidth={2.4} />
      </button>

      {/* ── 히어로 (풀스크린 시네마틱 · 자동재생 영상 + 커튼) ── */}
      <section className="relative flex h-[100svh] min-h-[560px] w-full items-center justify-center overflow-hidden bg-black">
        <video className="absolute inset-0 h-full w-full object-cover" src={HERO_VIDEO} autoPlay muted loop playsInline preload="auto" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/20 to-black/80" />
        <div className="vgd-curtain pointer-events-none absolute inset-0 z-20 bg-black" />

        <div className="relative z-10 px-6 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={LOGO_WHITE} alt="빌라드지디" className="mx-auto mb-6 h-[38px] w-auto drop-shadow-[0_2px_10px_rgba(0,0,0,0.6)] md:h-[46px]" />
          <p className="mb-3 text-[13px] font-semibold uppercase tracking-[0.22em] text-white/70 md:text-[15px]">Villa de GD · Wedding</p>
          <h1 className="text-[32px] font-extrabold leading-[1.28] tracking-[-0.02em] text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.5)] md:text-[52px]">
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

      {/* ── 강점 (왜 빌라드지디) ── */}
      <section className="px-6 py-16 text-center md:py-24">
        <p className="vgd-pop mb-3 text-[14px] font-semibold uppercase tracking-[0.18em] text-[#B7C0CC] md:text-[16px]">Why Villa de GD</p>
        <h2 className="vgd-pop vgd-d1 text-[26px] font-extrabold leading-[1.32] tracking-[-0.02em] text-[#191F28] md:text-[40px]">
          웨딩은 왜<br />빌라드지디일까요?
        </h2>
        <ul className="mx-auto mt-10 max-w-[440px] space-y-6 text-left">
          {STRENGTHS.map((s, i) => (
            <li key={s.t} className={`vgd-reveal vgd-d${Math.min(i + 1, 3)} flex gap-3.5`}>
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center">
                <Check size={22} strokeWidth={3} className="text-[#3182F6]" />
              </span>
              <span>
                <b className="block text-[17px] font-bold leading-snug text-[#191F28]">{s.t}</b>
                <span className="mt-1 block text-[14.5px] leading-[1.55] text-[#8B95A1]">{s.d}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* ── 지점별 시네마틱 섹션 ── */}
      {BRANCHES.map((b) => {
        const imgs = getWeddingPartnerImages(b.key);
        const lead = imgs[0];
        const gallery = imgs.slice(0, 10);
        return (
          <section key={b.key} className="py-14 md:py-20">
            <div className="mx-auto max-w-[760px] px-6 text-center">
              <p className="vgd-reveal mb-2 text-[13px] font-semibold uppercase tracking-[0.02em] text-[#9AA3AF] md:text-[14px]">
                VILLA DE GD {b.en}
              </p>
              <h3 className="vgd-reveal vgd-d1 text-[27px] font-extrabold leading-[1.2] tracking-[-0.02em] text-[#191F28] md:text-[40px]">
                빌라드지디 {b.name}
              </h3>
              <p className="vgd-reveal vgd-d2 mx-auto mt-4 max-w-[560px] text-[16px] leading-[1.75] text-[#6B7684] md:text-[19px]">
                {b.intro}
              </p>

              {/* 대표 미디어 — 영상 자동재생(무한 루프) */}
              <div className="vgd-rise mt-8 overflow-hidden rounded-[24px] bg-[#F2F4F6] shadow-[0_16px_50px_rgba(0,0,0,0.14)]">
                <video className="aspect-video w-full object-cover" src={b.video} autoPlay muted loop playsInline preload="auto" poster={lead} />
              </div>
            </div>

            {/* 갤러리 — 무한 캐러셀(좌→우) */}
            {gallery.length > 0 && (
              <div className="vgd-marquee vgd-reveal mt-4 overflow-hidden">
                <div className="vgd-marquee-track flex w-max">
                  {[...gallery, ...gallery].map((src, k) => (
                    <div key={k} className="relative mr-2.5 aspect-[3/4] w-[44vw] shrink-0 overflow-hidden rounded-[18px] bg-[#F2F4F6] sm:w-[28vw] md:w-[210px]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={src} alt={`빌라드지디 ${b.name}`} loading="lazy" className="h-full w-full object-cover" />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 위치·연락 — 카드 없이 담백하게 */}
            <p className="vgd-reveal mt-6 flex items-center justify-center gap-1.5 px-6 text-center text-[14px] text-[#8B95A1] md:text-[15px]">
              <MapPin size={15} strokeWidth={2.2} className="text-[#B0B8C1]" />
              {b.address} · {b.phone}
            </p>
          </section>
        );
      })}

      {/* ── 클로징 CTA (히어로 영상 배경 + 짙은 딤드) ── */}
      <section className="relative flex min-h-[560px] items-center justify-center overflow-hidden bg-black px-6 py-24 text-center md:min-h-[640px]">
        <video className="absolute inset-0 h-full w-full object-cover" src={HERO_VIDEO} autoPlay muted loop playsInline preload="auto" />
        <div className="absolute inset-0 bg-black/70" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/55 to-black/70" />
        <div className="relative z-10">
          <h2 className="vgd-reveal text-[28px] font-extrabold leading-[1.3] tracking-[-0.02em] text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.5)] md:text-[44px]">
            당신의 웨딩,<br />빌라드지디에서 시작하세요
          </h2>
          <p className="vgd-reveal vgd-d1 mx-auto mt-4 max-w-[440px] text-[15px] leading-[1.7] text-white/80 md:text-[18px]">
            원하는 지점의 홀과 상담을 프리티풀에서 바로 확인하세요.
          </p>
          <div className="vgd-reveal vgd-d2 mt-9 flex flex-col items-center gap-3">
            <button onClick={goWeddingHalls} className="inline-flex items-center gap-2 rounded-full bg-[#3182F6] px-10 py-4 text-[16px] font-bold text-white transition active:scale-95 hover:bg-[#2f78e6]">
              웨딩홀 둘러보기 <ChevronRight size={18} strokeWidth={2.4} />
            </button>
            <button onClick={close} className="rounded-full px-6 py-3 text-[15px] font-semibold text-white/60 transition hover:text-white/90">
              닫기
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

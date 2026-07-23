'use client';

/**
 * 빌라드지디 첫 랜딩 이벤트 오버레이 — 앱 초기 진입 시 1회 노출(X로 닫기, localStorage 기억).
 * 디자인: 온보딩/이벤트 에디토리얼(아치형 이미지 히어로 + 큰 헤드라인 + 블루체크 강점 리스트 +
 * 지점별 이미지/영상 섹션). 가운데 정렬 · 영상 자동재생 · 이미지 좌→우 촤라락 리빌.
 * 미디어/이미지: villa 지점 실제 자산(Vercel Blob 영상 + 로컬 webp).
 */

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { X, Check, ChevronRight, MapPin } from 'lucide-react';
import { getWeddingPartnerImages } from '@/lib/wedding-partner-images';

const BLOB = 'https://jnhwlzeyberhyv7s.public.blob.vercel-storage.com/villadegd';
const HERO_VIDEO = `${BLOB}/villadegd-hero.mp4`;
const DISMISS_KEY = 'villadegd_event_v2'; // 재설계 — v2 로 올려 재노출

const STRENGTHS = [
  { t: '전국 5개 지점', d: '청담 · 수서 · 안양 · 안산 · 논현, 가까운 곳에서 편하게' },
  { t: '미디어아트 웨딩', d: '빛과 영상으로 완성하는 단 하나뿐인 예식' },
  { t: '커스터마이징 하우스 웨딩', d: '신랑신부의 스토리를 공간과 연출로 담아내요' },
  { t: '프리미엄 플라워 브랜딩', d: '감각적인 홀과 스페셜 플라워로 품격을 더해요' },
];

type Branch = { key: string; name: string; hall?: string; loc: string; address?: string; video?: string };
const BRANCHES: Branch[] = [
  { key: '빌라드지디청담', name: '청담', loc: '서울 강남 · 청담', address: '서울 강남구 학동로 519' },
  { key: '빌라드지디수서', name: '수서', hall: '르씨엘홀', loc: '서울 강남 · 수서', address: '서울 강남구 밤고개로21길 79', video: `${BLOB}/villadegd-suseo.mp4` },
  { key: '빌라드지디안양', name: '안양', hall: '갤러리아홀', loc: '경기 안양 · 동안구', address: '경기 안양시 동안구 관악대로 254', video: `${BLOB}/villadegd-anyang.mp4` },
  { key: '빌라드지디안산', name: '안산', hall: '그레이스켈리홀', loc: '경기 안산 · 단원구', address: '경기 안산시 단원구 광덕4로 140', video: `${BLOB}/villadegd-ansan.mp4` },
  { key: '빌라드지디논현', name: '논현', loc: '서울 강남 · 논현', address: '서울 강남구 언주로126길 23', video: `${BLOB}/villadegd-nonhyeon.mp4` },
];

const CSS = `
.vgd-reveal{opacity:0;transform:translateY(26px);transition:opacity .9s cubic-bezier(.22,1,.36,1),transform .9s cubic-bezier(.22,1,.36,1);will-change:opacity,transform}
.vgd-reveal.in{opacity:1;transform:none}
.vgd-d1{transition-delay:.08s}.vgd-d2{transition-delay:.16s}.vgd-d3{transition-delay:.24s}
.vgd-rise{opacity:0;transform:translateY(34px) scale(.97);transition:opacity .8s cubic-bezier(.22,1,.36,1),transform .8s cubic-bezier(.22,1,.36,1);will-change:opacity,transform}
.vgd-rise.in{opacity:1;transform:none}
.vgd-arch{border-radius:0 0 50% 50% / 0 0 22% 22%}
.vgd-fade{animation:vgdFade .5s ease both}
@keyframes vgdFade{from{opacity:0}to{opacity:1}}
.vgd-gal{scrollbar-width:none}.vgd-gal::-webkit-scrollbar{display:none}
@media (prefers-reduced-motion: reduce){
  .vgd-reveal,.vgd-rise{opacity:1 !important;transform:none !important}
  .vgd-fade{animation:none !important}
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
    const els = root ? Array.from(root.querySelectorAll<HTMLElement>('.vgd-reveal, .vgd-rise')) : [];
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

      {/* 헤더 바 */}
      <header className="sticky top-0 z-[130] flex h-[54px] items-center justify-center border-b border-gray-100 bg-white/95 backdrop-blur-md" style={{ paddingTop: 'env(safe-area-inset-top,0px)' }}>
        <button onClick={close} aria-label="닫기" className="absolute left-2 flex h-11 w-11 items-center justify-center rounded-full text-gray-800 transition active:scale-90 hover:bg-gray-100">
          <X size={24} strokeWidth={2.2} />
        </button>
        <span className="text-[16px] font-bold tracking-tight text-gray-900">빌라드지디</span>
      </header>

      {/* ── 히어로 (다크 + 아치형 자동재생 영상) ── */}
      <section className="bg-[#0A0A0A] pb-14 pt-0">
        <div className="vgd-arch relative aspect-[4/3.1] w-full overflow-hidden bg-black">
          <video className="absolute inset-0 h-full w-full object-cover" src={HERO_VIDEO} autoPlay muted loop playsInline preload="auto" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0A] via-transparent to-black/10" />
        </div>

        <div className="px-7 pt-9 text-center">
          <p className="mb-3 text-[13px] font-semibold uppercase tracking-[0.2em] text-white/45">Villa de GD</p>
          <h1 className="text-[30px] font-extrabold leading-[1.28] tracking-[-0.02em] text-white">
            웨딩은 왜<br />빌라드지디일까요?
          </h1>

          <ul className="mx-auto mt-9 max-w-[420px] space-y-6 text-left">
            {STRENGTHS.map((s, i) => (
              <li key={s.t} className={`vgd-reveal vgd-d${Math.min(i + 1, 3)} flex gap-3.5`}>
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center">
                  <Check size={22} strokeWidth={3} className="text-[#3182F6]" />
                </span>
                <span>
                  <b className="block text-[17px] font-bold leading-snug text-white">{s.t}</b>
                  <span className="mt-1 block text-[14.5px] leading-[1.55] text-white/60">{s.d}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── 미디어아트 웨딩 (에디토리얼) ── */}
      <section className="px-6 py-16 text-center">
        <p className="vgd-reveal mb-3 text-[14px] font-semibold uppercase tracking-[0.16em] text-[#3182F6]">Media Art Wedding</p>
        <h2 className="vgd-reveal vgd-d1 text-[26px] font-extrabold leading-[1.32] tracking-[-0.02em] text-[#191F28] md:text-[34px]">
          빛과 영상이 예식이 되는<br />미디어아트 웨딩
        </h2>
        <p className="vgd-reveal vgd-d2 mx-auto mt-4 max-w-[500px] text-[15px] leading-[1.75] text-[#8B95A1] md:text-[17px]">
          공간 전체를 채우는 미디어아트와 조명 연출로,<br className="hidden sm:block" />
          두 사람만의 스토리를 가장 아름답게 담아냅니다.
        </p>
        <div className="vgd-rise mx-auto mt-8 max-w-[640px] overflow-hidden rounded-[24px] bg-[#F2F4F6]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={getWeddingPartnerImages('빌라드지디청담')[0]} alt="빌라드지디 미디어아트 웨딩" className="aspect-[4/3] w-full object-cover" loading="lazy" />
        </div>
      </section>

      {/* ── 전국 5개 지점 ── */}
      <section className="px-6 pb-6 text-center">
        <p className="vgd-reveal mb-3 text-[14px] font-semibold uppercase tracking-[0.16em] text-[#3182F6]">5 Branches</p>
        <h2 className="vgd-reveal vgd-d1 text-[26px] font-extrabold leading-[1.32] tracking-[-0.02em] text-[#191F28] md:text-[34px]">
          전국 5개 지점,<br />가까운 곳에서 만나요
        </h2>
        <p className="vgd-reveal vgd-d2 mx-auto mt-4 max-w-[500px] text-[15px] leading-[1.75] text-[#8B95A1] md:text-[17px]">
          청담 · 수서 · 안양 · 안산 · 논현.<br />각 지점만의 감각적인 홀에서 특별한 하루를.
        </p>
      </section>

      {BRANCHES.map((b) => {
        const imgs = getWeddingPartnerImages(b.key);
        const lead = imgs[0];
        const gallery = imgs.slice(1, 9);
        return (
          <section key={b.key} className="px-6 pb-14 pt-4">
            <div className="mx-auto max-w-[680px]">
              <div className="vgd-reveal mb-4 text-center">
                <p className="mb-1.5 inline-flex items-center gap-1 text-[13px] font-semibold text-[#8B95A1]">
                  <MapPin size={14} strokeWidth={2.2} className="text-[#B0B8C1]" />{b.loc}{b.hall ? ` · ${b.hall}` : ''}
                </p>
                <h3 className="text-[24px] font-extrabold leading-[1.25] tracking-[-0.02em] text-[#191F28] md:text-[30px]">
                  빌라드지디 <span className="text-[#3182F6]">{b.name}</span>
                </h3>
              </div>

              {/* 대표 미디어 — 영상 있으면 자동재생, 없으면 이미지 */}
              <div className="vgd-rise overflow-hidden rounded-[24px] bg-[#F2F4F6]">
                {b.video ? (
                  <video className="aspect-video w-full object-cover" src={b.video} autoPlay muted loop playsInline controls preload="none" poster={lead} />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={lead} alt={`빌라드지디 ${b.name}`} className="aspect-[4/3] w-full object-cover" loading="lazy" />
                )}
              </div>

              {/* 갤러리 — 좌→우 촤라락 리빌 */}
              {gallery.length > 0 && (
                <div className="vgd-gal -mx-6 mt-3 flex snap-x snap-mandatory gap-2.5 overflow-x-auto px-6 pb-1">
                  {gallery.map((src, k) => (
                    <div key={src} className="vgd-rise relative aspect-[3/4] w-[42%] shrink-0 snap-start overflow-hidden rounded-[18px] bg-[#F2F4F6] sm:w-[28%] md:w-[22%]" style={{ transitionDelay: `${Math.min(k, 7) * 0.07}s` }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={src} alt={`빌라드지디 ${b.name} ${k + 2}`} loading="lazy" className="h-full w-full object-cover" />
                    </div>
                  ))}
                </div>
              )}

              {/* 정보 카드 */}
              <div className="vgd-reveal mt-4 rounded-[18px] bg-[#F2F4F6] px-5 py-4 text-left">
                <p className="text-[13px] text-[#8B95A1]">{b.hall ? `${b.hall} · 예식 문의` : '예식 문의'}</p>
                <p className="mt-1 text-[15.5px] font-bold text-[#191F28]">{b.address}</p>
              </div>
            </div>
          </section>
        );
      })}

      {/* ── 클로징 CTA ── */}
      <section className="relative overflow-hidden bg-[#0A0A0A] px-6 py-20 text-center">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_55%_at_50%_0%,rgba(49,130,246,0.28),transparent)]" />
        <div className="relative">
          <h2 className="vgd-reveal text-[26px] font-extrabold leading-[1.3] tracking-[-0.02em] text-white md:text-[34px]">
            당신의 웨딩,<br />빌라드지디에서 시작하세요
          </h2>
          <p className="vgd-reveal vgd-d1 mx-auto mt-4 max-w-[440px] text-[15px] leading-[1.7] text-white/65 md:text-[17px]">
            원하는 지점의 홀과 상담을 프리티풀에서 바로 확인하세요.
          </p>
          <div className="vgd-reveal vgd-d2 mt-9 flex flex-col items-center gap-3">
            <button onClick={goWeddingHalls} className="inline-flex items-center gap-2 rounded-full bg-[#3182F6] px-10 py-4 text-[16px] font-bold text-white transition active:scale-95 hover:bg-[#2f78e6]">
              웨딩홀 둘러보기 <ChevronRight size={18} strokeWidth={2.4} />
            </button>
            <button onClick={close} className="rounded-full px-6 py-3 text-[15px] font-semibold text-white/55 transition hover:text-white/90">
              닫기
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

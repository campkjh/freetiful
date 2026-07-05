'use client';

/**
 * 전문행사(기업행사) MC 랜딩 — 홈 "전문행사 사회자 찾기" 진입.
 * 톤앤매너: wedding-mc 페이지 기준(화이트 + 블루 #3182F6, 라운드 카드, 스크롤 리빌).
 * 히어로: 풀스크린 배경 영상 + 카피 오버레이 → 스크롤 시 하단 콘텐츠.
 * 폼 제출: wedding-mc 와 동일하게 matchApi (source: landing_corporate_mc_v1).
 */

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, ChevronDown, Star, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import { matchApi } from '@/lib/api/match.api';
import { useAuthStore } from '@/lib/store/auth.store';

// ─── 미디어 슬롯 (드라이브 자산 수급 후 채움 — 없으면 자동 숨김) ───
const MEDIA_DIR = '/images/corporate-mc';
const HERO_VIDEO = '/videos/corporate-mc-hero.mp4';
const PROFILE_SLIDES: { src: string; role: string; name: string }[] = [
  { src: `${MEDIA_DIR}/profile-01.jpg`, role: '시상식 · 컨퍼런스', name: '아나운서 출신 MC' },
  { src: `${MEDIA_DIR}/profile-02.jpg`, role: '브랜드 · 론칭 행사', name: '아나운서 출신 MC' },
  { src: `${MEDIA_DIR}/profile-03.jpg`, role: '포럼 · 기념식 · 의전', name: '공식행사 전문 MC' },
  { src: `${MEDIA_DIR}/profile-04.jpg`, role: '글로벌 컨퍼런스', name: '영어 진행 가능 MC' },
  { src: `${MEDIA_DIR}/profile-05.jpg`, role: '제품 발표회', name: '쇼호스트 출신 MC' },
  { src: `${MEDIA_DIR}/profile-06.jpg`, role: '송년회 · 사내행사', name: '아나운서 출신 MC' },
];
const SCENE_SLIDES: { src: string; cap: string }[] = [
  { src: `${MEDIA_DIR}/scene-01.jpg`, cap: '사내 시상식 진행' },
  { src: `${MEDIA_DIR}/scene-02.jpg`, cap: '기업 컨퍼런스 진행' },
  { src: `${MEDIA_DIR}/scene-03.jpg`, cap: '브랜드 론칭 행사' },
  { src: `${MEDIA_DIR}/scene-04.jpg`, cap: '송년회 진행' },
  { src: `${MEDIA_DIR}/scene-05.jpg`, cap: '기념식 · 의전 진행' },
];
// 레퍼런스 영상 — /uploads(직접 업로드) 또는 유튜브 embed URL. 비면 섹션 숨김.
const VIDEOS: { src: string; cap: string }[] = [];

const EVENT_TYPES = ['사내 시상식', '송년회·신년회', '컨퍼런스·세미나', '브랜드·론칭 행사', '공공·기념식·의전', '투자설명회·데모데이', '아직 정해지지 않았어요 / 기타'];
const BENEFITS = ['예상 견적 안내', 'MC 진행 영상·프로필', '대본·큐시트 가이드', '의전·식순 체크리스트'];
const WHYS = [
  { no: '01', title: '철저하게 검증된 MC', body: '방송사 아나운서 출신 또는 충분한 공식행사 경력이 검증된 진행자만 선별해 안내합니다. 프로필·진행 영상까지 함께 드려 내부 보고도 수월합니다.' },
  { no: '02', title: '행사 성격에 맞는 추천', body: '시상식은 품격 있게, 송년회는 밝게, 컨퍼런스는 차분하게. 행사 톤앤매너를 이해하고 어울리는 MC를 골라서 제안해드립니다.' },
  { no: '03', title: '대본·큐시트 사전 조율', body: '당일 즉흥이 아니라 대본과 큐시트를 미리 확인하고 리허설까지 맞춥니다. 발표 지연·순서 변경 같은 현장 변수에도 안정적으로 대응합니다.' },
];
const REVIEWS = [
  { quote: '임원분들 호칭 하나 안 틀리고 깔끔하게 끝나서, 제가 칭찬을 들었어요.', who: '대기업 인사팀 · 사내 시상식' },
  { quote: '브랜드 톤을 정확히 잡아주셔서, VIP·기자분들 앞에서 안심이 됐습니다.', who: '패션 브랜드 마케팅팀 · 신제품 발표회' },
  { quote: '견적·프로필·영상을 빠르게 받아서 클라이언트 컨펌이 수월했어요.', who: '행사대행사 · 기업 컨퍼런스' },
];
const STEPS = [
  { no: 'STEP 01', title: '행사 정보 접수', body: '전문 MD가 행사 일정·유형·규모·예산·식순을 확인합니다.' },
  { no: 'STEP 02', title: 'MC 제안 & 선택', body: '가능한 진행자를 프로필·진행 영상으로 비교해 직접 고르고, 내부 보고용 자료까지 받습니다.' },
  { no: 'STEP 03', title: '계약 · 사전 조율', body: '대본·큐시트를 사전에 맞추고, 세금계산서·정산 조건까지 깔끔하게 정리합니다.' },
  { no: 'STEP 04', title: '당일 진행 & 마무리', body: '리허설부터 현장 변수 대응, 정산·세금계산서까지 책임지고 마무리합니다.' },
];

export default function CorporateMcPage() {
  const router = useRouter();
  const authUser = useAuthStore((s) => s.user);
  const setAuth = useAuthStore((s) => s.setAuth);
  const videoRef = useRef<HTMLVideoElement>(null);
  const crossRef = useRef<HTMLElement>(null);
  const [scrolled, setScrolled] = useState(false);

  // 폼
  const [step, setStep] = useState<number | 'done'>(1);
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [phone, setPhone] = useState('');
  const [eventType, setEventType] = useState<string | null>(null);
  const [dateText, setDateText] = useState('');
  const [region, setRegion] = useState('');
  const [size, setSize] = useState('');
  const [benefits, setBenefits] = useState<string[]>([]);
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // 자동재생 보장(iOS WebView)
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = true;
    v.play().catch(() => {});
  }, []);

  // 헤더 배경 전환(히어로 지나면 흰 배경) + 교차 이미지 스크롤 벌어짐
  useEffect(() => {
    let raf = 0;
    const apply = () => {
      raf = 0;
      setScrolled(window.scrollY > window.innerHeight * 0.7);
      // 교차 섹션: 화면 중앙 기준 진행도(0=겹침 → 1=벌어짐)
      const el = crossRef.current;
      if (el) {
        const r = el.getBoundingClientRect();
        const vh = window.innerHeight;
        const p = Math.min(1, Math.max(0, (vh - r.top) / (vh * 0.9)));
        el.style.setProperty('--spread', String(p));
      }
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(apply); };
    window.addEventListener('scroll', onScroll, { passive: true });
    apply();
    return () => { window.removeEventListener('scroll', onScroll); if (raf) cancelAnimationFrame(raf); };
  }, []);

  // 스크롤 리빌
  useEffect(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>('.cmc-reveal'));
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) e.target.classList.add('cmc-in'); });
    }, { threshold: 0.15, rootMargin: '0px 0px -8% 0px' });
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  const slide = (id: string, dir: number) => {
    const t = document.getElementById(id);
    if (!t) return;
    t.scrollBy({ left: dir * t.clientWidth * 0.85, behavior: 'smooth' });
  };
  const scrollToApply = () => document.getElementById('apply')?.scrollIntoView({ behavior: 'smooth' });

  const goNext = (from: number) => {
    if (from === 1 && (!name.trim() || !phone.trim())) { toast.error('성함과 연락처를 입력해주세요.'); return; }
    if (from === 2 && !eventType) { toast.error('행사 유형을 선택해주세요.'); return; }
    setStep(from + 1);
  };

  const submit = async () => {
    if (submitting) return;
    if (!consent) { toast.error('개인정보 수집·이용에 동의해주세요.'); return; }
    setSubmitting(true);
    const digits = phone.replace(/\D/g, '');
    const rawUserInput = {
      source: 'landing_corporate_mc_v1',
      name: name.trim(), company: company.trim(), phone: phone.trim(),
      eventType, dateText: dateText.trim(), region: region.trim(), size: size.trim(), benefits,
      landing_url: typeof window !== 'undefined' ? window.location.href : '',
    };
    try {
      let res: any;
      if (authUser) {
        res = await matchApi.createRequest({ categoryId: '전문행사사회자', type: 'multi', eventLocation: region.trim() || undefined, rawUserInput });
      } else {
        res = await matchApi.quickRequest({ name: name.trim() || undefined, phone: digits, categoryId: '전문행사사회자', type: 'multi', eventLocation: region.trim() || undefined, rawUserInput });
        if (res?.accessToken && res?.refreshToken && res?.user) setAuth(res.user, res.accessToken, res.refreshToken);
      }
      window.dispatchEvent(new Event('freetiful:match-requests-changed'));
      try { (window as any).webkit?.messageHandlers?.nativeMCSearch?.postMessage({ action: 'start', category: '행사 사회자' }); } catch {}
      setStep('done');
    } catch (err: any) {
      toast.error(`제출에 실패했어요. ${err?.response?.data?.message || err?.message || ''}`);
    } finally {
      setSubmitting(false);
    }
  };

  const pct = step === 'done' ? 100 : (step as number) * 25;

  return (
    <main className="cmc bg-white text-[#191F28]">
      {/* eslint-disable-next-line react/no-unknown-property */}
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      {/* 헤더 (히어로 위 투명 → 스크롤 시 흰 배경) */}
      <header className={`fixed inset-x-0 top-0 z-40 transition-colors duration-300 ${scrolled ? 'bg-white/90 backdrop-blur border-b border-[#EEF1F4]' : 'bg-transparent'}`}>
        <div className="mx-auto flex h-14 max-w-md items-center justify-between px-3">
          <button
            type="button"
            aria-label="뒤로"
            onClick={() => { if (window.history.length > 1) router.back(); else router.push('/main'); }}
            className={`flex h-10 w-10 items-center justify-center -ml-1 rounded-full transition ${scrolled ? 'text-[#191F28] hover:bg-black/5' : 'text-white hover:bg-white/10'}`}
          >
            <ChevronLeft size={24} strokeWidth={2.2} />
          </button>
          <FreetifulLogo className={`h-[22px] w-auto transition-colors duration-300 ${scrolled ? 'text-[#1B1B1B]' : 'text-white'}`} />
          <div className="w-10" />
        </div>
      </header>

      {/* ───────── 히어로 (풀스크린 영상) ───────── */}
      <section className="relative flex h-[100svh] min-h-[560px] w-full items-center justify-center overflow-hidden bg-black">
        <video
          ref={videoRef}
          className="cmc-hero-video absolute inset-0 h-full w-full object-cover"
          src={HERO_VIDEO}
          autoPlay muted loop playsInline preload="auto"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/45 via-black/25 to-black/75" />
        {/* 살짝의 딤드 — 전체 균일 어둡게 */}
        <div className="pointer-events-none absolute inset-0 bg-black/25" />
        {/* 첫 진입 커튼 — 고급스럽게 걷히는 오프닝 */}
        <div className="cmc-hero-curtain pointer-events-none absolute inset-0 z-20 bg-black" />
        <div className="relative z-10 px-5 text-center">
          <p className="cmc-hero-eyebrow cmc-condor mb-4 text-[13px] uppercase tracking-[0.16em] text-white/75 md:mb-5 md:text-[15px]">Corporate Event MC</p>
          <h1 className="font-extrabold leading-[1.3] tracking-[-0.02em] text-white drop-shadow-[0_2px_18px_rgba(0,0,0,0.5)]">
            <span className="cmc-hero-line cmc-line-1 block text-[24px] md:text-[44px]">중요한 행사의 완성도는</span>
            <span className="cmc-hero-line cmc-line-2 mt-1 block text-[24px] md:text-[44px]">
              사회자에 따라 달라집니다
            </span>
          </h1>
          <p className="cmc-hero-sub mt-6 text-[14px] font-medium leading-relaxed text-white/80 md:mt-7 md:text-[18px]">
            KBS · SBS · MBC 아나운서 출신<br />검증된 전문 MC를 행사 성격에 맞춰
          </p>
          <div className="cmc-hero-cta mt-8 flex items-center justify-center md:mt-10">
            <button onClick={scrollToApply} className="cmc-glass inline-flex items-center gap-2 rounded-full px-8 py-3.5 text-[15px] font-bold text-white transition active:scale-95 md:px-10 md:py-4 md:text-[17px]">
              비즈니스 문의
              <ChevronRight size={18} strokeWidth={2.4} className="opacity-80" />
            </button>
          </div>
        </div>
        {/* 스크롤 힌트 */}
        <button onClick={() => window.scrollTo({ top: window.innerHeight - 56, behavior: 'smooth' })} aria-label="아래로" className="cmc-scrollhint absolute bottom-7 left-1/2 z-10 -translate-x-1/2 text-white/70">
          <ChevronDown size={30} strokeWidth={2} />
        </button>
      </section>

      {/* ───────── 교차 이미지 (품격) — 스크롤 시 위에서 겹쳤다가 텍스트 여백만큼 벌어짐 ───────── */}
      <section ref={crossRef} className="cmc-cross-sec relative overflow-hidden bg-white px-5 py-24">
        <div className="cmc-cross mx-auto flex max-w-md flex-col items-center">
          {/* 상단 이미지 */}
          <div className="cmc-cross-img cmc-cross-a relative aspect-[4/5] w-[62%] self-start overflow-hidden bg-gradient-to-br from-[#EDEFF3] to-[#DDE1E8]">
            <img src={`${MEDIA_DIR}/cross-01.jpg`} alt="" loading="lazy" className="relative h-full w-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          </div>
          {/* 텍스트 */}
          <div className="relative z-[2] -my-8 px-2 text-center">
            <h2 className="text-[24px] md:text-[44px] font-extrabold leading-[1.35] tracking-[-0.02em] text-[#FF6A2B]">고급, 우아한 행사의<br />품격을 달리하는 사회자</h2>
            <p className="mt-4 text-[14px] leading-[1.75] text-[#6B7684]">첫 인사의 설렘부터 마지막 박수의 감동까지.<br />프리티풀은 품격 있는 사회와 안정적인 진행으로<br />기업의 특별한 순간을 완벽하게 완성합니다.</p>
          </div>
          {/* 하단 이미지 */}
          <div className="cmc-cross-img cmc-cross-b relative aspect-[4/5] w-[62%] self-end overflow-hidden bg-gradient-to-br from-[#F3EFEC] to-[#E6DED8]">
            <img src={`${MEDIA_DIR}/cross-02.jpg`} alt="" loading="lazy" className="relative h-full w-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-md">

        {/* ───────── SOLUTION (슬라이더) ───────── */}
        <section className="cmc-reveal px-5 py-12 text-center">
          <p className="cmc-script -mb-2 text-[34px] leading-none text-[#D7DEE8]">Verified MCs</p>
          <h2 className="text-[24px] md:text-[44px] font-extrabold leading-[1.28] tracking-[-0.02em]">검증된 <span className="text-[#3182F6]">전문 MC</span>가<br />필요합니다</h2>
          <p className="mt-2 text-[13px] text-[#9AA4B2]">방송사 아나운서 출신, 공식·브랜드행사 경험 검증</p>

          <div className="mt-7 text-left">
            <p className="mb-3 text-[13px] font-bold text-[#3182F6]">사회자 프로필</p>
            <div className="relative">
              <div className="cmc-track flex gap-3 overflow-x-auto pb-2" id="profileTrack">
                {PROFILE_SLIDES.map((s, i) => (
                  <div key={s.src} className="relative aspect-[3/4] w-[150px] flex-none overflow-hidden rounded-[20px] border border-[#EEF1F4] bg-[#F2F5F9]">
                    <div className="absolute left-3 top-3 z-[1] text-[11px] tracking-[0.18em] text-[#B0B8C1]">MC {String(i + 1).padStart(2, '0')}</div>
                    <img src={s.src} alt={s.name} loading="lazy" className="relative z-[2] h-full w-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    <div className="absolute inset-x-0 bottom-0 z-[3] bg-gradient-to-t from-black/65 to-transparent px-3.5 pb-3 pt-6 text-left text-white">
                      <p className="text-[11px] font-medium text-[#BBD9FF]">{s.role}</p>
                      <p className="text-[13.5px] font-bold">{s.name}</p>
                    </div>
                  </div>
                ))}
              </div>
              <button onClick={() => slide('profileTrack', -1)} aria-label="이전" className="cmc-arrow left-[-6px]">‹</button>
              <button onClick={() => slide('profileTrack', 1)} aria-label="다음" className="cmc-arrow right-[-6px]">›</button>
            </div>
          </div>

          <div className="mt-8 text-left">
            <p className="mb-3 text-[13px] font-bold text-[#3182F6]">행사 진행 모습</p>
            <div className="relative">
              <div className="cmc-track flex gap-3 overflow-x-auto pb-2" id="sceneTrack">
                {SCENE_SLIDES.map((s) => (
                  <div key={s.src} className="relative aspect-[16/10] w-[280px] flex-none overflow-hidden rounded-[20px] border border-[#EEF1F4] bg-[#F2F5F9]">
                    <img src={s.src} alt={s.cap} loading="lazy" className="relative z-[2] h-full w-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    <div className="absolute inset-x-0 bottom-0 z-[3] bg-gradient-to-t from-black/60 to-transparent px-4 pb-3 pt-8 text-left text-[13px] font-bold text-white">{s.cap}</div>
                  </div>
                ))}
              </div>
              <button onClick={() => slide('sceneTrack', -1)} aria-label="이전" className="cmc-arrow left-[-6px]">‹</button>
              <button onClick={() => slide('sceneTrack', 1)} aria-label="다음" className="cmc-arrow right-[-6px]">›</button>
            </div>
          </div>

          {/* 방송사 티커 */}
          <div className="cmc-ticker mt-9">
            <div className="cmc-ticker-track">
              {[0, 1].map((k) => (
                <span key={k} className="text-[14px] text-[#8B95A1]"><b className="text-[#3182F6]">KBS</b> · <b className="text-[#3182F6]">SBS</b> · <b className="text-[#3182F6]">MBC</b> · <b className="text-[#3182F6]">YTN</b> · <b className="text-[#3182F6]">JTBC</b> · 홈쇼핑 쇼호스트 · 호텔·컨벤션 경험 ·&nbsp;</span>
              ))}
            </div>
          </div>
        </section>

        {/* ───────── REFERENCE VIDEOS (있을 때만) ───────── */}
        {VIDEOS.length > 0 && (
          <section className="cmc-reveal px-5 py-12 text-center">
            <p className="cmc-script -mb-2 text-[34px] leading-none text-[#D7DEE8]">Reference</p>
            <h2 className="text-[24px] md:text-[44px] font-extrabold leading-[1.28] tracking-[-0.02em]">사진보다 확실한 건<br />실제 진행 영상입니다</h2>
            <div className="mt-6 space-y-3">
              {VIDEOS.map((v) => (
                <div key={v.src} className="relative overflow-hidden rounded-[20px] bg-black">
                  {v.src.includes('youtube.com') ? (
                    <iframe className="aspect-video w-full" src={v.src} title={v.cap} allowFullScreen />
                  ) : (
                    <video className="max-h-[440px] w-full object-contain" src={`${v.src}#t=0.1`} controls playsInline preload="metadata" />
                  )}
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-4 pb-3 pt-8 text-left text-[13px] font-bold text-white">{v.cap}</div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ───────── WHY (다크) ───────── */}
        <section className="cmc-reveal relative overflow-hidden bg-[#333D4B] px-5 py-14 text-white">
          <p className="cmc-script -mb-2 text-center text-[34px] leading-none text-white/15">Why Freetiful</p>
          <h2 className="text-center text-[24px] md:text-[44px] font-extrabold leading-[1.28] tracking-[-0.02em]">중요한 행사는<br />재미보다 <span className="text-[#6DA8FF]">안정감</span></h2>
          <p className="mt-2 text-center text-[13px] text-white/55">방송 3사 출신, 풍부한 경력의 검증된 사회자</p>
          <div className="mt-8 space-y-3">
            {WHYS.map((w) => (
              <div key={w.no} className="rounded-[22px] bg-white/[0.06] px-6 py-6">
                <div className="cmc-script mb-1 text-[30px] leading-none text-[#6DA8FF]">{w.no}</div>
                <h3 className="mb-2 text-[17px] font-bold">{w.title}</h3>
                <p className="text-[14px] leading-relaxed text-white/70">{w.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ───────── REVIEWS ───────── */}
        <section className="cmc-reveal px-5 py-14 text-center">
          <p className="cmc-script -mb-2 text-[34px] leading-none text-[#D7DEE8]">Reviews</p>
          <h2 className="text-[24px] md:text-[44px] font-extrabold leading-[1.28] tracking-[-0.02em]">잘 끝난 행사는,<br />담당자를 돋보이게 합니다</h2>
          <div className="mt-7 space-y-3 text-left">
            {REVIEWS.map((r) => (
              <div key={r.who} className="rounded-[22px] border border-[#EEF1F4] bg-[#F9FAFB] px-6 py-6">
                <div className="mb-3 flex gap-0.5">{[0, 1, 2, 3, 4].map((i) => <Star key={i} size={15} className="fill-[#FFC42E] text-[#FFC42E]" />)}</div>
                <p className="text-[15.5px] font-semibold leading-relaxed text-[#191F28]">&ldquo;{r.quote}&rdquo;</p>
                <p className="mt-3 text-[12.5px] text-[#9AA4B2]">{r.who}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ───────── PROCESS ───────── */}
        <section className="cmc-reveal px-5 py-12">
          <div className="text-center">
            <p className="cmc-script -mb-2 text-[34px] leading-none text-[#D7DEE8]">Process</p>
            <h2 className="text-[24px] md:text-[44px] font-extrabold leading-[1.28] tracking-[-0.02em]">섭외, 이렇게<br />간편하게 진행됩니다</h2>
          </div>
          <div className="mt-7 space-y-3">
            {STEPS.map((s) => (
              <div key={s.no} className="flex gap-4 rounded-[22px] bg-[#F7F9FC] px-5 py-5">
                <span className="mt-0.5 shrink-0 text-[12px] font-bold tracking-[0.14em] text-[#3182F6]">{s.no}</span>
                <div>
                  <h3 className="text-[16px] font-bold">{s.title}</h3>
                  <p className="mt-1 text-[14px] leading-relaxed text-[#6B7684]">{s.body}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ───────── SCALE ───────── */}
        <section className="cmc-reveal bg-[#F7F9FC] px-5 py-16 text-center">
          <p className="text-[25px] font-extrabold leading-[1.5] tracking-[-0.02em]">이미 <span className="text-[#3182F6]">1,200개 기업</span>의<br />행사가 프리티풀과 함께였습니다</p>
          <p className="mt-3 text-[15px] text-[#8B95A1]">이제 담당자님 차례입니다.</p>
        </section>

        {/* ───────── LEAD / FORM ───────── */}
        <section id="apply" className="cmc-reveal px-5 py-14">
          <div className="text-center">
            <p className="cmc-script -mb-2 text-[34px] leading-none text-[#D7DEE8]">Apply</p>
            <h2 className="text-[24px] md:text-[44px] font-extrabold leading-[1.28] tracking-[-0.02em]">행사 일정이 없어도<br />미리 확인해두세요</h2>
            <p className="mt-3 text-[13.5px] font-bold text-[#E5484D]">📅 기업행사는 보통 5~6개월 전부터 섭외됩니다.</p>
          </div>

          <div className="mt-7 rounded-[26px] border border-[#EEF1F4] bg-white p-6 shadow-[0_20px_44px_-28px_rgba(20,24,31,0.28)]">
            <p className="mb-2 text-[12px] font-semibold text-[#9AA4B2]">{step === 'done' ? '완료 · 100%' : `${step} / 4 단계 · ${pct}% 완료`}</p>
            <div className="mb-6 h-1.5 overflow-hidden rounded-full bg-[#EEF1F4]"><div className="h-full rounded-full bg-[#3182F6] transition-all duration-300" style={{ width: `${pct}%` }} /></div>

            {step === 1 && (
              <div className="cmc-fade">
                <h3 className="text-[18px] font-bold">먼저 담당자님 정보를 알려주세요</h3>
                <p className="mb-5 mt-1 text-[13.5px] text-[#8B95A1]">가능 MC와 견적을 안내드릴 연락처예요.</p>
                <Field label="성함 / 직함" value={name} onChange={setName} placeholder="예) 김OO 대리" />
                <Field label="회사명 (선택)" value={company} onChange={setCompany} placeholder="예) OO기업 인사팀" />
                <Field label="연락처" value={phone} onChange={setPhone} placeholder="010-0000-0000" type="tel" />
                <button className="cmc-btn-primary mt-2" onClick={() => goNext(1)}>다음 →</button>
                <p className="mt-3.5 text-center text-[12px] text-[#B0B8C1]">입력하신 정보는 MC 안내 목적으로만 사용됩니다.</p>
              </div>
            )}

            {step === 2 && (
              <div className="cmc-fade">
                <h3 className="text-[18px] font-bold">어떤 행사를 준비하고 계신가요?</h3>
                <p className="mb-5 mt-1 text-[13.5px] text-[#8B95A1]">행사 성격에 맞는 MC를 추천해드릴게요.</p>
                <div className="grid grid-cols-2 gap-2">
                  {EVENT_TYPES.map((t, i) => (
                    <button key={t} onClick={() => setEventType(t)} className={`cmc-opt ${i === EVENT_TYPES.length - 1 ? 'col-span-2' : ''} ${eventType === t ? 'cmc-opt-sel' : ''}`}>{t}</button>
                  ))}
                </div>
                <div className="mt-6 flex gap-2.5">
                  <button className="cmc-btn-ghost" onClick={() => setStep(1)}>← 이전</button>
                  <button className="cmc-btn-primary flex-1" onClick={() => goNext(2)}>다음 →</button>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="cmc-fade">
                <h3 className="text-[18px] font-bold">행사 정보를 알려주세요</h3>
                <p className="mb-5 mt-1 text-[13.5px] text-[#8B95A1]">행사일·지역·규모를 알면 더 잘 맞는 분을 추천할 수 있어요.</p>
                <Field label="행사 예정일" value={dateText} onChange={setDateText} placeholder="예) 2026년 12월 중순 / 미정" />
                <Field label="행사 지역" value={region} onChange={setRegion} placeholder="예) 서울 강남 / 호텔 미정" />
                <Field label="예상 참석 인원 (선택)" value={size} onChange={setSize} placeholder="예) 100명 내외" />
                <div className="mt-6 flex gap-2.5">
                  <button className="cmc-btn-ghost" onClick={() => setStep(2)}>← 이전</button>
                  <button className="cmc-btn-primary flex-1" onClick={() => goNext(3)}>다음 →</button>
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="cmc-fade">
                <h3 className="text-[18px] font-bold">마지막이에요!</h3>
                <p className="mb-5 mt-1 text-[13.5px] text-[#8B95A1]">필요한 자료를 함께 보내드릴게요. (복수 선택)</p>
                <div className="grid grid-cols-1 gap-2">
                  {BENEFITS.map((b) => (
                    <button key={b} onClick={() => setBenefits((prev) => prev.includes(b) ? prev.filter((x) => x !== b) : [...prev, b])} className={`cmc-chk ${benefits.includes(b) ? 'cmc-chk-sel' : ''}`}>
                      <span className="cmc-box">{benefits.includes(b) && <Check size={12} strokeWidth={3} />}</span>{b}
                    </button>
                  ))}
                </div>
                <button onClick={() => setConsent(!consent)} className={`cmc-chk mt-2 w-full ${consent ? 'cmc-chk-sel' : ''}`}>
                  <span className="cmc-box">{consent && <Check size={12} strokeWidth={3} />}</span>개인정보 수집·이용에 동의합니다
                </button>
                <div className="mt-6 flex gap-2.5">
                  <button className="cmc-btn-ghost" onClick={() => setStep(3)}>← 이전</button>
                  <button className="cmc-btn-primary flex-1" disabled={submitting} onClick={submit}>{submitting ? '접수 중…' : '가능 MC · 견적 신청 🎯'}</button>
                </div>
              </div>
            )}

            {step === 'done' && (
              <div className="cmc-fade py-4 text-center">
                <div className="mb-3 text-[44px]">🎯</div>
                <h3 className="text-[21px] font-bold">신청 완료!</h3>
                <p className="mt-2 text-[14.5px] leading-relaxed text-[#6B7684]">1영업일 내에 행사에 맞는 가능 MC와<br />예상 견적을 안내드릴게요.</p>
                <button onClick={() => router.push('/inquiries')} className="cmc-btn-primary mt-6">내 문의 내역 보기</button>
                <p className="mt-4 text-[12.5px] text-[#B0B8C1]">가능 MC·견적은 문의목록과 연락처로 안내됩니다.</p>
              </div>
            )}
          </div>
        </section>

        <footer className="border-t border-[#F0EEE9] px-5 py-10 text-center">
          <p className="text-[14px] text-[#6B7684]"><b className="text-[#191F28]">1,200개 기업</b>이 프리티풀 MC와 함께했습니다.</p>
          <button onClick={scrollToApply} className="cmc-btn-primary mx-auto mt-5 !w-auto px-8">🎯 가능 MC · 견적 무료 확인</button>
          <p className="mt-5 text-[11px] leading-relaxed text-[#B0B8C1]">© FREETIFUL · CORPORATE MC<br />본 페이지의 후기는 실제 고객 사례를 바탕으로 재구성되었습니다.</p>
        </footer>
      </div>

      {/* 하단 고정 CTA (히어로 지난 뒤) */}
      <div className={`fixed inset-x-0 bottom-0 z-30 transition-transform duration-300 ${scrolled ? 'translate-y-0' : 'translate-y-full'}`}>
        <div className="mx-auto max-w-md px-4 pb-[max(14px,env(safe-area-inset-bottom))] pt-3" style={{ background: 'linear-gradient(transparent, #fff 32%)' }}>
          <button onClick={scrollToApply} className="w-full rounded-full bg-[#3182F6] py-4 text-[16px] font-bold text-white shadow-[0_14px_30px_-10px_rgba(49,128,247,0.6)] active:scale-[0.98]">가능 MC · 견적 확인하기</button>
        </div>
      </div>
    </main>
  );
}

// freetiful 로고 — 워드마크(reetiful)는 currentColor로 히어로=흰색 / 스크롤=검정 토글, f 마크는 브랜드 컬러 고정
function FreetifulLogo({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 472 137" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-label="freetiful">
      <g fill="currentColor">
        <path d="M420.394 118.653C420.009 118.955 419.702 119.346 419.499 119.791C416.623 124.256 412.391 127.678 407.426 129.555C405.18 130.411 402.817 130.922 400.419 131.073C397.772 131.281 395.11 131.099 392.516 130.534C387.117 129.278 383.389 126.056 381.236 120.972C380.15 118.271 379.462 115.427 379.196 112.529C378.995 110.599 378.903 108.659 378.919 106.719C378.919 98.3711 378.919 90.0231 378.919 81.6751C378.894 80.7063 378.967 79.7375 379.139 78.7837C379.71 76.0113 381.29 73.5502 383.573 71.8782C385.856 70.2063 388.678 69.4428 391.491 69.736C394.304 70.0292 396.909 71.3581 398.798 73.4648C400.687 75.5715 401.727 78.3056 401.715 81.1363C401.738 83.2005 401.715 85.2685 401.715 87.3328C401.715 91.9293 401.715 96.5245 401.715 101.118C401.718 103.397 402.065 105.663 402.743 107.839C403.053 108.846 403.484 109.812 404.028 110.715C404.48 111.479 405.055 112.162 405.731 112.737C406.692 113.574 407.898 114.078 409.169 114.174C410.44 114.27 411.708 113.952 412.784 113.269C413.917 112.53 414.886 111.567 415.631 110.438C417.062 108.292 418.014 105.863 418.422 103.315C418.623 102.061 418.709 100.791 418.68 99.5209C418.68 93.3661 418.68 87.2114 418.68 81.0566C418.649 78.0375 419.817 75.1296 421.929 72.9727C424.04 70.8158 426.921 69.5865 429.938 69.5553C432.955 69.5241 435.861 70.6935 438.016 72.8063C440.172 74.9191 441.4 77.8022 441.431 80.8213C441.431 81.0756 441.431 81.3298 441.431 81.5802C441.431 97.0114 441.431 112.443 441.431 127.874C441.431 129.684 441.647 129.43 439.914 129.433C433.893 129.433 427.871 129.433 421.85 129.433H421.221C420.39 129.433 420.379 129.433 420.375 128.58C420.375 125.751 420.375 122.927 420.375 120.106L420.394 118.653Z"/>
        <path d="M227.76 105.131C223.297 105.131 218.834 105.131 214.371 105.131C213.112 105.131 213.234 105.203 213.31 106.224C213.373 108.123 213.758 109.998 214.447 111.768C214.743 112.511 215.125 113.216 215.585 113.87C216.193 114.76 216.978 115.513 217.892 116.083C218.806 116.654 219.828 117.028 220.893 117.183C224.12 117.726 227.436 117.147 230.289 115.544C231.165 115.039 232.009 114.48 232.815 113.87C233.425 113.422 234.047 112.99 234.676 112.565C238.468 110.007 243.8 111.772 245.536 116.211C246.201 117.825 246.296 119.618 245.805 121.293C245.315 122.968 244.267 124.426 242.837 125.425C239.872 127.52 236.554 129.063 233.042 129.978C230.105 130.732 227.088 131.133 224.056 131.173C220.182 131.298 216.31 130.897 212.544 129.982C207.557 128.722 203.087 126.48 199.325 122.92C196.359 120.143 194.075 116.717 192.652 112.91C189.447 104.354 189.353 95.7626 192.792 87.2552C194.758 82.2658 198.059 77.9149 202.334 74.6803C206.609 71.4458 211.693 69.4527 217.025 68.9199C222.36 68.3298 227.759 68.9591 232.815 70.7603C239.158 73.037 243.853 77.2566 246.954 83.2444C248.888 86.9546 250.098 90.9997 250.519 95.1631C250.871 98.6806 249.381 101.473 246.496 103.511C244.778 104.718 242.818 105.131 240.755 105.139C237.892 105.139 235.029 105.139 232.166 105.139L227.76 105.131ZM214.03 91.3989C214.335 91.5466 214.679 91.5918 215.012 91.5279H227.256C228.617 91.5279 228.393 91.5051 228.185 90.3516C227.89 88.5151 227.221 86.7586 226.221 85.191C225.049 83.4455 223.46 82.4058 221.322 82.2692C219.285 82.144 217.602 82.7928 216.343 84.4321C215.911 85.0048 215.551 85.6279 215.27 86.2876C214.785 87.4092 214.431 88.5832 214.216 89.7862C214.11 90.3175 213.886 90.8373 214.03 91.3989Z"/>
        <path d="M163.239 105.132H150.229C149.892 105.132 149.554 105.132 149.217 105.132C148.88 105.132 148.785 105.265 148.792 105.614C148.834 107.997 149.198 110.316 150.267 112.475C151.667 115.298 153.904 116.937 157.062 117.26C158.36 117.405 159.672 117.383 160.964 117.195C163.301 116.821 165.517 115.897 167.429 114.501C168.29 113.894 169.128 113.256 170.004 112.672C170.865 112.061 171.85 111.648 172.889 111.461C174.61 111.237 176.356 111.6 177.845 112.491C179.334 113.382 180.48 114.75 181.097 116.373C181.714 117.995 181.766 119.779 181.246 121.435C180.725 123.092 179.662 124.524 178.228 125.501C175.038 127.717 171.457 129.308 167.676 130.191C165.007 130.797 162.282 131.123 159.546 131.163C156.053 131.275 152.559 130.971 149.137 130.256C145.168 129.435 141.399 127.836 138.05 125.551C133.223 122.204 129.894 117.7 127.877 112.205C126.893 109.467 126.257 106.617 125.981 103.721C125.469 99.0973 125.925 94.418 127.319 89.9805C129.829 82.0765 134.607 76.0014 141.978 72.0892C145.381 70.3018 149.107 69.2154 152.937 68.8942C157.601 68.4485 162.306 68.915 166.792 70.2678C174.414 72.5749 179.828 77.4243 183.139 84.6492C184.619 87.9157 185.59 91.3902 186.017 94.9514C186.601 99.5807 183.362 104.058 178.509 104.946C177.679 105.093 176.838 105.164 175.995 105.159C171.74 105.136 167.489 105.127 163.239 105.132ZM156.573 91.5515H162.64C162.936 91.5515 163.232 91.5515 163.524 91.5515C163.816 91.5515 163.869 91.3655 163.827 91.1189C163.585 89.4046 163.073 87.7396 162.31 86.186C161.709 84.9223 160.759 83.8571 159.572 83.1162C158.248 82.2976 156.654 82.0376 155.139 82.3932C153.623 82.7488 152.311 83.6911 151.488 85.0134C150.294 86.9107 149.824 89.0471 149.482 91.2175C149.475 91.2593 149.477 91.3022 149.488 91.3431C149.5 91.3839 149.52 91.4217 149.548 91.4534C149.577 91.4852 149.611 91.5102 149.651 91.5265C149.69 91.5428 149.732 91.5501 149.774 91.5477C150.066 91.5666 150.362 91.5667 150.658 91.5667L156.573 91.5515Z"/>
        <path d="M360.985 106.384V127.88C360.985 128.26 360.985 128.639 360.985 129.018C360.988 129.07 360.981 129.122 360.963 129.171C360.945 129.219 360.918 129.264 360.882 129.302C360.847 129.339 360.804 129.369 360.756 129.39C360.709 129.41 360.658 129.421 360.606 129.421C360.356 129.421 360.102 129.421 359.847 129.421H339.372C338.181 129.421 338.234 129.519 338.234 128.244C338.234 113.744 338.234 99.2451 338.234 84.7474C338.234 84.368 338.234 83.9885 338.234 83.609C338.236 83.5458 338.225 83.4828 338.2 83.4245C338.175 83.3663 338.138 83.3141 338.091 83.2718C338.044 83.2295 337.988 83.198 337.928 83.1795C337.867 83.1611 337.804 83.1561 337.741 83.1651C337.237 83.1651 336.732 83.1651 336.224 83.1385C334.749 83.0963 333.329 82.5718 332.18 81.6453C331.031 80.7188 330.217 79.4412 329.862 78.0079C329.507 76.5746 329.632 75.0644 330.216 73.7084C330.8 72.3524 331.811 71.225 333.096 70.4988C334.05 69.9504 335.128 69.654 336.228 69.6375C336.732 69.6375 337.237 69.6375 337.745 69.6375C337.808 69.6465 337.872 69.6415 337.933 69.6228C337.993 69.6042 338.049 69.5723 338.096 69.5296C338.144 69.4868 338.181 69.4342 338.205 69.3754C338.229 69.3167 338.241 69.2533 338.238 69.1897C338.238 68.852 338.238 68.5143 338.238 68.1766C338.238 65.9871 338.238 63.7939 338.238 61.6006C338.228 59.1548 338.599 56.7224 339.337 54.391C340.911 49.5491 344.092 46.2365 348.844 44.4416C351.576 43.4333 354.466 42.9194 357.379 42.9238C360.913 42.8897 364.451 42.9466 367.996 42.9048C369.783 42.8822 371.506 43.5709 372.786 44.8194C374.065 46.068 374.797 47.7741 374.82 49.5624C374.842 51.3507 374.154 53.0748 372.906 54.3554C371.659 55.6359 369.954 56.368 368.167 56.3907C367.367 56.3952 366.571 56.4984 365.797 56.698C362.938 57.5101 361.413 59.8096 361.076 62.3595C361.029 62.8209 361.01 63.2847 361.019 63.7483C361.019 65.2244 361.019 66.7005 361.019 68.1766C361.019 69.7855 360.848 69.6261 362.536 69.6299C364.345 69.6299 366.157 69.6299 367.966 69.6299C369.025 69.608 370.073 69.8475 371.017 70.3274C371.962 70.8072 372.773 71.5125 373.381 72.381C374.939 74.5438 375.174 76.9116 374.018 79.3136C373.531 80.4238 372.736 81.3712 371.728 82.0437C370.72 82.7162 369.541 83.0856 368.33 83.1082C366.358 83.2106 364.375 83.1423 362.396 83.1537C360.921 83.1537 361.019 82.9829 361.019 84.4894L360.985 106.384Z"/>
        <path d="M259.744 97.7846V84.7617C259.744 84.4239 259.744 84.0862 259.744 83.7485C259.744 83.2742 259.638 83.1945 259.122 83.1793C258.607 83.1641 258.197 83.1793 257.735 83.1566C256.195 83.106 254.719 82.5304 253.551 81.5252C252.383 80.5201 251.593 79.1457 251.312 77.6298C251.032 76.1139 251.277 74.5476 252.008 73.1905C252.739 71.8333 253.911 70.7669 255.331 70.1678C256.067 69.8516 256.858 69.6803 257.659 69.6631C258.163 69.6631 258.671 69.6631 259.176 69.6404C259.68 69.6176 259.744 69.5265 259.744 69.0142C259.744 66.7375 259.744 64.4608 259.744 62.184C259.728 60.3234 260.154 58.4855 260.988 56.8224C262.072 54.6978 263.793 52.9665 265.911 51.8719C268.029 50.7773 270.437 50.3745 272.795 50.7199C275.153 51.0654 277.344 52.1419 279.06 53.798C280.775 55.4541 281.929 57.6066 282.359 59.9529C282.494 60.7844 282.554 61.6263 282.541 62.4686C282.564 64.4494 282.541 66.4302 282.541 68.4109C282.541 68.7069 282.541 69.0029 282.575 69.2951C282.578 69.3803 282.613 69.4613 282.674 69.5212C282.734 69.5812 282.816 69.6157 282.901 69.6176C283.193 69.6404 283.489 69.6441 283.785 69.6441H289.472C290.401 69.6236 291.324 69.8062 292.175 70.1791C293.027 70.552 293.786 71.1063 294.402 71.8032C296.298 73.913 296.76 76.3567 295.691 78.9674C295.253 80.1693 294.463 81.211 293.424 81.9558C292.385 82.7006 291.145 83.1139 289.867 83.1414C287.937 83.2552 285.995 83.1755 284.058 83.1907C282.438 83.1907 282.541 82.9706 282.541 84.644C282.541 92.4418 282.601 100.24 282.514 108.034C282.473 111.752 284.755 114.515 288.278 115.513C289.333 115.81 290.424 115.953 291.52 115.938C292.149 115.938 292.783 115.938 293.416 115.938C293.479 115.931 293.543 115.939 293.602 115.96C293.662 115.981 293.716 116.016 293.761 116.061C293.805 116.106 293.839 116.161 293.859 116.221C293.88 116.281 293.886 116.345 293.878 116.408C293.878 116.575 293.878 116.746 293.878 116.913V128.418C293.878 128.631 293.878 128.839 293.878 129.048C293.879 129.101 293.868 129.154 293.846 129.202C293.825 129.251 293.794 129.295 293.754 129.331C293.715 129.366 293.669 129.393 293.618 129.41C293.568 129.427 293.514 129.433 293.461 129.427H292.957C288.536 129.427 284.114 129.48 279.686 129.408C276.696 129.4 273.727 128.917 270.888 127.978C268.637 127.25 266.573 126.035 264.844 124.419C262.509 122.187 261.174 119.421 260.457 116.321C259.961 114.098 259.721 111.825 259.74 109.548C259.748 105.627 259.749 101.706 259.744 97.7846Z"/>
        <path d="M471.435 91.0004C471.435 103.31 471.435 115.618 471.435 127.925C471.435 129.621 471.621 129.443 469.983 129.443H450.155C449.859 129.443 449.567 129.443 449.272 129.443C448.779 129.424 448.71 129.352 448.692 128.836C448.692 128.54 448.692 128.244 448.692 127.948C448.692 103.546 448.692 79.1424 448.692 54.7358C448.634 52.5339 449.194 50.3599 450.307 48.4597C451.485 46.4955 453.226 44.9316 455.304 43.9717C457.383 43.0118 459.701 42.7003 461.959 43.0779C464.217 43.4554 466.309 44.5044 467.962 46.0883C469.616 47.6722 470.755 49.7176 471.23 51.9582C471.394 52.7851 471.468 53.6274 471.45 54.4702C471.437 66.6432 471.432 78.8199 471.435 91.0004Z"/>
        <path d="M94.7915 80.5492C95.1762 80.3373 95.4941 80.0218 95.7091 79.6385C97.8805 76.7781 100.545 74.3288 103.577 72.4061C107.559 69.8981 112.191 68.6192 116.894 68.7292C120.307 68.7937 123.006 70.2091 124.751 73.184C125.797 74.8908 126.224 76.9056 125.962 78.8905C125.7 80.8754 124.763 82.7097 123.31 84.0858C122.59 84.795 121.822 85.4543 121.012 86.0589C117.831 88.2939 114.517 88.3357 111.134 86.5257C110.404 86.1022 109.726 85.5926 109.117 85.0078C108.244 84.2056 107.176 83.6469 106.019 83.3876C104.006 82.955 102.273 83.5355 100.764 84.8636C99.8529 85.6861 99.1133 86.6803 98.5871 87.7892C97.5565 89.9647 96.9246 92.3077 96.7215 94.7067C96.5669 96.2195 96.496 97.7396 96.5092 99.2602C96.5092 108.873 96.5092 118.486 96.5092 128.099C96.5092 129.617 96.6381 129.461 95.1631 129.461H74.9526C73.6596 129.461 73.7089 129.567 73.7089 128.239C73.7089 115.844 73.7089 103.448 73.7089 91.0526C73.7089 87.258 73.7089 83.4634 73.7089 79.6689C73.6751 77.8065 74.1093 75.9655 74.9715 74.3148C76.0693 72.2638 77.8142 70.6338 79.9344 69.679C82.0546 68.7242 84.4309 68.4981 86.6928 69.0361C88.9548 69.5741 90.9754 70.8458 92.4396 72.6531C93.9038 74.4604 94.7294 76.7017 94.7877 79.0276C94.799 79.464 94.7915 79.9231 94.7915 80.5492Z"/>
        <path d="M324.335 104.663C324.335 112.417 324.335 120.169 324.335 127.92C324.335 129.631 324.502 129.438 322.886 129.438C316.238 129.438 309.59 129.438 302.941 129.438C301.425 129.438 301.554 129.665 301.554 127.996V106.746C301.554 98.2768 301.554 89.8086 301.554 81.3417C301.554 78.6855 302.228 76.238 303.882 74.151C306.892 70.3565 310.855 68.888 315.542 69.977C320.228 71.0661 323.015 74.151 324.119 78.7728C324.294 79.5969 324.373 80.4386 324.354 81.281C324.331 89.0725 324.325 96.8665 324.335 104.663Z"/>
        <path d="M312.914 42.9332C313.547 42.9332 314.177 42.9332 314.81 42.9332C318.86 42.8459 323.296 45.9233 324.184 50.9018C324.606 53.3105 324.104 55.7899 322.779 57.8447C321.454 59.8995 319.403 61.3783 317.036 61.9856C316.794 62.0536 316.549 62.1068 316.3 62.145C314.169 62.4024 312.014 62.4113 309.881 62.1716C307.644 61.8562 305.588 60.768 304.068 59.0955C302.549 57.4229 301.662 55.2713 301.561 53.0131C301.459 50.7549 302.15 48.5324 303.514 46.7304C304.878 44.9284 306.828 43.6603 309.028 43.1457C309.681 42.9924 310.351 42.916 311.022 42.918L312.914 42.9332Z"/>
      </g>
      <path d="M29.5977 98.7611C29.3892 99.1937 29.4954 99.6604 29.4954 100.108C29.4954 108.203 29.4954 116.298 29.4954 124.393C29.505 126.426 29.0002 128.429 28.0279 130.214C26.844 132.373 25.0078 134.101 22.7822 135.152C20.5567 136.202 18.056 136.521 15.6384 136.063C13.2207 135.604 11.0101 134.391 9.32328 132.598C7.63641 130.806 6.55979 128.525 6.24763 126.082C6.17689 125.498 6.14018 124.91 6.13766 124.321C6.13766 105.307 6.08079 86.2922 6.15662 67.2777C6.18696 58.7248 9.39864 51.4355 15.5793 45.5084C19.0906 42.1426 23.2047 39.7103 27.6829 37.8585C32.1755 36.0448 36.8711 34.7821 41.6672 34.0981C46.2508 33.4368 50.8763 33.1084 55.5073 33.1153C58.5258 33.1398 61.4174 34.3341 63.5745 36.4471C65.7316 38.5602 66.9864 41.4277 67.0752 44.4472C67.1641 47.4666 66.0801 50.403 64.0509 52.6394C62.0218 54.8759 59.2055 56.2383 56.1937 56.4405C54.9348 56.5088 53.6721 56.5088 52.4018 56.5543C48.1066 56.652 43.839 57.2686 39.6916 58.3909C37.9442 58.8695 36.2524 59.5322 34.6447 60.3678C33.7872 60.8191 32.9757 61.3529 32.2217 61.9615C30.4509 63.3921 29.4385 65.2097 29.4537 67.5282C29.4437 68.1619 29.4741 68.7956 29.5447 69.4254C29.7765 71.1135 30.6447 72.649 31.9714 73.7171C33.5419 74.998 35.3443 75.9642 37.28 76.563C40.1993 77.5364 43.2579 78.026 46.3349 78.0125C46.9226 78.0125 47.5104 77.9252 48.0981 77.8873C53.1526 77.5382 57.1227 79.4431 59.6101 83.8789C60.4888 85.4488 60.9917 87.2012 61.0791 88.9985C61.1666 90.7957 60.8363 92.5888 60.1142 94.2367C59.3921 95.8846 58.2978 97.3424 56.9175 98.4955C55.5372 99.6486 53.9084 100.466 52.1592 100.882C51.0513 101.136 49.9206 101.277 48.7844 101.303C46.002 101.443 43.213 101.367 40.4424 101.076C37.0977 100.697 33.7966 100 30.5836 98.9964C30.2739 98.8532 29.9387 98.7732 29.5977 98.7611Z" fill="#0B58FF"/>
      <path d="M15.7396 31.976C7.51127 32.124 -0.00414451 25.2749 0.00723099 16.2324C-0.0566679 14.1233 0.303467 12.0228 1.06626 10.0556C1.82906 8.08835 2.97897 6.29453 4.44777 4.78054C5.91656 3.26656 7.6743 2.06326 9.61667 1.24205C11.559 0.42085 13.6465 -0.00152127 15.7551 4.11696e-06C17.8637 0.0015295 19.9505 0.426917 21.8917 1.25093C23.8329 2.07494 25.5889 3.28078 27.0555 4.79689C28.5221 6.31301 29.6694 8.1085 30.4294 10.0768C31.1893 12.0451 31.5464 14.1461 31.4795 16.2552C31.4757 25.2862 24.0247 32.1316 15.7396 31.976Z" fill="#68DEFF"/>
    </svg>
  );
}

function Field({ label, value, onChange, placeholder, type = 'text' }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <div className="mb-3.5">
      <label className="mb-1.5 block text-[13px] font-semibold text-[#3D4148]">{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="w-full rounded-[12px] border border-[#E5E8EB] bg-[#FAFBFC] px-4 py-3 text-[15px] outline-none transition focus:border-[#3182F6]" />
    </div>
  );
}

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Allura&display=swap');
@font-face{font-family:'Condor';src:url('/fonts/Condor-Regular.otf') format('opentype');font-weight:400;font-style:normal;font-display:swap}
@font-face{font-family:'Condor';src:url('/fonts/Condor-Medium.otf') format('opentype');font-weight:500;font-style:normal;font-display:swap}
.cmc{font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Apple SD Gothic Neo',Pretendard,system-ui,sans-serif;overflow-x:hidden}
/* 영어 subtitle — Condor 폰트(대문자·자간) */
.cmc .cmc-script{font-family:'Condor',-apple-system,sans-serif;font-weight:500;letter-spacing:0.04em}
.cmc .cmc-condor{font-family:'Condor',-apple-system,sans-serif;font-weight:400}
.cmc-reveal{opacity:0;transform:translateY(24px);transition:opacity .9s cubic-bezier(.22,1,.36,1),transform .9s cubic-bezier(.22,1,.36,1);will-change:opacity,transform}
.cmc-reveal.cmc-in{opacity:1;transform:none}
.cmc-track{scroll-snap-type:x mandatory;scrollbar-width:none;-ms-overflow-style:none}
.cmc-track::-webkit-scrollbar{display:none}
.cmc-track>*{scroll-snap-align:start}
.cmc-arrow{position:absolute;top:50%;transform:translateY(-50%);width:34px;height:34px;border-radius:50%;border:1px solid #EEF1F4;background:#fff;color:#191F28;font-size:18px;display:flex;align-items:center;justify-content:center;z-index:5;box-shadow:0 6px 16px -8px rgba(0,0,0,.3)}
/* 글래스 버튼 — 고급 유리 질감 */
.cmc-glass{position:relative;background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.28);backdrop-filter:blur(14px) saturate(140%);-webkit-backdrop-filter:blur(14px) saturate(140%);box-shadow:0 8px 32px -8px rgba(0,0,0,0.45),inset 0 1px 0 rgba(255,255,255,0.4);overflow:hidden;transition:background .25s,border-color .25s,transform .15s}
.cmc-glass::after{content:'';position:absolute;inset:0;border-radius:inherit;background:linear-gradient(135deg,rgba(255,255,255,0.35),transparent 42%);pointer-events:none;opacity:.7}
.cmc-glass:hover{background:rgba(255,255,255,0.2);border-color:rgba(255,255,255,0.42)}
.cmc-glass-primary{background:rgba(49,130,246,0.28);border-color:rgba(255,255,255,0.38);box-shadow:0 10px 34px -8px rgba(49,130,246,0.55),inset 0 1px 0 rgba(255,255,255,0.5)}
.cmc-glass-primary:hover{background:rgba(49,130,246,0.4)}
/* 교차 이미지 섹션 — 위에서 겹쳤다가 스크롤 내리며 텍스트 여백만큼 벌어짐(--spread:0→1) */
.cmc-cross-sec{--spread:0}
.cmc-cross-img{will-change:transform}
.cmc-cross-a{transform:translateY(calc(60px * (1 - var(--spread))))}
.cmc-cross-b{transform:translateY(calc(-60px * (1 - var(--spread))))}
.cmc-ticker{overflow:hidden;-webkit-mask-image:linear-gradient(90deg,transparent,#000 12%,#000 88%,transparent);mask-image:linear-gradient(90deg,transparent,#000 12%,#000 88%,transparent)}
.cmc-ticker-track{display:flex;white-space:nowrap;width:max-content;animation:cmcTicker 24s linear infinite}
@keyframes cmcTicker{to{transform:translateX(-50%)}}
@keyframes cmcRise{from{opacity:0;transform:translateY(26px)}to{opacity:1;transform:none}}
/* 고급 진입: 블러가 걷히며 살짝 확대→정착하는 시네마틱 리빌 */
@keyframes cmcReveal{from{opacity:0;transform:translateY(34px) scale(1.06);filter:blur(18px)}to{opacity:1;transform:none;filter:blur(0)}}
/* 첫 진입 커튼: 검은 막이 위로 걷히며 배경(영상) 노출 */
@keyframes cmcCurtain{0%{opacity:1}60%{opacity:1}100%{opacity:0;clip-path:inset(0 0 100% 0)}}
/* 배경 영상 슬로우 줌(켄 번스) */
@keyframes cmcKen{from{transform:scale(1.12)}to{transform:scale(1)}}
.cmc-hero-curtain{animation:cmcCurtain 1.5s cubic-bezier(.65,0,.35,1) forwards}
.cmc-hero-video{animation:cmcKen 6s ease-out forwards;will-change:transform}
.cmc-hero-eyebrow{opacity:0;letter-spacing:.42em;animation:cmcReveal 1s cubic-bezier(.19,1,.22,1) .55s forwards,cmcTrackIn 1.4s cubic-bezier(.19,1,.22,1) .55s forwards}
@keyframes cmcTrackIn{to{letter-spacing:.1em}}
.cmc-hero-line{opacity:0;animation:cmcReveal 1.15s cubic-bezier(.19,1,.22,1) forwards}
.cmc-line-1{animation-delay:.7s}
.cmc-line-2{animation-delay:.92s}
.cmc-hero-sub{opacity:0;animation:cmcReveal 1s cubic-bezier(.19,1,.22,1) 1.3s forwards}
.cmc-hero-cta{opacity:0;animation:cmcReveal 1s cubic-bezier(.19,1,.22,1) 1.55s forwards}
@keyframes cmcBounce{0%,100%{transform:translate(-50%,0)}50%{transform:translate(-50%,8px)}}
.cmc-scrollhint{opacity:0;animation:cmcRise .8s ease 1.9s forwards,cmcBounce 1.8s ease-in-out 1.9s infinite}
@keyframes cmcFade{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
.cmc-fade{animation:cmcFade .35s ease}
.cmc-btn-primary{display:inline-flex;width:100%;align-items:center;justify-content:center;border-radius:999px;background:#191F28;color:#fff;font-size:15px;font-weight:700;padding:15px 24px;transition:transform .15s,opacity .15s}
.cmc-btn-primary:active{transform:scale(.98)}
.cmc-btn-primary:disabled{opacity:.6}
.cmc-btn-ghost{flex:0 0 auto;border-radius:999px;border:1px solid #E5E8EB;background:#fff;color:#4E5968;font-size:15px;font-weight:600;padding:15px 20px}
.cmc-opt{border:1px solid #E5E8EB;border-radius:12px;padding:14px 14px;font-size:14px;font-weight:500;text-align:left;background:#FAFBFC;color:#191F28;transition:all .15s}
.cmc-opt-sel{border-color:#3182F6;background:#EEF5FF;color:#1F6FE5;font-weight:700}
.cmc-chk{display:flex;align-items:center;gap:10px;border:1px solid #E5E8EB;border-radius:12px;padding:13px 15px;font-size:14px;background:#FAFBFC;color:#191F28;text-align:left;transition:all .15s}
.cmc-chk-sel{border-color:#3182F6;background:#EEF5FF}
.cmc-box{width:20px;height:20px;flex-shrink:0;border:1.5px solid #C4CCD4;border-radius:6px;display:flex;align-items:center;justify-content:center;color:#fff;background:#fff;transition:all .15s}
.cmc-chk-sel .cmc-box{background:#3182F6;border-color:#3182F6}
`;

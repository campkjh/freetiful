'use client';

/**
 * 전문행사(기업행사) MC 랜딩 — 홈 "전문행사 사회자 찾기" 진입.
 * 톤앤매너: wedding-mc 페이지 기준(화이트 + 블루 #3182F6, 라운드 카드, 스크롤 리빌).
 * 히어로: 풀스크린 배경 영상 + 카피 오버레이 → 스크롤 시 하단 콘텐츠.
 * 폼 제출: wedding-mc 와 동일하게 matchApi (source: landing_corporate_mc_v1).
 */

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronDown, Star, Check } from 'lucide-react';
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
const PAINS = [
  { tag: '어색한 침묵', body: '발표 사이 정적이 흐르는데 사회자가 받아주질 못해서, 행사장 분위기가 그대로 가라앉았어요.' },
  { tag: '잘못된 호칭', body: '임원 직함을 잘못 부르는 바람에, 식이 끝나고도 한참 사과하고 다녔습니다.' },
  { tag: '밀리는 식순', body: '시간 조율을 못 해서 식순이 계속 밀렸고, 결국 대표님 다음 일정까지 꼬여버렸어요.' },
  { tag: '맞지 않는 톤', body: '시상식인데 너무 가벼운 진행이라, 회사 이미지가 우스워 보일까 봐 내내 조마조마했습니다.' },
];
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
  const statsRef = useRef<HTMLDivElement>(null);
  const counted = useRef(false);
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

  // 헤더 배경 전환(히어로 지나면 흰 배경)
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > window.innerHeight * 0.7);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
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

  // 통계 카운트업
  useEffect(() => {
    const el = statsRef.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting || counted.current) return;
        counted.current = true;
        el.querySelectorAll<HTMLElement>('.num[data-target]').forEach((n) => {
          const target = Number(n.dataset.target || 0);
          const suffix = n.dataset.suffix || '';
          if (!target) { n.textContent = `0${suffix}`; return; }
          const start = performance.now();
          const dur = 1200;
          const tick = (now: number) => {
            const p = Math.min((now - start) / dur, 1);
            const eased = 1 - Math.pow(1 - p, 3);
            n.textContent = Math.floor(target * eased).toLocaleString('ko-KR') + suffix;
            if (p < 1) requestAnimationFrame(tick);
            else n.textContent = target.toLocaleString('ko-KR') + suffix;
          };
          requestAnimationFrame(tick);
        });
      });
    }, { threshold: 0.4 });
    io.observe(el);
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
          <span className={`text-[15px] font-extrabold tracking-tight transition-colors ${scrolled ? 'text-[#191F28]' : 'text-white'}`}>프리티풀 <span className="text-[#3182F6]">MC</span></span>
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
        {/* 첫 진입 커튼 — 고급스럽게 걷히는 오프닝 */}
        <div className="cmc-hero-curtain pointer-events-none absolute inset-0 z-20 bg-black" />
        <div className="relative z-10 px-5 text-center">
          <p className="cmc-hero-eyebrow mb-4 text-[12px] font-semibold uppercase tracking-[0.1em] text-white/70 md:mb-5 md:text-[14px]">Corporate Event MC</p>
          <h1 className="font-extrabold leading-[1.3] tracking-[-0.02em] text-white drop-shadow-[0_2px_18px_rgba(0,0,0,0.5)]">
            <span className="cmc-hero-line cmc-line-1 block text-[24px] md:text-[44px]">중요한 행사의 완성도는</span>
            <span className="cmc-hero-line cmc-line-2 mt-1 block text-[24px] md:text-[44px]">
              <span className="text-[#6DA8FF]">사회자</span>에 따라 달라집니다
            </span>
          </h1>
          <p className="cmc-hero-sub mt-6 text-[14px] font-medium leading-relaxed text-white/80 md:mt-7 md:text-[18px]">
            KBS · SBS · MBC 아나운서 출신<br />검증된 전문 MC를 행사 성격에 맞춰
          </p>
          <button onClick={scrollToApply} className="cmc-hero-cta mt-8 inline-flex items-center gap-2 rounded-full bg-white px-7 py-3.5 text-[15px] font-bold text-[#191F28] shadow-[0_12px_30px_-8px_rgba(0,0,0,0.5)] transition active:scale-95 md:mt-10 md:px-9 md:py-4 md:text-[17px]">
            행사일 기준 가능 MC 확인하기
          </button>
        </div>
        {/* 스크롤 힌트 */}
        <button onClick={() => window.scrollTo({ top: window.innerHeight - 56, behavior: 'smooth' })} aria-label="아래로" className="cmc-scrollhint absolute bottom-7 left-1/2 z-10 -translate-x-1/2 text-white/70">
          <ChevronDown size={30} strokeWidth={2} />
        </button>
      </section>

      <div className="mx-auto max-w-md">
        {/* ───────── STATS ───────── */}
        <section className="cmc-reveal px-5 pt-11 pb-4" ref={statsRef}>
          <div className="grid grid-cols-3 divide-x divide-[#EEF1F4] rounded-[24px] bg-[#F7F9FC] py-6">
            {[
              { t: '1200', s: '+', l: '기업행사 진행' },
              { t: '99', s: '%', l: '담당자 재섭외 의향' },
              { t: '0', s: '건', l: '의전·진행 사고' },
            ].map((x) => (
              <div key={x.l} className="px-2 text-center">
                <div className="num text-[26px] font-extrabold tracking-tight text-[#3182F6]" data-target={x.t} data-suffix={x.s}>{Number(x.t).toLocaleString('ko-KR')}{x.s}</div>
                <div className="mt-1 text-[12px] font-medium text-[#8B95A1]">{x.l}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ───────── PROBLEM ───────── */}
        <section className="cmc-reveal px-5 pt-10 pb-12 text-center">
          <p className="cmc-script -mb-2 text-[34px] leading-none text-[#E5484D]/25">Real Voices</p>
          <h2 className="text-[28px] font-extrabold leading-[1.28] tracking-[-0.02em]">&ldquo;이 사회자,<br /><span className="text-[#E5484D]">누가 섭외했어?&rdquo;</span></h2>
          <p className="mt-3 text-[14px] leading-relaxed text-[#6B7684]">행사가 어색해지는 건 한순간입니다.<br />그리고 그 책임은 담당자에게 돌아옵니다.</p>
          <div className="mt-7 grid grid-cols-1 gap-2.5 text-left">
            {PAINS.map((p) => (
              <div key={p.tag} className="rounded-[22px] border border-[#F0E6E4] bg-[#FCF7F6] px-5 py-4">
                <div className="mb-1.5 flex items-center gap-2 text-[13px] font-bold text-[#E5484D]"><span className="h-[6px] w-[6px] rounded-full bg-[#E5484D]" />{p.tag}</div>
                <p className="text-[14.5px] leading-relaxed text-[#3D4148]">{p.body}</p>
              </div>
            ))}
          </div>
          <p className="mt-8 text-[19px] font-extrabold leading-[1.5] text-[#191F28]">기업행사는 다시 할 수 없습니다.<br /><span className="text-[#E5484D]">사회자 한 명이 회사 이미지를 결정합니다.</span></p>
        </section>

        {/* ───────── SOLUTION (슬라이더) ───────── */}
        <section className="cmc-reveal px-5 py-12 text-center">
          <p className="cmc-script -mb-2 text-[34px] leading-none text-[#D7DEE8]">Verified MCs</p>
          <h2 className="text-[28px] font-extrabold leading-[1.28] tracking-[-0.02em]">검증된 <span className="text-[#3182F6]">전문 MC</span>가<br />필요합니다</h2>
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
            <h2 className="text-[28px] font-extrabold leading-[1.28] tracking-[-0.02em]">사진보다 확실한 건<br />실제 진행 영상입니다</h2>
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
          <h2 className="text-center text-[28px] font-extrabold leading-[1.28] tracking-[-0.02em]">중요한 행사는<br />재미보다 <span className="text-[#6DA8FF]">안정감</span></h2>
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
          <h2 className="text-[28px] font-extrabold leading-[1.28] tracking-[-0.02em]">잘 끝난 행사는,<br />담당자를 돋보이게 합니다</h2>
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
            <h2 className="text-[28px] font-extrabold leading-[1.28] tracking-[-0.02em]">섭외, 이렇게<br />간편하게 진행됩니다</h2>
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
            <h2 className="text-[28px] font-extrabold leading-[1.28] tracking-[-0.02em]">행사 일정이 없어도<br />미리 확인해두세요</h2>
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
.cmc{font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Apple SD Gothic Neo',Pretendard,system-ui,sans-serif;overflow-x:hidden}
.cmc .cmc-script{font-family:'Allura',cursive}
.cmc-reveal{opacity:0;transform:translateY(24px);transition:opacity .9s cubic-bezier(.22,1,.36,1),transform .9s cubic-bezier(.22,1,.36,1);will-change:opacity,transform}
.cmc-reveal.cmc-in{opacity:1;transform:none}
.cmc-track{scroll-snap-type:x mandatory;scrollbar-width:none;-ms-overflow-style:none}
.cmc-track::-webkit-scrollbar{display:none}
.cmc-track>*{scroll-snap-align:start}
.cmc-arrow{position:absolute;top:50%;transform:translateY(-50%);width:34px;height:34px;border-radius:50%;border:1px solid #EEF1F4;background:#fff;color:#191F28;font-size:18px;display:flex;align-items:center;justify-content:center;z-index:5;box-shadow:0 6px 16px -8px rgba(0,0,0,.3)}
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

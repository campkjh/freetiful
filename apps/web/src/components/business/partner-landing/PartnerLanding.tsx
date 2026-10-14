'use client';

/**
 * 웨딩 파트너 상세 — 사진·이름 칸(히어로) 아래 랜딩(261014 사장 '첨부한 사진처럼 똑같이 해줘 인터렉션들도, 히어로는 바꾸지 말고'
 * + 'AI분석 그 사회자 페이지처럼 — 동그라미에 별 나오는 거').
 * 첨부 랜딩(병원 홈페이지 제작사 소개)의 섹션 짜임·움직임을 그대로 따르되, 그림·글은 남의 것을 쓰지 않고 이 업체의 데이터로 채운다.
 *   ① 소개 문장 + 둘레에 떠 있는 사진(평평 · r5 · 크게, 굴리면 가운데에 모여 있던 사진이 네 귀퉁이로 촤락 펼쳐진다 · 액자째 둥실, 누르면 크게)
 *   (② 한눈에 보기 · 매니저 카드는 261014 사장 '없애줘'로 뺐다 — 그 정보는 ⑦ 격자로)
 *   ③ 넘겨 보는 카드(가운데 카드만 또렷, 진행 막대 · PC 마우스로 끌기) — 식대·보증 인원 카드는 사장 제공 그림(hall-guests)
 *   ④ AI 분석 — 사회자 상세와 같은 '소개' 카드(StyleIntroCard) + 보라 동그라미·반짝이 별 키워드 판(KeywordOrb) + 질문 입력줄(글자가 쳐지는 입력줄 → 문의 시트)
 *   ⑤ 매니저 띠 — 사장 제공 그림(manager-band) 위에 제목만(261014 '텍스트 줄여줘')
 *   ⑥ 번갈아 놓인 기능 줄(사진 = 매칭 화면의 사회자 카드 덱처럼 돌아가는 사진 덱 · 미니 지도 · 미니 문의 시트 · 완료 카드) — 화면에 닿으면 좌우에서 들어온다
 *   ⑦ 아이콘 격자(업체 정보) ⑧ 홀 카드 = 홈 웨딩파트너 '사진 색 카드'(PartnerToneCard) 결(261014 사장), 가운데 온 카드가 살짝 떠오름 ⑨ 비교 카드 ⑩ 사진 격자 ⑪ 흐르는 키워드
 *   — 위치(페이지의 네이버 지도 칸) — ⑫ 묻고 답하기(펼침) (⑬ 마무리 문의 띠는 261014 사장 '없애줘'로 뺐다 — 아래 고정 '문의하기'가 있다)
 * 업체에는 리뷰가 없어 ④의 칩·문장은 업체 정보에서 뽑는다(partner-facts). 데이터가 없는 칸은 통째로 뺀다.
 * 글자 굵기는 700 을 넘기지 않는다(261014 사장).
 */

import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  TossCameraIcon,
  TossCheckIcon,
  TossChevronRightIcon,
  TossEarthIcon,
  TossPinIcon,
} from '@/components/icons/TossMonoIcons';
import { CalendarIcon, ClockIcon, CrownIcon, DocumentIcon, PhoneIcon, ReceiptIcon, StoreIcon, UserIcon } from '@/components/icons/mono';
import AiIcon, { AI_STAR_PATH } from '@/components/icons/AiIcon';
import StyleIntroCard from '@/components/pros/StyleIntroCard';
import { KeywordOrb, type KeywordOrbText } from '@/components/pros/ReviewKeywordOrb';
import MatchCardDeck, { type DeckCard } from '@/components/match/MatchCardDeck';
import { useImageTone } from '@/lib/image-tone';
import { josa, type PartnerFacts, type PartnerHall } from './partner-facts';
import { PL_CSS } from './styles';

const WORDMARK = '/images/logo-freetiful-wordmark.svg';
/** 사장 제공 그림(261014) — 매니저 띠 · 식대/보증 인원 카드 */
const MANAGER_ART = '/images/partner/manager-band.webp';
const GUESTS_ART = '/images/partner/hall-guests.webp';

/* 부모(랜딩)가 다시 그려져도 props 가 같으면 그대로 — 동그라미 판·소개 카드는 단어·칩이 많다 */
const StyleIntroCardMemo = memo(StyleIntroCard);
const KeywordOrbMemo = memo(KeywordOrb);

function onImgError(e: React.SyntheticEvent<HTMLImageElement>) {
  const el = e.currentTarget;
  if (el.dataset.fallback) return;
  el.dataset.fallback = '1';
  el.src = '/images/default-profile.png';
}

/** 괄호 설명('(구.코리아디자인센터)')을 뺀 이름 — 제목·동그라미 같은 좁은 자리용 */
function displayName(name: string) {
  return name.replace(/\s*[(\[][^)\]]*[)\]]\s*/g, ' ').replace(/\s+/g, ' ').trim() || name.trim();
}

function hostLabel(url: string) {
  try {
    return new URL(url).host.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function instagramHandle(url: string) {
  const m = url.match(/instagram\.com\/([^/?#]+)/i);
  return m ? `@${m[1]}` : hostLabel(url);
}

const FACT_ICON: Record<string, ReactNode> = {
  category: <StoreIcon size={24} />,
  region: <TossPinIcon size={24} />,
  meal: <ReceiptIcon size={24} />,
  menu: <DocumentIcon size={24} />,
  hallType: <CrownIcon size={24} />,
  guarantee: <UserIcon size={24} />,
  halls: <CalendarIcon size={24} />,
  parking: <ClockIcon size={24} />,
};

const reducedMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

/* ─── 등장 · 패럴랙스 · 펼침 · 화면 밖 애니메이션 멈춤 — 스크롤마다 위치만 잰다(관찰자가 늦는 안드 웹뷰에서도 같은 동작) ─── */
function useLandingMotion(rootRef: React.RefObject<HTMLDivElement>, deps: unknown[]) {
  // 첫 장면부터 펼침 정도가 맞게(그리기 전에) — 펼쳐진 채 한 번 보였다가 가운데로 튀지 않게
  useIsoLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const reduced = reducedMotion();
    root.classList.add('is-armed');
    let raf = 0;
    /* 펼침 — 사진마다 '제자리 → 칸 가운데' 거리(px)를 재 두고(--cx · --cy), 스크롤 정도(--pl-s 0~1)만큼 제자리로 나온다 */
    const measureSpread = () => {
      root.querySelectorAll<HTMLElement>('[data-spread]').forEach((sec) => {
        const W = sec.clientWidth;
        const H = sec.clientHeight;
        sec.querySelectorAll<HTMLElement>('.pl-float').forEach((f) => {
          f.style.setProperty('--cx', `${(W / 2 - (f.offsetLeft + f.offsetWidth / 2)).toFixed(1)}px`);
          f.style.setProperty('--cy', `${(H / 2 - (f.offsetTop + f.offsetHeight / 2)).toFixed(1)}px`);
        });
      });
    };
    const tick = () => {
      raf = 0;
      const vh = window.innerHeight || 800;
      root.querySelectorAll<HTMLElement>('[data-spread]').forEach((sec) => {
        let sp = 1;
        if (!reduced) {
          // 칸 위끝이 화면 80% 높이일 때 0(첫 화면에선 가운데에 모여 있다) → 15% 높이까지 올라오면 1, 끝은 부드럽게(ease-out)
          const r = sec.getBoundingClientRect();
          const raw = Math.max(0, Math.min(1, (vh * 0.8 - r.top) / (vh * 0.65)));
          sp = 1 - Math.pow(1 - raw, 3);
        }
        sec.style.setProperty('--pl-s', sp.toFixed(3));
      });
      root.querySelectorAll<HTMLElement>('[data-rv]:not([data-in])').forEach((el) => {
        const r = el.getBoundingClientRect();
        // 화면 아래 12% 안쪽으로 들어오면(또는 이미 지나갔으면) 등장
        if (r.top < vh * 0.88 || r.bottom < 0) el.setAttribute('data-in', '');
      });
      // 끝없이 도는 애니메이션(떠 있는 사진 · 띠 빛 · 미니 시트 · 흐르는 키워드 · 동그라미 판)은 화면 근처에서만 돈다
      root.querySelectorAll<HTMLElement>('[data-anim]').forEach((el) => {
        const r = el.getBoundingClientRect();
        const near = r.bottom > -150 && r.top < vh + 150;
        if (near !== el.hasAttribute('data-on')) el.toggleAttribute('data-on', near);
      });
      if (!reduced) {
        root.querySelectorAll<HTMLElement>('[data-parallax]').forEach((el) => {
          const r = el.getBoundingClientRect();
          if (r.bottom < -200 || r.top > vh + 200) return;
          // 칸 가운데가 화면 가운데에 올 때 0, 위로 지나가면 +1 쪽
          const p = Math.max(-1, Math.min(1, (vh / 2 - (r.top + r.height / 2)) / (vh / 2 + r.height / 2)));
          el.style.setProperty('--pl-p', p.toFixed(3));
        });
      }
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(tick); };
    const onResize = () => { measureSpread(); onScroll(); };
    measureSpread();
    tick();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize);
    // 글꼴이 늦게 와서 칸 높이가 바뀌어도 다시 잰다
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(onResize);
      root.querySelectorAll<HTMLElement>('[data-spread]').forEach((sec) => ro!.observe(sec));
    }
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
      ro?.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

/* ─── 가로 카드 줄 — 가운데에 온 카드 · 진행 막대(상태 없이 CSS 변수로) · PC 마우스 끌기(8px 움직인 뒤에만 잡는다 — 그전엔 클릭) ─── */
function useRail<T extends HTMLElement>(count: number) {
  const ref = useRef<T>(null);
  const barRef = useRef<HTMLElement>(null);
  const [active, setActive] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    const nearest = () => {
      const kids = Array.from(el.children) as HTMLElement[];
      const anchor = el.getBoundingClientRect().left + 20;
      let best = 0;
      let bestD = Infinity;
      kids.forEach((k, i) => {
        const d = k.getBoundingClientRect().left - anchor;
        if (Math.abs(d) < Math.abs(bestD)) { bestD = d; best = i; }
      });
      return { best, offset: bestD };
    };
    const measure = () => {
      raf = 0;
      if (!el.children.length) return;
      // 왼쪽 맞춤 넘김이라 '왼쪽 여백 자리'에 가장 가까운 카드가 지금 카드 — 끝에 닿으면 마지막
      let { best } = nearest();
      const max = el.scrollWidth - el.clientWidth;
      if (max > 2 && el.scrollLeft >= max - 2) best = el.children.length - 1;
      setActive((v) => (v === best ? v : best));
      const bar = barRef.current;
      if (bar) {
        const visible = Math.min(1, el.clientWidth / Math.max(1, el.scrollWidth));
        const prog = max > 0 ? el.scrollLeft / max : 0;
        bar.style.setProperty('--w', `${(visible * 100).toFixed(2)}%`);
        bar.style.setProperty('--x', `${(prog * ((1 - visible) / Math.max(visible, 0.0001)) * 100).toFixed(2)}%`);
      }
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(measure); };
    measure();
    el.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);

    // 마우스로 끌기 — 놓기는 window 에서 받는다(레일 밖에서 놓아도 끝나게). 버튼이 안 눌린 이동이면 바로 정리
    let down: { x: number; left: number; id: number } | null = null;
    let dragging = false;
    let moved = false;
    const finish = () => {
      window.removeEventListener('pointerup', finish);
      window.removeEventListener('pointercancel', finish);
      const wasDragging = dragging;
      down = null;
      dragging = false;
      el.classList.remove('is-drag');
      if (wasDragging) {
        // 손을 놓은 자리에서 가장 가까운 카드로 붙는다
        const { offset } = nearest();
        if (Number.isFinite(offset)) el.scrollTo({ left: el.scrollLeft + offset, behavior: reducedMotion() ? 'auto' : 'smooth' });
      }
    };
    const onDown = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      el.classList.remove('is-drag');
      down = { x: e.clientX, left: el.scrollLeft, id: e.pointerId };
      dragging = false;
      moved = false;
      window.addEventListener('pointerup', finish);
      window.addEventListener('pointercancel', finish);
    };
    const onMove = (e: PointerEvent) => {
      if (!down) return;
      if ((e.buttons & 1) === 0) { finish(); return; }
      const dx = e.clientX - down.x;
      if (!dragging && Math.abs(dx) > 8) {
        dragging = true;
        moved = true;
        el.classList.add('is-drag');
        try { el.setPointerCapture(down.id); } catch { /* 이미 놓음 */ }
      }
      if (dragging) el.scrollLeft = down.left - dx;
    };
    const onClickCapture = (e: MouseEvent) => {
      if (moved) { e.preventDefault(); e.stopPropagation(); moved = false; }
    };
    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('lostpointercapture', finish);
    el.addEventListener('click', onClickCapture, true);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      el.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('lostpointercapture', finish);
      el.removeEventListener('click', onClickCapture, true);
      window.removeEventListener('pointerup', finish);
      window.removeEventListener('pointercancel', finish);
    };
  }, [count]);
  return { ref, barRef, active };
}

/* ─── 질문 입력줄 — 글자가 쳐진다. 상태는 이 안에만(랜딩 전체가 글자마다 다시 그려지지 않게), 화면 밖·탭 숨김이면 멈춘다 ─── */
function AskBar({ name, questions, onAsk }: { name: string; questions: string[]; onAsk: (q: string) => void }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [text, setText] = useState(questions[0] || '');
  const [index, setIndex] = useState(0);
  useEffect(() => {
    const box = boxRef.current;
    if (!box || questions.length === 0) return;
    if (reducedMotion()) { setText(questions[0]); setIndex(0); return; }
    let i = 0;
    let n = 0;
    let deleting = false;
    let timer = 0;
    let running = false;
    let started = false;
    const visible = () => {
      if (document.hidden) return false;
      const r = box.getBoundingClientRect();
      return r.bottom > 0 && r.top < (window.innerHeight || 800);
    };
    const step = () => {
      timer = 0;
      if (!visible()) { running = false; return; }
      const line = questions[i % questions.length];
      let wait: number;
      if (!deleting) {
        n += 1;
        setText(line.slice(0, n));
        setIndex(i % questions.length);
        if (n >= line.length) { deleting = true; wait = 1900; } else wait = 75 + ((n * 37) % 45);
      } else {
        n -= 1;
        setText(line.slice(0, Math.max(0, n)));
        if (n <= 0) { deleting = false; i += 1; wait = 380; } else wait = 28;
      }
      timer = window.setTimeout(step, wait);
    };
    const resume = () => {
      if (running || !visible()) return;
      running = true;
      if (!started) { started = true; n = 0; setText(''); }
      timer = window.setTimeout(step, 420);
    };
    resume();
    window.addEventListener('scroll', resume, { passive: true });
    document.addEventListener('visibilitychange', resume);
    return () => {
      if (timer) window.clearTimeout(timer);
      window.removeEventListener('scroll', resume);
      document.removeEventListener('visibilitychange', resume);
    };
  }, [questions]);
  const line = questions[index] || questions[0] || '';
  return (
    <div ref={boxRef} className="pl-ask" data-rv="scale">
      <p className="pl-ask-label">{name}에 궁금한 점이 있나요?</p>
      <button type="button" className="pl-ask-bar" onClick={() => onAsk(line)} aria-label={`문의하기 — ${line}`}>
        <span className="pl-ask-text">{text}<span className="pl-caret" aria-hidden /></span>
        <span className="pl-send" aria-hidden>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 19V5m0 0l-6 6m6-6l6 6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </span>
      </button>
      <div className="pl-ask-foot">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={WORDMARK} alt="프리티풀" />
        <span>누르면 문의 시트가 열려요</span>
      </div>
    </div>
  );
}

/** 상품 안내 긴 글 — 8줄까지, 넘치면 '더 보기' */
function LongText({ title, text }: { title: string; text: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [open, setOpen] = useState(false);
  const [overflow, setOverflow] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (el) setOverflow(el.scrollHeight > el.clientHeight + 2);
  }, [text]);
  return (
    <div className="pl-long" data-rv="">
      <h3>{title}</h3>
      <p ref={ref} style={open ? undefined : { display: '-webkit-box', WebkitLineClamp: 8, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{text}</p>
      {(overflow || open) && <button type="button" onClick={() => setOpen((v) => !v)}>{open ? '접기' : '더 보기'}</button>}
    </div>
  );
}

/** 사진 아래쪽을 카드 색으로 녹인다(PartnerToneCard 와 같은 값) */
const HALL_CARD_FADE = 'linear-gradient(to bottom, #000 0%, #000 50%, rgba(0,0,0,.4) 78%, transparent 100%)';

/**
 * ⑧ 홀 카드 — 홈 웨딩파트너 카드(PartnerToneCard)와 같은 '사진 색 카드'(261014 사장 '웨딩홀 홈에 있는 카드처럼').
 *  바탕·테두리 = 홀 사진에서 뽑은 색(lib/image-tone 'scene'), 16:9 사진 아래쪽이 그 색으로 녹아 이름 칸으로 이어진다.
 *  이름 17 굵게 · 한 줄 정보(층 | 사진 N장) · 식대 · 조건 줄.
 */
function HallCard({ hall, index, active, fallbackImage, onOpen }: { hall: PartnerHall; index: number; active: boolean; fallbackImage?: string; onOpen: (src: string) => void }) {
  const src = hall.images[0] || fallbackImage || '';
  const tone = useImageTone(src || null, 'scene');
  const sub = tone?.sub || '#6B7684';
  const photoCount = hall.images.length;
  const meta = [hall.floor, photoCount > 1 ? `사진 ${photoCount}장` : ''].filter(Boolean);
  return (
    <div
      className={`pl-plan${active ? ' is-on' : ''}`}
      style={{ backgroundColor: tone?.bg || '#F2F4F6', borderColor: tone?.line || '#EAEDF0', ['--tone-sub' as string]: sub }}
    >
      {src && (
        <button type="button" className="pl-plan-ph" onClick={() => onOpen(src)} aria-label={`${hall.name} 사진 크게 보기`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt="" referrerPolicy="no-referrer" loading={index < 2 ? 'eager' : 'lazy'} decoding="async" draggable={false} onError={onImgError} style={{ WebkitMaskImage: HALL_CARD_FADE, maskImage: HALL_CARD_FADE }} />
        </button>
      )}
      <div className="pl-plan-body">
        <p className="pl-plan-name">{hall.name}</p>
        {meta.length > 0 && (
          <p className="pl-plan-meta">
            {meta.map((m, i) => (
              <span key={m}>{i > 0 && <i aria-hidden />}{m}</span>
            ))}
          </p>
        )}
        {hall.price && (
          <div className="pl-plan-price"><span>{hall.priceLabel}</span><b>{hall.price}</b></div>
        )}
        {hall.rows.length > 0 && (
          <ul>
            {hall.rows.map((r) => (
              <li key={r.label}><TossCheckIcon size={16} /><span><b>{r.label}</b> {r.value}</span></li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function SectionHead({ eyebrow, title, lead, center = true }: { eyebrow: string; title: ReactNode; lead?: ReactNode; center?: boolean }) {
  return (
    <div className={center ? 'pl-center' : ''} data-rv="">
      <span className="pl-eyebrow">{eyebrow}</span>
      <h2 className="pl-h2">{title}</h2>
      {lead && <p className="pl-lead">{lead}</p>}
    </div>
  );
}

/** 넘겨 보는 카드 — 모두 그림이 있다(261014 사장 '이미지 없는 것들 다 채워줘'): 업체 사진 카드 · 사장 그림 카드(식대 · 보증 인원) */
type Highlight =
  | { kind: 'photo'; key: string; label: string; value: string; src: string; index: number; tags?: string[] }
  | { kind: 'art'; key: string; label: string; value: string; pos: string };

export default function PartnerLanding({
  images,
  facts,
  tags,
  instagramUrl,
  website,
  hasLocation,
  onOpenPhoto,
  onInquiry,
  onLocate,
  locationSlot,
}: {
  images: string[];
  facts: PartnerFacts;
  tags: string[];
  instagramUrl?: string | null;
  website?: string;
  /** 지도로 찾을 수 있는 주소가 있는가(지역만 적힌 곳은 '위치 보고 길찾기' 줄을 뺀다) */
  hasLocation: boolean;
  onOpenPhoto: (index: number) => void;
  onInquiry: (prefill?: string) => void;
  onLocate: () => void;
  locationSlot: ReactNode;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const name = facts.name;
  const short = displayName(name);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  useLandingMotion(rootRef, [images.length, facts.halls.length]);

  /* ① 떠 있는 사진 — 대표 사진(히어로) 다음 것부터. 모자라면 대표 사진 + 파랑 장식 타일. 평평하게(기울이지 않음) · 크게(261014 '좀 더 키워줘' 두 번).
     자리·크기는 CSS(.pl-float.f0~f3), 여기선 패럴랙스 세기(k) · 둥실 박자(t · dl) · 펼침 차례(o) */
  const floats = useMemo(() => {
    const SPOTS: Array<{ k: number; t: string; dl: string; o: number }> = [
      { k: -14, t: '6.4s', dl: '0s', o: 0 },
      { k: -9, t: '7.2s', dl: '-2s', o: 0.08 },
      { k: 9, t: '5.8s', dl: '-1s', o: 0.04 },
      { k: 14, t: '6.8s', dl: '-3s', o: 0.12 },
    ];
    const pool = images.length > 1 ? images.slice(1, 5).map((src, i) => ({ src, index: i + 1 })) : images.slice(0, 1).map((src) => ({ src, index: 0 }));
    return SPOTS.map((spot, i) => ({ ...spot, photo: pool[i] || null }));
  }, [images]);

  /* ③ 넘겨 보는 카드 — 분야 카드는 뺀다(제목이 이미 '{업체 종류} 고를 때'). 식대·보증 인원 = 사장 그림 카드, 나머지는 전부 업체 사진 카드
     (사진이 모자라면 처음부터 다시 돌려 쓴다 — 그림 없는 카드가 없게) */
  const highlights = useMemo<Highlight[]>(() => {
    const out: Highlight[] = [];
    let photoAt = 0;
    const nextPhoto = () => {
      const index = images.length ? photoAt % images.length : 0;
      photoAt += 1;
      return { src: images[index] || '/images/default-profile.png', index };
    };
    facts.facts.filter((f) => f.key !== 'category').forEach((f) => {
      if (f.key === 'meal' || f.key === 'guarantee') {
        out.push({ kind: 'art', key: f.key, label: f.label, value: f.value, pos: f.key === 'meal' ? '50% 58%' : '50% 100%' });
        return;
      }
      out.push({ kind: 'photo', key: f.key, label: f.label, value: f.value, ...nextPhoto() });
    });
    // 제휴사 업체 소개문(keypoints) 카드는 261014 사장 '이 카드는 삭제해줘'로 뺐다
    if (tags.length >= 2) out.push({ kind: 'photo', key: 'tags', label: '이런 키워드로 찾아요', value: '', tags: tags.slice(0, 6), ...nextPhoto() });
    // 카드가 적으면(정보가 적은 업체) 아직 안 쓴 사진으로 채운다 — 글자 없는 사진 카드
    while (out.length < 4 && photoAt < images.length) out.push({ kind: 'photo', key: `ph-${photoAt}`, label: '', value: '', ...nextPhoto() });
    return out.slice(0, 8);
  }, [facts, images, tags]);
  const rail = useRail<HTMLDivElement>(highlights.length);
  const plans = useRail<HTMLDivElement>(facts.halls.length);

  /* ④ AI 분석 — 동그라미 판 글자 */
  const orbText = useMemo<KeywordOrbText>(() => ({
    titleTop: '업체 정보를 모아 보니,',
    titleStrong: short.length <= 10 ? `${short}의 이런 점` : '이 업체의 이런 점',
    titleRest: '이 눈에 띄어요',
    orbLines: ['한눈에 본', short.length <= 9 ? short : facts.kind],
    primary: facts.keywords.slice(0, 4),
    secondary: facts.keywords.slice(4, 8),
  }), [short, facts.kind, facts.keywords]);
  const styleSummary = useMemo(() => ({ summary: facts.summary, keywords: [] as string[], source: 'rule' as const, reviewCount: 0 }), [facts.summary]);

  const questions = useMemo(() => {
    if (!facts.isHall) return ['견적이 궁금해요', '원하는 날짜에 가능한지 궁금해요', '방문 상담을 받고 싶어요'];
    // 홀 이름 뒤에 '홀'을 또 붙이지 않는다('라포레홀 투어') · 자리표시 이름('홀 2')은 쓰지 않는다
    const first = facts.halls.find((h) => h.named);
    const hallName = first ? first.name.replace(/\s*\([^)]*\)\s*$/, '').trim() : '';
    return [hallName ? `${hallName} 투어를 하고 싶어요` : '홀 투어를 하고 싶어요', '원하는 날짜에 예식이 가능한가요?', '식대에 무엇이 포함되나요?'];
  }, [facts.isHall, facts.halls]);

  /* ⑦ 격자 = 업체 정보 전부 + 인스타 · 웹사이트 */
  const links: Array<{ key: string; label: string; icon: ReactNode; node: ReactNode }> = [
    ...(instagramUrl ? [{ key: 'insta', label: '인스타그램', icon: <TossCameraIcon size={24} />, node: <a href={instagramUrl} target="_blank" rel="noopener noreferrer">{instagramHandle(instagramUrl)}</a> }] : []),
    ...(website ? [{ key: 'web', label: '웹사이트', icon: <TossEarthIcon size={24} />, node: <a href={website} target="_blank" rel="noopener noreferrer">{hostLabel(website)}</a> }] : []),
  ];
  const gridCells: Array<{ key: string; label: string; value: ReactNode; icon: ReactNode }> = [
    // '최소 300명 · 최대 550명' 처럼 가운뎃점으로 이어진 값은 좁은 칸에서 낱말 중간에 꺾이지 않게 줄을 나눈다
    ...facts.facts.map((f) => ({ key: f.key, label: f.label, value: f.value.split(' · ').map((part, i) => <span key={i} style={{ display: 'block' }}>{part}</span>) as ReactNode, icon: FACT_ICON[f.key] || <TossCheckIcon size={24} /> })),
    ...links.map((l) => ({ key: l.key, label: l.label, value: l.node, icon: l.icon })),
  ];
  const showGrid = gridCells.length > 0;
  /* ⑥ 사진 덱 — 매칭 화면의 사회자 카드 덱(MatchCardDeck)을 업체 사진으로 */
  const deckCards = useMemo<DeckCard[]>(() => images.slice(0, 6).map((src, i) => ({ id: `p${i}`, name: `사진 ${i + 1}`, image: src })), [images]);

  /* ⑩ 사진 격자 — 첫 장 크게(2×2) + 다섯 장, 마지막 칸에 +N */
  const gallery = images.slice(0, images.length >= 3 ? 6 : images.length);
  const moreCount = images.length - gallery.length;

  /* ⑪ 흐르는 키워드 — 두 줄이 서로 반대로 흐른다(한 줄은 두 벌 이어 붙여 끊김 없이) */
  const marqueeRows = useMemo(() => {
    const words = facts.marquee;
    if (words.length < 3) return [];
    const fill = (list: string[]) => { const out = [...list]; while (out.length < 8) out.push(...list); return out; };
    const half = Math.ceil(words.length / 2);
    const a = fill(words.length >= 6 ? words.slice(0, half) : words);
    const b = fill(words.length >= 6 ? words.slice(half) : [...words].reverse());
    return [a, b];
  }, [facts.marquee]);

  const openPhoto = useCallback((i: number) => { if (i >= 0) onOpenPhoto(i); }, [onOpenPhoto]);
  const ask = useCallback((q: string) => onInquiry(q), [onInquiry]);
  const mealFact = facts.facts.find((f) => f.key === 'meal');
  const leadBits = [facts.region, facts.kind, facts.halls.length > 1 ? `홀 ${facts.halls.length}개` : '', mealFact ? `식대 ${mealFact.value}` : ''].filter(Boolean);
  const singleHall = facts.halls.length === 1;

  return (
    <div ref={rootRef} className="pl">
      <style>{PL_CSS}</style>

      {/* ① 소개 문장 + 떠 있는 사진 */}
      <section className="pl-intro" data-parallax="" data-spread="" data-anim="">
        {floats.map((f, i) => (f.photo ? (
          <button
            key={i}
            type="button"
            className={`pl-float f${i}`}
            style={{ ['--k' as string]: f.k, ['--t' as string]: f.t, ['--dl' as string]: f.dl, ['--o' as string]: f.o }}
            onClick={() => openPhoto(f.photo!.index)}
            aria-label={`사진 ${f.photo.index + 1} 크게 보기`}
          >
            {/* 액자째 둥실 — 사진이 액자 안에서 따로 움직이지 않게(261014 '프레임 안에서도 뜸') */}
            <span className="pl-float-frame">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={f.photo.src} alt="" referrerPolicy="no-referrer" loading="lazy" decoding="async" onError={onImgError} />
            </span>
          </button>
        ) : (
          <span key={i} aria-hidden className={`pl-float f${i}`} style={{ ['--k' as string]: f.k, ['--t' as string]: f.t, ['--dl' as string]: f.dl, ['--o' as string]: f.o }}>
            <span className="pl-float-frame is-deco">
              <svg width="30" height="30" viewBox="0 0 24 24"><path d={AI_STAR_PATH} fill="#fff" /></svg>
            </span>
          </span>
        )))}
        {/* 글은 사진이 가운데에서 펼쳐져 나간 뒤에 떠오른다(펼침 정도 --pl-s 로 — 사진이 모여 있을 땐 글과 겹치지 않게) */}
        <div className="pl-intro-copy">
          <span className="pl-eyebrow">About</span>
          <p className="pl-intro-statement">
            <span className="pl-intro-name pl-grad-text">{short}</span>
            사진부터 문의까지,<br />프리티풀에서 한 번에
          </p>
          {leadBits.length > 0 && <p className="pl-lead">{leadBits.join(' · ')}</p>}
        </div>
      </section>

      {/* ③ 넘겨 보는 카드 */}
      {highlights.length >= 2 && (
        <section style={{ paddingTop: 76 }}>
          <div style={{ padding: '0 20px' }}>
            <SectionHead
              eyebrow="Highlights"
              title={<>{facts.kind} 고를 때 보는 것,<br /><span className="pl-grad-text">{short}</span>{josa(short, '은는').slice(short.length)} 이래요</>}
            />
          </div>
          <div ref={rail.ref} className="pl-rail" data-rv="right" role="list">
            {highlights.map((h, i) => {
              const dim = i !== rail.active ? ' is-dim' : '';
              if (h.kind === 'photo') {
                return (
                  <button key={h.key} type="button" role="listitem" className={`pl-hl is-photo${dim}`} onClick={() => openPhoto(h.index)} aria-label={h.label ? `${h.label} ${h.value} — 사진 크게 보기` : `사진 ${h.index + 1} 크게 보기`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={h.src} alt="" referrerPolicy="no-referrer" loading="lazy" decoding="async" draggable={false} onError={onImgError} />
                    {h.label && (
                      <>
                        <span className="pl-hl-shade" />
                        <span className="pl-hl-body" style={{ textAlign: 'left' }}>
                          <span className="pl-hl-k" style={{ display: 'block' }}>{h.label}</span>
                          {h.value && <span className="pl-hl-v" style={{ display: 'block' }}>{h.value}</span>}
                          {h.tags && <span className="pl-hl-tags is-glass">{h.tags.map((t) => <span key={t}>#{t}</span>)}</span>}
                        </span>
                      </>
                    )}
                  </button>
                );
              }
              if (h.kind === 'art') {
                return (
                  <div key={h.key} role="listitem" className={`pl-hl is-art${dim}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={GUESTS_ART} alt="" loading="lazy" decoding="async" draggable={false} style={{ objectPosition: h.pos }} />
                    <span className="pl-hl-art-fade" aria-hidden />
                    <span className="pl-hl-body is-top">
                      <span className="pl-hl-k" style={{ display: 'block' }}>{h.label}</span>
                      <span className="pl-hl-v" style={{ display: 'block' }}>{h.value}</span>
                    </span>
                  </div>
                );
              }
              return null;
            })}
          </div>
          <div className="pl-progress" aria-hidden><i ref={rail.barRef} /></div>
        </section>
      )}

      {/* ④ AI 분석 — 사회자 상세와 같은 소개 카드 + 동그라미·별 키워드 판 */}
      <section className="pl-sec">
        <div className="pl-center" data-rv="">
          <div className="pl-ai-head"><AiIcon size={18} tile={false} /><span className="pl-eyebrow">AI 분석</span></div>
          <h2 className="pl-h2">업체 정보로 정리한<br /><span className="pl-grad-text">{short}</span></h2>
          <p className="pl-lead">분야 · 지역 · 업체 정보를 모아 한눈에 보기 좋게 정리했어요</p>
        </div>
        <div style={{ marginTop: 24 }} data-rv="">
          <StyleIntroCardMemo summary={styleSummary} loading={false} title="이 업체를 한눈에 소개합니다" />
        </div>
        {facts.keywords.length >= 2 && <KeywordOrbMemo text={orbText} className="mb-2 mt-6" />}
        <AskBar name={short} questions={questions} onAsk={ask} />
      </section>

      {/* ⑤ 매니저 띠 — 사장 그림 위에 제목만 */}
      <section className="pl-band" data-parallax="">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="pl-band-art" src={MANAGER_ART} alt="" aria-hidden loading="lazy" decoding="async" />
        <div className="pl-band-copy" data-rv="">
          <span className="pl-eyebrow">Freetiful Manager</span>
          <h2>문의부터 연락까지<br />매니저가 함께해요</h2>
          <button type="button" className="pl-band-btn" onClick={() => onInquiry()}>
            문의 남기기 <TossChevronRightIcon size={16} />
          </button>
        </div>
      </section>

      {/* ⑥ 번갈아 놓인 기능 줄 */}
      <section className="pl-sec pl-gray">
        <SectionHead
          eyebrow="How it works"
          title={<>{short} 준비,<br />이렇게 하면 돼요</>}
          lead={hasLocation ? '사진으로 둘러보고, 위치를 보고, 문의만 남기면 돼요' : '사진으로 둘러보고, 문의만 남기면 돼요'}
        />
        <div className="pl-rows">
          <div className="pl-row" data-rv="left">
            <button type="button" className="pl-row-ui pl-deck" onClick={() => openPhoto(0)} aria-label="사진 크게 보기">
              <MatchCardDeck cards={deckCards} />
            </button>
            <div className="pl-row-txt">
              <span className="pl-step">STEP 1</span>
              <h3>사진으로 먼저 둘러보기</h3>
              <p>{facts.photoCount > 1 ? `${facts.photoCount}장의 사진을 넘겨 보며 분위기를 먼저 살펴보세요.` : '대표 사진으로 분위기를 먼저 살펴보세요.'}</p>
              <button type="button" className="pl-link" onClick={() => openPhoto(0)}>사진 크게 보기 <TossChevronRightIcon size={16} /></button>
            </div>
          </div>

          {hasLocation && (
            <div className="pl-row is-flip" data-rv="right" data-anim="">
              <div className="pl-row-ui">
                <div className="pl-mmap" aria-hidden />
                <div className="pl-pin" aria-hidden><b>{short}</b><i /></div>
              </div>
              <div className="pl-row-txt">
                <span className="pl-step">STEP 2</span>
                <h3>위치 보고 길찾기</h3>
                <p>{facts.region ? `${facts.region}에 있어요. ` : ''}네이버 지도에서 위치를 확인하고 길찾기까지 할 수 있어요.</p>
                <button type="button" className="pl-link" onClick={onLocate}>위치 보기 <TossChevronRightIcon size={16} /></button>
              </div>
            </div>
          )}

          <div className={`pl-row${hasLocation ? '' : ' is-flip'}`} data-rv={hasLocation ? 'left' : 'right'} data-anim="">
            <div className="pl-row-ui">
              <div className="pl-msheet" aria-hidden>
                <span className="grab" />
                <b>{short}에 문의하기</b>
                <div className="chips"><span className="on">견적 문의</span><span>방문 상담</span><span>일정 확인</span></div>
                <div className="field" />
                <div className="send">문의 보내기</div>
              </div>
            </div>
            <div className="pl-row-txt">
              <span className="pl-step">STEP {hasLocation ? 3 : 2}</span>
              <h3>궁금한 점 문의 남기기</h3>
              <p>견적 · 방문 상담 · 일정 확인 중 궁금한 것을 고르고 희망 시기를 남겨 주세요.</p>
              <button type="button" className="pl-link" onClick={() => onInquiry()}>문의하기 <TossChevronRightIcon size={16} /></button>
            </div>
          </div>

          <div className={`pl-row${hasLocation ? ' is-flip' : ''}`} data-rv={hasLocation ? 'right' : 'left'} data-anim="">
            <div className="pl-row-ui">
              {/* 실제 흐름 그대로: 문의 시트 완료 화면 → 매니저가 남긴 연락처로 연락(앱 푸시 알림처럼 보이지 않게 시각 표시 없음) */}
              <div className="pl-noti" aria-hidden>
                <div>
                  <span className="app"><TossCheckIcon size={18} /></span>
                  <span className="t"><b>문의를 보냈어요</b><span>프리티풀 매니저가 확인하고 연락드려요</span></span>
                </div>
                <div>
                  <span className="app"><PhoneIcon size={18} /></span>
                  <span className="t"><b>프리티풀 매니저</b><span>남겨 주신 연락처로 연락드려요</span></span>
                </div>
              </div>
            </div>
            <div className="pl-row-txt">
              <span className="pl-step">STEP {hasLocation ? 4 : 3}</span>
              <h3>매니저에게 연락받기</h3>
              <p>프리티풀 매니저가 업체와 함께 확인하고, 남겨 주신 연락처로 안내드려요.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ⑦ 업체 정보 — 아이콘 격자(② 카드에 없는 정보만) */}
      {showGrid && (
        <section className="pl-sec">
          <SectionHead eyebrow="Information" title={<>{short}의<br />기본 정보</>} />
          <ul className="pl-grid">
            {gridCells.map((c, i) => (
              <li key={c.key} className="pl-gi" data-rv="" style={{ ['--d' as string]: `${(i % 3) * 0.07}s` }}>
                <span className="pl-gi-ic">{c.icon}</span>
                <span className="pl-gi-k">{c.label}</span>
                <span className="pl-gi-v">{c.value}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ⑧ 홀 안내 — 요금표형 카드(가운데 온 카드 강조) / 상품 안내 긴 글 */}
      {facts.halls.length > 0 && (
        <section style={{ paddingTop: 76 }}>
          <div style={{ padding: '0 20px' }}>
            {singleHall ? (
              <SectionHead eyebrow="Hall" title={<>{short} 홀,<br />한눈에 살펴보세요</>} lead="예식 방식 · 수용 인원 · 식대" />
            ) : (
              <SectionHead eyebrow="Halls" title={<>홀마다 다른 조건,<br />골라서 비교해 보세요</>} lead={`${facts.halls.length}개 홀의 예식 방식 · 수용 인원 · 식대`} />
            )}
          </div>
          <div ref={plans.ref} className={`pl-plans${singleHall ? ' is-single' : ''}`} data-rv="right">
            {facts.halls.map((h, i) => (
              <HallCard
                key={`${h.name}-${i}`}
                hall={h}
                index={i}
                active={i === plans.active && !singleHall}
                fallbackImage={images[0]}
                onOpen={(src) => openPhoto(images.indexOf(src))}
              />
            ))}
          </div>
          {!singleHall && <div className="pl-progress" aria-hidden><i ref={plans.barRef} /></div>}
        </section>
      )}
      {facts.sections.length > 0 && (
        <section className="pl-sec">
          <SectionHead eyebrow="Products" title="상품 안내" />
          {facts.sections.map((s) => <LongText key={s.title} title={s.title} text={s.text} />)}
        </section>
      )}

      {/* ⑨ 비교 — 이 업체 하나 기준(여러 업체 동시 문의처럼 읽히지 않게) */}
      <section className="pl-sec">
        <SectionHead center={false} eyebrow="Why Freetiful" title={<>직접 알아볼 때와<br />프리티풀로 문의할 때</>} />
        <div className="pl-vs">
          <div className="pl-vs-card" data-rv="left">
            <h3>직접 알아볼 때</h3>
            <ul>
              <li><i aria-hidden />업체에 직접 전화·방문해 물어봐요</li>
              <li><i aria-hidden />가격·일정을 하나하나 확인해요</li>
              <li><i aria-hidden />답을 기다리며 다시 연락해요</li>
            </ul>
          </div>
          <div className="pl-vs-card is-ours" data-rv="scale" style={{ ['--d' as string]: '.1s' }}>
            <span className="pl-vs-badge">FREETIFUL</span>
            <h3>프리티풀로 문의할 때</h3>
            <ul>
              <li><TossCheckIcon size={16} />문의 한 번이면 매니저가 대신 확인해요</li>
              <li><TossCheckIcon size={16} />업체와 함께 확인해 안내해요</li>
              <li><TossCheckIcon size={16} />남긴 연락처로 연락받아요</li>
            </ul>
          </div>
        </div>
      </section>

      {/* ⑩ 사진 격자 */}
      <section className="pl-sec">
        <SectionHead center={false} eyebrow="Gallery" title={<>사진으로 보는<br />{short}</>} />
        <div className={`pl-gal${gallery.length === 1 ? ' is-one' : gallery.length === 2 ? ' is-two' : ''}`} data-rv="">
          {gallery.map((src, i) => (
            <button key={src + i} type="button" className={gallery.length >= 3 && i === 0 ? 'is-big' : ''} onClick={() => openPhoto(i)} aria-label={`사진 ${i + 1} 크게 보기`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" referrerPolicy="no-referrer" loading="lazy" decoding="async" onError={onImgError} />
              {i === gallery.length - 1 && moreCount > 0 && <span className="pl-gal-more">+{moreCount}</span>}
            </button>
          ))}
        </div>
        {images.length > 1 && (
          <button type="button" className="pl-pill-btn" onClick={() => openPhoto(0)}>
            사진 전체보기 <TossChevronRightIcon size={18} />
          </button>
        )}
      </section>

      {/* ⑪ 흐르는 키워드 */}
      {marqueeRows.length > 0 && (
        <div className="pl-mq" data-anim="" aria-label={`키워드: ${facts.marquee.join(', ')}`}>
          {marqueeRows.map((row, ri) => (
            <div key={ri} className={`pl-mq-track${ri ? ' rev' : ''}`} style={{ ['--dur' as string]: `${26 + ri * 6}s` }} aria-hidden>
              {[...row, ...row].map((w, i) => <span key={i} className="pl-mq-chip"><b>#</b>{w}</span>)}
            </div>
          ))}
        </div>
      )}

      {/* 위치 — 페이지가 그린 네이버 지도 칸 */}
      {locationSlot}

      {/* ⑫ 묻고 답하기 */}
      <section className="pl-sec">
        <SectionHead eyebrow="FAQ" title={<>{short},<br />이것부터 확인하세요</>} />
        <div className="pl-faq" data-rv="">
          {facts.faqs.map((f, i) => {
            const open = openFaq === i;
            return (
              <div key={f.q} className={`pl-faq-item${open ? ' is-open' : ''}`}>
                <button type="button" className="pl-faq-q" aria-expanded={open} onClick={() => setOpenFaq(open ? null : i)}>
                  <span className="q">Q</span>
                  <span className="t">{f.q}</span>
                  <span className="pl-faq-plus" aria-hidden />
                </button>
                <div className="pl-faq-a" role="region" aria-hidden={!open}>
                  <div><p>{f.a}</p></div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 맨 아래 '정보 제공 … · 가격이 바뀔 수 있어요' 한 줄은 261014 사장 확인으로 뺐다(가격 변동 안내는 묻고 답하기 '식대' 답에 남아 있다) */}
      <div aria-hidden style={{ height: 28 }} />
    </div>
  );
}

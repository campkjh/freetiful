'use client';

import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { matchApi } from '@/lib/api/match.api';
import { discoveryApi, type ProListItem } from '@/lib/api/discovery.api';
import { captureUtm, trackLandingVisit, trackLandingConversion } from '@/lib/landing-track';
import ProToneCard, { type ProToneCardData } from '@/components/pros/ProToneCard';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/auth.store';
import MetaPixel, { META_PIXEL_ID } from '@/components/landing/MetaPixel';
import { isTestLeadSubmission } from '@/lib/test-lead';

/* ─────────────────────────────────────────────────────────────
 * 퀵매칭 — 토스 톤앤매너. 한 화면당 한 질문, 단일선택 자동 진행.
 * 등장: 타이틀 페이드업 → 서브 → 카드 위→아래 순서로 우→좌 페이드슬라이드.
 * 모바일 최적화 + PC(넓은 화면)는 가운데 카드 프레임.
 * ──────────────────────────────────────────────────────────── */

type Step = 'date' | 'region' | 'venue' | 'mood' | 'part' | 'gender' | 'searching' | 'results' | 'contact' | 'phone' | 'done';

const ICON = (n: string) => `/quick-match/icons/${n}.svg`;
function Ic({ name, size = 24, color, className = '' }: { name: string; size?: number; color?: string; className?: string }) {
  return <i aria-hidden className={`qm-ic ${className}`} style={{ width: size, height: size, color, WebkitMaskImage: `url(${ICON(name)})`, maskImage: `url(${ICON(name)})` }} />;
}

type Note = { title: string; body: string; list?: string[] };

const REGION_GROUPS: { key: string; label: string; match: string[] }[] = [
  { key: 'sudogwon', label: '수도권', match: ['수도권(서울/인천/경기)'] },
  { key: 'gangwon', label: '강원권', match: ['강원도'] },
  { key: 'chungcheong', label: '충청권', match: ['충청권'] },
  { key: 'jeolla', label: '전라권', match: ['전라권'] },
  { key: 'gyeongsang', label: '경상권', match: ['경상권'] },
  { key: 'jeju', label: '제주', match: ['제주'] },
];
const MOOD_OPTIONS: { label: string; icon: string; desc: string }[] = [
  { label: '진중하고 격식있게', icon: 'crown', desc: '차분하고 우아한 분위기로' },
  { label: '유쾌하고 밝게', icon: 'smile', desc: '웃음이 넘치는 즐거운 예식으로' },
  { label: '위트있고 센스있게', icon: 'sparkle', desc: '지루하지 않은 재치있는 진행으로' },
  { label: '감동적이고 따뜻하게', icon: 'heart', desc: '진심이 전해지는 뭉클한 예식으로' },
];
const PART_OPTIONS: { label: string; note?: Note }[] = [
  { label: '1부 (본식)' },
  { label: '2부 (피로연)', note: {
    title: '2부는 진행 스타일이 본식과 달라요',
    body: '2부는 게임·이벤트 등 캐주얼한 진행이 많아요. 2부 전문 진행이 가능한 사회자를 우선 보여드릴게요.',
  } },
  { label: '둘 다 (1부·2부)', note: {
    title: '1부·2부는 필요한 진행 톤이 달라요',
    body: '본식은 격식 있게, 2부는 유쾌하게. 두 분위기를 모두 잘 소화하는 사회자를 추천해드릴게요.',
  } },
];
const GENDERS: { k: 'any' | 'male' | 'female'; label: string }[] = [
  { k: 'female', label: '여자 사회자' },
  { k: 'male', label: '남자 사회자' },
  { k: 'any', label: '상관없어요' },
];
const CONTACTS: { k: string; label: string; hint: string; icon: string }[] = [
  { k: '전화', label: '전화', hint: '사회자가 직접 전화드려요', icon: 'call' },
  { k: '문자', label: '문자', hint: '문자로 편하게 상담받아요', icon: 'message' },
  { k: '프리티풀 채팅', label: '프리티풀 채팅', hint: '앱에서 실시간으로 채팅해요', icon: 'chat' },
];
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'back'];

/* ── helpers ─────────────────────────────────────────────── */
function normalizePhone(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (d.length < 4) return d;
  if (d.length < 8) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
}
function formatKDate(v: string) {
  if (!v) return '';
  const [y, m, d] = v.split('-').map(Number);
  const wd = ['일', '월', '화', '수', '목', '금', '토'][new Date(y, m - 1, d).getDay()];
  return `${y}년 ${m}월 ${d}일 (${wd})`;
}
function formatKTime(v: string) {
  if (!v) return '';
  const [h, m] = v.split(':').map(Number);
  const ampm = h < 12 ? '오전' : '오후';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${ampm} ${h12}:${String(m).padStart(2, '0')}`;
}
function shuffle<T>(a: T[]): T[] { const r = [...a]; for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; } return r; }
function matchesGender(p: ProListItem, g: 'any' | 'male' | 'female') {
  if (g === 'any') return true;
  const v = (p.gender || '').toLowerCase();
  return g === 'male' ? v === 'male' || (p.gender || '').includes('남') : v === 'female' || (p.gender || '').includes('여');
}
/** 두 줄을 번갈아 한 줄로(여·남·여·남…) — 성별 상관없음일 때 지정 사회자 */
function interleave<T>(a: T[], b: T[]): T[] {
  const out: T[] = [];
  for (let i = 0; i < Math.max(a.length, b.length); i++) { if (i < a.length) out.push(a[i]); if (i < b.length) out.push(b[i]); }
  return out;
}
function matchesRegion(p: ProListItem, group?: { match: string[] }) {
  if (!group) return true;
  if (p.isNationwide) return true;
  const rs = p.regions || [];
  return rs.includes('전국가능') || rs.some((r) => group.match.includes(r));
}
const stag = (i: number) => ({ animationDelay: `${0.3 + i * 0.07}s` });

/* ── 사회자 카드 — 홈 사회자 카드(사진 색 카드)를 상세 프로필 사진처럼 옆으로 넘긴다 ──────────────
 * 261002 사장 "퀵매칭 사회자 카드를 홈에 사회자 카드 디자인처럼, 사회자 상세페이지 프로필 사진 스와이프하면
 * 다음 사진 나오는 것처럼 다음 사회자 나오게".
 *  카드 = components/pros/ProToneCard(홈·/pros 와 같은 컴포넌트) size='lg'.
 *  넘기기 = 상세 히어로처럼 왼쪽 정렬 + 다음 카드 살짝 보임(peek) + 가운데 아닌 카드는 0.9배 + 아래 점(보는 카드는 길쭉한 알약).
 *   위치는 손가락·스프링으로 직접 굴린다(같은 날 '수우웅 툭 말고 고스트도어처럼 천천히 멈추게') — 크기도 위치 따라 이어서 바뀐다.
 *  누르기: 어느 카드든(옆에 걸친 카드·멈추는 중이어도) 고르기/빼기 + 그 카드로 스르르(같은 날 '완전히 멈추지 않아도 체크되게').
 *  카드 위 '포트폴리오 ›' = 그 사회자 상세로(같은 날). 돌아오면 보던 결과 그대로(QM_RETURN_KEY). */
function toneOf(p: ProListItem): ProToneCardData {
  return {
    id: p.id,
    name: p.name,
    image: p.images?.[0] || p.profileImageUrl || '',
    experience: p.careerYears || 0,
    isPartner: Boolean(p.showPartnersLogo || p.isFeatured),
    rating: p.avgRating || 0,
    reviews: p.reviewCount || 0,
    region: p.isNationwide ? '전국' : String((p.regions || [])[0] || '').replace(/\(.*?\)/g, '').trim(),
    intro: p.shortIntro || p.mainExperience || '',
    tags: p.tags || [],
  };
}

/** 카드 줄 치수 — 레이아웃 값만 읽는다(카드에 건 transform 은 안 섞인다).
 *  step = 한 칸(카드 폭 + 틈), max = 마지막 카드가 오른쪽 끝에 닿는 위치(그 너머는 고무줄) */
function rowMetrics(row: HTMLElement) {
  const first = row.children[0] as HTMLElement | undefined;
  const second = row.children[1] as HTMLElement | undefined;
  const last = row.children[row.children.length - 1] as HTMLElement | undefined;
  if (!first || !last) return { step: 1, max: 0 };
  const step = (second ? second.offsetLeft - first.offsetLeft : first.offsetWidth + 12) || 1;
  const padR = parseFloat(getComputedStyle(row).paddingRight) || 0;
  return { step, max: Math.max(0, last.offsetLeft + last.offsetWidth + padR - row.clientWidth) };
}
/** 고무줄 — 끝을 넘겨 끌면 갈수록 덜 따라온다(iOS 와 같은 식). d = 줄 폭 */
const rubber = (o: number, d: number) => (1 - 1 / ((o * 0.55) / d + 1)) * d;
const unrubber = (r: number, d: number) => (r >= d * 0.999 ? d * 50 : (1 / (1 - r / d) - 1) * (d / 0.55));
/** 고스트도어 세기 — 임계 감쇠 스프링의 고유 진동수(rad/s). 작을수록 끝이 더 길게 천천히 닿는다 */
const QM_SETTLE_W = 8;

/** 카드 한 장 — 넘기는 중(active 만 바뀔 때)엔 다시 그리지 않게 memo. 위치·크기(transform)는 줄(QmProCarousel)이 DOM 에 직접 칠한다 */
const QmSlide = memo(function QmSlide({ p, tone, index, on, bind, onPress, onPortfolio, onPortfolioIntent }: {
  p: ProListItem;
  tone: ProToneCardData;
  index: number;
  on: boolean;
  bind: (i: number, el: HTMLDivElement | null) => void;
  onPress: (i: number) => void;
  onPortfolio: (i: number) => void;
  onPortfolioIntent: (i: number) => void;
}) {
  return (
    <div ref={(el) => bind(index, el)} className="qm-cslide">
      <ProToneCard
        size="lg"
        pro={tone}
        index={index}
        selected={on}
        onPress={() => onPress(index)}
        photoOverlay={
          <>
            <span className={`qm-ccheck ${on ? 'on' : ''}`} aria-hidden="true">
              {on && (
                <svg viewBox="0 0 26 26" width="20" height="20" fill="none">
                  <path d="M5.5 13.5 L10.8 18.6 L20.5 8" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" pathLength={1} />
                </svg>
              )}
            </span>
            {/* 포트폴리오 → 사회자 상세(같은 날 사장 '포트폴리오 누르면 상세페이지로'). Enter/Space 가 카드(고르기)로 새지 않게 막는다 */}
            <button type="button" className="qm-cport" aria-label={`${p.name} 포트폴리오(상세) 보기`}
              onPointerDown={() => onPortfolioIntent(index)}
              onKeyDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); onPortfolio(index); }}>
              포트폴리오
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" aria-hidden="true">
                <path d="M9.5 6 15.5 12 9.5 18" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </>
        }
      />
    </div>
  );
});

type QmDrag = {
  id: number;
  type: string;
  x0: number;
  y0: number;
  /** 잡은 순간 위치(고무줄 풀기 전 값) */
  raw0: number;
  /** 누른 카드(탭이면 그 카드로 간다) */
  slide: number;
  dragging: boolean;
  /** 최근 0.1초 손 위치 [시각, x] — 놓을 때 속도 */
  samples: Array<[number, number]>;
};

function QmProCarousel({ pros, selected, onToggle, runAll = false, onSelectOne, onRunAllDone, initialIndex = 0, onOpenPro, enterDelay }: {
  pros: ProListItem[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  /** 전체선택 연출 — 켜지면 첫 장부터 끝 장까지 촤라락 넘기며 한 장씩 체크하고 onRunAllDone */
  runAll?: boolean;
  onSelectOne?: (id: string) => void;
  onRunAllDone?: () => void;
  /** 처음 보여 줄 카드 — 상세(포트폴리오)에 갔다 돌아왔을 때 보던 카드 */
  initialIndex?: number;
  /** 포트폴리오 → 그 사회자 상세로(보던 카드 번호도 넘겨 돌아올 때 그 자리) */
  onOpenPro?: (p: ProListItem, index: number) => void;
  /** 등장(옆에서 스르르) 지연(초) — 안 주면 첫 화면 순서(제목·부제 다음) */
  enterDelay?: number;
}) {
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);
  const slides = useRef<(HTMLDivElement | null)[]>([]);
  const [active, setActive] = useState(initialIndex);
  const activeRef = useRef(initialIndex);
  const tones = useMemo(() => pros.map(toneOf), [pros]);
  const idsKey = pros.map((p) => p.id).join(',');
  const count = pros.length;
  // 최신 값은 ref 로 — memo 된 카드에 늘 같은 함수를 주고, 아래 도우미들은 언제 불려도 지금 값을 읽는다
  const countRef = useRef(count);
  countRef.current = count;
  const prosRef = useRef(pros);
  prosRef.current = pros;
  const runAllRef = useRef(runAll);
  runAllRef.current = runAll;
  const toggleRef = useRef(onToggle);
  toggleRef.current = onToggle;
  const openRef = useRef(onOpenPro);
  openRef.current = onOpenPro;
  const selectOneRef = useRef(onSelectOne);
  selectOneRef.current = onSelectOne;
  const runDoneRef = useRef(onRunAllDone);
  runDoneRef.current = onRunAllDone;

  /* ── 위치 — 네이티브 스크롤·CSS 스냅 대신 직접 굴린다(261002 사장 '스냅이 수우웅 툭 → 고스트도어처럼 천천히 멈추게',
     '완전히 멈추지 않아도 체크되게'). 브라우저 스냅은 멈추는 속도를 못 바꾸고, 미끄러지는 중 탭은 멈추기로만 먹어 체크가 안 됐다.
     pos = 줄이 앞으로 간 거리(px, 0 = 첫 카드). 끝을 넘으면 넘친 만큼 고무줄로 보인다. 그리기는 카드마다 transform 하나. */
  const pos = useRef(0);
  const vel = useRef(0);
  const raf = useRef(0);
  const dims = useRef({ step: 1, max: 0 });
  const drag = useRef<QmDrag | null>(null);
  const eatClick = useRef(false);
  const measure = () => { if (ref.current) dims.current = rowMetrics(ref.current); };
  const at = (i: number) => Math.min(Math.max(0, Math.min(countRef.current - 1, i)) * dims.current.step, dims.current.max);
  /** 몇 번째 카드쯤인지(소수) — 끝 쪽 칸은 스크롤 끝에서 멈추므로 칸 위치를 끝으로 자른 값으로 잰다 */
  const frac = (p: number) => {
    const n = countRef.current;
    const x = Math.min(dims.current.max, Math.max(0, p));
    let k = 0;
    while (k < n - 1 && at(k + 1) <= x) k++;
    const a = at(k);
    const b = k < n - 1 ? at(k + 1) : a;
    return k + (b > a ? Math.min(1, Math.max(0, (x - a) / (b - a))) : 0);
  };
  const width = () => ref.current?.clientWidth || 390;
  const fromRaw = (r: number) => (r < 0 ? -rubber(-r, width()) : r > dims.current.max ? dims.current.max + rubber(r - dims.current.max, width()) : r);
  const toRaw = (p: number) => (p < 0 ? -unrubber(-p, width()) : p > dims.current.max ? dims.current.max + unrubber(p - dims.current.max, width()) : p);

  /** 칠하기 — 모든 카드를 -pos 만큼 옮기고, pos 가 걸친 두 카드만 1배↔0.9배를 나눠 갖는다(손가락 따라 이어서) */
  const paint = () => {
    const n = countRef.current;
    const f = frac(pos.current);
    const k = Math.floor(f);
    const t = f - k;
    const tx = `translate3d(${(-pos.current).toFixed(2)}px,0,0)`;
    for (let i = 0; i < n; i++) {
      const s = slides.current[i];
      if (!s) continue;
      const d = i === k ? t : i === k + 1 ? 1 - t : 1;
      s.style.transform = `${tx} scale(${(1 - 0.1 * d).toFixed(4)})`;
    }
    const now = Math.min(n - 1, Math.round(f));
    if (now !== activeRef.current) {
      activeRef.current = now;
      setActive(now);
    }
  };
  const stop = () => {
    if (raf.current) cancelAnimationFrame(raf.current);
    raf.current = 0;
  };
  /** 고스트도어 — 놓는 순간 속도를 그대로 이어 받아 목표 칸까지 미끄러지고, 끝에서 아주 천천히 멈춘다.
   *  임계 감쇠 스프링 x(t) = (x0 + (v0 + ωx0)·t)·e^(−ωt): 튕기지 않고, 남은 거리 마지막 10% 에 0.4초쯤 쓴다.
   *  목표 쪽으로 너무 빠르게 놓으면(ω·거리 초과) 넘어갔다 돌아오므로 그 속도로 자른다(댐퍼가 받아 주는 느낌). */
  const settle = (target: number, v0 = 0) => {
    stop();
    const W = QM_SETTLE_W;
    const x0 = pos.current - target;
    let v = v0;
    if (x0 < 0 && v > -W * x0) v = -W * x0;
    if (x0 > 0 && v < -W * x0) v = -W * x0;
    const B = v + W * x0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const t = (now - t0) / 1000;
      const e = Math.exp(-W * t);
      const x = (x0 + B * t) * e;
      vel.current = (v - W * B * t) * e;
      const done = Math.abs(x) < 0.2 && Math.abs(vel.current) < 5;
      pos.current = done ? target : target + x;
      if (done) { vel.current = 0; raf.current = 0; }
      paint();
      if (!done) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
  };
  const go = (i: number) => { measure(); settle(at(i), raf.current ? vel.current : 0); };

  // 처음·리롤(명단이 바뀜) — 첫 그림 전에 자리·크기를 칠해 둔다. 상세에서 돌아왔으면 보던 카드부터, 리롤은 첫 카드부터
  const startRef = useRef(initialIndex);
  useLayoutEffect(() => {
    stop();
    measure();
    const start = Math.min(startRef.current, Math.max(0, count - 1));
    startRef.current = 0;
    pos.current = at(start);
    vel.current = 0;
    paint();
  }, [idsKey]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const onResize = () => { stop(); measure(); pos.current = at(activeRef.current); paint(); };
    window.addEventListener('resize', onResize);
    return () => { window.removeEventListener('resize', onResize); stop(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── 손가락·마우스 끌기 — 가로만 우리가(touch-action: pan-y, 세로 스크롤은 브라우저). 미끄러지는 중에 잡으면 그 자리에 멈추고,
     그대로 떼면 '탭' — 누른 카드가 체크되고(카드 click) 그 카드로 스르르 간다. */
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (runAllRef.current || drag.current) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    stop();
    vel.current = 0;
    measure();
    const slideEl = (e.target as HTMLElement).closest('.qm-cslide');
    drag.current = {
      id: e.pointerId, type: e.pointerType, x0: e.clientX, y0: e.clientY, raw0: toRaw(pos.current),
      slide: slideEl ? slides.current.indexOf(slideEl as HTMLDivElement) : -1,
      dragging: false, samples: [[e.timeStamp, e.clientX]],
    };
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || e.pointerId !== d.id) return;
    if (!d.dragging) {
      const dx = e.clientX - d.x0;
      const dy = e.clientY - d.y0;
      // 살짝 떨리는 탭은 탭으로(브라우저 click 이 체크한다). 세로가 더 크면 끌기 아님
      if (Math.abs(dx) < (d.type === 'mouse' ? 5 : 10) || Math.abs(dx) < Math.abs(dy)) return;
      d.dragging = true;
      d.x0 = e.clientX; // 문턱만큼 툭 튀지 않게 여기서부터 잰다
      ref.current?.classList.add('dragging');
      if (d.type === 'mouse') { try { ref.current?.setPointerCapture(e.pointerId); } catch {} }
    }
    pos.current = fromRaw(d.raw0 + (d.x0 - e.clientX));
    paint();
    d.samples.push([e.timeStamp, e.clientX]);
    while (d.samples.length > 2 && e.timeStamp - d.samples[0][0] > 100) d.samples.shift();
  };
  const finish = (e: React.PointerEvent<HTMLDivElement>, cancelled: boolean) => {
    const d = drag.current;
    if (!d || e.pointerId !== d.id) return;
    drag.current = null;
    ref.current?.classList.remove('dragging');
    if (!d.dragging) {
      // 탭(또는 세로 스크롤로 넘어감) — 탭이면 누른 카드로, 아니면 가까운 카드로 스르르
      settle(at(!cancelled && d.slide >= 0 ? d.slide : Math.round(frac(pos.current))));
      return;
    }
    if (d.type === 'mouse') { eatClick.current = true; window.setTimeout(() => { eatClick.current = false; }, 0); }
    // 손 속도(최근 0.1초) → 줄 속도. 손이 왼쪽으로 가면 줄은 앞으로(+)
    let v = 0;
    if (!cancelled) {
      d.samples.push([e.timeStamp, e.clientX]);
      const [t1, x1] = d.samples[0];
      const [t2, x2] = d.samples[d.samples.length - 1];
      if (t2 - t1 > 8) v = -((x2 - x1) / (t2 - t1)) * 1000;
    }
    // 휙 넘기면 그 방향 다음 카드(세게면 몇 장 더), 천천히 놓으면 가까운 카드
    const f = frac(pos.current);
    let target = Math.round(f);
    if (v > 300) target = Math.max(Math.floor(f) + 1, Math.round(frac(pos.current + v * 0.16)));
    else if (v < -300) target = Math.min(Math.ceil(f) - 1, Math.round(frac(pos.current + v * 0.16)));
    settle(at(target), v);
  };
  // 마우스로 끈 끝에 오는 click 은 고르기로 치지 않는다(터치는 끌면 click 이 안 온다)
  const onClickCapture = (e: React.MouseEvent) => {
    if (!eatClick.current) return;
    eatClick.current = false;
    e.stopPropagation();
    e.preventDefault();
  };
  // 키보드(Tab)로 카드에 오면 그 카드로. 포커스가 줄을 몰래 스크롤하면 되돌린다(위치는 transform 이 맡는다)
  const onFocusCapture = (e: React.FocusEvent<HTMLDivElement>) => {
    if (ref.current?.scrollLeft) ref.current.scrollLeft = 0;
    const s = (e.target as HTMLElement).closest('.qm-cslide');
    const i = s ? slides.current.indexOf(s as HTMLDivElement) : -1;
    if (i >= 0 && !drag.current && i !== activeRef.current) go(i);
  };
  const onScroll = () => { if (ref.current?.scrollLeft) ref.current.scrollLeft = 0; };

  // PC 트랙패드 가로 밀기 — 손 따라 움직이다 멈추면(0.14초) 같은 고스트도어로 가까운 카드에. 가로 밀기가 뒤로가기로 새지 않게 막는다
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raw = 0;
    let f0 = 0;
    let on = false;
    let idle = 0;
    let lastT = 0;
    let v = 0;
    const onWheel = (e: WheelEvent) => {
      if (runAllRef.current) return;
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? el.clientWidth : 1;
      const dx = (Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.shiftKey ? e.deltaY : 0) * unit;
      if (!dx) return;
      e.preventDefault();
      // 시각은 performance.now() 로 — 휠 이벤트 timeStamp 는 기준이 제각각이라 속도가 0 으로 나와 제자리로 돌아갔다
      const now = performance.now();
      if (!on) { stop(); measure(); raw = toRaw(pos.current); f0 = frac(pos.current); on = true; lastT = now; v = 0; }
      raw += dx;
      pos.current = fromRaw(raw);
      paint();
      v = v * 0.6 + (dx / Math.max(8, now - lastT)) * 1000 * 0.4;
      lastT = now;
      window.clearTimeout(idle);
      idle = window.setTimeout(() => {
        on = false;
        // 트랙패드는 '놓기'가 없어 살살 밀어도 넘어가게 — 카드 20% 넘게 밀었거나 빠르면 그 방향 다음 카드
        const f = frac(pos.current);
        const moved = f - f0;
        const target = v > 300 || moved > 0.2 ? Math.ceil(f - 0.001) : v < -300 || moved < -0.2 ? Math.floor(f + 0.001) : Math.round(f);
        settle(at(target), Math.max(-1500, Math.min(1500, v)));
      }, 140);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => { el.removeEventListener('wheel', onWheel); window.clearTimeout(idle); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* 전체선택 — 멈춤 없이 한 번에 쭉 '촤라라락' 미끄러지며 지나가는 카드를 차례로 체크하고, 끝은 같은 고스트도어로 천천히 닿는다
     (261002 사장 '뚝뚝뚝 멈추면서 말고 스크롤 촤라라락' — 예전엔 장마다 0.14초 가서 멈추고 체크했다).
     속도: 0.22초 가속 → 일정 속도 V → 남은 거리가 V/ω 가 되면 지수 감속(속도가 끊기지 않고 이어진다).
     카드는 반 이상 들어오면 체크. 보던 카드보다 앞(왼쪽, 화면 밖) 카드는 바로 체크. */
  useEffect(() => {
    if (!runAll) return;
    let cancelled = false;
    let doneTimer = 0;
    stop();
    measure();
    const ids = pros.map((p) => p.id);
    const n = ids.length;
    const { step } = dims.current;
    let next = 0;
    const pickUpTo = (p: number) => {
      while (next < n && p >= at(next) - step * 0.55) selectOneRef.current?.(ids[next++]);
    };
    const finish = () => {
      pickUpTo(Infinity);
      doneTimer = window.setTimeout(() => { if (!cancelled) runDoneRef.current?.(); }, 320);
    };
    const p0 = pos.current;
    const D = Math.max(0, at(n - 1) - p0);
    pickUpTo(p0);
    if (D < 1) {
      finish();
    } else {
      const W = QM_SETTLE_W;
      const Ta = 0.22;
      // 12장이면 1초쯤 걸리는 속도(장당 0.1초 남짓). 짧은 줄은 가속·감속이 들어갈 만큼만
      const V = Math.min(3200, Math.max(1400, D), D / (Ta / 3 + 1 / W));
      const xa = (V * Ta) / 3; // 가속이 끝나는 거리
      const r = V / W; // 감속을 시작하는 남은 거리 — 여기서 x = r·e^(−ωt) 로 넘기면 시작 속도가 정확히 V
      const tC = Ta + (D - r - xa) / V;
      const t0 = performance.now();
      const tick = (now: number) => {
        if (cancelled) return;
        const t = (now - t0) / 1000;
        let x: number;
        let done = false;
        if (t < Ta) x = (V * t * t * t) / (3 * Ta * Ta);
        else if (t < tC) x = xa + V * (t - Ta);
        else {
          const rem = r * Math.exp(-W * (t - tC));
          done = rem < 0.6;
          x = done ? D : D - rem;
        }
        pos.current = p0 + x;
        paint();
        pickUpTo(pos.current);
        if (done) { raf.current = 0; finish(); return; }
        raf.current = requestAnimationFrame(tick);
      };
      raf.current = requestAnimationFrame(tick);
    }
    return () => { cancelled = true; stop(); window.clearTimeout(doneTimer); };
  }, [runAll]); // eslint-disable-line react-hooks/exhaustive-deps

  const bind = useCallback((i: number, el: HTMLDivElement | null) => { slides.current[i] = el; }, []);
  // 카드 누르기 = 그 카드 고르기/빼기 — 보고 있는 카드든 옆에 걸친 카드든, 멈추는 중이든(같은 날 '완전히 멈추지 않아도 체크되게')
  const pressSlide = useCallback((i: number) => {
    if (runAllRef.current) return;
    const id = prosRef.current[i]?.id;
    if (id) toggleRef.current(id);
  }, []);
  const openPortfolio = useCallback((i: number) => {
    const p = prosRef.current[i];
    if (p) openRef.current?.(p, i);
  }, []);
  // 누르는 순간 상세 화면·데이터를 미리 받아 둔다(떼면 바로 뜨게)
  const portfolioIntent = useCallback((i: number) => {
    const p = prosRef.current[i];
    if (!p) return;
    router.prefetch(`/pros/${p.id}`);
    discoveryApi.getProDetail(p.id).catch(() => {});
  }, [router]);

  return (
    <div className="qm-cwrap qm-a-item" style={enterDelay == null ? stag(1) : { animationDelay: `${enterDelay}s` }}>
      <div
        ref={ref}
        className="qm-carousel"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={(e) => finish(e, false)}
        onPointerCancel={(e) => finish(e, true)}
        onClickCapture={onClickCapture}
        onFocusCapture={onFocusCapture}
        onScroll={onScroll}
      >
        {pros.map((p, i) => (
          <QmSlide key={p.id} p={p} tone={tones[i]} index={i} on={selected.has(p.id)}
            bind={bind} onPress={pressSlide} onPortfolio={openPortfolio} onPortfolioIntent={portfolioIntent} />
        ))}
      </div>
      {count > 1 && (
        <div className="qm-cdots">
          {pros.map((p, i) => (
            <button key={p.id} type="button" aria-label={`${i + 1}번째 사회자`} className={i === active ? 'on' : ''} onClick={() => go(i)} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ── 사회자 찾는 중 — 토스 '대출 비교' 조회 화면과 같게(261002 사장이 준 화면 녹화, "100% 동일하게") ──────────
 * 녹화에서 잰 것: 왼쪽 정렬 두 줄 제목(단계마다 흐려졌다 또렷해지며 바뀜: 시작 → 'N개 중 M개 금융사에 다녀왔어요'
 *  → 안심 문구 → 혜택 확인 → '거의 다 됐어요' → 다 되면 '찾았어요!') · 굵은 도넛 링(연한 하늘 바탕 위로 위에서 시계 방향,
 *  꼬리는 연하고 머리는 진한 파랑 · 둥근 머리) · 가운데 큰 숫자 + 연한 % · 링 아래에 걸친 3D 아이콘 ·
 *  회색 바탕 두 칸 탭(흰 알약이 미끄러짐) · 결과가 하나씩 들어오며 제 순위에 끼어드는 목록(그 자리에서 커지며 등장 +
 *  연한 파랑 바탕이 1초쯤 뒤 사라짐, 아래 줄은 밀려 내려감 — 아직인 줄은 '…하고 있어요' 회색) ·
 *  100% 뒤 제목이 '찾았어요!' 로 바뀌고 잠시 뒤 링 → 탭 → 줄 차례로 사라지며 결과 화면으로.
 * 바꾼 것: 금융사 → 사회자(사진·이름·경력·지역 / ★평점·리뷰 수), 금리 낮은 순·한도 높은 순 → 평점 높은 순·리뷰 많은 순,
 *  은행 아이콘 → 홈 사회자 아이콘(백합+마이크), 64초 → 6초 남짓(토스는 실제 조회 시간이다). 결과 화면은 그대로. */
const S_ROWS = 10;
const S_INTRO_MS = 650;
const S_COUNT_MS = 5400;
const S_FOUND_HOLD_MS = 900;
const S_OUT_MS = 600;

type SRow = { id: string; name: string; photo: string; career: number; region: string; rating: number; reviews: number };

/** 제목 바꾸기 — 옛 제목은 짧게 사라지고 새 제목은 흐렸다 또렷하게(녹화의 0.3초 바뀜) */
function SwapTitle({ k, children }: { k: string; children: ReactNode }) {
  const [prev, setPrev] = useState<{ k: string; node: ReactNode } | null>(null);
  const lastK = useRef(k);
  const lastNode = useRef<ReactNode>(children);
  useLayoutEffect(() => {
    if (lastK.current === k) return;
    setPrev({ k: lastK.current, node: lastNode.current });
    lastK.current = k;
    const t = window.setTimeout(() => setPrev(null), 220);
    return () => window.clearTimeout(t);
  }, [k]);
  useLayoutEffect(() => { lastNode.current = children; });
  return (
    <div className="qm-s-titlebox">
      {prev && <h1 key={`p-${prev.k}`} className="qm-s-title out" aria-hidden="true">{prev.node}</h1>}
      <h1 key={`c-${k}`} className="qm-s-title in" aria-live="polite">{children}</h1>
    </div>
  );
}

function QmSearching({ pool, ready, failed, onDone, onBack }: {
  pool: { featured: ProListItem[]; rest: ProListItem[] };
  ready: boolean;
  failed: boolean;
  onDone: () => void;
  onBack: () => void;
}) {
  const rows = useMemo<SRow[]>(() => [...pool.featured, ...pool.rest].slice(0, S_ROWS).map((p) => ({
    id: p.id,
    name: p.name,
    photo: p.images?.[0] || p.profileImageUrl || '',
    career: p.careerYears || 0,
    region: p.isNationwide ? '전국' : String((p.regions || [])[0] || '').replace(/\(.*?\)/g, '').trim(),
    rating: p.avgRating || 0,
    reviews: p.reviewCount || 0,
  })), [pool]);
  const total = pool.featured.length + pool.rest.length;
  // 결과가 들어오는 순서 — 화면 순서와 다르게 섞는다(위에서부터 차례로 채우면 '조회'가 아니라 '목록'처럼 보인다)
  const rowsKey = rows.map((r) => r.id).join(',');
  const arrival = useMemo(() => shuffle(rows.map((r) => r.id)), [rowsKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const [pct, setPct] = useState(0);
  const [phase, setPhase] = useState<'run' | 'found' | 'out'>('run');
  const [tab, setTab] = useState<'rating' | 'reviews'>('rating');
  const ringRef = useRef<HTMLDivElement>(null);
  const readyRef = useRef(ready);
  const failedRef = useRef(failed);
  readyRef.current = ready;
  failedRef.current = failed;
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  /* 시간표 — 데이터 오기 전엔 0~2% 에서 기다리고, 오면 S_COUNT_MS 동안 100% 까지.
     링은 매 프레임 CSS 변수로(다시 그리기 없음), 숫자는 정수가 바뀔 때만 상태로. */
  useEffect(() => {
    const reduce = (() => { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } })();
    const countMs = reduce ? 1200 : S_COUNT_MS;
    const t0 = performance.now();
    let countStart: number | null = null;
    let raf = 0;
    let lastInt = -1;
    let finished = false;
    const timers: number[] = [];
    const tick = (now: number) => {
      if (failedRef.current) {
        if (countStart === null) countStart = now - countMs * 0.9; // 못 받았으면 얼른 끝내고 결과 화면이 안내한다
      } else if (countStart === null && readyRef.current && now - t0 >= S_INTRO_MS) {
        countStart = now;
      }
      const v = countStart === null ? Math.min(2, ((now - t0) / S_INTRO_MS) * 2) : 2 + 98 * Math.min(1, (now - countStart) / countMs);
      const el = ringRef.current;
      if (el) {
        // 녹화 실측: 머리 뒤로 160° 쯤에서 바탕색까지 옅어지는 '혜성'(46% 땐 위쪽 시작점이 비어 있다),
        // 아직 짧을 땐 머리도 옅다(2% ≈ 0.45 → 11% ≈ 0.65 → 46% ≈ 0.95)
        const head = (v / 100) * 360;
        el.style.setProperty('--head', `${head}deg`);
        el.style.setProperty('--tail', `${Math.max(0, head - 160)}deg`);
        // 0% 땐 아예 숨긴다 — 시작선(0°)에서 원뿔 그라데이션 이음매가 머리카락처럼 한 줄 보였다
        el.style.setProperty('--a', head < 1 ? '0' : String(Math.min(1, 0.36 + head / 180)));
      }
      const iv = Math.floor(v);
      if (iv !== lastInt) { lastInt = iv; setPct(iv); }
      if (v >= 100 && !finished) {
        finished = true;
        setPhase('found');
        timers.push(window.setTimeout(() => setPhase('out'), S_FOUND_HOLD_MS));
        timers.push(window.setTimeout(() => doneRef.current(), S_FOUND_HOLD_MS + S_OUT_MS));
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); timers.forEach((t) => window.clearTimeout(t)); };
  }, []);

  /* 결과 들어온 줄 — 6% 부터 하나씩(마지막 줄은 90% 남짓) */
  const n = rows.length;
  const doneCount = ready && n ? Math.max(0, Math.min(n, Math.floor((pct - 6) / (84 / n)) + 1)) : 0;
  const doneIds = useMemo(() => new Set(arrival.slice(0, doneCount)), [arrival, doneCount]);
  /* 들어온 시각 — 그 줄만 '그 자리에서 커지며 + 연한 파랑' 을 탄다 */
  const arrivedAt = useRef(new Map<string, number>());
  doneIds.forEach((id) => { if (!arrivedAt.current.has(id)) arrivedAt.current.set(id, performance.now()); });
  const byId = useMemo(() => new Map(rows.map((r) => [r.id, r])), [rows]);
  const sortKey = (r: SRow) => (tab === 'rating' ? [r.rating, r.reviews] : [r.reviews, r.rating]);
  const doneRows = [...doneIds].map((id) => byId.get(id)).filter((r): r is SRow => !!r)
    .sort((a, b) => { const x = sortKey(a), y = sortKey(b); return y[0] - x[0] || y[1] - x[1]; });
  const pendingRows = rows.filter((r) => !doneIds.has(r.id));
  const ordered = [...doneRows, ...pendingRows];

  /* 줄 자리 — DOM 순서는 처음 그대로 두고 자리(translateY)만 바꾼다. 탭을 바꾸거나 새 줄이 끼어들면 미끄러진다.
     ⚠ React 가 DOM 을 옮기게 두면(순서대로 그리기) 옮겨진 줄의 등장 애니가 처음부터 다시 돈다(실측 — 여러 줄이 깜빡였다).
     방금 들어온 줄만 미끄러지지 않고 제 자리로 바로 가서 그 자리에서 커진다(녹화의 끼어들기). */
  const rankOf = new Map(ordered.map((r, i) => [r.id, i]));
  const ROW_H = 70;

  // 제목
  const visited = total ? Math.min(total, Math.max(1, Math.round(total * Math.min(1, pct / 46)))) : 0;
  const stage = phase !== 'run' ? 'found' : !ready || pct < 3 || !total ? 'intro' : pct < 52 ? 'count' : pct < 63 ? 'safe' : pct < 76 ? 'check' : 'almost';
  const titles: Record<string, ReactNode> = {
    intro: <>고객님의<br />사회자 매칭을 시작할게요</>,
    count: <>{total}명 중<br />{visited}명의 사회자를 살펴봤어요</>,
    safe: <>연락처는 걱정 마세요<br />고른 사회자에게만 전달돼요</>,
    check: <>예식일과 분위기에 맞는지도<br />함께 확인할게요</>,
    almost: <>거의 다 됐어요<br />곧 매칭이 완료돼요</>,
    found: <>조건에 딱 맞는<br />사회자를 찾았어요!</>,
  };
  const pendingText = pct < 35 ? '프로필을 살펴보고 있어요' : '리뷰를 확인하고 있어요';
  const out = phase === 'out';
  const fade = (i: number): React.CSSProperties | undefined => (out ? { animation: `qm-s-fade ${S_OUT_MS - 120}ms ease ${i * 45}ms both` } : undefined);

  return (
    <div className="qm-page" key="searching">
      <Header onBack={onBack} />
      <main className="qm-main qm-s-main">
        <div style={fade(0)}><SwapTitle k={stage}>{titles[stage]}</SwapTitle></div>

        <div className="qm-s-ringwrap" style={fade(0)}>
          <div ref={ringRef} className="qm-s-ring" style={{ ['--head' as string]: '0deg', ['--tail' as string]: '0deg', ['--a' as string]: '0' }}>
            <span className="qm-s-track" />
            <span className="qm-s-arc" />
            {pct > 0 && <span className="qm-s-cap" />}
          </div>
          <div className="qm-s-num">
            <b>{Math.min(100, pct)}</b>{pct < 100 && <i>%</i>}
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="qm-s-ic" src="/images/category-icons/wedding-mc-icon.png" alt="" draggable={false} />
          <span className="qm-s-icshadow" aria-hidden="true" />
        </div>

        <div className="qm-s-tabs" role="tablist" style={fade(1)}>
          <span className="qm-s-pill" style={{ transform: tab === 'rating' ? 'translateX(0)' : 'translateX(100%)' }} />
          <button type="button" role="tab" aria-selected={tab === 'rating'} className={`qm-s-tab ${tab === 'rating' ? 'on' : ''}`} onClick={() => setTab('rating')}>평점 높은 순</button>
          <button type="button" role="tab" aria-selected={tab === 'reviews'} className={`qm-s-tab ${tab === 'reviews' ? 'on' : ''}`} onClick={() => setTab('reviews')}>리뷰 많은 순</button>
        </div>

        <div className="qm-s-list">
          {!ready && !failed
            ? [0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="qm-s-row skel">
                <span className="qm-s-ava" />
                <span className="qm-s-txt"><span className="qm-s-bar w1" /><span className="qm-s-bar w2" /></span>
              </div>
            ))
            : (
              <div className="qm-s-rows" style={{ height: rows.length * ROW_H }}>
                {rows.map((r) => {
                  const done = doneIds.has(r.id);
                  const age = done ? performance.now() - (arrivedAt.current.get(r.id) ?? 0) : Infinity;
                  const rank = rankOf.get(r.id) ?? 0;
                  const sub = [r.career ? `경력 ${r.career}년` : '', r.region].filter(Boolean).join(' · ');
                  return (
                    <div key={r.id} className="qm-s-slot"
                      style={{ transform: `translateY(${rank * ROW_H}px)`, transition: age < 90 ? 'none' : undefined, ...(fade(2 + rank) || {}) }}>
                      <div className={`qm-s-row ${age < 1250 ? 'new' : ''}`}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        {r.photo ? <img className="qm-s-ava" src={r.photo} alt="" loading="eager" /> : <span className="qm-s-ava" />}
                        <span className="qm-s-txt">
                          <span className="qm-s-name">{r.name}</span>
                          <span className={`qm-s-sub ${done ? '' : 'wait'}`}>{done ? sub || '프리티풀 사회자' : pendingText}</span>
                        </span>
                        {done && (
                          <span className="qm-s-val">
                            <b>{r.reviews > 0 ? `★ ${r.rating.toFixed(1)}` : '신규'}</b>
                            <span>리뷰 {r.reviews}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
        </div>
      </main>
    </div>
  );
}

/* ── 예식 일시 시트 — 달력 + 시간 칩을 한 장에(261002 사장이 준 토스 '가는 날' 화면 그대로, 화이트 버전).
 *  · 고른 날짜·시간 = 연한 쿨그레이 바탕 + 진한 굵은 글자. 파랑은 아래 버튼에만(사장 '타이틀 컬러 쓰이는 부분은 버튼만')
 *  · 시간 = 00~23시 칩 줄(옆으로 넘김) — 처음엔 09시가 골라진 채 줄 맨 앞(사장 '00시부터 말고 09시부터 포커스') + 분 칩(10분, 기본 00분)
 *  · 달력이 뜨면 1일 줄부터 한 줄씩 아래→위로 촤라락, 그 밑 시간·버튼도 이어서 올라온다. 달을 넘기면 달력 줄만 다시
 *  · 다음 = 날짜·시간 반영하고 바로 권역 단계로. 바깥·Esc·뒤로가기 = 고른 데까지 반영하고 스르르 닫기 ── */
const QM_WEEK = ['일', '월', '화', '수', '목', '금', '토'];
const QM_DT_HOURS = Array.from({ length: 24 }, (_, i) => i);
const QM_DT_MINS = [0, 10, 20, 30, 40, 50];
const QM_DT_DEFAULT_HOUR = 9;
const QM_DT_MONTHS_AHEAD = 36;
/** 한 줄씩 올라오는 간격(초) · 첫 줄 시작(시트가 올라오는 동안) */
const QM_RISE_GAP = 0.05;
const QM_RISE_START = 0.12;
const pad2 = (n: number) => String(n).padStart(2, '0');
const localYmd = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const rise = (s: number) => ({ animationDelay: `${s.toFixed(3)}s` });

/** 한 달 칸 — 달마다 새로 떠서(key) 줄들이 다시 올라온다. 높이가 달마다 출렁이지 않게 늘 6줄 */
function QmCalGrid({ y, m, sel, todayStr, startAt, onPick }: {
  y: number;
  m: number;
  sel: string;
  todayStr: string;
  startAt: number;
  onPick: (d: string) => void;
}) {
  const [base] = useState(startAt); // 뜬 순간 값으로 고정(다시 그려져도 지연이 바뀌어 애니메이션이 튀지 않게)
  const first = new Date(y, m, 1).getDay();
  const daysIn = new Date(y, m + 1, 0).getDate();
  return (
    <div className="qm-cal-grid">
      {Array.from({ length: 6 }, (_, r) => (
        <div key={r} className="qm-cal-row" style={rise(base + r * QM_RISE_GAP)}>
          {Array.from({ length: 7 }, (_, c) => {
            const d = r * 7 + c - first + 1;
            if (d < 1 || d > daysIn) return <span key={c} />;
            const ds = `${y}-${pad2(m + 1)}-${pad2(d)}`;
            const on = ds === sel;
            return (
              <button key={c} type="button" className={`qm-cal-day ${on ? 'on' : ''}`} disabled={ds < todayStr} aria-pressed={on}
                aria-label={`${y}년 ${m + 1}월 ${d}일 ${QM_WEEK[c]}요일`} onClick={() => onPick(ds)}>
                {d}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function QmDateTimeSheet({ date, time, onClose, onNext }: {
  date: string;
  time: string;
  /** 바깥·Esc·뒤로가기 — 고른 데까지 넘긴다(날짜를 골랐으면 그 시간도) */
  onClose: (date: string, time: string) => void;
  /** 다음 — 날짜·시간 넘기고 다음 단계로 */
  onNext: (date: string, time: string) => void;
}) {
  const [now] = useState(() => new Date());
  const todayStr = localYmd(now);
  const [sel, setSel] = useState(date && date >= todayStr ? date : '');
  const [hour, setHour] = useState(() => (time ? Number(time.slice(0, 2)) : QM_DT_DEFAULT_HOUR));
  const [minute, setMinute] = useState(() => (time ? Math.min(50, Math.round(Number(time.slice(3, 5)) / 10) * 10) : 0));
  const [ym, setYm] = useState(() => {
    const b = sel ? new Date(`${sel}T00:00:00`) : now;
    return { y: b.getFullYear(), m: b.getMonth() };
  });
  const minIdx = now.getFullYear() * 12 + now.getMonth();
  const curIdx = ym.y * 12 + ym.m;
  const goMonth = (delta: number) => setYm(({ y, m }) => {
    const t = Math.max(minIdx, Math.min(minIdx + QM_DT_MONTHS_AHEAD, y * 12 + m + delta));
    return { y: Math.floor(t / 12), m: t % 12 };
  });
  // 처음 뜬 달만 시트가 올라오는 동안 시작, 넘긴 달은 바로
  const firstGrid = useRef(true);
  useEffect(() => { firstGrid.current = false; }, []);
  // 달력 밑 줄들 — 처음 뜬 달의 마지막 줄 다음부터 이어서(뜬 순간 값으로 고정)
  const [below] = useState(() => {
    const first = new Date(ym.y, ym.m, 1).getDay();
    const rows = Math.ceil((first + new Date(ym.y, ym.m + 1, 0).getDate()) / 7);
    return QM_RISE_START + rows * QM_RISE_GAP + 0.03;
  });
  const hourOff = (h: number) => sel === todayStr && h <= now.getHours();
  const timeOk = !hourOff(hour);
  const timeStr = `${pad2(hour)}:${pad2(minute)}`;
  const canNext = !!sel && timeOk;

  // 시간 칩 줄 — 고른 시(처음엔 09시)가 줄 맨 앞에 오게
  const hoursRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const row = hoursRef.current;
    const chip = row?.querySelector<HTMLElement>(`[data-h="${hour}"]`);
    if (row && chip) row.scrollLeft = chip.offsetLeft - (parseFloat(getComputedStyle(row).paddingLeft) || 0);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 시트 — 닫힐 때도 스르르(뚝 금지). 안드로이드 뒤로가기 = 시트만 닫기(히스토리 한 칸, 채팅 시트와 같은 방식)
  const [out, setOut] = useState(false);
  const outRef = useRef(false);
  const popped = useRef(false);
  const pushed = useRef(false);
  const latest = useRef({ sel, timeStr, timeOk, onClose, onNext });
  latest.current = { sel, timeStr, timeOk, onClose, onNext };
  const close = (mode: 'close' | 'next' = 'close') => {
    if (outRef.current) return;
    outRef.current = true;
    setOut(true);
    if (!popped.current && (window.history.state as { qmSheet?: boolean } | null)?.qmSheet) window.history.back();
    window.setTimeout(() => {
      const v = latest.current;
      if (mode === 'next') v.onNext(v.sel, v.timeStr);
      else v.onClose(v.sel, v.sel && v.timeOk ? v.timeStr : '');
    }, 240);
  };
  const closeRef = useRef(close);
  closeRef.current = close;
  useEffect(() => {
    if (!pushed.current) { window.history.pushState({ qmSheet: true }, ''); pushed.current = true; }
    const onPop = () => { popped.current = true; closeRef.current(); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeRef.current(); };
    window.addEventListener('popstate', onPop);
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('popstate', onPop);
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, []);

  return (
    <div className={`ft-scrim qm-sheet-scrim ${out ? 'out' : ''}`} onClick={() => close()}>
      <div className="ft-sheet qm-dtsheet" role="dialog" aria-modal="true" aria-label="예식 날짜와 시간 선택" onClick={(e) => e.stopPropagation()}>
        <div className="ft-grab" />
        <h2 className="ft-title">예식일</h2>
        <div className="qm-cal-head">
          <b>{ym.y}년 {pad2(ym.m + 1)}월</b>
          <div className="qm-cal-nav">
            <button type="button" aria-label="이전 달" disabled={curIdx <= minIdx} onClick={() => goMonth(-1)}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M15 5.5 8.5 12l6.5 6.5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
            <button type="button" aria-label="다음 달" disabled={curIdx >= minIdx + QM_DT_MONTHS_AHEAD} onClick={() => goMonth(1)}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M9 5.5 15.5 12 9 18.5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
          </div>
        </div>
        <div className="qm-cal-week" aria-hidden="true">{QM_WEEK.map((w) => <span key={w}>{w}</span>)}</div>
        <QmCalGrid key={curIdx} y={ym.y} m={ym.m} sel={sel} todayStr={todayStr} startAt={firstGrid.current ? QM_RISE_START : 0} onPick={setSel} />
        <p className="qm-tlabel qm-rise" style={rise(below)}>
          {timeOk ? <><strong>{pad2(hour)}시{minute ? ` ${pad2(minute)}분` : ''}</strong> 예식</> : '예식 시간을 골라주세요'}
        </p>
        <div ref={hoursRef} className="qm-tchips qm-rise" style={rise(below + QM_RISE_GAP)} role="group" aria-label="예식 시(時)">
          {QM_DT_HOURS.map((h) => (
            <button key={h} type="button" data-h={h} className={`qm-tchip ${h === hour ? 'on' : ''}`} disabled={hourOff(h)} aria-pressed={h === hour} onClick={() => setHour(h)}>
              {pad2(h)}시
            </button>
          ))}
        </div>
        <div className="qm-tchips min qm-rise" style={rise(below + QM_RISE_GAP * 2)} role="group" aria-label="예식 분">
          {QM_DT_MINS.map((mm) => (
            <button key={mm} type="button" className={`qm-tchip ${mm === minute ? 'on' : ''}`} aria-pressed={mm === minute} onClick={() => setMinute(mm)}>
              {pad2(mm)}분
            </button>
          ))}
        </div>
        <div className="ft-actions qm-rise" style={rise(below + QM_RISE_GAP * 3)}>
          <button type="button" className="ft-btn primary" disabled={!canNext} onClick={() => close('next')}>다음</button>
        </div>
      </div>
    </div>
  );
}

function NoteCard({ note }: { note: Note }) {
  return (
    <div className="qm-note">
      <b>{note.title}</b>
      <p>{note.body}</p>
      {note.list && <ol>{note.list.map((t, i) => <li key={i}><span>{i + 1}.</span>{t}</li>)}</ol>}
    </div>
  );
}

/** 포트폴리오(상세)에 갔다 뒤로 오면 보던 결과 그대로 — 갈 때 sessionStorage 에 적고, 돌아와 한 번 쓰고 지운다(30분 지나면 버림) */
const QM_RETURN_KEY = 'qm-return-v1';
/** 랜딩 리드 구글 시트(Apps Script, 시트에 붙어 있어 저장소엔 없음) — wedding-mc 와 같은 주소 */
const QUICK_SHEET_URL =
  'https://script.google.com/macros/s/AKfycbwGOi4e1J2Q1w8x-5UEe-czB3uy6mET90xBhP9OG82fl4jRPEyYdBfqJkmDZuYJMFuc/exec';
const QM_RETURN_TTL = 30 * 60 * 1000;
/** 테스트 계정 로그인이 신청 중에 풀렸다는 표시(이 탭 세션) — 풀린 뒤 다시 누르면 비로그인(번호) 경로로 실제 사회자에게 가므로 막는다 */
const QM_TEST_LOCK_KEY = 'qm-test-lock';
/** 시트에 남길 번호 — wedding-mc normalizePhone 과 같은 모양(11자리 3-4-4, 10자리 3-3-4·02 는 2-4-4). 하이픈 없는 숫자는 시트가 숫자로 바꿔 앞 0 이 빠질 수 있다 */
function sheetPhone(d: string) {
  if (d.length === 11) return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
  if (d.length === 10) return d.startsWith('02') ? `${d.slice(0, 2)}-${d.slice(2, 6)}-${d.slice(6)}` : `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
  return d;
}
/** 지금 로그인 정보로 본 '점검용 테스트 계정' 짐작(lib/test-lead, 서버와 같은 규칙) — 신청 전 안내·분석 생략용. 사회자에게 갔는지는 서버 응답이 정한다 */
function storeTestHint() {
  const u = useAuthStore.getState().user;
  return isTestLeadSubmission(u?.name, u?.id);
}
function ssFlag(key: string, on?: boolean) {
  try {
    if (on === undefined) return sessionStorage.getItem(key) === '1';
    if (on) sessionStorage.setItem(key, '1'); else sessionStorage.removeItem(key);
  } catch {}
  return false;
}

export default function QuickMatchPage() {
  const [step, setStep] = useState<Step>('date');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [regionKey, setRegionKey] = useState('');
  const [venue, setVenue] = useState('');
  const [moods, setMoods] = useState<Set<string>>(new Set());
  const [part, setPart] = useState('');
  const [gender, setGender] = useState<'any' | 'male' | 'female' | ''>('');
  // 후보(260927 사장) — featured = 지정 사회자(첫 화면, 이 사람들한테만 고객 번호가 간다),
  // rest = 나머지(리롤하면 나옴, 최근 견적을 보낸 순, 번호 없이 채팅으로만)
  const [pool, setPool] = useState<{ featured: ProListItem[]; rest: ProListItem[] }>({ featured: [], rest: [] });
  const [rerolled, setRerolled] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loadErr, setLoadErr] = useState(false);
  const [contact, setContact] = useState('');
  const [phone, setPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [selectingAll, setSelectingAll] = useState(false);
  /** 전체선택 연출 중(카드 줄이 넘기며 체크) */
  const [selectAllRun, setSelectAllRun] = useState(false);
  /** 찾는 중 화면이 데이터를 기다리는지 — 받기 끝나면(성공·실패 모두) true */
  const [poolReady, setPoolReady] = useState(false);
  /** 상세에서 돌아왔을 때 처음 보여 줄 카드 */
  const [restoreIndex, setRestoreIndex] = useState(0);
  /** 예식 일시 시트(달력 + 시간 칩) */
  const [dtOpen, setDtOpen] = useState(false);
  const router = useRouter();
  // 신청 완료 뒤 갈 곳 — 일반 회원은 매칭 탭(내 신청이 보이는 곳), 그 밖(사회자·업체·비로그인)은 홈(261005 사장)
  const authUser = useAuthStore((st) => st.user);
  const doneDest = authUser?.role === 'general' ? '/inquiries' : '/main';
  const leaveDone = useCallback(() => router.replace(doneDest), [router, doneDest]);
  const accessToken = useAuthStore((st) => st.accessToken);
  // 점검용 테스트 계정(lib/test-lead, 261008 사장) — 서버가 토큰으로 판정해 사회자에게 안 보낸다.
  // 화면 판정은 둘로 나눈다: 신청 전 알약은 '토큰까지 있는' 테스트 계정일 때만(토큰이 없으면 서버는 비로그인 번호 경로로 보고 실제로 보낸다),
  // 완료 문구·시트 [테스트] 는 서버 응답(matchRequest.rawUserInput.suppressedAsTestLead)으로 — 서버가 실제로 보냈는데 화면이 '안 갔다'고 하지 않게.
  // 로그인 정보는 브라우저 저장소에서 오므로 첫 렌더(서버와 같아야 함) 뒤에 판정한다
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  const isTest = mounted && isTestLeadSubmission(authUser?.name, authUser?.id);
  /** 서버가 테스트 의뢰로 받아 사회자에게 안 보냈는지(완료 화면용) */
  const [doneSuppressed, setDoneSuppressed] = useState(false);
  // 메타 픽셀 '신청 시작'(wedding-mc 의 폼 시작과 같은 이벤트) — 첫 단계(예식 일시)를 넘길 때 한 번.
  // 이 랜딩 픽셀에만(trackSingle) — 'track' 은 루트 GTM 이 띄운 사이트 픽셀에도 가 퀵매칭 전엔 없던 이벤트가 사이트 픽셀에 생긴다. 테스트 계정은 안 보낸다
  const startFiredRef = useRef(false);
  const fireStart = useCallback(() => {
    if (startFiredRef.current) return;
    startFiredRef.current = true;
    if (storeTestHint()) return;
    const fbq = (window as any).fbq;
    if (typeof fbq === 'function') fbq('trackSingle', META_PIXEL_ID, 'InitiateCheckout', { content_name: 'Quick Match Start' });
  }, []);

  const group = useMemo(() => REGION_GROUPS.find((g) => g.key === regionKey), [regionKey]);
  // 유입 값 보존 + 방문 1건(기기 세션당 1번) — 어드민 홈 '전환 퍼널' 2단계(261005)
  // 점검용 테스트 계정 방문은 퍼널에 안 센다(persist 는 localStorage 라 마운트 때 이미 복원돼 있다)
  useEffect(() => { captureUtm(); if (!storeTestHint()) trackLandingVisit('quick-match'); }, []);
  // 날짜·시간을 아직 안 골랐으면 단계에 들어오자마자 시트를 띄운다(제목이 먼저 보이게 한 박자 뒤) — 따로 누를 필요 없이
  useEffect(() => {
    if (step !== 'date' || (date && time)) return;
    const t = window.setTimeout(() => setDtOpen(true), 450);
    return () => window.clearTimeout(t);
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps
  // 상세(포트폴리오)에서 뒤로 왔으면 결과 화면을 그대로 되살린다 — 첫 그림 전에(날짜 화면이 번쩍이지 않게)
  useLayoutEffect(() => {
    let raw: string | null = null;
    try { raw = sessionStorage.getItem(QM_RETURN_KEY); sessionStorage.removeItem(QM_RETURN_KEY); } catch {}
    if (!raw) return;
    try {
      const v = JSON.parse(raw);
      if (v?.v !== 1 || !(Date.now() - v.ts < QM_RETURN_TTL) || !Array.isArray(v.pool?.featured) || !Array.isArray(v.pool?.rest)) return;
      setDate(v.date || ''); setTime(v.time || ''); setRegionKey(v.regionKey || ''); setVenue(v.venue || '');
      setMoods(new Set(v.moods || [])); setPart(v.part || ''); setGender(v.gender || '');
      setPool({ featured: v.pool.featured, rest: v.pool.rest });
      setRerolled(!!v.rerolled); setSelected(new Set(v.selected || []));
      setLoadErr(false); setPoolReady(true);
      setRestoreIndex(Math.max(0, Number(v.index) || 0));
      setStep('results');
    } catch {}
  }, []);
  useEffect(() => { if (step === 'results') { setSelectingAll(false); setSelectAllRun(false); } }, [step]);

  // 단일선택 자동 진행. 빠른 연속 탭만 디바운스로 막고, 절대 영구히 막히지 않게 타임스탬프로 관리.
  const lastAdvanceRef = useRef(0);
  function advance(next: Step) {
    const now = Date.now();
    if (now - lastAdvanceRef.current < 350) return;
    lastAdvanceRef.current = now;
    setTimeout(() => setStep(next), 200);
  }
  function back(to: Step) { lastAdvanceRef.current = Date.now(); setStep(to); }

  function press(k: string) {
    setPhone((p) => {
      const d = p.replace(/\D/g, '');
      if (k === 'back') return normalizePhone(d.slice(0, -1));
      if (d.length >= 11) return p;
      return normalizePhone(d + k);
    });
  }

  async function loadPros(g: 'any' | 'male' | 'female') {
    setLoadErr(false);
    try {
      const [res, qp] = await Promise.all([
        discoveryApi.getProList({ limit: 500, sort: 'reviews', withTotal: false }) as Promise<any>,
        matchApi.getQuickPool().catch(() => null),
      ]);
      const rows: ProListItem[] = Array.isArray(res) ? res : (res?.data || res?.rows || []);
      const byId = new Map(rows.map((p) => [p.id, p] as const));
      const pick = (ids: string[] = []) => shuffle(ids.map((id) => byId.get(id)).filter((p): p is ProListItem => !!p));
      // 지정 사회자 — 성별은 사장 명단 기준(프로필 성별 아님). 상관없음이면 여·남 번갈아 12명. 권역 맞는 사람 먼저
      const fm = qp?.featured;
      const featuredList = !fm ? [] : g === 'male' ? pick(fm.male) : g === 'female' ? pick(fm.female) : interleave(pick(fm.female), pick(fm.male));
      const featured = [...featuredList.filter((p) => matchesRegion(p, group)), ...featuredList.filter((p) => !matchesRegion(p, group))];
      // 나머지 — 지정·매칭 제외 빼고 고른 성별만, 최근 견적을 보낸 순(서버 순서). 권역 맞는 사람 먼저
      const skip = new Set([...(fm?.male || []), ...(fm?.female || []), ...(qp?.excluded || [])]);
      const rank = new Map<string, number>();
      (qp?.order || []).forEach((id, i) => rank.set(id, i));
      const others = rows
        .filter((p) => !skip.has(p.id) && matchesGender(p, g))
        .sort((a, b) => (rank.get(a.id) ?? 1e9) - (rank.get(b.id) ?? 1e9));
      const rest = [...others.filter((p) => matchesRegion(p, group)), ...others.filter((p) => !matchesRegion(p, group))];
      setPool({ featured, rest });
    } catch { setLoadErr(true); setPool({ featured: [], rest: [] }); }
    setPoolReady(true);
  }

  useEffect(() => {
    if (step !== 'searching') return;
    // 시간표(링·목록·문구)는 QmSearching 이 맡고, 끝나면 onDone 으로 결과 화면에 넘긴다
    // 새로 찾으면 처음부터(상세에서 돌아와 되살린 카드 자리는 버린다). ⚠ [step] 효과로 지우면 되살리기 직후 첫 화면 효과가 0 으로 덮었다
    setRerolled(false); setSelected(new Set()); setPoolReady(false); setRestoreIndex(0);
    loadPros((gender || 'any') as any);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // 첫 화면 = 지정 사회자 전원, 리롤 = 나머지 5명(지정 명단을 못 받았으면 나머지 5명씩)
  const hasFeatured = pool.featured.length > 0;
  const displayed = useMemo(() => {
    if (!rerolled) return hasFeatured ? pool.featured : pool.rest.slice(0, 5);
    return hasFeatured ? pool.rest.slice(0, 5) : pool.rest.slice(5, 10);
  }, [pool, rerolled, hasFeatured]);
  const canReroll = !rerolled && (hasFeatured ? pool.rest.length > 0 : pool.rest.length > 5);
  // 지정 사회자에게 보내는 신청만 번호가 간다 → 리롤 뒤에 고른 사회자는 연락 방식을 묻지 않고 프리티풀 채팅으로
  const phoneShared = hasFeatured && !rerolled;
  // 몇 단계째인지 — 머리에 'N / 5' + 진행 막대(QUICK_PROGRESS). 결과·연락 방식·번호 화면은 표시 없이.
  const progressOf = (s: Step) => {
    const p = QUICK_PROGRESS[s];
    return p ? { at: p.at, total: QUICK_PROGRESS_TOTAL, from: p.from / QUICK_PROGRESS_TOTAL, to: p.to / QUICK_PROGRESS_TOTAL } : undefined;
  };

  function toggle(id: string) { setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; }); }
  function reroll() { if (!canReroll) return; setRerolled(true); setSelected(new Set()); setRestoreIndex(0); }
  /** 전체선택 — 카드 줄이 첫 장부터 촤라락 넘기며 한 장씩 체크하고, 끝나면 다음 단계(QmProCarousel runAll) */
  function selectAllAndGo() {
    if (selectingAll) return;
    setSelectingAll(true);
    setSelected(new Set()); // 처음부터 하나씩 체크되는 게 보이도록 비운다
    if (loadErr || displayed.length === 0) { setSelectingAll(false); return; }
    setSelectAllRun(true);
  }
  /** 포트폴리오 → 그 사회자 상세로. 보던 결과(답·후보·고른 사람·보던 카드)를 적어 두고 간다 —
   *  후보는 섞어서 뽑아(shuffle) 다시 받으면 순서가 달라지니 받은 명단을 그대로(리롤에 쓰는 앞 10명까지) */
  function openPro(p: ProListItem, index: number) {
    try {
      sessionStorage.setItem(QM_RETURN_KEY, JSON.stringify({
        v: 1, ts: Date.now(), date, time, regionKey, venue, moods: [...moods], part, gender,
        pool: { featured: pool.featured, rest: pool.rest.slice(0, 10) }, rerolled, selected: [...selected], index,
      }));
    } catch {}
    router.push(`/pros/${p.id}`);
  }
  /** 고른 사회자로 다음 단계 — 번호가 가는 신청이면 연락 방식, 아니면 프리티풀 채팅으로 번호 입력 */
  function goAfterSelect() {
    if (phoneShared) { setStep('contact'); return; }
    setContact('프리티풀 채팅');
    setStep('phone');
  }

  async function submit() {
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 10 || selected.size === 0 || !contact) return;
    // 서버는 Authorization 토큰으로만 테스트 계정을 알아본다 — 토큰 없이 보내면 비로그인(번호) 경로라 실제 사회자에게 간다.
    // 테스트 계정인데 토큰이 없거나, 이 탭에서 신청 중에 테스트 계정 로그인이 풀렸으면 보내지 않는다.
    const before = useAuthStore.getState();
    const testHint = isTestLeadSubmission(before.user?.name, before.user?.id);
    if ((testHint && !before.accessToken) || (!before.accessToken && ssFlag(QM_TEST_LOCK_KEY))) {
      window.alert('테스트 계정 로그인이 풀려 있어요.\n지금 신청하면 실제 사회자에게 가요. 다시 로그인한 뒤 신청해 주세요.');
      return;
    }
    setSubmitting(true);
    const ssGet = (k: string) => { try { return sessionStorage.getItem(k) || ''; } catch { return ''; } };
    const utm = {
      utm_source: ssGet('utm_source'), utm_medium: ssGet('utm_medium'), utm_campaign: ssGet('utm_campaign'),
      utm_term: ssGet('utm_term'), utm_content: ssGet('utm_content'), referrer: ssGet('referrer'),
      landing_url: ssGet('landing_url') || window.location.href,
    };
    const region = [group?.label, venue.trim()].filter(Boolean).join(' ');
    const payload = { phone: digits, categoryId: '결혼식사회자', type: 'single' as const, selectedProProfileIds: [...selected], eventDate: date || undefined, eventTime: time || undefined, eventLocation: region || undefined, rawUserInput: { source: 'landing_quick_match', eventDate: date, eventTime: time, region: group?.label, venue: venue.trim(), mood: [...moods].join(', '), part, genderPref: gender, contactMethod: contact, phone: digits, selectedCount: selected.size, quickBatch: phoneShared ? 'featured' : 'reroll', ...utm } };
    try {
      let res: any;
      try {
        res = await matchApi.quickRequest(payload);
      } catch (e: any) {
        // 토큰이 만료돼 서버가 401 → 인터셉터가 새 토큰을 못 받아 로그아웃된 경우
        const sessionLost = !!before.accessToken && !useAuthStore.getState().accessToken;
        if (!sessionLost) throw e;
        if (testHint) {
          // 테스트 계정 — 다시 보내면 비로그인 경로로 실제 사회자에게 간다. 다시 로그인할 때까지 이 탭에서 막는다
          ssFlag(QM_TEST_LOCK_KEY, true);
          window.alert('테스트 계정 로그인이 만료됐어요. 신청은 보내지 않았어요.\n다시 로그인한 뒤 신청해 주세요.');
          return;
        }
        // 실제 고객 — 로그인이 풀렸어도 신청은 받는다(예전처럼 번호로). 이제 토큰이 없으니 헤더 없이 간다
        res = await matchApi.quickRequest(payload);
      }
      if (useAuthStore.getState().accessToken) ssFlag(QM_TEST_LOCK_KEY, false);
      // 사회자에게 보냈는지는 서버 판정이 진실 — createMatchRequest 가 테스트 의뢰에만 suppressedAsTestLead 를 남겨 돌려준다
      const suppressed = res?.matchRequest?.rawUserInput?.suppressedAsTestLead === true;
      setDoneSuppressed(suppressed);
      // 점검용 신청은 광고 전환으로 세지 않는다 — 메타 학습·어드민 전환 퍼널이 가짜 전환으로 오염된다(wedding-mc 와 같은 규칙).
      // 서버가 테스트로 받았거나, 보낸 사람이 테스트 계정이면(API 배포 전이라 서버가 아직 모르는 경우 포함) 건너뛴다
      if (!suppressed && !testHint) {
        const fbq = (window as any).fbq;
        // Lead 는 'track'(init 된 픽셀 전부) — 사이트 픽셀(루트 GTM)은 예전부터 퀵매칭 Lead 를 받아 왔고, 이 랜딩 픽셀에도 함께 간다
        if (typeof fbq === 'function') fbq('track', 'Lead', { content_name: 'Quick Match Request', content_category: 'quick-match', currency: 'KRW' });
        // 페이지별 유입 분석 — 이 세션의 퀵매칭 방문을 '견적 요청'으로(261005)
        trackLandingConversion('quick-match');
      }
      // 구글 시트(wedding-mc 와 같은 Apps Script) — 한 신청 = 한 행, fire-and-forget(261008 사장 'wedding-mc 의 구글시트 퀵매칭에도').
      // 스크립트는 고정 순서 칸에 name·phone·q1·weddingDate·region·benefits(배열)·couponCode·source·utm…만 쓴다 →
      // 퀵매칭 답(분위기·몇 부·성별·연락 방식·고른 사회자)은 wedding-mc 의 '희망등급:' 처럼 접두어를 붙여 benefits 칸에 함께 남긴다
      // (스크립트가 benefits 를 ', ' 로 이으므로 한 항목 안의 여러 값은 '/' 로 잇는다).
      // formType 은 corporate-mc 가 아니므로 '랜딩_결혼' 시트로 간다. 서버가 테스트로 받은 신청도 시트 연결 확인용으로 남기되 이름·출처에 [테스트] 표시.
      const proName = new Map([...pool.featured, ...pool.rest].map((p) => [p.id, p.name] as const));
      const pickedNames = [...selected].map((id) => proName.get(id)).filter(Boolean).join('/');
      const genderLabel = gender === 'male' ? '남성' : gender === 'female' ? '여성' : gender === 'any' ? '상관없음' : '';
      const who = (useAuthStore.getState().user?.name || before.user?.name || '').trim() || `고객${digits.slice(-4)}`;
      fetch(QUICK_SHEET_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          formType: 'quick-match',
          name: suppressed ? `[테스트] ${who}` : who,
          phone: sheetPhone(digits),
          q1: phoneShared ? '퀵매칭(지정 사회자)' : '퀵매칭(다른 사회자 보기)',
          weddingDate: [date, time].filter(Boolean).join(' '),
          region,
          benefits: [
            moods.size ? `분위기: ${[...moods].join('/')}` : '',
            part ? `진행: ${part}` : '',
            genderLabel ? `성별: ${genderLabel}` : '',
            contact ? `연락: ${contact}` : '',
            `사회자 ${selected.size}명${pickedNames ? `: ${pickedNames}` : ''}`,
          ].filter(Boolean),
          source: suppressed ? 'quick-match-test' : 'quick-match',
          ...utm,
          // 시트 뒤쪽에 칸을 더하면 바로 찍히도록 미리 보내는 값(261009 — 지금 Apps Script 는 안 읽는다, 칸 추가는 사장이 스크립트에서)
          eventTime: time,
          venue: venue.trim(),
          mood: [...moods].join('/'),
          eventPart: part,
          genderPref: genderLabel,
          contactMethod: contact,
          selectedPros: pickedNames,
          selectedCount: selected.size,
          phoneShared: phoneShared ? 'Y' : 'N',
          matchRequestId: res?.matchRequest?.id || '',
          isTest: suppressed ? 'Y' : 'N',
        }),
      }).catch(() => undefined);
      window.dispatchEvent(new Event('freetiful:match-requests-changed'));
      setStep('done');
    } catch (e: any) { window.alert(`신청에 실패했어요. 잠시 후 다시 시도해 주세요. ${e?.response?.data?.message || ''}`); }
    finally { setSubmitting(false); }
  }

  const phoneDigits = phone.replace(/\D/g, '');

  return (
    <div className="qm-root">
      {/* ⚠ <style>{CSS}</style> 로 두면 서버가 ' > 를 &#x27; &gt; 로 바꿔 내보내(스타일 태그 안은 안 풀림) 글꼴·자식 선택자가 깨지고,
          클라와 글자가 달라 hydration 이 매번 실패해 문서 전체를 다시 그렸다(운영 React #425) */}
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <MetaPixel />

      {step === 'date' && (
        <div className="qm-page" key="date">
          <Header onBack={() => { try { history.back(); } catch {} }} progress={progressOf('date')} />
          <main className="qm-main">
            <h1 className="qm-h1 qm-a-title">예식 일시가<br />언제인가요?</h1>
            <p className="qm-sub qm-a-sub">날짜와 시간에 맞춰 가능한 사회자만 찾아드려요.</p>
            {/* 날짜·시간 = 한 장짜리 시트(QmDateTimeSheet, 토스 '가는 날' 화면 그대로 화이트) — 두 칸 다 같은 시트를 연다 */}
            <button type="button" className="qm-datefield qm-fieldbtn qm-a-item" style={stag(0)} aria-haspopup="dialog" onClick={() => setDtOpen(true)}>
              <Ic name="calendar" size={22} color={date ? '#3182F6' : '#8B95A1'} />
              <span className={date ? 'val' : 'ph'}>{date ? formatKDate(date) : '예식일을 선택해주세요'}</span>
            </button>
            <button type="button" className="qm-datefield qm-fieldbtn qm-a-item" style={stag(1)} aria-haspopup="dialog" onClick={() => setDtOpen(true)}>
              <Ic name="clock" size={22} color={time ? '#3182F6' : '#8B95A1'} />
              <span className={time ? 'val' : 'ph'}>{time ? formatKTime(time) : '예식 시간을 선택해주세요'}</span>
            </button>
          </main>
          {/* 예식 시간도 필수(260927 사장) */}
          <Cta disabled={!date || !time} onClick={() => { fireStart(); setStep('region'); }}>다음</Cta>
          {dtOpen && (
            <QmDateTimeSheet
              date={date}
              time={time}
              onClose={(d, t) => { if (d) setDate(d); if (t) setTime(t); setDtOpen(false); }}
              onNext={(d, t) => { setDate(d); setTime(t); setDtOpen(false); fireStart(); setStep('region'); }}
            />
          )}
        </div>
      )}

      {step === 'region' && (
        <div className="qm-page" key="region">
          <Header onBack={() => back('date')} progress={progressOf('region')} />
          <main className="qm-main">
            <h1 className="qm-h1 qm-a-title">예식장은<br />어느 권역인가요?</h1>
            <p className="qm-sub qm-a-sub">가까운 지역의 사회자를 우선 추천해드려요.</p>
            <div className="qm-list">
              {REGION_GROUPS.map((g, i) => (
                <button key={g.key} type="button" className={`qm-opt qm-a-item ${regionKey === g.key ? 'on' : ''}`} style={stag(i)}
                  onClick={() => { setRegionKey(g.key); advance('venue'); }}>
                  <span className="qm-opt-t">{g.label}</span>
                  <span className="qm-chk-line">{regionKey === g.key && <Ic name="check" size={20} color="#3182F6" />}</span>
                </button>
              ))}
            </div>
          </main>
        </div>
      )}

      {step === 'venue' && (
        <div className="qm-page" key="venue">
          <Header onBack={() => back('region')} progress={progressOf('venue')} />
          <main className="qm-main">
            <h1 className="qm-h1 qm-a-title">예식장 이름을<br />알려주세요</h1>
            <p className="qm-sub qm-a-sub">예식장을 알면 더 잘 맞는 사회자를 찾아드려요.</p>
            <input className="qm-textinput qm-a-item" style={stag(0)} type="text" value={venue} onChange={(e) => setVenue(e.target.value)} placeholder="예: 빌라드지디 청담" enterKeyHint="next"
              onKeyDown={(e) => { if (e.key === 'Enter' && venue.trim()) setStep('mood'); }} />
          </main>
          {/* 예식장(웨딩홀) 이름 필수(260927 사장) — 예전 '건너뛰기' 없앰 */}
          <Cta disabled={!venue.trim()} onClick={() => setStep('mood')}>다음</Cta>
        </div>
      )}

      {step === 'mood' && (
        <div className="qm-page" key="mood">
          <Header onBack={() => back('venue')} progress={progressOf('mood')} />
          <main className="qm-main">
            <h1 className="qm-h1 qm-a-title">어떤 분위기의<br />예식을 원하세요?</h1>
            <p className="qm-sub qm-a-sub">원하는 분위기를 모두 선택하세요. 여러 개 선택할 수 있어요.</p>
            <div className="qm-list">
              {MOOD_OPTIONS.map((m, i) => {
                const on = moods.has(m.label);
                return (
                  <button key={m.label} type="button" className={`qm-opt icon sub qm-a-item ${on ? 'on' : ''}`} style={stag(i)}
                    onClick={() => setMoods((prev) => { const n = new Set(prev); n.has(m.label) ? n.delete(m.label) : n.add(m.label); return n; })}>
                    <span className={`qm-opt-ic ${on ? 'on' : ''}`}><Ic name={m.icon} size={22} color={on ? '#3182F6' : '#6B7684'} /></span>
                    <span className="qm-opt-tt"><span className="qm-opt-t">{m.label}</span><span className="qm-opt-hint">{m.desc}</span></span>
                    <span className={`qm-chk ${on ? 'on' : ''}`}>{on && <Ic name="check" size={16} color="#fff" />}</span>
                  </button>
                );
              })}
            </div>
          </main>
          <Cta disabled={moods.size === 0} onClick={() => setStep('part')}>{moods.size > 0 ? `${moods.size}개 선택 · 다음` : '다음'}</Cta>
        </div>
      )}

      {step === 'part' && (
        <div className="qm-page" key="part">
          <Header onBack={() => back('mood')} progress={progressOf('part')} />
          <main className="qm-main">
            <h1 className="qm-h1 qm-a-title">몇 부 진행이<br />필요하세요?</h1>
            <p className="qm-sub qm-a-sub">1부(본식)·2부(피로연) 중 필요한 진행을 알려주세요.</p>
            <div className="qm-list">
              {PART_OPTIONS.map((p, i) => {
                const on = part === p.label;
                return (
                  <div className="qm-optwrap qm-a-item" style={stag(i)} key={p.label}>
                    <button type="button" className={`qm-opt ${on ? 'on' : ''}`} onClick={() => setPart(p.label)}>
                      <span className="qm-opt-t">{p.label}</span>
                      <span className="qm-chk-line">{on && <Ic name="check" size={20} color="#3182F6" />}</span>
                    </button>
                    {on && p.note && <NoteCard note={p.note} />}
                  </div>
                );
              })}
            </div>
          </main>
          <Cta disabled={!part} onClick={() => setStep('gender')}>다음</Cta>
        </div>
      )}

      {step === 'gender' && (
        <div className="qm-page" key="gender">
          <Header onBack={() => back('part')} progress={progressOf('gender')} />
          <main className="qm-main">
            <h1 className="qm-h1 qm-a-title">선호하는<br />사회자 성별이 있나요?</h1>
            <p className="qm-sub qm-a-sub">원하시는 성별의 사회자를 우선 보여드려요.</p>
            <div className="qm-list">
              {GENDERS.map((g, i) => (
                <button key={g.k} type="button" className={`qm-opt qm-a-item ${gender === g.k ? 'on' : ''}`} style={stag(i)}
                  onClick={() => { setGender(g.k); advance('searching'); }}>
                  <span className="qm-opt-t">{g.label}</span>
                  <span className="qm-chk-line">{gender === g.k && <Ic name="check" size={20} color="#3182F6" />}</span>
                </button>
              ))}
            </div>
          </main>
        </div>
      )}

      {step === 'searching' && (
        <QmSearching pool={pool} ready={poolReady} failed={loadErr} onDone={() => setStep('results')} onBack={() => back('gender')} />
      )}

      {step === 'results' && (
        <div className="qm-page" key="results">
          {/* 다른 사회자 보기(리롤)는 머리 오른쪽, 'N명 선택됨' 줄은 없앰(261002 사장) — 고른 수는 아래 버튼('N명 선택 완료')이 말한다 */}
          <Header onBack={() => back('gender')} progress={progressOf('results')}
            right={<button type="button" className="qm-hreroll" onClick={reroll} disabled={!canReroll || selectingAll}><Ic name="refresh" size={15} color="currentColor" />{rerolled ? '다시 찾기 완료' : '다른 사회자 보기'}</button>} />
          <main className="qm-main tight">
            <h1 className="qm-h1 qm-a-title">조건에 가장 잘 맞는<br />사회자 <b className="blue">{displayed.length || 5}명</b>을 찾았어요</h1>
            <p className="qm-sub qm-a-sub">옆으로 넘겨 보고, 의뢰할 사회자를 눌러 선택하세요. 여러 명 선택할 수 있어요.</p>
            {loadErr ? (
              <div className="qm-err">사회자를 불러오지 못했어요.<br /><button type="button" onClick={() => setStep('searching')}>다시 시도</button></div>
            ) : (
              /* 다른 사회자 보기 = 카드 줄을 새로 띄운다(key) — 처음 뜰 때처럼 옆에서 스르르 들어온다(261002 사장).
                 제목은 그대로라 기다리지 않고 바로(0.08초) */
              <QmProCarousel key={rerolled ? 'reroll' : 'first'} pros={displayed} selected={selected} onToggle={toggle}
                enterDelay={rerolled ? 0.08 : undefined}
                initialIndex={restoreIndex} onOpenPro={openPro}
                runAll={selectAllRun}
                onSelectOne={(id) => setSelected((prev) => new Set(prev).add(id))}
                onRunAllDone={() => { setSelectAllRun(false); goAfterSelect(); }} />
            )}
          </main>
          <div className="qm-ctawrap qm-btnrow">
            <button type="button" className="qm-cta ghost" onClick={() => back('gender')} disabled={selectingAll}>이전으로</button>
            {/* 몇 명을 골랐으면 그 사람들에게만('N명 선택 완료'), 안 골랐으면 전체선택(260927 사장 — 골라도 전체선택만 돼 있던 것) */}
            <button type="button" className="qm-cta" onClick={selected.size > 0 ? goAfterSelect : selectAllAndGo} disabled={selectingAll}>
              {selectingAll ? '선택 중…' : selected.size > 0 ? `${selected.size}명 선택 완료` : '전체선택'}
            </button>
          </div>
        </div>
      )}

      {step === 'contact' && (
        <div className="qm-page" key="contact">
          <Header onBack={() => back('results')} progress={progressOf('contact')} />
          <main className="qm-main">
            <h1 className="qm-h1 qm-a-title">어떤 방식으로<br />연락받으시겠어요?</h1>
            <p className="qm-sub qm-a-sub">선택한 {selected.size}명의 사회자가 이 방법으로 연락드려요.</p>
            <div className="qm-list">
              {CONTACTS.map((c, i) => {
                const on = contact === c.k;
                return (
                  <button key={c.k} type="button" className={`qm-opt icon sub qm-a-item ${on ? 'on' : ''}`} style={stag(i)} onClick={() => { setContact(c.k); advance('phone'); }}>
                    <span className={`qm-opt-ic ${on ? 'on' : ''}`}><Ic name={c.icon} size={22} color={on ? '#3182F6' : '#6B7684'} /></span>
                    <span className="qm-opt-tt"><span className="qm-opt-t">{c.label}</span><span className="qm-opt-hint">{c.hint}</span></span>
                    <span className="qm-chk-line">{on && <Ic name="check" size={20} color="#3182F6" />}</span>
                  </button>
                );
              })}
            </div>
          </main>
        </div>
      )}

      {step === 'phone' && (
        <div className="qm-page" key="phone">
          <Header onBack={() => back(phoneShared ? 'contact' : 'results')} progress={progressOf('phone')} />
          <main className="qm-main">
            <h1 className="qm-h1 qm-a-title">연락받을 번호를<br />입력해주세요</h1>
            <p className="qm-sub qm-a-sub">{contact}(으)로 연락드려요. 매칭된 사회자 연결에만 사용돼요.</p>
            {/* 점검용 테스트 계정 — 신청 버튼 누르기 전에 '사회자에게 안 간다'를 보이게(261008 사장 '고객 입장 흐름만 확인') */}
            {/* 토큰이 없으면 서버는 테스트 계정을 못 알아본다 → 알약 대신 '다시 로그인' 안내(신청도 submit 에서 막는다) */}
            {isTest && (accessToken
              ? <div className="qm-testpill qm-a-sub" role="status">테스트 계정이라 신청해도 사회자에게는 가지 않아요</div>
              : <div className="qm-testpill qm-a-sub" role="status">테스트 계정 로그인이 풀려 있어요 · 다시 로그인해야 신청할 수 있어요</div>)}
            <div className={`qm-bignum qm-a-item ${phoneDigits ? 'on' : ''}`} style={stag(0)}>
              <span className="qm-bignum-t">
                {phone ? <b>{phone}</b> : <i>010-0000-0000</i>}
                <em className="qm-caret" />
              </span>
            </div>
          </main>
          <div className="qm-phone-bottom">
            <div className="qm-cta-pad">
              <button type="button" className="qm-cta" disabled={phoneDigits.length < 10 || submitting} onClick={submit}>{submitting ? '신청 중…' : '매칭 신청하기'}</button>
            </div>
            <div className="qm-keypad">
              {KEYS.map((k, i) => (
                <button type="button" key={i} className={`qm-key ${k === '' ? 'empty' : ''}`} disabled={k === ''} onClick={() => k && press(k)}>
                  {k === 'back' ? <Ic name="backspace" size={26} color="#191F28" /> : k}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {step === 'done' && (
        <div className="qm-page" key="done">
          {/* 완료 뒤엔 신청 단계로 되돌아가지 않는다 — 뒤로·아래 버튼 모두 매칭 탭(일반 회원) 또는 홈으로(261005) */}
          <Header onBack={leaveDone} />
          <div className="qm-done-body">
            <span className="qm-done-ic"><Ic name="check" size={40} color="#fff" /></span>
            <h2 className="qm-h2 center">매칭 신청이<br />완료되었어요</h2>
            {doneSuppressed
              ? <p className="qm-done-sub">테스트 신청이라 <b className="blue">사회자에게는 전달하지 않았어요.</b><br />실제 고객이라면 선택한 {selected.size}명에게 전달돼요.</p>
              : <p className="qm-done-sub">선택하신 <b className="blue">{selected.size}명</b>의 사회자에게 신청이 전달됐어요.<br />{contact}(으)로 곧 연락드릴게요.</p>}
            <div className="qm-summary">
              <div><span>예식 일시</span><b>{[date ? formatKDate(date) : '', formatKTime(time)].filter(Boolean).join(' ') || '-'}</b></div>
              <div><span>지역</span><b>{[group?.label, venue.trim()].filter(Boolean).join(' ') || '-'}</b></div>
              <div><span>분위기</span><b>{[...moods].join(', ') || '-'}</b></div>
              <div><span>연락방식</span><b>{contact}</b></div>
            </div>
          </div>
          <Cta onClick={leaveDone}>{doneDest === '/inquiries' ? '매칭 현황 보기' : '홈으로'}</Cta>
        </div>
      )}
    </div>
  );
}

/** 머리 — 뒤로 + 몇 단계째인지(진행 막대 + 'N / 전체'). 막대는 앞 단계 길이에서 이번 단계 길이로 늘어난다 */
/**
 * 진행 단계(260928 사장 '1/9 → 1/5 — 1~5 끝나면 매칭 화면이라 그다음은 번호 없어도 됨'): 성별까지 다섯 단계.
 * 예식 장소는 권역 → 예식장 이름 두 화면을 한 단계로 센다(번호는 2 그대로, 막대만 반 칸씩 찬다) → 5/5(성별) 다음이 바로 매칭.
 */
const QUICK_PROGRESS_TOTAL = 5;
const QUICK_PROGRESS: Partial<Record<Step, { at: number; from: number; to: number }>> = {
  date: { at: 1, from: 0, to: 1 },
  region: { at: 2, from: 1, to: 1.5 },
  venue: { at: 2, from: 1.5, to: 2 },
  mood: { at: 3, from: 2, to: 3 },
  part: { at: 4, from: 3, to: 4 },
  gender: { at: 5, from: 4, to: 5 },
};

function Header({ onBack, progress, right }: { onBack: () => void; progress?: { at: number; total: number; from: number; to: number }; right?: React.ReactNode }) {
  return (
    <header className="qm-header">
      <button type="button" onClick={onBack} aria-label="뒤로"><Ic name="back" size={26} color="#191F28" /></button>
      {progress && (
        <div className="qm-progress" role="progressbar" aria-valuemin={1} aria-valuemax={progress.total} aria-valuenow={progress.at} aria-label={`전체 ${progress.total}단계 중 ${progress.at}단계`}>
          <span className="qm-progress-track">
            <span
              className="qm-progress-fill"
              style={{ '--from': `${progress.from * 100}%`, '--to': `${progress.to * 100}%` } as React.CSSProperties}
            />
          </span>
          <span className="qm-progress-t"><b>{progress.at}</b> / {progress.total}</span>
        </div>
      )}
      {right && <div className="qm-header-right">{right}</div>}
    </header>
  );
}
function Cta({ disabled, onClick, children }: { disabled?: boolean; onClick: () => void; children: React.ReactNode }) {
  return <div className="qm-ctawrap"><button type="button" className="qm-cta" disabled={disabled} onClick={onClick}>{children}</button></div>;
}

const CSS = `
.qm-root{--blue:#3182F6;--blue-press:#2272EB;--blue-bg:#EDF4FF;--t-strong:#191F28;--t:#333D4B;--t-sub:#4E5968;--t-weak:#6B7684;--t-ph:#8B95A1;--t-dis:#B0B8C1;--border:#E5E8EB;--divider:#F2F4F6;--bg-gray:#F2F4F6;
 font-family:'Pretendard Variable',Pretendard,-apple-system,BlinkMacSystemFont,system-ui,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;
 -webkit-font-smoothing:antialiased;background:#fff;color:var(--t-strong);min-height:100dvh;max-width:520px;margin:0 auto;}
.qm-ic{display:inline-block;background-color:currentColor;-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;-webkit-mask-position:center;mask-position:center;-webkit-mask-size:contain;mask-size:contain;flex:none;}
.qm-root b,.qm-root strong{font-weight:600;}
.qm-page{display:flex;flex-direction:column;min-height:100dvh;}
.qm-page.center{align-items:center;justify-content:center;text-align:center;padding:0 32px;animation:qm-pagefade .32s ease both;}
.qm-done-body{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:0 32px 24px;animation:qm-pagefade .32s ease both;}
@keyframes qm-fadeup{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
@keyframes qm-slidein{from{opacity:0;transform:translateX(22px)}to{opacity:1;transform:translateX(0)}}
@keyframes qm-pagefade{from{opacity:0}to{opacity:1}}
.qm-a-title{animation:qm-fadeup .5s cubic-bezier(.22,.61,.36,1) both;}
.qm-a-sub{animation:qm-fadeup .5s cubic-bezier(.22,.61,.36,1) .18s both;}
.qm-a-item{animation:qm-slidein .46s cubic-bezier(.22,.61,.36,1) both;}
.qm-header{height:56px;display:flex;align-items:center;padding:0 8px;flex:none;}
.qm-header button{width:40px;height:40px;display:flex;align-items:center;justify-content:center;border:0;background:none;border-radius:20px;cursor:pointer;}
.qm-header button:active{background:var(--divider);}
.qm-progress{flex:1;display:flex;align-items:center;gap:12px;padding:0 20px 0 6px;}
.qm-progress-track{flex:1;height:4px;border-radius:2px;background:var(--divider);overflow:hidden;}
.qm-progress-fill{display:block;height:100%;width:var(--to);border-radius:2px;background:var(--blue);animation:qm-progress .5s cubic-bezier(.22,.61,.36,1) both;}
@keyframes qm-progress{from{width:var(--from)}to{width:var(--to)}}
.qm-progress-t{flex:none;font-size:13px;font-weight:500;color:var(--t-ph);font-variant-numeric:tabular-nums;letter-spacing:.2px;}
.qm-progress-t b{color:var(--blue);font-weight:600;}
.qm-main{flex:1;padding:8px 24px 24px;}
.qm-main.tight{padding:8px 16px 24px;}
.qm-h1{font-size:24px;font-weight:600;line-height:1.4;letter-spacing:-.4px;color:var(--t-strong);margin:0;}
.qm-h1 .blue{color:var(--blue);}
.qm-h2{font-size:21px;font-weight:600;line-height:1.42;letter-spacing:-.4px;color:var(--t-strong);margin:0;}
.qm-h2.center{margin-top:26px;}
.qm-sub{font-size:15px;color:var(--t-ph);margin:10px 0 0;line-height:1.5;}
.qm-datefield{position:relative;display:flex;align-items:center;gap:12px;height:60px;margin-top:16px;padding:0 18px;border:1.5px solid var(--border);border-radius:16px;background:#fff;}
.qm-datefield:first-of-type{margin-top:28px;}
.qm-datefield:focus-within{border-color:var(--blue);}
.qm-datefield .ph{color:var(--t-ph);font-size:16px;}
.qm-datefield .val{color:var(--t-strong);font-size:16px;font-weight:600;}
.qm-datefield input{position:absolute;inset:0;opacity:0;width:100%;height:100%;border:0;background:none;cursor:pointer;}
/* 시간 칸 = 버튼(다이얼 시트 열기). first-of-type 이 버튼에도 걸려 위 여백이 28 이 되던 것 → 16 고정 */
/* 날짜·시간 칸 = 버튼(시트 열기) — 첫 칸 위 여백은 .qm-datefield:first-of-type(28) 그대로 */
.qm-fieldbtn{width:100%;font-family:inherit;text-align:left;color:inherit;cursor:pointer;-webkit-tap-highlight-color:transparent;}
/* 예식 일시 시트(QmDateTimeSheet) — 토스 '가는 날' 화면 화이트판. 모양은 앱 공통 .ft-*, 닫힐 때도 스르르(뚝 금지).
   고른 칸 = 연한 파랑 바탕 + 파란 글자(261002 사장 '포커스는 연한 파랑, 폰트에 파랑'), 꽉 찬 파랑은 아래 버튼에만 */
.ft-scrim.qm-sheet-scrim.out{animation:qm-scrim-out .24s ease forwards;}
.ft-scrim.qm-sheet-scrim.out .ft-sheet{animation:qm-sheet-down .24s cubic-bezier(.4,0,1,1) forwards;}
@keyframes qm-scrim-out{to{opacity:0}}
@keyframes qm-sheet-down{from{transform:translateY(0)}to{transform:translateY(100%)}}
@media (min-width:640px){.ft-scrim.qm-sheet-scrim.out .ft-sheet{animation:qm-sheet-popout .2s ease forwards;}}
@keyframes qm-sheet-popout{to{opacity:0;transform:translateY(12px) scale(.98)}}
.qm-dtsheet .ft-title{font-size:22px;}
.qm-cal-head{display:flex;align-items:center;justify-content:space-between;margin-top:20px;}
.qm-cal-head b{font-size:19px;font-weight:600;color:#191F28;letter-spacing:-.3px;}
.qm-cal-nav{display:flex;gap:4px;margin-right:-10px;}
.qm-cal-nav button{width:40px;height:40px;display:flex;align-items:center;justify-content:center;padding:0;border:0;border-radius:12px;background:none;color:#4E5968;cursor:pointer;-webkit-tap-highlight-color:transparent;transition:background-color .15s;}
.qm-cal-nav button:active:not(:disabled){background:#F2F4F6;}
.qm-cal-nav button:disabled{color:#D1D6DB;cursor:default;}
.qm-cal-week{display:grid;grid-template-columns:repeat(7,1fr);margin-top:14px;text-align:center;font-size:13px;font-weight:500;color:#8B95A1;}
.qm-cal-grid{margin-top:4px;}
.qm-cal-row{display:grid;grid-template-columns:repeat(7,1fr);height:46px;align-items:center;justify-items:center;animation:qm-rise .44s cubic-bezier(.22,.61,.36,1) both;}
.qm-cal-day{width:44px;height:42px;padding:0;border:0;border-radius:14px;background:transparent;font-family:inherit;font-size:19px;font-weight:500;color:#333D4B;letter-spacing:-.2px;cursor:pointer;-webkit-tap-highlight-color:transparent;transition:background-color .2s,color .2s,transform .12s;}
.qm-cal-day:active:not(:disabled){transform:scale(.93);}
.qm-cal-day:disabled{color:#D1D6DB;cursor:default;}
.qm-cal-day.on{background:#E8F3FF;color:#3182F6;font-weight:700;}
.qm-tlabel{margin:16px 0 0;font-size:18px;font-weight:600;color:#4E5968;letter-spacing:-.3px;}
.qm-tlabel strong{color:#191F28;font-weight:700;}
.qm-tchips{position:relative;display:flex;gap:8px;margin:12px -24px 0;padding:0 24px;overflow-x:auto;scrollbar-width:none;overscroll-behavior-x:contain;}
.qm-tchips::-webkit-scrollbar{display:none;}
.qm-tchips.min{margin:8px 0 0;padding:0;overflow:visible;}
/* 시·분 칩 = 같은 너비(261002 사장 '시간 피커 너비만큼 분 피커도 동일하게') — 보이는 폭(내용 칸)을 6칸으로 나눈 값.
   그래서 시 줄이 09시부터 놓이면 09~14시가 00~50분 바로 위에 칸 맞춰 선다(시 줄은 옆으로 넘김, 분 줄은 꽉 참) */
.qm-tchip{flex:0 0 calc((100% - 40px) / 6);min-width:0;height:40px;padding:0;border:0;border-radius:12px;background:#F2F4F6;font-family:inherit;font-size:16px;font-weight:600;color:#6B7684;letter-spacing:-.2px;cursor:pointer;-webkit-tap-highlight-color:transparent;transition:background-color .2s,color .2s,transform .12s;}
.qm-tchip:active:not(:disabled){transform:scale(.95);}
.qm-tchip:disabled{background:#F9FAFB;color:#D1D6DB;cursor:default;}
.qm-tchip.on{background:#E8F3FF;color:#3182F6;font-weight:700;}
/* 달력 줄·밑 줄 — 아래에서 위로 한 줄씩(지연은 줄마다 inline) */
.qm-rise{animation:qm-rise .44s cubic-bezier(.22,.61,.36,1) both;}
@keyframes qm-rise{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){.qm-cal-row,.qm-rise{animation:none;}}
.qm-list{margin-top:26px;display:flex;flex-direction:column;gap:10px;}
.qm-optwrap{display:block;}
.qm-opt{display:flex;align-items:center;gap:14px;width:100%;min-height:60px;padding:0 18px;border:1.5px solid var(--border);border-radius:16px;background:#fff;cursor:pointer;transition:border-color .15s,background .15s;text-align:left;}
.qm-opt:active{background:#F8F9FA;}
.qm-opt.on{border-color:var(--blue);background:var(--blue-bg);}
.qm-opt.icon,.qm-opt.sub{padding:14px 18px;}
.qm-opt-ic{width:44px;height:44px;flex:none;display:flex;align-items:center;justify-content:center;border-radius:12px;background:var(--divider);}
.qm-opt-ic.on{background:#DCEBFF;}
.qm-opt-t{flex:1;font-size:17px;font-weight:600;color:var(--t);}
.qm-opt.on .qm-opt-t{color:var(--blue);}
.qm-opt-tt{flex:1;display:flex;flex-direction:column;gap:3px;}
.qm-opt-hint{font-size:13px;font-weight:400;color:var(--t-ph);}
.qm-chk-line{width:24px;height:24px;flex:none;display:flex;align-items:center;justify-content:center;}
.qm-note{margin:8px 2px 0;padding:16px 18px;background:var(--divider);border-radius:14px;animation:qm-note-in .28s ease both;}
.qm-note b{display:block;font-size:15px;color:var(--t-strong);}
.qm-note p{margin:8px 0 0;font-size:14px;line-height:1.55;color:var(--t-sub);}
.qm-note ol{margin:12px 0 0;padding:0;list-style:none;display:flex;flex-direction:column;gap:7px;}
.qm-note li{display:flex;gap:6px;font-size:14px;line-height:1.5;color:var(--t-sub);}
.qm-note li span{flex:none;color:var(--t-weak);}
@keyframes qm-note-in{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}}
.qm-textinput{margin-top:36px;width:100%;border:0;border-bottom:2px solid var(--border);background:none;font-family:inherit;font-size:22px;font-weight:600;color:var(--t-strong);padding:0 2px 12px;outline:none;}
.qm-textinput::placeholder{color:var(--t-dis);font-weight:600;}
.qm-textinput:focus{border-color:var(--blue);}
.qm-ctawrap{position:sticky;bottom:0;background:#fff;padding:10px 20px calc(env(safe-area-inset-bottom,0px) + 16px);flex:none;}
.qm-cta{width:100%;height:56px;border:0;border-radius:17px;background:var(--blue);color:#fff;font-size:17px;font-weight:600;cursor:pointer;transition:transform .05s,background .15s;font-family:inherit;}
.qm-cta:active:not(:disabled){transform:scale(.99);background:var(--blue-press);}
.qm-cta:disabled{background:var(--bg-gray);color:var(--t-dis);cursor:default;}
.qm-btnrow{display:flex;gap:10px;}
.qm-btnrow .qm-cta{flex:1;width:auto;}
.qm-btnrow .qm-cta.ghost{background:var(--divider);color:var(--t-sub);}
.qm-btnrow .qm-cta.ghost:active{transform:scale(.99);background:#E5E8EB;}
.qm-bignum{margin-top:44px;padding-bottom:16px;border-bottom:2px solid var(--border);transition:border-color .15s;}
.qm-bignum.on{border-color:var(--blue);}
.qm-bignum-t{display:flex;align-items:center;font-size:28px;font-weight:600;letter-spacing:.5px;line-height:1;}
.qm-bignum-t b{color:var(--t-strong);}
.qm-bignum-t i{color:var(--t-dis);font-style:normal;font-weight:600;}
.qm-caret{width:2px;height:28px;background:var(--blue);margin-left:2px;animation:qm-blink 1s step-end infinite;}
@keyframes qm-blink{50%{opacity:0}}
.qm-phone-bottom{margin-top:auto;flex:none;}
.qm-cta-pad{padding:0 20px 10px;}
.qm-keypad{display:grid;grid-template-columns:repeat(3,1fr);padding-bottom:calc(env(safe-area-inset-bottom,0px) + 6px);}
.qm-key{height:62px;display:flex;align-items:center;justify-content:center;border:0;background:none;font-size:26px;font-weight:500;color:var(--t-strong);cursor:pointer;font-family:inherit;transition:background .1s;border-radius:14px;margin:2px 6px;}
.qm-key:active:not(.empty){background:var(--divider);}
.qm-key.empty{pointer-events:none;}
.qm-s-main{padding:4px 24px 32px;}
.qm-s-titlebox{position:relative;min-height:62px;}
.qm-s-title{font-size:22px;font-weight:600;line-height:1.42;letter-spacing:-.4px;color:var(--t-strong);margin:0;}
.qm-s-title.in{animation:qm-s-tin .34s cubic-bezier(.22,.61,.36,1) .08s both;}
.qm-s-title.out{position:absolute;left:0;top:0;right:0;animation:qm-s-tout .16s ease both;}
@keyframes qm-s-tin{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:translateY(0)}}
@keyframes qm-s-tout{from{opacity:1}to{opacity:0}}
/* 링 — 연한 하늘 도넛 위로 위에서부터 시계 방향(꼬리 연함 → 머리 진함), 둥근 머리·꼬리 */
.qm-s-ringwrap{position:relative;width:178px;height:206px;margin:30px auto 0;}
.qm-s-ring{position:absolute;left:0;top:0;width:178px;height:178px;}
.qm-s-track,.qm-s-arc{position:absolute;inset:0;border-radius:50%;-webkit-mask:radial-gradient(closest-side,transparent calc(100% - 38px),#000 calc(100% - 37.4px));mask:radial-gradient(closest-side,transparent calc(100% - 38px),#000 calc(100% - 37.4px));}
.qm-s-track{background:#F4F7FE;}
.qm-s-arc{background:conic-gradient(from 0deg,transparent var(--tail),rgba(61,132,247,0) var(--tail),rgba(61,132,247,var(--a)) var(--head),transparent var(--head));}
/* 둥근 머리 — 바탕(링 색) 위에 머리와 같은 진하기로 */
.qm-s-cap{position:absolute;left:50%;top:0;width:38px;height:38px;margin-left:-19px;border-radius:50%;transform-origin:19px 89px;transform:rotate(var(--head));background:radial-gradient(closest-side,rgba(61,132,247,var(--a)) 99%,transparent 100%),#F4F7FE;}
.qm-s-num{position:absolute;left:0;top:0;width:178px;height:178px;display:flex;align-items:center;justify-content:center;gap:1px;padding-bottom:4px;}
.qm-s-num b{font-size:46px;font-weight:700;letter-spacing:-1.6px;color:var(--blue);font-variant-numeric:tabular-nums;line-height:1;}
.qm-s-num i{font-style:normal;font-size:21px;font-weight:600;color:#A6C8FA;margin-top:8px;}
.qm-s-ic{position:absolute;left:50%;top:143px;width:58px;height:58px;margin-left:-29px;object-fit:contain;z-index:1;filter:drop-shadow(0 4px 6px rgba(70,100,160,.18));}
.qm-s-icshadow{position:absolute;left:50%;top:192px;width:120px;height:14px;margin-left:-60px;border-radius:50%;background:radial-gradient(closest-side,rgba(120,150,210,.22),rgba(120,150,210,0));}
/* 탭 — 회색 바탕 두 칸, 흰 알약이 미끄러진다 */
.qm-s-tabs{position:relative;display:flex;height:46px;padding:4px;margin-top:22px;border-radius:14px;background:var(--bg-gray);}
.qm-s-pill{position:absolute;top:4px;bottom:4px;left:4px;width:calc(50% - 4px);border-radius:10px;background:#fff;box-shadow:0 1px 4px rgba(0,0,0,.08);transition:transform .32s cubic-bezier(.22,.61,.36,1);}
.qm-s-tab{position:relative;z-index:1;flex:1;border:0;background:none;font-family:inherit;font-size:15px;font-weight:600;color:var(--t-ph);cursor:pointer;transition:color .2s;}
.qm-s-tab.on{color:var(--t-strong);}
/* 목록 — 들어온 줄은 제자리에서 커지며 + 연한 파랑이 1초쯤 뒤 사라진다 */
.qm-s-list{position:relative;margin-top:10px;}
.qm-s-rows{position:relative;}
.qm-s-slot{position:absolute;left:0;right:0;top:0;transition:transform .38s cubic-bezier(.22,.61,.36,1);will-change:transform;}
.qm-s-row{position:relative;display:flex;align-items:center;gap:14px;height:70px;padding:0 12px;margin:0 -12px;border-radius:16px;}
.qm-s-row.new{animation:qm-s-rowin .42s cubic-bezier(.22,.61,.36,1) both,qm-s-hl 1.25s ease both;}
@keyframes qm-s-rowin{from{opacity:.25;transform:scale(.9)}to{opacity:1;transform:scale(1)}}
@keyframes qm-s-hl{0%,35%{background:#EAF2FE}100%{background:rgba(234,242,254,0)}}
.qm-s-ava{width:36px;height:36px;border-radius:50%;object-fit:cover;flex:none;background:var(--divider);}
.qm-s-txt{flex:1;min-width:0;display:flex;flex-direction:column;}
.qm-s-name{font-size:17px;font-weight:600;letter-spacing:-.3px;color:var(--t);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.qm-s-sub{margin-top:2px;font-size:13.5px;color:var(--t-ph);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.qm-s-sub.wait{color:var(--t-dis);}
.qm-s-val{flex:none;display:flex;flex-direction:column;align-items:flex-end;}
.qm-s-val b{font-size:17px;font-weight:600;color:var(--blue);letter-spacing:-.2px;}
.qm-s-val span{margin-top:2px;font-size:13.5px;color:var(--t-ph);}
.qm-s-row.skel .qm-s-ava,.qm-s-bar{background:linear-gradient(90deg,#F2F4F6 0%,#E9ECEF 50%,#F2F4F6 100%);background-size:200% 100%;animation:qm-s-shine 1.2s linear infinite;}
.qm-s-bar{display:block;height:13px;border-radius:7px;}
.qm-s-bar.w1{width:38%;}
.qm-s-bar.w2{width:58%;margin-top:8px;height:11px;}
@keyframes qm-s-shine{from{background-position:200% 0}to{background-position:0 0}}
@keyframes qm-s-fade{to{opacity:0}}
@media (prefers-reduced-motion:reduce){.qm-s-title.in,.qm-s-title.out,.qm-s-row.new{animation:none;}}
.qm-header-right{margin-left:auto;padding-right:12px;display:flex;align-items:center;}
.qm-header .qm-hreroll{width:auto;height:34px;display:flex;align-items:center;gap:5px;border:1px solid var(--border);background:#fff;color:var(--t-sub);font-size:13.5px;font-weight:600;padding:0 13px 0 11px;border-radius:999px;cursor:pointer;font-family:inherit;white-space:nowrap;}
.qm-header .qm-hreroll:active{background:var(--divider);}
.qm-header .qm-hreroll:disabled{opacity:.4;cursor:default;}
/* 사회자 카드 줄 — 상세 히어로와 같은 넘기기(왼쪽 정렬·peek·스냅·0.9배) */
.qm-cwrap{margin:2px -16px 0;}
.qm-carousel{position:relative;display:flex;gap:12px;overflow:hidden;padding:14px 18px 20px;touch-action:pan-y;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none;}
/* 끄는 동안엔 카드 누름 축소(card-press)를 끈다 — 손가락이 닿아 있는 내내 0.97배로 눌려 보였다 */
.qm-carousel.dragging .card-press:active{transform:none;}
/* 위치(translate)·크기(scale)는 JS 가 매 프레임 칠한다(QmProCarousel paint) — transition 을 걸면 손가락보다 늦게 따라와 출렁인다 */
.qm-cslide{flex:0 0 min(72vw,300px);will-change:transform;}
/* 키 작은 폰 — 카드를 조금 줄여 이름 줄까지 첫 화면에 더 들어오게(넘치면 세로로 내려 본다) */
@media (max-height:720px){.qm-cslide{flex-basis:min(64vw,260px);}}
.qm-cdots{display:flex;justify-content:center;gap:6px;margin-top:-4px;}
.qm-cdots button{width:6px;height:6px;padding:0;border:0;border-radius:3px;background:#D5DAE0;transition:width .4s cubic-bezier(.4,0,.2,1),background-color .4s cubic-bezier(.4,0,.2,1);cursor:pointer;}
/* 보는 카드 = 길쭉한 알약(261002 사장 '인디케이터 포커싱된 부분 알약 형태로 길게') — 옆 점이 줄고 이 점이 늘어 전체 폭은 그대로 */
.qm-cdots button.on{width:18px;background:#191F28;}
.qm-ccheck{position:absolute;right:14px;top:14px;width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.26);-webkit-backdrop-filter:blur(10px) saturate(140%);backdrop-filter:blur(10px) saturate(140%);box-shadow:inset 0 0 0 1.5px rgba(255,255,255,.85);transition:background-color .38s cubic-bezier(.4,0,.2,1),box-shadow .38s cubic-bezier(.4,0,.2,1),transform .3s cubic-bezier(.34,1.56,.64,1);}
.qm-ccheck.on{background:var(--tone-accent,var(--blue));box-shadow:none;transform:scale(1.06);}
.qm-ccheck path{stroke-dasharray:1;stroke-dashoffset:1;animation:qm-check-draw .36s .02s cubic-bezier(.65,0,.35,1) forwards;}
.qm-cport{position:absolute;left:14px;bottom:24px;z-index:2;display:inline-flex;align-items:center;gap:1px;height:32px;padding:0 9px 0 13px;border:0;border-radius:16px;color:#fff;font-family:inherit;font-size:13.5px;font-weight:600;letter-spacing:-.2px;background:rgba(0,0,0,.38);-webkit-backdrop-filter:blur(10px) saturate(140%);backdrop-filter:blur(10px) saturate(140%);box-shadow:inset 0 0 0 .5px rgba(255,255,255,.2);cursor:pointer;}
.qm-cport:active{background:rgba(0,0,0,.5);}
.qm-cport svg{flex:none;}
.qm-chk{width:26px;height:26px;flex:none;border-radius:50%;border:2px solid #D1D6DB;display:flex;align-items:center;justify-content:center;}
.qm-chk.on{border-color:var(--blue);background:var(--blue);}
@keyframes qm-check-draw{to{stroke-dashoffset:0;}}
.qm-err{margin-top:40px;text-align:center;color:var(--t-ph);font-size:14px;line-height:1.6;}
.qm-err button{margin-top:12px;background:var(--divider);color:var(--t-sub);font-weight:600;border:0;border-radius:12px;padding:9px 16px;cursor:pointer;font-family:inherit;}
.qm-done-ic{width:84px;height:84px;border-radius:50%;background:var(--blue);display:flex;align-items:center;justify-content:center;}
.qm-done-sub{margin-top:14px;font-size:15px;line-height:1.6;color:var(--t-weak);}
.qm-done-sub .blue,.blue{color:var(--blue);}
.qm-summary{margin-top:30px;width:100%;max-width:330px;background:#F9FAFB;border-radius:16px;padding:6px 18px;}
.qm-summary>div{display:flex;justify-content:space-between;align-items:center;gap:16px;padding:12px 0;border-bottom:1px solid var(--divider);}
.qm-summary>div:last-child{border-bottom:0;}
.qm-summary span{font-size:14px;color:var(--t-ph);flex:none;}
.qm-summary b{font-size:14px;font-weight:600;color:var(--t);text-align:right;}
/* ── PC(넓은 화면): 가운데 카드 프레임 ── */
@media (min-width:768px){
  .qm-root{max-width:none;background:#EBEEF3;min-height:100dvh;display:flex;align-items:center;justify-content:center;padding:32px 16px;}
  .qm-page{width:100%;max-width:430px;height:min(824px,94vh);min-height:0;background:#fff;border-radius:28px;box-shadow:0 16px 50px rgba(17,24,39,.14);overflow:hidden;}
  .qm-page.center{width:100%;max-width:430px;height:min(824px,94vh);}
  .qm-main{overflow-y:auto;}
  .qm-ctawrap{padding-bottom:18px;}
  .qm-keypad{padding-bottom:10px;}
  .qm-opt:hover:not(.on){border-color:#C4CCD4;background:#FBFCFD;}
  .qm-cta:hover:not(:disabled){background:var(--blue-press);}
  .qm-btnrow .qm-cta.ghost:hover{background:#E5E8EB;}
  .qm-header .qm-hreroll:hover:not(:disabled){background:var(--divider);}
  .qm-header button:hover{background:var(--divider);}
  /* PC 틀(430×824) — 카드가 버튼 줄에 가리지 않게 */
  .qm-cslide{flex-basis:272px;}
}
/* 점검용 테스트 계정 표시 — 번호 입력 화면 설명 아래 작은 알약(흐름 안에 둬 머리줄·시트·버튼을 안 가린다) */
.qm-testpill{display:inline-block;margin:-6px 0 18px;background:#FFF4E5;color:#B25E09;border:1px solid #FFE0B2;font-size:13px;font-weight:600;line-height:1;padding:8px 12px;border-radius:999px;}
`;

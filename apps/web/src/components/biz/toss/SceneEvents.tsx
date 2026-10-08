'use client';
/* eslint-disable @next/next/no-img-element -- public 정적 행사 사진 */

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useScroll } from 'framer-motion';
import { useT } from '@/lib/biz/i18n';
import { EVENTS } from './content';
import { ease, prefersReducedMotion, seg, useFrame } from './scene';

/*
 * ⑥ 행사 장면(토스 '상품 판매와 정산' + '광고 노출 전략' 자리, 261008).
 * 데스크톱: 고정 무대에서 두 줄 제목이 1.8배로 들어와 한 글자씩 타이핑(진한 글자 · 쓰는 단어 주황 그라데이션 · 주황 커서) → 1배로 줄며 위로,
 *   유리 카드 6장이 차례로 떠오르고(시간 기반) 가짜 커서가 카드를 돌며 시연 → 다음 고정 무대에서 큰 사진 카드가 2단 가로 이동.
 *   화면 전체에 설계도 격자선(고정, 구간마다 켜고 끔). 토마토 병 · 대시보드 변신은 뺌.
 * 모바일 · 태블릿(<1024, SceneBook 과 같은 lg 경계): 토스 모바일처럼 고정 없음 — 가운데 제목 + 유리 카드 무한 흐름(80px/s) + 왼쪽 둘째 제목 · 흰 카드 흐름(36px/s).
 * 어두운 큰 사진 카드 위에선 왼쪽 눈금이 흰색으로 — 사진 칸 data-dock-theme="dark"(눈금 높이 전체를 덮음).
 *   첫 무대 유리 카드 사진은 눈금 아래쪽만 걸쳐(위 눈금은 밝은 바탕) 표시 안 함.
 * 좌표는 토스 1440x900 실측(px) 그대로 쓰고 무대 전체를 --k 배로 줄이고 키운다.
 */

const CW = 1440;
const CH = 900;
/* 제목 무대 — 부모 높이 100vh + 1350(고정 구간) */
const PIN_A = 1350;
const TYPE_FROM = 165;
const TYPE_TO = 920;
const SCALE_FROM = 400;
const SCALE_TO = 1150;
const CARDS_AT = 665;
const SUB_FROM = 624;
const SUB_TO = 1154;
/* 제목 1.8배일 때 화면 가운데로 내리는 거리(블록 가운데 211.5 → 450) */
const HEAD_TY = 238.56;
/* 카드 줄 — 토스 실측 x = i*279, 위치는 물결 */
const CARD_TOP = [420, 357, 448, 487, 427, 362];
const CARD_X = (i: number) => i * 279;
/* 등장 순서 2,5,1,3,4,6 */
const ORDER = [1, 4, 0, 2, 3, 5];
const EASE_QUART = 'cubic-bezier(0.25, 1, 0.5, 1)';

/* 가로 이동 무대 — 고정 구간 1294(1단 -264..269 · 2단 269..1294), 카드 332 · 간격 20 */
const PIN_B = 1294;
const AD_W = 332;
const AD_PITCH = 352;
const AD_X0 = 140;
const WRAP_FROM = -264;
const WRAP_TO = 269;
const WRAP_SHIFT = 792;
/* 두 무대 사이 여백 */
const GAP_AB = 160;

/* 설계도 격자선(1440x900 기준 px) */
const GV = [220, 420, 620, 820, 1020, 1220];
const GH = [118, 339, 561, 782];
type GridSet = 'off' | 'head' | 'full' | 'ads' | 'ads2';
const GRID_ON: Record<GridSet, { v: number[]; h: number[] }> = {
  off: { v: [], h: [] },
  head: { v: [420, 1020], h: [339, 561] },
  full: { v: GV, h: GH },
  ads: { v: [220, 820, 1220], h: [118, 782] },
  ads2: { v: [220, 1220], h: [118, 782] },
};

const GRAD = 'linear-gradient(90deg, #FF6B35, #F7931E)';
const C_BASE = '#E7E3E2';
const C_TYPED = '#3D3833';

function useIsoLayout(cb: () => void | (() => void), deps: unknown[]) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  (typeof window === 'undefined' ? useEffect : useLayoutEffect)(cb, deps);
}

/** 무대 배율 — 1440x900 이 1(폭은 장면 자신의 폭, 데스크톱 무대는 ≥1024 에서만 보임) */
function calcK(el: HTMLElement | null) {
  const w = el?.clientWidth || window.innerWidth;
  const h = window.innerHeight;
  return Math.max(0.6, Math.min(1.25, w / CW, h / CH));
}

type Glyph = { ch: string; word: number };

/** 줄 → 글자(공백 포함) · 단어 번호(공백은 -1) */
function splitLines(lines: string[]) {
  let w = 0;
  return lines.map((line) => {
    const out: Glyph[] = [];
    let inWord = false;
    for (const ch of Array.from(line)) {
      if (ch === ' ') {
        if (inWord) w++;
        inWord = false;
        out.push({ ch, word: -1 });
      } else {
        inWord = true;
        out.push({ ch, word: w });
      }
    }
    if (inWord) w++;
    return out;
  });
}

/* 이 장면 전용 짧은 문구(4개 언어) — 제목 아래 한 줄 · 카드 아래 정보 줄 · 상태 알약 */
type L4 = { ko: string; en: string; ja: string; zh: string };
const l4 = (ko: string, en: string, ja: string, zh: string): L4 => ({ ko, en, ja, zh });
const EV_SUB = l4('공식행사부터 축제까지, 행사에 꼭 맞는 진행자를 찾아보세요.', 'From ceremonies to festivals, find the host that fits your event.', '式典からフェスまで、イベントにぴったりの司会者を。', '从典礼到庆典，找到最适合活动的主持人。');
const EV_META: [L4, L4][] = [
  [l4('진행자', 'Host', '司会者', '主持人'), l4('검증 완료', 'Verified', '検証済み', '已认证')],
  [l4('결제', 'Payment', '決済', '支付'), l4('안전결제', 'Safe Pay', '安全決済', '安全支付')],
];
const EV_STATUS_LABEL = l4('섭외 상태', 'Status', '依頼状況', '预约状态');
const EV_STATUS = [l4('섭외 가능', 'Available', '依頼可能', '可预约'), l4('일정 조율', 'Scheduling', '日程調整', '协调中'), l4('섭외 마감', 'Booked', '受付終了', '已约满')];
/** 회색(일정 조율) 알약 카드 — 토스 카드 줄처럼 2 · 5번째만 */
const GREY_PILL = new Set([1, 4]);

/* 카드 안 좌표(252x369 카드, 토스 실측) — 사진 · 이름 · 큰 줄(강조 칸) · 정보 줄 3개(가운데 294/316/338) */
const C_ROW3 = 338;
const C_BOX = 258; // 강조 칸 가운데
const TALL_DY = 12; // 강조 칸 카드(393 높이)의 글 내림
/* 상태 알약 드롭다운이 열리는 카드(토스 4번째 카드) · 강조 칸을 고치는 카드(3번째) */
const DD_CARD = 3;
const BOX_CARD = 2;

/* 가짜 커서 시연 — 7.3초 반복(토스 순서: 상태 알약 눌러 목록 열기 → 둘째 항목 위 1초 → 닫기 → 옆 카드 강조 칸 눌러 커서 깜빡 → 제자리) */
const CUR_PERIOD = 7300;
const P_PILL: [number, number] = [CARD_X(DD_CARD) + 208, CARD_TOP[DD_CARD] + C_ROW3];
const P_ITEM: [number, number] = [CARD_X(DD_CARD) + 189, CARD_TOP[DD_CARD] + 283];
const P_BOX: [number, number] = [CARD_X(BOX_CARD) + 160, CARD_TOP[BOX_CARD] + C_BOX + TALL_DY];
const CUR_PATH: { t0: number; t1: number; a: [number, number]; b: [number, number] }[] = [
  { t0: 0, t1: 300, a: P_PILL, b: P_PILL },
  { t0: 300, t1: 900, a: P_PILL, b: P_ITEM },
  { t0: 900, t1: 1900, a: P_ITEM, b: P_ITEM },
  { t0: 1900, t1: 2700, a: P_ITEM, b: P_BOX },
  { t0: 2700, t1: 5000, a: P_BOX, b: P_BOX },
  { t0: 5000, t1: 6000, a: P_BOX, b: P_PILL },
  { t0: 6000, t1: 7300, a: P_PILL, b: P_PILL },
];
const DD_OPEN = 150;
const DD_CLOSE = 1900;

function cursorAt(t: number) {
  const s = CUR_PATH.find((p) => t >= p.t0 && t < p.t1) ?? CUR_PATH[CUR_PATH.length - 1];
  const e = ease.inOut(seg(t, s.t0, s.t1));
  const x = s.a[0] + (s.b[0] - s.a[0]) * e;
  const y = s.a[1] + (s.b[1] - s.a[1]) * e;
  let scale = 1;
  for (const c of [DD_OPEN, DD_CLOSE, 2700]) {
    const d = t - c;
    if (d >= 0 && d < 150) scale = 1 - 0.12 * Math.sin((Math.PI * d) / 150);
  }
  const d = t - 2700;
  const pre = d >= -200 && d < 50 ? BOX_CARD : -1;
  const focus = d >= 50 && d < 2300 ? BOX_CARD : -1;
  const caret = focus >= 0 && Math.floor((d - 50) / 400) % 2 === 0;
  const dd = t >= DD_OPEN + 60 && t < DD_CLOSE + 60;
  const ddHover = t >= 820 && t < DD_CLOSE + 60 ? 1 : -1;
  return { x, y, scale, focus, pre, caret, dd, ddHover };
}

export default function SceneEvents() {
  const t = useT();
  const [k, setK] = useState(1);
  const [cw, setCw] = useState(CW);
  const [still, setStill] = useState(false);
  const secRef = useRef<HTMLElement>(null);

  useIsoLayout(() => {
    setStill(prefersReducedMotion());
    const on = () => { setK(calcK(secRef.current)); setCw(secRef.current?.clientWidth || window.innerWidth); };
    on();
    window.addEventListener('resize', on);
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(on) : null;
    if (ro && secRef.current) ro.observe(secRef.current);
    return () => { window.removeEventListener('resize', on); ro?.disconnect(); };
  }, []);

  const typing = EVENTS.typing.map((l) => t(l));
  const second = EVENTS.secondTitle.map((l) => t(l));
  const cards = EVENTS.cards.map((c) => ({ photo: c.photo, title: t(c.title), desc: t(c.desc) }));
  const tag = t(EVENTS.tag);
  const face: FaceText = {
    sub: t(EV_SUB),
    meta: EV_META.map(([a, b]) => [t(a), t(b)] as [string, string]),
    statusLabel: t(EV_STATUS_LABEL),
    status: EV_STATUS.map((s) => t(s)),
  };

  return (
    <section
      ref={secRef}
      id="dock-events"
      style={{ ['--k' as string]: k, background: 'linear-gradient(#FFFFFF, #F5F5F5 80px) #F5F5F5', overflowX: 'clip' } as CSSProperties}
    >
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      {/* 데스크톱 ≥1024 — 고정 무대(태블릿에서 줄여 보이면 거의 빈 화면이라 lg 부터) */}
      <div className="hidden lg:block">
        <DesktopEvents k={k} cw={cw} still={still} typing={typing} cards={cards} tag={tag} face={face} />
      </div>
      <div className="lg:hidden">
        <MobileEvents typing={typing} second={second} cards={cards} tag={tag} face={face} />
      </div>
    </section>
  );
}

type CardData = { photo: string; title: string; desc: string };
type FaceText = { sub: string; meta: [string, string][]; statusLabel: string; status: string[] };

/** 상태 알약(파랑 = 섭외 가능, 회색 = 일정 조율) */
function StatusPill({ label, grey }: { label: string; grey?: boolean }) {
  return (
    <span className={`evt-st${grey ? ' g' : ''}`}>
      <i />
      {label}
    </span>
  );
}

/**
 * 유리 카드 안쪽(252x369 기준) — 토스 상품 카드 배치: 사진 · 이름(13) · 큰 줄(20, 강조 칸) · 정보 줄 3개(12, 오른쪽 값 · 마지막 줄 상태 알약).
 * 데스크톱은 그대로, 모바일은 바깥에서 0.881 배로 줄여 222x324 로 쓴다.
 */
function CardFace({ c, i, face, refs, tall }: {
  c: CardData; i: number; face: FaceText; tall?: boolean;
  refs?: { photo?: (el: HTMLImageElement | null) => void; tb?: (el: HTMLDivElement | null) => void; tc?: (el: HTMLSpanElement | null) => void; dd?: (el: HTMLDivElement | null) => void };
}) {
  const grey = GREY_PILL.has(i);
  // 토스 3번째 카드(강조 칸 카드)는 24px 더 길고 글이 12px 아래
  const dy = tall && i === BOX_CARD ? TALL_DY : 0;
  return (
    <>
      <div className="absolute overflow-hidden" style={{ left: 20, top: 20, width: 210, height: 190 + dy, borderRadius: 16, background: '#ECECEC' }}>
        <img ref={refs?.photo} src={c.photo} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
      </div>
      <p className="absolute m-0 overflow-hidden text-ellipsis whitespace-nowrap" style={{ left: 20, top: 218 + dy, width: 210, fontSize: 13, lineHeight: '20.8px', letterSpacing: '-0.26px', color: '#4E535C' }}>{c.desc}</p>
      <div ref={refs?.tb} data-s={tall && i === BOX_CARD ? 'pre' : 'idle'} data-base={tall && i === BOX_CARD ? 'pre' : 'idle'} className="evt-tb absolute flex items-center" style={{ left: 13, top: C_BOX - 16 + dy, width: 227, height: 32, borderRadius: 7, padding: '0 7px' }}>
        <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap" style={{ fontSize: 20, fontWeight: 400, lineHeight: '22px', letterSpacing: '-0.4px', color: '#333840' }}>{c.title}</span>
        <span ref={refs?.tc} aria-hidden style={{ width: 1.5, height: 20, marginLeft: 1, background: '#4396FB', opacity: 0, flex: 'none' }} />
      </div>
      {[...face.meta, [face.statusLabel, '']].map(([label, value], r) => (
        <div key={r} className="evt-meta absolute flex items-center justify-between" style={{ left: 20, top: 284 + dy + r * 22, width: 210, height: 20 }}>
          <span>{label}</span>
          {r < 2 ? <span className="v">{value}</span> : <StatusPill label={face.status[grey ? 1 : 0]} grey={grey} />}
        </div>
      ))}
      {refs?.dd && (
        <div ref={refs.dd} aria-hidden className="evt-dd" data-open="0" data-h="-1">
          {face.status.map((s, j) => <div key={j} className="evt-dd-i">{s}</div>)}
        </div>
      )}
    </>
  );
}

function DesktopEvents({ k, cw, still, typing, cards, tag, face }: { k: number; cw: number; still: boolean; typing: string[]; cards: CardData[]; tag: string; face: FaceText }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const aRef = useRef<HTMLDivElement>(null);
  const stageARef = useRef<HTMLDivElement>(null);
  const bRef = useRef<HTMLDivElement>(null);
  const headRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const vRefs = useRef<(HTMLDivElement | null)[]>([]);
  const hRefs = useRef<(HTMLDivElement | null)[]>([]);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const tbRefs = useRef<(HTMLDivElement | null)[]>([]);
  const tcRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const ddRef = useRef<HTMLDivElement>(null);
  const subRef = useRef<HTMLParagraphElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  const glyphs = useMemo(() => splitLines(typing), [typing.join('\n')]); // eslint-disable-line react-hooks/exhaustive-deps
  const total = glyphs.reduce((a, l) => a + l.length, 0);
  const charRefs = useRef<(HTMLSpanElement | null)[][]>([]);
  const wordRefs = useRef<Map<number, HTMLSpanElement>>(new Map());
  const caretRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const edges = useRef<number[][]>([]);

  const st = useRef({ typed: -1, active: -2, grid: 'x' as GridSet | 'x', shown: null as boolean | null, kk: k, inView: false, raf: 0, loopT0: 0 });
  st.current.kk = k;

  // 보이는 무대 폭(좁은 화면은 1440 보다 좁다) — 끝에서 마지막 카드 오른쪽 여백이 140 이 되게
  const visW = Math.min(CW, cw / k);
  const rowShift = -Math.max(0, (cw / k - CW) / 2);
  const trackShift = Math.max(0, cards.length * AD_PITCH - 20 - (visW - AD_X0 * 2));

  /* 글자 오른쪽 끝 재기(변형 무관한 offsetLeft) — 글꼴 · 언어 · 크기 바뀌면 다시 */
  useIsoLayout(() => {
    const measure = () => {
      edges.current = charRefs.current.map((row) => row.map((el) => (el ? el.offsetLeft + el.offsetWidth : 0)));
      st.current.typed = -1;
      st.current.active = -2;
      update();
    };
    measure();
    let alive = true;
    document.fonts?.ready.then(() => alive && measure()).catch(() => {});
    return () => { alive = false; };
  }, [glyphs, k]);

  function applyTyping(n: number) {
    const s = st.current;
    const step = (TYPE_TO - TYPE_FROM) / Math.max(1, total - 1);
    let c = n < TYPE_FROM ? 0 : Math.min(total, Math.floor((n - TYPE_FROM) / step + 1e-6) + 1);
    if (still) c = total;
    // 마지막으로 친 글자의 단어가 주황(다 치면 없음)
    let active = -1;
    if (c > 0 && c < total) {
      let idx = c;
      for (const row of glyphs) {
        if (idx <= row.length) {
          for (let i = idx - 1; i >= 0; i--) if (row[i].word >= 0) { active = row[i].word; break; }
          break;
        }
        idx -= row.length;
      }
      if (active < 0) {
        // 줄 첫 글자가 공백일 일은 없지만 안전하게 앞줄에서 찾기
        let left = c;
        outer: for (const row of glyphs) for (const g of row) { if (left-- <= 0) break outer; if (g.word >= 0) active = g.word; }
      }
    }
    if (c === s.typed && active === s.active) return;
    s.typed = c;
    s.active = active;
    let gi = 0;
    glyphs.forEach((row, li) => {
      row.forEach((g, i) => {
        const el = charRefs.current[li]?.[i];
        if (el) {
          const typed = gi < c;
          el.style.color = !typed ? C_BASE : g.word === active ? 'transparent' : C_TYPED;
        }
        gi++;
      });
    });
    wordRefs.current.forEach((el, w) => { el.style.backgroundImage = w === active ? GRAD : 'none'; });
    // 커서 — 치는 줄에만, 줄을 다 치면 다음 줄 처음으로
    const n1 = glyphs[0]?.length ?? 0;
    caretRefs.current.forEach((el) => { if (el) el.style.opacity = '0'; });
    if (c > 0 && c < total) {
      let line = 0;
      let inLine = c;
      if (c >= n1) { line = 1; inLine = c - n1; }
      const el = caretRefs.current[line];
      if (el) {
        const x = inLine === 0 ? 0 : (edges.current[line]?.[inLine - 1] ?? 0) + 5;
        el.style.transform = `translate3d(${x}px, 0, 0)`;
        el.style.opacity = '1';
      }
    }
  }

  function applyCards(show: boolean) {
    const s = st.current;
    if (s.shown === show) return;
    const first = s.shown === null;
    s.shown = show;
    ORDER.forEach((ci, j) => {
      const el = cardRefs.current[ci];
      if (!el) return;
      const delay = show ? 220 + 100 * j : 100 * (ORDER.length - 1 - j);
      el.style.transition = first || still ? 'none' : `transform 600ms ${EASE_QUART} ${delay}ms, opacity 600ms ${EASE_QUART} ${delay}ms`;
      el.style.transform = show ? 'translate3d(0,0,0)' : 'translate3d(0,80px,0)';
      el.style.opacity = show ? '1' : '0';
    });
    if (show) {
      s.loopT0 = performance.now() + 1300;
      startLoop();
    } else {
      stopLoop(true);
    }
  }

  function applyGrid(set: GridSet) {
    const s = st.current;
    if (s.grid === set) return;
    s.grid = set;
    const on = GRID_ON[set];
    if (gridRef.current) gridRef.current.style.visibility = set === 'off' ? 'hidden' : 'visible';
    GV.forEach((x, i) => { const el = vRefs.current[i]; if (el) el.style.opacity = on.v.includes(x) ? '1' : '0'; });
    GH.forEach((y, i) => { const el = hRefs.current[i]; if (el) el.style.opacity = on.h.includes(y) ? '1' : '0'; });
  }

  function update() {
    const root = rootRef.current;
    const A = aRef.current;
    const B = bRef.current;
    if (!root || !A || !B) return;
    const vh = window.innerHeight;
    const kk = st.current.kk;
    const r = root.getBoundingClientRect();
    if (r.width === 0 || r.bottom < -vh || r.top > vh * 2) { applyGrid('off'); return; }
    const a = -A.getBoundingClientRect().top / kk;
    const b = -B.getBoundingClientRect().top / kk;

    // 제목 — 1.8배 → 1배(easeOutQuart), 내려간 거리도 같은 비율로
    const sc = still ? 1 : 1.8 - 0.8 * ease.outQuart(seg(a, SCALE_FROM, SCALE_TO));
    if (headRef.current) headRef.current.style.transform = `translate3d(0, ${(HEAD_TY * (sc - 1)) / 0.8}px, 0) scale(${sc})`;
    // 제목 아래 한 줄 — 40px 아래 · 투명 → 제자리(easeOutQuart, 토스 W+624..1154)
    if (subRef.current) {
      const q = still ? 1 : ease.outQuart(seg(a, SUB_FROM, SUB_TO));
      subRef.current.style.opacity = String(q);
      subRef.current.style.transform = `translate3d(0, ${40 * (1 - q)}px, 0)`;
    }
    applyTyping(a);
    applyCards(still || a >= CARDS_AT);

    // 가로 이동 2단 — 바깥 792 → 0, 안쪽 0 → -끝까지(둘 다 스크롤에 정비례)
    if (!still) {
      const w1 = WRAP_SHIFT * (1 - seg(b, WRAP_FROM, WRAP_TO));
      const w2 = -trackShift * seg(b, WRAP_TO, PIN_B);
      if (wrapRef.current) wrapRef.current.style.transform = `translate3d(${w1}px,0,0)`;
      if (trackRef.current) trackRef.current.style.transform = `translate3d(${w2}px,0,0)`;
    }

    // 격자선 — 구간마다 한 번에 바뀜
    let g: GridSet = 'off';
    if (a > -598 && b < PIN_B - 141) {
      if (a < 900) g = 'head';
      else if (b < -700) g = 'full';
      else if (b < WRAP_FROM) g = 'ads';
      else g = 'ads2';
    }
    applyGrid(still && g !== 'off' ? 'full' : g);
  }

  const { scrollY } = useScroll();
  useFrame(scrollY, () => update());

  /* 커서 시연 루프 — 카드가 보이고 무대가 화면 안일 때만 */
  function frame(now: number) {
    const s = st.current;
    s.raf = 0;
    if (!s.shown || !s.inView || still) return;
    const el = cursorRef.current;
    const tt = now - s.loopT0;
    if (tt < 0) {
      if (el) el.style.opacity = '0';
    } else {
      const c = cursorAt(tt % CUR_PERIOD);
      if (el) {
        el.style.opacity = '1';
        el.style.transform = `translate3d(${c.x}px, ${c.y}px, 0) scale(${c.scale})`;
      }
      tbRefs.current.forEach((tb, i) => {
        if (!tb) return;
        const v = c.focus === i ? 'focus' : c.pre === i ? 'pre' : tb.dataset.base || 'idle';
        if (tb.dataset.s !== v) tb.dataset.s = v;
        const caret = tcRefs.current[i];
        if (caret) caret.style.opacity = c.focus === i && c.caret ? '1' : '0';
      });
      const dd = ddRef.current;
      if (dd) {
        const o = c.dd ? '1' : '0';
        const h = String(c.ddHover);
        if (dd.dataset.open !== o) dd.dataset.open = o;
        if (dd.dataset.h !== h) dd.dataset.h = h;
      }
    }
    s.raf = requestAnimationFrame(frame);
  }
  function startLoop() {
    const s = st.current;
    if (!s.raf && s.shown && s.inView && !still) s.raf = requestAnimationFrame(frame);
  }
  function stopLoop(reset: boolean) {
    const s = st.current;
    if (s.raf) cancelAnimationFrame(s.raf);
    s.raf = 0;
    if (reset) {
      if (cursorRef.current) cursorRef.current.style.opacity = '0';
      tbRefs.current.forEach((tb) => { if (tb) tb.dataset.s = tb.dataset.base || 'idle'; });
      tcRefs.current.forEach((c) => { if (c) c.style.opacity = '0'; });
      if (ddRef.current) { ddRef.current.dataset.open = '0'; ddRef.current.dataset.h = '-1'; }
    }
  }
  useEffect(() => {
    const el = stageARef.current;
    if (!el) return undefined;
    const ob = new IntersectionObserver(([e]) => {
      st.current.inView = e.isIntersecting;
      if (e.isIntersecting) startLoop();
      else stopLoop(false);
    });
    ob.observe(el);
    return () => { ob.disconnect(); stopLoop(false); };
  }, [still]); // eslint-disable-line react-hooks/exhaustive-deps

  charRefs.current = glyphs.map(() => []);
  wordRefs.current = new Map();

  const canvas: CSSProperties = { position: 'absolute', left: '50%', top: '50%', width: CW, height: CH, marginLeft: -CW / 2, marginTop: -CH / 2, transform: 'scale(var(--k))' };

  return (
    <div ref={rootRef}>
      {/* 설계도 격자선 — 화면에 고정, 콘텐츠 뒤 */}
      <div ref={gridRef} aria-hidden className="pointer-events-none fixed inset-0" style={{ zIndex: 0, visibility: 'hidden' }}>
        {GV.map((x, i) => (
          <div key={`v${x}`} ref={(el) => { vRefs.current[i] = el; }} className="absolute bottom-0 top-0" style={{ left: `calc(50% + ${x - CW / 2}px * var(--k))`, width: 1, background: 'rgba(0,27,55,0.08)', opacity: 0 }} />
        ))}
        {GH.map((y, i) => (
          <div key={`h${y}`} ref={(el) => { hRefs.current[i] = el; }} className="absolute left-0 right-0" style={{ top: `calc(50% + ${y - CH / 2}px * var(--k))`, height: 1, background: 'rgba(0,27,55,0.08)', opacity: 0 }} />
        ))}
      </div>

      {/* ① 타이핑 제목 + 유리 카드 줄 */}
      <div ref={aRef} style={{ height: `calc(100vh + ${PIN_A}px * var(--k))` }}>
        <div ref={stageARef} className="sticky top-0 h-screen overflow-hidden" style={{ zIndex: 1 }}>
          <div style={canvas}>
            <div ref={headRef} className="absolute left-0 right-0 text-center" style={{ top: 150, transformOrigin: '50% 50%', transform: `translate3d(0, ${HEAD_TY}px, 0) scale(1.8)`, willChange: 'transform' }}>
              <h2 className="m-0" style={{ fontSize: 48, fontWeight: 700, lineHeight: '61.44px', letterSpacing: '-0.96px', color: C_BASE }}>
                {glyphs.map((row, li) => {
                  const groups: { word: number; items: { g: Glyph; i: number }[] }[] = [];
                  row.forEach((g, i) => {
                    const last = groups[groups.length - 1];
                    if (last && last.word === g.word && g.word >= 0) last.items.push({ g, i });
                    else groups.push({ word: g.word, items: [{ g, i }] });
                  });
                  return (
                    <span key={li} className="block">
                      <span className="relative inline-block whitespace-nowrap align-top">
                        {groups.map((gr, gi) => {
                          const chars = gr.items.map(({ g, i }) => (
                            <span key={i} ref={(el) => { charRefs.current[li][i] = el; }} style={{ color: still ? C_TYPED : C_BASE }}>{g.ch}</span>
                          ));
                          return gr.word < 0 ? <span key={gi}>{chars}</span> : (
                            <span key={gi} ref={(el) => { if (el) wordRefs.current.set(gr.word, el); }} className="evt-word">{chars}</span>
                          );
                        })}
                        <span ref={(el) => { caretRefs.current[li] = el; }} aria-hidden className="absolute left-0" style={{ top: 6.72, width: 5, height: 48, background: '#FF6B35', opacity: 0 }} />
                      </span>
                    </span>
                  );
                })}
              </h2>
            </div>
            <p ref={subRef} className="absolute m-0 whitespace-nowrap text-center" style={{ left: 0, right: 0, top: 295, fontSize: 16, lineHeight: '25.6px', letterSpacing: '-0.32px', color: 'rgba(24,31,43,0.77)', opacity: still ? 1 : 0, transform: still ? 'none' : 'translate3d(0,40px,0)', willChange: 'transform, opacity' }}>{face.sub}</p>

            {/* 카드 줄 — 토스처럼 화면 왼쪽 끝에서 시작(넓거나 낮은 화면에서 무대가 1440 보다 넓어지면 그만큼 왼쪽으로) */}
            <div className="absolute inset-0" style={{ transform: `translate3d(${rowShift}px,0,0)` }}>
            {cards.map((c, i) => (
              <div
                key={i}
                ref={(el) => { cardRefs.current[i] = el; }}
                className="evt-glass absolute"
                style={{ left: CARD_X(i), top: CARD_TOP[i], width: 252, height: i === BOX_CARD ? 369 + 2 * TALL_DY : 369, borderRadius: 27, background: i === BOX_CARD ? 'rgba(255,255,255,0.2)' : undefined, opacity: still ? 1 : 0, transform: still ? 'none' : 'translate3d(0,80px,0)' }}
              >
                <CardFace
                  c={c}
                  i={i}
                  face={face}
                  tall
                  refs={{
                    tb: (el) => { tbRefs.current[i] = el; },
                    tc: (el) => { tcRefs.current[i] = el; },
                    dd: i === DD_CARD ? (el) => { ddRef.current = el; } : undefined,
                  }}
                />
              </div>
            ))}

            {/* 가짜 커서(직접 그린 화살표) */}
            <div ref={cursorRef} aria-hidden className="pointer-events-none absolute left-0 top-0" style={{ width: 32, height: 32, opacity: 0, transition: 'opacity 300ms ease', transformOrigin: '4px 3px', zIndex: 3 }}>
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                <path d="M5 3.5 L25.5 15.2 L16.4 17.3 L12.2 26 Z" fill="#3182F6" stroke="#FFFFFF" strokeWidth="1.6" strokeLinejoin="round" />
              </svg>
            </div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ height: `calc(${GAP_AB}px * var(--k))` }} />

      {/* ② 큰 사진 카드 2단 가로 이동 */}
      {/* 토스는 카드 줄 아래 끝이 곧 섹션 끝 — 우리 무대는 화면 가운데 맞춤이라 아래 빈 칸((100vh-617k)/2)만큼 다음 장면을 끌어올린다 */}
      <div ref={bRef} style={{ height: still ? '100vh' : `calc(100vh + ${PIN_B}px * var(--k))`, marginBottom: `calc((617px * var(--k) - 100vh) / 2)` }}>
        <div className="pointer-events-none sticky top-0 h-screen overflow-hidden" style={{ zIndex: 1 }}>
          {/* 좁은 화면에선 왼쪽 맞춤(제목이 잘리지 않게) */}
          <div className="pointer-events-auto" style={{ ...canvas, height: 617, marginTop: -617 / 2, left: `max(0px, calc(50% - ${CW / 2}px * var(--k)))`, marginLeft: 0, transformOrigin: '0 50%' }}>
            <h3 className="absolute m-0" style={{ left: AD_X0, top: 0, fontSize: 32, fontWeight: 700, lineHeight: '44.8px', letterSpacing: '-0.64px', color: '#1C1F25', whiteSpace: 'nowrap' }}>
              {typing.map((l, i) => (
                <span key={i} className="block">
                  {l}
                  {i === typing.length - 1 && <span className="evt-pill">{tag}</span>}
                </span>
              ))}
            </h3>
            <div className="absolute" style={{ left: AD_X0, top: 149, right: 0, overflowX: still ? 'auto' : 'visible' }}>
              <div ref={wrapRef} style={{ transform: still ? 'none' : `translate3d(${WRAP_SHIFT}px,0,0)`, willChange: 'transform' }}>
                <div ref={trackRef} className="flex" style={{ gap: AD_PITCH - AD_W, width: 'max-content', willChange: 'transform' }}>
                  {cards.map((c, i) => (
                    <div key={i} data-dock-theme="light" className="relative flex-none bg-white" style={{ width: AD_W, height: 464, borderRadius: 36, padding: 12 }}>
                      {/* 어두운 사진 위 = 흰 눈금 */}
                      <div data-dock-theme="dark" className="overflow-hidden" style={{ width: 308, height: 351, borderRadius: 26, background: '#ECECEC' }}>
                        <img src={c.photo} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
                      </div>
                      <div className="absolute" style={{ left: 36, top: 383, width: 260 }}>
                        <p className="m-0 overflow-hidden text-ellipsis whitespace-nowrap" style={{ fontSize: 16, lineHeight: '25.6px', letterSpacing: '-0.32px', color: '#727780' }}>{c.desc}</p>
                        <p className="m-0 overflow-hidden text-ellipsis whitespace-nowrap" style={{ fontSize: 18, fontWeight: 700, lineHeight: '26.64px', letterSpacing: '-0.36px', color: '#000' }}>{c.title}</p>
                      </div>
                    </div>
                  ))}
                  <div className="flex-none" style={{ width: AD_X0 }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** 한 번 보이면 true(줄인 움직임이면 처음부터) */
function useOnce<T extends Element>(rootMargin: string) {
  const ref = useRef<T>(null);
  const [v, setV] = useState(false);
  useEffect(() => {
    if (prefersReducedMotion()) { setV(true); return undefined; }
    const el = ref.current;
    if (!el) return undefined;
    const ob = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setV(true); ob.disconnect(); } }, { rootMargin });
    ob.observe(el);
    return () => ob.disconnect();
  }, [rootMargin]);
  return { ref, v };
}

/* 모바일 유리 카드 세로 어긋남(토스 실측) */
const M_OFF = [42, 0, 56, 92, 50, 12];

function MobileEvents({ typing, second, cards, tag, face }: { typing: string[]; second: string[]; cards: CardData[]; tag: string; face: FaceText }) {
  const h1 = useOnce<HTMLHeadingElement>('0px 0px -14% 0px');
  const h2 = useOnce<HTMLHeadingElement>('0px 0px -14% 0px');
  const row = useOnce<HTMLDivElement>('0px 0px -20% 0px');
  const set1 = cards.length * 240;
  const set2 = cards.length * 256;
  return (
    <div style={{ paddingTop: 140 }}>
      <h2
        ref={h1.ref}
        className={`evt-blur m-0 px-6 text-center ${h1.v ? 'is-in' : ''}`}
        style={{ fontSize: 36, fontWeight: 700, lineHeight: '46.08px', letterSpacing: '-0.72px', color: 'rgb(61,57,49)', textWrap: 'balance' } as CSSProperties}
      >
        {typing.map((l, i) => <span key={i} className="block">{l}</span>)}
      </h2>
      <p className={`evt-blur m-0 px-6 text-center ${h1.v ? 'is-in' : ''}`} style={{ paddingTop: 18, fontSize: 15, lineHeight: '24px', color: 'rgba(24,31,43,0.77)', wordBreak: 'keep-all', transitionDelay: '100ms' }}>{face.sub}</p>

      {/* 유리 카드 무한 흐름 — 왼쪽으로 80px/s */}
      <div ref={row.ref} className={`evt-mrow evt-fade ${row.v ? 'is-in' : ''}`} style={{ marginTop: 34, height: 324 + 92 }}>
        <div className="evt-marquee flex" style={{ width: 'max-content', animationDuration: `${set1 / 80}s`, ['--set' as string]: `${set1}px` } as CSSProperties}>
          {[...cards, ...cards].map((c, i) => (
            <div key={i} aria-hidden={i >= cards.length} className="evt-glass relative flex-none" style={{ width: 222, height: 324, borderRadius: 22, marginRight: 18, marginTop: M_OFF[i % 6], backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)', boxShadow: '0 5px 24px 0 rgba(2,32,71,0.05)' }}>
              <div className="absolute left-0 top-0" style={{ width: 252, height: 369, transform: 'scale(0.881, 0.878)', transformOrigin: '0 0' }}>
                <CardFace c={c} i={i % cards.length} face={face} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 큰 사진 카드 흐름 — 왼쪽 둘째 제목(첫 제목 되풀이 X) + 알약, 36px/s */}
      <h3
        ref={h2.ref}
        className={`evt-blur m-0 ${h2.v ? 'is-in' : ''}`}
        style={{ marginTop: 120, paddingLeft: 32, paddingRight: 24, fontSize: 28, fontWeight: 700, lineHeight: '39.2px', letterSpacing: '-0.56px', color: '#1C1F25' }}
      >
        {second.map((l, i) => (
          <span key={i} className="block">
            {l}
            {i === second.length - 1 && <span className="evt-pill evt-pill-m">{tag}</span>}
          </span>
        ))}
      </h3>
      <div className="evt-mrow" style={{ marginTop: 38 }}>
        <div className="evt-marquee flex" style={{ width: 'max-content', paddingLeft: 24, animationDuration: `${set2 / 36}s`, ['--set' as string]: `${set2}px` } as CSSProperties}>
          {[...cards, ...cards].map((c, i) => (
            <div key={i} aria-hidden={i >= cards.length} className="relative flex-none bg-white" style={{ width: 240, height: 343, borderRadius: 32, padding: 12, marginRight: 16 }}>
              <div className="overflow-hidden" style={{ width: 216, height: 244, borderRadius: 32, background: '#ECECEC' }}>
                <img src={c.photo} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
              </div>
              <p className="m-0 overflow-hidden text-ellipsis whitespace-nowrap" style={{ marginTop: 12, padding: '0 12px', fontSize: 14, lineHeight: '22.4px', letterSpacing: '-0.28px', color: '#727780' }}>{c.desc}</p>
              <p className="m-0 overflow-hidden text-ellipsis whitespace-nowrap" style={{ padding: '0 12px', fontSize: 17, fontWeight: 700, lineHeight: '25.16px', letterSpacing: '-0.34px', color: '#000' }}>{c.title}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const CSS = `
.evt-glass{background:rgba(255,255,255,0.4);-webkit-backdrop-filter:blur(16px);backdrop-filter:blur(16px);box-shadow:0 6px 30px 0 rgba(2,32,71,0.05);border:1px solid #fff;will-change:transform,opacity}
.evt-word{-webkit-background-clip:text;background-clip:text}
.evt-tb{border:1px solid transparent;background:transparent;transition:background-color .2s ease,border-color .2s ease}
.evt-tb[data-s=pre]{background:rgba(26,122,249,0.05);border-color:#DCECFE}
.evt-tb[data-s=focus]{background:rgba(26,122,249,0.09);border-color:#4396FB}
.evt-meta{font-size:12px;line-height:16.8px;letter-spacing:-0.12px;color:#727780;white-space:nowrap}
.evt-meta .v{line-height:12px;letter-spacing:-0.24px;color:#8F959E}
.evt-st{display:inline-flex;align-items:center;gap:3px;height:18px;padding:0 6px;border-radius:5px;background:rgba(26,122,249,0.09);color:#2972E8;font-size:10px;font-weight:500;line-height:10px;letter-spacing:-0.2px}
.evt-st i{width:3px;height:3px;border-radius:50%;background:#4396FB;flex:none}
.evt-st.g{background:rgba(7,25,76,0.05);color:#727780}
.evt-st.g i{background:#8F959E}
.evt-dd{position:absolute;right:21px;top:244px;width:82px;padding:5px;box-sizing:border-box;display:flex;flex-direction:column;gap:2px;background:#fff;border-radius:10px;box-shadow:0 7px 17px rgba(2,32,71,0.14);opacity:0;transform:translate3d(0,4px,0) scale(0.96);transform-origin:100% 100%;transition:opacity .18s ease,transform .18s ease;pointer-events:none;z-index:2}
.evt-dd[data-open="1"]{opacity:1;transform:none}
.evt-dd-i{height:21px;border-radius:6px;padding:0 7px;display:flex;align-items:center;font-size:10px;font-weight:500;color:#4E535C;white-space:nowrap;overflow:hidden;transition:background-color .15s ease}
.evt-dd[data-h="1"] .evt-dd-i:nth-child(2){background:rgba(7,25,76,0.05)}
.evt-clamp2{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.evt-pill{display:inline-flex;align-items:center;justify-content:center;height:30px;padding:0 11px;margin-left:6px;vertical-align:middle;position:relative;top:-3px;border-radius:50px;font-size:14px;font-weight:700;line-height:19.6px;letter-spacing:-0.64px;color:rgba(26,31,41,0.89);background:linear-gradient(267deg,rgba(7,25,76,0.05) 3.4%,rgba(3,31,63,0.09) 96.6%),rgba(240,237,237,0.6);box-shadow:0 8px 24px rgba(3,31,63,0.09);white-space:nowrap}
.evt-pill-m{height:17px;padding:0 6px;font-size:10.5px;line-height:17px;letter-spacing:-0.3px;top:-6px;box-shadow:none;background:rgba(240,237,237,0.6)}
.evt-blur{opacity:0;transform:translate3d(0,24px,0);filter:blur(16px);transition:opacity 1s ease,transform 1s ease,filter 1s ease}
.evt-blur.is-in{opacity:1;transform:none;filter:none}
.evt-fade{opacity:0;transform:translate3d(0,48px,0);transition:opacity 1s cubic-bezier(0.33,1,0.68,1),transform 1s cubic-bezier(0.33,1,0.68,1)}
.evt-fade.is-in{opacity:1;transform:none}
.evt-mrow{overflow:hidden}
.evt-marquee{animation-name:evt-marquee;animation-timing-function:linear;animation-iteration-count:infinite;will-change:transform}
@keyframes evt-marquee{from{transform:translate3d(0,0,0)}to{transform:translate3d(calc(var(--set) * -1),0,0)}}
@media (prefers-reduced-motion: reduce){
  .evt-marquee{animation:none}
  .evt-mrow{overflow-x:auto}
  .evt-blur,.evt-fade{opacity:1;transform:none;filter:none;transition:none}
}
`;

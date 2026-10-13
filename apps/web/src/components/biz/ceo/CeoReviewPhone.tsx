'use client';

/* eslint-disable @next/next/no-img-element -- public 정적 앱 캡처 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { KeywordOrb, type KeywordOrbText } from '@/components/pros/ReviewKeywordOrb';
import { getT, useBizLang } from '@/lib/biz/i18n';
import { MATCH } from '../toss/content';
import { useIsoLayoutEffect } from './motion';

/*
 * ③ 경영 철학 카드 04 '기술 기반 혁신' 오른쪽 폰 화면(261013 사장 '기술 기반 혁신 부분에 ui가 나오기 전에 AI 애니메이션 있잖아 요약 그거
 *  가운데 있고 그거 슝슝 뜨는거 그거가 나오면서 리뷰 ui로 들어가게끔 지금 리뷰ui가 옛날꺼임').
 *
 * 순서 — 폰 화면이 반 넘게 보이거나 카드가 맨 앞에 오면(front) 폰 화면 가운데서 사회자 상세의 '언급 키워드' 판(KeywordOrb — 보라 원 · 별 ·
 *  칩이 톡톡 뜸)이 먼저 돌고, 칩이 다 뜨면 곧 판이 리뷰 화면 속 제자리(키워드 판 자리)로 내려앉으며 위쪽 AI 요약 카드('이 사회자의 스타일을
 *  소개합니다') · 별점이 흐림 → 선명으로 들어온다 → 판이 캡처 속 같은 판과 겹쳐 바뀌고(한국어는 글자까지 같아 이음매가 없다) → 닿자마자 쉬지 않고
 *  리뷰 줄 쪽으로 천천히 한 번 굴러간다. 카드가 앞에서 물러났다가 다시 오면(또는 화면 밖에 나갔다 오면) 처음부터 다시. 계속 되풀이하지는 않는다
 *  (가만히 보는 동안 정신없지 않게). 움직임 줄이기 = 마지막 리뷰 화면만.
 * 261013 검토 반영 — ① 카드 04 는 마지막 카드라 맨 앞에 머무는 스크롤이 짧다(데스크톱 ≈ 900px) → 시작을 '폰 화면 반 넘게 보임'으로 당기고
 *  판 머묾 · 내려앉기 · 굴러가기를 줄여 리뷰 화면이 ≈ 3.3초에 다 들어온다. ② 기다리는 동안(idle) 흰 화면 대신 판의 첫 자리(점 셋 · 제목 자리 회색 줄 ·
 *  옅은 보라 원)를 깔아 둔다 — 원과 칩은 비워 둬서 '슝슝' 등장은 그대로. ③ 내려앉는 순간 판의 숨쉬기 · 칩 둥실을 멈춰 쉬는 자세(캡처와 같은
 *  자세)로 겹치고 0.14초에 녹인다. ④ 영어 · 일본어 · 중국어는 캡처(한국어) 판으로 바꾸지 않고 그 언어 판을 끝까지 남긴다(data-keep).
 *
 * 그림 = reviews-2026.webp(운영 /pros/6fb8f628…(이승진 · 리뷰 13) 모바일 390×844 · 3배 캡처 → 780 폭, 261013).
 *  위 116 줄 = 떠 있는 머리줄 + 탭('리뷰 (13)' 켜짐), 그 아래 1290 줄 = 리뷰 칸 띠(제목 · 별점 · AI 요약 · 키워드 판 · 전체 리뷰 · 리뷰 셋).
 *  리뷰 이름은 앱이 이미 'm**'처럼 가린 그대로 · 문의 단추 같은 떠 있는 것은 숨기고 찍었다.
 *  띠는 세 조각(키워드 판 위 · 판 · 아래)으로 잘라 따로 움직인다 — 자르는 줄은 모두 흰 틈(판 위 310 · 아래 700).
 *
 * 화면 = 390 디자인 px 판을 폰 화면 폭에 맞춰 scale 로 줄인다(글자가 작아도 실제 px 로 줄이지 않는다 — 크롬 최소 글자 크기에 안 걸리게).
 * ⚠ KeywordOrb 는 자기 칸 폭을 getBoundingClientRect 로 잰다(변형 포함) — 판이 줄어 있고(scale) 카드가 쌓이며 줄거나 폰이 기울면 그대로 두면 엉뚱한 폭을 잰다
 *  (261013 기기 다시 그리기 뒤 앞 폰은 똑바로지만, 카드 scale · 판 scale 은 그대로라 역행렬은 계속 필요).
 *  그래서 판을 붙이는 순간에만 판 칸에 조상 변형의 역행렬을 걸어(보이지 않게) 350 을 재게 하고, 판의 ResizeObserver 첫 알림이 지난 뒤
 *  (두 프레임) 풀어 준다. 이후 판 칸 폭(350 디자인 px)은 바뀌지 않으니 다시 재지 않는다.
 */

/** idle = 판의 첫 자리만 · orb = 판 등장 · morph = 내려앉기(+ 위 조각 들어옴) · scroll = 닿자마자 굴러가기(끝 자세) ·
 *  rev = 움직임 줄이기의 고정 리뷰 화면 · out = 다시 재생 전 걷어 내기 */
type Phase = 'idle' | 'orb' | 'morph' | 'scroll' | 'rev' | 'out';

/** 캡처 기하(디자인 px = 390 폭 css px) — valuesStyles.ts 의 숫자와 같아야 한다 */
const HEAD = 116;
/** 띠 조각 [위, 아래) — 키워드 판 칸은 띠 317.8 ~ 698.1 */
const SLICES: [number, number][] = [[0, 310], [310, 700], [700, 1290]];

/** 판 등장(점 → 제목 → 원 → 반짝이 → 칩 8개 · 체크 배지 ≈ 2.2초) 뒤 곧 리뷰 화면으로(261013 검토 — 3.3 → 2.4초, 카드 04 머무는 시간이 짧다) */
const ORB_MS = 2400;
/** 판이 캡처 속 제자리에 닿는 시간 = valuesStyles 의 .cxv-orbbox 0.65초 — 닿자마자 굴러가기(쉬는 틈 없이 한 흐름, 261013 검토) */
const LAND_MS = 650;
const OUT_MS = 340;
/** 시작 문턱 = 폰 화면이 반 넘게 보일 때 · 4분의 1 밑으로 줄면 다음 재생 준비(문턱 근처에서 되풀이로 깜빡이지 않게 사이를 둔다) */
const NEAR_ON = 0.5;
const NEAR_OFF = 0.25;

/** 캡처 속 키워드 판 글자 그대로(한국어 — 바뀌는 순간 같은 글자가 겹쳐 이음매가 안 보인다) */
const KO: KeywordOrbText = {
  titleTop: '리뷰 13건을 모아 보니,',
  titleStrong: '이승진 사회자의 이런 점',
  titleRest: '에 만족했어요',
  orbLines: ['리뷰로 본', '이승진 사회자'],
  primary: ['분위기 리드', '꼼꼼한 준비', '편안함', '매끄러운 진행'],
  secondary: ['안정적인 목소리', '친절한 소통', '감동적인 순간', '하객 호응'],
};
/** 다른 언어 = 비즈 홈 매칭 카드의 같은 판 글(4개 언어 · 이름 대신 '이 사회자') */
const HOME_ORB = (() => {
  for (const c of MATCH.cards) if ('orb' in c) return c.orb;
  return null;
})();

type M = [number, number, number, number];
const mul = (p: M, q: M): M => [p[0] * q[0] + p[2] * q[1], p[1] * q[0] + p[3] * q[1], p[0] * q[2] + p[2] * q[3], p[1] * q[2] + p[3] * q[3]];
function linearOf(el: Element): M {
  const cs = getComputedStyle(el);
  let m: M = [1, 0, 0, 1];
  // 개별 속성 순서 = translate → rotate → scale → transform (translate 는 폭과 무관)
  const rot = cs.rotate;
  if (rot && rot !== 'none' && /^-?[\d.]+deg$/.test(rot)) {
    const a = (parseFloat(rot) * Math.PI) / 180;
    m = mul(m, [Math.cos(a), Math.sin(a), -Math.sin(a), Math.cos(a)]);
  }
  const sc = cs.scale;
  if (sc && sc !== 'none') {
    const [sx, sy = sx] = sc.split(/\s+/).map(parseFloat);
    if (sx && sy) m = mul(m, [sx, 0, 0, sy]);
  }
  const t = cs.transform;
  if (t && t !== 'none') {
    const v = t.slice(t.indexOf('(') + 1, -1).split(',').map(Number);
    const tm: M = t.startsWith('matrix3d') ? [v[0], v[1], v[4], v[5]] : [v[0], v[1], v[2], v[3]];
    if (tm.every(Number.isFinite)) m = mul(m, tm);
  }
  return m;
}
/** el 의 조상 변형(선형 부분)을 모두 곱한 것의 역행렬 — 판 칸에 걸면 화면 위 폭 = 레이아웃 폭 */
function inverseOf(el: Element | null | undefined): string | null {
  if (!el) return null;
  let total: M = [1, 0, 0, 1];
  for (let a: Element | null = el; a; a = a.parentElement) total = mul(linearOf(a), total);
  const [a, b, c, d] = total;
  const det = a * d - b * c;
  if (!det || !Number.isFinite(det)) return null;
  const f = (n: number) => (Math.abs(n) < 1e-9 ? 0 : n).toFixed(6);
  return `matrix(${f(d / det)}, ${f(-b / det)}, ${f(-c / det)}, ${f(a / det)}, 0, 0)`;
}

/** 리뷰 캡처가 그려질 준비가 됐는지(늦어도 1.5초) — 판이 내려앉는데 바탕이 비어 있지 않게.
 *  1.5초 타이머도 later(= 진행 타이머 목록)로 걸어 언마운트 · 다시 재생 때 함께 지운다(261013 검토) */
function decoded(img: HTMLImageElement | null, later: (ms: number, fn: () => void) => void): Promise<void> {
  if (!img || (img.complete && img.naturalWidth > 0)) return Promise.resolve();
  const d = typeof img.decode === 'function' ? img.decode().catch(() => undefined) : Promise.resolve();
  return Promise.race([d, new Promise<void>((r) => later(1500, r))]);
}

export default function CeoReviewPhone({ src, active, still }: { src: string; active: boolean; still: boolean }) {
  const { lang } = useBizLang();
  const rootRef = useRef<HTMLDivElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [phase, setPhase] = useState<Phase>(still ? 'rev' : 'idle');
  const [play, setPlay] = useState(0);
  /** 판을 붙이는 순간에만 거는 역행렬(재는 동안 판은 보이지 않는다) */
  const [inv, setInv] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);
  /** 폰 화면이 반 넘게 보임(NEAR_ON) — 카드가 맨 앞(active)이 되기 전에 시작해 빈 화면 · 짧은 머묾을 줄인다(261013 검토) */
  const [near, setNear] = useState(false);
  const phaseRef = useRef<Phase>(phase);
  const timers = useRef<number[]>([]);
  const gen = useRef(0);
  const running = useRef(false);
  const armed = useRef(true);

  const text = useMemo<KeywordOrbText>(() => {
    if (lang === 'ko' || !HOME_ORB) return KO;
    const o = HOME_ORB;
    const t = (tr: { ko: string; en: string; ja: string; zh: string }) => getT(tr, lang);
    return {
      titleTop: t(o.titleTop),
      titleStrong: t(o.titleStrong),
      titleRest: t(o.titleRest),
      orbLines: [t(o.orbLines[0]), t(o.orbLines[1])],
      primary: o.keywords.slice(0, 4).map(t),
      secondary: o.keywords.slice(4, 8).map(t),
    };
  }, [lang]);
  /** 한국어가 아니면 캡처(한국어) 판으로 바꾸지 않고 그 언어 판을 끝까지 남긴다(261013 검토 — 바뀌는 순간 영어 · 한국어가 겹쳐 보였다) */
  const keep = !still && text !== KO;

  /* 폰 화면 폭 → 판 배율(--cxv-s) · 판 높이(--cxv-h, 화면이 390:844 보다 조금 길다) — 리렌더 없이 DOM 에 직접 */
  useIsoLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) return undefined;
    const apply = (w: number, h: number) => {
      if (!w || !h) return;
      const s = w / 390;
      el.style.setProperty('--cxv-s', s.toFixed(5));
      el.style.setProperty('--cxv-h', `${(h / s).toFixed(2)}px`);
      el.setAttribute('data-ready', '');
    };
    apply(el.clientWidth, el.clientHeight);
    const ro = new ResizeObserver(([e]) => apply(e.contentRect.width, e.contentRect.height));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /* 화면 안에 있나(밖으로 나가면 조용히 처음으로 — 다시 들어오면 처음부터) · 반 넘게 보이나(시작 문턱) */
  useEffect(() => {
    if (still) return undefined;
    const el = rootRef.current;
    if (!el) return undefined;
    let io: IntersectionObserver | null = null;
    try {
      io = new IntersectionObserver(([e]) => {
        setVisible(e.isIntersecting);
        const r = e.isIntersecting ? e.intersectionRatio : 0;
        if (r >= NEAR_ON) setNear(true);
        else if (r < NEAR_OFF) setNear(false);
      }, { threshold: [0, NEAR_OFF, NEAR_ON] });
      io.observe(el);
    } catch {
      setVisible(true);
    }
    return () => io?.disconnect();
  }, [still]);

  /* 언마운트 — 세대를 올려 늦게 끝난 그림 준비(decoded) 뒤 단계가 타이머를 새로 걸지 못하게(261013 검토) */
  useEffect(() => () => {
    gen.current++;
    timers.current.forEach((x) => window.clearTimeout(x));
    timers.current = [];
    running.current = false;
    armed.current = true;
  }, []);

  /* 진행 — (화면 반 넘게 보임 또는 카드 맨 앞) + 화면 안일 때 한 번. 둘 다 꺼졌다 다시 오거나 화면 밖에 나갔다 오면 다시 */
  const want = active || near;
  useEffect(() => {
    const go = (p: Phase) => { phaseRef.current = p; setPhase(p); };
    const clear = () => { timers.current.forEach((x) => window.clearTimeout(x)); timers.current = []; };
    const after = (ms: number, fn: () => void) => { timers.current.push(window.setTimeout(fn, ms)); };
    if (still) {
      clear();
      gen.current++;
      running.current = false;
      setInv(null);
      go('rev');
      return;
    }
    if (!visible) {
      clear();
      gen.current++;
      running.current = false;
      armed.current = true;
      if (phaseRef.current !== 'idle') { setInv(null); go('idle'); }
      return;
    }
    if (!want) { armed.current = true; return; }
    if (!armed.current || running.current) return;
    armed.current = false;
    running.current = true;
    const g = ++gen.current;
    const start = () => {
      if (g !== gen.current) return;
      // 판을 붙이기 전에 역행렬을 구해 같은 그림에 함께 건다(판의 첫 폭 재기가 이 그림 안에서 일어난다)
      setInv(inverseOf(layerRef.current));
      setPlay((n) => n + 1);
      go('orb');
      after(ORB_MS, () => {
        void decoded(imgRef.current, after).then(() => {
          if (g !== gen.current) return;
          go('morph');
          // 닿자마자 굴러가기 — 띠와 판 층이 같이 움직여(판이 녹는 0.14초 동안도) 캡처와 어긋나지 않는다
          after(LAND_MS, () => {
            if (g !== gen.current) return;
            go('scroll');
            running.current = false;
          });
        });
      });
    };
    if (phaseRef.current === 'idle') start();
    else { go('out'); after(OUT_MS, start); }
  }, [want, visible, still]);

  /* 판의 첫 폭 재기(레이아웃 이펙트) · ResizeObserver 첫 알림(다음 프레임)이 지나면 역행렬을 푼다 */
  useEffect(() => {
    if (!inv) return undefined;
    let r2 = 0;
    const r1 = requestAnimationFrame(() => { r2 = requestAnimationFrame(() => setInv(null)); });
    return () => { cancelAnimationFrame(r1); cancelAnimationFrame(r2); };
  }, [inv, play]);

  const orbOn = !still && (phase === 'orb' || phase === 'morph' || (keep && (phase === 'scroll' || phase === 'out')));
  return (
    <div ref={rootRef} className="cxv" data-ph={phase} data-keep={keep ? '' : undefined}>
      <div className="cxv-stage">
        <div className="cxv-body">
          <div className="cxv-strip">
            {SLICES.map(([a, b], i) => (
              <div key={a} className={`cxv-sl cxv-sl-${i}`} style={{ top: a, height: b - a }}>
                <img ref={i === 0 ? imgRef : undefined} className="cxv-img" src={src} alt="" loading="lazy" decoding="async" draggable={false} style={{ top: -(HEAD + a) }} />
              </div>
            ))}
          </div>
          {!still && (
            <div ref={layerRef} className="cxv-orbl">
              <div className="cxv-orbbox" style={inv ? { transform: inv, visibility: 'hidden' } : undefined}>
                {/* 판의 첫 자리(기다리는 동안) — 점 셋은 판의 점과 같은 자리 · 같은 색이라 판이 붙어도 그대로, 회색 줄 · 옅은 원은 판이 들어오며 걷힌다 */}
                <div className="cxv-gh" aria-hidden>
                  <span className="cxv-gd cxv-gd1" />
                  <span className="cxv-gd cxv-gd2" />
                  <span className="cxv-gd cxv-gd3" />
                  <span className="cxv-gs cxv-gs1" />
                  <span className="cxv-gs cxv-gs2" />
                  <span className="cxv-gc" />
                </div>
                {orbOn && <KeywordOrb key={play} text={text} />}
              </div>
            </div>
          )}
        </div>
        <div className="cxv-head">
          <img className="cxv-img" src={src} alt="" loading="lazy" decoding="async" draggable={false} />
        </div>
      </div>
    </div>
  );
}

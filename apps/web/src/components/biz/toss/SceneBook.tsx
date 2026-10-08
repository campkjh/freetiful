'use client';

import { useEffect, useRef, useState } from 'react';
import { useT } from '@/lib/biz/i18n';
import { BOOK } from './content';
import { clamp01, ease, seg, useFrame, usePassProgress, useSceneProgress, prefersReducedMotion } from './scene';
import { bez, CheckoutSheet, CtaPill, DoneToast, MobileBook, PhoneShell, ScreenImg, type Reg } from './SceneBook.parts';

/*
 * ⑤ 예약 장면(토스 '쇼핑 결제' 장면 재구현, 261008).
 * 가운데 폰 + 눈금 그리기 → 시간 기반 갈라서기(폰 왼쪽 · 글 오른쪽, 위로 되감기 구간 있음) → 스크롤 스크럽:
 * 폰 0.85 로 내려앉기 · 사진 날아가기 · 시트 서서히 · 오른쪽 글 넘김 → 토글 · 밀어서 결제 · 점 3개 → 완료 화면 → 풀려나며 알림이 떠나감.
 * 기준 크기 1440x900(토스 실측) 무대를 화면에 맞춰 통째로 줄이고 늘린다. 모바일(<1024)은 토스 모바일처럼 카드 2장.
 */

/** 붙어 있는 거리(토스 실측 4752 - 900) */
const D = 3852;
const W0 = 1440, H0 = 900;

// 토스 실측 곡선(맞춘 cubic-bezier)
const cDim = bez(0.57, 0.01, 0, 0.61);
const cCta = bez(0, 0, 0.44, 1.06);
const cCheck = bez(0.76, -0.06, 0.06, 0.53);
const cTog = bez(0.53, 0.01, 0, 0.65);
const cSlide = bez(0.69, -0.05, 0.02, 0.57);
const cRelease = bez(0.3, 0, 0.2, 1);
const cFade = bez(0.59, 0, 0, 0.61);
const cPulse = bez(0.45, 0, 0.2, 1);
const outQuad = (x: number) => 1 - (1 - x) * (1 - x);

/* 토스 병 고정 좌표 곡선(풀림 진행률 q → 화면 px 이동, 1440x900 실측: (324,441) → (287,286)) */
const JAR_Q = [0, 0.058, 0.113, 0.224, 0.336, 0.447, 0.558, 0.669, 0.78, 0.891, 1];
const JAR_X = [0, 0, 13, 34, 48, 53, 50, 40, 22, -4, -37];
const JAR_Y = [0, 0, -11, -33, -53, -73, -91, -109, -125, -141, -155];
function jarDrift(q: number) {
  for (let i = 1; i < JAR_Q.length; i++) {
    if (q <= JAR_Q[i]) {
      const t = (q - JAR_Q[i - 1]) / (JAR_Q[i] - JAR_Q[i - 1]);
      return { dx: JAR_X[i - 1] + (JAR_X[i] - JAR_X[i - 1]) * t, dy: JAR_Y[i - 1] + (JAR_Y[i] - JAR_Y[i - 1]) * t };
    }
  }
  return { dx: JAR_X[JAR_X.length - 1], dy: JAR_Y[JAR_Y.length - 1] };
}

const EASE_SPLIT = 'cubic-bezier(0.28,1.05,0.59,0.99)';
const EASE_THUMB = 'cubic-bezier(0.38,1,0.78,0.97)';
const EASE_IN_QUAD = 'cubic-bezier(0.55,0.085,0.68,0.53)';

export default function SceneBook() {
  const t = useT();
  const rootRef = useRef<HTMLElement>(null);
  const els = useRef<Record<string, HTMLElement | null>>({});
  const reg: Reg = (k) => (el) => { els.current[k] = el; };
  const progress = useSceneProgress(rootRef);
  const release = usePassProgress(rootRef, ['end end', 'end start']);
  const [still, setStill] = useState(false);
  const st = useRef({ split: false, grid: false, last: -1, k: 1, still: false, item1H: 150, item2H: 150, rel: 0 });

  /* 갈라서기 — 750ms 시간 전환(토스 실측), 켜기/끄기 */
  const setSplit = (on: boolean, instant = false) => {
    const e = els.current;
    st.current.split = on;
    const dur = instant ? '0ms' : '750ms';
    if (e.pose) {
      e.pose.style.transition = `transform ${dur} ${EASE_SPLIT}`;
      e.pose.style.transform = on ? 'translate3d(0,0,0)' : 'translate3d(307px,-116px,0)';
    }
    if (e.colPose) {
      e.colPose.style.transition = `opacity ${dur} ${EASE_SPLIT}, transform ${dur} ${EASE_SPLIT}`;
      e.colPose.style.opacity = on ? '1' : '0';
      e.colPose.style.transform = on ? 'translate3d(0,0,0)' : 'translate3d(0,40px,0)';
      e.colPose.style.pointerEvents = on ? 'auto' : 'none';
    }
    ['thumbB', 'thumbC'].forEach((k, i) => {
      const el = e[k];
      if (!el) return;
      const delay = on && !instant ? (i === 0 ? 500 : 650) : 0;
      const d = instant ? 0 : on ? 690 : 400;
      el.style.transition = `opacity ${d}ms ${EASE_THUMB} ${delay}ms, transform ${d}ms ${EASE_THUMB} ${delay}ms`;
      el.style.opacity = on ? '1' : '0';
      el.style.transform = on ? 'translate3d(0,0,0)' : 'translate3d(0,60px,0)';
    });
  };

  /* 눈금 세로줄 그리기 — 위→아래, 780ms ease-in, 0/60/100ms 엇갈림 */
  const drawGrid = () => {
    st.current.grid = true;
    [0, 1, 2].forEach((i) => {
      const el = els.current[`g${i}`];
      if (!el) return;
      const delay = [0, 60, 100][i];
      el.style.transition = `transform 780ms ${EASE_IN_QUAD} ${delay}ms, opacity 780ms ${EASE_IN_QUAD} ${delay}ms`;
      el.style.transform = 'scaleY(1)';
      el.style.opacity = '1';
    });
  };

  /* 스크롤 진행률 → 스타일(리렌더 없음) */
  const apply = (rel: number) => {
    const e = els.current;
    const s = st.current;
    s.rel = rel;
    // 폰 내려앉기 · 글 올라가기(easeInOutCubic)
    const b = ease.inOut(seg(rel, 780, 1817));
    if (e.scrub) e.scrub.style.transform = `translate3d(0,${-136 * b}px,0) scale(${1 - 0.15 * b})`;
    if (e.colScrub) e.colScrub.style.transform = `translate3d(0,${-204.5 * b}px,0)`;
    if (e.line) {
      const sy = 1 + (s.item2H / s.item1H - 1) * b;
      e.line.style.transform = `translate3d(0,${337 * b}px,0) scaleY(${sy})`;
    }
    // 사진 날아가기(ease-in, -900)
    const th = ease.in(seg(rel, 798, 1847));
    if (e.flyB) e.flyB.style.transform = `translate3d(0,${-900 * th}px,0)`;
    if (e.flyC) e.flyC.style.transform = `translate3d(0,${-900 * th}px,0)`;
    // 단계 글 밝기
    const it = outQuad(seg(rel, 780, 1824));
    if (e.item0) e.item0.style.opacity = String(1 - 0.5 * it);
    if (e.item1) e.item1.style.opacity = String(0.3 + 0.7 * it);
    // 결제 화면 + 딤 · 시트(투명도만)
    const dm = cDim(seg(rel, 803, 1229));
    if (e.checkout) e.checkout.style.opacity = String(dm);
    if (e.dim) e.dim.style.opacity = String(dm);
    // CTA
    const ct = cCta(seg(rel, 1109, 1664));
    if (e.cta) { e.cta.style.opacity = String(ct); e.cta.style.visibility = rel > 854 ? 'visible' : 'hidden'; }
    // 체크 회색 → 파랑
    if (e.check) e.check.style.opacity = String(cCheck(seg(rel, 1120, 1836)));
    // 토글
    const tg = cTog(seg(rel, 1662, 2278));
    if (e.tog) e.tog.style.opacity = String(tg);
    if (e.togKnob) e.togKnob.style.transform = `translateX(${20 * tg}px)`;
    // 밀어서 결제 — 손잡이 5 → 214
    const sl = cSlide(seg(rel, 2003, 2695));
    const kx = 5 + 209 * sl;
    if (e.knob) e.knob.style.transform = `translateX(${kx}px)`;
    const lb = cSlide(seg(rel, 2064, 2704));
    if (e.label) { e.label.style.opacity = String(1 - lb); e.label.style.transform = `scale(${1 - 0.1 * lb})`; }
    // 눌림 → 풀림
    const pr = rel < 2504 ? cSlide(seg(rel, 2064, 2504)) : 1 - cRelease(seg(rel, 2504, 3154));
    if (e.slideBody) e.slideBody.style.transform = `scale(${1 - 0.082 * pr})`;
    if (e.slideOver) e.slideOver.style.opacity = String(0.82 * pr);
    // 손잡이 · 빛 사라지고 점 3개
    const fd = cFade(seg(rel, 2379, 3007));
    if (e.knob) e.knob.style.opacity = String(1 - fd);
    if (e.glow) { e.glow.style.opacity = String(1 - fd); e.glow.style.transform = `translateX(${kx}px)`; }
    if (e.dots) e.dots.style.opacity = String(fd);
    for (let i = 0; i < 3; i++) {
      const d = e[`dot${i}`];
      if (!d) continue;
      const a = 2379 + 100 * i, pk = 2704 + 100 * i, z = 3029 + 100 * i;
      const v = rel < pk ? cPulse(seg(rel, a, pk)) : 1 - cPulse(seg(rel, pk, z));
      d.style.opacity = String(0.2 + 0.8 * v);
      d.style.transform = `scale(${0.8 + 0.2 * v})`;
    }
    // 완료 화면(easeOutCubic) + 알림
    const pd = ease.out(seg(rel, 3324, 3854));
    if (e.paid) e.paid.style.opacity = String(pd);
    const ts = ease.out(seg(rel, 3460, 3854));
    if (e.toastIn) { e.toastIn.style.opacity = String(ts); e.toastIn.style.transform = `translate3d(0,${-18 * (1 - ts)}px,0) scale(${0.96 + 0.04 * ts})`; }
  };

  /* 풀려날 때 — 토스 병(jar)이 폰에서 튀어나와 다음 장면으로 떨어지는 자리: 알림이 화면에 거의 머문 채(토스 고정 좌표 곡선) 살짝 떠오르며
   * 기울고, 회색 다음 장면 위에서 사라진다. 글 · 폰은 토스처럼 문서와 1:1 로 올라간다(따로 움직이지 않음). */
  const applyRelease = (q: number) => {
    const e = els.current;
    const k = st.current.k;
    const vh = typeof window !== 'undefined' ? window.innerHeight : H0;
    if (e.toastOut) {
      const { dx, dy } = jarDrift(q);
      const u = 1 / (k * 0.85); // 화면 px → 폰 안쪽 px
      const tilt = ease.out(seg(q, 0.04, 0.6));
      e.toastOut.style.transform = `translate3d(${(dx * k * u).toFixed(2)}px,${((q * vh + dy * k * 0.45) * u).toFixed(2)}px,0) scale(${(1 + 0.06 * tilt).toFixed(4)}) rotate(${(-6 * tilt).toFixed(3)}deg)`;
      e.toastOut.style.opacity = String(1 - ease.in(seg(q, 0.6, 0.95)));
    }
  };

  // 줄인 움직임 · 크기 맞춤 · 단계 높이 재기
  useEffect(() => {
    const reduced = prefersReducedMotion();
    st.current.still = reduced;
    setStill(reduced);
    const fit = () => {
      const k = Math.max(0.6, Math.min(1.35, Math.min(window.innerWidth / W0, window.innerHeight / H0)));
      st.current.k = k;
      if (els.current.design) els.current.design.style.transform = `translate(-50%,-50%) scale(${k})`;
      [-500, 100, 500].forEach((x, i) => {
        const g = els.current[`gw${i}`];
        if (g) g.style.left = `calc(50% + ${x * k}px)`;
      });
      const i0 = els.current.item0, i1 = els.current.item1box;
      if (i0 && i0.offsetHeight) st.current.item1H = i0.offsetHeight;
      if (i1 && i1.offsetHeight) st.current.item2H = i1.offsetHeight - 15;
      if (els.current.line) els.current.line.style.height = `${st.current.item1H}px`;
      apply(st.current.rel);
    };
    fit();
    window.addEventListener('resize', fit);
    const fontsReady = (document as Document & { fonts?: { ready: Promise<unknown> } }).fonts?.ready;
    fontsReady?.then(fit).catch(() => {});
    if (reduced) {
      setSplit(true, true);
      drawGrid();
      apply(D + 10);
    }
    return () => window.removeEventListener('resize', fit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useFrame(progress, (p) => {
    const s = st.current;
    if (s.still) return;
    const rel = p * D;
    const prev = s.last;
    const down = prev < 0 ? true : rel >= prev;
    s.last = rel;
    // 눈금은 S+10 에서 한 번
    if (!s.grid && rel > 10) drawGrid();
    // 갈라서기: 내려가며 S+72 넘으면 켜기, 올라가며 S+616 아래면 되감기, 그 위는 늘 켜짐
    if (prev < 0) {
      if (rel > 72) setSplit(true, true);
    } else if (rel > 616) {
      if (!s.split) setSplit(true);
    } else if (down && rel > 72 && rel !== prev) {
      if (!s.split) setSplit(true);
    } else if (!down && s.split) {
      setSplit(false);
    }
    apply(rel);
  });
  useFrame(release, (q) => { if (!st.current.still) applyRelease(clamp01(q)); });

  return (
    // lg 이상: 앞 현장 장면의 마지막 100vh 에 겹쳐 놓는다(토스 다음 장면 = 앞 장면 붙음 끝 S0+3600 에서 시작). 앞 장면이 위층(z 2)이라
    // 그 무대가 p=1 에서 숨을 때 이 장면의 같은 자리 폰이 드러난다. z 1 = 풀릴 때 알림이 다음 장면(행사 성격) 위로 넘어가도 보이게
    <section ref={rootRef} id="dock-book" data-no-natural-reveal className="relative z-[1] bg-white lg:-mt-[100vh]" style={still ? { marginTop: 0 } : undefined}>
      {/* 데스크톱 ≥1024 — 붙는 무대 */}
      <div className="hidden lg:block" style={{ height: still ? '100vh' : `calc(100vh + ${D}px)` }}>
        {/* 가로만 자른다(사진 C 는 왼쪽 화면 밖) — 세로는 열어 둬 풀릴 때 알림이 무대 아래로 넘어가도 잘리지 않게 */}
        <div className="sticky top-0 h-screen bg-white" style={{ overflowX: 'clip', overflowY: 'visible' }}>
          {/* 눈금 세로줄 x = 50% -500 / +100 / +500 (1440 기준 220 · 820 · 1220) */}
          <div className="pointer-events-none absolute inset-0" style={{ opacity: 0.8 }} aria-hidden>
            {[-500, 100, 500].map((x, i) => (
              <div key={i} ref={reg(`gw${i}`)} className="absolute bottom-0 top-0" style={{ left: `calc(50% + ${x}px)`, width: 1 }}>
                <div ref={reg(`g${i}`)} className="h-full w-full" style={{ background: 'rgba(0,27,55,0.1)', transformOrigin: '50% 0', transform: 'scaleY(0)', opacity: 0 }} />
              </div>
            ))}
          </div>

          {/* 1440x900 기준 무대 */}
          <div ref={reg('design')} className="absolute left-1/2 top-1/2" style={{ width: W0, height: H0, transform: 'translate(-50%,-50%)', transformOrigin: '50% 50%' }}>
            {/* 폰(갈라서기 자세) */}
            <div ref={reg('pose')} className="absolute" style={{ left: 238, top: 205, width: 350, height: 762, transform: 'translate3d(307px,-116px,0)', willChange: 'transform' }}>
              <div ref={reg('scrub')} className="absolute inset-0" style={{ transformOrigin: '175px 381px', willChange: 'transform' }}>
                {/* 사진 C — 폰 뒤, 왼쪽 화면 밖으로 잘림 */}
                <div ref={reg('flyC')} className="absolute" style={{ top: '20%', left: '-100%', width: 200, height: 238, zIndex: 0 }}>
                  <Thumb innerRef={reg('thumbC')} src={BOOK.thumbs[1]} />
                </div>
                <PhoneShell style={{ zIndex: 5 }}>
                  <ScreenImg src={BOOK.screens.profile} />
                  <div ref={reg('checkout')} className="absolute inset-0" style={{ opacity: 0 }}>
                    <ScreenImg src={BOOK.screens.checkout} />
                  </div>
                  <CheckoutSheet reg={reg} />
                  <div ref={reg('paid')} className="absolute inset-0" style={{ opacity: 0 }}>
                    <ScreenImg src={BOOK.screens.paid} />
                  </div>
                </PhoneShell>
                {/* 완료 알림 — 화면 밖 층(풀려날 때 폰을 벗어나 떠나감) */}
                <div ref={reg('toastOut')} className="absolute" style={{ left: 28, top: 70, width: 294, zIndex: 20, willChange: 'transform' }}>
                  <div ref={reg('toastIn')} style={{ opacity: 0 }}>
                    <DoneToast />
                  </div>
                </div>
                {/* 사진 B — 폰 위 왼쪽 위 모서리에 겹침 */}
                <div ref={reg('flyB')} className="absolute" style={{ top: '-15%', left: '-30%', width: 200, height: 238, zIndex: 10 }}>
                  <Thumb innerRef={reg('thumbB')} src={BOOK.thumbs[0]} />
                </div>
              </div>
            </div>

            {/* 오른쪽 글 — 50% + 128 에서 360 폭 */}
            <div ref={reg('colOut')} className="absolute" style={{ left: 848, top: 273.4, width: 360 }}>
              <div ref={reg('colPose')} style={{ opacity: 0, transform: 'translate3d(0,40px,0)' }}>
                <div ref={reg('colScrub')} className="relative" style={{ willChange: 'transform' }}>
                  {/* 진행 선 — 글 왼쪽 28.5px, 위 기준으로 늘어남 */}
                  <div ref={reg('line')} className="absolute" style={{ left: -28.5, top: 0, width: 1, height: 150, transformOrigin: '50% 0', background: 'linear-gradient(to bottom, rgba(120,144,177,0) 0%, #7890B1 40%, #333D4B 100%)', willChange: 'transform' }} />
                  <StepItem innerRef={reg('item0')} title={[t(BOOK.steps[0].title[0]), t(BOOK.steps[0].title[1])]} desc={t(BOOK.steps[0].desc)} opacity={1} />
                  <div ref={reg('item1box')} className="absolute left-0 w-full" style={{ top: 337 }}>
                    <StepItem innerRef={reg('item1')} title={[t(BOOK.steps[1].title[0]), t(BOOK.steps[1].title[1])]} desc={t(BOOK.steps[1].desc)} opacity={0.3} />
                    <div style={{ marginTop: 28 }}>
                      <CtaPill innerRef={reg('cta')} style={{ opacity: 0, visibility: 'hidden' }} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 모바일 · 태블릿 <1024 — 카드 2장 */}
      <div className="lg:hidden">
        <MobileBook />
      </div>
    </section>
  );
}

function StepItem({ title, desc, opacity, innerRef }: { title: [string, string]; desc: string; opacity: number; innerRef: (el: HTMLElement | null) => void }) {
  return (
    <div ref={innerRef} style={{ opacity }}>
      <h3 style={{ fontSize: 24, fontWeight: 700, lineHeight: '33.6px', letterSpacing: -0.48, color: 'rgba(26,31,41,0.89)' }}>
        {title[0]}
        <br />
        {title[1]}
      </h3>
      <p style={{ marginTop: 3.4, fontSize: 16, fontWeight: 400, lineHeight: '25.6px', letterSpacing: -0.32, color: 'rgb(114,119,128)', wordBreak: 'keep-all' }}>{desc}</p>
    </div>
  );
}

/** 떠 있는 사진 — 200x238 r33, 등장은 setSplit 이 시간 전환으로 */
function Thumb({ src, innerRef }: { src: string; innerRef: (el: HTMLElement | null) => void }) {
  return (
    <div ref={innerRef} className="h-full w-full overflow-hidden" style={{ borderRadius: 33, background: '#eceef0', opacity: 0, transform: 'translate3d(0,60px,0)' }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" loading="lazy" decoding="async" draggable={false} className="h-full w-full select-none object-cover" />
    </div>
  );
}

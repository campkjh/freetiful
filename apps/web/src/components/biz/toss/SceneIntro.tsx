'use client';

import { useEffect, useId, useRef, useState, type CSSProperties, type RefObject } from 'react';
import { motion, type MotionValue } from 'framer-motion';
import { useBizLang, useT } from '@/lib/biz/i18n';
import { HERO_TALL_MQ, INTRO, heroMedia } from './content';
import { clamp01, ease, prefersReducedMotion, seg, useFrame, useSceneProgress } from './scene';
import {
  BoardListCard, CHAT_STEPS, ChatScreen, FLAT_BAND_SHADOW, FloorShadow, HOST_SCREENS, HostPopCards, HostScreenLayers, PHONE_BEZEL, PHONE_FRAME, PHONE_RIM_BG,
  Particles, PhoneIsland, PillCta, SI_CSS, TiltPhone, attachTrimLoop, boardListH, useIsoLayoutEffect, useTrimLoop,
} from './SceneIntro.parts';

/*
 * ① 첫 장면(261008 사장 '토스 홈페이지 완전 똑같이') — 토스 홈 첫 세 장면(영상 카드 → 송금 → 자산)의 움직임을 우리 소재로 다시 짰다.
 *  데스크톱(≥1024): 한 덩어리 1085vh. 영상 무대(0–840vh, 0–740vh 고정) 위에서
 *    0–200vh   여백 있는 둥근 영상 카드 → 꽉 찬 화면(easeOutQuart, 카드 폭 · 높이 · 모서리)
 *    190vh~    큰 제목 퇴장 · 영상이 다가가며 어두워지고 흐려짐 · 기울어진 폰이 올라와 채팅이 한 줄씩
 *    547.5–619 영상이 둥근 카드로 줄어듦(clip-path) — 밑에 깔린 진행자 무대의 같은 폰이 카드 밖으로 보인다
 *    619–740   카드 창이 위로 빠지며(안쪽은 반대로 밀어 제자리) 폰 화면이 채팅 → 진행자 목록으로 닦이듯 바뀜
 *  진행자 무대(547.5–1085vh, 547.5–985vh 고정): 왼쪽 제목 + 스크롤 아코디언 4칸, 오른쪽 기울어진 폰 · 빛 번짐 · 떠다니는 점 · 바닥 그림자 · 칩.
 *  모바일 · 태블릿 · 줄인 움직임: 토스 모바일처럼 고정 장면 없이 세로로 쌓고 시간 기반 등장만.
 *  치수 · 시간 · 곡선은 토스 실측(1440×900)을 vh 로 옮긴 값. 토스의 코드 · 그림 · 영상 · 글꼴은 쓰지 않았다.
 */

/* ─── 데스크톱 장면 상수(토스 1440×900 실측 → vh) ─── */
const ROOT_VH = 1085; // 장면 전체(토스 9765px)
const MEDIA_VH = 840; // 영상 무대 부모(0–7560)
const HERO_VH = 200; // 카드 → 꽉 찬 화면(0–1800)
const T0 = 190; // 송금 장면 시작(1710)
const TLEN = 550; // 송금 진행률 분모(4950)
const ASSET_TOP = 547.5; // 진행자 무대 시작(4927.5) = 카드 줄기 시작
const ASSET_VH = 537.5;
const HOSTS_ANCHOR = 700; // 왼쪽 눈금 '진행자' 기준점(토스 #assets 6300)
const REVEAL_VH = 740; // 제목 · 목록 등장(6660)
const REVEAL_OFF_VH = 738; // 위로 돌아가면 초기화(6642)
const ACC0 = 779.9; // 첫 칸 열림(7019)
const BAND = 51.2; // 칸마다 461px
const TEXT_AT = [0.35, 0.43, 0.56]; // 송금 글 세 줄 등장(진행률)
// 채팅 단계(CHAT_STEPS 10개) — 261009 일정 주고받기 대화로 말풍선이 7개가 되어 폰이 자리 잡은 뒤(0.28)부터 카드가 줄기 전(0.65)까지 고르게 나눴다
const CHAT_AT = [0.28, 0.31, 0.34, 0.375, 0.41, 0.445, 0.485, 0.515, 0.55, 0.59];
const DARK_END = ASSET_TOP + 50; // 고정 흰 눈금 표식 끝(화면 가운데 기준) — 이후는 카드 실제 위치로 판단(dockOverRef)
const CHIP_FOR = [0, 0, 1, 2]; // 열린 칸 → 강조할 칩
const TEXT_LEFT_ART = 553.2; // 송금 글 왼쪽(판 좌표, 1440 에서 357px)
const TEXT_RIGHT_ART = 1110; // 폰 왼쪽 끝 근처(판 좌표)

type Mode = 'ssr' | 'desk' | 'stack';
/** 데스크톱 장면은 가로 1024 이상 · 가로로 넓은 화면(세로로 긴 태블릿은 쌓는 판)에서만 */
const DESK_MQ = '(min-width: 1024px) and (min-aspect-ratio: 6/5) and (prefers-reduced-motion: no-preference)';

function useMode(): Mode {
  const [m, setM] = useState<Mode>('ssr');
  useEffect(() => {
    let mq: MediaQueryList | null = null;
    try {
      mq = window.matchMedia(DESK_MQ);
    } catch {
      setM('stack');
      return undefined;
    }
    const on = () => setM(mq && mq.matches ? 'desk' : 'stack');
    on();
    mq.addEventListener?.('change', on);
    return () => mq?.removeEventListener?.('change', on);
  }, []);
  return m;
}

/** 지난번에 쓴 값과 다를 때만 스타일을 쓴다(스크롤 프레임마다 불림) */
const lastStyle = new WeakMap<HTMLElement, Record<string, string>>();
function put(el: HTMLElement | null | undefined, prop: string, v: string) {
  if (!el) return;
  let c = lastStyle.get(el);
  if (!c) {
    c = {};
    lastStyle.set(el, c);
  }
  if (c[prop] === v) return;
  c[prop] = v;
  el.style.setProperty(prop, v);
}

type Geo = { vw: number; vh: number; s: number; tx: number; ty: number; k: number };

/** 왼쪽 눈금 막대들이 차지하는 화면 사각형(고정 위치라 크기 바뀔 때만 잰다) */
type Box = { l: number; t: number; r: number; b: number };
function measureDock(): Box | null {
  const bars = Array.from(document.querySelectorAll<HTMLElement>('.tc-dock-bar'));
  const els = bars.length ? bars : Array.from(document.querySelectorAll<HTMLElement>('.tc-dock'));
  let box: Box | null = null;
  els.forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return;
    box = box ? { l: Math.min(box.l, r.left), t: Math.min(box.t, r.top), r: Math.max(box.r, r.right), b: Math.max(box.b, r.bottom) } : { l: r.left, t: r.top, r: r.right, b: r.bottom };
  });
  return box;
}
/** 1920×1080 디자인 판을 화면에 cover 로 맞춘 값(가로 65% 기준) — 토스 무대와 같은 좌표계 */
function useGeo(stageRef: RefObject<HTMLElement>, onChange: (g: Geo) => void) {
  const geo = useRef<Geo>({ vw: 1440, vh: 900, s: 900 / 1080, tx: -104, ty: 0, k: 1 });
  const cb = useRef(onChange);
  cb.current = onChange;
  useIsoLayoutEffect(() => {
    const on = () => {
      const vw = stageRef.current?.clientWidth || window.innerWidth;
      const vh = window.innerHeight;
      const s = Math.max(vh / 1080, vw / 1920);
      // 글자 배율: 1440 이상에서 폭 따라 키우고(1920 에서 4/3), 세로가 800 보다 낮으면 줄인다
      const k = Math.min(4 / 3, Math.max(1, vw / 1440)) * Math.min(1, vh / 800);
      const g = { vw, vh, s, tx: (vw - 1920 * s) * 0.65, ty: (vh - 1080 * s) * 0.5, k };
      geo.current = g;
      cb.current(g);
    };
    on();
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  return geo;
}

/** 여러 줄(또는 단어)이 칸을 넘으면 글자 크기를 줄인다 — 줄마다 inline-block 인 [data-fit] 을 잰다 */
function fitFont(box: HTMLElement | null, base: number, mode: 'row' | 'lines', gapEm = 1.2, lh = 1.2) {
  if (!box) return;
  box.style.fontSize = `${base}px`;
  box.style.lineHeight = `${base * lh}px`;
  const parts = Array.from(box.querySelectorAll<HTMLElement>('[data-fit]'));
  if (!parts.length) return;
  const cs = getComputedStyle(box);
  const avail = box.clientWidth - parseFloat(cs.paddingLeft || '0') - parseFloat(cs.paddingRight || '0');
  if (avail <= 0) return;
  let f = base;
  if (mode === 'row') {
    const sum = parts.reduce((a, p) => a + p.getBoundingClientRect().width, 0);
    f = Math.min(base, avail / (sum / base + gapEm));
  } else {
    const widest = Math.max(...parts.map((p) => p.getBoundingClientRect().width));
    if (widest > avail) f = (base * avail) / widest;
  }
  f = Math.floor(f * 10) / 10;
  box.style.fontSize = `${f}px`;
  box.style.lineHeight = `${f * lh}px`;
}

export default function SceneIntro() {
  const mode = useMode();
  return (
    <section id="dock-intro" data-no-natural-reveal className="si-root relative isolate w-full bg-white">
      <style dangerouslySetInnerHTML={{ __html: SI_CSS }} />
      {mode !== 'stack' && <IntroDesk className={mode === 'ssr' ? 'si-desk' : ''} active={mode === 'desk'} ids />}
      {mode !== 'desk' && <IntroStack className={mode === 'ssr' ? 'si-stack' : ''} active={mode === 'stack'} ids={mode === 'stack'} />}
    </section>
  );
}

/* ═══════════════════════ 데스크톱 ═══════════════════════ */

function IntroDesk({ className, active, ids }: { className: string; active: boolean; ids: boolean }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const P = useSceneProgress(rootRef);
  return (
    <div ref={rootRef} className={`relative ${className}`} style={{ height: `${ROOT_VH}vh`, '--k': 1 } as CSSProperties}>
      <MediaStage P={P} active={active} ids={ids} rootRef={rootRef} />
      <AssetStage P={P} active={active} ids={ids} rootRef={rootRef} />
    </div>
  );
}

/* ─── 영상 무대: 첫 화면 카드 → 송금(채팅) → 카드로 줄고 창이 올라감 ─── */
function MediaStage({ P, active, ids, rootRef }: { P: MotionValue<number>; active: boolean; ids: boolean; rootRef: RefObject<HTMLDivElement> }) {
  const t = useT();
  const { lang } = useBizLang();
  const stageRef = useRef<HTMLDivElement>(null);
  const winRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef<HTMLDivElement>(null);
  const dimRef = useRef<HTMLDivElement>(null);
  const vidRef = useRef<HTMLVideoElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const artRef = useRef<HTMLDivElement>(null);
  const riseRef = useRef<HTMLDivElement>(null);
  const headRef = useRef<HTMLHeadingElement>(null);
  const dockOverRef = useRef<HTMLDivElement>(null);
  const dockBox = useRef<Box | null | undefined>(undefined); // undefined = 아직 안 잼
  const state = useRef({ gone: false, txt: [false, false, false], playing: false });
  useTrimLoop(vidRef);

  const update = (p: number) => {
    if (!active) return;
    const { vw, vh } = geo.current;
    const y = p * (ROOT_VH - 100);
    // ① 첫 화면 카드: 여백 16/64/16/24 · 모서리 40 → 0 (easeOutQuart)
    const hp = ease.outQuart(clamp01(y / HERO_VH));
    const k = 1 - hp;
    const L = 16 * k;
    const T = 64 * k;
    put(cardRef.current, 'transform', `translate3d(${L.toFixed(2)}px, ${T.toFixed(2)}px, 0)`);
    put(cardRef.current, 'width', `${(vw - 32 * k).toFixed(2)}px`);
    put(cardRef.current, 'height', `${(vh - 88 * k).toFixed(2)}px`);
    put(cardRef.current, 'border-radius', `${(40 * k).toFixed(2)}px`);
    // ② 송금 장면 진행률
    const tp = (y - T0) / TLEN;
    const push = ease.inOut(seg(tp, 0, 0.6));
    const dk = ease.out(seg(tp, 0, 0.3));
    put(zoomRef.current, 'transform', `scale(${((1.2 - 0.2 * hp) * (1 + 0.14 * push)).toFixed(4)})`);
    // 어둡게 0.55 — 261009 corporate-mc 히어로 영상(밝은 LED 무대 · 흰 연단)으로 바뀌며 0.4 로는 흰 글 뒤 대비가 3.5:1 까지 떨어졌다
    // (옛 송년회 영상 ≈ 6:1 · 0.5 는 설명 글 뒤 4.2:1 — 1440 캡처 실측)
    put(dimRef.current, 'opacity', (0.55 * dk).toFixed(3));
    put(vidRef.current, 'filter', dk > 0.002 ? `blur(${(14 * dk).toFixed(2)}px)` : 'none');
    // 폰이 아래에서 올라와 자리 잡음
    const rp = seg(tp, 0.03, 0.3);
    const re = ease.out(rp);
    put(riseRef.current, 'transform', `translate3d(0, ${((1 - re) * 820).toFixed(1)}px, 0) rotate(${((1 - re) * -7).toFixed(2)}deg)`);
    put(riseRef.current, 'opacity', clamp01(rp * 5).toFixed(3));
    // ③ 둥근 카드로 줄기(clip-path, easeOutQuart)
    const cp = ease.outQuart(seg(tp, 0.65, 0.78));
    const iy = vh * (148 / 900) * cp;
    const ix = vw * (160 / 1440) * cp;
    put(winRef.current, 'clip-path', cp > 0 ? `inset(${iy.toFixed(2)}px ${ix.toFixed(2)}px round ${(80 * (vh / 900) * cp).toFixed(2)}px)` : 'none');
    // ④ 카드 창이 위로(easeInQuart) — 안쪽은 반대로 밀어 제자리
    const sp = seg(tp, 0.78, 1);
    const lift = (vh - vh * (148 / 900)) * sp * sp * sp * sp;
    put(winRef.current, 'transform', `translate3d(0, ${(-lift).toFixed(2)}px, 0)`);
    put(contentRef.current, 'transform', `translate3d(0, ${lift.toFixed(2)}px, 0)`);
    // 왼쪽 눈금: 어두운 카드가 눈금 막대 위에 조금이라도 걸쳐 있으면 흰 눈금(카드가 실제로 빠질 때까지)
    if (dockBox.current === undefined) dockBox.current = measureDock();
    const db = dockBox.current;
    let over = false;
    if (db) {
      const sTop = Math.min(0, ((MEDIA_VH - y) * vh) / 100 - vh); // 고정 무대가 풀린 뒤 위로 밀린 만큼
      const cl = Math.max(L, ix);
      const cr = Math.min(L + vw - 32 * k, vw - ix);
      const ct = Math.max(T, iy) - lift + sTop;
      const cb = Math.min(T + vh - 88 * k, vh - iy) - lift + sTop;
      over = cl < db.r && cr > db.l && ct < db.b && cb > db.t;
    }
    put(dockOverRef.current, 'height', over ? '100%' : '0px');
    // 문턱(시간 기반 전환)
    const st = state.current;
    const gone = tp >= 0;
    if (gone !== st.gone) {
      st.gone = gone;
      headRef.current?.toggleAttribute('data-gone', gone);
    }
    const tts = textRef.current?.querySelectorAll<HTMLElement>('.si-tt');
    TEXT_AT.forEach((at, i) => {
      const on = tp >= at;
      if (on !== st.txt[i]) {
        st.txt[i] = on;
        tts?.[i]?.toggleAttribute('data-on', on);
      }
    });
    const play = y < REVEAL_VH;
    const v = vidRef.current;
    if (v && play !== st.playing) {
      st.playing = play;
      if (play) v.play().catch(() => {});
      else v.pause();
    }
  };

  const geo = useGeo(stageRef, (g) => {
    rootRef.current?.style.setProperty('--k', String(g.k));
    dockBox.current = measureDock();
    put(artRef.current, 'transform', `translate3d(${g.tx}px, ${g.ty}px, 0) scale(${g.s})`);
    put(textRef.current, 'left', `${(TEXT_LEFT_ART * g.s + g.tx).toFixed(1)}px`);
    put(textRef.current, 'max-width', `${((TEXT_RIGHT_ART - TEXT_LEFT_ART - 40) * g.s).toFixed(1)}px`);
    fitFont(headRef.current, 80 * g.k, 'row');
    fitFont(titleRef.current, 40 * g.k, 'lines', 0, 1.4);
    update(P.get());
  });

  useFrame(P, update);

  useEffect(() => {
    if (!active) return;
    const v = vidRef.current;
    if (v) v.preload = 'auto';
    state.current.playing = false;
    dockBox.current = measureDock();
    update(P.get());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  // 글꼴이 늦게 오거나 언어가 바뀌면 다시 맞춘다
  useIsoLayoutEffect(() => {
    if (!active) return undefined;
    const fit = () => {
      fitFont(headRef.current, 80 * geo.current.k, 'row');
      fitFont(titleRef.current, 40 * geo.current.k, 'lines', 0, 1.4);
    };
    fit();
    let alive = true;
    document.fonts?.ready.then(() => alive && fit()).catch(() => {});
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang, active]);

  const words = INTRO.heroWords.map((w) => t(w));
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0" style={{ height: `${MEDIA_VH}vh`, zIndex: 2 }}>
      {ids && <div id="dock-chat" className="absolute inset-x-0" style={{ top: `${T0}vh`, height: `${MEDIA_VH - T0}vh` }} aria-hidden="true" />}
      {/* 맨 위 64px(머리줄 자리)는 빼고 — 첫 화면 카드 위 흰 여백에서 머리줄이 흰 글자로 사라지지 않게(머리줄은 투명일 때만 이 표식을 본다) */}
      <div data-dock-theme="dark" className="absolute inset-x-0" style={{ top: 64, height: `calc(${DARK_END}vh - 64px)`, pointerEvents: 'auto' }} aria-hidden="true" />
      <div ref={stageRef} className="sticky top-0 h-screen w-full overflow-hidden">
        {/* 카드가 눈금 위에 있을 때만 높이를 준다(문서 순서상 위 고정 표식보다 안쪽이라 이게 이긴다) */}
        <div ref={dockOverRef} data-dock-theme="dark" className="absolute left-0 top-0 w-[160px]" style={{ height: 0 }} aria-hidden="true" />
        <div ref={winRef} className="absolute inset-0" style={{ willChange: 'transform' }}>
          <div ref={contentRef} className="absolute inset-0">
            {/* 영상 카드 */}
            <div
              ref={cardRef}
              className="absolute left-0 top-0 overflow-hidden bg-[#1F232B]"
              style={{ width: 'calc(100% - 32px)', height: 'calc(100% - 88px)', transform: 'translate3d(16px, 64px, 0)', borderRadius: 40 }}
            >
              <div ref={zoomRef} className="absolute inset-0" style={{ transform: 'scale(1.2)' }}>
                <video
                  ref={vidRef}
                  className="absolute inset-0 h-full w-full object-cover"
                  // 261009 corporate-mc 히어로 영상 — 진행자가 가운데 · 오른쪽에 서 있는 구도(INTRO.heroPos)
                  style={{ objectPosition: INTRO.heroPos.desk }}
                  muted
                  loop
                  playsInline
                  autoPlay={active}
                  preload="none"
                  poster={INTRO.heroPoster}
                  aria-hidden="true"
                  tabIndex={-1}
                >
                  <source src={INTRO.heroVideo} type="video/mp4" />
                </video>
              </div>
              <div className="absolute inset-x-0 bottom-0" style={{ height: 270, opacity: 0.5, background: 'linear-gradient(to bottom, rgba(56,68,82,0), rgb(56,68,82))' }} />
              <div ref={dimRef} className="absolute inset-0 bg-[#090C12]" style={{ opacity: 0 }} />
            </div>
            {/* 송금 장면 글(채팅) */}
            <div ref={textRef} className="absolute top-0 z-[1] flex h-full flex-col justify-center" style={{ left: 357, gap: 'calc(24px * var(--k))' }}>
              <h3 ref={titleRef} className="break-keep font-bold text-white" style={{ fontSize: 'calc(40px * var(--k))', lineHeight: 1.4, letterSpacing: '-0.02em' }}>
                {INTRO.chatTitle.map((l, i) => (
                  <span key={i} className="si-tt block">
                    <span data-fit className="inline-block whitespace-nowrap">{t(l)}</span>
                  </span>
                ))}
              </h3>
              <p className="si-tt break-keep text-white" style={{ fontSize: 'calc(16px * var(--k))', lineHeight: 1.6, letterSpacing: '-0.02em' }}>
                {INTRO.chatDesc.map((l, i) => <span key={i} className="block">{t(l)}</span>)}
              </p>
            </div>
            {/* 디자인 판 — 채팅 폰(진행자 무대의 폰과 같은 자리 · 같은 기울기) */}
            <div ref={artRef} className="absolute left-0 top-0 z-[2] origin-top-left" style={{ width: 1920, height: 1080, transform: 'translate3d(-104px, 0, 0) scale(0.8333)' }}>
              <div ref={riseRef} className="absolute inset-0" style={{ opacity: 0, transformOrigin: '1300px 560px' }}>
                <ChatPhone P={P} active={active} />
              </div>
            </div>
          </div>
        </div>
        {/* 첫 화면 큰 제목 — 양 끝 맞춤 한 줄 */}
        <h2
          ref={headRef}
          className="si-hero-h absolute z-[3] flex justify-between font-bold text-white"
          style={{ left: 72, right: 72, bottom: 56, fontSize: 80, lineHeight: '96px', letterSpacing: 0, textShadow: '0 0 120px rgba(0,0,0,0.4)', wordBreak: 'keep-all' }}
          aria-label={words.join(' ')}
        >
          {words.map((w, i) => (
            <span key={i} data-fit className="si-hw" style={{ '--i': i, '--r': 2 - i } as CSSProperties} aria-hidden="true">
              {w}
            </span>
          ))}
        </h2>
      </div>
    </div>
  );
}

function ChatPhone({ P, active }: { P: MotionValue<number>; active: boolean }) {
  const [step, setStep] = useState(0);
  const cur = useRef(0);
  useFrame(P, (p) => {
    if (!active) return;
    const tp = (p * (ROOT_VH - 100) - T0) / TLEN;
    let n = 0;
    while (n < CHAT_AT.length && tp >= CHAT_AT[n]) n += 1;
    if (n !== cur.current) {
      cur.current = n;
      setStep(n);
    }
  });
  return <TiltPhone screen={<ChatScreen step={step} />} />;
}

/* ─── 진행자 무대: 제목 + 아코디언 · 기울어진 폰 ─── */
function AssetStage({ P, active, ids, rootRef }: { P: MotionValue<number>; active: boolean; ids: boolean; rootRef: RefObject<HTMLDivElement> }) {
  const t = useT();
  const { lang } = useBizLang();
  const stageRef = useRef<HTMLDivElement>(null);
  const artRef = useRef<HTMLDivElement>(null);
  const colRef = useRef<HTMLDivElement>(null);
  const chipsRef = useRef<HTMLDivElement>(null);
  const [n, setN] = useState(-1);
  const st = useRef({ n: -1, rev: false, pre: false });
  const uid = useId().replace(/:/g, '');

  const update = (p: number) => {
    if (!active) return;
    const y = p * (ROOT_VH - 100);
    const s = st.current;
    const rev = y >= REVEAL_VH ? true : y < REVEAL_OFF_VH ? false : s.rev;
    if (rev !== s.rev) {
      s.rev = rev;
      colRef.current?.toggleAttribute('data-rev', rev);
      chipsRef.current?.toggleAttribute('data-rev', rev);
    }
    const k = y < ACC0 ? -1 : Math.min(3, Math.floor((y - ACC0) / BAND));
    if (k !== s.n) {
      s.n = k;
      setN(k);
    }
    // 진행자 화면 캡처는 장면이 가까워지면 미리 받아 둔다
    if (!s.pre && y > 250) {
      s.pre = true;
      // 배정 보드 칸(src 없음)은 그림이 없고, AI 후기 칸은 튀어나오는 고해상도 조각(piece)도 같이
      HOST_SCREENS.flatMap((sc) => [sc.src, sc.piece]).forEach((src) => {
        if (!src) return;
        const im = new Image();
        im.decoding = 'async';
        im.src = src;
      });
    }
  };

  /** 칩이 화면 오른쪽 밖으로 나가면 안쪽으로 당긴다(좁은 데스크톱) */
  const clampChips = (g: Geo) => {
    const box = chipsRef.current;
    if (!box) return;
    Array.from(box.children).forEach((el, i) => {
      const c = el as HTMLElement;
      const base = Number(CHIP_POS[i].left);
      const right = (base + c.offsetWidth) * g.s + g.tx;
      const over = right - (g.vw - 20);
      c.style.left = `${over > 0 ? base - over / g.s : base}px`;
    });
  };
  const geo = useGeo(stageRef, (g) => {
    put(artRef.current, 'transform', `translate3d(${g.tx}px, ${g.ty}px, 0) scale(${g.s})`);
    clampChips(g);
  });
  useIsoLayoutEffect(() => {
    clampChips(geo.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);
  useFrame(P, update);
  useEffect(() => {
    if (active) update(P.get());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  /** 칸 제목 누르면 그 칸 구간 가운데로 스크롤 */
  const go = (i: number) => {
    const root = rootRef.current;
    if (!root) return;
    const top = root.getBoundingClientRect().top + window.scrollY + ((ACC0 + BAND * (i + 0.5)) * window.innerHeight) / 100;
    if (window.__bizLenis) window.__bizLenis.scrollTo(top, { lerp: 0.1 });
    else window.scrollTo({ top, behavior: 'smooth' });
  };

  const hl = n >= 0 ? CHIP_FOR[n] : -1;
  return (
    <div className="absolute inset-x-0" style={{ top: `${ASSET_TOP}vh`, height: `${ASSET_VH}vh`, zIndex: 0 }}>
      {ids && <div id="dock-hosts" className="pointer-events-none absolute inset-x-0 bottom-0" style={{ top: `${HOSTS_ANCHOR - ASSET_TOP}vh` }} aria-hidden="true" />}
      <div ref={stageRef} className="sticky top-0 h-screen w-full overflow-x-clip">
        <div ref={artRef} className="pointer-events-none absolute left-0 top-0 origin-top-left" style={{ width: 1920, height: 1080, transform: 'translate3d(-104px, 0, 0) scale(0.8333)' }}>
          {/* 빛 번짐(연보라 · 청회색) */}
          <div
            className="absolute"
            style={{
              left: 495.8,
              top: 511.4,
              width: 1489.4,
              height: 687.4,
              background:
                'radial-gradient(42% 37% at 45% 44%, rgba(219,225,236,1) 0%, rgba(224,229,238,0.96) 30%, rgba(231,234,242,0.84) 55%, rgba(243,245,249,0.48) 78%, rgba(255,255,255,0) 100%), radial-gradient(34% 34% at 72% 42%, rgba(228,231,242,0.9) 0%, rgba(255,255,255,0) 100%)',
            }}
          />
          <Particles style={{ left: 495.8, top: 511.4, width: 1489.4, height: 687.4 }} />
          <FloorShadow style={{ left: 893, top: 862 }} />
          <TiltPhone screen={<HostScreenLayers active={n} />} pop={<HostPopCards active={n} />} />
          {/* 떠 있는 칩 */}
          <div ref={chipsRef} className="absolute inset-0">
            {INTRO.chips.map((c, i) => (
              <div key={i} className="si-chipw absolute" style={{ ...CHIP_POS[i], '--i': i } as CSSProperties}>
                <div
                  className="si-chip flex h-[54px] items-center gap-[10px] whitespace-nowrap rounded-full pl-[10px] pr-[20px] backdrop-blur-[14px]"
                  style={{
                    '--i': i,
                    background: hl === i ? 'rgba(255,255,255,0.94)' : 'rgba(255,255,255,0.72)',
                    border: '1px solid rgba(255,255,255,0.9)',
                    boxShadow: hl === i ? '0 16px 40px -6px rgba(2,32,71,0.16), 0 2px 6px rgba(2,32,71,0.05)' : '0 10px 30px -8px rgba(2,32,71,0.10), 0 1px 3px rgba(2,32,71,0.04)',
                  } as CSSProperties}
                >
                  <span className="flex h-[34px] w-[34px] items-center justify-center rounded-full" style={{ background: hl === i ? '#3182F6' : '#E8F1FE', transform: hl === i ? 'scale(1.06)' : 'none' }}>
                    <ChipIcon i={i} on={hl === i} />
                  </span>
                  <span className="text-[19px] font-semibold tracking-[-0.3px]" style={{ color: hl === i ? '#191F28' : '#4E5968' }}>{t(c)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="relative z-[3] flex h-full w-1/2 items-center justify-end">
          <div ref={colRef} className="w-max max-w-[44vw]" style={{ minWidth: 'calc(384px * var(--k))' }}>
            <h2 className="font-bold text-[#1C1F25]" style={{ fontSize: 'calc(48px * var(--k))', lineHeight: 1.28, letterSpacing: '-0.02em' }}>
              {INTRO.listTitle.map((l, i) => (
                <span key={i} className="si-hl whitespace-nowrap" style={{ '--i': i } as CSSProperties}>{t(l)}</span>
              ))}
            </h2>
            <ul className="w-0 min-w-full" style={{ paddingTop: 'calc(56px * var(--k))' }}>
              {INTRO.listItems.map((it, i) => (
                <AccRow key={it.key} i={i} on={n === i} id={`si-acc-${uid}-${i}`} title={t(it.title)} desc={t(it.desc)} cta={t(it.cta)} href={it.href} onPick={() => go(i)} />
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

const CHIP_POS: CSSProperties[] = [
  { left: 1586, top: 270 },
  { left: 1560, top: 548 },
  { left: 1462, top: 832 },
];

function ChipIcon({ i, on }: { i: number; on: boolean }) {
  const c = on ? '#fff' : '#3182F6';
  if (i === 0) {
    return (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
        <path d="M5 9.3 7.7 12 13 6.4" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (i === 1) {
    return (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
        <path d="M3 4.6c0-.9.7-1.6 1.6-1.6h8.8c.9 0 1.6.7 1.6 1.6v6c0 .9-.7 1.6-1.6 1.6H8.2L5 14.8v-2.6h-.4c-.9 0-1.6-.7-1.6-1.6Z" stroke={c} strokeWidth="1.6" strokeLinejoin="round" />
        <path d="M6.2 6.6h5.6M6.2 9h3.4" stroke={c} strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    );
  }
  // 셋째 칩 '사회자 배정 완료'(261009, 예전 '견적서 도착' 문서 그림) — 달력 + 체크
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <rect x="2.8" y="3.8" width="12.4" height="11.4" rx="2.4" stroke={c} strokeWidth="1.6" />
      <path d="M3.2 7.4h11.6M6.2 2.2v2.8M11.8 2.2v2.8" stroke={c} strokeWidth="1.6" strokeLinecap="round" />
      <path d="m6.6 11.1 1.7 1.6 3.2-3.2" stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function AccRow({ i, on, id, title, desc, cta, href, onPick }: { i: number; on: boolean; id: string; title: string; desc: string; cta: string; href: string; onPick: () => void }) {
  const seen = useRef(false);
  const first = !seen.current;
  if (on) seen.current = true;
  return (
    <li className="si-row border-t border-[#E8EBF0] last:border-b" style={{ '--i': i } as CSSProperties} data-on={on ? '' : undefined}>
      <button
        type="button"
        className="si-acc-t block w-full text-left font-bold focus-visible:outline-none focus-visible:underline"
        style={{ fontSize: 'calc(20px * var(--k))', lineHeight: 1.48, letterSpacing: '-0.02em' }}
        aria-expanded={on}
        aria-controls={id}
        onClick={onPick}
      >
        {title}
      </button>
      <motion.div
        id={id}
        initial={false}
        animate={{ height: on ? 'auto' : 0, opacity: on ? 1 : first ? 0.2 : 1 }}
        transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="overflow-hidden"
        aria-hidden={!on}
      >
        {/* 접힌 칸 안 단추는 탭 이동에서 빠지게(접히는 0.5초 동안은 보이게 둔다) */}
        <div style={{ visibility: on ? 'visible' : 'hidden', transition: on ? 'visibility 0s' : 'visibility 0s linear .5s' }}>
          <p className="break-keep text-[#727780]" style={{ fontSize: 'calc(16px * var(--k))', lineHeight: 1.6, letterSpacing: '-0.02em' }}>{desc}</p>
          <div style={{ paddingTop: 'calc(24px * var(--k))', paddingBottom: 'calc(20px * var(--k))' }}>
            <PillCta label={cta} href={href} />
          </div>
        </div>
      </motion.div>
    </li>
  );
}

/* ═══════════════════════ 모바일 · 태블릿 · 줄인 움직임 ═══════════════════════ */

function IntroStack({ className, active, ids }: { className: string; active: boolean; ids: boolean }) {
  const heroSlot = useRef<HTMLDivElement>(null);
  const cardSlot = useRef<HTMLDivElement>(null);
  useSharedLoopVideo(active, heroSlot, cardSlot);
  return (
    <div className={className}>
      <MobileHero active={active} slotRef={heroSlot} />
      <MobileTransfer active={active} ids={ids} slotRef={cardSlot} />
      <MobileHosts active={active} ids={ids} />
    </div>
  );
}

/**
 * 첫 화면 · 섭외 카드 영상은 같은 파일 — <video> 를 하나만 만들어 더 많이 보이는 칸으로 옮겨 단다.
 * 받기 한 번(캐시 꺼도), 보이는 칸에서만 재생 · 둘 다 안 보이면 멈춤. 빈 칸은 [data-vslot] 포스터 그림이 받친다.
 * 옮겨 달 때 칸의 포스터 그림 class · style 을 그대로 입힌다. 줄인 움직임이면 영상 없이 포스터만.
 */
function useSharedLoopVideo(active: boolean, a: RefObject<HTMLDivElement>, b: RefObject<HTMLDivElement>) {
  useEffect(() => {
    if (!active || prefersReducedMotion()) return undefined;
    const slots = [a.current, b.current];
    if (!slots[0] || !slots[1]) return undefined;
    const els = slots as HTMLDivElement[];
    const v = document.createElement('video');
    v.muted = true;
    v.defaultMuted = true;
    v.loop = true;
    v.playsInline = true;
    v.setAttribute('playsinline', '');
    v.setAttribute('aria-hidden', 'true');
    v.tabIndex = -1;
    v.preload = 'none';
    // 폰 세로면 세로 편집본(진행자를 따라 자른 것), 아니면 가로 영상 — 포스터 칸(<picture>)과 같은 기준(HERO_TALL_MQ · 261009)
    const pick = () => {
      const m = heroMedia();
      v.poster = m.poster;
      if (v.getAttribute('src') !== m.video) v.src = m.video;
    };
    pick();
    // 폰을 돌리면(세로 ↔ 가로) 그 화면용 영상으로 갈아 끼운다 — 보던 시각에서 이어서
    let tallMq: MediaQueryList | null = null;
    try {
      tallMq = window.matchMedia(HERO_TALL_MQ);
    } catch { /* matchMedia 없음 — 처음 고른 영상 그대로 */ }
    const onTall = () => {
      const at = v.currentTime;
      const playing = !v.paused;
      pick();
      if (at > 0) v.currentTime = at;
      if (playing) v.play().catch(() => {});
    };
    tallMq?.addEventListener?.('change', onTall);
    const untrim = attachTrimLoop(v);
    const area = [0, 0];
    let owner = -1;
    const place = () => {
      // 지금 칸이 보이면 다른 칸이 15% 넘게 더 보일 때만 옮긴다(경계에서 왔다 갔다 방지)
      let best = owner >= 0 && area[owner] > 0 ? owner : -1;
      area.forEach((x, i) => {
        if (x > 0 && (best < 0 || x > area[best] * 1.15)) best = i;
      });
      if (best < 0) {
        if (!v.paused) v.pause();
        return;
      }
      if (best !== owner) {
        owner = best;
        const tpl = els[best].querySelector<HTMLElement>('[data-vslot]');
        v.className = tpl?.className || 'absolute inset-0 h-full w-full object-cover si-hpos';
        v.style.cssText = tpl?.style.cssText || '';
        // 포스터 그림은 <picture> 안 — 영상은 그 <picture> 뒤에 단다(picture 안엔 source · img 만)
        const anchor = tpl?.parentElement?.tagName === 'PICTURE' ? tpl.parentElement : tpl;
        if (anchor) anchor.after(v);
        else els[best].prepend(v);
      }
      if (v.preload !== 'auto') v.preload = 'auto';
      if (v.paused) v.play().catch(() => {});
    };
    const io = new IntersectionObserver((es) => {
      es.forEach((e) => {
        const i = els.indexOf(e.target as HTMLDivElement);
        if (i >= 0) area[i] = e.isIntersecting ? e.intersectionRect.width * e.intersectionRect.height : 0;
      });
      place();
    }, { threshold: Array.from({ length: 21 }, (_, i) => i / 20) });
    els.forEach((el) => io.observe(el));
    return () => {
      io.disconnect();
      tallMq?.removeEventListener?.('change', onTall);
      untrim();
      v.pause();
      v.removeAttribute('src');
      v.load();
      v.remove();
    };
  }, [active, a, b]);
}

/**
 * 영상 칸 밑 포스터(영상이 다른 칸에 가 있거나 아직 안 왔을 때 보임).
 * 폰 세로(HERO_TALL_MQ)는 세로 편집본 첫 장면, 그 밖은 가로 포스터 — <picture> 가 서버 그림부터 화면에 맞게 고른다(하이드레이션 뒤 바뀌지 않음 · 261009).
 * 구도는 class si-hpos(SI_CSS — 화면에 따라 heroPos.tall / mob) — 영상이 이 칸으로 옮겨 올 때 이 class · style 을 그대로 입어 포스터 ↔ 영상이 같은 자리.
 */
function PosterSlot({ className, style, lazy }: { className: string; style?: CSSProperties; lazy?: boolean }) {
  return (
    <picture>
      <source media={HERO_TALL_MQ} srcSet={INTRO.heroPosterTall} />
      {/* eslint-disable-next-line @next/next/no-img-element -- public 정적 포스터, 영상과 같은 칸 맞춤 */}
      <img data-vslot src={INTRO.heroPoster} alt="" aria-hidden="true" draggable={false} decoding="async" loading={lazy ? 'lazy' : undefined} className={`${className} si-hpos`} style={style} />
    </picture>
  );
}

/** 첫 화면 — 둥근 영상 카드, 18px 넘게 내리면 꽉 찬 화면으로(시간 기반, 위로 돌아오면 되돌림) */
function MobileHero({ active, slotRef }: { active: boolean; slotRef: RefObject<HTMLDivElement> }) {
  const t = useT();
  const { lang } = useBizLang();
  const ref = useRef<HTMLDivElement>(null);
  const hRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (!active) return undefined;
    const el = ref.current;
    if (!el) return undefined;
    const reduced = prefersReducedMotion();
    let x = false;
    const on = () => {
      const nx = !reduced && window.scrollY >= 18;
      if (nx !== x) {
        x = nx;
        el.toggleAttribute('data-x', nx);
      }
    };
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, [active]);
  useIsoLayoutEffect(() => {
    if (!active) return undefined;
    const fit = () => {
      const w = window.innerWidth;
      fitFont(hRef.current, w >= 1024 ? 72 : w >= 768 ? 56 : 40, 'lines', 0, 1.28);
    };
    fit();
    let alive = true;
    document.fonts?.ready.then(() => alive && fit()).catch(() => {});
    window.addEventListener('resize', fit);
    return () => {
      alive = false;
      window.removeEventListener('resize', fit);
    };
  }, [active, lang]);
  const words = INTRO.heroWords.map((w) => t(w));
  return (
    <div ref={ref} className="si-mhero relative">
      <div ref={slotRef} className="si-mclip absolute inset-0 overflow-hidden bg-[#2B3038]">
        <PosterSlot className="si-mvid absolute left-1/2 top-1/2 h-full w-full object-cover" />
        <div className="absolute inset-x-0 bottom-0 h-1/2" style={{ background: 'linear-gradient(rgba(56,68,82,0), rgb(56,68,82))' }} />
        {/* 글자 크기는 CSS 로 미리(40/56/72) — fitFont 기준값과 같아 하이드레이션 뒤 제목이 튀지 않는다 */}
        <h2
          ref={hRef}
          className="absolute inset-x-0 mx-auto max-w-[980px] text-center text-[40px] font-bold leading-[1.28] text-white md:text-[56px] lg:text-[72px]"
          style={{ bottom: 'calc(var(--b) + 20px)', paddingLeft: 'calc(var(--s) + 12px)', paddingRight: 'calc(var(--s) + 12px)', wordBreak: 'keep-all' }}
          aria-label={words.join(' ')}
        >
          {words.map((w, i) => (
            <span key={i} className="si-mhl" style={{ '--i': i } as CSSProperties} aria-hidden="true">
              <span data-fit className="inline-block whitespace-nowrap">{w}</span>
            </span>
          ))}
        </h2>
      </div>
    </div>
  );
}

/** 일정 주고받기(채팅) 카드 — 흐린 영상 위 폰에서 웨딩홀 담당자 ↔ 프리티풀 비즈 대화가 한 줄씩(화면에 들어오면 한 번 · 261009) */
function MobileTransfer({ active, ids, slotRef }: { active: boolean; ids: boolean; slotRef: RefObject<HTMLDivElement> }) {
  const t = useT();
  const capRef = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (!active) return undefined;
    const card = slotRef.current;
    const cap = capRef.current;
    if (!card || !cap) return undefined;
    if (prefersReducedMotion()) {
      setStep(CHAT_STEPS.length);
      cap.setAttribute('data-in', '');
      return undefined;
    }
    const io1 = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) {
        cap.setAttribute('data-in', '');
        io1.disconnect();
      }
    }, { rootMargin: `0px 0px ${-Math.max(0, Math.round(window.innerHeight * 0.24 - 80))}px 0px` });
    io1.observe(cap);
    let timer = 0;
    let started = false;
    const run = () => {
      let s = 0;
      const next = () => {
        s += 1;
        setStep(s);
        if (s >= CHAT_STEPS.length) return;
        const wait = CHAT_STEPS[s - 1].typing ? 1150 : CHAT_STEPS[s]?.typing ? 650 : 950;
        timer = window.setTimeout(next, wait);
      };
      timer = window.setTimeout(next, 450);
    };
    // 영상은 useSharedLoopVideo 가 맡는다 — 여기선 대화 시작만
    const io2 = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !started) {
        started = true;
        run();
        io2.disconnect();
      }
    }, { threshold: 0.35 });
    io2.observe(card);
    return () => {
      io1.disconnect();
      io2.disconnect();
      window.clearTimeout(timer);
    };
  }, [active, slotRef]);
  return (
    <div id={ids ? 'dock-chat' : undefined} className="px-5 pt-[42px] md:mx-auto md:max-w-[720px] md:px-6 md:pt-[64px] lg:max-w-[1040px]">
      <div ref={slotRef} className="relative h-[460px] overflow-hidden rounded-[32px] bg-[#1A1E26] md:h-[560px] lg:h-[620px]">
        <PosterSlot className="absolute inset-0 h-full w-full scale-[1.15] object-cover" style={{ filter: 'blur(10px) brightness(0.62)' }} lazy />
        {/* 손에 든 듯 살짝 기운 폰 */}
        <div className="si-mphone absolute left-1/2 top-[30px] origin-top md:top-[40px]" style={{ width: 352, height: 775, transform: 'translateX(-50%) rotate(-6deg) scale(var(--ps))' }} aria-hidden="true">
          <FlatPhone>
            {/* 대화 칸 높이 230(디자인 px) — 300 이면 마지막 말풍선 · 배정 일정표가 카드 아래쪽 제목 · 어두운 그라데이션 뒤로 들어가 안 보였다
                (261009 검증, 390 폭: 대화 칸 아래 끝 y≈334 > 제목 위 끝 317). 230 이면 아래 끝 ≈285 · md ≈334(제목 387) — 새 말이 늘 제목 위에 보인다 */}
            <ChatScreen step={step} listMax={230} />
          </FlatPhone>
        </div>
        <div className="absolute inset-x-0 bottom-0 h-[253px] md:h-[300px]" style={{ background: 'linear-gradient(rgba(26,31,41,0), rgba(0,12,30,0.8))' }} />
        <div ref={capRef} className="si-fu absolute inset-x-0 bottom-[23px] px-6 text-center md:bottom-[36px]">
          <h3 className="break-keep text-[24px] font-bold leading-[33.6px] tracking-[-0.48px] text-white md:text-[28px] md:leading-[39px]">
            {INTRO.chatTitle.map((l, i) => <span key={i} className="block">{t(l)}</span>)}
          </h3>
          <p className="mx-auto mt-2 break-keep text-[14px] font-medium leading-[22.4px] tracking-[-0.28px] text-white/80 md:text-[16px] md:leading-[25.6px]">
            {INTRO.chatDesc.map((l, i) => <span key={i} className="block">{t(l)}</span>)}
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * 2D 폰 틀(모바일 카드용) — 352×775 칸, 화면 332×745. 틀 치수 · 색은 데스크톱 기울어진 폰(TiltPhone)과 같은 한 벌(PHONE_FRAME).
 * 261009 사장 '폰 UI 상단이 이상함, 다이나믹 아일랜드 위쪽? r값이랑 뭔가 잘린다' — 원인 둘(390 · 360 · 430 dpr3 확대 캡처로 확인):
 *  ① 옆면을 한 장짜리 그림자(10px 14px, 퍼짐 -2)로 그려, 오른쪽 위 모서리에서 그 둥근 판이 테두리와 안 이어지고 계단처럼 따로 삐져나왔다 → 층을 쌓은 옆면(FLAT_BAND_SHADOW)
 *  ② 베젤이 위 · 아래 11.5 · 옆 6.5 로 달라 다이나믹 아일랜드 위가 두툼한 띠처럼 보이고, 바깥 60 · 화면 48 모서리가 옆 두께와 안 맞아 모서리가 어긋나 보였다
 *     → 베젤 9.5 고르게 · 모서리 60 → 58 → 48 한 중심(데스크톱 폰 비율)
 */
function FlatPhone({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative h-full w-full">
      {/* 옆면(층층이 민 금속 띠) + 카드 위 그림자 */}
      <div className="absolute" style={{ ...PHONE_FRAME.rim, background: '#B9C3D3', boxShadow: `${FLAT_BAND_SHADOW}, 0 40px 80px -20px rgba(0,0,0,0.55)` }} />
      {/* 앞 테두리(얇은 금속 테) */}
      <div className="absolute" style={{ ...PHONE_FRAME.rim, background: PHONE_RIM_BG }} />
      {/* 검은 베젤 */}
      <div className="absolute" style={{ ...PHONE_FRAME.bezel, ...PHONE_BEZEL }} />
      <div className="absolute overflow-hidden bg-white" style={{ ...PHONE_FRAME.screen, isolation: 'isolate' }}>
        {children}
        <PhoneIsland />
      </div>
    </div>
  );
}

/** 진행자 고르기 — 회색 카드 속 앱 화면 조각 + 제목 · 설명 · 알약(하나씩 떠오름) */
function MobileHosts({ active, ids }: { active: boolean; ids: boolean }) {
  const t = useT();
  const listRef = useRef<HTMLUListElement>(null);
  useEffect(() => {
    if (!active) return undefined;
    const items = Array.from(listRef.current?.querySelectorAll<HTMLElement>('.si-fu') || []);
    if (prefersReducedMotion()) {
      items.forEach((el) => el.setAttribute('data-in', ''));
      return undefined;
    }
    const io = new IntersectionObserver((es) => {
      es.forEach((e) => {
        if (e.isIntersecting) {
          e.target.setAttribute('data-in', '');
          io.unobserve(e.target);
        }
      });
    }, { rootMargin: `0px 0px ${-Math.max(0, Math.round(window.innerHeight * 0.26 - 80))}px 0px` });
    items.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [active]);
  return (
    <div id={ids ? 'dock-hosts' : undefined} className="px-5 pt-[160px] md:mx-auto md:max-w-[720px] md:px-6 lg:max-w-[1040px]">
      <h2 className="break-keep text-[36px] font-bold leading-[46.08px] tracking-[-0.72px] text-[rgba(2,9,19,0.91)] md:text-[44px] md:leading-[56px]">
        {INTRO.listTitle.map((l, i) => <span key={i} className="block">{t(l)}</span>)}
      </h2>
      <ul ref={listRef} className="mt-8 grid grid-cols-1 gap-y-[60px] md:grid-cols-2 md:gap-x-6">
        {INTRO.listItems.map((it, i) => (
          <li key={it.key} className="si-fu">
            <MobileShot i={i} />
            <h3 className="mt-6 break-keep text-[18px] font-bold leading-[26.64px] tracking-[-0.36px] text-[rgb(51,61,75)]">{t(it.title)}</h3>
            <p className="mt-2 break-keep text-[14px] leading-[22.4px] tracking-[-0.28px] text-[rgb(107,118,132)]">{t(it.desc)}</p>
            <div className="mt-[27px]">
              <PillCta label={t(it.cta)} href={it.href} size="sm" />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * 회색 카드 속 화면 조각 — 진행자 목록 · 프로필은 긴 캡처 조각, AI 후기는 고해상도 조각(piece) 통째로,
 * 엔터프라이즈는 배정 보드의 '다가오는 배정' 목록 카드(BoardListCard, 줄 간격 좁힌 판)를 그대로(261009 — 첫 채팅 장면의 하루 일정표와 겹쳐 보이지 않게 여러 날 목록).
 * 조각이 카드 아래로 넘칠 때만(진행자 목록) 아래를 흐리게 덮는다 — 다 보이는 조각(AI 요약 카드 · 배정 목록 카드)은 끝까지 또렷하게.
 */
const MOBILE_CROPS: ({ y: number; h: number } | null)[] = [
  { y: 226, h: 588 },
  { y: 1050, h: 286 },
  null,
  null,
];
const SHOT_H = 272;
const SHOT_W = 300;
const SHOT_SHADOW = '0 69px 42px rgba(99,109,131,0.09), 0 31px 31px rgba(99,109,131,0.05), 0 123px 49px rgba(99,109,131,0.01), 0 193px 54px rgba(99,109,131,0)';
function MobileShot({ i }: { i: number }) {
  const sc = HOST_SCREENS[i];
  const c = MOBILE_CROPS[i];
  const k = SHOT_W / 780;
  let h: number;
  let look: CSSProperties = {};
  if (sc.board) {
    h = boardListH(true);
  } else if (sc.piece && sc.crop) {
    h = Math.round((SHOT_W * sc.crop.h) / sc.crop.w);
    look = { backgroundImage: `url(${sc.piece})`, backgroundSize: `${SHOT_W}px auto`, backgroundPosition: '0 0' };
  } else {
    const cc = c || { y: 0, h: 600 };
    h = Math.round(cc.h * k);
    look = { backgroundImage: sc.src ? `url(${sc.src})` : undefined, backgroundSize: `${SHOT_W}px auto`, backgroundPosition: `0 ${-cc.y * k}px` };
  }
  const top = Math.max(26, Math.round((SHOT_H - h) / 2));
  const spills = top + h > SHOT_H - 26;
  return (
    <div className="relative h-[272px] overflow-hidden rounded-[32px] bg-[#F2F4F6]">
      <div
        className="absolute left-1/2 -translate-x-1/2 overflow-hidden rounded-[19px] border border-white/60"
        style={{ top, width: SHOT_W, height: h, backgroundColor: 'rgba(251,251,252,0.9)', boxShadow: SHOT_SHADOW, ...look }}
        aria-hidden="true"
      >
        {sc.board && <BoardListCard compact />}
      </div>
      {spills && <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[75px]" style={{ background: 'linear-gradient(rgba(242,244,247,0), rgb(242,244,247))' }} />}
    </div>
  );
}

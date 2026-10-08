'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { useT } from '@/lib/biz/i18n';
import { useInView } from '@/components/biz/biz-motion';
import { STAGE, type Tr } from './content';
import { lerp, seg, useFrame, useSceneProgress } from './scene';
import { scrollToBizSection } from '../scroll-to';
import { CTA_SPRING, StageCta, VideoOverlay, createFrameLoader, squirclePath, type FrameLoader } from './SceneStage.parts';

/*
 * ⑪ 무대 장면(토스 홈 '온오프라인 경계 없이 → 금융과 일상을 품고 · 이제는 사장님 곁으로 → 단말기 영상' 자리, 261008).
 * 데스크톱(≥1024, 움직임 줄이기 아님): 한 부모(905vh) + 100vh sticky 무대. 길이는 토스 1440×900 실측 px 을 vh/900 배로.
 *   장면 A(0–2000): 흰 무대 가운데 검은 둥근 사각(Figma 모서리 0.6)이 4단계(easeOutQuad)로 자라며 두 낱말을 양옆으로 민다 — 전부 스크롤 스크럽.
 *   덮개 제목(1274–2299): 흰 두 줄이 차례로 떠오르며(흐림 풀림) 넓어지는 검은 모양 안에서만 읽히고, 장면 B 가 밝아질 때 크게 흐려지며 사라진다.
 *   장면 B(2000–7248): 모양이 화면을 다 채운 순간 검은 무대로 딱 바뀐다(둘 다 검정이라 이음 없음). 송년회 72장을 canvas 에 cover 로 스크럽,
 *     검은 막이 걷히며 떠오르고, 블록 3개가 토스 문턱(2824 · 3840 · 5200)에서 시간 기반으로 떠오르고(100ms 차례) 가라앉는다.
 *   끝(7248): 고정이 풀리는 순간 검은 무대가 0.8 배 · 모서리 68 로 줄어 흰 바탕 위 둥근 카드가 되고(600ms) 그대로 올라간다.
 *   토스는 블록 5개 · 138장 · 8400px — 우리는 블록 3개 · 72장이라 장면 B 를 5248px 로 줄였다(블록 문턱은 토스 앞 3개와 같고, 평균 장당 74px ≈ 토스 61px).
 *   장 번호는 구간별 속도(블록마다 맞는 장면: 개회 · 연회장 / 협약 · 시상 / 레크리에이션). 멈추면 늘 또렷한 한 장, 장이 바뀔 때만 180ms 녹여 바꾼다.
 * 모바일 · 태블릿 · 움직임 줄이기: 토스 모바일처럼 고정 장면 없이 위 모서리 32 의 검은 판 + 흰 제목 + 사진 카드 3장(한 번 떠오름) + 아래 띠.
 * 토스의 코드 · CSS · 그림 · 영상 · 글꼴은 쓰지 않았다(글꼴 Pretendard, 소재는 프리티풀 송년회 영상 프레임).
 */

const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

/* ─── 장면 길이(토스 1440×900 px, 섹션 위 끝 기준) ─── */
const A_PIN = 2000; // 장면 A 고정
const B_PIN = 5248; // 장면 B 고정(토스 8400 → 줄임)
const RUN = A_PIN + B_PIN; // 진행률 분모
const SEC_VH = ((RUN + 900) / 900) * 100; // 부모 높이(vh)

/* 모양 단계 — P1 키 큰 알약 · P2 숨 · P3 넓어짐(높이 · 모서리는 1674 까지) · P4 화면 채움 */
const P1 = 774;
const P2 = 1249;
const P3H = 1674;
/* 낱말 퇴장(위로 24 · 흐림 8 · 사라짐) */
const W_OUT: [number, number] = [1344, 1874];
/* 덮개 제목 — 줄 1 · 줄 2 등장, 보이는 구간, 둘 다 흐려지며 퇴장(토스 표본) */
const OV1: [number, number] = [1274, 1374];
const OV2: [number, number] = [1344, 1444];
const OV_SHOW: [number, number] = [1250, 2304];
const OV_OUT: [number, number][] = [[2044, 0], [2074, 0.012], [2124, 0.113], [2174, 0.349], [2224, 0.704], [2274, 0.966], [2299, 1]];
/* 블록 창(내려갈 때 IN · OUT 문턱) — 토스 B0 · B1 · B2 문턱, 마지막은 끝까지 */
const WIN: [number, number][] = [[2824, 3680], [3840, 4616], [5200, Number.POSITIVE_INFINITY]];
/* 필름 — 스크롤 → 장 번호(블록마다 맞는 장면이 오게: 개회 · 연회장 → 협약 · 시상 → 레크리에이션) */
const FILM: [number, number][] = [[2000, 0], [2824, 2], [3680, 5.4], [3840, 6], [4616, 21.4], [5200, 32], [RUN, 71]];
/* 검은 막 — 어둠 속에서 떠올라 2850 에 밝아짐. 우리 사진(밝은 연회장 커튼)은 토스 렌더보다 밝아 18% 는 남겨 무대 톤을 맞춘다 */
const VEIL: [number, number][] = [[2000, 1], [2300, 0.86], [2700, 0.52], [2850, 0.18]];
/* 모바일 카드 사진(5:6 가운데 자르기에 사람이 들어오는 장) — 블록마다 다른 장면: 개회 사회 · 시상 · 레크리에이션(22 · 20 은 같은 두 사람이라 카드 1 · 2 가 똑같아 보였다) */
const LIST_FRAMES = [1, 13, 51];
const N = STAGE.frames.length;
const CLOSE: Tr = { ko: '닫기', en: 'Close', ja: '閉じる', zh: '关闭' };

const eq = (t: number) => 1 - (1 - t) * (1 - t); // easeOutQuad
const sineInOut = (t: number) => (1 - Math.cos(Math.PI * t)) / 2;
function interp(keys: [number, number][], x: number) {
  if (x <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const [x1, y1] = keys[i];
    if (x <= x1) {
      const [x0, y0] = keys[i - 1];
      return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
    }
  }
  return keys[keys.length - 1][1];
}

/** 장면 A 검은 모양 크기 · 모서리(px) — u = 화면 높이/900 */
function shapeAt(s: number, vw: number, vh: number, u: number) {
  if (s <= 0) return { w: 0, h: 0, r: 0 };
  if (s < P1) {
    const e = eq(s / P1);
    const w = 194.94 * u * e;
    return { w, h: 665.8 * u * e, r: Math.min(w / 2, (20 + 28 * e) * u) };
  }
  if (s < P2) {
    const e = eq((s - P1) / (P2 - P1));
    return { w: lerp(194.94, 229, e) * u, h: lerp(665.8, 698, e) * u, r: lerp(48, 53, e) * u };
  }
  const w = lerp(229 * u, vw, eq(seg(s, P2, A_PIN)));
  if (s < P3H) {
    const e = eq((s - P2) / (P3H - P2));
    return { w, h: lerp(698, 782, e) * u, r: lerp(53, 91, e) * u };
  }
  const e = eq(seg(s, P3H, A_PIN));
  return { w, h: lerp(782 * u, vh, e), r: lerp(91 * u, 0, e) };
}

/*
 * 장면 CSS — 글자는 토스 1440 실측(48 · 32 · 16), 1440~1920 은 토스처럼 키운다(다른 장면과 같은 식). 왼쪽 여백 1024:48 → 1440:128 → 160.
 * 왼쪽 그늘은 토스 실측(.6/.38/.16, 폭 40%)보다 조금 진하고 넓게 — 우리 사진(밝은 커튼 · 흰 옷)이 토스 렌더보다 밝아 글이 묻힌다.
 */
const CSS = `
.stg{--h2:48px;--bt:32px;--bd:16px;--pad:48px;word-break:keep-all;-webkit-font-smoothing:antialiased}
@media (min-width:1024px){.stg{--h2:clamp(48px,calc(48px + (100vw - 1440px) / 30),64px);--bt:clamp(32px,calc(32px + (100vw - 1440px) / 60),40px);--bd:clamp(16px,calc(16px + (100vw - 1440px) / 240),18px);--pad:clamp(48px,calc(48px + (100vw - 1024px) * 0.1923),160px)}}
.stg-stage{position:sticky;top:0;height:100vh;overflow:hidden;background:#fff;z-index:0}
.stg-a{position:absolute;inset:0;z-index:1;background:#fff}
.stg-word{position:absolute;top:50%;margin-top:calc(var(--h2) * -0.64);font-size:var(--h2);line-height:1.28;font-weight:700;letter-spacing:-0.02em;color:#1C1F25;white-space:nowrap;will-change:transform}
.stg-word[data-s="l"]{right:50%;text-align:right;transform:translate3d(-10px,0,0)}
.stg-word[data-s="r"]{left:50%;transform:translate3d(10px,0,0)}
.stg-svg{position:absolute;left:0;top:0;width:100%;height:100%;z-index:1;pointer-events:none}
.stg-shbox{position:absolute;left:50%;top:50%;width:0;height:0;transform:translate(-50%,-50%);pointer-events:none}
.stg-b{position:absolute;inset:0;z-index:2;visibility:hidden}
.stg-b[data-on]{visibility:visible}
.stg-b:not([data-on]) .stg-blk{visibility:hidden;transition:none}
.stg-card{position:absolute;inset:0;overflow:hidden;background:#000;transform-origin:50% 50%;transition-property:transform,border-radius;transition-duration:.6s;transition-timing-function:cubic-bezier(0.33,1,0.68,1)}
.stg-card[data-end]{transform:scale(0.8);border-radius:68px}
.stg-cv{position:absolute;left:0;top:0;width:100%;height:100%;display:block}
.stg-veil{position:absolute;inset:0;background:#000;pointer-events:none}
.stg-vig{position:absolute;left:0;top:0;bottom:0;width:44%;pointer-events:none;background:radial-gradient(70% 115% at 22% 50%,rgba(0,0,0,.66) 0,rgba(0,0,0,.44) 38%,rgba(0,0,0,.2) 60%,rgba(0,0,0,0) 82%)}
.stg-ov{position:absolute;inset:0;z-index:3;display:flex;align-items:center;justify-content:center;pointer-events:none;visibility:hidden}
.stg-ovp{display:flex;flex-direction:column;align-items:center;margin:0;font-size:var(--h2);line-height:1.28;font-weight:700;letter-spacing:-0.02em;color:#fff}
.stg-ovl{display:block;text-align:center;white-space:nowrap;opacity:0;will-change:transform,opacity,filter}
.stg-blk{position:absolute;left:var(--pad);top:31.2%;display:flex;flex-direction:column;align-items:flex-start;gap:36px;visibility:hidden;pointer-events:none;transition:visibility 0s linear .8s}
.stg-blk[data-on]{visibility:visible;pointer-events:auto;transition-delay:0s}
.stg-blk[data-fin]{top:50%;transform:translateY(-50%);gap:64px}
.stg-grp{display:flex;flex-direction:column;align-items:flex-start;gap:20px}
.stg-blk[data-fin] .stg-grp{gap:40px}
.stg-tx{display:flex;flex-direction:column;gap:8px}
.stg-blk[data-fin] .stg-tx{gap:24px}
.stg-c{opacity:0;transform:translate3d(0,40px,0);transition-property:opacity,transform;transition-duration:.8s;transition-timing-function:cubic-bezier(0.6,0,0,0.6);transition-delay:0s}
.stg-blk[data-on] .stg-c{opacity:1;transform:none;transition-delay:var(--d,0s)}
.stg-pill{display:inline-flex;align-items:center;padding:6px 12px;border:1px solid rgba(255,255,255,.12);border-radius:40px;font-size:14px;line-height:22.4px;font-weight:500;letter-spacing:-0.01em;color:#fff;white-space:nowrap}
.stg-blk[data-fin] .stg-pill{padding:7px 12px;border-color:rgba(255,255,255,.1)}
.stg-ttl{margin:0;max-width:min(560px,40vw);text-wrap:balance;font-size:var(--bt);line-height:1.4;font-weight:700;letter-spacing:-0.02em;color:#fff}
.stg-dsc{margin:0;max-width:19em;text-wrap:balance;font-size:var(--bd);line-height:1.6;font-weight:400;letter-spacing:-0.02em;color:rgba(255,255,255,.75)}
.stg-cta{position:relative;display:inline-flex;align-items:center;height:48px;padding:0 0 0 18px;border:1px solid rgba(13,25,74,.04);border-radius:136px;background-color:rgba(255,255,255,.11);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);color:#fff;font-family:inherit;font-size:16px;line-height:25.6px;font-weight:600;letter-spacing:-0.02em;cursor:pointer;transition:background-color .2s ease;-webkit-tap-highlight-color:transparent}
.stg-cta:focus-visible{outline:2px solid rgba(255,255,255,.9);outline-offset:3px}
.stg-cta-lbl{position:relative;display:inline-flex;overflow:hidden}
.stg-cta-r1,.stg-cta-r2{display:inline-flex}
.stg-cta-r2{position:absolute;left:0;top:0}
.stg-cta-r1>span,.stg-cta-r2>span{display:inline-block;white-space:pre;transition-property:transform,opacity,filter;transition-duration:.45s;transition-timing-function:cubic-bezier(0.22,1,0.36,1);transition-timing-function:${CTA_SPRING}}
.stg-cta-r2>span{transform:translate3d(0,16px,0);opacity:0}
.stg-cta-ico{display:inline-flex;padding:0 10px 0 12px}
.stg-cta-dot{position:relative;display:block;width:28px;height:28px;border-radius:80px;background:#fff;color:#000;overflow:hidden}
.stg-cta-trk{position:absolute;left:0;top:7px;width:42px;height:14px;display:flex;justify-content:space-between;transform:translate3d(-21px,0,0);transition-property:transform;transition-duration:.45s;transition-timing-function:cubic-bezier(0.22,1,0.36,1);transition-timing-function:${CTA_SPRING}}
.stg-cta-trk svg{display:block;flex:none}
@media (hover:hover){
  .stg-cta:hover{background-color:rgba(3,31,63,.09)}
  .stg-cta:hover .stg-cta-r1>span{transform:translate3d(0,-16px,0);opacity:0;filter:blur(4px)}
  .stg-cta:hover .stg-cta-r2>span{transform:none;opacity:1}
  .stg-cta:hover .stg-cta-trk{transform:translate3d(7px,0,0)}
}
.stg-cta[data-compact]{font-size:14px;line-height:22.4px;border-color:transparent;background-color:rgba(214,224,239,.09)}
.stg-lwrap{background:rgb(243,243,243)}
@media (min-width:1024px){.stg-lwrap{background:#fff}}
.stg-list{position:relative;background:#000;border-radius:32px 32px 0 0;padding:120px 20px 0;color:#fff}
.stg-lh{margin:0;font-size:36px;line-height:46.08px;font-weight:700;letter-spacing:-0.02em;color:#fff}
.stg-items{list-style:none;margin:38px 0 0;padding:0;display:flex;flex-direction:column;gap:60px}
.stg-it{opacity:0;transform:translate3d(0,80px,0);transition:opacity .45s cubic-bezier(0.33,1,0.68,1),transform .45s cubic-bezier(0.33,1,0.68,1)}
.stg-it[data-in]{opacity:1;transform:none}
.stg-card-m{position:relative;overflow:hidden;border-radius:32px;aspect-ratio:350/420;background:#15171a}
.stg-card-m img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.stg-meta{display:flex;align-items:flex-start;gap:26px;margin-top:24px}
.stg-chip{flex:none;display:inline-flex;align-items:center;height:36px;padding:0 12px;border:1px solid rgba(211,224,243,.42);border-radius:40px;font-size:14px;line-height:22.4px;font-weight:500;letter-spacing:-0.01em;color:rgb(136,141,151);white-space:nowrap}
.stg-mbody{flex:1;min-width:0}
.stg-mt{margin:0;font-size:18px;line-height:26.64px;font-weight:700;letter-spacing:-0.02em;color:rgb(218,223,233)}
.stg-md{margin:8px 0 0;text-wrap:pretty;font-size:14px;line-height:22.4px;font-weight:400;letter-spacing:-0.02em;color:rgb(136,141,151)}
.stg-mbody .stg-cta{margin-top:28px}
.stg-band{height:160px;background:linear-gradient(180deg,#000 2%,rgb(5,11,27) 6%,rgb(15,28,60) 14%,rgb(24,44,81) 21%,rgb(29,58,102) 29%,rgb(41,73,122) 36%,rgb(61,94,147) 44%,rgb(84,117,168) 51%,rgb(109,143,191) 59%,rgb(147,170,211) 66%,rgb(188,203,232) 74%,rgb(220,230,242) 81%,rgb(245,246,251) 89%,#fff 96%)}
@media (min-width:768px){
  .stg-list{padding:160px 40px 0}
  .stg-list-in{max-width:640px;margin:0 auto}
  .stg-lh{font-size:44px;line-height:56.32px}
  .stg-items{margin-top:64px;gap:72px}
  .stg-card-m{aspect-ratio:4/3}
  .stg-mt{font-size:20px;line-height:29.6px}
  .stg-md{font-size:15px;line-height:24px}
}
@media (min-width:1024px){
  .stg-list-in{max-width:1140px}
  .stg-lh{font-size:48px;line-height:61.44px}
  .stg-items{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:24px}
  .stg-card-m{aspect-ratio:350/420}
  .stg-mt{font-size:18px;line-height:26.64px}
  .stg-md{font-size:14px;line-height:22.4px}
}
@media (prefers-reduced-motion:reduce){
  .stg-it{opacity:1;transform:none;transition:none}
  .stg-cta,.stg-cta-r1>span,.stg-cta-r2>span,.stg-cta-trk{transition:none}
}
.stg-vo{position:fixed;inset:0;z-index:1000;display:flex;align-items:center;justify-content:center;padding:72px 24px;background:rgba(0,0,0,.92);opacity:0;transition:opacity .3s ease}
.stg-vo[data-shown]{opacity:1}
.stg-vo-v{display:block;width:min(1280px,100%,calc((100vh - 144px) * 16 / 9));aspect-ratio:16/9;border-radius:20px;background:#000;transform:scale(.96);transition:transform .5s cubic-bezier(0.22,1,0.36,1)}
.stg-vo[data-shown] .stg-vo-v{transform:none}
.stg-vo-x{position:absolute;top:16px;right:16px;width:48px;height:48px;display:flex;align-items:center;justify-content:center;border:0;border-radius:50%;background:rgba(255,255,255,.12);color:#fff;cursor:pointer;transition:background-color .2s ease}
.stg-vo-x:hover{background:rgba(255,255,255,.24)}
.stg-vo-x:focus-visible{outline:2px solid #fff;outline-offset:2px}
@media (prefers-reduced-motion:reduce){.stg-vo,.stg-vo-v{transition:none}}
`;

type Mode = 'ssr' | 'desk' | 'stack';
const DESK_MQ = '(min-width: 1024px) and (prefers-reduced-motion: no-preference)';

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

/** 지난번 값과 다를 때만 스타일을 쓴다(스크롤 프레임마다 불림) */
const lastStyle = new WeakMap<Element, Record<string, string>>();
function put(el: HTMLElement | SVGElement | null | undefined, prop: string, v: string) {
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

export default function SceneStage() {
  const t = useT();
  const mode = useMode();
  const [video, setVideo] = useState(false);
  const onCta = useCallback((i: number) => {
    if (i === 0) {
      setVideo(true);
      return;
    }
    scrollToBizSection('문의폼'); // 탭바 '문의하기'와 같은 도우미(도착 자리 · 하단 탭바 붙잡기)
  }, []);
  return (
    <section id="dock-stage" data-no-natural-reveal className="stg relative bg-white" style={{ width: '100vw', marginLeft: 'calc(50% - 50vw)' }}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      {mode !== 'stack' && <StageDesk className={mode === 'ssr' ? 'hidden lg:block motion-reduce:!hidden' : ''} active={mode === 'desk'} onCta={onCta} />}
      {mode !== 'desk' && <StageList className={mode === 'ssr' ? 'lg:hidden motion-reduce:!block' : ''} onCta={onCta} />}
      {video && <VideoOverlay src={STAGE.fullVideo} title={t(STAGE.blocks[0].title)} closeLabel={t(CLOSE)} onClose={() => setVideo(false)} />}
    </section>
  );
}

/* ═══════════════════════ 데스크톱: sticky 무대 ═══════════════════════ */

function StageDesk({ className, active, onCta }: { className: string; active: boolean; onCta: (i: number) => void }) {
  const t = useT();
  const runRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const aRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const wlRef = useRef<HTMLSpanElement>(null);
  const wrRef = useRef<HTMLSpanElement>(null);
  const bRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const cvRef = useRef<HTMLCanvasElement>(null);
  const veilRef = useRef<HTMLDivElement>(null);
  const ovRef = useRef<HTMLDivElement>(null);
  const l1Ref = useRef<HTMLSpanElement>(null);
  const l2Ref = useRef<HTMLSpanElement>(null);
  const blkRefs = useRef<(HTMLDivElement | null)[]>([]);
  const geo = useRef({ vw: 1440, vh: 900, u: 1, k: 1 });
  const st = useRef({ block: -2, end: false, dockB: false, b: false, d: '', film: '' });
  const loaderRef = useRef<FrameLoader | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const P = useSceneProgress(runRef);

  /*
   * 필름 — 스크롤 자리마다 한 장(멈추면 늘 또렷한 한 장). 장이 바뀔 때만 앞 장 위로 180ms 녹여 바꾼다(사진 컷이라 딱 끊기지 않게).
   * 줌은 스크롤에 붙어 아주 천천히 뒤로 빠진다(1.06 → 1).
   */
  const film = useRef({ cur: -1, prev: -1, t0: 0, raf: 0, z: 1 });
  const paintFilm = (now: number) => {
    const fm = film.current;
    fm.raf = 0;
    const cv = cvRef.current;
    const loader = loaderRef.current;
    if (!cv || !loader || fm.cur < 0) return;
    let ctx = ctxRef.current;
    if (!ctx) {
      ctx = cv.getContext('2d', { alpha: false });
      if (!ctx) return;
      ctxRef.current = ctx;
      ctx.imageSmoothingQuality = 'high';
    }
    const W = cv.width;
    const H = cv.height;
    const c = ctx;
    const cover = (img: HTMLImageElement, alpha: number) => {
      const iw = img.naturalWidth || 1280;
      const ih = img.naturalHeight || 720;
      const sc = Math.max(W / iw, H / ih) * fm.z;
      const dw = iw * sc;
      const dh = ih * sc;
      c.globalAlpha = alpha;
      c.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);
    };
    const cur = loader.nearest(fm.cur);
    const prev = fm.prev >= 0 ? loader.nearest(fm.prev) : null;
    const k = fm.t0 ? Math.min(1, Math.max(0, (now - fm.t0) / 180)) : 1;
    const a = 1 - (1 - k) * (1 - k);
    c.globalAlpha = 1;
    c.fillStyle = '#000';
    c.fillRect(0, 0, W, H);
    const mixing = !!prev && prev !== cur && k < 1;
    if (mixing && prev) cover(prev, 1);
    if (cur) cover(cur, mixing ? a : 1);
    c.globalAlpha = 1;
    if (k < 1) fm.raf = requestAnimationFrame(paintFilm);
    else fm.prev = -1;
  };
  const setFilm = (f: number, z: number) => {
    const fm = film.current;
    const ti = Math.max(0, Math.min(N - 1, Math.round(f)));
    let dirty = Math.abs(z - fm.z) > 0.00005;
    fm.z = z;
    if (ti !== fm.cur) {
      if (fm.cur < 0) {
        fm.prev = -1;
        fm.t0 = 0;
      } else {
        fm.prev = fm.cur;
        fm.t0 = performance.now();
      }
      fm.cur = ti;
      dirty = true;
    }
    if (dirty || st.current.film === '') {
      st.current.film = 'x';
      if (fm.raf) cancelAnimationFrame(fm.raf);
      paintFilm(performance.now());
    }
  };
  useEffect(() => () => cancelAnimationFrame(film.current.raf), []);

  const update = (p: number) => {
    if (!active) return;
    const g = geo.current;
    const s = p * RUN;
    const isB = s >= A_PIN;
    put(aRef.current, 'visibility', isB ? 'hidden' : 'visible');
    // 장면 B 켜고 끄기 — 속성으로(꺼지는 순간 가라앉던 블록도 같이 숨긴다: 자식 visible 이 부모 hidden 을 이기므로)
    if (isB !== st.current.b) {
      st.current.b = isB;
      if (isB) bRef.current?.setAttribute('data-on', '');
      else bRef.current?.removeAttribute('data-on');
    }

    /* 장면 A — 검은 모양 + 두 낱말 */
    if (!isB) {
      const sh = shapeAt(s, g.vw, g.vh, g.u);
      const d = squirclePath(g.vw / 2, g.vh / 2, sh.w, sh.h, sh.r);
      if (d !== st.current.d) {
        st.current.d = d;
        pathRef.current?.setAttribute('d', d);
      }
      put(boxRef.current, 'width', `${sh.w.toFixed(1)}px`);
      put(boxRef.current, 'height', `${sh.h.toFixed(1)}px`);
      const gap = (s < P1 ? 10 + 20 * eq(Math.max(0, s) / P1) : 30) * g.k;
      const off = sh.w / 2 + gap;
      const q = 1 - Math.pow(1 - seg(s, W_OUT[0], W_OUT[1]), 2.8);
      const ty = (-24 * q * g.k).toFixed(2);
      const op = (1 - q).toFixed(3);
      const fl = q > 0.004 ? `blur(${(8 * q * g.k).toFixed(2)}px)` : 'none';
      put(wlRef.current, 'transform', `translate3d(${(-off).toFixed(2)}px,${ty}px,0)`);
      put(wrRef.current, 'transform', `translate3d(${off.toFixed(2)}px,${ty}px,0)`);
      put(wlRef.current, 'opacity', op);
      put(wrRef.current, 'opacity', op);
      put(wlRef.current, 'filter', fl);
      put(wrRef.current, 'filter', fl);
    }

    /* 덮개 제목 — 줄마다 아래 40 · 흐림 10 에서 떠오름, 장면 B 가 밝아질 때 함께 크게 흐려지며 사라짐 */
    const ovOn = s >= OV_SHOW[0] && s < OV_SHOW[1];
    put(ovRef.current, 'visibility', ovOn ? 'visible' : 'hidden');
    if (ovOn) {
      const out = interp(OV_OUT, s);
      [l1Ref.current, l2Ref.current].forEach((el, j) => {
        const w = j === 0 ? OV1 : OV2;
        const e = sineInOut(Math.pow(seg(s, w[0], w[1]), 0.93));
        const bl = (10 * (1 - e) + 53.2 * out) * g.k;
        put(el, 'opacity', (e * (1 - out)).toFixed(3));
        put(el, 'transform', `translate3d(0,${(40 * (1 - e) * g.k).toFixed(2)}px,0)`);
        put(el, 'filter', bl > 0.05 ? `blur(${bl.toFixed(2)}px)` : 'none');
      });
    }

    /* 장면 B — 필름 · 검은 막 */
    if (isB) {
      setFilm(interp(FILM, s), 1.06 - 0.06 * seg(s, A_PIN, RUN));
      put(veilRef.current, 'opacity', interp(VEIL, s).toFixed(3));
    }

    /* 블록 — 창 문턱을 넘을 때만 바꾼다(움직임은 CSS 시간 전환) */
    let idx = -1;
    if (isB) for (let i = 0; i < WIN.length; i++) if (s >= WIN[i][0] && s < WIN[i][1]) idx = i;
    if (idx !== st.current.block) {
      st.current.block = idx;
      blkRefs.current.forEach((el, i) => {
        if (!el) return;
        if (i === idx) el.setAttribute('data-on', '');
        else el.removeAttribute('data-on');
      });
    }

    /* 끝 — 고정이 풀리면 둥근 카드로(되돌아가면 원래대로) */
    const end = p >= 0.9995;
    if (end !== st.current.end) {
      st.current.end = end;
      if (end) cardRef.current?.setAttribute('data-end', '');
      else cardRef.current?.removeAttribute('data-end');
    }

    /* 왼쪽 눈금 · 머리줄 — 장면 B 무대가 보이는 동안만 어두운 바탕(카드로 줄면 그 테두리 밖은 흰색) */
    if (isB !== st.current.dockB) {
      st.current.dockB = isB;
      if (isB) cardRef.current?.setAttribute('data-dock-theme', 'dark');
      else cardRef.current?.removeAttribute('data-dock-theme');
    }
  };
  const upd = useRef(update);
  upd.current = update;

  /* 크기 — 화면 높이/900(모양 · 길이), 글자 배율(낱말 틈), canvas 실제 픽셀 */
  useIsoLayoutEffect(() => {
    if (!active) return undefined;
    const layout = () => {
      const vw = stageRef.current?.clientWidth || window.innerWidth;
      const vh = window.innerHeight;
      const fs = wlRef.current ? parseFloat(getComputedStyle(wlRef.current).fontSize) || 48 : 48;
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const cw = Math.round(vw * dpr);
      const ch = Math.round(vh * dpr);
      const cv = cvRef.current;
      if (cv && (cv.width !== cw || cv.height !== ch)) {
        cv.width = cw;
        cv.height = ch;
        if (ctxRef.current) ctxRef.current.imageSmoothingQuality = 'high';
      }
      svgRef.current?.setAttribute('viewBox', `0 0 ${vw} ${vh}`);
      geo.current = { vw, vh, u: vh / 900, k: fs / 48 };
      st.current.d = '';
      st.current.film = '';
      upd.current(P.get());
    };
    layout();
    window.addEventListener('resize', layout);
    return () => window.removeEventListener('resize', layout);
  }, [active, P]);

  /* 프레임 — 첫 장은 바로, 나머지는 장면이 1.5 화면 안으로 다가오면(듬성 → 촘촘) */
  useEffect(() => {
    if (!active) return undefined;
    let raf = 0;
    const loader = createFrameLoader(STAGE.frames, () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        st.current.film = '';
        upd.current(P.get());
      });
    });
    loaderRef.current = loader;
    loader.first();
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) {
        loader.all();
        io.disconnect();
      }
    }, { rootMargin: '150% 0px' });
    if (runRef.current) io.observe(runRef.current);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
      loader.dispose();
      loaderRef.current = null;
    };
  }, [active, P]);

  useFrame(P, update);

  const last = STAGE.blocks.length - 1;
  return (
    <div ref={runRef} className={`relative ${className}`} style={{ height: `${SEC_VH}vh` }}>
      <div ref={stageRef} className="stg-stage">
        {/* 읽기 프로그램용 제목 — 일 · 중은 전각 문장부호(、 。) */}
        <h2 className="sr-only">{t({ ko: `${t(STAGE.wordLeft)}, ${t(STAGE.wordRight)}. `, en: `${t(STAGE.wordLeft)}, ${t(STAGE.wordRight)}. `, ja: `${t(STAGE.wordLeft)}、${t(STAGE.wordRight)}。`, zh: `${t(STAGE.wordLeft)}、${t(STAGE.wordRight)}。` })}{`${t(STAGE.overlay[0])} ${t(STAGE.overlay[1])}`}</h2>
        {/* 장면 A — 흰 무대 · 두 낱말 · 자라는 검은 모양 */}
        <div ref={aRef} className="stg-a" data-dock-theme="light">
          <span ref={wlRef} className="stg-word" data-s="l" aria-hidden>{t(STAGE.wordLeft)}</span>
          <svg ref={svgRef} className="stg-svg" viewBox="0 0 1440 900" preserveAspectRatio="none" aria-hidden>
            <path ref={pathRef} d="" fill="#000" />
          </svg>
          <div ref={boxRef} className="stg-shbox" data-dock-theme="dark" aria-hidden />
          <span ref={wrRef} className="stg-word" data-s="r" aria-hidden>{t(STAGE.wordRight)}</span>
        </div>

        {/* 장면 B — 검은 무대 · 필름 · 블록(끝에서 둥근 카드로 줄어든다) */}
        <div ref={bRef} className="stg-b">
          <div ref={cardRef} className="stg-card">
            <canvas ref={cvRef} className="stg-cv" aria-hidden />
            <div ref={veilRef} className="stg-veil" aria-hidden />
            <div className="stg-vig" aria-hidden />
            {STAGE.blocks.map((b, i) => (
              <div
                key={i}
                ref={(el) => { blkRefs.current[i] = el; }}
                className="stg-blk"
                data-fin={i === last ? '' : undefined}
              >
                <div className="stg-grp">
                  <div className="stg-c stg-pill" style={{ '--d': '0ms' } as CSSProperties}>{b.label}</div>
                  <div className="stg-tx">
                    <h3 className="stg-c stg-ttl" style={{ '--d': '100ms' } as CSSProperties}>{t(b.title)}</h3>
                    <p className="stg-c stg-dsc" style={{ '--d': '200ms' } as CSSProperties}>{t(b.desc)}</p>
                  </div>
                </div>
                <div className="stg-c" style={{ '--d': '300ms' } as CSSProperties}>
                  <StageCta label={t(b.cta)} onClick={() => onCta(i)} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 덮개 제목 — 넓어지는 검은 모양 안에서만 읽힌다(흰 글자). 읽기 프로그램용 제목은 늘 보이는 곳에 따로 */}
        <div ref={ovRef} className="stg-ov" aria-hidden>
          <p className="stg-ovp">
            <span ref={l1Ref} className="stg-ovl">{t(STAGE.overlay[0])}</span>
            <span ref={l2Ref} className="stg-ovl">{t(STAGE.overlay[1])}</span>
          </p>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════ 모바일 · 태블릿 · 움직임 줄이기: 검은 판 + 카드 ═══════════════════════ */

function StageList({ className, onCta }: { className: string; onCta: (i: number) => void }) {
  const t = useT();
  return (
    <div className={`stg-lwrap ${className}`}>
      {/* 바탕 회색 — 앞 장면(함께한 기업, #f3f3f3) 위로 검은 판이 올라와 위 모서리 32 밖이 회색으로 보인다(토스 모바일) */}
      <div className="stg-list" data-dock-theme="dark">
        <div className="stg-list-in">
          <h2 className="stg-lh">
            {STAGE.overlay.map((l, i) => (
              <span key={i} className="block">{t(l)}</span>
            ))}
          </h2>
          <ul className="stg-items">
            {STAGE.blocks.map((b, i) => (
              <ListItem key={i} i={i} block={b} onCta={onCta} />
            ))}
          </ul>
        </div>
      </div>
      {/* 다음 장면(흰색)으로 — 검정 → 남색 → 흰색 띠(토스 모바일) */}
      <div className="stg-band" aria-hidden />
    </div>
  );
}

function ListItem({ i, block, onCta }: { i: number; block: (typeof STAGE.blocks)[number]; onCta: (i: number) => void }) {
  const t = useT();
  // 토스 모바일: 옮겨진 위 끝이 화면 ≈95% 에 닿으면 80px 아래에서 450ms easeOutCubic 으로 한 번 떠오름
  const { ref, inView } = useInView<HTMLLIElement>({ threshold: 0, rootMargin: '0px 0px -5% 0px' });
  return (
    <li ref={ref} className="stg-it" data-in={inView ? '' : undefined}>
      <div className="stg-card-m">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={STAGE.frames[LIST_FRAMES[i] ?? 0]} alt={t(block.title)} loading="lazy" decoding="async" draggable={false} />
      </div>
      <div className="stg-meta">
        <span className="stg-chip">{block.label}</span>
        <div className="stg-mbody">
          <h3 className="stg-mt">{t(block.title)}</h3>
          <p className="stg-md">{t(block.desc)}</p>
          <StageCta compact label={t(block.cta)} onClick={() => onCta(i)} />
        </div>
      </div>
    </li>
  );
}

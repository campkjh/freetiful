'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, type CSSProperties, type RefObject } from 'react';
import { useBizLang, useT } from '@/lib/biz/i18n';
import { MATCH } from './content';
import { prefersReducedMotion } from './scene';
import {
  ArrowButton, FlipDemo, MatchDemo, ReportDemo,
  type FlipCardData, type MatchCardData, type ReportCardData,
} from './SceneMatch.parts';

/*
 * ② 매칭 장면(토스 홈 '공부할 필요 없이 / 누구나 금융 전문가로' 자리) — 토스 실측 치수 · 타이밍을 우리 코드로 다시 짠 것.
 * 스크롤에 묶인 연출 없음(sticky 없음): 제목 낱말 흐림→또렷 · 부제 알약 벌어짐 · 카드 3장 차례 상승은 화면 중간선을 지날 때 한 번(시간 기반).
 * 카드 화면은 마우스를 올리면 결과 상태로(짝 알약도 튀어 오름), 터치 기기는 화면 안에 있을 때 저절로 오간다.
 */

type Mode = 'desk' | 'tab' | 'mob';

function useMode(): Mode {
  const [m, setM] = useState<Mode>('desk');
  useEffect(() => {
    const d = window.matchMedia('(min-width: 1024px)');
    const t = window.matchMedia('(min-width: 768px)');
    const on = () => setM(d.matches ? 'desk' : t.matches ? 'tab' : 'mob');
    on();
    d.addEventListener('change', on);
    t.addEventListener('change', on);
    return () => { d.removeEventListener('change', on); t.removeEventListener('change', on); };
  }, []);
  return m;
}

/** 요소 위 끝이 화면 위에서 line(0~1) 지점을 지나면 한 번 true — 이미 지나 있으면 바로 */
function useFire(ref: RefObject<Element>, line: number, enabled = true) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (on || !enabled) return undefined;
    const el = ref.current;
    if (!el) return undefined;
    const io = new IntersectionObserver((es) => {
      for (const e of es) {
        if (e.isIntersecting || e.boundingClientRect.bottom < 0) { setOn(true); io.disconnect(); }
      }
    }, { rootMargin: `0px 0px -${Math.round((1 - line) * 100)}% 0px`, threshold: 0 });
    io.observe(el);
    return () => io.disconnect();
  }, [ref, line, enabled, on]);
  return on;
}

/** 화면 안에 있는 동안 true(반복 움직임은 이때만) */
function useVisible(ref: RefObject<Element>) {
  const [v, setV] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const io = new IntersectionObserver(([e]) => setV(e.isIntersecting), { rootMargin: '80px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [ref]);
  return v;
}

const CSS = `
.smx{position:relative;display:flex;flex-direction:column;align-items:center;padding:160px 20px 0;background:#fff;color:#1C1F25}
.smx *,.smx *::before,.smx *::after{box-sizing:border-box}
.smx-h2{margin:0;max-width:100%;text-align:center;font-weight:700;font-size:36px;line-height:1.28;letter-spacing:-.02em;color:#1C1F25;
  --dur:1000ms;--ez:ease}
.smx-h2-line{display:block}
.smx-w{display:inline-block;opacity:0;transform:translate3d(0,24px,0);filter:blur(16px)}
.smx-h2.on .smx-w{opacity:1;transform:none;filter:blur(0);
  transition:opacity var(--dur) var(--ez) var(--dl),transform var(--dur) var(--ez) var(--dl),filter var(--dur) var(--ez) var(--dl)}

.smx-body{width:100%;max-width:1500px;margin-top:60px;display:flex;flex-direction:column;align-items:center;gap:32px}
.smx-sub{display:flex;flex-wrap:wrap;justify-content:center;align-items:center;column-gap:4px;margin:0;max-width:100%;
  font-weight:700;font-size:28px;line-height:1.4;letter-spacing:-.02em;color:#1C1F25;text-align:center;
  opacity:0;transform:translate3d(0,40px,0)}
.smx-sub.on{opacity:1;transform:none;transition:opacity .7s ease,transform .7s ease}
.smx-sub-l,.smx-sub-r{display:inline-block;max-width:100%}
.smx-pills{display:inline-flex;flex-wrap:wrap;justify-content:center;align-items:center;font-size:22px;line-height:1.4}
.smx-sub.split-wait .smx-sub-l{transform:translate3d(var(--shift),0,0)}
.smx-sub.split-wait .smx-sub-r{transform:translate3d(calc(var(--shift) * -1),0,0)}
.smx-sub.split-wait .smx-pills{opacity:0;transform:scale(0)}
.smx-sub.split-go .smx-sub-l,.smx-sub.split-go .smx-sub-r{transition:transform .68s cubic-bezier(.2,0,.25,1)}
.smx-sub.split-go .smx-pills{transition:opacity .2s cubic-bezier(.2,0,.35,1),transform 60ms linear}

.smx-pill{position:relative;display:inline-flex;align-items:center;justify-content:center;overflow:hidden;white-space:nowrap;
  padding:4px 10px;border-radius:36px;background:rgba(7,25,76,.05);-webkit-backdrop-filter:blur(4px);backdrop-filter:blur(4px);
  border:1px solid #F2F3F6;color:rgba(24,31,43,.77);font-weight:700;letter-spacing:-.025em;
  transition:transform .3s cubic-bezier(.17,.84,.44,1)}
.smx-pill+.smx-pill{margin-left:-.5em}
.smx-pill.on{z-index:1}
.smx-pill-glow{position:absolute;left:50%;top:0;width:104px;height:108px;margin-left:-52px;mix-blend-mode:multiply;opacity:0;transition:opacity .3s;pointer-events:none}
.smx-pill-t{position:relative;transition:opacity .2s ease}
.smx-pill-g{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity .2s ease;
  -webkit-background-clip:text;background-clip:text;color:transparent}
.smx-pill.on .smx-pill-glow,.smx-pill.on .smx-pill-g{opacity:1}
.smx-pill.on .smx-pill-t{opacity:0}
.smx-pill0 .smx-pill-glow{background:radial-gradient(circle at center bottom,#C8DFFB 0,transparent 70%)}
.smx-pill1 .smx-pill-glow{background:radial-gradient(circle at center bottom,#B4B2EB 0,transparent 70%)}
.smx-pill2 .smx-pill-glow{background:radial-gradient(circle at center bottom,#9AD4F3 0,transparent 70%)}
.smx-pill0 .smx-pill-g{background-image:linear-gradient(180deg,rgba(26,31,41,.89),#597BA7 70%)}
.smx-pill1 .smx-pill-g{background-image:linear-gradient(180deg,rgba(26,31,41,.89),#5A479F 70%)}
.smx-pill2 .smx-pill-g{background-image:linear-gradient(180deg,rgba(26,31,41,.89),#4284A5 70%)}
.smx-pill0.on{transform:translate3d(0,-14px,0) rotate(-8deg)}
.smx-pill1.on{transform:translate3d(0,-22px,0) rotate(3deg)}
.smx-pill2.on{transform:translate3d(0,-10px,0) rotate(8deg)}

.smx-row{display:flex;flex-direction:column;align-items:center;gap:60px;width:100%}
.smx-item{position:relative;display:flex;flex-direction:column;gap:18px;width:100%;max-width:350px;opacity:0;transform:translate3d(0,120px,0)}
.smx-item.on{opacity:1;transform:none;transition:opacity var(--dur,.8s) var(--ez,ease) var(--dl,0ms),transform var(--dur,.8s) var(--ez,ease) var(--dl,0ms)}
.smx-vis{position:relative;width:100%;aspect-ratio:5/6;border-radius:32px;overflow:hidden;isolation:isolate;-webkit-mask-image:-webkit-radial-gradient(white,black)}
.smx-bg{position:absolute;inset:0;pointer-events:none}
.smx-cap{display:flex;flex-direction:column;gap:8px;padding:0 8px;color:inherit;text-decoration:none}
.smx-cap h3{margin:0;font-size:18px;line-height:1.48;font-weight:600;letter-spacing:-.02em;color:#333840}
.smx-cap p{margin:0;font-size:16px;line-height:1.6;font-weight:400;letter-spacing:-.02em;color:#727780}
.smx-cap h3 span{display:block}

.smx-arw{position:absolute;right:32px;bottom:32px;z-index:3;width:48px;height:48px;border-radius:100px;overflow:hidden;
  background:rgba(7,25,76,.051);-webkit-backdrop-filter:blur(15px);backdrop-filter:blur(15px);border:1px solid rgba(7,25,76,.051);color:rgba(2,9,19,.91)}
.smx-arw-g{position:absolute;left:-1px;top:-1px;width:48px;height:48px}
.smx-arw:focus-visible{outline:2px solid #3182F6;outline-offset:3px}

/* 카드 바탕 — 토스 실측 색 표본으로 겹친 그러데이션(그림 파일 안 씀) */
.smx-bg1{background:
  radial-gradient(62% 42% at 100% 0%,#A2C0F3 0%,rgba(162,192,243,0) 100%),
  radial-gradient(45% 30% at 55% 0%,#C3D5F1 0%,rgba(195,213,241,0) 100%),
  radial-gradient(80% 48% at 100% 100%,#F8DCCE 0%,rgba(248,220,206,0) 100%),
  radial-gradient(60% 34% at 0% 100%,#ECE9F6 0%,rgba(236,233,246,0) 100%),
  radial-gradient(34% 34% at 0% 52%,#B8CCEE 0%,rgba(184,204,238,0) 100%),
  radial-gradient(48% 26% at 0% 0%,#E1ECEE 0%,rgba(225,236,238,0) 100%),
  radial-gradient(50% 30% at 75% 52%,#DCDCE8 0%,rgba(220,220,232,0) 100%),
  linear-gradient(180deg,#CFDDF1 0%,#D6E0EF 38%,#E2E0EA 62%,#F1E4E0 100%)}
.smx-bg1-streak{position:absolute;inset:-10%;background:linear-gradient(100deg,rgba(255,255,255,0) 22%,rgba(244,246,252,.55) 30%,rgba(252,244,236,.7) 36%,rgba(255,255,255,0) 47%);filter:blur(16px);
  -webkit-mask-image:linear-gradient(180deg,rgba(0,0,0,.35) 0%,#000 45%);mask-image:linear-gradient(180deg,rgba(0,0,0,.35) 0%,#000 45%)}
.smx-bg2{background:
  radial-gradient(55% 40% at 0% 100%,#93BAF8 0%,rgba(147,186,248,0) 100%),
  radial-gradient(45% 35% at 100% 100%,#D4E7F8 0%,rgba(212,231,248,0) 100%),
  radial-gradient(50% 30% at 0% 0%,#C6D7F5 0%,rgba(198,215,245,0) 100%),
  linear-gradient(180deg,#B3D0F6 0%,#B7D1F6 45%,#BCD5F6 100%)}
.smx-bg2-blob{position:absolute;left:74%;top:70%;width:132%;height:94%;transform:translate(-50%,-50%) rotate(-8deg);border-radius:50%;
  background:radial-gradient(ellipse at 30% 42%,#F1F7FE 0%,#E5F1FD 40%,#DCEEFB 72%,rgba(214,234,250,.75) 100%);filter:blur(7px);
  -webkit-mask-image:linear-gradient(205deg,transparent 12%,#000 42%);mask-image:linear-gradient(205deg,transparent 12%,#000 42%)}
.smx-bg3{background:
  radial-gradient(60% 46% at 100% 100%,#B7CEF8 0%,rgba(183,206,248,0) 100%),
  radial-gradient(70% 40% at 45% 100%,#C8D6F4 0%,rgba(200,214,244,0) 100%),
  radial-gradient(48% 36% at 12% 44%,#D3E5F1 0%,rgba(211,229,241,0) 100%),
  radial-gradient(55% 26% at 0% 0%,#E6E7F0 0%,rgba(230,231,240,0) 100%),
  linear-gradient(180deg,#EAE6EF 0%,#E1E6F0 32%,#D5DFF2 66%,#C6D6F5 100%)}
.smx-bg3-blob{position:absolute;left:85%;top:25%;width:85%;height:55%;transform:translate(-50%,-50%) rotate(12deg);border-radius:50%;
  background:radial-gradient(ellipse at 62% 40%,#F1EAF8 0%,#EDE6F7 55%,rgba(234,228,246,.85) 100%);filter:blur(5px)}

/* 무대(500×600) */
.smx-stage{position:absolute;left:50%;top:50%;width:500px;height:600px;margin:-300px 0 0 -250px;transform:scale(var(--s,.645));transform-origin:50% 50%;pointer-events:none}
.smx-panel{position:absolute;left:50px;top:90px;width:400px;height:510px;display:flex;flex-direction:column}

/* 카드 1 */
.smx-p1{border-radius:36px;padding:44px 0 0 40px;gap:6px;
  background:radial-gradient(71.44% 97.84% at 30.17% 2.16%,rgba(255,255,255,.9) 0,rgba(255,255,255,.6) 100%);
  -webkit-mask-image:radial-gradient(125% 110.09% at 8.9% 9.3%,#000 46.88%,rgba(0,0,0,.5) 74.64%,transparent 100%);
  mask-image:radial-gradient(125% 110.09% at 8.9% 9.3%,#000 46.88%,rgba(0,0,0,.5) 74.64%,transparent 100%)}
.smx-d1-label{font-size:16px;font-weight:500;line-height:19.2px;color:rgba(114,119,128,.4);letter-spacing:-.01em}
.smx-d1-rate{height:24px}
.smx-d1-num{position:relative;display:inline-flex;align-items:flex-start;font-size:24px;font-weight:700;line-height:24px;color:#333840;letter-spacing:-.01em}
.smx-d1-ck{position:absolute;left:calc(100% + 6px);top:-1px;opacity:0;transform:scale(.6);transition:opacity .15s,transform .25s cubic-bezier(.2,.8,.3,1.3)}
.smx-d1-ck.on{opacity:1;transform:none}
.smx-odo{display:inline-flex;font-variant-numeric:tabular-nums}
.smx-dg{position:relative;display:inline-block;overflow:hidden;height:24px}
.smx-dg-sz{visibility:hidden}
.smx-dg-a{position:absolute;left:0;top:0}
.smx-dg-in{animation:smx-dg-in .2s cubic-bezier(.2,.7,.3,1) both}
.smx-dg-out{animation:smx-dg-out .2s cubic-bezier(.2,.7,.3,1) both}
@keyframes smx-dg-in{from{transform:translateY(calc(var(--d) * 100%));opacity:0}to{transform:none;opacity:1}}
@keyframes smx-dg-out{from{transform:none;opacity:1}to{transform:translateY(calc(var(--d) * -100%));opacity:0}}
.smx-d1-list{display:flex;flex-direction:column;gap:10px;margin-top:32px}
.smx-d1-row{position:relative;width:360px;height:60px;border-radius:16px;padding:14px 15px;overflow:hidden}
.smx-d1-bar{position:absolute;left:0;top:0;bottom:0;width:0;border-radius:16px;background:#fff;animation:2.6s linear infinite both;animation-play-state:paused}
.smx-d1-list.run .smx-d1-bar{animation-play-state:running}
.smx-d1-bar0{animation-name:smx-bar0}.smx-d1-bar1{animation-name:smx-bar1}.smx-d1-bar2{animation-name:smx-bar2}.smx-d1-bar3{animation-name:smx-bar3}.smx-d1-bar4{animation-name:smx-bar4}
.smx-d1-list.on .smx-d1-bar{animation:none;width:90%}
@keyframes smx-bar0{0%,0.00%{width:0}16.15%,88.46%{width:90%}99.62%,100%{width:0}}
@keyframes smx-bar1{0%,6.15%{width:0}22.31%,88.46%{width:80%}99.62%,100%{width:0}}
@keyframes smx-bar2{0%,12.31%{width:0}28.46%,88.46%{width:70%}99.62%,100%{width:0}}
@keyframes smx-bar3{0%,18.46%{width:0}34.62%,88.46%{width:60%}99.62%,100%{width:0}}
@keyframes smx-bar4{0%,24.62%{width:0}40.77%,88.46%{width:50%}99.62%,100%{width:0}}
.smx-d1-in{position:relative;display:flex;align-items:center;height:100%;gap:10px;opacity:0;transform:translate3d(24px,0,0);
  transition:opacity .17s ease,transform 0s linear .17s}
.smx-d1-list.on .smx-d1-in{opacity:1;transform:none;transition:opacity .35s cubic-bezier(.16,1,.3,1),transform .35s cubic-bezier(.16,1,.3,1)}
.smx-d1-ic{display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:10px;flex:none}
.smx-d1-name{font-size:19px;font-weight:600;color:#1A1F29;letter-spacing:-.02em;white-space:nowrap}
.smx-d1-score{font-size:19px;font-weight:600;color:#2972E8;letter-spacing:-.01em}

/* 카드 2 */
.smx-flip{position:absolute;left:134px;top:134px;width:226px;height:336px;perspective:1300px}
.smx-flip-float,.smx-flip-lift,.smx-flip-rot,.smx-flip-layer{position:absolute;inset:0;transform-style:preserve-3d}
.smx-flip.run .smx-flip-float{animation:smx-wob 2.25s ease-in-out infinite alternate}
@keyframes smx-wob{from{transform:translate(-2px,2px) scale(.99) rotateX(-.8deg) rotateZ(-1.2deg)}to{transform:translate(3px,-5px) scale(1.01) rotateX(1.2deg) rotateZ(1.4deg)}}
.smx-flip-lift{transition:transform .25s cubic-bezier(.2,.7,.3,1)}
.smx-flip.on .smx-flip-lift{transform:translateY(-3px) scale(1.03) rotateX(1.6deg) rotateZ(-1deg)}
.smx-flip-rot{transition:transform .73s cubic-bezier(.12,.8,.2,1)}
.smx-flip.on .smx-flip-rot{transform:rotateY(-180deg)}
.smx-face{position:absolute;inset:0;border-radius:22px;overflow:hidden;-webkit-backface-visibility:hidden;backface-visibility:hidden;background:#fff;
  box-shadow:0 12px 24px rgba(59,96,145,.10),inset 0 0 0 1px rgba(0,0,0,.02)}
.smx-face-bk{transform:rotateY(180deg)}
.smx-face-pale{opacity:.72}
.smx-pro-ph{position:absolute;left:10px;top:10px;right:10px;height:196px;border-radius:14px;overflow:hidden;background:#1d2340}
.smx-pro-ph img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:39% 78%;transform:scale(1.9);transform-origin:39% 78%}
.smx-pro-b{position:absolute;left:24px;right:20px;bottom:24px;display:flex;flex-direction:column;gap:8px}
.smx-pro-tags{display:flex;flex-wrap:wrap;gap:4px}
.smx-pro-tags span{font-size:12px;font-weight:600;line-height:16px;padding:3px 7px;border-radius:6px;background:#F2F4F6;color:#4E5968;letter-spacing:-.02em;white-space:nowrap}
.smx-pro-star{font-size:17px;font-weight:700;line-height:22.95px;color:#333840;letter-spacing:-.01em}
.smx-pro-star b{color:#FFB331;font-weight:700}
.smx-face-iri{background:linear-gradient(142deg,#F4F1FF 0%,#DDEAFF 26%,#FBE8F4 48%,#E0F0FF 70%,#EEE9FF 100%)}
.smx-iri-sheen{position:absolute;inset:0;background:linear-gradient(118deg,rgba(255,255,255,0) 28%,rgba(255,255,255,.75) 42%,rgba(255,236,250,.35) 50%,rgba(255,255,255,0) 62%)}
.smx-back{position:absolute;inset:0;padding:24px 20px 26px;display:flex;flex-direction:column;justify-content:flex-end}
.smx-back-t{margin-bottom:16px;font-size:13px;font-weight:500;line-height:17.55px;color:#727780;letter-spacing:-.01em}
.smx-back-rows{display:flex;flex-direction:column;gap:13px}
.smx-back-row{display:flex;align-items:center;gap:8px}
.smx-back-l{width:58px;flex:none;font-size:13px;font-weight:600;color:#4E5968;letter-spacing:-.02em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.smx-back-bar{position:relative;flex:1;height:5px;border-radius:5px;background:rgba(49,130,246,.12);overflow:hidden}
.smx-back-bar i{position:absolute;left:0;top:0;bottom:0;border-radius:5px;background:linear-gradient(90deg,#8AB8FA,#3182F6)}
.smx-back-s{width:26px;text-align:right;font-size:14px;font-weight:700;color:#333840}

/* 카드 3 */
.smx-p3{border-radius:32px;padding:36px 32px 0;gap:8px;
  background:radial-gradient(66.37% 90.27% at 65% 9.73%,rgba(255,255,255,.9) 0,rgba(255,255,255,.6) 100%);
  -webkit-mask-image:radial-gradient(110% 75% at 62.4% 24.4%,#000 73.5%,transparent 100%);
  mask-image:radial-gradient(110% 75% at 62.4% 24.4%,#000 73.5%,transparent 100%)}
.smx-d3-status{height:19px;font-size:16px;font-weight:500;line-height:19px;color:rgba(114,119,128,.4);letter-spacing:-.01em}
.smx-d3-done{display:inline-flex;align-items:center;gap:5px}
.smx-d3-title{font-size:24px;font-weight:700;line-height:24px;color:#333840;letter-spacing:-.02em}
.smx-d3-list{display:flex;flex-direction:column;gap:8px;margin-top:8px;overflow:hidden}
.smx-d3-row{display:flex;align-items:center;justify-content:space-between;height:60px;flex:none;padding:0 14px;border-radius:16px;
  background:rgba(255,255,255,.4);border:1px solid rgba(255,255,255,.6);transition:background-color .28s ease-in-out,border-color .28s ease-in-out}
.smx-p3.on .smx-d3-row.best{background:rgb(234,242,254);border-color:#3182F6;transition-duration:.29s}
.smx-d3-left{display:flex;align-items:center;gap:8px}
.smx-d3-ic{flex:none}
.smx-d3-label{font-size:19px;font-weight:600;color:rgba(26,31,41,.89);letter-spacing:-.02em;white-space:nowrap}
.smx-p3.on .smx-d3-label{color:#000}
.smx-spin{flex:none;animation:smx-spin .9s steps(8) infinite;animation-play-state:paused}
.smx-p3.run .smx-spin{animation-play-state:running}
@keyframes smx-spin{to{transform:rotate(360deg)}}
.smx-d3-badge{flex:none;font-size:14px;font-weight:600;line-height:1;padding:4px 8px;border-radius:13px;background:rgba(7,25,76,.05);color:#4E5968;
  animation:smx-badge .285s cubic-bezier(.22,.61,.36,1) both}
.smx-d3-badge.best{background:rgba(49,130,246,.16);color:#1B64DA}
@keyframes smx-badge{from{opacity:0;transform:translate3d(32px,0,0)}to{opacity:1;transform:none}}

/* 태블릿 */
@media (min-width:768px){
  .smx{padding:180px 40px 0}
  .smx-h2{font-size:42px}
  .smx-body{margin-top:64px;gap:40px}
  .smx-sub{font-size:30px}
  .smx-pills{font-size:24px}
  .smx-item{max-width:448px;gap:22px}
  .smx-cap h3{font-size:20px;font-weight:700}
}
/* 데스크톱 — 토스 실측 계단(≤1440 · 1441~1600 · 1601~): 글자 48/52/64 · 부제 32/32/40 · 카드 글 20·16 → 24·18 · 옆 여백 48/160/210.
   아래 여백은 0 — 경력 장면(cr-sec) 위 여백 200 이 토스의 블록 사이 200 을 맡는다(한 섹션을 두 장면으로 나눈 것) */
@media (min-width:1024px){
  .smx{padding:200px 48px 0}
  .smx-h2{font-size:48px}
  .smx-body{margin-top:80px;gap:60px}
  .smx-sub{font-size:32px;flex-wrap:nowrap;white-space:nowrap}
  .smx-pills{font-size:26px;flex-wrap:nowrap}
  .smx-pill{padding:5.5px 11.5px;border-radius:42px}
  .smx-row{flex-direction:row;align-items:flex-start;gap:0}
  .smx-item{flex:1 1 0;min-width:0;max-width:none;gap:28px}
  .smx-vis{border-radius:0}
  .smx-cap h3{font-size:20px}
  .smx-cap p{font-size:16px}
}
/* 1025~1280 은 그림↔글 사이 20 · 알약 높이 45(토스 실측) */
@media (min-width:1024px) and (max-width:1280px){ .smx-item{gap:20px} .smx-pills{font-size:23px} .smx-pill{padding:5.5px 11px} }
@media (min-width:1441px){ .smx{padding:240px 160px 0} .smx-h2{font-size:52px} .smx-body{margin-top:120px} }
/* 알약만 1600 부터 커진다(토스 실측: 1599=49px 높이, 1600=58px) */
@media (min-width:1600px){ .smx-pills{font-size:32.5px} .smx-pill{padding:5.5px 12px;border-radius:44px} }
@media (min-width:1920px){ .smx-pill{padding:6px 14px;border-radius:52px} }
@media (min-width:1601px){
  .smx{padding:240px 210px 0}
  .smx-h2{font-size:64px}
  .smx-body{margin-top:160px;gap:40px}
  .smx-sub{font-size:40px}
  .smx-cap h3{font-size:24px}
  .smx-cap p{font-size:18px}
}

.smx-still *,.smx-still *::before,.smx-still *::after{transition:none!important;animation:none!important}
.smx-still .smx-dg-out{display:none}
`;

type CardKey = 'match' | 'flip' | 'report';

function DemoCard({
  i, kind, still, canHover, hovered, setHover, fired, mode,
}: {
  i: number; kind: CardKey; still: boolean; canHover: boolean; hovered: boolean;
  setHover: (i: number | null) => void; fired: boolean; mode: Mode;
}) {
  const t = useT();
  const card = MATCH.cards[i];
  const visRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const run = useVisible(visRef);
  const [auto, setAuto] = useState(false);

  // 무대 배율 — 데스크톱은 카드 너비/500(토스 0.895@448), 모바일 · 태블릿은 0.645@350 비율(패널 아래 모서리가 보이게)
  useEffect(() => {
    const vis = visRef.current, st = stageRef.current;
    if (!vis || !st) return undefined;
    const apply = () => {
      const w = vis.clientWidth;
      st.style.setProperty('--s', String(window.innerWidth >= 1024 ? w / 500 : (w * 0.645) / 350));
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(vis);
    return () => ro.disconnect();
  }, []);

  // 터치 기기 — 화면 안에서 분석 중 ↔ 결과를 저절로 오간다(토스 모바일처럼)
  useEffect(() => {
    if (canHover || still || !run) { setAuto(false); return undefined; }
    let alive = true;
    let tm = 0;
    const step = (next: boolean) => {
      tm = window.setTimeout(() => {
        if (!alive) return;
        setAuto(next);
        step(!next);
      }, next ? 1800 + i * 300 : 3600);
    };
    step(true);
    return () => { alive = false; window.clearTimeout(tm); };
  }, [canHover, still, run, i]);

  const active = hovered || auto;
  const demo = { active, run, still };
  const dlDesk = 200 + i * 200;
  const style = {
    '--dl': `${mode === 'desk' ? dlDesk : i * 200}ms`,
    '--dur': mode === 'desk' ? '780ms' : '800ms',
    '--ez': mode === 'desk' ? 'cubic-bezier(.3,.2,.3,1)' : 'ease',
  } as CSSProperties;

  return (
    <div
      className={`smx-item${fired ? ' on' : ''}`}
      style={style}
      onPointerEnter={(e) => { if (e.pointerType === 'mouse') setHover(i); }}
      onPointerLeave={(e) => { if (e.pointerType === 'mouse') setHover(null); }}
      data-card={kind}
    >
      <div className="smx-vis" ref={visRef}>
        <div className={`smx-bg smx-bg${i + 1}`}>
          {i === 0 && <div className="smx-bg1-streak" />}
          {i === 1 && <div className="smx-bg2-blob" />}
          {i === 2 && <div className="smx-bg3-blob" />}
        </div>
        <div className="smx-stage" ref={stageRef} aria-hidden>
          {kind === 'match' && <MatchDemo card={card as unknown as MatchCardData} t={t} {...demo} />}
          {kind === 'flip' && <FlipDemo card={card as unknown as FlipCardData} t={t} {...demo} />}
          {kind === 'report' && <ReportDemo card={card as unknown as ReportCardData} t={t} {...demo} />}
        </div>
        <ArrowButton href={card.href} label={t(card.cta)} />
      </div>
      <Link href={card.href} className="smx-cap">
        <h3>{card.caption.map((c, k) => <span key={k}>{t(c)}</span>)}</h3>
        <p>{t(card.cta)}</p>
      </Link>
    </div>
  );
}

export default function SceneMatch() {
  const t = useT();
  const { lang } = useBizLang();
  const mode = useMode();
  const [still, setStill] = useState(false);
  const [canHover, setCanHover] = useState(true);
  const [hoverCard, setHoverCard] = useState<number | null>(null);
  const [hoverPill, setHoverPill] = useState<number | null>(null);
  const [split, setSplit] = useState<'wait' | 'go' | 'done'>('wait');

  const h2Ref = useRef<HTMLHeadingElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const subRef = useRef<HTMLParagraphElement>(null);
  const pillsRef = useRef<HTMLSpanElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setStill(prefersReducedMotion());
    try { setCanHover(window.matchMedia('(hover: hover) and (pointer: fine)').matches); } catch { /* 기본값 */ }
  }, []);

  // 트리거 선(요소 위 끝, 화면 위에서) — 데스크톱: 제목 50% · 블록 52% · 알약 30% / 모바일: 제목 50% · 부제 56% · 카드 73%
  const desk = mode === 'desk';
  const h2On = useFire(h2Ref, 0.5);
  const subOn = useFire(desk ? bodyRef : subRef, desk ? 0.52 : 0.56);
  const cardsOn = useFire(desk ? bodyRef : rowRef, desk ? 0.52 : 0.73);
  const splitOn = useFire(subRef, 0.3, desk && split === 'wait');

  // 알약 벌어짐 — 데스크톱에서 한 줄일 때만. 벌어지기 전엔 앞뒤 글이 (알약 묶음+틈)/2 만큼 안쪽으로 붙어 한 문장처럼
  useEffect(() => {
    const p = subRef.current, g = pillsRef.current;
    if (!p || !g) return undefined;
    const measure = () => {
      p.style.setProperty('--shift', `${(g.offsetWidth + 4) / 2}px`);
      const lh = parseFloat(getComputedStyle(p).lineHeight) || 45;
      const oneLine = p.offsetHeight < lh * 1.6 + 12;
      if (!desk || !oneLine || still) setSplit('done');
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(g);
    return () => ro.disconnect();
  }, [desk, still, lang]);

  useEffect(() => {
    if (splitOn && split === 'wait') setSplit('go');
  }, [splitOn, split]);

  const allOn = still;
  const pillOn = (i: number) => hoverPill === i || hoverCard === i;
  const title = MATCH.title.map((l) => t(l));
  let wi = 0;
  const prefix = t(MATCH.subPrefix);

  return (
    <section id="dock-match" className={`smx${still ? ' smx-still' : ''}`}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <h2
        ref={h2Ref}
        className={`smx-h2${h2On || allOn ? ' on' : ''}`}
        style={{ '--ez': desk ? 'cubic-bezier(.4,.3,0,1)' : 'ease' } as CSSProperties}
        aria-label={title.join(' ')}
      >
        {title.map((line, li) => {
          const words = line.split(' ').filter(Boolean);
          return (
            <span className="smx-h2-line" key={li} aria-hidden>
              {words.map((w, j) => {
                const k = wi++;
                const dl = desk ? k * 100 : li * 266 + j * 67;
                return (
                  <span key={j}>
                    {j > 0 && ' '}
                    <span className="smx-w" style={{ '--dl': `${dl}ms` } as CSSProperties}>{w}</span>
                  </span>
                );
              })}
            </span>
          );
        })}
      </h2>

      <div className="smx-body" id="match-finance" ref={bodyRef}>
        <p
          ref={subRef}
          className={`smx-sub${subOn || allOn ? ' on' : ''}${split === 'wait' ? ' split-wait' : split === 'go' ? ' split-go' : ''}`}
          style={desk ? { transition: subOn ? 'opacity .68s cubic-bezier(.2,0,.25,1), transform .68s cubic-bezier(.2,0,.25,1)' : undefined } : undefined}
        >
          {prefix && <span className="smx-sub-l">{prefix}</span>}
          <span className="smx-pills" ref={pillsRef}>
            {MATCH.subPills.map((pl, i) => (
              <span
                key={i}
                className={`smx-pill smx-pill${i}${pillOn(i) ? ' on' : ''}`}
                onPointerEnter={(e) => { if (e.pointerType === 'mouse') setHoverPill(i); }}
                onPointerLeave={(e) => { if (e.pointerType === 'mouse') setHoverPill(null); }}
              >
                <span className="smx-pill-glow" />
                <span className="smx-pill-t">{t(pl)}</span>
                <span className="smx-pill-g" aria-hidden>{t(pl)}</span>
              </span>
            ))}
          </span>
          <span className="smx-sub-r">{t(MATCH.subSuffix)}</span>
        </p>

        <div className="smx-row" ref={rowRef}>
          {(['match', 'flip', 'report'] as const).map((k, i) => (
            <DemoCard
              key={k}
              i={i}
              kind={k}
              still={still}
              canHover={canHover}
              hovered={hoverCard === i}
              setHover={setHoverCard}
              fired={cardsOn || allOn}
              mode={mode}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

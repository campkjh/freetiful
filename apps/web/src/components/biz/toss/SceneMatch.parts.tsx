'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { KeywordOrb, type KeywordOrbText } from '@/components/pros/ReviewKeywordOrb';
import { getT, useBizLang } from '@/lib/biz/i18n';
import type { Tr } from './content';

/*
 * 매칭 장면 카드 속 움직이는 화면 3종(토스 '금융' 카드 데모의 움직임 · 치수만 따라 우리 데이터로 다시 그림).
 * 카드 1 · 3 좌표는 500×600 무대 px — 카드 너비에 맞춰 무대째 줄인다(SceneMatch 의 --s). 카드 2(언급 키워드 판, 261009)만 무대 밖 진짜 px.
 */

type T = (tr: Tr) => string;
export type DemoState = { active: boolean; run: boolean; still: boolean };

export type MatchCardData = { demoTitle: Tr; demoLabel: Tr; rows: Tr[]; scores: number[] };
export type OrbCardData = { orb: { titleTop: Tr; titleStrong: Tr; titleRest: Tr; orbLines: readonly Tr[]; keywords: readonly Tr[] } };
export type ReportCardData = { demoTitle: Tr; analyzing: Tr; rows: Tr[]; scores: number[]; best: Tr };

/* ── 숫자 굴림(오도미터) ─────────────────────────────── */

function Digit({ d }: { d: string }) {
  const [s, setS] = useState({ cur: d, prev: '', dir: 1, k: 0 });
  useEffect(() => {
    setS((o) => (o.cur === d ? o : { cur: d, prev: o.cur, dir: Number(d) >= Number(o.cur) ? 1 : -1, k: o.k + 1 }));
  }, [d]);
  const v = { '--d': s.dir } as CSSProperties;
  return (
    <span className="smx-dg">
      <span className="smx-dg-sz">{s.cur}</span>
      {s.k > 0 && <span key={`o${s.k}`} className="smx-dg-a smx-dg-out" style={v}>{s.prev}</span>}
      <span key={`i${s.k}`} className={`smx-dg-a${s.k > 0 ? ' smx-dg-in' : ''}`} style={v}>{s.cur}</span>
    </span>
  );
}

function Odometer({ value }: { value: string }) {
  const cs = value.split('');
  // 오른쪽 자리부터 같은 key — 자릿수가 같으면 바뀐 자리만 굴러간다
  return <span className="smx-odo">{cs.map((c, i) => <Digit key={cs.length - i} d={c} />)}</span>;
}

/* ── 아이콘 ─────────────────────────────── */

function CheckCircle({ className = '', size = 26 }: { className?: string; size?: number }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 26 26" aria-hidden>
      <circle cx="13" cy="13" r="13" fill="#3182F6" />
      <path d="M7.6 13.4l3.6 3.5 7.2-7.6" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const PERSON_TINT = [
  ['#3182F6', 'rgba(49,130,246,.13)'],
  ['#8B95A1', 'rgba(139,149,161,.15)'],
  ['#13B4A6', 'rgba(19,180,166,.14)'],
  ['#F2B100', 'rgba(242,177,0,.15)'],
  ['#B0B8C1', 'rgba(176,184,193,.16)'],
];

function PersonBadge({ i }: { i: number }) {
  const [fg, bg] = PERSON_TINT[i % PERSON_TINT.length];
  return (
    <span className="smx-d1-ic" style={{ background: bg }}>
      <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden>
        <circle cx="10" cy="6.6" r="3.6" fill={fg} />
        <path d="M3.4 17.2c.5-3.6 3.2-5.6 6.6-5.6s6.1 2 6.6 5.6c.06.45-.3.8-.75.8H4.15c-.45 0-.81-.35-.75-.8Z" fill={fg} />
      </svg>
    </span>
  );
}

/** 리포트 항목 아이콘 — 경력 · 만족도 · 구성력 · 위트 · 발성 */
const REPORT_COLORS = ['#FFB331', '#F04452', '#3182F6', '#FF8A3D', '#1FC39B'];
function ReportIcon({ i, on }: { i: number; on: boolean }) {
  const c = on ? REPORT_COLORS[i % REPORT_COLORS.length] : '#B9C0C8';
  const k = i % 5;
  return (
    <svg className="smx-d3-ic" width="32" height="32" viewBox="0 0 24 24" aria-hidden>
      {k === 0 && (
        <g fill={c}>
          <path d="M6.5 3.5h11v4.6a5.5 5.5 0 0 1-11 0V3.5Z" />
          <path d="M6.5 5H3.8v1.2a3.6 3.6 0 0 0 3.4 3.6M17.5 5h2.7v1.2a3.6 3.6 0 0 1-3.4 3.6" fill="none" stroke={c} strokeWidth="1.8" />
          <path d="M10.6 13.2h2.8v3.6h-2.8z" />
          <rect x="7.4" y="17.4" width="9.2" height="3.1" rx="1.2" />
        </g>
      )}
      {k === 1 && <path fill={c} d="M12 20.6s-7.4-4.5-9.3-9C1.3 8.3 3.3 4.6 6.9 4.6c2 0 3.4 1.1 5.1 2.9 1.7-1.8 3.1-2.9 5.1-2.9 3.6 0 5.6 3.7 4.2 7-1.9 4.5-9.3 9-9.3 9Z" />}
      {k === 2 && (
        <g fill={c}>
          <rect x="3.5" y="3.6" width="17" height="4.4" rx="1.6" />
          <rect x="3.5" y="9.8" width="17" height="4.4" rx="1.6" opacity=".8" />
          <rect x="3.5" y="16" width="11" height="4.4" rx="1.6" opacity=".6" />
        </g>
      )}
      {k === 3 && (
        <g>
          <circle cx="12" cy="12" r="9" fill={c} />
          <circle cx="9" cy="10" r="1.3" fill="#fff" />
          <circle cx="15" cy="10" r="1.3" fill="#fff" />
          <path d="M8.2 13.6a4.3 4.3 0 0 0 7.6 0" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
        </g>
      )}
      {k === 4 && (
        <g>
          <rect x="8.8" y="2.8" width="6.4" height="11.4" rx="3.2" fill={c} />
          <path d="M5.6 10.8a6.4 6.4 0 0 0 12.8 0M12 17.4v3.4" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" />
        </g>
      )}
    </svg>
  );
}

function Spinner() {
  return (
    <svg className="smx-spin" width="32" height="32" viewBox="0 0 32 32" aria-hidden>
      {Array.from({ length: 8 }, (_, i) => {
        const a = (i * Math.PI) / 4;
        const x1 = 16 + Math.sin(a) * 6.5, y1 = 16 - Math.cos(a) * 6.5;
        const x2 = 16 + Math.sin(a) * 11, y2 = 16 - Math.cos(a) * 11;
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#AEB5BE" strokeWidth="2.4" strokeLinecap="round" opacity={1 - i * 0.11} />;
      })}
    </svg>
  );
}

/* ── 카드 1: 적합도 분석(굴러가는 숫자 + 뼈대 막대) ─────────────────────────────── */

const IDLE_VALUES = [82, 74, 91, 68, 87];

export function MatchDemo({ card, t, active, run, still }: { card: MatchCardData; t: T } & DemoState) {
  const [vi, setVi] = useState(0);
  const on = active || still;
  useEffect(() => {
    if (on || !run) return undefined;
    const id = window.setInterval(() => setVi((v) => (v + 1) % IDLE_VALUES.length), 650);
    return () => window.clearInterval(id);
  }, [on, run]);
  const top = Math.max(...card.scores);
  const value = on ? top : IDLE_VALUES[vi];
  return (
    <div className="smx-panel smx-p1">
      <div className="smx-d1-label">{t(on ? card.demoLabel : card.demoTitle)}</div>
      <div className="smx-d1-rate">
        <span className="smx-d1-num">
          <Odometer value={String(value)} />%
          <CheckCircle className={`smx-d1-ck${on ? ' on' : ''}`} />
        </span>
      </div>
      <div className={`smx-d1-list${on ? ' on' : ''}${run ? ' run' : ''}`}>
        {card.rows.map((r, i) => (
          <div className="smx-d1-row" key={i}>
            <div className={`smx-d1-bar smx-d1-bar${i}`} />
            <div className="smx-d1-in" style={{ transitionDelay: on ? `${i * 40}ms` : '0ms' }}>
              <PersonBadge i={i} />
              <span className="smx-d1-name">{t(r)}</span>
              <span className="smx-d1-score">{card.scores[i]}%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── 카드 2: 사회자 상세 '언급 키워드' 판(보라 원 안 반짝이 별) ─────────────────────────────
 * 261009 사장 '사회자 상세페이지에 동그라미 하고 안에 별 있는 거, 그걸로 해줘 똑같이' — 예전 사진 / 후기 6항목 뒤집기 카드 자리.
 * 상세 화면이 쓰는 KeywordOrb(components/pros/ReviewKeywordOrb)를 고치지 않고 그대로 쓴다(ReviewKeywordOrb 는 한국어 글을 만들어
 * 비즈 4개 언어를 못 받아서, 같은 판에 글만 넣는 named export 쪽). 판은 제 폭을 재서 칩을 놓으므로 500×600 무대(배율) 밖,
 * 카드(.smx-vis) 안에 진짜 px 폭으로 놓는다(SceneMatch .smx-orb*).
 * 등장 = 판 고유의 것(점 → 제목 → 원 커짐 → 반짝이 → 칩 톡 · 체크 배지, 이후 칩 둥실 · 원 숨쉬기). 카드가 떠오르기 전에 판이 혼자
 * 재생되지 않게, 카드가 켜지고(fired) 화면 안일 때(visible) 붙인다 — 판의 6초 폴백이 화면 밖에서 먼저 터지는 것도 막는다.
 */
export function OrbDemo({ card, fired, visible, still, delay, hovered }: { card: OrbCardData; fired: boolean; visible: boolean; still: boolean; delay: number; hovered: boolean }) {
  const { lang } = useBizLang();
  const [mount, setMount] = useState(still);
  useEffect(() => {
    if (still) { setMount(true); return undefined; }
    if (mount || !fired || !visible) return undefined;
    const id = window.setTimeout(() => setMount(true), delay);
    return () => window.clearTimeout(id);
  }, [fired, visible, still, mount, delay]);
  /*
   * 마우스를 올리면 판 고유의 등장을 한 번 더(261009 검증 — 옆 두 카드는 올리면 데모가 도는데 이 카드만 반응이 없었다).
   * 첫 등장 · 직전 재생 뒤 2.6초(등장이 다 끝나는 시간) 안에 다시 올린 것은 무시 — 카드 사이를 오가며 판이 깜빡이지 않게.
   */
  const [play, setPlay] = useState(0);
  const lastPlay = useRef(0);
  useEffect(() => {
    if (!mount || still) return;
    const now = performance.now();
    if (!lastPlay.current) { lastPlay.current = now; return; }
    if (!hovered || now - lastPlay.current < 2600) return;
    lastPlay.current = now;
    setPlay((p) => p + 1);
  }, [hovered, mount, still]);
  const o = card.orb;
  const text = useMemo<KeywordOrbText>(() => {
    const t = (tr: Tr) => getT(tr, lang);
    return {
      titleTop: t(o.titleTop),
      titleStrong: t(o.titleStrong),
      titleRest: t(o.titleRest),
      orbLines: [t(o.orbLines[0]), t(o.orbLines[1])],
      primary: o.keywords.slice(0, 4).map(t),
      secondary: o.keywords.slice(4, 8).map(t),
    };
  }, [o, lang]);
  return (
    <>
      <div className="smx-orbp" />
      {/* 카드가 화면 밖이면 판의 끝없는 움직임(원 숨쉬기 · 반짝임 · 칩 둥실)을 멈춘다 — 옆 카드들과 같게(SceneMatch .smx-orbw.paused · 261009 검증) */}
      <div className={`smx-orbw${mount && !visible && !still ? ' paused' : ''}`}>
        {/* key = 언어 · 다시 재생 — 바뀌면 판을 새로 그려 칩 폭 · 제목 맞춤을 처음부터 다시 재고 등장도 처음부터 */}
        {mount && <KeywordOrb key={`${lang}-${play}`} text={text} still={still} />}
      </div>
    </>
  );
}

/* ── 카드 3: 진행자 리포트(돌기 → 점수 배지, 5.0 은 '최고') ─────────────────────────────── */

export function ReportDemo({ card, t, active, run, still }: { card: ReportCardData; t: T } & DemoState) {
  const on = active || still;
  const top = Math.max(...card.scores);
  return (
    <div className={`smx-panel smx-p3${on ? ' on' : ''}${run ? ' run' : ''}`}>
      <div className="smx-d3-status">
        {on ? (
          <span className="smx-d3-done"><CheckCircle size={16} />{t(card.best)} {top.toFixed(1)}</span>
        ) : t(card.analyzing)}
      </div>
      <div className="smx-d3-title">{t(card.demoTitle)}</div>
      <div className="smx-d3-list">
        {card.rows.map((r, i) => {
          const best = card.scores[i] >= top;
          const badgeDelay = 300 + i * 80;
          return (
            <div
              className={`smx-d3-row${best ? ' best' : ''}`}
              key={i}
              style={{ transitionDelay: on && best ? `${badgeDelay + 285}ms` : '0ms' }}
            >
              <span className="smx-d3-left">
                <ReportIcon i={i} on={on} />
                <span className="smx-d3-label">{t(r)}</span>
              </span>
              {on ? (
                <span className={`smx-d3-badge${best ? ' best' : ''}`} style={{ animationDelay: `${badgeDelay}ms` }}>
                  {best ? `${t(card.best)} ${card.scores[i].toFixed(1)}` : card.scores[i].toFixed(1)}
                </span>
              ) : <Spinner />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── 둥근 화살표 버튼(올리면 화살표가 오른쪽으로 빠지고 왼쪽에서 새로 들어옴) ─────────────────────────────── */

function ArrowGlyph({ refEl, x }: { refEl: React.RefObject<SVGSVGElement>; x: string }) {
  return (
    <svg ref={refEl} className="smx-arw-g" viewBox="0 0 48 48" style={{ transform: `translateX(${x})` }} aria-hidden>
      <path d="M24 15L33 24L24 33M33 24H14" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ArrowButton({ href, label, children }: { href: string; label: string; children?: ReactNode }) {
  const a = useRef<SVGSVGElement>(null);
  const b = useRef<SVGSVGElement>(null);
  const shown = useRef<'a' | 'b'>('a');
  const run = (enter: boolean) => {
    const vis = shown.current === 'a' ? a.current : b.current;
    const hid = shown.current === 'a' ? b.current : a.current;
    if (!vis || !hid || typeof vis.animate !== 'function') return;
    const opt: KeyframeAnimationOptions = enter
      ? { duration: 600, easing: 'cubic-bezier(0.7,0,0.3,1)', fill: 'forwards' }
      : { duration: 400, easing: 'cubic-bezier(0.6,0,0.3,1)', fill: 'forwards' };
    const from = (el: SVGSVGElement, fb: string) => { const m = getComputedStyle(el).transform; return m && m !== 'none' ? m : fb; };
    // 중간에 끊겨도 지금 자리에서 이어 간다
    const vFrom = from(vis, 'translateX(0%)');
    const hFrom = from(hid, enter ? 'translateX(-200%)' : 'translateX(200%)');
    vis.getAnimations().forEach((x) => x.cancel());
    hid.getAnimations().forEach((x) => x.cancel());
    vis.animate([{ transform: vFrom }, { transform: enter ? 'translateX(200%)' : 'translateX(-200%)' }], opt);
    hid.animate([{ transform: hFrom }, { transform: 'translateX(0%)' }], opt);
    shown.current = shown.current === 'a' ? 'b' : 'a';
  };
  return (
    <Link
      href={href}
      aria-label={label}
      className="smx-arw"
      onPointerEnter={(e) => { if (e.pointerType === 'mouse') run(true); }}
      onPointerLeave={(e) => { if (e.pointerType === 'mouse') run(false); }}
    >
      <ArrowGlyph refEl={a} x="0%" />
      <ArrowGlyph refEl={b} x="-200%" />
      {children}
    </Link>
  );
}

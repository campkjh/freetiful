'use client';

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useT } from '@/lib/biz/i18n';
import { DOCK, INTRO } from './content';
import { prefersReducedMotion, scrollToElement } from '../scroll-to';
import { GlobeCanvas } from './TossChrome.globe';

/*
 * 비즈 페이지 왼쪽 눈금 · 바닥글(261008 토스 홈 어법 재구현). 머리줄은 261009 부터 공용 components/biz/BizHeader —
 * 옛 투명 → 반투명 유리 머리줄(BizNav) · 모바일 햄버거 메뉴는 사장 '헤더 opacity 없게 · 햄버거 필요없고'로 지웠다.
 * 토스에서 잰 치수 · 글자 · 색 · 움직임 곡선만 옮겨 우리 코드로 다시 짠 것 — 토스 코드 · CSS · 그림 · 글꼴은 쓰지 않는다.
 * 스크롤마다 리렌더하지 않는다: 상태는 data-* 속성 · 인라인 스타일로 직접 쓴다.
 */

const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

/** (x, y) 아래 가장 안쪽 [data-dock-theme] 가 dark 인지 — 장면이 어두운 무대 동안 붙여 둔다 */
function darkAt(x: number, y: number) {
  const els = document.querySelectorAll<HTMLElement>('[data-dock-theme]');
  let hit: HTMLElement | null = null;
  els.forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0 && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) hit = el; // 문서 순서상 뒤(안쪽 · 위층)가 이긴다
  });
  if (!hit) return false;
  const h = hit as HTMLElement;
  return h.dataset.dockTheme === 'dark' && getComputedStyle(h).visibility !== 'hidden';
}

/* ───────────────────────── 왼쪽 눈금 ───────────────────────── */

const DOCK_CSS = `
.tc-dock{position:fixed;left:24px;top:50%;transform:translateY(-50%);z-index:40;width:72px;display:none;--on:#1C1F25;--off:rgba(28,31,37,.18)}
.tc-dock[data-tone="light"]{--on:#fff;--off:rgba(255,255,255,.25)}
.tc-dock a{position:relative;display:block;width:72px;height:12px;outline-offset:2px}
.tc-dock-bar{position:absolute;left:0;top:5px;width:40px;height:2px;transform-origin:0 1px;transform:scaleX(.35);background:var(--off);transition:background-color .3s ease;pointer-events:none}
.tc-dock-bar[data-on="1"],.tc-dock-bar[data-hot="1"]{background:var(--on)}
.tc-dock-label{position:absolute;left:56px;top:6px;transform:translateY(-50%);white-space:nowrap;opacity:0;pointer-events:none;color:var(--on);font-size:15px;font-weight:600;line-height:21px;letter-spacing:0;transition:opacity .18s,top .18s ease-out,color .3s ease}
@media (min-width:1024px){ .tc-dock{display:block} }
`;

/** 토스식 왼쪽 세로 눈금 — 2px 막대 12px 간격, 지금 장면만 진하게, 어두운 무대 위에선 흰색, 마우스를 대면 가우스 확대 + 이름 */
export function DockIndicator() {
  const t = useT();
  const labels = DOCK.map((d) => t(d.label));
  const labelsRef = useRef(labels);
  labelsRef.current = labels;
  const navRef = useRef<HTMLElement>(null);
  const barRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const labelRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return undefined;
    const n = DOCK.length;
    const reduce = prefersReducedMotion();
    const scale = new Array(n).fill(0.35);
    const goal = new Array(n).fill(0.35);
    let hot = -1;
    let active = -1;
    let raf = 0;
    let last = 0;

    // 확대 = 지수 평활 τ≈85ms(넘침 없음)
    const loop = (now: number) => {
      const dt = last ? Math.min(64, now - last) : 16;
      last = now;
      const k = reduce ? 1 : 1 - Math.exp(-dt / 85);
      let moving = false;
      for (let i = 0; i < n; i++) {
        scale[i] += (goal[i] - scale[i]) * k;
        if (Math.abs(goal[i] - scale[i]) < 0.001) scale[i] = goal[i];
        else moving = true;
        const b = barRefs.current[i];
        if (b) b.style.transform = `scaleX(${scale[i].toFixed(4)})`;
      }
      if (moving) raf = requestAnimationFrame(loop);
      else { raf = 0; last = 0; }
    };
    const kick = () => { if (!raf) raf = requestAnimationFrame(loop); };

    const setHot = (i: number) => {
      if (i === hot) return;
      if (hot >= 0) barRefs.current[hot]?.removeAttribute('data-hot');
      hot = i;
      const lab = labelRef.current;
      if (i >= 0) {
        barRefs.current[i]?.setAttribute('data-hot', '1');
        if (lab) { lab.textContent = labelsRef.current[i]; lab.style.top = `${i * 12 + 6}px`; lab.style.opacity = '1'; }
      } else if (lab) lab.style.opacity = '0';
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      const r = nav.getBoundingClientRect();
      const y = e.clientY - r.top;
      for (let i = 0; i < n; i++) {
        const d = y - (i * 12 + 6);
        goal[i] = 0.35 + 0.65 * Math.exp(-(d * d) / (2 * 34 * 34));
      }
      setHot(Math.max(0, Math.min(n - 1, Math.floor(y / 12))));
      kick();
    };
    const onLeave = () => {
      goal.fill(0.35);
      setHot(-1);
      kick();
    };

    // 지금 장면 = 화면 가운데를 지나는 장면 뿌리 · 색 = 눈금 자리 아래가 어두운 무대인지
    let queued = false;
    const update = () => {
      queued = false;
      const mid = window.innerHeight / 2;
      let idx = -1;
      let lastAbove = -1;
      for (let i = 0; i < n; i++) {
        const el = document.getElementById(DOCK[i].id);
        if (!el) continue;
        const r = el.getBoundingClientRect();
        if (r.top <= mid) lastAbove = i;
        if (r.top <= mid && r.bottom >= mid) idx = i;
      }
      if (idx < 0) idx = lastAbove >= 0 ? lastAbove : 0;
      if (idx !== active) {
        if (active >= 0) barRefs.current[active]?.removeAttribute('data-on');
        active = idx;
        barRefs.current[idx]?.setAttribute('data-on', '1');
      }
      nav.dataset.tone = darkAt(31, mid) ? 'light' : 'dark';
    };
    const onScroll = () => { if (!queued) { queued = true; requestAnimationFrame(update); } };
    update();
    const iv = window.setInterval(update, 400);
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    nav.addEventListener('pointermove', onMove);
    nav.addEventListener('pointerleave', onLeave);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      nav.removeEventListener('pointermove', onMove);
      nav.removeEventListener('pointerleave', onLeave);
      window.clearInterval(iv);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <nav ref={navRef} className="tc-dock" data-tone="dark" aria-label="Sections" data-no-natural-reveal>
      <style dangerouslySetInnerHTML={{ __html: DOCK_CSS }} />
      {DOCK.map((d, i) => (
        <a
          key={d.id}
          href={`#${d.id}`}
          aria-label={labels[i]}
          onClick={(e) => {
            e.preventDefault();
            const el = document.getElementById(d.id);
            if (el) scrollToElement(el);
          }}
        >
          <span ref={(el) => { barRefs.current[i] = el; }} className="tc-dock-bar" />
        </a>
      ))}
      <span ref={labelRef} className="tc-dock-label" aria-hidden />
    </nav>
  );
}

/* ───────────────────────── 바닥글 ───────────────────────── */

const FOOT_CSS = `
.tc-foot{position:relative;overflow:hidden;color:rgba(255,255,255,.75);isolation:isolate}
.tc-foot-bg{position:absolute;inset:0;z-index:-1;pointer-events:none;
  background:
    radial-gradient(40% 9% at 96% 99%, rgba(24,44,92,.85), rgba(24,44,92,0) 100%),
    radial-gradient(34% 11% at 4% 97%, rgba(52,58,92,.6), rgba(52,58,92,0) 100%),
    radial-gradient(42% 8% at 24% 86%, rgba(196,160,178,.55), rgba(196,160,178,0) 100%),
    radial-gradient(48% 9% at 52% 76%, rgba(178,156,178,.5), rgba(178,156,178,0) 100%),
    radial-gradient(40% 7% at 82% 70%, rgba(150,148,176,.35), rgba(150,148,176,0) 100%),
    linear-gradient(180deg,#000c18 0%,#001a33 12%,#002342 24%,#11345b 34%,#2c4f78 45%,#4a6890 56%,#7e88a3 68%,#968fa2 76%,#8c869e 84%,#5c627e 92%,#3d445f 100%);
  -webkit-mask-image:linear-gradient(180deg,transparent 0,#000 170px);mask-image:linear-gradient(180deg,transparent 0,#000 170px)}
.tc-foot-globe{position:relative;padding:0 clamp(40px,10.42vw,200px);margin-top:110px;display:flex;justify-content:center}
.tc-foot-globe canvas{display:block;width:100%;max-width:1140px;aspect-ratio:1140/684;-webkit-mask-image:linear-gradient(180deg,#000 62%,transparent 90%);mask-image:linear-gradient(180deg,#000 62%,transparent 90%)}
.tc-foot-in{position:relative;max-width:1920px;margin:-36px auto 0;padding:48px 32px 48px}
.tc-foot-row1{display:flex;gap:24px;padding-bottom:92px}
.tc-foot-slogan{flex:1;min-width:0;margin:0;font-size:28px;font-weight:700;line-height:39.2px;letter-spacing:-.56px;color:rgba(255,255,255,.89);word-break:keep-all}
.tc-foot-grid{width:660px;flex-shrink:0;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:60px 30px}
.tc-foot-col{display:flex;flex-direction:column;gap:4.4px;margin:0;padding:0;list-style:none}
.tc-foot-link{color:rgba(255,255,255,.75);font-size:16px;font-weight:600;line-height:25.6px;letter-spacing:-.32px;text-decoration:none;transition:color .2s}
.tc-foot-side{margin-left:auto;width:660px;max-width:100%}
.tc-foot-small{font-size:14px;font-weight:500;line-height:22.4px;letter-spacing:-.14px;color:rgba(255,255,255,.6)}
.tc-foot-biz{padding-bottom:40px}
.tc-foot-biz p{margin:0}
.tc-foot-sep{display:inline-block;margin:0 10px;opacity:.8}
.tc-foot-policy{display:flex;flex-wrap:wrap;gap:12px 28px;padding:0 0 24px;margin-top:0;margin-bottom:0;list-style:none}
.tc-foot-policy a{color:inherit;text-decoration:none}
.tc-foot-policy li:first-child a{font-weight:800}
.tc-foot-mark{position:relative;margin-top:8px;cursor:default;user-select:none}
.tc-foot-mark svg{display:block;width:100%;height:auto;overflow:visible}
.tc-foot-mark .tc-mark-hi{position:absolute;inset:0;opacity:0;transition:opacity .33s ease-out;pointer-events:none;
  -webkit-mask-image:radial-gradient(200px circle at var(--mx,50%) var(--my,50%),#000 100px,transparent 200px);mask-image:radial-gradient(200px circle at var(--mx,50%) var(--my,50%),#000 100px,transparent 200px)}
.tc-foot-mark[data-hover="1"] .tc-mark-hi{opacity:1;transition:none}
.tc-foot-copy{margin:16px 0 0}
.tc-foot-rows{display:none}
@media (hover:hover){ .tc-foot-link:hover{color:rgba(255,255,255,.95)} .tc-foot-policy a:hover{color:rgba(255,255,255,.85)} }
@media (max-width:1023px){
  .tc-foot-row1{flex-direction:column;gap:48px}
  .tc-foot-grid{width:100%}
  .tc-foot-side{margin-left:0;width:100%}
  /* 1024 미만엔 비즈 하단 탭바(BizTabBar 58 + 안전영역, 261008)가 떠 있다 — 맨 아래 © 줄이 가리지 않게 원래 48 에 탭바 높이를 더함(767 이하는 아래 120 규칙) */
  .tc-foot-in{padding-bottom:calc(106px + max(8px, env(safe-area-inset-bottom)))}
}
@media (max-width:767px){
  .tc-foot-bg{-webkit-mask-image:linear-gradient(180deg,transparent 0,#000 140px);mask-image:linear-gradient(180deg,transparent 0,#000 140px)}
  .tc-foot-globe{padding:0;height:546px;margin-top:40px}
  .tc-foot-globe canvas{position:absolute;left:50%;top:0;width:780px;max-width:none;height:546px;aspect-ratio:auto;transform:translateX(-50%)}
  .tc-foot-in{margin-top:-156px;padding:32px 20px calc(120px + env(safe-area-inset-bottom))}
  .tc-foot-row1{gap:28px;padding-bottom:40px}
  .tc-foot-slogan{font-size:24px;line-height:33.6px;letter-spacing:-.48px}
  .tc-foot-grid{display:none}
  .tc-foot-rows{display:block;margin:0;padding:0;list-style:none;border-top:1px solid rgba(255,255,255,.19)}
  .tc-foot-rows a{display:flex;align-items:center;justify-content:space-between;height:55px;border-bottom:1px solid rgba(255,255,255,.19);color:rgba(255,255,255,.7);font-size:16px;font-weight:400;line-height:18.4px;text-decoration:none}
  .tc-foot-rows svg{opacity:.7}
  .tc-foot-policy{gap:12px 20px}
  .tc-foot-mark{margin-top:32px;mix-blend-mode:plus-lighter}
  .tc-foot-copy{margin-top:8px}
}
`;

/** 큰 'Freetiful' 글자 — 글자 잉크 상자에 딱 맞춘 viewBox 로 가로 꽉 채움, 마우스 근처만 밝아지는 조명 */
function Wordmark({ text }: { text: string }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<SVGTextElement>(null);
  const [vb, setVb] = useState('0 -150 900 190');

  useIsoLayoutEffect(() => {
    let dead = false;
    const measure = () => {
      const el = textRef.current;
      if (!el || dead) return;
      const cs = getComputedStyle(el);
      const c = document.createElement('canvas').getContext('2d');
      if (!c) return;
      c.font = `600 200px ${cs.fontFamily}`;
      const m = c.measureText(text);
      const l = m.actualBoundingBoxLeft;
      const w = m.actualBoundingBoxLeft + m.actualBoundingBoxRight;
      const a = m.actualBoundingBoxAscent;
      const h = a + m.actualBoundingBoxDescent;
      if (w > 0 && h > 0) setVb(`${(-l).toFixed(1)} ${(-a).toFixed(1)} ${w.toFixed(1)} ${h.toFixed(1)}`);
    };
    measure();
    document.fonts?.ready.then(measure).catch(() => {});
    return () => { dead = true; };
  }, [text]);

  useEffect(() => {
    const box = boxRef.current;
    if (!box) return undefined;
    const move = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      const r = box.getBoundingClientRect();
      box.style.setProperty('--mx', `${e.clientX - r.left}px`);
      box.style.setProperty('--my', `${e.clientY - r.top}px`);
      box.dataset.hover = '1';
    };
    const leave = () => { box.dataset.hover = '0'; };
    box.addEventListener('pointermove', move);
    box.addEventListener('pointerleave', leave);
    return () => { box.removeEventListener('pointermove', move); box.removeEventListener('pointerleave', leave); };
  }, []);

  const svg = (fill: string, ref?: React.Ref<SVGTextElement>) => (
    <svg viewBox={vb} preserveAspectRatio="xMinYMid meet" aria-hidden>
      <text ref={ref} x="0" y="0" fill={fill} style={{ fontSize: 200, fontWeight: 600, fontFamily: 'inherit' }}>{text}</text>
    </svg>
  );
  return (
    <div ref={boxRef} className="tc-foot-mark" aria-hidden>
      {svg('rgba(255,255,255,0.11)', textRef)}
      <div className="tc-mark-hi">{svg('rgba(224,236,255,0.2)')}</div>
    </div>
  );
}

type FootLinkItem = { label: string; href: string; external?: boolean };
/** 바닥글 링크 — 바깥 링크는 새 창, 안쪽 링크는 Next Link(예전 <a> 는 비즈 화면끼리 옮길 때마다 문서를 새로 받아 장면 · 글꼴을 처음부터 불렀다) */
function FootLink({ l, className, children }: { l: FootLinkItem; className?: string; children: ReactNode }) {
  if (l.external || /^https?:/.test(l.href)) return <a className={className} href={l.href} target="_blank" rel="noopener noreferrer">{children}</a>;
  return <Link className={className} href={l.href}>{children}</Link>;
}

/** 토스식 바닥글 — 밤하늘 → 라벤더 안개 배경(그라데이션), 도는 점 지구본, 링크 묶음, 회사 정보, 큰 반투명 글자 */
export function BizFooter({ links, company }: { links: FootLinkItem[]; company: string[] }) {
  const t = useT();
  const slogan = [t(INTRO.heroWords[0]), `${t(INTRO.heroWords[1])} ${t(INTRO.heroWords[2])}`];

  // 약관(/terms) = 아래 정책 줄(첫 칸 굵게) · 나머지 = 4칸 묶음(앞에서부터 고르게)
  const policy = links.filter((l) => l.href.startsWith('/terms'));
  const rest = links.filter((l) => !l.href.startsWith('/terms'));
  const cols: (typeof links)[] = [[], [], [], []];
  {
    let k = 0;
    for (let c = 0; c < 4; c++) {
      const size = Math.ceil((rest.length - k) / (4 - c));
      cols[c] = rest.slice(k, k + size);
      k += size;
    }
  }
  // © 줄 = 큰 글자 아래 · 나머지 = 사업자 정보
  const copyIdx = company.findIndex((s) => /©|copyright/i.test(s));
  const copy = copyIdx >= 0 ? company[copyIdx] : '';
  const info = company.filter((_, i) => i !== copyIdx);


  return (
    <footer className="tc-foot" data-dock-theme="dark" data-no-natural-reveal>
      <style dangerouslySetInnerHTML={{ __html: FOOT_CSS }} />
      <div className="tc-foot-bg" aria-hidden />
      <div className="tc-foot-globe" aria-hidden>
        <GlobeCanvas />
      </div>
      <div className="tc-foot-in">
        <div className="tc-foot-row1">
          <p className="tc-foot-slogan">{slogan[0]}<br />{slogan[1]}</p>
          <div className="tc-foot-grid">
            {cols.map((col, ci) => (
              <ul key={ci} className="tc-foot-col">
                {col.map((l) => (
                  <li key={l.href + l.label}><FootLink l={l} className="tc-foot-link">{l.label}</FootLink></li>
                ))}
              </ul>
            ))}
          </div>
          <ul className="tc-foot-rows">
            {rest.map((l) => (
              <li key={l.href + l.label}>
                <FootLink l={l}>
                  <span>{l.label}</span>
                  {l.external ? (
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden><path d="M5 11l6-6M6 5h5v5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden><path d="M6 3.5L10.5 8 6 12.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  )}
                </FootLink>
              </li>
            ))}
          </ul>
        </div>
        <div className="tc-foot-side tc-foot-small tc-foot-biz">
          {info.map((line, i) => {
            const parts = line.split(' | ');
            return (
              <p key={i}>
                {parts.map((p, j) => (
                  <span key={j} lang={/[가-힣]/.test(p) ? 'ko' : undefined}>{j > 0 && <span className="tc-foot-sep">|</span>}{p}</span>
                ))}
              </p>
            );
          })}
        </div>
        {policy.length > 0 && (
          <ul className="tc-foot-side tc-foot-small tc-foot-policy">
            {policy.map((l) => (
              <li key={l.href}><FootLink l={l}>{l.label}</FootLink></li>
            ))}
          </ul>
        )}
        <Wordmark text="Freetiful" />
        {copy && <p className="tc-foot-small tc-foot-copy">{copy}</p>}
      </div>
    </footer>
  );
}

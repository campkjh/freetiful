'use client';

/* eslint-disable @next/next/no-img-element -- public 정적 프로필(같은 3:4 틀로 맞춘 webp) */
import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react';
import { useT } from '@/lib/biz/i18n';
import { FadeUp } from '@/components/biz/biz-motion';
import { prefersReducedMotion } from '../scroll-to';
import CeoSilk from './CeoSilk';
import { LEADERS, LEADERS_HEAD, type Leader } from './content';

/*
 * ④ 이사진 소개 9명(261012 사장 '이거 이사진 부분에 이런느낌으로 해줘라 배경을 일렁이는 고급스러운 3d배경 느낌으로' — 참고 화면은 모양만 따른다).
 * 바탕 = 천천히 일렁이는 유리 · 비단 띠(CeoSilk, WebGL 한 장 · 없으면 CSS 그라데이션).
 * 데스크톱(≥1024): 왼쪽 제목 칸(LEADERSHIP · 이사진 소개 · 한 줄 · 단추 두 개 + 01 / 09), 오른쪽 = 화면 오른쪽 끝까지 이어지다 잘리는 카드 줄.
 * 모바일 · 태블릿: 제목 → 손가락으로 넘기는 카드 줄(화면 끝까지) → 01 / 09 + 단추.
 * 카드 줄은 브라우저 가로 스크롤(scroll-snap) 그대로 — 트랙패드 · 손가락 · 마우스 끌기 · 단추 · 키보드(← → Home End) 모두 한 칸씩 붙는다.
 *   모바일은 줄 끝 빈 칸(::after)으로 마지막 카드도 맨 앞 자리까지 간다(카드 번호 = 스크롤 칸 번호).
 *   태블릿 · 데스크톱은 마지막 카드가 오른쪽에 닿으면 멈춘다(끝에서 한 장만 남아 화면이 비지 않게, 261012 검토) — 끝에 닿으면 번호는 09.
 *   끝 빈 칸(--tail)은 끝 자리가 카드 경계에 딱 맞게 재서 끝에서도 왼쪽에 잘린 카드 조각이 남지 않는다(오른쪽 여백 48px 이상).
 * 카드 색은 파랑 · 어두운 유리 · 흰 유리(content.ts tone) — 누끼는 카드 색 위에 서고, 회색 배경 사진은 카드를 꽉 채운다.
 * (예전 '세로 스크롤 → 가로로 흐르는 장면'(261009)은 단추 · 끌기로 넘기는 이 판으로 바꿨다.)
 */

const pad = (x: number) => String(x).padStart(2, '0');

function LeaderCard({ p, i, t, on, past }: { p: Leader; i: number; t: ReturnType<typeof useT>; on: boolean; past: boolean }) {
  return (
    <li className="cx-lc" data-tone={p.tone} data-cut={p.cut ? '' : undefined} data-cur={on ? '' : undefined} data-past={past ? '' : undefined} style={{ '--i': i } as CSSProperties}>
      <figure className="cx-lc-in">
        <img src={p.image} alt="" loading="lazy" decoding="async" draggable={false} onLoad={(e) => e.currentTarget.setAttribute('data-ld', '')} />
        <span className="cx-lc-bd">{p.badge}</span>
        <span className="cx-lc-no" aria-hidden>{pad(i + 1)}</span>
        <figcaption className="cx-lc-cap">
          <span className="cx-lc-n">{t(p.name)}</span>
          <span className="cx-lc-r">{t(p.role)}</span>
        </figcaption>
      </figure>
    </li>
  );
}

/** 카드 한 칸 = 카드 폭 + 사이 간격 */
const stepOf = (track: HTMLElement) => {
  const a = track.children[0] as HTMLElement | undefined;
  const b = track.children[1] as HTMLElement | undefined;
  if (!a) return 1;
  return Math.max(1, b ? b.offsetLeft - a.offsetLeft : a.offsetWidth);
};

/** 가로로 갈 수 있는 끝 */
const maxOf = (track: HTMLElement) => Math.max(0, track.scrollWidth - track.clientWidth);
/** 카드 k 의 자리(첫 카드 기준) — 카드마다 offsetLeft 로 재서 칸 폭 반올림이 쌓이지 않는다 */
const offOf = (track: HTMLElement, k: number) => {
  const a = track.children[0] as HTMLElement | undefined;
  const b = track.children[k] as HTMLElement | undefined;
  return a && b ? b.offsetLeft - a.offsetLeft : 0;
};
/** 칸 k 의 스크롤 자리 — 끝을 넘는 칸은 끝으로 모인다 */
const leftOf = (track: HTMLElement, k: number) => Math.min(offOf(track, k), maxOf(track));
/** 붙을 수 있는 마지막 칸 = 자리가 끝에 닿는 첫 칸(태블릿 · 데스크톱은 그 뒤 카드들의 자리가 모두 끝으로 모인다) */
const lastStopOf = (track: HTMLElement, n: number) => {
  const m = maxOf(track) - 2;
  for (let k = 0; k < n; k++) if (offOf(track, k) >= m) return k;
  return n - 1;
};
const atEnd = (track: HTMLElement) => { const m = maxOf(track); return m > 0 && track.scrollLeft >= m - 2; };
/** 끝 빈 칸 — 끝에서 다 보이는 카드 수만큼 남기고(최소 1장, 오른쪽 여백 48 이상) 끝 자리 = 카드 경계 */
const fitTail = (track: HTMLElement) => {
  const a = track.children[0] as HTMLElement | undefined;
  if (!a) return;
  const cs = getComputedStyle(track);
  const gap = parseFloat(cs.columnGap) || 0;
  const room = track.clientWidth - (parseFloat(cs.paddingLeft) || 0);
  const step = a.getBoundingClientRect().width + gap; // 폭은 등장 transform(가로 이동)과 무관
  if (!(step > 0) || !(room > 0)) return;
  const k = Math.max(1, Math.floor((room + gap - 48) / step));
  track.style.setProperty('--tail', `${Math.max(0, room - k * step).toFixed(2)}px`);
};

type Drag = { id: number; x: number; left: number; moved: boolean; lx: number; lt: number; v: number };

export default function CeoLeaders() {
  const t = useT();
  const secRef = useRef<HTMLElement>(null);
  const trackRef = useRef<HTMLUListElement>(null);
  const barRef = useRef<HTMLSpanElement>(null);
  const target = useRef<number | null>(null); // 단추로 가는 중인 칸(연달아 누르면 이어서)
  const at = useRef(0); // 지금 붙어 있는 스크롤 칸(데스크톱 끝에서는 번호 09 와 다르다)
  const drag = useRef<Drag | null>(null);
  const settle = useRef(0);
  const [cur, setCur] = useState(0); // 보이는 번호(끝에 닿으면 마지막)
  const [first, setFirst] = useState(0); // 맨 앞 칸 — 이보다 앞 카드는 줄 왼쪽 밖
  const [said, setSaid] = useState(0); // 읽기 프로그램 알림 — 끌기 · 던지기 중 지나가는 카드마다 읽지 않게 멈춘 뒤 한 번
  const n = LEADERS.length;
  const clampI = (i: number) => Math.max(0, Math.min(n - 1, i));

  // 화면에 들어오면 카드가 오른쪽에서 차례로(한 번) — 붙은 뒤에만 숨겨 두므로 스크립트가 없어도 보인다
  useEffect(() => {
    const sec = secRef.current;
    if (!sec) return undefined;
    if (prefersReducedMotion()) return undefined;
    sec.setAttribute('data-arm', '');
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) {
        sec.setAttribute('data-in', '');
        io.disconnect();
      }
    }, { threshold: 0.18 });
    io.observe(sec);
    return () => io.disconnect();
  }, []);

  /*
   * 사진 — 가로 줄 안의 lazy 는 줄이 실제로 넘어와야 받기 시작해 단추로 넘기면 빈 카드가 잠깐 보였다(개발 서버 1초 남짓).
   * 섹션이 가까워지면(아래 800px) 9장 모두 받는다(장당 20~45KB). 붙기 전에 이미 받아진 사진은 load 를 놓치므로 여기서 표시.
   */
  useEffect(() => {
    const sec = secRef.current;
    const track = trackRef.current;
    if (!sec || !track) return undefined;
    const imgs = Array.from(track.querySelectorAll('img'));
    imgs.forEach((im) => { if (im.complete && im.naturalWidth) im.setAttribute('data-ld', ''); });
    sec.setAttribute('data-js', ''); // 받는 중인 사진은 투명했다가 서서히(스크립트가 없으면 그냥 보인다)
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      imgs.forEach((im) => { im.loading = 'eager'; });
      io.disconnect();
    }, { rootMargin: '800px 0px' });
    io.observe(sec);
    return () => io.disconnect();
  }, []);

  // 지금 칸 · 진행 막대 — 스크롤 프레임마다(리렌더는 칸이 바뀔 때만)
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return undefined;
    let q = 0;
    const on = () => {
      q = 0;
      const pos = track.scrollLeft / stepOf(track);
      const end = atEnd(track);
      const k = clampI(Math.round(pos));
      at.current = end ? lastStopOf(track, n) : k;
      setCur(end ? n - 1 : k);
      setFirst(k);
      if (target.current !== null && Math.abs(track.scrollLeft - leftOf(track, target.current)) < 2) target.current = null;
      // 막대 = 갈 수 있는 끝까지의 진행(모바일은 칸 번호와 같고, 데스크톱도 끝에서 꽉 찬다)
      const m = maxOf(track);
      const p = m > 0 ? Math.min(1, track.scrollLeft / m) : 0;
      if (barRef.current) barRef.current.style.transform = `scaleX(${((1 + (n - 1) * p) / n).toFixed(4)})`;
    };
    const onScroll = () => {
      if (!q) q = requestAnimationFrame(on);
    };
    const onResize = () => {
      fitTail(track);
      onScroll();
    };
    fitTail(track);
    on();
    track.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize);
    return () => {
      if (q) cancelAnimationFrame(q);
      track.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- n 은 상수(9)
  }, []);

  useEffect(() => () => cancelAnimationFrame(settle.current), []);

  useEffect(() => {
    const id = window.setTimeout(() => setSaid(cur), 450);
    return () => window.clearTimeout(id);
  }, [cur]);

  const go = (i: number) => {
    const track = trackRef.current;
    if (!track) return;
    const k = Math.min(clampI(i), lastStopOf(track, n));
    target.current = k;
    track.scrollTo({ left: leftOf(track, k), behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  };
  const by = (d: number) => go((target.current ?? at.current) + d);

  const onKeyDown = (e: KeyboardEvent<HTMLUListElement>) => {
    const k = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
    if (k) by(k);
    else if (e.key === 'Home') go(0);
    else if (e.key === 'End') go(n - 1);
    else return;
    e.preventDefault();
  };

  /*
   * 마우스 끌기(데스크톱) — 손가락 · 트랙패드는 브라우저가 알아서 한다. 끄는 동안은 칸 붙기를 끄고(data-free),
   * 놓으면 던진 속도까지 셈해 가까운 칸으로 부드럽게 간 뒤 멈추면 다시 켠다(켜는 순간 제멋대로 튀지 않게).
   */
  const onPointerDown = (e: PointerEvent<HTMLUListElement>) => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    const track = trackRef.current;
    if (!track) return;
    cancelAnimationFrame(settle.current);
    target.current = null;
    drag.current = { id: e.pointerId, x: e.clientX, left: track.scrollLeft, moved: false, lx: e.clientX, lt: e.timeStamp, v: 0 };
  };
  const onPointerMove = (e: PointerEvent<HTMLUListElement>) => {
    const d = drag.current;
    const track = trackRef.current;
    if (!d || !track || e.pointerId !== d.id) return;
    const dx = e.clientX - d.x;
    if (!d.moved) {
      if (Math.abs(dx) < 5) return;
      d.moved = true;
      try { track.setPointerCapture(d.id); } catch { /* 이미 놓았다 */ }
      track.setAttribute('data-free', '');
      track.setAttribute('data-drag', '');
    }
    track.scrollLeft = d.left - dx;
    const dt = e.timeStamp - d.lt;
    if (dt > 0) d.v = d.v * 0.4 + ((e.clientX - d.lx) / dt) * 0.6;
    d.lx = e.clientX;
    d.lt = e.timeStamp;
  };
  const onPointerUp = (e: PointerEvent<HTMLUListElement>) => {
    const d = drag.current;
    const track = trackRef.current;
    if (!d || !track || e.pointerId !== d.id) return;
    drag.current = null;
    if (!d.moved) return;
    track.removeAttribute('data-drag');
    try { track.releasePointerCapture(d.id); } catch { /* 이미 놓았다 */ }
    const step = stepOf(track);
    const fling = e.timeStamp - d.lt > 80 ? 0 : d.v; // 멈췄다 놓으면 던지지 않은 것
    const k = Math.min(clampI(Math.round((track.scrollLeft - fling * 160) / step)), lastStopOf(track, n));
    const left = leftOf(track, k);
    track.scrollTo({ left, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    // 다 가면(또는 1.2초) 칸 붙기를 다시 켠다
    const t0 = performance.now();
    let last = -1;
    let still = 0;
    const wait = () => {
      const x = track.scrollLeft;
      still = Math.abs(x - last) < 0.5 ? still + 1 : 0;
      last = x;
      if (Math.abs(x - left) < 1 || still > 4 || performance.now() - t0 > 1200) {
        track.removeAttribute('data-free');
        return;
      }
      settle.current = requestAnimationFrame(wait);
    };
    settle.current = requestAnimationFrame(wait);
  };

  return (
    <section ref={secRef} className="cx-ld" aria-labelledby="cx-ld-title">
      <CeoSilk className="cx-ld-silk" />
      <div className="cx-ld-in">
        <FadeUp className="cx-ld-head">
          <p className="cx-eyebrow">{LEADERS_HEAD.eyebrow}</p>
          <h2 id="cx-ld-title" className="cx-h2 cx-ld-h2">{t(LEADERS_HEAD.title)}</h2>
          <p className="cx-ld-sub">{t(LEADERS_HEAD.sub)}</p>
        </FadeUp>
        <FadeUp className="cx-ld-nav" delay={120}>
          <div className="cx-ld-count" aria-hidden>
            <b>{pad(cur + 1)}</b>
            <span className="cx-ld-bar"><span ref={barRef} className="cx-ld-bar-in" /></span>
            <span>{pad(n)}</span>
          </div>
          <span className="sr-only" aria-live="polite">{`${said + 1} / ${n} ${t(LEADERS[said].name)}`}</span>
          {/* 끝 칸에서도 disabled 대신 aria-disabled — 단추를 연달아 누르던 키보드 포커스가 페이지 맨 위로 튀지 않게.
              DOM 은 단추가 카드 줄 앞(데스크톱 화면 순서 = 키보드 차례), 모바일은 CSS order 로 카드 줄 아래에 그린다 */}
          <div className="cx-ld-btns">
            <button type="button" className="cx-ld-btn cx-ld-prev" onClick={() => { if (cur > 0) by(-1); }} aria-disabled={cur <= 0} aria-controls="cx-ld-track" aria-label={t(LEADERS_HEAD.prev)}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden><path d="M12 5 7 10l5 5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
            <button type="button" className="cx-ld-btn cx-ld-next" onClick={() => { if (cur < n - 1) by(1); }} aria-disabled={cur >= n - 1} aria-controls="cx-ld-track" aria-label={t(LEADERS_HEAD.next)}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden><path d="m8 5 5 5-5 5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
          </div>
        </FadeUp>
        <div className="cx-ld-rail" role="region" aria-roledescription={t(LEADERS_HEAD.carousel)} aria-labelledby="cx-ld-title">
          {/* 세로 휠은 페이지(Lenis)로, 가로 휠 · 트랙패드는 이 줄이 직접 받는다 */}
          <ul
            ref={trackRef}
            id="cx-ld-track"
            className="cx-ld-track"
            tabIndex={0}
            aria-label={t(LEADERS_HEAD.list)}
            data-lenis-prevent-horizontal=""
            onKeyDown={onKeyDown}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onWheel={() => { target.current = null; }}
            onTouchStart={() => { target.current = null; }}
          >
            {LEADERS.map((p, i) => <LeaderCard key={p.key} p={p} i={i} t={t} on={i === cur} past={i < first} />)}
          </ul>
        </div>
      </div>
    </section>
  );
}

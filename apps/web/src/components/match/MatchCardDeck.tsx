'use client';

// 매칭 — 요청한 사회자들의 프로필 카드 덱(260926 사장: 크몽 '관심 분야' 카드 애니메이션을 사회자 카드로 → 기다리는 동안 이탈 막기).
//  · 영상(ScreenRecording 17-21-12) 실측: 카드 5장이 한 줄로 겹침 — 가운데가 크고 앞, 양옆 0.8·0.64배로 작아지며 뒤로.
//    잠깐 머물렀다 한 칸씩 왼쪽으로 넘어가고, 한 바퀴쯤 돌면 모든 카드가 가운데로 빨려 들어가 한 장(브랜드 파란 뒷면)이 된 뒤
//    옆으로 뒤집혀 앞면(가운데 사회자)이 나오고, 뒤에서 부채처럼 다시 펼쳐진다. 카드는 트럼프처럼 둥근 사각형에 모서리 ◆.
//  · 사회자가 5명보다 적으면 같은 카드를 '보이지 않는 칸'에만 되풀이해 고리를 만든다(보이는 칸엔 같은 얼굴이 두 번 안 나온다).
//    끝→처음으로 건너뛰는 카드는 늘 안 보이는 칸이라 화면을 가로지르지 않는다.
//  · 화면 밖이거나 앱이 가려지면 멈추고, '동작 줄이기'면 멈춘 한 장면만.
import { useEffect, useMemo, useRef, useState } from 'react';

export type DeckCard = { id: string; name: string; image: string };

const W = 84; // 가운데 카드(3:4)
const H = 112;
const STEP_MS = 1500;
// 가운데로부터 떨어진 칸 → 옆으로(px)·크기·투명도·겹침(영상 비율). 3 = 안 보이는 대기 칸
const SLOTS = [
  { x: 0, s: 1, o: 1, z: 6 },
  { x: 52, s: 0.8, o: 1, z: 5 },
  { x: 92, s: 0.64, o: 0.92, z: 4 },
  { x: 118, s: 0.5, o: 0, z: 3 },
];

type Phase = 'run' | 'collapse' | 'back' | 'flip' | 'fan';

export default function MatchCardDeck({ cards }: { cards: DeckCard[] }) {
  const n = cards.length;
  // 보이는 반경 — 5명 이상이면 양옆 2칸, 3·4명은 1칸, 2명은 가운데+오른쪽(왼쪽으로 나가며 흐려짐)
  const radius = n >= 5 ? 2 : 1;
  const ringLen = n <= 1 ? 1 : n * Math.ceil(7 / n);
  const ring = useMemo(
    () => Array.from({ length: ringLen }, (_, j) => ({ ...cards[j % Math.max(1, n)], key: `${cards[j % Math.max(1, n)]?.id}-${j}` })),
    [cards, n, ringLen],
  );
  const [idx, setIdx] = useState(0);
  const [phase, setPhase] = useState<Phase>('run');
  const stepsRef = useRef(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, []);

  // 화면에 보일 때만 돈다(칸이 여러 개인 목록에서 안 보이는 덱까지 돌지 않게)
  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }
    let inView = false;
    const sync = () => setVisible(inView && document.visibilityState === 'visible');
    const io = new IntersectionObserver(([entry]) => { inView = entry.isIntersecting; sync(); }, { threshold: 0.35 });
    io.observe(el);
    document.addEventListener('visibilitychange', sync);
    return () => { io.disconnect(); document.removeEventListener('visibilitychange', sync); };
  }, []);

  useEffect(() => {
    if (!visible || reduced || n === 0) return;
    let t = 0;
    if (phase === 'run') {
      t = window.setTimeout(() => {
        stepsRef.current += 1;
        // 한 바퀴(최소 4칸)마다 뒤집기 연출 — 한 명이면 매번
        if (n <= 1 || stepsRef.current >= Math.max(4, n)) {
          stepsRef.current = 0;
          setPhase('collapse');
        } else {
          setIdx((i) => (i + 1) % ringLen);
        }
      }, n <= 1 ? 2600 : STEP_MS);
    } else if (phase === 'collapse') t = window.setTimeout(() => setPhase('back'), 280);
    else if (phase === 'back') t = window.setTimeout(() => setPhase('flip'), 820);
    else if (phase === 'flip') t = window.setTimeout(() => setPhase('fan'), 640);
    else if (phase === 'fan') t = window.setTimeout(() => setPhase('run'), 560);
    return () => window.clearTimeout(t);
  }, [phase, idx, visible, reduced, n, ringLen]);

  if (n === 0) return null;

  const offsetOf = (j: number) => {
    if (ringLen <= 1) return 0;
    let d = (j - idx) % ringLen;
    if (d < 0) d += ringLen;
    if (d > ringLen / 2) d -= ringLen;
    return d;
  };
  const hiddenPhase = phase === 'collapse' || phase === 'back' || phase === 'flip';
  const center = ring[idx] || ring[0];

  const Pips = ({ tone = 'light' }: { tone?: 'light' | 'blue' }) => (
    <>
      <i className={`deck-pip tl ${tone}`} aria-hidden="true" />
      <i className={`deck-pip br ${tone}`} aria-hidden="true" />
    </>
  );

  return (
    <div
      ref={rootRef}
      className="match-deck relative mx-auto"
      style={{ width: 2 * (SLOTS[2].x + (W * SLOTS[2].s) / 2), height: H + 16 }}
      role="img"
      aria-label={`요청한 사회자 ${n}명: ${cards.map((c) => c.name).join(', ')}`}
    >
      {ring.map((card, j) => {
        const off = offsetOf(j);
        const dist = Math.abs(off);
        // 2명일 땐 왼쪽 칸은 안 보이는 칸(가운데가 왼쪽으로 빠지며 흐려진다)
        const shown = dist <= radius && !(n === 2 && off < 0);
        const slot = shown ? SLOTS[dist] : { ...SLOTS[Math.min(Math.max(dist, 1), 3)], o: 0, z: 2 };
        const x = Math.sign(off) * slot.x;
        let style: React.CSSProperties;
        if (hiddenPhase) {
          // 모두 가운데로 빨려 들어간다
          style = {
            transform: 'translate(-50%, -50%) scale(.16)',
            opacity: 0,
            zIndex: slot.z,
            transition: 'transform .28s cubic-bezier(.55,0,.8,.2), opacity .22s ease',
          };
        } else {
          style = {
            transform: `translate(-50%, -50%) translateX(${x}px) scale(${slot.s})`,
            opacity: slot.o,
            zIndex: slot.z,
            // 펼칠 때 가운데 카드는 뒤집힌 카드와 같은 자리라 바로 나타나고, 나머지만 뒤에서 제자리로 펼쳐진다
            transition: phase === 'fan' && off === 0 ? 'none' : 'transform .6s cubic-bezier(.22,1,.36,1), opacity .42s ease',
          };
        }
        return (
          <div key={card.key} className="deck-card" style={{ width: W, height: H, ...style }} aria-hidden="true">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={card.image} alt="" loading="lazy" decoding="async" draggable={false} />
            <Pips />
          </div>
        );
      })}

      {/* 뒤집기 — 브랜드 뒷면이 톡 나타났다가 옆으로 돌며 가운데 사회자 앞면으로 */}
      {(phase === 'back' || phase === 'flip') && (
        <div className="deck-flip" data-phase={phase} style={{ width: W, height: H }} aria-hidden="true">
          <div className="deck-inner">
            <div className="deck-face back">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/images/logo-freetiful-wordmark.svg" alt="" className="deck-logo" draggable={false} />
              <Pips tone="blue" />
            </div>
            <div className="deck-face front">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={center?.image} alt="" draggable={false} />
              <Pips />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** 한 줄씩 위로 굴러 바뀌는 문구(아래에서 올라오고 위로 빠진다) */
export function RollingText({ items, interval = 3200, className = '' }: { items: string[]; interval?: number; className?: string }) {
  const sig = items.join('\u0001');
  const [state, setState] = useState<{ i: number; prev: number | null }>({ i: 0, prev: null });
  useEffect(() => { setState({ i: 0, prev: null }); }, [sig]);
  useEffect(() => {
    if (items.length <= 1) return;
    const t = window.setInterval(() => setState((s) => ({ i: (s.i + 1) % items.length, prev: s.i })), interval);
    return () => window.clearInterval(t);
  }, [sig, items.length, interval]);
  useEffect(() => {
    if (state.prev === null) return;
    const t = window.setTimeout(() => setState((s) => ({ ...s, prev: null })), 560);
    return () => window.clearTimeout(t);
  }, [state.prev]);
  const current = items[Math.min(state.i, Math.max(0, items.length - 1))] || '';
  return (
    <span className={`roll-wrap ${className}`} aria-live="polite">
      {state.prev !== null && items[state.prev] !== undefined && (
        <span key={`out-${state.prev}-${state.i}`} className="roll-out" aria-hidden="true">{items[state.prev]}</span>
      )}
      <span key={`in-${state.i}-${sig.length}`} className={state.prev !== null ? 'roll-in' : ''}>{current}</span>
    </span>
  );
}

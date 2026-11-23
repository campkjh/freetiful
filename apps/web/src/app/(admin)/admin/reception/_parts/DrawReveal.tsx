'use client';

import { useEffect, useState } from 'react';
import { clamp01, out, type RevealPlan, type RevealTicket } from './draw-reveal';
import { FightArena } from './FightArena';
import { AnimalRunDraw } from './AnimalRunDraw';
import { BossDraw } from './BossDraw';
import { PinballDraw } from './PinballDraw';
import { LotteryDraw } from './LotteryDraw';
import { CinematicCards, PuddingDraw } from './CinematicDraw';
import './draw-reveal.css';

const GOLD = '#ffd781';
const INK = '#101220';
const W = 840;
const H = 340;
const number = (ticket: RevealTicket | null) => ticket ? String(ticket.number).padStart(3, '0') : '\u00b7\u00b7\u00b7';
type Scene = { plan: RevealPlan; t: number };

function Materials() {
  return <defs>
    <linearGradient id="rdv-brass" x2="0" y2="1"><stop stopColor="#f7dea1" /><stop offset=".23" stopColor="#ad773e" /><stop offset=".53" stopColor="#f0ce83" /><stop offset="1" stopColor="#65442c" /></linearGradient>
  </defs>;
}

function Wheel({ plan, t }: Scene) {
  const count = plan.lineup.length;
  const step = Math.PI * 2 / count;
  const spin = (360 * 4 - plan.winnerIndex * 360 / count) * out(t / .92);
  const point = (angle: number, r: number) => [Math.sin(angle) * r, -Math.cos(angle) * r];
  return <g transform="translate(420 179)">
    <circle className="rdv-backed-metal" r="150" fill="#191c30" stroke="url(#rdv-brass)" strokeWidth="9" /><circle r="143" fill="none" stroke={GOLD} strokeWidth="2" strokeDasharray="2 9" />
    <g transform={`rotate(${spin})`}>
      {plan.lineup.map((ticket, i) => {
        const a = i * step;
        const p0 = point(a - step / 2, 133);
        const p1 = point(a + step / 2, 133);
        const [x, y] = point(a, 103);
        const highlighted = t > .92 && i === plan.winnerIndex;
        return <g key={i}><path d={`M0 0 L${p0.join(' ')} A133 133 0 0 1 ${p1.join(' ')}Z`} fill={highlighted ? GOLD : i % 2 ? '#6d3546' : '#24564e'} stroke="#bf9a5d" strokeWidth="1.4" /><text x={x} y={y} transform={`rotate(${i * 360 / count} ${x} ${y})`} dominantBaseline="middle" fontSize="20" fontWeight="800" fill={highlighted ? INK : '#fff3d6'}>{number(ticket)}</text></g>;
      })}
    </g>
    <circle r="29" fill="url(#rdv-brass)" stroke={GOLD} strokeWidth="3" /><path d="M0-13L12 0L0 13L-12 0Z" fill="#fff2ca" />
    <path d="M-15-158H15L0-122Z" fill="#fff2cc" stroke="#8d5a32" strokeWidth="2" />
  </g>;
}

export function DrawReveal({ plan, startedAt, openedCards, onOpenCard, reduce }: { plan: RevealPlan; startedAt: number; openedCards: readonly number[]; onOpenCard: (index: number) => void; reduce: boolean }) {
  const [t, setTime] = useState(() => reduce ? 1 : clamp01((performance.now() - startedAt) / plan.duration));
  useEffect(() => {
    if (reduce) return;
    let frame = 0;
    let lastFrame = 0;
    const tick = (now: number) => {
      const next = clamp01((now - startedAt) / plan.duration);
      if (plan.lineup.length < 60 || now - lastFrame >= 30 || next === 1) {
        lastFrame = now;
        setTime(next);
      }
      if (next < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [startedAt, plan.duration, plan.lineup.length, reduce]);
  const Art = plan.kind === 'wheel' ? Wheel : plan.kind === 'capsule' ? LotteryDraw : null;
  return <div className={`rdv-scene rdv-${plan.kind}`} aria-hidden={plan.kind === 'cards' ? undefined : true}>
    {Art ? <svg className="rdv-art" viewBox={`0 0 ${W} ${H}`} textAnchor="middle"><Materials /><Art plan={plan} t={t} /></svg> :
      plan.kind === 'cards' ? <CinematicCards plan={plan} t={t} opened={openedCards} onOpen={onOpenCard} /> :
      plan.kind === 'vault' ? <PuddingDraw plan={plan} t={t} /> :
      plan.kind === 'boss' ? <BossDraw plan={plan} t={t} /> :
      plan.kind === 'pinball' ? <PinballDraw plan={plan} t={t} /> :
      plan.kind === 'race' ? <AnimalRunDraw plan={plan} t={t} /> : <FightArena plan={plan} t={t} />}
    <span className="rdv-progress" style={{ transform: `scaleX(${t})` }} />
  </div>;
}

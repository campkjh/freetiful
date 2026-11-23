'use client';

import { useEffect, useState } from 'react';
import { clamp01, lerp, out, racePosition, smooth, type RevealPlan, type RevealTicket } from './draw-reveal';
import { DRAW_ART, DrawArena } from './DrawArena';
import './draw-reveal.css';

const GOLD = '#ffd781';
const INK = '#101220';
const PALETTE = ['#ff806d', '#70ddca', '#9ea8ff', '#f9ca72', '#f695c7', '#8bd7ff', '#bae77b', '#d1b3ff'];
const W = 840;
const H = 340;
const number = (ticket: RevealTicket | null) => ticket ? String(ticket.number).padStart(3, '0') : '\u00b7\u00b7\u00b7';
const shortName = (name: string) => [...name].length <= 8 ? name : `${[...name].slice(0, 7).join('')}…`;
const bounce = (t: number, frequency: number) => Math.abs(Math.sin(t * Math.PI * frequency));
type Scene = { plan: RevealPlan; t: number };

function Materials() {
  return <defs>
    <linearGradient id="rdv-brass" x2="0" y2="1"><stop stopColor="#f7dea1" /><stop offset=".23" stopColor="#ad773e" /><stop offset=".53" stopColor="#f0ce83" /><stop offset="1" stopColor="#65442c" /></linearGradient>
    <linearGradient id="rdv-steel" x2="0" y2="1"><stop stopColor="#65717f" /><stop offset=".23" stopColor="#20202b" /><stop offset=".65" stopColor="#3c414a" /><stop offset="1" stopColor="#151824" /></linearGradient>
    <radialGradient id="rdv-chrome" cx=".32" cy=".24"><stop stopColor="#fffcef" /><stop offset=".36" stopColor="#f9e5bb" /><stop offset=".64" stopColor="#b88b54" /><stop offset=".88" stopColor="#6c4a49" /><stop offset="1" stopColor="#fbcc83" /></radialGradient>
    <linearGradient id="rdv-capsule-metal" x2="0" y2="1"><stop stopColor="#b9789d" /><stop offset=".45" stopColor="#4a234c" /><stop offset="1" stopColor="#2a1d39" /></linearGradient>
  </defs>;
}

function Tag({ ticket, active = false, compact = false }: { ticket: RevealTicket; active?: boolean; compact?: boolean }) {
  const name = compact && [...ticket.name].length > 6 ? `${[...ticket.name].slice(0, 5).join('')}…` : shortName(ticket.name);
  return <g className="rdv-tag">
    <text y="-8" fill={active ? GOLD : '#fff'} fontSize={compact ? 21 : 24} fontWeight="800">No. {number(ticket)}</text>
    <text y="14" fill={active ? GOLD : '#e0e7f2'} fontSize={compact ? 16 : 19} fontWeight="700">{name}</text>
  </g>;
}

const RACERS = [
  { body: '#f39153', ears: 'M-22-14l4-17 10 12M7-19l11-12 4 18', tail: 'M-28 4Q-49 0-43-13Q-28-11-22-1Z' },
  { body: '#f2dff4', ears: 'M-16-15v-22h9v21M2-17v-24h9v26', tail: 'M-28-3h-12v-11h11Z' },
  { body: '#86bcf5', ears: 'M-20-14v-16l13 9M7-21l13-9v19', tail: 'M-28 8q-20 0-20-20h7q0 12 15 12Z' },
  { body: '#8ae48d', ears: 'M-18-12v-12h12v9M3-15v-9h12v15', tail: '' },
  { body: '#ffcf65', ears: 'M-10-16v-12h7v7h8v7', tail: 'M-29 0l-10-8 2 17 11 3Z' },
];

function Race({ plan, t }: Scene) {
  const height = Math.min(62, 287 / plan.lineup.length);
  return <>
    <defs><pattern id="rdv-finish" width="16" height="16" patternUnits="userSpaceOnUse"><path d="M0 0H16V16H0Z" fill="#edf6fa" /><path d="M0 0H8V8H0ZM8 8H16V16H8Z" fill="#1e3240" /></pattern></defs>
    <rect x="18" y="22" width="804" height="296" rx="8" fill="#17312a" fillOpacity=".76" stroke="#b5cf91" strokeOpacity=".7" />
    {plan.lineup.map((ticket, i) => {
      if (!ticket) return null;
      const won = t >= .88 && i === plan.winnerIndex;
      const top = (H - height * plan.lineup.length) / 2 + i * height;
      const runner = RACERS[i];
      const x = 200 + 558 * racePosition(t, i, plan.winnerIndex, plan.seed);
      const jump = t < .9 ? bounce(t, 28 + i * 4) * 7 : 0;
      return <g key={ticket.number}>
        <rect x="29" y={top} width="782" height={height - 3} fill={won ? '#808e3b' : i % 2 ? '#376342' : '#1e493b'} fillOpacity=".7" />
        <path d={`M151 ${top + height - 7}H806`} stroke="#9cc9bf" strokeOpacity=".42" strokeDasharray="12 12" />
        <rect x="747" y={top} width="16" height={height - 3} fill="url(#rdv-finish)" opacity=".7" />
        <g transform={`translate(91 ${top + height / 2 + 3})`}><Tag ticket={ticket} active={won} /></g>
        <ellipse cx={x - 5} cy={top + height - 12} rx="27" ry="5" fill="#132632" opacity=".65" />
        <g transform={`translate(${x} ${top + height - 27 - jump}) scale(.83)`}>
          <path d={runner.tail} fill={runner.body} /><rect x="-29" y="-5" width="43" height="25" rx="7" fill={runner.body} />
          <path d={runner.ears} stroke={runner.body} strokeWidth="4" fill={runner.body} />
          <rect x="-20" y="-17" width="42" height="29" rx="7" fill={runner.body} />
          <rect x="-4" y="1" width="26" height="9" rx="4" fill="#fff0da" />
          <path d="M11-9h4v5h-4zM20-2h5v4h-5z" fill={INK} />
          <path d={`M-17 16l${Math.sin(t * 100 + i) * 9} 9M9 16l${Math.cos(t * 100 + i) * 9} 9`} stroke={runner.body} strokeWidth="6" strokeLinecap="round" />
        </g>
      </g>;
    })}
  </>;
}

function Cards({ plan, t }: Scene) {
  const flare = Math.sin(smooth((t - .58) / .41) * Math.PI);
  return <>
    <path d="M420 130L96 340H724Z M420 130L0 0H840Z" fill="#ffda8a" opacity={flare * .13} />
    {plan.lineup.map((ticket, i) => {
      const winner = i === plan.winnerIndex;
      const appear = out((t - i * .047) / .27);
      const flip = smooth((t - .48 - i * .022) / .24);
      const highlight = winner && flip > .5;
      const lift = winner ? smooth((t - .79) / .15) : 0;
      const x = 104 + i * 158;
      const scale = 1 + lift * .23;
      return <g key={i} transform={`translate(${lerp(420, x, appear)} ${lerp(323, 176, appear) - lift * 14}) rotate(${(i - 2) * 13 * (1 - appear)}) scale(${Math.max(.035, Math.abs(Math.cos(flip * Math.PI))) * scale} ${scale})`} opacity={appear * (!winner ? 1 - smooth((t - .81) / .15) * .47 : 1)}>
        <image href={`${DRAW_ART}/card.webp`} x="-74" y="-111" width="148" height="222" className={highlight ? 'rdv-card-winner' : `rdv-card-foil rdv-card-foil-${i}`} />
        {flip > .5 && ticket ? <g transform="translate(0 54)"><Tag ticket={ticket} active={highlight} compact /></g> : <text y="59" fill="#ffe3a1" fontSize="26" fontWeight="900">{flip > .5 ? '·' : '?'}</text>}
        {highlight && <g fill="#fff2bf" opacity={flare}>
          <path d="M-69-98l4-9 4 9 9 4-9 4-4 9-4-9-9-4zM62 17l4-9 4 9 9 4-9 4-4 9-4-9-9-4z" />
        </g>}
      </g>;
    })}
  </>;
}

function Pinball({ plan, t }: Scene) {
  const pocket = (i: number) => 132 + i * 144;
  const target = pocket(plan.winnerIndex);
  const kicks = [0, -65, 52, -49, 36, 0].map((offset, i) => [lerp(420, target, i / 5) + offset * (plan.seed % 2 ? 1 : -1), i === 5 ? 291 : 35 + i * 48]);
  const progress = clamp01(t / .87) * 5;
  const ix = Math.min(4, Math.floor(progress));
  const local = progress - ix;
  const x = lerp(kicks[ix][0], kicks[ix + 1][0], smooth(local));
  const y = lerp(kicks[ix][1], kicks[ix + 1][1], local) - Math.sin(local * Math.PI) * 13;
  return <>
    <path className="rdv-backed-metal" d="M128 51L219 22H621L712 51L803 271H38Z" fill="#241c39" fillOpacity=".77" stroke="url(#rdv-brass)" strokeWidth="4" />
    <path d={`M420 34 Q${x + 32} ${y * .38} ${x} ${y}`} stroke="#ffd391" fill="none" strokeWidth="2" strokeDasharray="2 8" opacity={.32 * (1 - t)} />
    {Array.from({ length: 45 }, (_, i) => {
      const row = Math.floor(i / 9);
      const px = 163 + (i % 9) * 61 + (row % 2) * 22;
      const py = 72 + row * 36;
      const glow = Math.max(0, 1 - Math.hypot(px - x, py - y) / 37);
      return <g key={i}><circle cx={px} cy={py} r={9 + glow * 9} fill={PALETTE[row]} opacity={glow * .53} /><circle cx={px} cy={py} r={5 + glow * 2} fill="url(#rdv-chrome)" stroke={PALETTE[row]} opacity={.69 + glow * .31} /></g>;
    })}
    {plan.lineup.map((ticket, i) => {
      const won = i === plan.winnerIndex && t >= .87;
      return <g key={i} transform={`translate(${pocket(i)} 275)`}><path d="M-62 0H62V51H-62Z" fill={won ? '#664828' : '#282c49'} stroke={won ? GOLD : '#757bac'} strokeWidth="2" /><text y="38" fill={won ? GOLD : '#e2e7fa'} fontSize="23" fontWeight="800">{number(ticket)}</text></g>;
    })}
    <circle className="rdv-ball" cx={x} cy={y} r="13" fill="url(#rdv-chrome)" /><circle cx={x - 4} cy={y - 4} r="3" fill="#fff" />
  </>;
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

function Capsule({ plan, t }: Scene) {
  const drop = out((t - .6) / .28);
  const open = smooth((t - .83) / .16);
  const ticket = plan.lineup[plan.winnerIndex];
  return <>
    <path className="rdv-backed-metal" d="M339 80L379 30H461L501 80V207L470 243H370L339 207Z" fill="url(#rdv-capsule-metal)" stroke="url(#rdv-brass)" strokeWidth="4" />
    <circle cx="420" cy="116" r="71" fill="#122540" fillOpacity=".74" stroke="url(#rdv-brass)" strokeWidth="4" />
    <path d="M370 102Q381 61 420 57" fill="none" stroke="#ffe6f3" strokeOpacity=".6" strokeWidth="4" strokeLinecap="round" />
    {plan.lineup.map((_, i) => {
      const a = i * Math.PI * 2 / plan.lineup.length + out(t / .65) * 21;
      return <g key={i} transform={`translate(${420 + Math.cos(a) * 44} ${116 + Math.sin(a) * 43})`}><circle r="16" fill={PALETTE[i]} /><path d="M-14 0H14A14 14 0 0 1-14 0Z" fill="url(#rdv-chrome)" opacity=".75" /><ellipse cx="-4" cy="-7" rx="6" ry="3" fill="#fff" opacity=".63" /></g>;
    })}
    <path d="M371 215H469V259H371Z" fill="#18142b" stroke="#c196b4" strokeWidth="2" />
    {drop > 0 && <g transform={`translate(${lerp(420, 594, smooth((t - .71) / .2))} ${lerp(140, 232, drop) - open * 17})`}>
      <path d="M-28 0A28 28 0 0 1 28 0Z" transform={`translate(${-open * 23} ${-open * 50}) rotate(${-open * 27})`} fill={GOLD} />
      <path d="M-28 0A28 28 0 0 0 28 0Z" transform={`translate(${open * 23} ${open * 35}) rotate(${open * 33})`} fill="#f298af" />
      {ticket && <g opacity={open} transform="translate(23 -3)"><rect x="-69" y="-34" width="138" height="67" rx="5" fill="#27213e" stroke={GOLD} /><Tag ticket={ticket} active /></g>}
    </g>}
  </>;
}

function Vault({ plan, t }: Scene) {
  const code = number(plan.lineup[plan.winnerIndex]);
  const opening = smooth((t - .69) / .24);
  return <>
    <rect className="rdv-backed-metal" x="143" y="48" width="554" height="247" rx="10" fill="url(#rdv-steel)" stroke="url(#rdv-brass)" strokeWidth="5" />
    <rect x="159" y="63" width="522" height="215" rx="7" fill="#231e23" stroke="#7b6248" strokeWidth="2" />
    <g opacity={opening} transform="translate(420 176)">
      <path d="M-102-49H102V49H-102Z" fill="#55402a" stroke={GOLD} strokeWidth="2" />
      <path d="M-83-36H83M-83 36H83" stroke={GOLD} strokeOpacity=".64" />
      <text y="-2" fill={GOLD} fontSize="31" fontWeight="900">No. {code}</text>
      <text y="25" fill="#fff1d5" fontSize="21" fontWeight="700">{shortName(plan.lineup[plan.winnerIndex]?.name ?? '')}</text>
    </g>
    {[-1, 1].map((side) => <g key={side} transform={`translate(${side * opening * 156} 0)`}>
      <rect x={side < 0 ? 165 : 420} y="69" width="255" height="203" fill="url(#rdv-steel)" stroke="url(#rdv-brass)" strokeWidth="2" />
      <path d={`M${side < 0 ? 186 : 442} 90h211v160h-211z`} fill="none" stroke="#765d4b" strokeWidth="2" />
    </g>)}
    <g opacity={1 - opening}>
      <rect x="264" y="114" width="312" height="113" rx="6" fill="#212130" stroke={GOLD} strokeWidth="2" />
      {[...code].map((digit, i) => {
        const x = 420 + (i - (code.length - 1) / 2) * Math.min(64, 280 / code.length);
        const done = t > .39 + i * (.28 / code.length);
        return <text key={i} x={x} y="185" fontSize="42" fontWeight="800" fill={done ? GOLD : '#d4c5b4'}>{done ? digit : Math.floor(t * (44 + i * 9) + i + plan.seed) % 10}</text>;
      })}
      <path d="M280 171H560" stroke="#b69c76" strokeOpacity=".22" />
    </g>
  </>;
}

const SCENES = { race: Race, cards: Cards, pinball: Pinball, wheel: Wheel, capsule: Capsule, vault: Vault };

export function DrawReveal({ plan, startedAt }: { plan: RevealPlan; startedAt: number }) {
  const [t, setTime] = useState(() => clamp01((performance.now() - startedAt) / plan.duration));
  useEffect(() => {
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
  }, [startedAt, plan.duration, plan.lineup.length]);
  const Art = plan.kind === 'fight' ? null : SCENES[plan.kind];
  return <div className={`rdv-scene rdv-${plan.kind}`} aria-hidden="true">
    {Art ? <svg className="rdv-art" viewBox={`0 0 ${W} ${H}`} textAnchor="middle"><Materials /><Art plan={plan} t={t} /></svg> : <DrawArena plan={plan} t={t} />}
    <span className="rdv-progress" style={{ transform: `scaleX(${t})` }} />
  </div>;
}

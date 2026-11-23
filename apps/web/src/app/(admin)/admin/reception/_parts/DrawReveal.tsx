'use client';

import { useEffect, useState } from 'react';
import { clamp01, lerp, out, racePosition, smooth, type RevealPlan, type RevealTicket } from './draw-reveal';
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

function Tag({ ticket, active = false, compact = false }: { ticket: RevealTicket; active?: boolean; compact?: boolean }) {
  const name = compact && [...ticket.name].length > 6 ? `${[...ticket.name].slice(0, 5).join('')}…` : shortName(ticket.name);
  return <g className="rdv-tag">
    <text y="-8" fill={active ? GOLD : '#fff'} fontSize={compact ? 21 : 24} fontWeight="800">No. {number(ticket)}</text>
    <text y="14" fill={active ? GOLD : '#e0e7f2'} fontSize={compact ? 16 : 19} fontWeight="700">{name}</text>
  </g>;
}

function Fighter({ color, variant, step, punch }: { color: string; variant: number; step: number; punch: boolean }) {
  const skin = ['#ffcfad', '#c68160', '#f0ad84'][variant % 3];
  return <g shapeRendering="crispEdges">
    <path fill="#111827" d="M-18-58H15V-53H21V-28H16V-18H24V4H14V22H20V33H3V12H-4V33H-22V23H-17V3H-25V-18H-18V-28H-22V-53H-18Z" />
    <path fill={skin} d="M-16-46H16V-28H10V-22H-10V-27H-16Z" />
    <path fill={['#393247', '#171b2c', '#6c4338', '#533950'][variant % 4]} d="M-18-53H14V-49H19V-42H-7V-36H-17Z" />
    <path fill="#171b2c" d="M7-41H11V-36H7Z" />
    <path fill={color} d="M-19-19H17V-12H25V3H12V13H-13V3H-22V-12H-19Z" />
    <path d="M-8-18H8L0-2Z" fill="#fff5db" /><path d="M-2-17H2V-4H-2Z" fill="#78384c" />
    <path d={`M-14 11H-3V${23 + step}H-14Z M4 11H15V${23 - step}H4Z`} fill="#4b526d" />
    <path d={`M-18 ${22 + step}h16v8h-16z M4 ${22 - step}h17v8h-17z`} fill="#e9edf7" />
    <rect x="-27" y="-10" width="12" height="13" fill="#ffdfaa" />
    <rect x={punch ? 30 : 17} y={punch ? -26 : -15} width="15" height="14" fill="#ffdfaa" />
    {punch && <path d="M18-22H33V-15H18Z" fill={color} />}
  </g>;
}

function Fight({ plan, t }: Scene) {
  const last = smooth((t - .78) / .18);
  const removed = plan.lineup.map((_, i) => i).filter(i => i !== plan.winnerIndex);
  return <>
    <path d="M0 216H840V340H0Z" fill="#382a4b" />
    <path d="M0 246H840M0 277H840M0 318H840M420 215L264 340M420 215L575 340M308 215L42 340M532 215L801 340" stroke="#bd7b9e" strokeOpacity=".24" strokeWidth="2" />
    <path d="M0 205H840V215H0Z" fill="#f39ca6" opacity=".32" />
    <text x="420" y="40" fill="#ffe3b4" fontSize="25" fontWeight="900">{last > .65 ? 'FINAL WINNER' : 'PIXEL FINAL'}</text>
    {plan.lineup.map((ticket, i) => {
      if (!ticket) return null;
      const isWinner = i === plan.winnerIndex;
      const exit = .43 + removed.indexOf(i) * .075;
      const knockout = isWinner ? 0 : out((t - exit) / .14);
      if (knockout >= 1) return null;
      const start = (i + 1) * W / (plan.lineup.length + 1);
      const side = start < W / 2 ? 1 : -1;
      const motion = Math.sin(t * 38 + i * 2) * 27;
      const x = lerp(lerp(start, W / 2 + (i - (plan.lineup.length - 1) / 2) * 85, smooth(t * 4)) + motion * (1 - last), W / 2, isWinner ? last : 0);
      const y = 229 - bounce(t, 18 + i) * (12 - last * 9);
      const punch = t > .14 && t < .83 && Math.sin(t * 58 + i * 1.8) > .38;
      return <g key={ticket.number} opacity={1 - knockout} transform={`translate(${x + side * -66 * knockout} ${y + 33 * knockout})`}>
        <ellipse cy="32" rx="28" ry="7" fill="#0c1020" opacity=".5" />
        <g transform={`translate(0 ${-84 - (i % 2) * 35 * (1 - last)}) scale(${1 + (isWinner ? last * .25 : 0)})`}><Tag ticket={ticket} active={isWinner && last > .6} compact={last < .6} /></g>
        <g transform={`rotate(${side * -60 * knockout}) scale(${side} 1)`}><Fighter color={PALETTE[i]} variant={i} step={Math.sin(t * 73 + i) * 5} punch={punch} /></g>
        {punch && <path d={`M${side * 48} -25l${side * 15} -6M${side * 51} -19h${side * 20}M${side * 48} -12l${side * 15} 8`} stroke={GOLD} strokeWidth="3" />}
      </g>;
    })}
  </>;
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
    <rect x="18" y="22" width="804" height="296" rx="8" fill="#263e44" stroke="#87bdad" strokeOpacity=".55" />
    {plan.lineup.map((ticket, i) => {
      if (!ticket) return null;
      const won = t >= .88 && i === plan.winnerIndex;
      const top = (H - height * plan.lineup.length) / 2 + i * height;
      const runner = RACERS[i];
      const x = 200 + 558 * racePosition(t, i, plan.winnerIndex, plan.seed);
      const jump = t < .9 ? bounce(t, 28 + i * 4) * 7 : 0;
      return <g key={ticket.number}>
        <rect x="29" y={top} width="782" height={height - 3} fill={won ? '#617044' : i % 2 ? '#38545b' : '#304b54'} />
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
  return <>
    <path d="M98 294L377 82M742 294L463 82M0 267H840M0 318H840" stroke="#7aa6f4" strokeOpacity=".22" fill="none" />
    {plan.lineup.map((ticket, i) => {
      const winner = i === plan.winnerIndex;
      const appear = out((t - i * .047) / .27);
      const flip = smooth((t - .48 - i * .022) / .24);
      const highlight = winner && flip > .5;
      const lift = winner ? smooth((t - .79) / .15) : 0;
      const x = 104 + i * 158;
      return <g key={i} transform={`translate(${lerp(420, x, appear)} ${lerp(280, 169, appear) - lift * 15}) scale(${Math.max(.035, Math.abs(Math.cos(flip * Math.PI))) * (1 + lift * .1)} ${1 + lift * .1})`} opacity={appear * (!winner ? 1 - smooth((t - .81) / .15) * .49 : 1)}>
        <path d="M-65-73L-49-101H49L65-73V76L44 104H-44L-65 76Z" fill={highlight ? '#5b3d24' : '#233050'} stroke={highlight ? GOLD : '#82a2e8'} strokeWidth={highlight ? 4 : 2} />
        <path d="M-55-68L-42-89H42L55-68V70L38 91H-38L-55 70Z" fill="none" stroke={highlight ? '#ffedb8' : '#546999'} />
        <path d="M0-66L23-35L0-11L-23-35Z M0-57L13-35L0-21L-13-35Z" fill={highlight ? GOLD : '#9cb5f1'} fillRule="evenodd" />
        {flip > .5 && ticket ? <g transform="translate(0 25)"><Tag ticket={ticket} active={highlight} compact /></g> : <text y="34" fill="#a5b5db" fontSize="33" fontWeight="800">{flip > .5 ? '·' : '?'}</text>}
        <path d="M-31 69H31" stroke={highlight ? GOLD : '#7789bd'} strokeWidth="2" />
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
    <path d="M128 51L219 22H621L712 51L803 271H38Z" fill="#202842" stroke="#7777a4" strokeWidth="2" />
    {Array.from({ length: 45 }, (_, i) => {
      const row = Math.floor(i / 9);
      const px = 163 + (i % 9) * 61 + (row % 2) * 22;
      const py = 72 + row * 36;
      const glow = Math.max(0, 1 - Math.hypot(px - x, py - y) / 37);
      return <circle key={i} cx={px} cy={py} r={6 + glow * 4} fill={glow > .25 ? '#fdcf82' : PALETTE[row]} opacity={.55 + glow * .45} />;
    })}
    {plan.lineup.map((ticket, i) => {
      const won = i === plan.winnerIndex && t >= .87;
      return <g key={i} transform={`translate(${pocket(i)} 275)`}><path d="M-62 0H62V51H-62Z" fill={won ? '#664828' : '#282c49'} stroke={won ? GOLD : '#757bac'} strokeWidth="2" /><text y="38" fill={won ? GOLD : '#e2e7fa'} fontSize="23" fontWeight="800">{number(ticket)}</text></g>;
    })}
    <circle cx={x} cy={y} r="13" fill="#fff0b1" /><circle cx={x - 4} cy={y - 4} r="4" fill="#fff" />
  </>;
}

function Wheel({ plan, t }: Scene) {
  const count = plan.lineup.length;
  const step = Math.PI * 2 / count;
  const spin = (360 * 4 - plan.winnerIndex * 360 / count) * out(t / .92);
  const point = (angle: number, r: number) => [Math.sin(angle) * r, -Math.cos(angle) * r];
  return <g transform="translate(420 179)">
    <circle r="150" fill="#191c30" stroke="#9f7040" strokeWidth="4" /><circle r="143" fill="none" stroke={GOLD} strokeWidth="2" strokeDasharray="2 9" />
    <g transform={`rotate(${spin})`}>
      {plan.lineup.map((ticket, i) => {
        const a = i * step;
        const p0 = point(a - step / 2, 133);
        const p1 = point(a + step / 2, 133);
        const [x, y] = point(a, 103);
        const highlighted = t > .92 && i === plan.winnerIndex;
        return <g key={i}><path d={`M0 0 L${p0.join(' ')} A133 133 0 0 1 ${p1.join(' ')}Z`} fill={highlighted ? GOLD : i % 2 ? '#60475d' : '#32546a'} stroke="#191c30" strokeWidth="2" /><text x={x} y={y} transform={`rotate(${i * 360 / count} ${x} ${y})`} dominantBaseline="middle" fontSize="20" fontWeight="800" fill={highlighted ? INK : '#fff3d6'}>{number(ticket)}</text></g>;
      })}
    </g>
    <circle r="29" fill="#242638" stroke={GOLD} strokeWidth="3" /><path d="M0-13L12 0L0 13L-12 0Z" fill={GOLD} />
    <path d="M-15-158H15L0-122Z" fill="#fff2cc" stroke="#8d5a32" strokeWidth="2" />
  </g>;
}

function Capsule({ plan, t }: Scene) {
  const drop = out((t - .6) / .28);
  const open = smooth((t - .83) / .16);
  const ticket = plan.lineup[plan.winnerIndex];
  return <>
    <path d="M339 80L379 30H461L501 80V207L470 243H370L339 207Z" fill="#45375b" stroke="#d0adce" strokeWidth="3" />
    <circle cx="420" cy="116" r="71" fill="#25334a" stroke="#ecc5df" strokeWidth="4" />
    {plan.lineup.map((_, i) => {
      const a = i * Math.PI * 2 / plan.lineup.length + out(t / .65) * 21;
      return <g key={i} transform={`translate(${420 + Math.cos(a) * 44} ${116 + Math.sin(a) * 43})`}><circle r="16" fill={PALETTE[i]} /><path d="M-14 0H14A14 14 0 0 1-14 0Z" fill={INK} opacity=".35" /></g>;
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
    <rect x="143" y="48" width="554" height="247" rx="10" fill="#41352e" stroke="#b08a53" strokeWidth="3" />
    <rect x="159" y="63" width="522" height="215" rx="7" fill="#231e23" stroke="#7b6248" strokeWidth="2" />
    <g opacity={opening} transform="translate(420 176)">
      <path d="M-102-49H102V49H-102Z" fill="#55402a" stroke={GOLD} strokeWidth="2" />
      <path d="M-83-36H83M-83 36H83" stroke={GOLD} strokeOpacity=".64" />
      <text y="-2" fill={GOLD} fontSize="31" fontWeight="900">No. {code}</text>
      <text y="25" fill="#fff1d5" fontSize="21" fontWeight="700">{shortName(plan.lineup[plan.winnerIndex]?.name ?? '')}</text>
    </g>
    {[-1, 1].map((side) => <g key={side} transform={`translate(${side * opening * 156} 0)`}>
      <rect x={side < 0 ? 165 : 420} y="69" width="255" height="203" fill="#59483e" stroke="#b19161" strokeWidth="2" />
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

const SCENES = { fight: Fight, race: Race, cards: Cards, pinball: Pinball, wheel: Wheel, capsule: Capsule, vault: Vault };

export function DrawReveal({ plan, startedAt }: { plan: RevealPlan; startedAt: number }) {
  const [t, setTime] = useState(() => clamp01((performance.now() - startedAt) / plan.duration));
  useEffect(() => {
    let frame = 0;
    const tick = () => {
      const next = clamp01((performance.now() - startedAt) / plan.duration);
      setTime(next);
      if (next < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [startedAt, plan.duration]);
  const Art = SCENES[plan.kind];
  return <div className={`rdv-scene rdv-${plan.kind}`} aria-hidden="true">
    <svg className="rdv-art" viewBox={`0 0 ${W} ${H}`} textAnchor="middle"><Art plan={plan} t={t} /></svg>
    <span className="rdv-progress" style={{ transform: `scaleX(${t})` }} />
  </div>;
}

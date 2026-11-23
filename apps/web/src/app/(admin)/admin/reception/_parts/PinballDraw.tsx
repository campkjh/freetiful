import { useMemo } from 'react';
import { GOAL_Y, PIN_ROWS, pegX, pegY, pinballPoint, pinballTracks } from './pinball-motion';
import { clamp01, type RevealPlan } from './draw-reveal';

const BALLS = ['#90e1ff', '#ffd567', '#f29dca', '#c6b9ff', '#a9efb0', '#f9ae81'];

export function PinballDraw({ plan, t }: { plan: RevealPlan; t: number }) {
  const tracks = useMemo(() => pinballTracks(plan), [plan]);
  const points = tracks.map(track => ({ ...track, ...pinballPoint(track, t) }));
  const placed = points.filter(ball => ball.finished).sort((a, b) => (a.rank ?? 9) - (b.rank ?? 9));
  const vanes = [[255, 173], [557, 210], [366, 289], [615, 343], [272, 380]];
  return <svg className="rdv-art rdv-wide-art rdv-pinball-art" viewBox="0 0 960 540" textAnchor="middle">
    <defs>
      <linearGradient id="rdv-pb-board" x2="0" y2="1"><stop stopColor="#233c54" /><stop offset="1" stopColor="#12182a" /></linearGradient>
      <linearGradient id="rdv-pb-metal"><stop stopColor="#f1deac" /><stop offset=".48" stopColor="#675a73" /><stop offset="1" stopColor="#ddbc84" /></linearGradient>
      <radialGradient id="rdv-pb-pin" cx=".34" cy=".25" r=".75"><stop stopColor="#fff" /><stop offset=".43" stopColor="#bbd5e8" /><stop offset="1" stopColor="#3b455e" /></radialGradient>
      <pattern id="rdv-pb-grid" width="13" height="13" patternUnits="userSpaceOnUse"><path d="M13 0H0V13" fill="none" stroke="#c6e9ff" strokeOpacity=".07" /></pattern>
      <pattern id="rdv-pb-check" width="18" height="18" patternUnits="userSpaceOnUse"><path fill="#faf5e8" d="M0 0H18V18H0Z" /><path fill="#251d39" d="M0 0H9V9H0ZM9 9H18V18H9Z" /></pattern>
      <clipPath id="rdv-pb-field"><path d="M125 58H741V399L472 453V505H378V453L125 399Z" /></clipPath>
    </defs>
    <path d="M125 58H741V399L472 453V505H378V453L125 399Z" fill="url(#rdv-pb-board)" stroke="url(#rdv-pb-metal)" strokeWidth="14" />
    <path d="M125 58H741V399L472 453V505H378V453L125 399Z" fill="url(#rdv-pb-grid)" stroke="#94c9f5" strokeWidth="1.5" />
    <text x="130" y="38" textAnchor="start" fill="#fff3da" fontSize="20" fontWeight="900">PINBALL RACE</text>
    <text x="737" y="38" textAnchor="end" fill="#e3d5ff" fontSize="15" fontWeight="700">{plan.entrantCount} BALLS</text>
    <g clipPath="url(#rdv-pb-field)">
      <path d="M127 83H741M127 395L383 448M741 395L469 448" stroke="#a49df7" strokeOpacity=".76" strokeWidth="2" />
      {Array.from({ length: PIN_ROWS }, (_, row) => Array.from({ length: 11 }, (_, i) =>
        <circle key={`${row}:${i}`} cx={pegX(row, i)} cy={pegY(row)} r="4.6" fill="url(#rdv-pb-pin)" stroke="#a3c5de" strokeWidth=".6" />
      ))}
      {vanes.map(([x, y], i) => <g key={x} transform={`translate(${x} ${y}) rotate(${t * (i % 2 ? 470 : -530) + i * 25})`}>
        <rect x="-27" y="-3.5" width="54" height="7" rx="3.5" fill={i % 2 ? '#72caf9' : '#bea2ff'} stroke="#e7f6ff" strokeWidth="1" />
        <circle r="6" fill="url(#rdv-pb-pin)" />
      </g>)}
      <path d="M378 449H472V458H378Z" fill="url(#rdv-pb-check)" />
      {points.map(({ ticket, rank, x, y, finished }) => {
        const settling = rank === undefined && y >= GOAL_Y - 24;
        const pulled = rank === undefined && y > 390;
        const bottom = Math.min(y, 390 + 51 * (1 - Math.abs(425 - x) / 320));
        const opacity = finished ? 1 - clamp01((y - GOAL_Y - 11) / 22) : settling ? .48 : .96;
        return <g key={ticket.number} transform={`translate(${x} ${pulled ? bottom : y})`} opacity={opacity}>
          <circle r="9.4" fill={BALLS[ticket.number % BALLS.length]} stroke="#edf8ff" strokeOpacity=".64" />
          <path d="M-6-3Q-3-7 2-7" fill="none" stroke="#fff" strokeOpacity=".75" strokeWidth="1.2" strokeLinecap="round" />
          <text y="2.9" fill="#1a2231" fontSize="7.8" fontWeight="900" style={{ stroke: 'none' }}>{ticket.number}</text>
        </g>;
      })}
    </g>
    <text x="425" y="481" fill="#efe7fc" fontSize="14" fontWeight="900">GOAL</text>
    <g transform="translate(767 75)">
      <text x="0" y="5" textAnchor="start" fill="#f9e3ae" fontSize="15" fontWeight="900">FINISH ORDER</text>
      <text x="0" y="26" textAnchor="start" fill="#d9d4ee" fontSize="12">{placed.length} / {plan.winners.length}명 도착</text>
      {plan.winners.map((_, i) => {
        const ball = placed[i];
        return <g key={i} transform={`translate(0 ${47 + i * 83})`}>
          <rect width="160" height="67" rx="6" fill="#182236" fillOpacity=".93" stroke={ball ? '#ffd476' : '#737f9f'} />
          <text x="15" y="25" textAnchor="start" fill={ball ? '#ffd476' : '#b4c1de'} fontSize="13" fontWeight="900">0{i + 1} {ball ? `· No. ${ball.ticket.number}` : ''}</text>
          <text x="15" y="49" textAnchor="start" fill="#fff" fontSize="16" fontWeight="800">{ball ? ball.ticket.name.slice(0, 8) : '도착 대기'}</text>
        </g>;
      })}
    </g>
  </svg>;
}

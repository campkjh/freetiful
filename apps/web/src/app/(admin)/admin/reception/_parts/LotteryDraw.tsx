import { useMemo } from 'react';
import { clamp01, lerp, out, type RevealPlan, type RevealTicket } from './draw-reveal';
import { lotteryFrames, lotteryPoint, lotteryTube } from './lottery-motion';

const HUES = [0, 165, 290, 70, 190, 320];

function LotteryBall({ x, y, size, spin, ticket }: { x: number; y: number; size: number; spin: number; ticket: RevealTicket }) {
  return <g transform={`translate(${x} ${y}) rotate(${spin})`}>
    <image href="/reception/draw/lottery-ball.webp" x={-size / 2} y={-size / 2} width={size} height={size} style={{ filter: `hue-rotate(${HUES[ticket.number % HUES.length]}deg)` }} />
    <text y={size * .09} fill="#182538" fontWeight="900" fontSize={size * .29} style={{ stroke: 'none' }}>{ticket.number}</text>
  </g>;
}

export function LotteryDraw({ plan, t }: { plan: RevealPlan; t: number }) {
  const frames = useMemo(() => lotteryFrames(plan.lineup.length, plan.seed), [plan]);
  const winner = plan.winners[0];
  const start = lotteryPoint(frames, plan.winnerIndex, 1);
  const tube = lotteryTube({ x: 360 + start.x, y: 149 + start.y }, (t - .6) / .22);
  const lift = out((t - .82) / .14);
  return <>
    <ellipse cx="375" cy="309" rx="242" ry="21" fill="#000" opacity=".36" />
    <text x="122" y="85" fill="#e9fbff" fontSize="15" fontWeight="800">LUCKY BALL</text>
    <text x="122" y="105" fill="#bbe2f6" fontSize="12">{t < .6 ? '공 섞는 중' : '당첨 공 배출'}</text>
    <circle cx="360" cy="149" r="91" fill="#17354e" fillOpacity=".88" />
    {plan.lineup.map((entry, i) => {
      if (!entry || (i === plan.winnerIndex && t >= .6)) return null;
      const point = lotteryPoint(frames, i, clamp01(t / .6));
      return <LotteryBall key={entry.number} x={360 + point.x} y={149 + point.y} size={35} spin={point.x * .32 + point.y * .2} ticket={entry} />;
    })}
    {t >= .6 && t < .82 && <LotteryBall x={tube.x} y={tube.y} size={35} spin={tube.x * .42} ticket={winner} />}
    <image href="/reception/draw/lottery-machine.webp" x="156" y="5" width="438" height="328.5" />
    {t >= .82 && <g>
      <ellipse cx="656" cy="220" rx={49 * lift} ry="11" fill="#000" opacity={.38 * lift} />
      <LotteryBall x={lerp(537, 656, lift)} y={lerp(279, 154, lift)} size={lerp(35, 132, lift)} spin={-120 * (1 - lift)} ticket={winner} />
      <text x="656" y="252" fill="#ffdfa0" fontSize="14" fontWeight="800" opacity={lift}>당첨 번호</text>
      <text x="656" y="280" fill="#fff" fontSize="22" fontWeight="900" opacity={lift}>{winner.name.slice(0, 10)}</text>
    </g>}
  </>;
}

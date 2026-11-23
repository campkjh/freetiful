import { useMemo } from 'react';
import { clamp01, lerp, out, type RevealPlan, type RevealTicket } from './draw-reveal';
import { LOTTERY_DISPLAY, LOTTERY_LIST, LOTTERY_RELEASE, lotteryPoint, lotteryRoundAt, lotteryRounds, lotteryTube } from './lottery-motion';

const HUES = [0, 165, 290, 70, 190, 320];

function LotteryBall({ x, y, size, spin, ticket }: { x: number; y: number; size: number; spin: number; ticket: RevealTicket }) {
  return <g transform={`translate(${x} ${y}) rotate(${spin})`}>
    <image href="/reception/draw/lottery-ball.webp" x={-size / 2} y={-size / 2} width={size} height={size} style={{ filter: `hue-rotate(${HUES[ticket.number % HUES.length]}deg)` }} />
    <text y={size * .09} fill="#182538" fontWeight="900" fontSize={size * .29} style={{ stroke: 'none' }}>{ticket.number}</text>
  </g>;
}

export function LotteryDraw({ plan, t }: { plan: RevealPlan; t: number }) {
  const rounds = useMemo(() => lotteryRounds(plan), [plan]);
  const round = lotteryRoundAt(t, rounds.length);
  const { frames, lineup, winner, winnerIndex } = rounds[round.index];
  const progress = round.progress;
  const start = lotteryPoint(frames, winnerIndex, 1);
  const tube = lotteryTube({ x: 360 + start.x, y: 149 + start.y }, (progress - LOTTERY_RELEASE) / (LOTTERY_DISPLAY - LOTTERY_RELEASE));
  const lift = out((progress - LOTTERY_DISPLAY) / .13);
  const announced = plan.winners.slice(0, round.index + Number(progress >= LOTTERY_LIST));
  return <>
    <ellipse cx="375" cy="309" rx="242" ry="21" fill="#000" opacity=".36" />
    <g data-lottery-round={round.index + 1}>
      <text x="102" y="70" fill="#e9fbff" fontSize="15" fontWeight="800">LUCKY BALL</text>
      <text x="102" y="93" fill="#ffdfa0" fontSize="17" fontWeight="900">{round.index + 1} / {rounds.length}</text>
      <text x="102" y="113" fill="#bbe2f6" fontSize="12">{progress < LOTTERY_RELEASE ? '공 섞는 중' : progress < LOTTERY_DISPLAY ? '당첨 공 배출' : '당첨 공 공개'}</text>
    </g>
    {announced.map((ticket, i) => <g key={ticket.number} data-lottery-winner={ticket.number} transform={`translate(34 ${138 + i * 49})`}>
      <rect width="137" height="42" rx="5" fill="#13253f" stroke="#84b3e8" strokeOpacity=".58" />
      <text x="10" y="16" textAnchor="start" fill="#ffdfa0" fontSize="10" fontWeight="800">{i + 1}번째 · NO. {String(ticket.number).padStart(3, '0')}</text>
      <text x="10" y="33" textAnchor="start" fill="#fff" fontSize="14" fontWeight="800">{ticket.name.slice(0, 8)}</text>
    </g>)}
    <circle cx="360" cy="149" r="91" fill="#17354e" fillOpacity=".88" />
    {lineup.map((entry, i) => {
      if (i === winnerIndex && progress >= LOTTERY_RELEASE) return null;
      const point = lotteryPoint(frames, i, clamp01(progress / LOTTERY_RELEASE));
      return <LotteryBall key={entry.number} x={360 + point.x} y={149 + point.y} size={35} spin={point.x * .32 + point.y * .2} ticket={entry} />;
    })}
    {progress >= LOTTERY_RELEASE && progress < LOTTERY_DISPLAY && <LotteryBall x={tube.x} y={tube.y} size={35} spin={tube.x * .42} ticket={winner} />}
    <image href="/reception/draw/lottery-machine.webp" x="156" y="5" width="438" height="328.5" />
    {progress >= LOTTERY_DISPLAY && <g>
      <ellipse cx="656" cy="220" rx={49 * lift} ry="11" fill="#000" opacity={.38 * lift} />
      <LotteryBall x={lerp(537, 656, lift)} y={lerp(279, 154, lift)} size={lerp(35, 132, lift)} spin={-120 * (1 - lift)} ticket={winner} />
      <text x="656" y="252" fill="#ffdfa0" fontSize="14" fontWeight="800" opacity={lift}>당첨 번호</text>
      <text x="656" y="280" fill="#fff" fontSize="22" fontWeight="900" opacity={lift}>{winner.name.slice(0, 10)}</text>
    </g>}
  </>;
}

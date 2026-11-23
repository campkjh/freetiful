import { clamp01, lerp, out, smooth, type RevealPlan } from './draw-reveal';

export const DRAW_ART = '/reception/draw';
const WIDTH = 960;
const HEIGHT = 540;
const COLOR = ['#ff676e', '#50dfa6', '#65a7ff', '#ffcf6e', '#c485fa', '#48e7f2', '#d7e2ed', '#ff9c52', '#ff709f', '#afda70', '#92b5ff', '#fd8053', '#ff96d4', '#c5bccc', '#69edbb'];
const sprite = (i: number) => `${DRAW_ART}/fighter-${i + 1}.webp`;
const ticketNo = (number: number) => String(number).padStart(3, '0');

function Command({ text, y, opacity = 1, scale = 1 }: { text: string; y: number; opacity?: number; scale?: number }) {
  return <g transform={`translate(480 ${y}) scale(${scale})`} opacity={opacity}>
    <text className="rdv-arcade-command rdv-arcade-depth" y="5" aria-hidden="true">{text}</text>
    <text className="rdv-arcade-command" fill="#ffe8a4">{text}</text>
  </g>;
}

export function DrawArena({ plan, t }: { plan: RevealPlan; t: number }) {
  const roster = plan.lineup;
  const offset = plan.seed % 15;
  const art = (i: number) => (i + offset) % 15;
  const win = roster[plan.winnerIndex];
  const fight = clamp01((t - .31) / .53);
  const ko = smooth((t - .84) / .035);
  const order = roster.map((_, i) => i).filter(i => i !== plan.winnerIndex);

  if (t < .235) {
    const seen = Math.min(roster.length, Math.floor(t / .22 * (roster.length + 1)) + 1);
    const focus = Math.min(roster.length - 1, seen - 1);
    return <svg className="rdv-art rdv-fight-art" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} textAnchor="middle">
      <rect width={WIDTH} height={HEIGHT} fill="#10162b" opacity=".63" />
      <path d="M0 108L217 78V464L0 497Z M960 108L743 78V464L960 497Z" fill="#172440" stroke="#ecd68d" strokeOpacity=".5" strokeWidth="3" />
      <image className="rdv-sprite" href={sprite(art(focus))} x="-4" y="122" width="238" height="344" />
      <g transform="translate(960 0) scale(-1 1)"><image className="rdv-sprite" href={sprite(art((focus + 1) % roster.length))} x="-4" y="122" width="238" height="344" /></g>
      <Command text="FIGHTER SELECT" y={91} scale={.58} />
      {Array.from({ length: 15 }, (_, i) => {
        const x = 250 + i % 5 * 92, y = 126 + Math.floor(i / 5) * 107;
        const candidate = (i - offset + 15) % 15;
        const ticket = roster[candidate];
        const selected = ticket && candidate < seen;
        const highlight = selected && candidate === focus;
        return <g key={i} transform={`translate(${x} ${y})`}>
          <rect width="88" height="103" fill={selected ? '#334057' : '#172535'} stroke={highlight ? '#fff3bd' : selected ? COLOR[i] : '#61718a'} strokeWidth={highlight ? 4 : 2} />
          <svg x="2" y="2" width="84" height="76" viewBox="20 0 206 162" preserveAspectRatio="xMidYMin slice" overflow="hidden"><image className="rdv-sprite" href={sprite(i)} width="246" height="274" opacity={selected ? 1 : .57} /></svg>
          <text x="44" y="95" fill={selected ? '#ffe7a3' : '#a5bad1'} fontSize="17" fontWeight="850">{selected ? `#${ticketNo(ticket.number)}` : String(i + 1).padStart(2, '0')}</text>
        </g>;
      })}
      <text x="480" y="488" fill="#ffe8a4" fontSize="25" fontWeight="800">{roster[focus]?.name} · #{ticketNo(roster[focus]?.number ?? 0)}</text>
    </svg>;
  }

  return <svg className="rdv-art rdv-fight-art" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} textAnchor="middle">
    <rect width={WIDTH} height={HEIGHT} fill="#090f25" opacity={.13 + ko * .32} />
    {roster.map((ticket, i) => {
      if (!ticket) return null;
      const winner = i === plan.winnerIndex;
      const lossAt = winner ? 2 : .29 + order.indexOf(i) / Math.max(1, order.length - 1) * .59;
      const loss = out((fight - lossAt) / .11);
      if (loss === 1) return null;
      const side = i % 2 === 0 ? 1 : -1;
      const row = Math.floor(i / 5);
      const laneX = 95 + (i % 5) * 190 + (row - 1) * 31;
      const freq = fight * Math.PI * (8 + i % 3);
      const waveform = Math.sin(freq + i * 1.42);
      const hit = fight > .05 && fight < .98 && waveform > .82;
      const lunge = Math.sin(freq * 1.6 + i) * (35 + i % 4 * 12) * smooth(fight / .14);
      const pose = smooth((t - .82) / .08);
      const x = lerp(laneX + (1 - out((t - .235) / .075)) * -side * 200 + lunge + side * Number(hit) * 32 - side * loss * 92, 480, winner ? pose : 0);
      const spring = Math.abs(Math.sin(freq * 1.3 + i)) * (hit ? 24 : 10) * (1 - pose);
      const y = lerp(395 + row * 40 - spring - loss * 15, 454, winner ? pose : 0);
      const size = lerp(132 + row * 8, 242, winner ? pose : 0);
      const hue = COLOR[art(i)];
      const name = [...ticket.name].length > 8 ? `${[...ticket.name].slice(0, 7).join('')}…` : ticket.name;
      return <g key={ticket.number} opacity={1 - loss} transform={`translate(${x} ${y})`}>
        <ellipse cy="3" rx={size * .34} ry="10" fill="#0a101e" opacity=".55" />
        <g transform={`rotate(${loss * -side * 65 + (hit ? 8 * side : 0)}) scale(${side * (hit ? 1.14 : 1)} ${hit ? .94 : 1})`}>
          <image className="rdv-sprite" href={sprite(art(i))} x={-size * .52} y={-size} width={size * 1.04} height={size} />
        </g>
        <g transform={`translate(0 ${-size - 12})`}>
          <rect x="-61" y="-26" width="122" height="31" rx="4" fill="#0d111f" opacity=".93" stroke={hue} />
          <text y="-6" fill={winner && pose > .5 ? '#ffe8a4' : '#fff'} fontSize="16" fontWeight="900">#{ticketNo(ticket.number)} {name}</text>
          <path d={`M-55 1h${110 * (winner ? 1 - fight * .26 : 1 - clamp01(fight / lossAt) * .92)}`} stroke={hue} strokeWidth="3" />
        </g>
        {(hit || loss > .04) && <g transform={`translate(${side * 73} ${-size * .57})`}>
          <path d="M0-28L8-7L33-11L17 3L35 18L9 14L0 37L-8 15L-29 18L-17 0L-29-18L-6-11Z" fill={hue} opacity=".82" />
          <path d="M0-16L5-4L20 0L5 4L0 19L-5 4L-18 0L-5-4Z" fill="#fff5be" />
          <path d="M-38-17l-17-7m13 30h-20M21-22l11-15m8 36 19 7" stroke="#fff5be" strokeWidth="3" />
        </g>}
      </g>;
    })}
    {t < .327 && <Command text="FIGHT!" y={244} opacity={1 - smooth((t - .299) / .028)} scale={lerp(1.43, 1, out((t - .235) / .02))} />}
    {ko > 0 && <Command text="K.O." y={146} opacity={ko} scale={lerp(1.5, 1.05, ko)} />}
    {win && ko > 0 && <text x="480" y="503" className="rdv-arena-winner" opacity={ko}>#{ticketNo(win.number)} {win.name}</text>}
  </svg>;
}

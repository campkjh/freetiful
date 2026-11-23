import { clamp01, lerp, out, smooth, type RevealPlan } from './draw-reveal';

export const DRAW_ART = '/reception/draw';
const WIDTH = 960;
const HEIGHT = 540;
const COLOR = ['#ff676e', '#50dfa6', '#65a7ff', '#ffcf6e', '#c485fa', '#48e7f2', '#d7e2ed', '#ff9c52', '#ff709f', '#afda70', '#92b5ff', '#fd8053', '#ff96d4', '#c5bccc', '#69edbb'];
const sprite = (i: number) => `${DRAW_ART}/fighter-${i + 1}.webp`;
const ticketNo = (number: number) => String(number).padStart(3, '0');
const TECHNIQUES = ['잽', '어퍼컷', '연속 펀치', '회전 발차기', '장풍', '강펀치'];

function Footing({ slot, count }: { slot: number; count: number }) {
  const columns = count <= 5 ? count : Math.min(18, Math.ceil(Math.sqrt(count * 1.75)));
  const rows = Math.ceil(count / columns);
  const column = slot % columns;
  const row = Math.floor(slot / columns);
  const inRow = Math.min(columns, count - row * columns);
  const step = Math.min(178, 870 / columns);
  const x = WIDTH / 2 + (column - (inRow - 1) / 2) * step;
  const y = rows === 1 ? 445 : 474 - (rows - row - 1) * Math.min(60, 178 / (rows - 1));
  const size = Math.min(142, 850 / columns, 220 / rows + 8);
  return { x, y, size };
}

function Technique({ id, phase, color, detailed }: { id: number; phase: number; color: string; detailed: boolean }) {
  const power = Math.sin(Math.PI * clamp01(phase));
  const jab = id === 2 ? .28 + Math.abs(Math.sin(phase * Math.PI * 3)) * .72 : power;
  const uppercut = id === 1;
  const kick = id === 3;
  const wave = id === 4;
  const x = wave ? 62 + out(phase) * 155 : kick ? 35 + power * 82 : 31 + jab * (id === 5 ? 127 : 61);
  const y = uppercut ? -46 - power * 61 : kick ? -12 - power * 35 : -64;
  const glow = wave ? .4 + power * .6 : Math.max(.1, power);
  return <g opacity={glow}>
    {wave ? <>
      <path d={`M29-70L${x-11} ${y-11}L${x+20} ${y}L${x-14} ${y+12}L31-58Z`} fill={color} opacity=".48" />
      <ellipse cx={x} cy={y} rx={24 * power + 7} ry={17 * power + 6} fill={color} opacity=".78" />
      <ellipse cx={x + 2} cy={y} rx={13 * power + 3} ry={8 * power + 4} fill="#f8f4ff" />
      <path d={`M${x-21} ${y-20}l21 -9m-36 52 35 6`} stroke={color} strokeWidth="3" />
    </> : kick ? <>
      <path d={`M-12-42L${x * .46} ${y + 17}L${x} ${y + 6}`} stroke="#0e1325" strokeWidth="23" strokeLinejoin="round" fill="none" />
      <path d={`M-12-42L${x * .46} ${y + 17}L${x} ${y + 6}`} stroke={color} strokeWidth="14" strokeLinejoin="round" fill="none" />
      <path d={`M${x-9} ${y+13}l14 -24 18 1 6 14-28 17Z`} fill="#f3e8ca" stroke="#1d2031" strokeWidth="4" />
      <path d={`M-11-88Q${x * .82} -121 ${x+31} ${y+2}`} fill="none" stroke={color} strokeWidth="5" opacity=".7" />
    </> : <>
      <path d={`M12-76Q29-70 ${x} ${y}`} stroke="#101421" strokeWidth="21" strokeLinejoin="round" fill="none" />
      <path d={`M12-76Q29-70 ${x} ${y}`} stroke={color} strokeWidth="13" strokeLinejoin="round" fill="none" />
      <path d={`M${x-9} ${y-8}h22l7 8-6 12h-21l-7-6Z`} fill="#ffe4a3" stroke="#241c25" strokeWidth="4" />
      <path d={`M${x-7} ${y-5}h17m-${id === 2 ? 27 : 20} 22h18`} stroke="#fff9d8" strokeWidth="3" />
    </>}
    {detailed && power > .6 && <path d={`M${x} ${y-28}l8 18 25-7-16 16 18 9-24 3-6 25-9-19-24 7 14-20-20-15 25 6Z`} fill={color} opacity=".8" />}
    {detailed && power > .76 && <path d={`M${x+4} ${y-12}l6 8 15 3-15 5-7 11-4-10-12-5 12-4Z`} fill="#fff7c5" />}
  </g>;
}

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
  const fight = clamp01((t - .30) / .57);
  const ko = smooth((t - .87) / .035);
  const order = [...roster.keys()].filter(i => i !== plan.winnerIndex).concat(plan.winnerIndex);
  const remainingAt = (value: number) => Math.max(1, roster.length - Math.ceil(Math.sqrt(clamp01((value - .10) / .73)) * Math.max(0, roster.length - 2)));

  if (t < .235) {
    const portraitCount = Math.min(roster.length, 15);
    const seen = Math.min(portraitCount, Math.floor(t / .22 * (portraitCount + 1)) + 1);
    const focus = Math.min(portraitCount - 1, seen - 1);
    return <svg className="rdv-art rdv-fight-art" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} textAnchor="middle">
      <rect width={WIDTH} height={HEIGHT} fill="#10162b" opacity=".63" />
      <path d="M0 108L217 78V464L0 497Z M960 108L743 78V464L960 497Z" fill="#172440" stroke="#ecd68d" strokeOpacity=".5" strokeWidth="3" />
      <image className="rdv-sprite" href={sprite(art(focus))} x="-4" y="122" width="238" height="344" />
      <g transform="translate(960 0) scale(-1 1)"><image className="rdv-sprite" href={sprite(art((focus + 1) % roster.length))} x="-4" y="122" width="238" height="344" /></g>
      <Command text="FREETIFUL FIGHT" y={91} scale={.56} />
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
      <text x="480" y="488" fill="#ffe8a4" fontSize="25" fontWeight="800">{roster.length}명 출전 · #{ticketNo(roster[focus]?.number ?? 0)} {roster[focus]?.name}</text>
    </svg>;
  }

  return <svg className="rdv-art rdv-fight-art" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} textAnchor="middle">
    <rect width={WIDTH} height={HEIGHT} fill="#090f25" opacity={.13 + ko * .32} />
    {order.map((i, rank) => {
      const ticket = roster[i];
      if (!ticket) return null;
      const winner = i === plan.winnerIndex;
      const runnerUp = rank === order.length - 2;
      const lossAt = winner ? 2 : runnerUp ? .92 : .10 + (rank / Math.max(1, order.length - 2)) ** 2 * .73;
      const loss = out((fight - lossAt) / (runnerUp ? .075 : .095));
      if (loss === 1) return null;
      const checkpoint = Math.min(9, Math.floor(fight * 10));
      const a = remainingAt(checkpoint / 10);
      const b = remainingAt((checkpoint + 1) / 10);
      const footingA = Footing({ slot: Math.max(0, rank - (roster.length - a)), count: a });
      const footingB = Footing({ slot: Math.max(0, rank - (roster.length - b)), count: b });
      const mix = smooth(fight * 10 - checkpoint);
      const baseX = lerp(footingA.x, footingB.x, mix);
      const baseSize = lerp(footingA.size, footingB.size, mix);
      const side = baseX < WIDTH / 2 || winner && roster.length > 1 ? 1 : -1;
      const sequence = fight * (8 + i % 3) + i * .37;
      const beat = sequence % 1;
      const finalBlow = winner && roster.length > 1 && fight > .83 && fight < .97;
      const phase = finalBlow ? (fight - .83) / .14 : clamp01((beat - .21) / .60);
      const attack = finalBlow ? 5 : (Math.floor(sequence) + i) % TECHNIQUES.length;
      const hit = finalBlow || (fight > .025 && fight < .85 && phase > 0 && phase < 1);
      const impulse = hit ? Math.sin(Math.PI * phase) : 0;
      const pose = smooth((t - .86) / .08);
      const size = lerp(baseSize, 242, winner ? pose : 0);
      const lunge = Math.sin(sequence * 4 + i) * size * .24 + side * impulse * size * .34;
      let x = baseX + lunge - side * loss * size * .89;
      if (fight > .76 && (winner || runnerUp) && roster.length > 1) {
        x = lerp(x, (winner ? 352 : 602) + (winner ? impulse * 87 : loss * 182), smooth((fight - .76) / .11));
      }
      x = lerp(x, 480, winner ? pose : 0);
      const spring = Math.abs(Math.sin(sequence * 7)) * baseSize * (.055 + impulse * .10) * (1 - pose);
      const y = lerp(lerp(footingA.y, footingB.y, mix) - spring - loss * baseSize * .15, 450, winner ? pose : 0);
      const hue = COLOR[art(i)];
      const name = [...ticket.name].length > 7 ? `${[...ticket.name].slice(0, 6).join('')}…` : ticket.name;
      const detailed = size >= 68;
      const attackSide = fight > .76 && runnerUp ? -1 : side;
      return <g key={ticket.number} opacity={1 - loss} transform={`translate(${x} ${y})`}>
        <ellipse cy="3" rx={size * .34} ry={size * .060} fill="#0a101e" opacity=".55" />
        <g transform={`rotate(${loss * -attackSide * 65 + impulse * 9 * attackSide}) scale(${attackSide * (1 + impulse * .10)} ${1 - impulse * .075})`}>
          <image className="rdv-sprite" href={sprite(art(i))} x={-size * .52} y={-size} width={size * 1.04} height={size} />
          {hit && (detailed || i % 3 === 0) && <g transform={`scale(${size / 146})`}><Technique id={attack} phase={phase} color={hue} detailed={detailed} /></g>}
        </g>
        <g transform={`translate(0 ${-size - (detailed ? 9 : 1)})`}>
          {detailed ? <><rect x="-61" y="-26" width="122" height="31" rx="4" fill="#0d111f" opacity=".93" stroke={hue} />
          <text y="-6" fill={winner && pose > .5 ? '#ffe8a4' : '#fff'} fontSize="16" fontWeight="900">#{ticketNo(ticket.number)} {name}</text>
          <path d={`M-55 1h${110 * (winner ? 1 - fight * .26 : 1 - clamp01(fight / lossAt) * .92)}`} stroke={hue} strokeWidth="3" />
          </> : <text y="0" fill="#fff" fontSize={Math.max(9, size * .24)} fontWeight="900">#{ticketNo(ticket.number)}</text>}
        </g>
        {hit && detailed && impulse > .42 && <text x={attackSide * 28} y={-size - 48} fill={hue} fontSize="18" fontWeight="900">{TECHNIQUES[attack]}</text>}
      </g>;
    })}
    {t < .327 && <Command text="FIGHT!" y={244} opacity={1 - smooth((t - .299) / .028)} scale={lerp(1.43, 1, out((t - .235) / .02))} />}
    {ko > 0 && <Command text="K.O." y={146} opacity={ko} scale={lerp(1.5, 1.05, ko)} />}
    {win && ko > 0 && <text x="480" y="503" className="rdv-arena-winner" opacity={ko}>#{ticketNo(win.number)} {win.name}</text>}
  </svg>;
}

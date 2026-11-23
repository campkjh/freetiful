import { clamp01, lerp, out, smooth, type RevealPlan } from './draw-reveal';

const DROPS = [.34, .60, .88];
const PHASES = ['IRON GUARD', 'VOLT STRIKER', 'VENOM CORE'];
const COLORS = ['#ff8c52', '#69ecff', '#e6a2ff'];
const asset = (name: string) => `/reception/draw/${name}.webp`;

function Burst({ x, y, progress, color }: { x: number; y: number; progress: number; color: string }) {
  if (progress <= 0 || progress >= 1) return null;
  const radius = 14 + out(progress) * 77;
  return <g transform={`translate(${x} ${y})`} opacity={1 - progress}>
    <path transform={`scale(${radius / 26})`} d="M0-26L5-9L18-19L16-4L32 0L18 8L25 19L8 15L1 32L-6 16L-24 25L-16 7L-33 0L-15-7L-20-21L-6-14Z" fill={color} />
    <path transform={`scale(${radius / 47})`} d="M0-26L5-9L25-17L13-1L29 8L11 11L0 27L-6 13L-26 19L-14 4L-28-4L-10-9Z" fill="#fff2bc" />
    {Array.from({ length: 15 }, (_, i) => {
      const angle = i * 2.4;
      return <rect key={i} x={Math.cos(angle) * radius * (1.2 + i % 3 * .2)} y={Math.sin(angle) * radius * .72 + progress ** 2 * 27} width={4 + i % 3 * 2} height={4 + i % 4} fill={i % 2 ? color : '#ffcb72'} />;
    })}
  </g>;
}

export function BossDraw({ plan, t }: { plan: RevealPlan; t: number }) {
  const phase = t < DROPS[0] ? 0 : t < DROPS[1] ? 1 : 2;
  const start = phase > 0 ? DROPS[phase - 1] : .106;
  const form = clamp01((t - start) / (DROPS[phase] - start));
  const changing = phase > 0 && t - start < .069;
  const bossIn = out((t - start) / (phase === 0 ? .09 : .059));
  const defeated = smooth((t - DROPS[2]) / .065);
  const attack = clamp01((t - .17) / .63);
  const rapid = ((t * 180) % 1);
  const shake = Math.sin(t * 410) * Math.sin(Math.PI * rapid) * (attack > 0 && attack < 1 ? 2.8 : 0);
  return <svg className="rdv-art rdv-wide-art rdv-boss-art" viewBox="0 0 960 540" textAnchor="middle">
    <defs>
      <linearGradient id="rdv-boss-floor" x2="0" y2="1"><stop stopColor="#142035" stopOpacity=".18" /><stop offset="1" stopColor="#1d132a" stopOpacity=".75" /></linearGradient>
      <pattern id="rdv-boss-stripes" width="22" height="22" patternTransform="rotate(42)" patternUnits="userSpaceOnUse"><rect width="22" height="22" fill="#151424" /><rect width="11" height="22" fill="#f7be55" /></pattern>
    </defs>
    <path d="M0 430H960V540H0Z" fill="url(#rdv-boss-floor)" />
    <g className="rdv-boss-hud" fontWeight="900">
      {[0, 1].map(i => <g key={i} transform={`translate(${53 + i * 208} 54)`}>
        <text textAnchor="start" fill={i ? '#ff6b6b' : '#85f4fe'} fontSize="23">{i + 1}P</text>
        <rect x="43" y="-18" width="147" height="19" fill="#131725" stroke="#ffebbb" strokeWidth="2" />
        <rect x="47" y="-14" width={139 * (1 - form * (i ? .21 : .12))} height="11" fill={i ? '#ff806c' : '#6df2d6'} />
      </g>)}
      <text textAnchor="end" x="903" y="52" fill={COLORS[phase]} fontSize="23">BOSS {phase + 1}/3 · {PHASES[phase]}</text>
      <rect x="608" y="65" width="295" height="21" fill="#161626" stroke="#ffe1a1" strokeWidth="2" />
      <rect x="612" y="69" width={287 * Math.max(0, 1 - form)} height="13" fill={COLORS[phase]} />
    </g>
    <ellipse cx="690" cy="421" rx="168" ry="19" fill="#091326" opacity={.64 * (1 - defeated)} />
    {[0, 1].map(i => {
      const recoil = attack > 0 && attack < 1 ? (1 - rapid) * (5 + 6 * i) : 0;
      const bob = Math.sin(t * 145 + i) * 3;
      const x = 83 + i * 125 + out(t / .21) * 44 - recoil;
      const y = 255 + i * 27 + bob;
      return <g key={i}>
        <ellipse cx={x + 72} cy={y + 134} rx="45" ry="9" fill="#14162a" opacity=".71" />
        <image className="rdv-sprite" href={asset(`hero-${i + 1}`)} x={x} y={y} width="151" height="151" />
        <text x={x + 73} y={y - 5} fill={i ? '#ffa582' : '#88faff'} fontSize="16" fontWeight="900">{i + 1}P</text>
        {attack > 0 && attack < 1 && Array.from({ length: 4 }, (_, j) => {
          const bullet = (t * (16 + i * 4) + j * .25) % 1;
          return <path key={j} transform={`translate(${lerp(x + 126, 615, bullet)} ${y + 64 - bullet * (25 + i * 24)})`} d="M-19 0L8-4L21 0L8 4Z" fill={i ? '#ffbf66' : '#9cf9ff'} />;
        })}
      </g>;
    })}
    {changing && <image className="rdv-sprite" href={asset(`boss-${phase}`)} x="509" y="83" width="365" height="365" opacity={1 - bossIn} />}
    {t >= .106 && <image className="rdv-sprite" href={asset(`boss-${phase + 1}`)} x={509 + shake + defeated * 12} y={83 + (1 - bossIn) * 19 - defeated * 18} width="365" height="365" opacity={bossIn * (1 - defeated)} />}
    {t > .16 && t < .89 && (
      <g transform={`translate(${lerp(604, 317, (t * (6 + phase)) % 1)} ${250 + Math.sin(t * 88) * 31})`} fill="none" stroke={COLORS[phase]} strokeLinejoin="bevel">
        <path d="M-33 2L-16-8L-7 3L9-9L20 1L35-2" strokeWidth="7" opacity=".4" />
        <path d="M-33 2L-16-8L-7 3L9-9L20 1L35-2" strokeWidth="2" />
      </g>
    )}
    <Burst x={619 + (rapid - .5) * 54} y={282 + Math.sin(t * 200) * 38} progress={attack > 0 && attack < 1 ? rapid : 1} color={COLORS[phase]} />
    {DROPS.map((point, i) => <Burst key={point} x={680 + i * 16} y={295 - i * 14} progress={(t - point) / .11} color={COLORS[i]} />)}
    {t < .112 && <g transform="translate(480 262)">
      <rect x="-254" y="-49" width="508" height="98" fill="#1b1922" fillOpacity=".93" stroke="#ffbe52" strokeWidth="3" />
      <path d="M-252-48H252V-36H-252ZM-252 36H252V48H-252Z" fill="url(#rdv-boss-stripes)" />
      <text y="15" fill="#ffbf62" fontSize="46" fontWeight="950">WARNING</text>
    </g>}
    {changing && <text x="692" y="181" fill="#f6ffed" fontSize="22" fontWeight="950" opacity={1 - bossIn}>FORM CHANGE</text>}
    {t > .89 && <text x="480" y="153" fill="#fff3a7" fontSize="39" fontWeight="950" opacity={out((t - .89) / .05)}>MISSION COMPLETE</text>}
    {DROPS.map((point, i) => {
      const win = plan.winners[i];
      const p = clamp01((t - point) / .07);
      const x = 154 + i * 222;
      const y = p < .76 ? lerp(334, 452, (p / .76) ** 2) : 452 - Math.sin((p - .76) / .24 * Math.PI) * 12;
      if (!win || t < point) return null;
      return <g key={win.number}>
        <image className="rdv-sprite" href={asset('loot')} x={x - 30} y={y - 7} width="60" height="60" />
        <g transform={`translate(${x + 24} ${y + 13})`} opacity={out(p * 1.6)}>
          <path d="M0 0H184V42H0L-10 33V9Z" stroke="#ffc46b" strokeWidth="2" fill="#211d2b" />
          <text x="12" y="16" textAnchor="start" fill="#ffce7e" fontSize="11" fontWeight="900">ITEM 0{i + 1} · No. {win.number}</text>
          <text x="12" y="34" textAnchor="start" fill="#fff3de" fontSize="16" fontWeight="900">{win.name.slice(0, 10)}</text>
        </g>
      </g>;
    })}
  </svg>;
}

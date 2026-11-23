import { clamp01, lerp, out, smooth, type RevealPlan } from './draw-reveal';
import { SERUM_CLEAR, SERUM_DROPS, SERUM_ENTRY, serumBossMotion, serumHeroMotion } from './serum-motion';

const PHASES = ['IRON GUARD', 'VOLT STRIKER', 'VENOM CORE'];
const COLORS = ['#ff934b', '#6bf4ff', '#e6a2ff'];
const HERO_COLORS = ['#84f4ff', '#ff996f'];
const SHEETS = {
  players: { columns: 6, rows: 4, cell: 160 },
  bosses: { columns: 4, rows: 3, cell: 264 },
  effects: { columns: 4, rows: 2, cell: 192 },
  loot: { columns: 3, rows: 1, cell: 144 },
} as const;

function Sprite({ sheet, row, frame, x, y, size, opacity = 1 }: {
  sheet: keyof typeof SHEETS; row: number; frame: number; x: number; y: number; size: number; opacity?: number;
}) {
  const { columns, rows, cell } = SHEETS[sheet];
  return <svg x={x} y={y} width={size} height={size} viewBox={`${frame * cell} ${row * cell} ${cell} ${cell}`} overflow="hidden" opacity={opacity}>
    <image className="rdv-sprite" href={`/reception/draw/serum-${sheet}.webp`} width={columns * cell} height={rows * cell} />
  </svg>;
}

function Impact({ x, y, progress, size, energy = false }: { x: number; y: number; progress: number; size: number; energy?: boolean }) {
  if (progress < 0 || progress >= 1) return null;
  const span = size * (.77 + .26 * out(progress));
  return <Sprite sheet="effects" row={energy ? 1 : 0} frame={Math.floor(progress * 4)} x={x - span / 2} y={y - span / 2} size={span} opacity={1 - smooth((progress - .75) / .25)} />;
}

export function BossDraw({ plan, t }: { plan: RevealPlan; t: number }) {
  const { phase, part, morph, forming, defeated, death, counter } = serumBossMotion(t);
  const seconds = t * plan.duration / 1000;
  const entering = t < SERUM_ENTRY;
  const collecting = defeated && death > .56 && t < SERUM_CLEAR;
  const moving = entering || collecting;
  const combat = !entering && !forming && !defeated;
  const crew = [0, 1].map(i => {
    const pose = serumHeroMotion(seconds, i, combat && counter < .36, moving);
    const entry = smooth(t / SERUM_ENTRY);
    const rush = collecting || t >= SERUM_CLEAR ? smooth((t - .936) / (SERUM_CLEAR - .936)) : 0;
    const x = lerp(-115 - i * 47, 105 + i * 130, entry) + rush * (51 + i * 30);
    const y = 319 + i * 21 - (moving ? Math.sin(seconds * 22 + i) * 3 : 0);
    return { ...pose, x, y, size: 111 };
  });
  const hit = crew.find(hero => hero.contact >= 0)?.contact ?? -1;
  const aimingBack = counter >= 0;
  const frame = defeated || forming ? 3 : hit >= 0 && !aimingBack ? 2 : aimingBack ? 1 : 0;
  const bossRow = forming && morph < .51 ? phase - 1 : phase;
  const bossSize = 395;
  const bossScale = forming ? 1 - Math.sin(morph * Math.PI) * .18 : defeated ? 1 + death * .18 : 1;
  const recoil = hit >= 0 && !aimingBack ? (1 - hit) * 13 : 0;
  const bossFloat = bossRow === 1 ? Math.sin(seconds * 4) * 8 : 0;
  const bossX = 719 + recoil + exitOffset(death);
  const bossY = 430 - bossSize + bossFloat;
  const color = COLORS[phase];
  const bossState = entering ? 'entry' : defeated ? 'defeat' : forming ? 'transform' : aimingBack ? 'attack' : hit >= 0 ? 'hit' : 'idle';

  return <svg className="rdv-art rdv-wide-art rdv-boss-art" viewBox="0 0 960 540" textAnchor="middle" data-boss-state={bossState} data-boss-phase={phase + 1}>
    <defs>
      <linearGradient id="rdv-boss-floor" x2="0" y2="1"><stop stopColor="#142035" stopOpacity=".18" /><stop offset="1" stopColor="#1d132a" stopOpacity=".76" /></linearGradient>
      <pattern id="rdv-boss-stripes" width="22" height="22" patternTransform="rotate(42)" patternUnits="userSpaceOnUse"><rect width="22" height="22" fill="#151424" /><rect width="11" height="22" fill="#f7be55" /></pattern>
    </defs>
    <path d="M0 427H960V540H0Z" fill="url(#rdv-boss-floor)" />
    <path d="M0 430H960" fill="none" stroke="#6adfe1" strokeOpacity=".15" />
    <ellipse cx="719" cy="427" rx="169" ry="18" fill="#091326" opacity={.69 * (1 - death)} />
    {(!entering || t > .068) && death < .81 && <g transform={`translate(${bossX} ${bossY + bossSize}) scale(${bossScale})`}>
      <Sprite sheet="bosses" row={bossRow} frame={frame} x={-bossSize / 2} y={-bossSize} size={bossSize} opacity={entering ? (t - .068) / (SERUM_ENTRY - .068) : 1 - smooth(death / .81)} />
    </g>}
    {forming && <Impact x={710} y={240} progress={morph} size={396} energy />}
    {aimingBack && (() => {
      const x = lerp(600, 267, counter);
      const y = 258 + counter * 69;
      return <g transform={`translate(${x} ${y})`} opacity={1 - smooth((counter - .81) / .19)}>
        <path d={phase === 0 ? 'M-30 0L-20-10H19L36 0L19 10H-20Z' : phase === 1 ? 'M-48 7L-29-16L-16-5L4-19L10-6L38-13L22-1L30 8L0 20L-10 4L-31 18Z' : 'M-54 0L-36-12H57L74 0L57 12H-36Z'} fill={color} opacity=".82" />
        <path d="M-31 0H44" stroke="#fff8df" strokeWidth="4" strokeDasharray={phase === 1 ? '7 4' : undefined} />
      </g>;
    })()}
    {crew.flatMap((hero, i) => {
      const bullet = hero.pulse;
      const x = lerp(hero.x + 82, 610 + i * 29, Math.max(0, bullet));
      const y = lerp(hero.y + 46, 246 + i * 37, Math.max(0, bullet));
      return [
        bullet >= 0 && <path key={`shot-${i}`} d="M-23 0L-5-4H10L18 0L10 4H-5Z" transform={`translate(${x} ${y})`} fill={HERO_COLORS[i]} />,
        <Impact key={`hit-${i}`} x={610 + i * 29} y={246 + i * 37} progress={hero.contact} size={82} />,
      ];
    })}
    {crew.map((hero, i) => (
      <g key={i} data-player={i + 1} data-player-motion={hero.state} data-player-frame={hero.frame}>
        <ellipse cx={hero.x + hero.size / 2} cy={hero.y + hero.size - 6} rx="31" ry="6" fill="#0c1528" opacity=".75" />
        <Sprite sheet="players" row={hero.row} frame={hero.frame} x={hero.x} y={hero.y} size={hero.size} />
        <text x={hero.x + hero.size / 2} y={hero.y - 2} fill={HERO_COLORS[i]} fontSize="15" fontWeight="950">{i + 1}P</text>
        {hero.state === 'reload' && <text x={hero.x + hero.size / 2} y={hero.y - 20} fill="#ffe1a0" fontSize="11" fontWeight="950">RELOAD</text>}
      </g>
    ))}
    {defeated && <>
      <Impact x={701} y={271} progress={death} size={430} />
      <Impact x={785} y={192} progress={(death - .17) / .8} size={262} energy />
      <Impact x={591} y={319} progress={(death - .36) / .64} size={234} />
    </>}
    <g className="rdv-boss-hud" fontWeight="900">
      <path d="M20 21H940V97H20Z" fill="#0c1425" fillOpacity=".66" />
      {crew.map((hero, i) => <g key={i} transform={`translate(${53 + i * 208} 53)`}>
        <text textAnchor="start" fill={HERO_COLORS[i]} fontSize="23">{i + 1}P</text>
        <rect x="43" y="-18" width="147" height="18" fill="#131725" stroke="#ffebbb" strokeWidth="2" />
        <rect x="47" y="-14" width={139 * (1 - (phase + part) * (i ? .064 : .041))} height="10" fill={HERO_COLORS[i]} />
        <text x="44" y="17" textAnchor="start" fill="#b7cfe8" fontSize="10">{hero.state === 'reload' ? 'MAGAZINE' : 'AMMO'}</text>
        {Array.from({ length: 6 }, (_, j) => <rect key={j} x={106 + j * 13} y="8" width="8" height="10" fill={HERO_COLORS[i]} opacity={hero.state === 'reload' ? (hero.frame === 3 ? .23 : .79) : j < Math.floor(2 + (1 - Math.max(0, hero.pulse)) * 4) ? .99 : .28} />)}
      </g>)}
      <text textAnchor="end" x="901" y="54" fill={color} fontSize="21">BOSS {phase + 1}/3 · {PHASES[phase]}</text>
      <rect x="611" y="67" width="290" height="18" fill="#161626" stroke="#ffe1a1" strokeWidth="2" />
      <rect x="615" y="71" width={282 * (1 - part)} height="10" fill={color} />
    </g>
    {entering && <g transform="translate(480 181)" opacity={out(t / .017)}>
      <rect x="-220" y="-41" width="440" height="82" fill="#201520" fillOpacity=".94" stroke="#ffbe52" strokeWidth="3" />
      <path d="M-219-40H219V-30H-219ZM-219 30H219V40H-219Z" fill="url(#rdv-boss-stripes)" />
      <text y="14" fill="#ffbf62" fontSize="40" fontWeight="950">WARNING</text>
    </g>}
    {forming && <text x="707" y="121" fill="#f8e8ff" fontSize="20" fontWeight="950" opacity={Math.sin(Math.PI * morph)}>FORM CHANGE</text>}
    {t > SERUM_CLEAR && <text x="480" y="152" fill="#fff3a7" fontSize="35" fontWeight="950" opacity={out((t - SERUM_CLEAR) / .025)}>MISSION COMPLETE</text>}
    {SERUM_DROPS.map((point, i) => {
      const win = plan.winners[i];
      if (!win || t < point) return null;
      const drop = clamp01((t - point) / .057);
      const x = lerp(690, 103 + i * 267, out(drop));
      const floor = drop < .76 ? lerp(298, 447, (drop / .76) ** 2) : 447 - Math.sin((drop - .76) / .24 * Math.PI) * 14;
      return <g key={win.number} data-serum-drop={i + 1}>
        <Sprite sheet="loot" row={0} frame={i} x={x - 28} y={floor - 6} size={67} />
        <g transform={`translate(${x + 35} ${floor + 10})`} opacity={out((drop - .66) / .34)}>
          <path d="M0 0H169V43H0L-8 33V10Z" stroke={COLORS[i]} strokeWidth="2" fill="#201d33" />
          <text x="11" y="16" textAnchor="start" fill={COLORS[i]} fontSize="11" fontWeight="900">ITEM 0{i + 1} · No. {win.number}</text>
          <text x="11" y="34" textAnchor="start" fill="#fff3de" fontSize="15" fontWeight="900">{win.name.slice(0, 10)}</text>
        </g>
      </g>;
    })}
  </svg>;
}

const exitOffset = (death: number) => 21 * death;

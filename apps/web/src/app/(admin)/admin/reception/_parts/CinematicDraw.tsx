import { Crown, Gem, Orbit, Sparkles, Zap } from 'lucide-react';
import { clamp01, lerp, out, smooth, type RevealPlan } from './draw-reveal';

const ASSET = '/reception/draw';
const LOGO = '/images/logo-prettyful.svg';
const MC = `${ASSET}/pudding-host-1.webp`;
const sticker = (n: number) => `/images/chat-stickers/freeti/freeti-${n}.png`;
const pad = (n: number) => String(n).padStart(3, '0');
const COLORS = ['#fff3bb', '#f3bb67', '#abdfff', '#ba94ff', '#fff'];
const CRESTS = [Sparkles, Gem, Crown, Orbit, Zap];
const pulse = (t: number, middle: number, span: number) => Math.max(0, 1 - Math.abs(t - middle) / span) ** 2;

function Sparks({ time, power, center = [480, 236], count = 85 }: { time: number; power: number; center?: number[]; count?: number }) {
  if (power <= 0) return null;
  return <g opacity={power}>{Array.from({ length: count }, (_, i) => {
    const angle = i * 2.39996 + time * .28, wave = (i * .618 + time * (.32 + i % 4 * .06)) % 1;
    const speed = wave ** 1.37 * (190 + (i * 13) % 540);
    const x = center[0] + Math.cos(angle) * speed, y = center[1] + Math.sin(angle) * speed * .71;
    const size = 1.1 + (i % 5) * .91;
    return <path key={i} d={`M-${size * 2} 0L0-${size}L${size * 2} 0L0 ${size}Z`} transform={`translate(${x} ${y}) rotate(${angle * 58})`} fill={COLORS[i % 5]} opacity={Math.sin(wave * Math.PI) * .94} />;
  })}</g>;
}

export function CinematicCards({ plan, t, opened, onOpen }: { plan: RevealPlan; t: number; opened: readonly number[]; onOpen: (index: number) => void }) {
  const tunnel = t >= .16 && t < .76;
  const open = t >= .76;
  const pan = clamp01((t - .16) / .60);
  const chip = pan < .47 ? 0 : pan < .71 ? 1 : 2;
  const clueProgress = clamp01((pan - [.27, .47, .71][chip]) / [.20, .24, .26][chip]);
  const clueAlpha = Math.sin(clueProgress * Math.PI) ** .47;
  const light = pulse(t, .157, .093) * .88 + pulse(t, .755, .078) * .78 + pulse(t, .843, .037) * .54;
  const lift = out((t - .762) / .13);
  const reveal = smooth((t - .827) / .116);
  return <svg className="rdv-art rdv-wide-art rdv-cinematic" viewBox="0 0 960 540" textAnchor="middle">
    <defs>
      <radialGradient id="rdv-card-light"><stop stopColor="#fff" /><stop offset=".29" stopColor="#dcf6ff" /><stop offset=".69" stopColor="#7bd8ff" stopOpacity=".55" /><stop offset="1" stopColor="#8069ed" stopOpacity="0" /></radialGradient>
      <linearGradient id="rdv-tunnel-shade" x2="0" y2="1"><stop stopColor="#0b0e20" /><stop offset=".45" stopColor="#353b58" /><stop offset="1" stopColor="#121728" /></linearGradient>
      <linearGradient id="rdv-prism" x2="0" y2="1"><stop stopColor="#fff7c8" /><stop offset=".35" stopColor="#ebaa4c" /><stop offset=".68" stopColor="#f3edff" /><stop offset="1" stopColor="#6ad9ff" /></linearGradient>
    </defs>
    <rect width="960" height="540" fill={open ? '#1b1132' : '#111321'} />
    {!tunnel && !open && <g transform={`translate(480 254) scale(${.8 + out(t / .16) * .42})`}>
      <rect x="-139" y="-185" width="278" height="370" rx="20" fill="#111a2a" stroke="#263e54" strokeWidth="22" />
      <rect x="-130" y="-176" width="260" height="352" rx="16" fill="none" stroke="#76ffe4" strokeWidth="4" opacity={.35 + t * 3} />
      <rect x="-117" y="-163" width="234" height="326" rx="14" fill="none" stroke="#a1dfff" strokeWidth="2" opacity=".63" />
      <ellipse rx={125 + t * 1730} ry={190 + t * 770} fill="url(#rdv-card-light)" opacity={out(t / .13)} />
    </g>}
    {tunnel && <g>
      <path d="M0 0H960V540H0Z" fill="url(#rdv-tunnel-shade)" />
      <path d="M0 540L357 245H603L960 540Z" fill="#27374d" />
      <path d="M0 0L375 202H585L960 0Z" fill="#18182a" />
      <path d="M0 97L362 218M960 97L598 218M0 464L369 269M960 464L591 269M202 0L407 219M758 0L553 219M251 540L426 272M709 540L534 272" stroke="#de8dd9" strokeWidth="2" opacity=".56" />
      {Array.from({ length: 9 }, (_, i) => {
        const z = ((i / 9 + pan * 2.7) % 1) ** 2.2;
        const x = lerp(67, 542, z), y = lerp(35, 300, z);
        return <path key={i} transform="translate(480 245)" d={`M${-x} ${y}V${-y * .69}L${-x * .74} ${-y}H${x * .74}L${x} ${-y * .69}V${y}`} fill="none" stroke={i % 2 ? '#e8baf4' : '#7185dc'} strokeWidth={2 + z * 4} opacity={.25 + z * .56} />;
      })}
      <ellipse cx="480" cy="245" rx={100 + pan * pan * 149} ry={86 + pan * pan * 97} fill="url(#rdv-card-light)" />
      <g transform={`translate(480 245) scale(${.59 + out(clueProgress) * .75})`} opacity={clueAlpha}>
        {chip === 0 ? <g><rect x="-107" y="-65" width="214" height="130" rx="10" fill="#f0fdff" /><image href={LOGO} x="-91" y="-51" width="182" height="102" /></g>
          : chip === 1 ? <g><rect x="-115" y="-43" width="230" height="86" rx="9" fill="#effaff" /><text y="13" fontSize="29" fontWeight="950" fill="#151e36" style={{ stroke: 'none' }}>STUDIO PASS</text></g>
          : <g><path d="M0-67L67-30L63 32L0 74L-63 32L-67-30Z" fill="#16243f" stroke="url(#rdv-prism)" strokeWidth="5" /><path d="M-35-21L0 46L36-21L0 1Z" fill="url(#rdv-prism)" /><text y="-31" fontSize="15" fill="#fff0bf" fontWeight="900">FREETIFUL</text></g>}
      </g>
    </g>}
    {open && <>
      <image href={`${ASSET}/cards.webp`} width="960" height="540" preserveAspectRatio="xMidYMid slice" opacity=".9" />
      <path d="M480 282L0 40V173L480 286L960 117V0ZM480 282L0 448V510L480 285L960 477V413Z" fill="#d7c6ff" opacity={.24 * lift} />
      <ellipse cx="480" cy="486" rx={68 + lift * 172} ry="16" fill="#ffeac0" opacity={.64 * lift} />
      {plan.lineup.map((ticket, i) => {
        const show = out((t - .771) / .134);
        const x = lerp(480, 480 + (i - 2) * 176, show), y = lerp(491, 286, show);
        const k = .85 + reveal * .15;
        const flipped = opened.includes(i);
        const winner = flipped && i === plan.winnerIndex;
        const Crest = CRESTS[i % CRESTS.length];
        return <g key={i} transform={`translate(${x} ${y}) scale(${k})`} opacity={show}>
          <foreignObject x="-85" y="-142" width="170" height="284">
            <button type="button" className={`rdv-pick-card rdv-pick-card-${i} ${winner ? 'winner' : ''}`} data-open={flipped} disabled={!ticket || t < .94}
              aria-label={flipped && ticket ? `${i + 1}번 카드, No. ${pad(ticket.number)} ${ticket.name}${winner ? ', 당첨' : ''}` : `${i + 1}번 카드 뒤집기`}
              aria-pressed={flipped} onClick={() => { if (!flipped) onOpen(i); }}>
              <span className="rdv-card-sides">
                <span className="rdv-card-back" aria-hidden="true"><strong>{String(i + 1).padStart(2, '0')}</strong><span>FREETIFUL</span></span>
                <span className="rdv-card-front" aria-hidden="true">
                  {flipped && ticket && <>
                    <span className="rdv-card-crest"><Crest size={31} strokeWidth={1.6} /></span>
                    <span className="rdv-card-identity"><strong title={ticket.name}>{ticket.name}</strong><b>No. {pad(ticket.number)}</b></span>
                    <small>{winner ? '당첨' : 'LUCKY DRAW'}</small>
                  </>}
                </span>
              </span>
            </button>
          </foreignObject>
        </g>;
      })}
      <text x="480" y="66" fill="#fff0bf" fontSize="21" fontWeight="950" opacity={lift}>FREETIFUL STUDIO PACK</text>
    </>}
    <g pointerEvents="none"><Sparks time={t * 10} power={open ? .97 : tunnel ? .37 : .73} />
      <ellipse cx="480" cy="243" rx="525" ry="338" fill="url(#rdv-card-light)" opacity={light} /></g>
  </svg>;
}

export function PuddingDraw({ plan, t }: { plan: RevealPlan; t: number }) {
  const scene = t < .23 ? 0 : t < .46 ? 1 : t < .69 ? 2 : 3;
  const local = clamp01((t - [0, .23, .46, .69][scene]) / [.23, .23, .23, .31][scene]);
  const bg = ['oven', 'dough', 'sky', 'palace'][scene];
  const stamp = out((local - .24) / .40);
  const rise = out((local - .08) / .65);
  const shake = scene === 1 ? pulse(local, .67, .16) * Math.sin(t * 1700) * 3 : 0;
  const flash = [ .23, .46, .69, .872 ].reduce((value, mark) => value + pulse(t, mark, .033) * .58, 0);
  const win = plan.winners[0];
  return <svg className="rdv-art rdv-wide-art rdv-cinematic rdv-pudding" viewBox="0 0 960 540" textAnchor="middle">
    <defs>
      <radialGradient id="rdv-pudding-light"><stop stopColor="#fffce5" /><stop offset=".3" stopColor="#fff1b0" /><stop offset=".51" stopColor="#f6a9ff" stopOpacity=".55" /><stop offset="1" stopColor="#9dc7ff" stopOpacity="0" /></radialGradient>
      <linearGradient id="rdv-pudding-label" x2="1" y2="1"><stop stopColor="#132441" /><stop offset=".5" stopColor="#4a3571" /><stop offset="1" stopColor="#362334" /></linearGradient>
    </defs>
    <image href={`${ASSET}/pudding-${bg}.webp`} x={-42 * local + shake} y={-23 * local} width={960 + local * 84} height={540 + local * 46} preserveAspectRatio="xMidYMid slice" />
    {scene === 0 && <>
      <ellipse cx="438" cy="267" rx={49 + 313 * local ** 2} ry={43 + local * local * 270} fill="url(#rdv-pudding-light)" opacity={.18 + local * .73} />
      <image href={sticker(1)} x={73 + out(local) * 131} y={263 + Math.sin(local * 26) * 7} width="169" height="169" className="rdv-pudding-character" />
      <image href={sticker(9)} x={737 - out(local) * 116} y={262 + Math.sin(local * 28 + 1) * 7} width="166" height="166" className="rdv-pudding-character" />
    </>}
    {scene === 1 && <g transform={`translate(480 ${254 - (1 - stamp) * 112}) scale(${1.31 - stamp * .38})`}>
      <image href={sticker(3)} x="-130" y="-124" width="260" height="248" opacity={.28 + stamp * .63} style={{ filter: 'sepia(.84) saturate(1.4) drop-shadow(0 6px 3px #6c391a)' }} />
      <path d="M-140 0H140M0-53V53" stroke="#fff4c0" strokeWidth="2" opacity={pulse(local, .68, .24)} />
    </g>}
    {scene === 2 && <g>
      <ellipse cx="480" cy="250" rx="244" ry="190" fill="url(#rdv-pudding-light)" opacity={.62 * rise} />
      <image href={sticker(12)} x={404 + Math.sin(local * Math.PI * 2) * 24} y={382 - rise * 207} width={146 + rise * 36} height={146 + rise * 36} className="rdv-pudding-character" />
      <path d="M472 340Q538 191 454 148" fill="none" stroke="#fff1b4" strokeWidth="3" strokeDasharray="3 10" opacity={rise * .83} />
    </g>}
    {scene === 3 && <>
      <ellipse cx="480" cy="276" rx={255 + rise * 82} ry="206" fill="url(#rdv-pudding-light)" opacity={.29 + pulse(local, .57, .28) * .69} />
      <image href={MC} x={142 - rise * 24} y={252 - rise * 33} width="221" height="235" opacity={rise * .96} className="rdv-pudding-character" />
      <image href={`${ASSET}/pudding-host-2.webp`} x={622 + rise * 25} y={252 - rise * 14} width="192" height="203" opacity={rise * .95} className="rdv-pudding-character" />
      <image href={sticker(1)} x="344" y={225 - rise * 72 + Math.sin(t * 44) * 4} width="272" height="253" opacity={rise} className="rdv-pudding-character" />
      {local > .58 && <g transform="translate(480 432)" opacity={out((local - .58) / .21)}>
        <path d="M-216-10L-195-32H195L216-10V41L194 58H-195L-216 41Z" fill="url(#rdv-pudding-label)" stroke="#ffdf90" strokeWidth="3" />
        <text y="-3" fill="#ffdf96" fontSize="16" fontWeight="900">FREETIFUL · SPECIAL WINNER</text>
        <text y="36" fill="#fff6e4" fontSize="28" fontWeight="950">NO. {pad(win.number)} · {win.name.slice(0, 9)}</text>
      </g>}
    </>}
    <Sparks time={t * 11} power={scene >= 2 ? .99 : .51} center={[480, 235]} count={70} />
    <ellipse cx="480" cy="253" rx="590" ry="455" fill="url(#rdv-pudding-light)" opacity={Math.min(1, flash)} />
  </svg>;
}

'use client';

import { useEffect, useRef, useState } from 'react';
import { out, type RevealPlan } from './draw-reveal';

function RaceFallback({ plan, t }: { plan: RevealPlan; t: number }) {
  return <svg className="rdv-race-fallback" viewBox="0 0 840 340">
    <path d="M95 73H745L810 320H30Z" fill="#804f37" opacity=".9" />
    <path d="M718 73L778 320" stroke="#fff7e1" strokeWidth="10" strokeDasharray="9 8" />
    {plan.lineup.map((ticket, i) => {
      if (!ticket) return null;
      const rank = plan.winners.findIndex(w => w.number === ticket.number);
      const progress = out((t - .10) / (rank < 0 ? 1.2 + i * .04 : .60 + rank * .065));
      const x = 125 + progress * (rank < 0 ? 559 : 600 + i * 5);
      const y = 89 + i * 24;
      return <g key={ticket.number} transform={`translate(${x} ${y + Math.sin(t * 95 + i) * 2})`}>
        <ellipse rx="13" ry="8" fill={['#b98e60', '#f6c53d', '#f4f1e8', '#79c179'][i % 4]} />
        <circle cx="9" cy="-5" r="6" fill="#e9ceaa" /><circle cx="11" cy="-6" r="1.4" fill="#201817" />
        <text x="-17" y="4" textAnchor="end" fill="white" fontSize="11" fontWeight="800">#{ticket.number} {ticket.name.slice(0, 8)}</text>
      </g>;
    })}
  </svg>;
}

export function AnimalRunDraw({ plan, t }: { plan: RevealPlan; t: number }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [mode, setMode] = useState<'loading' | '3d' | 'fallback'>('loading');
  const [countdown, setCountdown] = useState('READY');
  const [event, setEvent] = useState('');
  const [placed, setPlaced] = useState(0);
  const [podium, setPodium] = useState(false);

  useEffect(() => {
    let alive = true;
    let dispose: (() => void) | undefined;
    let eventTimer = 0;
    void import('./animal-run-engine').then(({ createAnimalRun }) => {
      if (!alive || !canvas.current) return;
      const run = createAnimalRun(canvas.current, plan.lineup.flatMap(entry => entry ? [entry] : []), plan.winners.map(w => w.number), {
        onCountdown: setCountdown,
        onPlace: setPlaced,
        onEvent: (label) => {
          setEvent(label);
          window.clearTimeout(eventTimer);
          eventTimer = window.setTimeout(() => setEvent(''), 1050);
        },
        onFinish: () => { setEvent(''); setPodium(true); },
      });
      dispose = run.dispose;
      setMode('3d');
    }).catch(() => { if (alive) setMode('fallback'); });
    return () => { alive = false; window.clearTimeout(eventTimer); dispose?.(); };
  }, [plan]);

  const shown = mode === 'fallback' ? plan.winners.filter((_, i) => t >= .70 + i * .065).length : placed;
  const cue = mode === 'fallback' ? t < .1 ? 'READY' : t < .16 ? 'GO!' : '' : countdown;
  return <div className="rdv-animal">
    <canvas ref={canvas} className="rdv-animal-canvas" style={{ visibility: mode === '3d' ? 'visible' : 'hidden' }} />
    {mode === 'fallback' && <RaceFallback plan={plan} t={t} />}
    <div className="rdv-animal-overlay">
      <div className="rdv-animal-hud"><strong>동물런</strong><span>{plan.entrantCount}명 응모 · {shown}/{plan.winners.length}명 도착</span></div>
      {(cue || event || podium) && <div className={`rdv-animal-cue ${event && !cue ? 'rdv-animal-event' : ''}`} key={cue || event || 'podium'}>{cue || event || 'FINISH!'}</div>}
      {shown > 0 && <ol className="rdv-animal-standing">
        {plan.winners.slice(0, shown).map((w, i) => <li key={w.number}><b>{i + 1}위</b><span>#{w.number} {w.name}</span></li>)}
      </ol>}
    </div>
  </div>;
}

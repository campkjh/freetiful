import { clamp01 } from './draw-reveal';

export const SERUM_DROPS = [.35, .62, .89];
export const SERUM_ENTRY = .115;
export const SERUM_CLEAR = .955;
const SHOTS = [.97, .70, .43, .16];
const CYCLE_SECONDS = 2.13;
const TRAVEL_SECONDS = .25;

export function serumHeroMotion(seconds: number, player: number, combat: boolean, running: boolean) {
  if (running) return { row: player * 2, frame: Math.floor(seconds * 13 + player * 2) % 6, state: 'run', pulse: -1, contact: -1 };
  const beat = (seconds + player * .23) % CYCLE_SECONDS;
  const shot = SHOTS.find(at => beat >= at);
  const sinceShot = shot == null ? -1 : beat - shot;
  const pulse = combat && sinceShot >= 0 && sinceShot < TRAVEL_SECONDS ? sinceShot / TRAVEL_SECONDS : -1;
  const landing = SHOTS.find(at => beat >= at + TRAVEL_SECONDS);
  const impact = landing == null ? -1 : beat - landing - TRAVEL_SECONDS;
  const contact = combat && impact >= 0 && impact < .11 ? impact / .11 : -1;
  const reloading = combat && beat >= 1.24 && beat < 2.03;
  const firing = combat && sinceShot >= 0 && sinceShot < .13;
  return {
    row: player * 2 + 1,
    frame: reloading ? beat < 1.57 ? 3 : 4 : firing ? sinceShot < .07 ? 2 : 1 : 0,
    state: reloading ? 'reload' : firing ? 'fire' : 'aim',
    pulse, contact,
  };
}

export function serumBossMotion(t: number) {
  const phase = t < SERUM_DROPS[0] ? 0 : t < SERUM_DROPS[1] ? 1 : 2;
  const start = phase === 0 ? SERUM_ENTRY : SERUM_DROPS[phase - 1];
  const part = clamp01((t - start) / (SERUM_DROPS[phase] - start));
  const morph = phase > 0 && t < SERUM_DROPS[2] ? clamp01(part / .23) : 1;
  const defeated = t >= SERUM_DROPS[2];
  const death = defeated ? clamp01((t - SERUM_DROPS[2]) / .082) : 0;
  const forming = morph < 1;
  const counter = !defeated && part >= .59 && part < .72 ? (part - .59) / .13 : -1;
  return { phase, part, morph, forming, defeated, death, counter };
}

import { clamp01, lerp, smooth } from './draw-reveal';

type Position = { x: number; y: number };
type Body = Position & { vx: number; vy: number };
export const CHAMBER_RADIUS = 85;
export const DRAW_BALL_RADIUS = 13;
const HISTORY_FRAMES = 256;

function keepInside(body: Body) {
  const distance = Math.hypot(body.x, body.y);
  const max = CHAMBER_RADIUS - DRAW_BALL_RADIUS;
  if (distance <= max) return;
  const nx = body.x / distance, ny = body.y / distance;
  const normalVelocity = body.vx * nx + body.vy * ny;
  body.x = nx * max;
  body.y = ny * max;
  if (normalVelocity > 0) {
    body.vx -= nx * normalVelocity * 1.87;
    body.vy -= ny * normalVelocity * 1.87;
  }
}

// Precompute a short, deterministic motion clip. It does not select a winning ticket.
export function lotteryFrames(count: number, seed: number): Position[][] {
  const bodies: Body[] = Array.from({ length: count }, (_, i) => {
    const angle = (i * 2.4 + (seed % 341) * .019);
    const r = 22 + (i % 4) * 13;
    return { x: Math.cos(angle) * r, y: Math.sin(angle) * r, vx: Math.sin(angle + 2) * 210, vy: Math.cos(angle - 1) * 198 };
  });
  const dt = 1 / 60;
  return Array.from({ length: HISTORY_FRAMES }, (_, f) => {
    const power = f > 210 ? .65 : 1;
    bodies.forEach((body, i) => {
      body.vx = (body.vx + dt * (-body.y * 10 * power + Math.sin(f * .21 + i) * 265)) * .992;
      body.vy = (body.vy + dt * (405 + body.x * 8 * power - (body.y > 21 ? 1250 * power : 0))) * .992;
      body.x += body.vx * dt;
      body.y += body.vy * dt;
      keepInside(body);
    });
    for (let i = 0; i < bodies.length; i++) for (let j = i + 1; j < bodies.length; j++) {
      const a = bodies[i], b = bodies[j];
      const dx = b.x - a.x, dy = b.y - a.y;
      const dist = Math.hypot(dx, dy);
      if (dist >= 2 * DRAW_BALL_RADIUS || dist < .001) continue;
      const nx = dx / dist, ny = dy / dist;
      const separation = DRAW_BALL_RADIUS - dist / 2;
      a.x -= nx * separation; a.y -= ny * separation;
      b.x += nx * separation; b.y += ny * separation;
      const velocity = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
      if (velocity > 0) {
        a.vx -= nx * velocity * .93; a.vy -= ny * velocity * .93;
        b.vx += nx * velocity * .93; b.vy += ny * velocity * .93;
      }
    }
    return bodies.map(body => { keepInside(body); return { x: body.x, y: body.y }; });
  });
}

export function lotteryPoint(frames: Position[][], slot: number, progress: number): Position {
  const frame = clamp01(progress) * (frames.length - 1);
  const i = Math.floor(frame);
  const a = frames[i][slot], b = frames[Math.min(i + 1, frames.length - 1)][slot];
  return { x: lerp(a.x, b.x, frame - i), y: lerp(a.y, b.y, frame - i) };
}

export function lotteryTube(start: Position, progress: number): Position {
  const stops = [start, { x: 447, y: 152 }, { x: 509, y: 163 }, { x: 534, y: 183 }, { x: 537, y: 279 }];
  const time = clamp01(progress) * 4;
  const segment = Math.min(3, Math.floor(time));
  const phase = segment === 0 ? smooth(time - segment) : time - segment;
  return { x: lerp(stops[segment].x, stops[segment + 1].x, phase), y: lerp(stops[segment].y, stops[segment + 1].y, phase) };
}

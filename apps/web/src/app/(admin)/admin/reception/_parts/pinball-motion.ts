import { clamp01, lerp, smooth, type RevealPlan } from './draw-reveal';

export const GOAL_Y = 453;
export const PIN_ROWS = 8;
export const pinballFinishAt = (rank: number) => .61 + rank * .087;
export const pegX = (row: number, i: number) => 164 + i * 54 + (row % 2) * 27;
export const pegY = (row: number) => 122 + row * 38;

export function pinballTracks(plan: RevealPlan) {
  const ranks = new Map(plan.winners.map((ticket, i) => [ticket.number, i]));
  return plan.lineup.flatMap((ticket, i) => {
    if (!ticket) return [];
    let state = (Math.imul(ticket.number + 1, 2246822519) ^ plan.seed) >>> 0;
    const random = () => ((state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 2 ** 32);
    const delay = Math.floor(i / 18) * .017 + random() * .013;
    const xs = [153 + (i % 18) * 32.6 + random() * 6];
    for (let row = 0; row < PIN_ROWS; row++) {
      const incoming = xs[xs.length - 1];
      const nearest = Math.max(0, Math.min(10, Math.round((incoming - pegX(row, 0)) / 54)));
      const hit = pegX(row, nearest);
      const distance = incoming - hit;
      const direction = (distance || random() - .5) > 0 ? 1 : -1;
      xs.push(Math.max(143, Math.min(722, Math.abs(distance) < 24 ? hit + direction * (16 + random() * 18) : incoming + (random() - .5) * 44)));
    }
    const rank = ranks.get(ticket.number);
    const endX = rank === undefined ? xs[xs.length - 1] * .49 + 224 : 407 + rank * 16;
    xs.push(endX);
    return [{ ticket, rank, delay, xs, duration: rank === undefined ? .64 + random() * .24 : pinballFinishAt(rank) }];
  });
}

export function pinballPoint(track: ReturnType<typeof pinballTracks>[number], t: number) {
  const { rank, delay, duration, xs } = track;
  if (t <= delay) return { x: xs[0], y: 69 - delay * 88, finished: false };
  if (rank !== undefined && t >= duration) {
    const drop = clamp01((t - duration) / .08);
    return { x: xs[xs.length - 1], y: GOAL_Y + 37 * drop ** 2, finished: true };
  }
  const progress = clamp01((t - delay) / (duration - delay));
  const segment = Math.min(xs.length - 2, Math.floor(progress * (xs.length - 1)));
  const local = progress * (xs.length - 1) - segment;
  const y0 = segment === 0 ? 76 : pegY(segment - 1);
  const y1 = segment === xs.length - 2 ? rank === undefined ? GOAL_Y - 23 : GOAL_Y : pegY(segment);
  const bounce = local < .5 ? Math.sin(local * 2 * Math.PI) * (segment ? 7 : 0) : 0;
  return { x: lerp(xs[segment], xs[segment + 1], smooth(local)), y: lerp(y0, y1, local) - bounce, finished: false };
}

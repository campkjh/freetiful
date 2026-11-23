export type RevealKind = 'capsule' | 'wheel' | 'cards' | 'race' | 'pinball' | 'fight' | 'vault';
export type RevealTicket = { number: number; name: string };

const themes: Record<RevealKind, { label: string; duration: number; slots: number }> = {
  capsule: { label: '캡슐 드롭', duration: 5000, slots: 7 },
  wheel: { label: '골든 룰렛', duration: 5700, slots: 8 },
  cards: { label: '카드 팩 오픈', duration: 5400, slots: 5 },
  race: { label: '동물 레이스', duration: 6500, slots: 5 },
  pinball: { label: '핀볼 드롭', duration: 5500, slots: 5 },
  fight: { label: '픽셀 파이널', duration: 9800, slots: 15 },
  vault: { label: '골드 금고', duration: 5500, slots: 5 },
};

const prizeThemes: [string, RevealKind][] = [
  ['디퓨', 'capsule'], ['세럼', 'wheel'], ['스튜디오패스', 'cards'],
  ['한우', 'race'], ['선글라스', 'pinball'], ['슈트패브릭', 'fight'], ['체스타필드', 'vault'],
];

export function revealTheme(prize: string) {
  const kind = prizeThemes.find(([keyword]) => prize.includes(keyword))?.[1] ?? 'wheel';
  return { kind, ...themes[kind] };
}

export type RevealPlan = ReturnType<typeof revealTheme> & {
  lineup: (RevealTicket | null)[];
  winnerIndex: number;
  seed: number;
};

export function buildReveal(prize: string, id: string, winner: RevealTicket, pool: readonly RevealTicket[]): RevealPlan {
  const theme = revealTheme(prize);
  const seed = [...id].reduce((value, char) => Math.imul(value ^ char.charCodeAt(0), 16777619), 2166136261) >>> 0;
  let state = seed;
  const next = (limit: number) => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state % limit;
  };
  // Only the stage lineup is shuffled. The server has already selected and stored the winner.
  const alternates = [...new Map(pool.filter((entry) => entry.number !== winner.number).map((entry) => [entry.number, entry])).values()];
  for (let i = alternates.length - 1; i > 0; i--) {
    const j = next(i + 1);
    [alternates[i], alternates[j]] = [alternates[j], alternates[i]];
  }
  const size = theme.kind === 'race' || theme.kind === 'fight' ? Math.min(theme.slots, alternates.length + 1) : theme.slots;
  const winnerIndex = next(size);
  const lineup = Array.from({ length: size }, (_, i) => i === winnerIndex ? winner : alternates.pop() ?? null);
  return { ...theme, lineup, winnerIndex, seed };
}

export const clamp01 = (t: number) => Math.max(0, Math.min(1, t));
export const smooth = (t: number) => { const x = clamp01(t); return x * x * (3 - 2 * x); };
export const out = (t: number) => 1 - (1 - clamp01(t)) ** 3;
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export function racePosition(progress: number, lane: number, winnerIndex: number, seed: number) {
  const t = clamp01(progress / 0.88);
  const offset = (seed % 97) / 31 + lane * 1.74;
  const surge = Math.sin(t * 7.6 + offset) * Math.sin(Math.PI * t) * 0.20;
  const endpoint = lane === winnerIndex ? 1 : 0.9 - (lane % 4) * 0.042;
  return clamp01(Math.min(lane === winnerIndex ? 1 : 0.94, t * endpoint + surge));
}

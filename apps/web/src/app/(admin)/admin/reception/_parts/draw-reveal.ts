export type RevealKind = 'capsule' | 'wheel' | 'cards' | 'race' | 'pinball' | 'fight' | 'vault' | 'boss';
export type RevealTicket = { number: number; name: string };

const themes: Record<RevealKind, { label: string; duration: number; slots: number }> = {
  capsule: { label: '복권 공 추첨', duration: 7600, slots: 12 },
  wheel: { label: '골든 룰렛', duration: 5700, slots: 8 },
  cards: { label: '스튜디오패스 카드 오픈', duration: 12400, slots: 5 },
  race: { label: '동물런', duration: 21500, slots: 9 },
  pinball: { label: '핀볼 레이스', duration: 14200, slots: 0 },
  // 261123 사장 '보스전도 2.0배로' — 같은 연출을 2배 빠르게(23.4초 → 11.7초). BossDraw 는 원래 속도 시계(BOSS_TIMELINE_MS)로 그린다
  boss: { label: '세럼 보스전', duration: 11700, slots: 3 },
  fight: { label: 'Freetiful Fight', duration: 12000, slots: 15 },
  vault: { label: '공 배틀', duration: 15500, slots: 5 },
};

const prizeThemes: [string, RevealKind][] = [
  ['디퓨', 'capsule'], ['세럼', 'boss'], ['스튜디오패스', 'cards'],
  ['한우', 'pinball'], ['선글라스', 'race'], ['슈트패브릭', 'fight'], ['체스타필드', 'vault'],
];

export function revealTheme(prize: string) {
  const kind = prizeThemes.find(([keyword]) => prize.includes(keyword))?.[1] ?? 'wheel';
  return { kind, ...themes[kind] };
}

export type RevealPlan = ReturnType<typeof revealTheme> & {
  lineup: (RevealTicket | null)[];
  winners: readonly RevealTicket[];
  entrantCount: number;
  winnerIndex: number;
  seed: number;
};

export const isBatchReveal = (kind: RevealKind) => kind === 'capsule' || kind === 'boss' || kind === 'race' || kind === 'pinball';

export function buildReveal(prize: string, id: string, winner: RevealTicket, pool: readonly RevealTicket[], winners: readonly RevealTicket[] = [winner]): RevealPlan {
  const theme = revealTheme(prize);
  const seed = [...id].reduce((value, char) => Math.imul(value ^ char.charCodeAt(0), 16777619), 2166136261) >>> 0;
  let state = seed;
  const next = (limit: number) => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state % limit;
  };
  // Only the stage lineup is shuffled. The server has already selected and stored the winner.
  const winnerNumbers = new Set(winners.map((entry) => entry.number));
  const alternates = [...new Map(pool.filter((entry) => !winnerNumbers.has(entry.number)).map((entry) => [entry.number, entry])).values()];
  for (let i = alternates.length - 1; i > 0; i--) {
    const j = next(i + 1);
    [alternates[i], alternates[j]] = [alternates[j], alternates[i]];
  }
  const entrantCount = alternates.length + winners.length;
  const size = theme.kind === 'fight' || theme.kind === 'pinball' ? entrantCount : theme.kind === 'race' ? Math.min(theme.slots, entrantCount) : theme.slots;
  const lineup = Array.from({ length: size }, (_, i) => i < winners.length ? winners[i] : alternates.pop() ?? null);
  for (let i = size - 1; i > 0; i--) {
    const j = next(i + 1);
    [lineup[i], lineup[j]] = [lineup[j], lineup[i]];
  }
  const winnerIndex = lineup.findIndex((entry) => entry?.number === winner.number);
  const duration = theme.kind === 'capsule' ? theme.duration * winners.length : theme.duration;
  return { ...theme, duration, lineup, winnerIndex, seed, winners, entrantCount };
}

export const clamp01 = (t: number) => Math.max(0, Math.min(1, t));
export const smooth = (t: number) => { const x = clamp01(t); return x * x * (3 - 2 * x); };
export const out = (t: number) => 1 - (1 - clamp01(t)) ** 3;
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BATTLE_TUNING, createBattleSim, type BattleEntrant, type BattleEvent, type BattleSim } from './flag-battle-sim';

/** 시드 고정 PRNG(mulberry32) */
function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 번호는 일부러 띄엄띄엄(응모권 번호가 1..N 이 아니어도 된다)
const entrantsOf = (n: number): BattleEntrant[] => Array.from({ length: n }, (_, i) => ({ number: 1000 + i * 7, name: `참가자 ${i + 1}` }));

const TAU = Math.PI * 2;
const inGap = (sim: BattleSim, x: number, y: number, tol: number) => {
  const a = Math.atan2(y, x);
  return sim.ring.gaps.some((g) => {
    const w = g.end - g.start;
    const d = (((a - g.start + tol) % TAU) + TAU) % TAU;
    return d <= w + 2 * tol;
  });
};

type Run = { sim: BattleSim; events: BattleEvent[]; maxRadiusExcess: number };

function run(n: number, seed: number): Run {
  const sim = createBattleSim(entrantsOf(n), seeded(seed));
  const events: BattleEvent[] = [];
  let maxRadiusExcess = -Infinity;
  const check = (ev: BattleEvent[]) => {
    for (const e of ev) {
      events.push(e);
      if (e.type === 'out' && e.reason === 'gap') {
        // 탈출 단계 탈락은 언제나 구멍을 통해서만(바깥 각도가 구멍 안)
        assert.ok(inGap(sim, e.x, e.y, 0.05), `N=${n} seed=${seed}: #${e.number} left outside a gap`);
      }
    }
    for (const b of sim.balls) {
      assert.ok(Number.isFinite(b.x) && Number.isFinite(b.y) && Number.isFinite(b.vx) && Number.isFinite(b.vy), `N=${n} seed=${seed}: NaN on #${b.number}`);
      if (!b.out) maxRadiusExcess = Math.max(maxRadiusExcess, Math.hypot(b.x, b.y) - sim.ring.radius);
    }
  };
  check(sim.step(1 / 120));
  while (sim.phase !== 'done' && sim.time < 160) check(sim.step(1 / 120));
  check(sim.step(1 / 120));
  return { sim, events, maxRadiusExcess };
}

const SIZES = [1, 2, 3, 4, 12, 50, 137, 200];
const SEEDS = [1, 7, 42, 99, 2026, 31337];

for (const n of SIZES) {
  test(`N=${n}: always ends with exactly one survivor, every ticket accounted for, within 150 s`, () => {
    for (const seed of SEEDS) {
      const { sim, events, maxRadiusExcess } = run(n, seed);
      const tag = `N=${n} seed=${seed}`;
      assert.equal(sim.phase, 'done', tag);
      assert.ok(sim.time <= 150, `${tag}: took ${sim.time.toFixed(1)} s`);
      assert.equal(sim.alive, 1, tag);
      const alive = sim.balls.filter((b) => !b.out);
      assert.equal(alive.length, 1, tag);
      assert.equal(alive[0].number, sim.winner, tag);
      assert.equal(alive[0].place, 1, tag);

      const outs = events.filter((e): e is Extract<BattleEvent, { type: 'out' }> => e.type === 'out');
      assert.equal(outs.length, n - 1, tag);
      const wins = events.filter((e) => e.type === 'win');
      assert.deepEqual(wins, [{ type: 'win', number: sim.winner }], tag);
      // 모든 번호가 정확히 한 번(탈락 n-1 + 우승 1)
      const numbers = [...outs.map((e) => e.number), sim.winner];
      assert.equal(new Set(numbers).size, n, tag);
      assert.deepEqual([...numbers].sort((a, b) => (a ?? 0) - (b ?? 0)), entrantsOf(n).map((e) => e.number), tag);
      // 남은 인원이 1씩 줄고 순위가 1..n 순열
      outs.forEach((e, i) => assert.equal(e.remaining, n - 1 - i, tag));
      assert.deepEqual(sim.balls.map((b) => b.place).sort((a, b) => a - b), Array.from({ length: n }, (_, i) => i + 1), tag);

      const showdowns = events.filter((e): e is Extract<BattleEvent, { type: 'showdown' }> => e.type === 'showdown');
      if (n >= 2) {
        assert.equal(showdowns.length, 1, `${tag}: showdown once`);
        // 보통 3명 — 같은 순간 둘이 구멍으로 빠지면(드묾) 2명 결승
        if (n <= 3) assert.equal(showdowns[0].survivors.length, n, tag);
        else assert.ok(showdowns[0].survivors.length === 2 || showdowns[0].survivors.length === 3, tag);
        assert.ok(sim.showdownAt !== null, tag);
        // 탈출 단계 탈락 = 구멍, 결승 탈락 = 실 끊김(안전장치는 이 시드들에서 안 쓰인다)
        const showIndex = events.indexOf(showdowns[0]);
        events.forEach((e, i) => {
          if (e.type !== 'out') return;
          assert.equal(e.reason, i < showIndex ? 'gap' : 'cut', `${tag}: #${e.number} ${e.reason}`);
        });
        assert.equal(sim.safety, false, `${tag}: safety fired`);
      } else {
        assert.equal(showdowns.length, 0, tag);
      }
      // 살아 있는 공은 링 밖으로 못 나간다(구멍 안에서도 중심이 링 선을 넘으면 그때 탈락)
      assert.ok(maxRadiusExcess <= 1e-9, `${tag}: alive ball outside ring by ${maxRadiusExcess}`);
    }
  });
}

test('same seed → same match; empty and duplicate entrant lists are handled', () => {
  const a = run(40, 5);
  const b = run(40, 5);
  assert.equal(a.sim.winner, b.sim.winner);
  assert.deepEqual(a.events, b.events);

  const empty = createBattleSim([], seeded(1));
  assert.equal(empty.phase, 'done');
  assert.equal(empty.winner, null);
  assert.deepEqual(empty.step(1 / 120), []);

  const dup = createBattleSim([{ number: 5, name: 'a' }, { number: 5, name: 'b' }, { number: 6, name: 'c' }], seeded(2));
  assert.equal(dup.total, 2);
  assert.deepEqual(dup.balls.map((ball) => ball.number).sort(), [5, 6]);
});

test('balls start identical: same radius, same speed, no overlaps, inside the ring', () => {
  for (const n of [12, 137, 200]) {
    const sim = createBattleSim(entrantsOf(n), seeded(n));
    const r = sim.ballRadius;
    const speeds = sim.balls.map((b) => Math.hypot(b.vx, b.vy));
    assert.ok(sim.balls.every((b) => b.r === r));
    assert.ok(Math.max(...speeds) - Math.min(...speeds) < 1e-12);
    for (let i = 0; i < n; i++) {
      const p = sim.balls[i];
      assert.ok(Math.hypot(p.x, p.y) <= 1 - r);
      for (let j = i + 1; j < n; j++) assert.ok(Math.hypot(p.x - sim.balls[j].x, p.y - sim.balls[j].y) >= 2 * r);
    }
    // 큰 판도 링 면적의 1/4 이하로 시작
    assert.ok(n * r * r <= 0.25 + 1e-9);
  }
});

test('larger frame steps (1/60) still finish cleanly', () => {
  for (const n of [5, 60]) {
    const sim = createBattleSim(entrantsOf(n), seeded(11 + n));
    let outs = 0;
    while (sim.phase !== 'done' && sim.time < 160) for (const e of sim.step(1 / 60)) if (e.type === 'out') outs++;
    assert.equal(sim.phase, 'done');
    assert.equal(outs, n - 1);
  }
});

test('fairness smoke test: 3-way string-cut final, 150 runs, each wins at least 15%', () => {
  const wins = new Map<number, number>();
  for (let seed = 1; seed <= 150; seed++) {
    const sim = createBattleSim(entrantsOf(3), seeded(seed * 2654435761));
    while (sim.phase !== 'done' && sim.time < 160) sim.step(1 / 120);
    assert.equal(sim.phase, 'done');
    wins.set(sim.winner as number, (wins.get(sim.winner as number) ?? 0) + 1);
  }
  for (const e of entrantsOf(3)) assert.ok((wins.get(e.number) ?? 0) >= 150 * 0.15, `#${e.number} won ${wins.get(e.number) ?? 0}/150`);
});

test('fairness smoke test: 12 entrants, 240 runs, nobody dominates', () => {
  const wins = new Map<number, number>();
  for (let seed = 1; seed <= 240; seed++) {
    const sim = createBattleSim(entrantsOf(12), seeded(seed * 97 + 3));
    while (sim.phase !== 'done' && sim.time < 160) sim.step(1 / 120);
    wins.set(sim.winner as number, (wins.get(sim.winner as number) ?? 0) + 1);
  }
  // 기대 20회 — 한 사람이 2.5배(50회) 넘게 이기거나 한 번도 못 이기면 치우친 것
  for (const e of entrantsOf(12)) {
    const w = wins.get(e.number) ?? 0;
    assert.ok(w >= 4 && w <= 50, `#${e.number} won ${w}/240`);
  }
});

test('escape -> showdown switch: a ball half-way through a gap is eased in, not teleported', () => {
  // 예전엔 결승 전환 순간 구멍에 걸친 공이 한 스텝에 공 반지름의 0.4~0.84배씩 순간이동하던 시드들
  for (const [n, seed] of [[5, 50434319294], [7, 69015385459], [250, 29200773361]]) {
    const sim = createBattleSim(entrantsOf(n), seeded(seed));
    let showdownAt: number | null = null;
    let worst = 0;
    let beyondWall = 0;
    while (sim.phase !== 'done' && sim.time < 160) {
      const before = sim.balls.map((b) => [b.x, b.y]);
      const ev = sim.step(1 / 240);
      if (ev.some((e) => e.type === 'showdown')) showdownAt = sim.time;
      if (showdownAt === null) continue;
      if (sim.time - showdownAt > 1) break;
      sim.balls.forEach((b, i) => {
        if (b.out) return;
        worst = Math.max(worst, Math.hypot(b.x - before[i][0], b.y - before[i][1]) / sim.ballRadius);
        if (Math.hypot(b.x, b.y) > sim.ring.radius - sim.ballRadius + 1e-9) beyondWall++;
      });
    }
    assert.ok(showdownAt !== null, `N=${n} seed=${seed}: no showdown`);
    assert.ok(beyondWall > 0, `N=${n} seed=${seed}: expected a ball still easing in after the switch`);
    assert.ok(worst < 0.25, `N=${n} seed=${seed}: alive ball jumped ${worst.toFixed(2)} r in one 1/240 s step`);
  }
});

test('a ball whose centre crossed the ring line inside an open gap is always out (never pulled back in)', () => {
  type WallsHook = { walls(ev: BattleEvent[], h: number): void };
  // 예전엔 같은 substep 에 앞 공이 결승을 열면 이미 링 선을 넘은 공이 결승 진출자로 끌려 들어오던 시드
  const sim = createBattleSim(entrantsOf(64), seeded(2789028734));
  const hook = sim as unknown as WallsHook;
  const walls = hook.walls;
  let crossings = 0;
  hook.walls = function (this: BattleSim, ev: BattleEvent[], h: number) {
    const R = this.ring.radius;
    const r = this.ballRadius;
    const crossed = this.phase === 'escape' && this.ring.open
      ? this.balls.filter((b) => {
        if (b.out || Math.hypot(b.x, b.y) <= R || !inGap(this, b.x, b.y, 0)) return false;
        // 구멍 끝 모서리에 닿아 튕겨 들어오는 경우는 뺀다
        return this.ring.gaps.every((g) => [g.start, g.end].every((a) => Math.hypot(b.x - Math.cos(a) * R, b.y - Math.sin(a) * R) >= r));
      })
      : [];
    walls.call(this, ev, h);
    if (this.phase === 'done') return;
    for (const b of crossed) {
      crossings++;
      assert.ok(b.out, `#${b.number} crossed the ring line at t=${this.time.toFixed(4)} but is still alive (phase ${this.phase})`);
    }
  };
  while (sim.phase !== 'done' && sim.time < 160) sim.step(1 / 120);
  assert.equal(sim.phase, 'done');
  assert.ok(crossings > 0, 'expected at least one gap crossing to check');
});

test('showdown fans: each finalist mostly gets the third of the ring it is on', () => {
  let total = 0;
  let farAway = 0;
  for (let seed = 1; seed <= 120; seed++) {
    const sim = createBattleSim(entrantsOf(12), seeded(seed * 7919 + 12));
    let survivors: number[] | null = null;
    while (!survivors && sim.phase !== 'done' && sim.time < 160) {
      for (const e of sim.step(1 / 120)) if (e.type === 'showdown') survivors = e.survivors;
    }
    assert.ok(survivors, `seed=${seed}: no showdown`);
    const sector = TAU / survivors.length;
    for (const num of survivors) {
      const b = sim.balls.find((ball) => ball.number === num);
      assert.ok(b && !b.out);
      const mid = b.sector + sector / 2;
      let d = Math.abs((((Math.atan2(b.y, b.x) - mid) % TAU) + TAU) % TAU);
      if (d > Math.PI) d = TAU - d;
      total++;
      // 부채꼴 가운데가 공 반대편(120도 넘게)이면 시작 실이 경기장을 가로지른다
      if (d > TAU / 3) farAway++;
    }
  }
  assert.ok(farAway / total < 0.03, `${farAway}/${total} finalists started with a fan on the far side`);
});

test('safety net: even if gaps never let anyone out and strings never get cut, the match ends by 150 s', () => {
  const tuning = BATTLE_TUNING as unknown as Record<string, number>;
  const saved = { ...tuning };
  try {
    // 구멍 = 공 지름 딱 그만큼(사실상 못 나감) · 안 넓어짐 · 결승 실은 손으로 안 끊김
    Object.assign(tuning, { gapOpenTotal: 0, widenRate: 0, escapeSafetyWidenRate: 0, showdownGrace: 1e9 });
    for (const n of [3, 12, 137, 200]) {
      const sim = createBattleSim(entrantsOf(n), seeded(n * 3 + 1));
      const reasons: string[] = [];
      while (sim.phase !== 'done' && sim.time < 200) for (const e of sim.step(1 / 120)) if (e.type === 'out') reasons.push(e.reason);
      assert.equal(sim.phase, 'done', `N=${n}`);
      assert.ok(sim.time <= 150, `N=${n}: ${sim.time.toFixed(1)} s`);
      assert.equal(reasons.length, n - 1, `N=${n}`);
      assert.equal(sim.balls.filter((b) => !b.out).length, 1, `N=${n}`);
      assert.ok(sim.safety, `N=${n}: safety should have fired`);
    }
  } finally {
    Object.assign(tuning, saved);
  }
});

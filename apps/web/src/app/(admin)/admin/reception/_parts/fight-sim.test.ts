import assert from 'node:assert/strict';
import test from 'node:test';
import { FIGHT_HZ, FIGHT_STRIDE, POSE, fightDurationMs, fightSimTime, fightTimeline, simulateFight } from './fight-sim';

const SIZES = [1, 2, 3, 5, 9, 24, 60, 137, 180];

test('every fight ends with exactly one fighter standing — the slot the sim calls the winner', () => {
  for (const n of SIZES) {
    for (const seed of [1, 7, 42, 2026, 99991]) {
      const sim = simulateFight(n, seed);
      const last = sim.ticks - 1;
      const standing: number[] = [];
      for (let i = 0; i < n; i++) {
        const pose = sim.frames[(last * n + i) * FIGHT_STRIDE + 4];
        if (pose !== POSE.ko) standing.push(i);
      }
      assert.deepEqual(standing, [sim.winner], `n=${n} seed=${seed}`);
      assert.equal(sim.alive[last], 1, `n=${n} seed=${seed}`);
      assert.equal(sim.koOrder.length, n - 1);
      assert.equal(new Set(sim.koOrder).size, n - 1);
      assert.ok(!sim.koOrder.includes(sim.winner));
    }
  }
});

test('the final blow lands exactly on the K.O. beat and the melee reaches two near the planned time', () => {
  for (const n of SIZES.filter((n) => n >= 2)) {
    for (const seed of [3, 11, 512, 4096]) {
      const sim = simulateFight(n, seed);
      const kos = sim.events.filter((e) => e.type === 'ko');
      const final = kos[kos.length - 1];
      assert.ok(Math.abs(final.s - sim.tl.ko) <= 1.5 / FIGHT_HZ, `n=${n} seed=${seed} final ${final.s} vs ${sim.tl.ko}`);
      assert.ok(sim.finalists && sim.finalists.includes(sim.winner));
      if (n > 2) {
        // 두 명 남는 때 — 목표 ±(앞 4초 · 뒤 1.3초) 안
        assert.ok(sim.duelStart >= sim.tl.duelAt - 4 && sim.duelStart <= sim.tl.duelAt + 1.3, `n=${n} seed=${seed} duel ${sim.duelStart.toFixed(2)} vs ${sim.tl.duelAt.toFixed(2)}`);
      }
    }
  }
});

test('frames and camera stay finite and inside the arena', () => {
  const sim = simulateFight(137, 20261123);
  for (let k = 0; k < sim.frames.length; k++) assert.ok(Number.isFinite(sim.frames[k]));
  for (let k = 0; k < sim.cam.length; k++) assert.ok(Number.isFinite(sim.cam[k]) && sim.cam[k] > -400);
});

test('the same seed replays the same fight', () => {
  const a = simulateFight(80, 555);
  const b = simulateFight(80, 555);
  assert.equal(a.winner, b.winner);
  assert.deepEqual(a.koOrder, b.koOrder);
});

test('a big room simulates quickly enough to start without a visible pause', () => {
  const t0 = performance.now();
  simulateFight(180, 77);
  assert.ok(performance.now() - t0 < 600);
});

test('slow motion keeps the clock continuous and the length matches the timeline', () => {
  for (const n of [1, 2, 137]) {
    const tl = fightTimeline(n);
    const total = fightDurationMs(n) / 1000;
    assert.ok(Math.abs(fightSimTime(total, tl) - tl.end) < 1e-6);
    let prev = 0;
    for (let r = 0; r <= total; r += 0.01) {
      const s = fightSimTime(r, tl);
      assert.ok(s >= prev - 1e-9 && s - prev < 0.0101);
      prev = s;
    }
  }
});

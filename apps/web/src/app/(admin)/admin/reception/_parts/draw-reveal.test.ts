import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildReveal, racePosition, revealTheme } from './draw-reveal';

const prizes = ['메리고어라운드 디퓨져', '아르비에 스킨케어 세럼 세트(컨디션클래리티 세럼)', '스튜디오패스 촬영+의상세트', '1++ 한우선물세트', '슬릭스틸 선글라스+안경테 세트', '슈트패브릭 영국 허더스필드 정장 세트', '체스타필드 영국 요크셔 정장 세트'];
const winner = { number: 48, name: '테스트 당첨자' };
const pool = Array.from({ length: 20 }, (_, i) => ({ number: i + 1, name: `테스트 ${i + 1}` }));

test('the seven existing prizes each use a distinct reveal', () => {
  assert.deepEqual(prizes.map(prize => revealTheme(prize).kind), ['capsule', 'wheel', 'cards', 'race', 'pinball', 'fight', 'vault']);
  assert.equal(revealTheme('직접 등록한 상품').kind, 'wheel');
});

test('every scene uses the exact server winner once and only real tickets in other slots', () => {
  for (const prize of prizes) {
    const plan = buildReveal(prize, 'draw-501', winner, [...pool, pool[0], { number: 48, name: 'old name' }]);
    assert.deepEqual(plan.lineup[plan.winnerIndex], winner);
    const numbers = plan.lineup.flatMap(ticket => ticket ? [ticket.number] : []);
    assert.equal(new Set(numbers).size, numbers.length);
    assert.ok(numbers.every(value => value === winner.number || pool.some(ticket => ticket.number === value)));
  }
});

test('small lineups have no imaginary tickets; cards keep five visual slots', () => {
  for (const prize of prizes) {
    const plan = buildReveal(prize, 'draw-28', winner, []);
    assert.deepEqual(plan.lineup.filter(Boolean), [winner]);
    if (plan.kind === 'cards') assert.equal(plan.lineup.length, 5);
    if (plan.kind === 'fight' || plan.kind === 'race') assert.equal(plan.lineup.length, 1);
  }
});

test('animation is stable during full-screen switches, and only the selected racer finishes first', () => {
  const plan = buildReveal(prizes[3], 'draw-827', winner, pool);
  assert.deepEqual(plan, buildReveal(prizes[3], 'draw-827', winner, pool));
  for (let winnerLane = 0; winnerLane < plan.lineup.length; winnerLane++) {
    for (let lane = 0; lane < plan.lineup.length; lane++) {
      for (let i = 0; i <= 100; i++) {
        const position = racePosition(i / 100, lane, winnerLane, plan.seed);
        assert.ok(position >= 0 && position <= 1);
        if (lane !== winnerLane) assert.ok(position < 1);
      }
      assert.equal(racePosition(1, lane, winnerLane, plan.seed) === 1, lane === winnerLane);
    }
  }
});

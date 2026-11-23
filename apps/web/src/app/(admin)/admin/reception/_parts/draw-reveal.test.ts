import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildReveal, revealTheme } from './draw-reveal';
import { GOAL_Y, pinballFinishAt, pinballPoint, pinballTracks } from './pinball-motion';
import { CHAMBER_RADIUS, DRAW_BALL_RADIUS, lotteryFrames } from './lottery-motion';

const prizes = ['메리고어라운드 디퓨져', '아르비에 스킨케어 세럼 세트(컨디션클래리티 세럼)', '스튜디오패스 촬영+의상세트', '1++ 한우선물세트', '슬릭스틸 선글라스+안경테 세트', '슈트패브릭 영국 허더스필드 정장 세트', '체스타필드 영국 요크셔 정장 세트'];
const winner = { number: 48, name: '테스트 당첨자' };
const pool = Array.from({ length: 20 }, (_, i) => ({ number: i + 1, name: `테스트 ${i + 1}` }));

test('the seven existing prizes each use a distinct reveal', () => {
  assert.deepEqual(prizes.map(prize => revealTheme(prize).kind), ['capsule', 'boss', 'cards', 'pinball', 'race', 'fight', 'vault']);
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

test('156 pinball entries follow stable tracks and only four server winners cross the goal in order', () => {
  const entries = Array.from({ length: 156 }, (_, i) => ({ number: i + 1, name: `테스트 ${i + 1}` }));
  const wins = [entries[106], entries[58], entries[153], entries[3]];
  const plan = buildReveal(prizes[3], 'batch-827', wins[0], entries, wins);
  const tracks = pinballTracks(plan);
  assert.equal(new Set(tracks.map(track => track.ticket.number)).size, 156);
  assert.deepEqual(tracks, pinballTracks(buildReveal(prizes[3], 'batch-827', wins[0], entries, wins)));
  assert.deepEqual(tracks.filter(track => pinballPoint(track, 1).finished).sort((a, b) => a.duration - b.duration).map(track => track.ticket), wins);
  for (const track of tracks) {
    if (track.rank === undefined) assert.ok(pinballPoint(track, 1).y < GOAL_Y);
    else {
      assert.equal(pinballPoint(track, pinballFinishAt(track.rank) - .0001).finished, false);
      assert.equal(pinballPoint(track, pinballFinishAt(track.rank)).y, GOAL_Y);
    }
  }
});

test('animal run stages both server winners and lottery balls stay inside the chamber', () => {
  const wins = [pool[6], pool[11]];
  const plan = buildReveal(prizes[4], 'animal-2', wins[0], pool, wins);
  assert.equal(plan.entrantCount, pool.length);
  assert.equal(plan.lineup.length, 9);
  assert.ok(wins.every(w => plan.lineup.includes(w)));
  assert.deepEqual(plan.winners, wins);
  for (const frame of lotteryFrames(12, plan.seed)) {
    assert.ok(frame.every(ball => Math.hypot(ball.x, ball.y) <= CHAMBER_RADIUS - DRAW_BALL_RADIUS + .001));
  }
});

test('the fighting arena never drops eligible tickets, even with over 130 guests', () => {
  const largePool = Array.from({ length: 156 }, (_, i) => ({ number: i + 1, name: `테스트 ${i + 1}` }));
  const plan = buildReveal(prizes[5], 'draw-156', winner, largePool);
  assert.equal(plan.label, 'Freetiful Fight');
  assert.equal(plan.lineup.length, 156);
  assert.equal(new Set(plan.lineup.map(ticket => ticket?.number)).size, 156);
  assert.equal(plan.lineup[plan.winnerIndex]?.number, winner.number);
});

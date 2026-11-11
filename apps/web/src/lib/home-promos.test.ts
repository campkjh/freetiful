import assert from 'node:assert/strict';
import { test } from 'node:test';
import { homePopupSessionKey, nextHomePromoBoundary, orderHomePromos, RECEPTION_END, RECEPTION_START } from './home-promos';

const promos = [{ id: 'signup-5000' }, { id: 'reception-2026' }];
const ids = (now: number) => orderHomePromos(promos, now).map((p) => p.id);

test('reception is hidden until November 23 starts in Korea', () => {
  assert.deepEqual(ids(Date.parse('2026-11-08T21:00:00+09:00')), ['signup-5000']);
  assert.deepEqual(ids(RECEPTION_START - 1), ['signup-5000']);
});

test('reception is first for exactly November 23 in Korea', () => {
  for (const now of [RECEPTION_START, Date.parse('2026-11-23T12:00:00+09:00'), RECEPTION_END - 1]) {
    assert.deepEqual(ids(now), ['reception-2026', 'signup-5000']);
  }
  assert.equal(new Date(RECEPTION_START).toISOString(), '2026-11-22T15:00:00.000Z');
});

test('reception disappears at November 24 midnight and never returns', () => {
  for (const now of [RECEPTION_END, Date.parse('2026-12-23T12:00:00+09:00'), Date.parse('2027-11-23T12:00:00+09:00')]) {
    assert.deepEqual(ids(now), ['signup-5000']);
  }
  assert.deepEqual(orderHomePromos([{ id: 'reception-2026' }], RECEPTION_END), []);
});

test('campaign order preserves hidden items and never mutates or resurrects them', () => {
  assert.deepEqual(orderHomePromos([{ id: 'signup-5000' }], RECEPTION_START), [{ id: 'signup-5000' }]);
  assert.deepEqual(orderHomePromos([], RECEPTION_START), []);
  assert.deepEqual(promos.map((p) => p.id), ['signup-5000', 'reception-2026']);
});

test('midnight schedule and session dismissal keys follow the same Korea-time boundaries', () => {
  assert.equal(nextHomePromoBoundary(RECEPTION_START - 1), RECEPTION_START);
  assert.equal(nextHomePromoBoundary(RECEPTION_START), RECEPTION_END);
  assert.equal(nextHomePromoBoundary(RECEPTION_END), null);
  assert.notEqual(homePopupSessionKey(RECEPTION_START - 1), homePopupSessionKey(RECEPTION_START));
  assert.notEqual(homePopupSessionKey(RECEPTION_START), homePopupSessionKey(RECEPTION_END));
});

test('home carousel keeps reception after signup before the event and preserves other slides', () => {
  const carousel = [{ id: 'villadegd' }, { id: 'biz' }, { id: 'signup-5000' }, { id: 'reception-2026' }, { id: 'ceramique' }];
  assert.deepEqual(orderHomePromos(carousel, RECEPTION_START - 1).map(p => p.id), ['villadegd', 'biz', 'signup-5000', 'ceramique']);
  assert.deepEqual(orderHomePromos(carousel, RECEPTION_START).map(p => p.id), ['reception-2026', 'villadegd', 'biz', 'signup-5000', 'ceramique']);
  assert.deepEqual(orderHomePromos(carousel, RECEPTION_END).map(p => p.id), ['villadegd', 'biz', 'signup-5000', 'ceramique']);
});

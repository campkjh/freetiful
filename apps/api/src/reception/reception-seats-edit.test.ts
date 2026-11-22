import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Prisma } from '@prisma/client';
import { SEAT_ROWS_MAX } from './reception.rules';
import {
  SAME_NAME_SWAP,
  SEAT_NOT_FOUND,
  applySeatEdit,
  editBlockList,
  followRename,
  mergeRenames,
  mergeSeatMoves,
  newRowKeys,
  parseSeatEdit,
  parseSeatMoves,
  planTicketMoves,
  renameBlocks,
  sameNameArrivedBlock,
  SAME_NAME_ARRIVED,
  resolveSameNameSeat,
  seatMovesOf,
  type EditSeatRow,
  type SeatEditOp,
  type SeatEditPlan,
  type TicketMove,
} from './reception-seats-edit';
import { ReceptionService } from './reception.service';
import { ReceptionLiveService, matchTickets, seatListOf } from './reception-live.service';

/** 시험 명단 — id = 's' + 순번 */
function rows(list: Array<[string, string, number, number | null]>): EditSeatRow[] {
  return list.map(([nameKey, name, tableNo, seatNo], i) => ({ id: `s${i + 1}`, nameKey, name, tableNo, seatNo }));
}
const plan = (r: ReadonlyArray<EditSeatRow>, op: SeatEditOp): SeatEditPlan => {
  const p = applySeatEdit(r, op);
  if (typeof p === 'string') throw new Error(`계획 실패: ${p}`);
  return p;
};
const pick = (p: SeatEditPlan) => p.rows.map((r) => `${r.nameKey}|${r.tableNo}|${r.seatNo ?? '-'}`);
/** 응모권 → 줄(서비스와 같은 규칙: matchTickets) */
const ticketRowOf = (r: ReadonlyArray<EditSeatRow>, tickets: Array<{ id: string; nameKey: string; name: string }>) => {
  const out = new Map<string, string>();
  for (const [id, row] of matchTickets(seatListOf(r.map((x) => ({ nameKey: x.nameKey, name: x.name, tableNo: x.tableNo, seatNo: x.seatNo }))), tickets)) out.set(id, row.nameKey);
  return out;
};

const BASE = rows([
  ['김솔', '김솔', 1, 1],
  ['김현우 @2', '김현우', 2, 3],
  ['김현우 @12', '김현우', 12, 5],
  ['이연주', '이연주', 6, 7],
  ['문혜정', '문혜정', 6, 7],
  ['박하나', '박하나', 6, null],
]);

test('본문 검사 — 다섯 가지 모양 · 틀리면 이유', () => {
  assert.deepEqual(parseSeatEdit({ op: 'move', nameKey: '김솔', table: '3', seat: 2 }), { op: 'move', nameKey: '김솔', table: 3, seat: 2 });
  assert.deepEqual(parseSeatEdit({ op: 'move', nameKey: '김솔', table: 3, seat: null }), { op: 'move', nameKey: '김솔', table: 3, seat: null });
  assert.deepEqual(parseSeatEdit({ op: 'move', nameKey: '김솔', table: 3, seat: '' }), { op: 'move', nameKey: '김솔', table: 3, seat: null });
  assert.deepEqual(parseSeatEdit({ op: 'swap', nameKey: 'a', otherKey: 'b' }), { op: 'swap', nameKey: 'a', otherKey: 'b' });
  assert.deepEqual(parseSeatEdit({ op: 'rename', nameKey: '김솔', name: '  김  솔 ' }), { op: 'rename', nameKey: '김솔', name: '김 솔' });
  assert.deepEqual(parseSeatEdit({ op: 'add', name: '홍길동', table: 18, seat: 8 }), { op: 'add', name: '홍길동', table: 18, seat: 8 });
  assert.deepEqual(parseSeatEdit({ op: 'add', name: '홍길동', table: 1, seat: null, ticketId: 't9' }), { op: 'add', name: '홍길동', table: 1, seat: null, ticketId: 't9' });
  assert.deepEqual(parseSeatEdit({ op: 'remove', nameKey: '김솔' }), { op: 'remove', nameKey: '김솔' });

  assert.match(parseSeatEdit({ op: 'drop' }) as string, /무엇을/);
  assert.match(parseSeatEdit(null) as string, /무엇을/);
  assert.match(parseSeatEdit({ op: 'move', nameKey: '김솔', table: 19, seat: 1 }) as string, /테이블은 1~18/);
  assert.match(parseSeatEdit({ op: 'move', nameKey: '김솔', table: 1, seat: 9 }) as string, /좌석은 1~8/);
  assert.match(parseSeatEdit({ op: 'move', nameKey: '김솔', table: 1, seat: 1.5 }) as string, /좌석은 1~8/);
  assert.equal(parseSeatEdit({ op: 'move', table: 1, seat: 1 }), SEAT_NOT_FOUND);
  assert.match(parseSeatEdit({ op: 'swap', nameKey: 'a', otherKey: 'a' }) as string, /같은 사람끼리/);
  assert.match(parseSeatEdit({ op: 'rename', nameKey: 'a', name: '가'.repeat(21) }) as string, /이름을 확인/);
  assert.match(parseSeatEdit({ op: 'add', name: ' ', table: 1 }) as string, /이름을 확인/);
});

test('옮기기 — 같은 테이블 안 · 좌석 없이 · 같은 좌석에 둘(허용) · 없는 사람 · 그대로면 바뀐 줄 없음', () => {
  const a = plan(BASE, { op: 'move', nameKey: '김솔', table: 1, seat: 4 });
  assert.equal(a.updated.length, 1);
  assert.deepEqual([a.updated[0].before.seatNo, a.updated[0].after.seatNo, a.updated[0].after.id], [1, 4, 's1']);
  assert.equal(a.rekeys.size, 0);
  assert.equal(a.key, '김솔');

  // 이연주 · 문혜정이 이미 6번 테이블 7번 — 박하나도 같은 좌석으로 가도 된다
  const b = plan(BASE, { op: 'move', nameKey: '박하나', table: 6, seat: 7 });
  assert.equal(b.rows.filter((r) => r.tableNo === 6 && r.seatNo === 7).length, 3);

  const c = plan(BASE, { op: 'move', nameKey: '김솔', table: 5, seat: null });
  assert.deepEqual([c.updated[0].after.tableNo, c.updated[0].after.seatNo], [5, null]);

  const same = plan(BASE, { op: 'move', nameKey: '박하나', table: 6, seat: null });
  assert.deepEqual([same.updated.length, same.added.length, same.removed.length], [0, 0, 0]);

  assert.equal(applySeatEdit(BASE, { op: 'move', nameKey: '없는사람', table: 1, seat: 1 }), SEAT_NOT_FOUND);
});

test('동명이인 옮기기 — 다른 테이블이면 열쇠가 그 테이블로 · 짝이 앉은 테이블이면 거절(이유 그대로)', () => {
  const a = plan(BASE, { op: 'move', nameKey: '김현우 @2', table: 5, seat: 1 });
  assert.equal(a.key, '김현우 @5');
  assert.deepEqual([...a.rekeys], [['김현우 @2', '김현우 @5']]);
  assert.deepEqual(a.updated.map((u) => [u.before.nameKey, u.after.nameKey, u.after.id]), [['김현우 @2', '김현우 @5', 's2']]);
  // 짝(12번)은 그대로
  assert.ok(a.rows.some((r) => r.nameKey === '김현우 @12' && r.id === 's3'));

  // 같은 테이블 안 좌석만 바꾸면 열쇠 그대로
  assert.equal(plan(BASE, { op: 'move', nameKey: '김현우 @2', table: 2, seat: 8 }).rekeys.size, 0);

  assert.equal(applySeatEdit(BASE, { op: 'move', nameKey: '김현우 @2', table: 12, seat: 1 }), '같은 테이블에 같은 이름이 두 번 있어요: 김현우');
});

test('맞바꾸기 — 테이블·좌석 서로 · 동명이인끼리는 거절(명단이 그대로) · 짝 테이블로 가면 거절', () => {
  const a = plan(BASE, { op: 'swap', nameKey: '김솔', otherKey: '박하나' });
  assert.deepEqual(
    a.updated.map((u) => [u.after.nameKey, u.after.tableNo, u.after.seatNo]),
    [['김솔', 6, null], ['박하나', 1, 1]],
  );
  assert.equal(a.key, '김솔');

  // 같은 이름 둘이 맞바꾸면 이름 · 테이블 · 좌석이 그대로라 응모권만 섞인다 → 거절(손님 폰 pick 이 도로 가져가 판이 되돌아감)
  assert.equal(applySeatEdit(BASE, { op: 'swap', nameKey: '김현우 @2', otherKey: '김현우 @12' }), SAME_NAME_SWAP);
  // 띄어쓰기만 다른 같은 이름도 같은 이름
  const spaced = rows([
    ['김현우 @2', '김현우', 2, 3],
    ['김현우 @12', '김 현우', 12, 5],
  ]);
  assert.equal(applySeatEdit(spaced, { op: 'swap', nameKey: '김현우 @12', otherKey: '김현우 @2' }), SAME_NAME_SWAP);
  // 동명이인과 다른 이름은 바꿀 수 있다 — 동명이인 열쇠가 새 테이블로
  const b = plan(BASE, { op: 'swap', nameKey: '김현우 @2', otherKey: '이연주' });
  assert.deepEqual(Object.fromEntries(b.rekeys), { '김현우 @2': '김현우 @6' });
  assert.deepEqual(b.updated.map((u) => [u.after.id, u.after.nameKey, u.after.tableNo, u.after.seatNo]), [
    ['s2', '김현우 @6', 6, 7],
    ['s4', '이연주', 2, 3],
  ]);

  // 김현우(2번)와 12번 테이블이 아닌 사람 — 12번 사람과 바꾸면 김현우가 12번에 둘
  const r = rows([
    ['김현우 @2', '김현우', 2, 3],
    ['김현우 @12', '김현우', 12, 5],
    ['최가을', '최가을', 12, 1],
  ]);
  assert.equal(applySeatEdit(r, { op: 'swap', nameKey: '김현우 @2', otherKey: '최가을' }), '같은 테이블에 같은 이름이 두 번 있어요: 김현우');
  assert.equal(applySeatEdit(BASE, { op: 'swap', nameKey: '김솔', otherKey: '없음' }), SEAT_NOT_FOUND);
});

test('이름 고치기 — 열쇠 바뀜 · 띄어쓰기만이면 열쇠 그대로 · 다른 테이블 같은 이름이면 둘 다 동명이인 · 같은 테이블이면 거절', () => {
  const a = plan(BASE, { op: 'rename', nameKey: '김솔', name: '김 솔비' });
  assert.equal(a.key, '김솔비');
  assert.deepEqual([...a.rekeys], [['김솔', '김솔비']]);
  assert.deepEqual(a.renamed, { fromKey: '김솔', name: '김 솔비' });

  const b = plan(BASE, { op: 'rename', nameKey: '김솔', name: '김 솔' });
  assert.equal(b.rekeys.size, 0);
  assert.deepEqual(b.updated.map((u) => [u.after.nameKey, u.after.name]), [['김솔', '김 솔']]);

  // 박하나(6번) → 김솔 : 1번 테이블 김솔과 동명이인 — 둘 다 '김솔 @테이블'
  const c = plan(BASE, { op: 'rename', nameKey: '박하나', name: '김솔' });
  assert.deepEqual(Object.fromEntries(c.rekeys), { 김솔: '김솔 @1', 박하나: '김솔 @6' });
  assert.equal(c.key, '김솔 @6');

  // 이연주 → 문혜정 : 같은 6번 테이블에 문혜정 둘
  assert.equal(applySeatEdit(BASE, { op: 'rename', nameKey: '이연주', name: '문혜정' }), '같은 테이블에 같은 이름이 두 번 있어요: 문혜정');
});

test('추가 · 빼기 — 새 줄은 id 없음 · 동명이인이 생기면 옛 줄 열쇠도 바뀜 · 하나 남으면 꼬리 떨어짐 · 최대 줄 수', () => {
  const a = plan(BASE, { op: 'add', name: '홍길동', table: 3, seat: null });
  assert.deepEqual(a.added, [{ nameKey: '홍길동', name: '홍길동', tableNo: 3, seatNo: null }]);
  assert.equal(a.key, '홍길동');
  assert.equal(a.rows.length, BASE.length + 1);
  assert.deepEqual([a.updated.length, a.removed.length], [0, 0]);

  const b = plan(BASE, { op: 'add', name: '김솔', table: 9, seat: 2 });
  assert.deepEqual(Object.fromEntries(b.rekeys), { 김솔: '김솔 @1' });
  assert.equal(b.key, '김솔 @9');
  assert.equal(applySeatEdit(BASE, { op: 'add', name: '김 솔', table: 1, seat: 2 }), '같은 테이블에 같은 이름이 두 번 있어요: 김솔');

  const c = plan(BASE, { op: 'remove', nameKey: '김현우 @2' });
  assert.deepEqual(c.removed.map((r) => r.id), ['s2']);
  assert.deepEqual(Object.fromEntries(c.rekeys), { '김현우 @12': '김현우' });
  assert.equal(c.key, null);
  assert.deepEqual(pick(c), ['김솔|1|1', '김현우|12|5', '이연주|6|7', '문혜정|6|7', '박하나|6|-']);
  assert.equal(applySeatEdit(BASE, { op: 'remove', nameKey: '없음' }), SEAT_NOT_FOUND);

  const full = rows(Array.from({ length: SEAT_ROWS_MAX }, (_, i) => [`손님${i}`, `손님${i}`, (i % 18) + 1, null] as [string, string, number, null]));
  assert.match(applySeatEdit(full, { op: 'add', name: '한명더', table: 1, seat: null }) as string, /400줄까지/);
});

test('응모권 옮기기 계획 — 열쇠 바뀐 줄 · 이름 고친 줄만 · 뺀 줄은 그대로 · 명단 밖 끌어 넣기 · 막힌 열쇠는 건너뜀', () => {
  const tickets = [
    { id: 't1', nameKey: '김솔', name: '김 솔' },
    { id: 't2', nameKey: '김현우 @2', name: '김현우' },
    { id: 't3', nameKey: '김현우 @12', name: '김현우' },
    { id: 't4', nameKey: '홍길동', name: '홍길동' }, // 명단 밖
    { id: 't5', nameKey: '박하나', name: '박하나' },
  ];
  const tr = ticketRowOf(BASE, tickets);
  assert.equal(tr.has('t4'), false);

  // 동명이인 옮기기 — 그 사람 응모권만
  const m = planTicketMoves(plan(BASE, { op: 'move', nameKey: '김현우 @2', table: 5, seat: 1 }), tickets, tr) as any;
  assert.deepEqual(m, { moves: [{ id: 't2', from: '김현우 @2', to: '김현우 @5', name: null }], skipped: [] });

  // 동명이인과 다른 이름 맞바꾸기 — 동명이인 응모권만 새 테이블 열쇠로
  const s = planTicketMoves(plan(BASE, { op: 'swap', nameKey: '김현우 @2', otherKey: '박하나' }), tickets, tr) as any;
  assert.deepEqual(s.moves.map((x: any) => [x.id, x.from, x.to]), [['t2', '김현우 @2', '김현우 @6']]);

  // 이름 고치기 — 열쇠 + 이름. 띄어쓰기만 고쳐도 이름은 따라간다(열쇠 그대로)
  const r = planTicketMoves(plan(BASE, { op: 'rename', nameKey: '김솔', name: '김솔비' }), tickets, tr) as any;
  assert.deepEqual(r.moves, [{ id: 't1', from: '김솔', to: '김솔비', name: '김솔비' }]);
  const r2 = planTicketMoves(plan(BASE, { op: 'rename', nameKey: '김솔', name: '김솔' }), tickets, tr) as any;
  assert.deepEqual(r2.moves, [{ id: 't1', from: '김솔', to: '김솔', name: '김솔' }]);

  // 같은 테이블 좌석만 → 응모권 안 건드림
  assert.deepEqual(planTicketMoves(plan(BASE, { op: 'move', nameKey: '김솔', table: 1, seat: 2 }), tickets, tr), { moves: [], skipped: [] });

  // 빼기 — 뺀 줄 응모권은 그대로, 짝은 꼬리가 떨어져 옮김
  const rm = planTicketMoves(plan(BASE, { op: 'remove', nameKey: '김현우 @2' }), tickets, tr) as any;
  assert.deepEqual(rm.moves, [{ id: 't3', from: '김현우 @12', to: '김현우', name: null }]);

  // 추가로 동명이인이 생김 — 옛 줄 응모권이 '김솔 @1' 로
  const ad = planTicketMoves(plan(BASE, { op: 'add', name: '김솔', table: 9, seat: null }), tickets, tr) as any;
  assert.deepEqual(ad.moves, [{ id: 't1', from: '김솔', to: '김솔 @1', name: null }]);

  // 명단 밖 손님 끌어 넣기 — 같은 열쇠면 옮길 것 없음, 동명이인 줄로 들어가면 그 열쇠로
  assert.deepEqual(planTicketMoves(plan(BASE, { op: 'add', name: '홍길동', table: 3, seat: null }), tickets, tr, 't4'), { moves: [], skipped: [] });
  const withTwin = [...tickets, { id: 't6', nameKey: '김현우', name: '김현우' }]; // 동명이인 줄이 둘이라 아무 줄에도 안 붙은 응모권
  const tr6 = ticketRowOf(BASE, withTwin);
  assert.equal(tr6.has('t6'), false);
  const w = planTicketMoves(plan(BASE, { op: 'add', name: '김현우', table: 7, seat: 1 }), withTwin, tr6, 't6') as any;
  assert.deepEqual(w.moves, [{ id: 't6', from: '김현우', to: '김현우 @7', name: null }]);
  // 이미 줄에 붙은 응모권을 또 넣으려 하면 거절(다른 태블릿이 먼저 넣음)
  assert.match(planTicketMoves(plan(BASE, { op: 'add', name: '박하나', table: 3, seat: null }), tickets, tr, 't5') as string, /이미 명단에/);
  assert.match(planTicketMoves(plan(BASE, { op: 'add', name: '홍길동', table: 3, seat: null }), tickets, tr, 'nope') as string, /응모권을 찾을 수/);

  // 막힘 — 옮길 열쇠를 계획 밖 응모권이 쥐고 있으면 건너뜀(사슬도)
  const stale = [...tickets, { id: 't7', nameKey: '김현우 @5', name: '김현우' }];
  const trs = ticketRowOf(BASE, stale);
  const sk = planTicketMoves(plan(BASE, { op: 'move', nameKey: '김현우 @2', table: 5, seat: 1 }), stale, trs) as any;
  assert.deepEqual([sk.moves.length, sk.skipped.map((x: any) => x.id)], [0, ['t2']]);
});

/* ─── 손님 폰과 맞추기(순수) — 동명이인 pick · 옮긴 기록 · 이름 고치기로 비는 열쇠 ─── */

test('동명이인 줄 고르기 — pick 없음 = 고를 목록 · 고른 줄 · 고른 테이블에 없으면 응모권 줄 · 어드민이 옮기기 전 테이블이면 응모권 줄', () => {
  const same = [
    { nameKey: '김현우 @2', tableNo: 2 },
    { nameKey: '김현우 @5', tableNo: 5 },
  ];
  // pick 없음(안 고름 · 다시 고르기) — 응모권이 있어도 고를 목록
  assert.equal(resolveSameNameSeat(same, null, '김현우 @5'), undefined);
  // 응모권 없음 / 응모권이 옛 열쇠(명단에 없는 줄) → 고른 줄(ticketFor 가 응모권을 그 줄로 옮김)
  assert.equal(resolveSameNameSeat(same, 2, null)?.nameKey, '김현우 @2');
  assert.equal(resolveSameNameSeat(same, 2, '김현우 @12')?.nameKey, '김현우 @2');
  assert.equal(resolveSameNameSeat(same, 9, null), undefined);
  // 같으면 그대로
  assert.equal(resolveSameNameSeat(same, 5, '김현우 @5')?.nameKey, '김현우 @5');
  // 어드민이 2 → 7 로 옮김(7번 줄) — 폰의 pick 2 는 이제 그 이름 줄이 없음 → 응모권 줄('테이블 고르기'로 떨어지지 않게)
  const moved = [{ nameKey: '김현우 @7', tableNo: 7 }, { nameKey: '김현우 @5', tableNo: 5 }];
  assert.equal(resolveSameNameSeat(moved, 2, '김현우 @7')?.nameKey, '김현우 @7');
  // 둘 다 있는데 다름 — 옮기기 전 테이블이면 응모권 줄(폰의 옛 pick), 아니면 손님이 다시 고른 줄
  assert.equal(resolveSameNameSeat(same, 2, '김현우 @5', [2])?.nameKey, '김현우 @5');
  assert.equal(resolveSameNameSeat(same, 2, '김현우 @5', [9])?.nameKey, '김현우 @2');
  assert.equal(resolveSameNameSeat(same, 2, '김현우 @5')?.nameKey, '김현우 @2');
});

test('옮긴 기록 — 테이블이 바뀐 줄의 응모권만 · 응모권마다 옛 테이블 모으기 · 모양 틀린 줄 버림', () => {
  const tickets = [
    { id: 't1', nameKey: '김솔', name: '김솔' },
    { id: 't2', nameKey: '김현우 @2', name: '김현우' },
  ];
  const tr = ticketRowOf(BASE, tickets);
  // 동명이인 2 → 5: t2 의 옛 테이블 2. 같은 테이블 좌석만 → 없음. 응모권 없는 사람 → 없음
  assert.deepEqual(seatMovesOf(plan(BASE, { op: 'move', nameKey: '김현우 @2', table: 5, seat: 1 }), tr), [{ id: 't2', from: 2 }]);
  assert.deepEqual(seatMovesOf(plan(BASE, { op: 'move', nameKey: '김현우 @2', table: 2, seat: 8 }), tr), []);
  assert.deepEqual(seatMovesOf(plan(BASE, { op: 'move', nameKey: '박하나', table: 3, seat: null }), tr), []);
  // 동명이인 아닌 사람도 남긴다(나중에 같은 이름이 생기면 폰의 옛 pick 이 다시 쓰일 수 있음) · 맞바꾸기는 둘 다
  assert.deepEqual(seatMovesOf(plan(BASE, { op: 'swap', nameKey: '김솔', otherKey: '김현우 @2' }), tr), [{ id: 't1', from: 1 }, { id: 't2', from: 2 }]);

  const merged = mergeSeatMoves([{ id: 't2', from: [2] }], [{ id: 't2', from: 5 }, { id: 't2', from: 2 }, { id: 't9', from: 3 }]);
  assert.deepEqual(merged, [{ id: 't2', from: [2, 5] }, { id: 't9', from: [3] }]);
  assert.deepEqual(parseSeatMoves({ list: merged }), merged);
  assert.deepEqual(parseSeatMoves({ list: [{ id: 't1', from: [0, 19, 'x', 4, 4] }, { id: '', from: [1] }, { id: 't3', from: [] }, null] }), [{ id: 't1', from: [4] }]);
  assert.deepEqual(parseSeatMoves(null), []);
});

test('이름 고치기로 비는 열쇠 — 그 줄 응모권의 옛 열쇠만 지운 이름으로 · 추가 · 이름 고치기로 들어온 열쇠는 풂', () => {
  const tickets = [
    { id: 't1', nameKey: '김솔', name: '김 솔' },
    { id: 't2', nameKey: '김현우 @2', name: '김현우' },
    { id: 't3', nameKey: '김현우 @12', name: '김현우' },
  ];
  const tr = ticketRowOf(BASE, tickets);
  const movesOf = (p: SeatEditPlan): TicketMove[] => (planTicketMoves(p, tickets, tr) as { moves: TicketMove[] }).moves;
  const rn = plan(BASE, { op: 'rename', nameKey: '김솔', name: '김솔비' });
  assert.deepEqual(renameBlocks(rn, movesOf(rn), tr, tickets), [{ nameKey: '김솔', name: '김 솔', reason: 'rename' }]);
  // 실제로 못 옮겼으면(건너뜀) 막지 않는다
  assert.deepEqual(renameBlocks(rn, [], tr, tickets), []);
  // 띄어쓰기만 고침 — 열쇠 그대로라 막을 것 없음
  const sp = plan(BASE, { op: 'rename', nameKey: '김솔', name: '김솔 ' });
  assert.deepEqual(renameBlocks(sp, movesOf(sp), tr, tickets), []);
  // 동명이인 이름 고치기 — 그 줄 열쇠만(짝의 꼬리 떨어짐 '김현우 @12' → '김현우' 는 막지 않음)
  const tw = plan(BASE, { op: 'rename', nameKey: '김현우 @2', name: '김현수' });
  assert.deepEqual(movesOf(tw).map((m) => [m.id, m.from, m.to]), [['t2', '김현우 @2', '김현수'], ['t3', '김현우 @12', '김현우']]);
  assert.deepEqual(renameBlocks(tw, movesOf(tw), tr, tickets), [{ nameKey: '김현우 @2', name: '김현우', reason: 'rename' }]);
  // 옮기기 · 추가는 막지 않는다
  const mv = plan(BASE, { op: 'move', nameKey: '김현우 @2', table: 5, seat: 1 });
  assert.deepEqual(renameBlocks(mv, movesOf(mv), tr, tickets), []);

  // 명단을 고쳐 응모권 열쇠가 줄 열쇠와 어긋나 있던 줄(응모권 '김현우 @2' ↔ 줄 '김현우') — 둘 다 막는다(손님 폰은 줄 열쇠로 부름)
  const lone = rows([['김현우', '김현우', 2, 3]]);
  const loneTickets = [{ id: 't2', nameKey: '김현우 @2', name: '김현우' }];
  const ltr = ticketRowOf(lone, loneTickets);
  const lr = plan(lone, { op: 'rename', nameKey: '김현우', name: '김현수' });
  const lm = (planTicketMoves(lr, loneTickets, ltr) as { moves: TicketMove[] }).moves;
  assert.deepEqual(renameBlocks(lr, lm, ltr, loneTickets).map((b) => b.nameKey), ['김현우 @2', '김현우']);

  // 명단 줄에 새로 붙은 열쇠 = 새 줄 + 바뀐 열쇠(지운 이름 목록에서 푼다)
  assert.deepEqual(newRowKeys(rn), ['김솔비']);
  assert.deepEqual(newRowKeys(tw), ['김현수', '김현우']);
  assert.deepEqual(newRowKeys(plan(BASE, { op: 'add', name: '김솔', table: 9, seat: null })), ['김솔 @9', '김솔 @1']);
  assert.deepEqual(newRowKeys(plan(BASE, { op: 'move', nameKey: '김솔', table: 1, seat: 2 })), []);

  const at = '2026-11-23T20:00:00.000Z';
  const list = [{ nameKey: '홍길동', name: '홍길동', at: 'old' }, { nameKey: '김솔', name: '김솔', at: 'old' }];
  assert.deepEqual(editBlockList(list, [{ nameKey: '김솔', name: '김 솔' }], ['김솔비'], at), [
    { nameKey: '홍길동', name: '홍길동', at: 'old' },
    { nameKey: '김솔', name: '김 솔', at },
  ]);
  assert.deepEqual(editBlockList(list, [], ['홍길동'], at), [{ nameKey: '김솔', name: '김솔', at: 'old' }]);
  assert.deepEqual(editBlockList(list, [{ nameKey: '박하나', name: '박하나' }], ['박하나'], at), list);
});

/* ─── 서비스(editSeats · guest) — 유일 열쇠를 지키는 가짜 prisma 로 쓰기 순서 · 잠금 · 묶음 버리기 · 손님 폴링 확인 ─── */

function fakeSeatPrisma() {
  const seats: any[] = [];
  const tickets: any[] = [];
  const draws: any[] = [];
  const locks: string[] = [];
  /** reception_state — 'eventKey:key' → value */
  const state = new Map<string, any>();
  let n = 0;
  const dup = () => new Prisma.PrismaClientKnownRequestError('dup', { code: 'P2002', clientVersion: 'test' });
  const seatMatch = (s: any, w: any) =>
    s.eventKey === w.eventKey && (!w.id || (typeof w.id === 'string' ? s.id === w.id : w.id.in.includes(s.id))) && (!w.nameKey || s.nameKey === w.nameKey);
  const ticketMatch = (t: any, w: any): boolean =>
    (!w.eventKey || t.eventKey === w.eventKey) &&
    (!w.id || t.id === w.id) &&
    (!w.nameKey || t.nameKey === w.nameKey) &&
    (!w.deviceId || t.deviceId === w.deviceId) &&
    (!('userId' in w) || (w.userId === null ? t.userId == null : t.userId === w.userId)) &&
    (!w.OR || w.OR.some((o: any) => ticketMatch(t, o)));
  const withDraws = (t: any) => ({ ...t, draws: draws.filter((d) => d.ticketId === t.id && !d.cancelledAt).slice(0, 1) });
  const stateKey = (w: any) => `${w.eventKey_key.eventKey}:${w.eventKey_key.key}`;
  // 원시 SQL — 행사 잠금은 남기고, 지운 이름 목록(editBlocks)의 기본 줄 넣기 · FOR UPDATE 읽기만 흉내(값 순서 = eventKey, key, value)
  const raw = (strings: TemplateStringsArray, ...v: any[]) => {
    const sql = strings.join('?');
    if (!sql.includes('reception_state')) {
      locks.push(`${sql}|${v.join(',')}`);
      return null;
    }
    const k = `${v[0]}:${v[1]}`;
    if (sql.includes('INSERT') && !state.has(k)) state.set(k, JSON.parse(v[2]));
    return [{ value: state.get(k) }];
  };
  const prisma: any = {
    receptionGuest: { upsert: async () => ({}) },
    receptionState: {
      findUnique: async ({ where }: any) => (state.has(stateKey(where)) ? { value: structuredClone(state.get(stateKey(where))) } : null),
      update: async ({ where, data }: any) => {
        state.set(stateKey(where), structuredClone(data.value));
        return data;
      },
      upsert: async ({ where, create, update }: any) => {
        state.set(stateKey(where), structuredClone(state.has(stateKey(where)) ? update.value : create.value));
        return {};
      },
    },
    receptionSeat: {
      findMany: async ({ where }: any) => seats.filter((s) => s.eventKey === where.eventKey).map((s) => ({ ...s })),
      deleteMany: async ({ where }: any) => {
        const hit = seats.filter((s) => seatMatch(s, where));
        for (const h of hit) seats.splice(seats.indexOf(h), 1);
        return { count: hit.length };
      },
      updateMany: async ({ where, data }: any) => {
        if (where.id === undefined) throw new Error('id 없는 updateMany — 명단 전체를 고칠 뻔');
        const hit = seats.filter((s) => seatMatch(s, where));
        if (data.nameKey && hit.length && seats.some((s) => !hit.includes(s) && s.eventKey === hit[0].eventKey && s.nameKey === data.nameKey)) throw dup();
        for (const h of hit) Object.assign(h, data);
        return { count: hit.length };
      },
      createMany: async ({ data }: any) => {
        for (const d of data) {
          if (seats.some((s) => s.eventKey === d.eventKey && s.nameKey === d.nameKey)) throw dup();
          seats.push({ id: `s${++n}`, seatNo: null, ...d });
        }
        return { count: data.length };
      },
    },
    receptionTicket: {
      findMany: async ({ where }: any) => tickets.filter((t) => ticketMatch(t, where)).sort((a, b) => a.number - b.number).map(withDraws),
      updateMany: async ({ where, data }: any) => {
        const hit = tickets.filter((t) => ticketMatch(t, where));
        if (data.nameKey && hit.length && tickets.some((t) => !hit.includes(t) && t.eventKey === hit[0].eventKey && t.nameKey === data.nameKey)) throw dup();
        for (const h of hit) Object.assign(h, data);
        return { count: hit.length };
      },
      aggregate: async ({ where }: any) => ({ _max: { number: tickets.filter((t) => t.eventKey === where.eventKey).reduce((m, t) => Math.max(m, t.number), 0) || null } }),
      create: async ({ data }: any) => {
        if (tickets.some((t) => t.eventKey === data.eventKey && (t.number === data.number || t.nameKey === data.nameKey))) throw dup();
        const t = { id: `t${++n}`, userId: null, createdAt: new Date(), lastSeenAt: new Date(), ...data };
        tickets.push(t);
        return withDraws(t);
      },
    },
    receptionDraw: {
      updateMany: async ({ where, data }: any) => {
        const hit = draws.filter((d) => d.eventKey === where.eventKey && d.ticketId === where.ticketId);
        for (const h of hit) Object.assign(h, data);
        return { count: hit.length };
      },
    },
    $transaction: async (fn: any) => {
      // 실패하면 되돌림(트랜잭션 흉내) — 시작 때 사본으로 복구
      const snap = structuredClone({ seats, tickets, draws, state });
      try {
        return await fn({
          ...prisma,
          $executeRaw: async (s: TemplateStringsArray, ...v: any[]) => (raw(s, ...v), 1),
          $queryRaw: async (s: TemplateStringsArray, ...v: any[]) => raw(s, ...v) ?? [],
        });
      } catch (e) {
        seats.splice(0, seats.length, ...snap.seats);
        tickets.splice(0, tickets.length, ...snap.tickets);
        draws.splice(0, draws.length, ...snap.draws);
        state.clear();
        for (const [k, v] of snap.state) state.set(k, v);
        throw e;
      }
    },
  };
  return { prisma, seats, tickets, draws, locks, state };
}

function liveSvc(prisma: any) {
  const reception = Object.assign(Object.create(ReceptionService.prototype), { prisma, feedCache: new Map(), logger: { warn() {} } });
  return Object.assign(Object.create(ReceptionLiveService.prototype), {
    prisma, reception, seatCache: new Map(), modeCache: new Map(), renameCache: new Map(), touched: new Map(), drawPushDelayMs: 0,
    logger: { warn() {}, log() {}, error() {} },
  }) as ReceptionLiveService;
}

/** 시험 응모권 — 받은 기기 · 시각 포함 */
const ticket = (EK: string, id: string, number: number, nameKey: string, name: string, deviceId = `D-${id}`) => ({
  id, eventKey: EK, number, nameKey, name, deviceId, userId: null, createdAt: new Date(), lastSeenAt: new Date(),
});

test('editSeats — 행사 잠금 · 동명이인 맞바꾸기 거절 · 맞바꾸기(응모권 열쇠 따라감) · 이름 고치기(응모권·추첨 이름) · 명단 묶음 버림 · 실패는 통째로 되돌림', async () => {
  const f = fakeSeatPrisma();
  const EK = 'wmak-2026' as const;
  f.seats.push(
    { id: 'a', eventKey: EK, nameKey: '김현우 @2', name: '김현우', tableNo: 2, seatNo: 3 },
    { id: 'b', eventKey: EK, nameKey: '김현우 @12', name: '김현우', tableNo: 12, seatNo: 5 },
    { id: 'c', eventKey: EK, nameKey: '김솔', name: '김솔', tableNo: 1, seatNo: 1 },
    { id: 'e', eventKey: EK, nameKey: '최가을', name: '최가을', tableNo: 7, seatNo: 2 },
  );
  f.tickets.push(
    ticket(EK, 't1', 1, '김현우 @2', '김현우'),
    ticket(EK, 't2', 2, '김현우 @12', '김현우'),
    ticket(EK, 't3', 3, '김솔', '김솔'),
    ticket(EK, 't4', 4, '홍길동', '홍길동'),
  );
  f.draws.push({ id: 'd1', eventKey: EK, ticketId: 't3', name: '김솔' });
  const svc = liveSvc(f.prisma);
  (svc as any).seatCache.set(EK, { at: Date.now(), p: Promise.resolve(null) });

  // 동명이인끼리 맞바꾸기 — 거절, 아무것도 안 바뀜
  const untouched = JSON.stringify({ s: f.seats, t: f.tickets });
  await assert.rejects(svc.editSeats(EK, { op: 'swap', nameKey: '김현우 @2', otherKey: '김현우 @12' }), /같은 이름끼리는 바꿔도 명단이 그대로예요/);
  assert.equal(JSON.stringify({ s: f.seats, t: f.tickets }), untouched);

  // 동명이인(2번) ↔ 최가을(7번) — 김현우 열쇠가 7번으로, 응모권도 따라감 · 옮긴 기록(옛 테이블)
  const r = await svc.editSeats(EK, { op: 'swap', nameKey: '김현우 @2', otherKey: '최가을' });
  assert.equal(r.ok, true);
  assert.equal(r.changed, true);
  assert.equal(r.key, '김현우 @7');
  assert.match(f.locks[0], /pg_advisory_xact_lock\(hashtext\(\?\)\)\|rc-seats:wmak-2026/);
  assert.deepEqual(f.seats.map((s) => [s.id, s.nameKey, s.tableNo, s.seatNo]), [
    ['a', '김현우 @7', 7, 2],
    ['b', '김현우 @12', 12, 5],
    ['c', '김솔', 1, 1],
    ['e', '최가을', 2, 3],
  ]);
  assert.deepEqual(f.tickets.map((t) => [t.id, t.nameKey]), [['t1', '김현우 @7'], ['t2', '김현우 @12'], ['t3', '김솔'], ['t4', '홍길동']]);
  assert.equal(r.ticketsMoved, 1);
  assert.deepEqual(f.state.get(`${EK}:seat-moves`), { list: [{ id: 't1', from: [2] }] });
  assert.equal((svc as any).seatCache.has(EK), false);
  assert.deepEqual(r.rows.map((x) => `${x.name}@${x.table}`), ['김솔@1', '최가을@2', '김현우@7', '김현우@12']);

  // 이름 고치기 — 응모권 열쇠·이름 + 추첨 기록 이름 + 옛 열쇠는 지운 이름 목록에
  const rn = await svc.editSeats(EK, { op: 'rename', nameKey: '김솔', name: '김솔비' });
  assert.equal(rn.key, '김솔비');
  assert.deepEqual(
    (({ id, nameKey, name }) => ({ id, nameKey, name }))(f.tickets.find((t) => t.id === 't3')),
    { id: 't3', nameKey: '김솔비', name: '김솔비' },
  );
  assert.equal(f.draws[0].name, '김솔비');
  assert.deepEqual(f.state.get(`${EK}:ticket-blocks`).list.map((b: any) => [b.nameKey, b.name]), [['김솔', '김솔']]);

  // 명단 밖 손님(홍길동 응모권) 끌어 넣기 → 명단 줄 생김, 응모권은 같은 열쇠라 그대로
  const ad = await svc.editSeats(EK, { op: 'add', name: '홍길동', table: 3, seat: 2, ticketId: 't4' });
  assert.equal(ad.key, '홍길동');
  assert.ok(f.seats.some((s) => s.nameKey === '홍길동' && s.tableNo === 3 && s.seatNo === 2));
  assert.equal(ad.ticketsMoved, 0);

  // 비운 옛 이름으로 다른 사람을 추가하면 막힘이 풀린다(그 사람이 응모권을 받을 수 있게)
  await svc.editSeats(EK, { op: 'add', name: '김솔', table: 4, seat: null });
  assert.deepEqual(f.state.get(`${EK}:ticket-blocks`).list, []);

  // 동명이인 중 도착한 줄(응모권 t1)은 빼기 · 이름 고치기 거절 — 그 폰이 옛 이름으로 짝의 자리 · 응모권을 받게 된다(fix 261123)
  const held = JSON.stringify({ s: f.seats, t: f.tickets });
  await assert.rejects(svc.editSeats(EK, { op: 'remove', nameKey: '김현우 @7' }), /이미 도착한 분은 이름을 바꾸거나 뺄 수 없어요/);
  await assert.rejects(svc.editSeats(EK, { op: 'rename', nameKey: '김현우 @7', name: '김현수' }), /이미 도착한 분은/);
  assert.equal(JSON.stringify({ s: f.seats, t: f.tickets }), held);
  // 응모권을 지운 뒤(운영자 [응모권 지우기])엔 뺄 수 있다 — 짝 동명이인 꼬리 떨어짐
  f.tickets.splice(f.tickets.findIndex((t) => t.id === 't1'), 1);
  await svc.editSeats(EK, { op: 'remove', nameKey: '김현우 @7' });
  assert.deepEqual(f.seats.filter((s) => s.name === '김현우').map((s) => [s.id, s.nameKey]), [['b', '김현우']]);
  assert.deepEqual(f.tickets.map((t) => [t.id, t.nameKey]), [['t2', '김현우'], ['t3', '김솔비'], ['t4', '홍길동']]);

  // 거절 — 400 이유 그대로, 아무것도 안 바뀜
  const before = JSON.stringify({ s: f.seats, t: f.tickets });
  await assert.rejects(svc.editSeats(EK, { op: 'add', name: '김솔비', table: 1, seat: null }), /같은 테이블에 같은 이름이 두 번 있어요: 김솔비/);
  await assert.rejects(svc.editSeats(EK, { op: 'move', nameKey: '없는사람', table: 1, seat: 1 }), /명단에서 찾을 수 없어요/);
  await assert.rejects(svc.editSeats(EK, { op: 'move', nameKey: '김솔비', table: 99 }), /테이블은 1~18/);
  assert.equal(JSON.stringify({ s: f.seats, t: f.tickets }), before);

  // 쓰다가 유일 열쇠가 겹치면(그 사이 손님이 막 받은 응모권) — 통째로 되돌리고 '다시 해 주세요'
  f.tickets.push(ticket(EK, 't9', 9, '#tmp t2', '방해'));
  await assert.rejects(svc.editSeats(EK, { op: 'add', name: '김현우', table: 9, seat: null }), /방금 다른 곳에서 바뀌었어요/);
  assert.equal(f.seats.filter((s) => s.name === '김현우').length, 1);
  assert.equal(f.tickets.find((t) => t.id === 't2')!.nameKey, '김현우');
});

test('editSeats — 손님 자리 탭이 바로 새 자리를 받는다(명단 묶음 버림)', async () => {
  const f = fakeSeatPrisma();
  const EK = 'wmak-2026' as const;
  f.seats.push({ id: 'c', eventKey: EK, nameKey: '김솔', name: '김솔', tableNo: 1, seatNo: 1 });
  const svc = liveSvc(f.prisma);
  assert.deepEqual((await svc.seatList(EK)).rows.map((r) => r.tableNo), [1]);
  await svc.editSeats(EK, { op: 'move', nameKey: '김솔', table: 4, seat: 6 });
  const after = await svc.seatList(EK);
  assert.deepEqual(after.rows.map((r) => [r.nameKey, r.tableNo, r.seatNo]), [['김솔', 4, 6]]);
  assert.equal(after.byKey.get('김솔')!.tableNo, 4);
});

test('editSeats + 손님 폴링 — 동명이인을 옮겨도 폰의 옛 pick 이 응모권을 도로 가져가지 않음 · 손님이 다시 고르는 길은 그대로', async () => {
  const f = fakeSeatPrisma();
  const EK = 'wmak-2026' as const;
  f.state.set(`${EK}:tickets`, { mode: 'open' });
  f.seats.push(
    { id: 'a', eventKey: EK, nameKey: '김현우 @2', name: '김현우', tableNo: 2, seatNo: 3 },
    { id: 'b', eventKey: EK, nameKey: '김현우 @12', name: '김현우', tableNo: 12, seatNo: 5 },
  );
  const svc = liveSvc(f.prisma);
  // A(2번 김현우 · 폰 DA)가 2를 골라 응모권 #1
  const first = await svc.guest(EK, 'DA', '김현우', 2);
  assert.deepEqual([first.seat, first.ticket?.number, f.tickets[0].nameKey], [{ table: 2, seat: 3 }, 1, '김현우 @2']);

  // 어드민이 A 를 5번으로 — 폰은 pick 2 그대로 보내도 5번 자리(응모권 줄), 응모권도 5번 열쇠 그대로
  await svc.editSeats(EK, { op: 'move', nameKey: '김현우 @2', table: 5, seat: 1 });
  const afterMove = await svc.guest(EK, 'DA', '김현우', 2);
  assert.deepEqual([afterMove.seat, afterMove.ticket?.number, f.tickets[0].nameKey], [{ table: 5, seat: 1 }, 1, '김현우 @5']);

  // 이어서 B(12번 · 응모권 없음)를 2번으로 — A 폰(pick 2)이 B 줄을 보지도, 응모권을 B 줄로 옮기지도 않음
  await svc.editSeats(EK, { op: 'move', nameKey: '김현우 @12', table: 2, seat: 4 });
  const afterB = await svc.guest(EK, 'DA', '김현우', 2);
  assert.deepEqual([afterB.seat, afterB.ticket?.number, f.tickets[0].nameKey], [{ table: 5, seat: 1 }, 1, '김현우 @5']);
  // B 폰(DB)이 2를 고르면 자기 응모권을 새로 받는다
  const b = await svc.guest(EK, 'DB', '김현우', 2);
  assert.deepEqual([b.seat, b.ticket?.number, f.tickets[1].nameKey], [{ table: 2, seat: 4 }, 2, '김현우 @2']);
  // '다시 고르기'(pick 없음)는 여전히 고를 목록
  const repick = await svc.guest(EK, 'DA', '김현우', null);
  assert.deepEqual([repick.seat, repick.sameName?.map((x) => x.table), repick.ticket?.number], [null, [2, 5], 1]);

  // 손님이 잘못 골랐다 다시 고르는 길(어드민이 안 옮긴 사람) — 응모권이 고른 줄로 옮겨 감
  f.seats.push({ id: 'c', eventKey: EK, nameKey: '이하나 @3', name: '이하나', tableNo: 3, seatNo: 1 }, { id: 'd', eventKey: EK, nameKey: '이하나 @9', name: '이하나', tableNo: 9, seatNo: 1 });
  (svc as any).seatCache.clear();
  assert.equal((await svc.guest(EK, 'DC', '이하나', 9)).ticket?.number, 3);
  const fixed = await svc.guest(EK, 'DC', '이하나', 3);
  assert.deepEqual([fixed.seat, f.tickets[2].nameKey], [{ table: 3, seat: 1 }, '이하나 @3']);
});

test('editSeats + 손님 폴링 — 이름을 고치면 옛 이름으로 부르는 폰도 새 이름 · 자리 · 같은 응모권으로 이어짐(renamedFrom) · 새 번호는 안 나옴', async () => {
  const f = fakeSeatPrisma();
  const EK = 'wmak-2026' as const;
  f.state.set(`${EK}:tickets`, { mode: 'open' });
  f.seats.push({ id: 'a', eventKey: EK, nameKey: '김솔', name: '김솔', tableNo: 7, seatNo: 3 });
  const svc = liveSvc(f.prisma);
  const d1 = await svc.guest(EK, 'D1', '김솔');
  assert.equal(d1.ticket?.number, 1);
  assert.equal('renamedFrom' in d1, false);
  // 같은 사람 두 번째 폰 — 같은 응모권
  assert.equal((await svc.guest(EK, 'D2', '김솔')).ticket?.number, 1);

  await svc.editSeats(EK, { op: 'rename', nameKey: '김솔', name: '김솔비' });
  // 두 폰 다 옛 이름으로 폴링 — 새 이름으로 이어 주고(폰이 저장한 이름을 바꾸게 renamedFrom) 자리 · 같은 응모권. 새 번호 안 나옴
  for (const dev of ['D2', 'D1']) {
    const r = await svc.guest(EK, dev, '김솔');
    assert.deepEqual([r.name, r.renamedFrom, r.seat, r.ticket?.number, r.ticket?.name], ['김솔비', '김솔', { table: 7, seat: 3 }, 1, '김솔비']);
  }
  assert.equal(f.tickets.length, 1);
  // 새 이름으로 부르면 그대로(renamedFrom 없음)
  const renamed = await svc.guest(EK, 'D2', '김솔비');
  assert.deepEqual([renamed.name, renamed.renamedFrom, renamed.seat, renamed.ticket?.number], ['김솔비', undefined, { table: 7, seat: 3 }, 1]);
});

test('이름 고친 기록 — 안 온 사람도 이어짐 · 여러 번 고치면 끝까지 · 되돌리면 멈춤 · 옛 이름이 다시 생기면 그 사람 · 그 뒤 빠지면 안 이음', async () => {
  const f = fakeSeatPrisma();
  const EK = 'wmak-2026' as const;
  f.seats.push(
    { id: 'a', eventKey: EK, nameKey: '강문주', name: '강문주', tableNo: 7, seatNo: 1 },
    { id: 'b', eventKey: EK, nameKey: '홍현미', name: '홍현미', tableNo: 14, seatNo: 5 },
  );
  const svc = liveSvc(f.prisma);
  // 발급 전(응모권 없음) — 폰이 먼저 이름만 넣어 둠
  assert.deepEqual((await svc.guest(EK, 'P1', '강문주')).seat, { table: 7, seat: 1 });
  await svc.editSeats(EK, { op: 'rename', nameKey: '강문주', name: '장현준' });
  const a = await svc.guest(EK, 'P1', '강문주');
  assert.deepEqual([a.name, a.renamedFrom, a.seat, a.ticket], ['장현준', '강문주', { table: 7, seat: 1 }, null]);
  // 한 번 더 고침 — 옛 옛 이름으로 불러도 끝 이름으로
  await svc.editSeats(EK, { op: 'rename', nameKey: '장현준', name: '장현중' });
  const b = await svc.guest(EK, 'P1', '강문주');
  assert.deepEqual([b.name, b.renamedFrom, b.seat], ['장현중', '강문주', { table: 7, seat: 1 }]);
  assert.equal((await svc.guest(EK, 'P2', '장현준')).name, '장현중');
  // 되돌림(장현중 → 강문주) — 강문주는 명단에 있으니 그대로, 장현준 · 장현중 폰은 강문주로
  await svc.editSeats(EK, { op: 'rename', nameKey: '장현중', name: '강문주' });
  const c = await svc.guest(EK, 'P1', '강문주');
  assert.deepEqual([c.name, c.renamedFrom, c.seat], ['강문주', undefined, { table: 7, seat: 1 }]);
  assert.deepEqual([(await svc.guest(EK, 'P2', '장현준')).name, (await svc.guest(EK, 'P3', '장현중')).name], ['강문주', '강문주']);
  // 옛 이름(홍현미 → 임윤희 로 고친 뒤 '홍현미'를 새로 넣음) — 이제 그 이름은 새로 넣은 사람 것
  await svc.editSeats(EK, { op: 'rename', nameKey: '홍현미', name: '임윤희' });
  assert.equal((await svc.guest(EK, 'Q1', '홍현미')).name, '임윤희');
  await svc.editSeats(EK, { op: 'add', name: '홍현미', table: 3, seat: 2 });
  const d = await svc.guest(EK, 'Q1', '홍현미');
  assert.deepEqual([d.name, d.renamedFrom, d.seat], ['홍현미', undefined, { table: 3, seat: 2 }]);
  // 새 이름 줄이 그 뒤 빠지면 잇지 않는다(없는 이름으로 바꿔 주지 않게)
  await svc.editSeats(EK, { op: 'rename', nameKey: '강문주', name: '강문지' });
  await svc.editSeats(EK, { op: 'remove', nameKey: '강문지' });
  const e = await svc.guest(EK, 'P1', '강문주');
  assert.deepEqual([e.name, e.renamedFrom, e.seat], ['강문주', undefined, null]);
});

test('이름 고친 기록 — 동명이인 한 줄을 고치면 고른 테이블이 그 줄이던 폰만 이어짐 · 짝 폰 · 고르기 전 폰은 그대로', async () => {
  const f = fakeSeatPrisma();
  const EK = 'wmak-2026' as const;
  f.seats.push(
    { id: 'a', eventKey: EK, nameKey: '김현우 @2', name: '김현우', tableNo: 2, seatNo: 3 },
    { id: 'b', eventKey: EK, nameKey: '김현우 @12', name: '김현우', tableNo: 12, seatNo: 5 },
  );
  const svc = liveSvc(f.prisma);
  await svc.editSeats(EK, { op: 'rename', nameKey: '김현우 @12', name: '김현오' });
  // 12번을 골라 두었던 폰 — 새 이름으로
  const mine = await svc.guest(EK, 'D12', '김현우', 12);
  assert.deepEqual([mine.name, mine.renamedFrom, mine.seat], ['김현오', '김현우', { table: 12, seat: 5 }]);
  // 2번을 고른 짝 폰 · 안 고른 폰 — 남은 한 줄(2번) 그대로
  const twin = await svc.guest(EK, 'D2', '김현우', 2);
  assert.deepEqual([twin.name, twin.renamedFrom, twin.seat], ['김현우', undefined, { table: 2, seat: 3 }]);
  const none = await svc.guest(EK, 'D0', '김현우');
  assert.deepEqual([none.name, none.renamedFrom, none.seat], ['김현우', undefined, { table: 2, seat: 3 }]);
  // 새 이름이 다시 동명이인이 되어도(다른 테이블에 '김현오' 추가) 고친 그 줄(12번)로
  await svc.editSeats(EK, { op: 'add', name: '김현오', table: 9, seat: 1 });
  const again = await svc.guest(EK, 'D12', '김현우', 12);
  assert.deepEqual([again.name, again.seat], ['김현오', { table: 12, seat: 5 }]);
  // 그 테이블(12)에 '김현우'가 새로 들어오면 기록을 버린다 — 이제 12번 김현우는 그 사람
  await svc.editSeats(EK, { op: 'add', name: '김현우', table: 12, seat: 1 });
  const fresh = await svc.guest(EK, 'D12', '김현우', 12);
  assert.deepEqual([fresh.name, fresh.renamedFrom, fresh.seat], ['김현우', undefined, { table: 12, seat: 1 }]);
});

test('이름 고친 기록 — 동명이인 둘을 다 고쳐도(두 순서 모두) 각자 폰은 자기 새 이름 · 고른 테이블이 어느 기록과도 안 맞으면 짐작 안 함 · 응모권이 이김', async () => {
  for (const order of ['12먼저', '2먼저'] as const) {
    const f = fakeSeatPrisma();
    const EK = 'wmak-2026' as const;
    f.seats.push(
      { id: 'a', eventKey: EK, nameKey: '김현우 @2', name: '김현우', tableNo: 2, seatNo: 3 },
      { id: 'b', eventKey: EK, nameKey: '김현우 @12', name: '김현우', tableNo: 12, seatNo: 5 },
    );
    const svc = liveSvc(f.prisma);
    if (order === '12먼저') {
      await svc.editSeats(EK, { op: 'rename', nameKey: '김현우 @12', name: '김현오' });
      await svc.editSeats(EK, { op: 'rename', nameKey: '김현우', name: '김현수' });
    } else {
      await svc.editSeats(EK, { op: 'rename', nameKey: '김현우 @2', name: '김현수' });
      await svc.editSeats(EK, { op: 'rename', nameKey: '김현우', name: '김현오' });
    }
    const y = await svc.guest(EK, 'DY', '김현우', 12);
    assert.deepEqual([y.name, y.seat], ['김현오', { table: 12, seat: 5 }], `${order}: 12번 폰`);
    const x = await svc.guest(EK, 'DX', '김현우', 2);
    assert.deepEqual([x.name, x.seat], ['김현수', { table: 2, seat: 3 }], `${order}: 2번 폰`);
    // 엉뚱한 테이블을 고른 폰 — 짐작하지 않고 명단에 없음(예전 그대로)
    const lost = await svc.guest(EK, 'DZ', '김현우', 7);
    assert.deepEqual([lost.name, lost.renamedFrom, lost.seat], ['김현우', undefined, null], `${order}: 7번 폰`);
  }
  // 고른 테이블이 없어도 이 기기 응모권이 따라간 새 이름이 이김
  const f = fakeSeatPrisma();
  const EK = 'wmak-2026' as const;
  f.state.set(`${EK}:tickets`, { mode: 'open' });
  f.seats.push(
    { id: 'a', eventKey: EK, nameKey: '김현우 @2', name: '김현우', tableNo: 2, seatNo: 3 },
    { id: 'b', eventKey: EK, nameKey: '김현우 @12', name: '김현우', tableNo: 12, seatNo: 5 },
  );
  const svc = liveSvc(f.prisma);
  await svc.editSeats(EK, { op: 'rename', nameKey: '김현우 @12', name: '김현오' });
  // 12번 분이 새 이름으로 응모권을 받음(그 폰엔 옛 이름도 남아 있을 수 있다)
  assert.equal((await svc.guest(EK, 'DY', '김현오')).ticket?.number, 1);
  await svc.editSeats(EK, { op: 'rename', nameKey: '김현우', name: '김현수' });
  const y = await svc.guest(EK, 'DY', '김현우');
  assert.deepEqual([y.name, y.seat, y.ticket?.number], ['김현오', { table: 12, seat: 5 }, 1]);
  // 응모권 없는 폰 · 고른 테이블 없음 — 한 줄이던 이름 기록(남은 2번 분)으로
  const x = await svc.guest(EK, 'DX', '김현우');
  assert.deepEqual([x.name, x.seat], ['김현수', { table: 2, seat: 3 }]);
});

test('이름 고친 기록 — 사슬(A→B→C) 뒤 중간 이름 B 를 다른 분께 줘도 A 폰은 C · 고친 이름이 옮긴 뒤 동명이인이 되어도 그 줄(줄 id)', async () => {
  const f = fakeSeatPrisma();
  const EK = 'wmak-2026' as const;
  f.state.set(`${EK}:tickets`, { mode: 'open' });
  f.seats.push({ id: 'a', eventKey: EK, nameKey: '강문주', name: '강문주', tableNo: 7, seatNo: 1 });
  const svc = liveSvc(f.prisma);
  await svc.editSeats(EK, { op: 'rename', nameKey: '강문주', name: '장현준' });
  await svc.editSeats(EK, { op: 'rename', nameKey: '장현준', name: '장현중' });
  await svc.editSeats(EK, { op: 'add', name: '장현준', table: 3, seat: 2 });
  const p1 = await svc.guest(EK, 'P1', '강문주');
  assert.deepEqual([p1.name, p1.seat], ['장현중', { table: 7, seat: 1 }]);
  // 새로 넣은 장현준 분 폰은 그대로 자기 자리
  assert.deepEqual((await svc.guest(EK, 'P2', '장현준')).seat, { table: 3, seat: 2 });

  // 고친 이름(장현중)이 옮긴 뒤 다른 분과 같은 이름이 됨 — 기록 테이블(7)에 앉은 남의 줄로 보내지 않는다
  await svc.editSeats(EK, { op: 'move', nameKey: '장현중', table: 4, seat: 1 });
  await svc.editSeats(EK, { op: 'add', name: '장현중', table: 7, seat: 1 });
  const p3 = await svc.guest(EK, 'P3', '강문주');
  assert.deepEqual([p3.name, p3.seat, p3.sameName?.map((x) => x.table)], ['장현중', { table: 4, seat: 1 }, [4, 7]]);
  // 그 사람 폰에 응모권이 있으면(옛 이름으로 받아 이름을 따라 옮겨 감) 그 줄
  const g = fakeSeatPrisma();
  g.state.set(`${EK}:tickets`, { mode: 'open' });
  g.seats.push({ id: 'a', eventKey: EK, nameKey: '강문주', name: '강문주', tableNo: 7, seatNo: 1 });
  const svc2 = liveSvc(g.prisma);
  assert.equal((await svc2.guest(EK, 'P1', '강문주')).ticket?.number, 1);
  await svc2.editSeats(EK, { op: 'rename', nameKey: '강문주', name: '장현중' });
  await svc2.editSeats(EK, { op: 'move', nameKey: '장현중', table: 4, seat: 1 });
  await svc2.editSeats(EK, { op: 'add', name: '장현중', table: 7, seat: 1 });
  const own = await svc2.guest(EK, 'P1', '강문주');
  assert.deepEqual([own.name, own.seat, own.ticket?.number], ['장현중', { table: 4, seat: 1 }, 1]);
});

test('이름 고친 기록 — 남은 쌍둥이(응모권 있음)가 옮겨진 뒤 다른 쌍둥이가 그 옛 테이블로 와서 이름을 고쳐도 남은 쌍둥이 폰은 자기 자리 · 응모권 그대로', async () => {
  for (const how of ['옮김', '추가'] as const) {
    const f = fakeSeatPrisma();
    const EK = 'wmak-2026' as const;
    f.state.set(`${EK}:tickets`, { mode: 'open' });
    f.seats.push(
      { id: 'p', eventKey: EK, nameKey: '김현우 @5', name: '김현우', tableNo: 5, seatNo: 1 },
      { id: 'q', eventKey: EK, nameKey: '김현우 @7', name: '김현우', tableNo: 7, seatNo: 2 },
    );
    const svc = liveSvc(f.prisma);
    assert.equal((await svc.guest(EK, 'DP', '김현우', 5, 'userP')).ticket?.number, 1);
    await svc.editSeats(EK, { op: 'move', nameKey: '김현우 @5', table: 3, seat: 1 });
    if (how === '옮김') {
      await svc.editSeats(EK, { op: 'move', nameKey: '김현우 @7', table: 5, seat: 4 });
      await svc.editSeats(EK, { op: 'rename', nameKey: '김현우 @5', name: '김현수' });
    } else {
      await svc.editSeats(EK, { op: 'add', name: '김현우', table: 5, seat: 4 });
      await svc.editSeats(EK, { op: 'rename', nameKey: '김현우 @5', name: '김현수' });
    }
    const p = await svc.guest(EK, 'DP', '김현우', 5, 'userP');
    assert.deepEqual([p.name, p.renamedFrom, p.seat, p.ticket?.number], ['김현우', undefined, { table: 3, seat: 1 }, 1], how);
    // 고친 분(김현수)이 자기 폰으로 와도 P 의 계정이 붙지 않는다
    const q = await svc.guest(EK, 'DQ', '김현수');
    assert.deepEqual([q.seat, q.ticket?.number], [{ table: 5, seat: 4 }, 2], how);
    assert.equal(f.tickets.find((t) => t.number === 2)?.userId ?? null, null, how);
  }
});

test('이름 기록 합치기 · 따라가기(순수) — 같은 옛 이름 갈음 · 새로 생긴 옛 이름 줄 · 빠진 줄은 버림 · 줄 id 로 지금 이름 · 되돌린 줄은 안 이음', () => {
  const at = 't';
  const n = (from: string, rowId: string, name: string, table: number, dup = false) => ({ from, rowId, name, table, dup, at });
  assert.deepEqual(mergeRenames([n('a', 'r1', 'b', 1)], n('a', 'r2', 'c', 2), []), [n('a', 'r2', 'c', 2)]);
  assert.deepEqual(mergeRenames([n('a', 'r1', 'b', 1), n('b', 'r1', 'c', 1)], null, [{ name: 'b', tableNo: 3 }]), [n('a', 'r1', 'b', 1)]);
  assert.deepEqual(mergeRenames([n('a', 'r1', 'b', 1, true)], null, [{ name: 'a', tableNo: 4 }]), [n('a', 'r1', 'b', 1, true)]);
  assert.deepEqual(mergeRenames([n('a', 'r1', 'b', 1, true)], null, [{ name: 'a', tableNo: 1 }]), []);
  assert.deepEqual(mergeRenames([n('a', 'r1', 'b', 1), n('x', 'r2', 'y', 2)], null, [], ['r1']), [n('x', 'r2', 'y', 2)]);
  const now = new Map([['r1', { name: '다', tableNo: 9 }], ['r3', { name: '가', tableNo: 4 }]]);
  const rowsOf = (k: string) => [...now.values()].filter((r) => r.name === k);
  // A→B→다(같은 줄 r1) — 한 번에 지금 이름 · 지금 테이블
  assert.deepEqual(followRename([n('가2', 'r1', '나', 1)], '가2', null, rowsOf, (id) => now.get(id)), { name: '다', table: 9 });
  // 줄이 빠졌으면 null · 그 줄이 옛 이름으로 되돌아갔으면 null
  assert.equal(followRename([n('가2', 'r9', '나', 1)], '가2', null, rowsOf, (id) => now.get(id)), null);
  assert.equal(followRename([n('가', 'r3', '나', 4)], '가', null, () => [], (id) => now.get(id)), null);
  // 고른 테이블이 있는데 어느 기록과도 안 맞고 동명이인 기록이 있으면 짐작 안 함
  const twins = [n('김', 'r1', '다', 12, true), n('김', 'r3', '가', 2)];
  assert.equal(followRename(twins, '김', 7, () => [], (id) => now.get(id)), null);
  assert.deepEqual(followRename(twins, '김', 12, () => [], (id) => now.get(id)), { name: '다', table: 9 });
  assert.deepEqual(followRename(twins, '김', null, () => [], (id) => now.get(id)), { name: '가', table: 4 });
  assert.deepEqual(followRename(twins, '김', null, () => [], (id) => now.get(id), new Set(['다'])), { name: '다', table: 9 });
});

test('바뀜 신호(pulse) — 명단이 그대로면 같은 지문 · 옮기기 · 이름 고치기 · 추가마다 바뀜 · 줄 순서와 무관', async () => {
  const f = fakeSeatPrisma();
  const EK = 'wmak-2026' as const;
  f.seats.push(
    { id: 'a', eventKey: EK, nameKey: '김솔', name: '김솔', tableNo: 1, seatNo: 1 },
    { id: 'b', eventKey: EK, nameKey: '이연주', name: '이연주', tableNo: 6, seatNo: 7 },
  );
  const svc = liveSvc(f.prisma);
  const v0 = (await svc.pulse(EK)).v;
  assert.match(v0, /^[\w-]{16}$/);
  f.seats.reverse();
  (svc as any).seatCache.clear();
  assert.equal((await svc.pulse(EK)).v, v0);
  const seen = new Set([v0]);
  for (const op of [
    { op: 'move', nameKey: '김솔', table: 2, seat: 1 },
    { op: 'rename', nameKey: '이연주', name: '이연지' },
    { op: 'add', name: '박하나', table: 3, seat: null },
  ]) {
    await svc.editSeats(EK, op);
    const v = (await svc.pulse(EK)).v;
    assert.equal(seen.has(v), false, `${op.op} 뒤 지문이 그대로`);
    seen.add(v);
  }
});

test('동명이인 중 도착한 줄은 이름 고치기 · 빼기 거절 — 안 온 줄 · 옮기기 · 띄어쓰기만 · 동명이인 아닌 줄은 그대로', () => {
  const tickets = [{ id: 't2', nameKey: '김현우 @2', name: '김현우' }];
  const tr = ticketRowOf(BASE, tickets);
  assert.equal(sameNameArrivedBlock(BASE, { op: 'rename', nameKey: '김현우 @2', name: '김현수' }, tr), SAME_NAME_ARRIVED);
  assert.equal(sameNameArrivedBlock(BASE, { op: 'remove', nameKey: '김현우 @2' }, tr), SAME_NAME_ARRIVED);
  // 짝(12번)은 아직 안 옴 — 고치거나 빼도 2번 사람 폰은 자기 줄 그대로
  assert.equal(sameNameArrivedBlock(BASE, { op: 'rename', nameKey: '김현우 @12', name: '김현오' }, tr), null);
  assert.equal(sameNameArrivedBlock(BASE, { op: 'remove', nameKey: '김현우 @12' }, tr), null);
  // 옮기기 · 띄어쓰기만 · 동명이인 아닌 줄
  assert.equal(sameNameArrivedBlock(BASE, { op: 'move', nameKey: '김현우 @2', table: 5, seat: 1 }, tr), null);
  assert.equal(sameNameArrivedBlock(BASE, { op: 'rename', nameKey: '김현우 @2', name: '김 현우' }, tr), null);
  const solTr = ticketRowOf(BASE, [{ id: 't1', nameKey: '김솔', name: '김솔' }]);
  assert.equal(sameNameArrivedBlock(BASE, { op: 'rename', nameKey: '김솔', name: '김솔비' }, solTr), null);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { baseNameKey, nameKey, parseSeatRows } from './reception.rules';
import { byTableSeatName, type SeatList, type SeatRow } from './reception-live.service';
import { ReceptionPeopleService, buildPeople, quizRowAt, type PeopleInput, type PeopleTicket } from './reception-people.service';

/* 참여자 판(261122 사장 '참여자는 자리를 준 명단 전부 · 앱에 이름을 넣으면 실시간으로 맨 위') — 사람 합치기 규칙 시험 */

const D1 = '11111111-1111-4111-8111-111111111111';
const D2 = '22222222-2222-4222-8222-222222222222';
const D3 = '33333333-3333-4333-8333-333333333333';
const D4 = '44444444-4444-4444-8444-444444444444';
const D5 = '55555555-5555-4555-8555-555555555555';
/** 이름이 어디에도 없는 기기 */
const D9 = '99999999-9999-4999-8999-999999999999';

const T0 = Date.parse('2026-11-23T17:30:00+09:00');
const at = (min: number) => new Date(T0 + min * 60_000);

/** 명단 붙여넣기와 같은 규칙(parseSeatRows — 동명이인 열쇠 '이름 @테이블')으로 SeatList 를 만든다(ReceptionLiveService.seats 와 같은 모양) */
function seatList(rows: Array<[name: string, table: number, seat?: number]>): SeatList {
  const parsed = parseSeatRows(rows.map(([name, table, seat]) => ({ name, table, seat: seat ?? null })));
  if (typeof parsed === 'string') throw new Error(parsed);
  const list: SeatRow[] = parsed.map((r) => ({ nameKey: r.nameKey, name: r.name, tableNo: r.table, seatNo: r.seat }));
  list.sort(byTableSeatName);
  const byName = new Map<string, SeatRow[]>();
  for (const r of list) {
    const k = baseNameKey(r.nameKey);
    byName.set(k, [...(byName.get(k) || []), r]);
  }
  return { rows: list, byKey: new Map(list.map((r) => [r.nameKey, r])), byName };
}

let seq = 0;
function ticket(name: string, deviceId: string, min: number, extra: Partial<PeopleTicket> = {}): PeopleTicket {
  seq += 1;
  return { id: `t${seq}`, number: seq, nameKey: nameKey(name), name, deviceId, createdAt: at(min), lastSeenAt: at(min), win: null, ...extra };
}

function input(over: Partial<PeopleInput>): PeopleInput {
  return { seats: seatList([]), tickets: [], guests: [], photos: [], photoVotes: [], voterVotes: [], surveys: [], quiz: [], ...over };
}

const byKey = (rows: ReturnType<typeof buildPeople>) => new Map(rows.map((r) => [r.key, r]));

test('참여자 — 명단 전원이 나오고(안 온 사람도) · 명단 밖은 응모권이 있을 때만(이름만 넣은 시험 기기는 뺌)', () => {
  seq = 0;
  const seats = seatList([['김솔', 2, 1], ['이하나', 1, 3], ['박민', 1, 1]]);
  const rows = buildPeople(input({
    seats,
    tickets: [ticket('김 솔', D1, 5), ticket('외부손님', D2, 7)],
    guests: [
      { deviceId: D1, name: '김 솔', lastSeenAt: at(9) },
      { deviceId: D2, name: '외부손님', lastSeenAt: at(8) },
      { deviceId: D3, name: '테스트', lastSeenAt: at(1) },
    ],
  }));
  // 명단 순서(테이블 → 좌석) 다음 명단 밖(응모권 번호 → 이름) — 응모권 없는 '테스트' 기기는 판에 없다
  assert.deepEqual(rows.map((r) => r.name), ['박민', '이하나', '김솔', '외부손님']);
  const m = byKey(rows);
  const sol = m.get('김솔')!;
  assert.equal(sol.listed, true);
  assert.equal(sol.table, 2);
  assert.equal(sol.seat, 1);
  assert.equal(sol.arrivedAt, at(5).toISOString());
  assert.deepEqual(sol.ticket, { id: 't1', number: 1 });
  assert.equal(sol.devices, 1);
  assert.equal(sol.lastSeenAt, at(9).toISOString());
  const miss = m.get('이하나')!;
  assert.equal(miss.arrivedAt, null);
  assert.equal(miss.ticket, null);
  assert.equal(miss.devices, 0);
  const walk = m.get('x:외부손님')!;
  assert.equal(walk.listed, false);
  assert.equal(walk.table, null);
  assert.deepEqual(walk.ticket, { id: 't2', number: 2 });
  assert.equal(walk.devices, 1);
  assert.equal(m.has('x:테스트'), false);
});

test('참여자 — 명단 밖 기기는 같은 이름 응모권 사람에 합치고, 응모권 없는 명단 밖 이름(사진 · 설문 · 퀴즈만)은 판에 안 나온다', () => {
  seq = 0;
  const seats = seatList([['김솔', 1, 1]]);
  const tWalk = ticket('외부 손님', D1, 3);
  const rows = buildPeople(input({
    seats,
    tickets: [tWalk],
    guests: [
      { deviceId: D1, name: '외부손님', lastSeenAt: at(4) },
      { deviceId: D2, name: '외부손님', lastSeenAt: at(9) }, // 같은 walk-in 의 두 번째 폰
      { deviceId: D3, name: 'ㅇㅇ', lastSeenAt: at(1) },
    ],
    photos: [{ id: 'p1', deviceId: D4, name: 'test1', thumbUrl: 't', imageUrl: 'i', createdAt: at(2) }],
    surveys: [{ deviceId: D5, name: '설문만', updatedAt: at(2) }],
    quiz: [{ deviceId: D2, name: '외부손님', updatedAt: at(20) }],
  }));
  assert.deepEqual(rows.map((r) => r.key), ['김솔', 'x:외부손님']);
  const walk = rows[1];
  assert.equal(walk.devices, 2);
  assert.equal(walk.lastSeenAt, at(9).toISOString());
  assert.equal(walk.quizAt, at(20).toISOString());
  assert.equal(walk.arrivedAt, at(3).toISOString());
});

test('참여자 — 퀴즈 시각은 손님이 낸 때(어드민 O/X 판정으로 밀린 updatedAt 은 안 씀)', () => {
  // 판정 없음 = updatedAt(다시 내면 새 시각) · 판정 있음 = createdAt · createdAt 이 없으면 updatedAt
  assert.equal(quizRowAt({ deviceId: D1, name: '가', createdAt: at(1), updatedAt: at(5), correct: null }).getTime(), at(5).getTime());
  assert.equal(quizRowAt({ deviceId: D1, name: '가', createdAt: at(1), updatedAt: at(40), correct: true }).getTime(), at(1).getTime());
  assert.equal(quizRowAt({ deviceId: D1, name: '가', createdAt: at(1), updatedAt: at(40), correct: false }).getTime(), at(1).getTime());
  assert.equal(quizRowAt({ deviceId: D1, name: '가', updatedAt: at(7), correct: true }).getTime(), at(7).getTime());

  seq = 0;
  const seats = seatList([['가나', 5, 1]]);
  const t = ticket('가나', D1, 0);
  const base = { seats, tickets: [t], guests: [{ deviceId: D1, name: '가나', lastSeenAt: at(1) }] };
  // 19:52 에 낸 주관식 답 — 운영자가 20:10 에 O 를 매겨 updatedAt 이 20:10 으로 밀려도 quizAt 은 19:52 그대로
  const before = buildPeople(input({ ...base, quiz: [{ deviceId: D1, name: '가나', createdAt: at(142), updatedAt: at(142), correct: null }] }));
  const after = buildPeople(input({ ...base, quiz: [{ deviceId: D1, name: '가나', createdAt: at(142), updatedAt: at(160), correct: true }] }));
  assert.equal(before[0].quizAt, at(142).toISOString());
  assert.equal(after[0].quizAt, at(142).toISOString());
  assert.equal(after[0].quizCount, 1);
});

test('참여자 — 동명이인(이름 @테이블) 응모권은 제 줄에 · 기기는 제 응모권 줄로 · 못 가르면 첫 줄', () => {
  seq = 0;
  const seats = seatList([['김현우', 2, 1], ['김현우', 12, 4], ['오지', 3]]);
  assert.deepEqual(seats.rows.filter((r) => r.name === '김현우').map((r) => r.nameKey), ['김현우 @2', '김현우 @12']);
  const t12 = ticket('김현우', D1, 3, { nameKey: '김현우 @12' });
  const rows = buildPeople(input({
    seats,
    tickets: [t12],
    guests: [
      { deviceId: D1, name: '김현우', lastSeenAt: at(4) }, // 12번 응모권을 받은 폰
      { deviceId: D2, name: '김현우', lastSeenAt: at(6) }, // 아직 테이블을 안 고른 다른 김현우
    ],
    quiz: [
      { deviceId: D1, name: '김현우', updatedAt: at(10) },
      { deviceId: D2, name: '김현우', updatedAt: at(11) },
    ],
  }));
  const m = byKey(rows);
  const k12 = m.get('김현우 @12')!;
  const k2 = m.get('김현우 @2')!;
  assert.equal(k12.table, 12);
  assert.equal(k12.seat, 4);
  assert.deepEqual(k12.ticket, { id: t12.id, number: t12.number });
  assert.equal(k12.devices, 1);
  assert.equal(k12.quizAt, at(10).toISOString());
  // 응모권 없는 김현우 기기는 명단 첫 줄(테이블 순 = 2번)로
  assert.equal(k2.ticket, null);
  assert.equal(k2.devices, 1);
  assert.equal(k2.quizCount, 1);
  assert.equal(k2.quizAt, at(11).toISOString());
  assert.equal(rows.filter((r) => !r.listed).length, 0);
});

test('참여자 — 명단을 고쳐 열쇠가 어긋난 응모권도 이름 하나뿐이면 그 줄에 · 같은 사람 두 번째 폰도 같은 줄', () => {
  seq = 0;
  // 응모권은 동명이인 열쇠로 받았는데 명단에서 다른 김현우가 빠짐 → 이제 이름이 하나뿐
  const seats = seatList([['김현우', 5, 2]]);
  const t = ticket('김현우', D1, 2, { nameKey: '김현우 @12' });
  const rows = buildPeople(input({
    seats,
    tickets: [t],
    guests: [
      { deviceId: D1, name: '김현우', lastSeenAt: at(3) },
      { deviceId: D2, name: '김 현우', lastSeenAt: at(20) }, // 같은 사람 태블릿/두 번째 폰
    ],
  }));
  assert.equal(rows.length, 1);
  assert.equal(rows[0].key, '김현우');
  assert.deepEqual(rows[0].ticket, { id: t.id, number: t.number });
  assert.equal(rows[0].devices, 2);
  assert.equal(rows[0].lastSeenAt, at(20).toISOString());
});

test('참여자 — 손님 표가 없어도 사진 · 설문 · 퀴즈 이름으로 사람을 찾는다(손님 표 이름이 먼저)', () => {
  seq = 0;
  const seats = seatList([['가나', 1, 1], ['다라', 1, 2], ['마바', 2, 1], ['사아', 2, 2]]);
  const rows = buildPeople(input({
    seats,
    guests: [{ deviceId: D4, name: '사아', lastSeenAt: at(1) }],
    photos: [{ id: 'p1', deviceId: D1, name: '가나', thumbUrl: 'th1', imageUrl: 'im1', createdAt: at(30) }],
    surveys: [
      { deviceId: D2, name: '다라', updatedAt: at(40) },
      { deviceId: D4, name: '옛이름', updatedAt: at(41) }, // 손님 표 이름(사아)이 이긴다
    ],
    quiz: [{ deviceId: D3, name: '마바', updatedAt: at(50) }],
  }));
  const m = byKey(rows);
  assert.equal(m.get('가나')!.photo?.thumbUrl, 'th1');
  assert.equal(m.get('가나')!.devices, 1);
  assert.equal(m.get('다라')!.surveyAt, at(40).toISOString());
  assert.equal(m.get('마바')!.quizAt, at(50).toISOString());
  assert.equal(m.get('마바')!.quizCount, 1);
  assert.equal(m.get('사아')!.surveyAt, at(41).toISOString());
  assert.equal(m.has('x:옛이름'), false);
});

test('참여자 — 당첨 · 사진 순위 · 누른 수 · 설문 모으기 · 한 사람 여러 기기', () => {
  seq = 0;
  const seats = seatList([['홍길동', 1, 1], ['최수', 1, 2], ['윤해', 2, 1]]);
  const tHong = ticket('홍길동', D1, 1, { win: { prize: '횡성한우세트', at: at(170) } });
  const tChoi = ticket('최수', D3, 2);
  const rows = buildPeople(input({
    seats,
    tickets: [tHong, tChoi],
    guests: [
      { deviceId: D1, name: '홍길동', lastSeenAt: at(100) },
      { deviceId: D2, name: '홍길동', lastSeenAt: at(120) }, // 홍길동 두 번째 기기
      { deviceId: D3, name: '최수', lastSeenAt: at(90) },
      { deviceId: D5, name: '윤해', lastSeenAt: at(10) },
    ],
    photos: [
      { id: 'pa', deviceId: D1, name: '홍길동', thumbUrl: 'a', imageUrl: 'A', createdAt: at(60) },
      { id: 'pb', deviceId: D2, name: '홍길동', thumbUrl: 'b', imageUrl: 'B', createdAt: at(61) },
      { id: 'pc', deviceId: D3, name: '최수', thumbUrl: 'c', imageUrl: 'C', createdAt: at(62) },
    ],
    // 순위 = 공감 → 좋아요 → 먼저 올린 순: pc(공감 3) 1위 · pb(공감 1, 좋아요 5) 2위 · pa(공감 1, 좋아요 1) 3위
    photoVotes: [
      { photoId: 'pa', kind: 'empathy', count: 1 },
      { photoId: 'pa', kind: 'like', count: 1 },
      { photoId: 'pb', kind: 'empathy', count: 1 },
      { photoId: 'pb', kind: 'like', count: 5 },
      { photoId: 'pc', kind: 'empathy', count: 3 },
    ],
    voterVotes: [
      { deviceId: D1, kind: 'like', count: 3, lastAt: at(70) },
      { deviceId: D2, kind: 'like', count: 2, lastAt: at(80) },
      { deviceId: D2, kind: 'empathy', count: 4, lastAt: at(75) },
      { deviceId: D5, kind: 'empathy', count: 1, lastAt: at(5) },
    ],
    surveys: [
      { deviceId: D1, name: '홍길동', updatedAt: at(150) },
      { deviceId: D2, name: '홍길동', updatedAt: at(160) },
    ],
    quiz: [
      { deviceId: D1, name: '홍길동', updatedAt: at(130) },
      { deviceId: D2, name: '홍길동', updatedAt: at(140) },
    ],
  }));
  const m = byKey(rows);
  const hong = m.get('홍길동')!;
  assert.equal(hong.devices, 2);
  assert.equal(hong.lastSeenAt, at(120).toISOString());
  assert.deepEqual(hong.win, { prize: '횡성한우세트', at: at(170).toISOString() });
  // 두 기기 사진 중 순위 높은 것(pb 2위)
  assert.deepEqual(hong.photo, { thumbUrl: 'b', imageUrl: 'B', rank: 2, likes: 5, empathies: 1, at: at(61).toISOString() });
  assert.equal(hong.likesUsed, 5);
  assert.equal(hong.empathiesUsed, 4);
  assert.equal(hong.votedAt, at(80).toISOString());
  assert.equal(hong.surveyAt, at(160).toISOString());
  assert.equal(hong.quizCount, 2);
  assert.equal(hong.quizAt, at(140).toISOString());
  const choi = m.get('최수')!;
  assert.equal(choi.photo?.rank, 1);
  assert.equal(choi.win, null);
  assert.equal(choi.likesUsed, 0);
  assert.equal(choi.votedAt, null);
  // 안 온 사람(응모권 없음)도 한 일은 그대로 보인다 — 태그·순서는 웹이 도착 뒤 활동만 센다
  const yoon = m.get('윤해')!;
  assert.equal(yoon.arrivedAt, null);
  assert.equal(yoon.empathiesUsed, 1);
  assert.equal(yoon.votedAt, at(5).toISOString());
});

test('참여자 — 이름을 바꾼 기기는 새 이름 사람으로(응모권은 받은 이름에 남음) · 이름 없는 기기는 버림', () => {
  seq = 0;
  const seats = seatList([['정우', 4, 1], ['정우성', 4, 2]]);
  const t = ticket('정우', D1, 1);
  const rows = buildPeople(input({
    seats,
    tickets: [t],
    guests: [{ deviceId: D1, name: '정우성', lastSeenAt: at(30) }],
    voterVotes: [{ deviceId: D9, kind: 'like', count: 2, lastAt: at(3) }],
  }));
  const m = byKey(rows);
  assert.deepEqual(m.get('정우')!.ticket, { id: t.id, number: t.number });
  assert.equal(m.get('정우')!.devices, 0);
  assert.equal(m.get('정우성')!.devices, 1);
  assert.equal(m.get('정우성')!.ticket, null);
  assert.equal(rows.length, 2);
  assert.equal(rows.every((r) => r.likesUsed === 0), true);
});

/** 가짜 prisma — 서비스가 조회를 모아 buildPeople 에 넘기고 1초 묶음 · fresh 를 지키는지 */
function fakeDeps() {
  let calls = 0;
  const seats = seatList([['김솔', 2, 1]]);
  const prisma: any = {
    receptionState: {
      findMany: async () => [
        { key: 'tickets', value: { mode: 'open' } },
        { key: 'ticket-blocks', value: { list: [{ nameKey: 'a', name: '가', at: '2026-11-23T08:00:00.000Z' }, { nameKey: 'b', name: '나', at: '2026-11-23T09:00:00.000Z' }] } },
        { key: 'quiz', value: { currentId: 'r3q3', phase: 'open', revealed: ['r1q1'] } },
      ],
    },
    receptionTicket: {
      findMany: async () => {
        calls += 1;
        return [{ id: 't1', number: 1, nameKey: '김솔', name: '김솔', deviceId: D1, createdAt: at(1), lastSeenAt: at(2), draws: [{ prize: '체스타필드 정장 세트', createdAt: at(3) }] }];
      },
    },
    receptionGuest: { findMany: async () => [{ deviceId: D1, name: '김솔', lastSeenAt: at(4), afterParty: 'yes', afterPartyAt: at(11) }] },
    receptionPhoto: { findMany: async () => [] },
    receptionVote: {
      groupBy: async ({ by }: any) => (by[0] === 'voterDeviceId' ? [{ voterDeviceId: D1, kind: 'like', _count: { _all: 2 }, _max: { createdAt: at(5) } }] : []),
    },
    receptionSurvey: { findMany: async () => [] },
    receptionQuizAnswer: {
      findMany: async ({ select }: any) => {
        // 판정 · 처음 낸 때도 같이 고르는지(quizRowAt) — 판정이 붙은 줄은 createdAt 이 퀴즈 시각
        assert.equal(select.correct, true);
        assert.equal(select.createdAt, true);
        assert.equal(select.questionId && select.tableNo && select.answer && select.id, true);
        return [
          { id: 'a1', questionId: 'r1q1', tableNo: 2, answer: 'freetiful', deviceId: D1, name: '김솔', correct: true, createdAt: at(6), updatedAt: at(30) },
          { id: 'a2', questionId: 'r3q3', tableNo: 2, answer: '도전', deviceId: D1, name: '김솔', correct: true, createdAt: at(7), updatedAt: at(40) },
          // 운영팀이 넣은 답(기기 없음) — 사람엔 안 붙고 점수판엔 들어감
          { id: 'a3', questionId: 'r1q1', tableNo: 5, answer: 'freetiful', deviceId: null, name: '운영팀', correct: null, createdAt: at(8), updatedAt: at(8) },
        ];
      },
    },
  };
  const live: any = { seatList: async () => seats };
  return { svc: new ReceptionPeopleService(prisma, live), calls: () => calls };
}

test('참여자 판 서비스 — 발급 모드 · 지운 이름(최근 위) · 사람 · 1초 묶음 · fresh 는 다시 읽음', async () => {
  const { svc, calls } = fakeDeps();
  const [a, b] = await Promise.all([svc.people('wmak-2026'), svc.people('wmak-2026')]);
  assert.equal(calls(), 1);
  assert.equal(a, b);
  assert.equal(a.ticketsMode, 'open');
  assert.equal(a.ticketsOpen, true);
  assert.deepEqual(a.blocked.map((x) => x.name), ['나', '가']);
  assert.equal(a.people.length, 1);
  const p = a.people[0];
  assert.deepEqual(p.win, { prize: '체스타필드 정장 세트', at: at(3).toISOString() });
  assert.equal(p.likesUsed, 2);
  assert.equal(p.votedAt, at(5).toISOString());
  assert.equal(p.quizAt, at(6).toISOString()); // 미션 도전 줄은 퀴즈 수 · 시각에 안 섞임
  assert.equal(p.quizCount, 1);
  assert.deepEqual(p.challenges, [{ id: 'a2', questionId: 'r3q3', title: '스페셜 미션 · 타이밍을 지배하라!', table: 2, points: 300, result: 'success', at: at(7).toISOString() }]);
  assert.equal(p.lastSeenAt, at(4).toISOString());
  assert.deepEqual(p.afterParty, { going: 'yes', at: at(11).toISOString() });
  // 테이블 점수 = 공개된 r1q1(100) + 미션 성공(300)
  assert.deepEqual(a.quizScores.slice(0, 2).map((b) => [b.table, b.score]), [[2, 400], [5, 100]]);
  await svc.people('wmak-2026');
  assert.equal(calls(), 1);
  await svc.people('wmak-2026', true);
  assert.equal(calls(), 2);
});

test('참여자 — 미션 도전 줄은 challenges 로(대기 · 실패 · 시각 = 도전한 때) · 퀴즈 수에 안 셈 · 테이블 친구 도전은 그 사람에게만', () => {
  seq = 0;
  const seats = seatList([['김솔', 2, 1], ['이하나', 2, 2]]);
  const rows = buildPeople(input({
    seats,
    tickets: [ticket('김솔', D1, 1), ticket('이하나', D2, 2)],
    guests: [{ deviceId: D1, name: '김솔', lastSeenAt: at(3) }, { deviceId: D2, name: '이하나', lastSeenAt: at(3) }],
    quiz: [
      { id: 'q1', questionId: 'r1q2', tableNo: 2, answer: 'O', deviceId: D2, name: '이하나', correct: null, createdAt: at(4), updatedAt: at(4) },
      { id: 'm1', questionId: 'r3q3', tableNo: 2, answer: '도전', deviceId: D1, name: '김솔', correct: null, createdAt: at(5), updatedAt: at(9) },
      // 미션인데 answer 가 '도전'이 아닌 줄(옛 데이터) — 보통 퀴즈 줄로
      { id: 'm2', questionId: 'r1q3', tableNo: 2, answer: '도전', deviceId: D1, name: '김솔', correct: null, createdAt: at(6), updatedAt: at(6) },
    ],
  }));
  const m = byKey(rows);
  const kim = m.get(nameKey('김솔'))!;
  assert.equal(kim.challenges.length, 1);
  assert.deepEqual(kim.challenges[0], { id: 'm1', questionId: 'r3q3', title: '스페셜 미션 · 타이밍을 지배하라!', table: 2, points: 300, result: 'pending', at: at(5).toISOString() });
  assert.equal(kim.quizCount, 1); // r1q3 줄만(미션 아님)
  const lee = m.get(nameKey('이하나'))!;
  assert.deepEqual(lee.challenges, []);
  assert.equal(lee.quizCount, 1);
  const failed = buildPeople(input({
    seats,
    tickets: [ticket('김솔', D1, 1)],
    guests: [{ deviceId: D1, name: '김솔', lastSeenAt: at(3) }],
    quiz: [{ id: 'm1', questionId: 'r3q3', tableNo: 2, answer: '도전', deviceId: D1, name: '김솔', correct: false, createdAt: at(5), updatedAt: at(9) }],
  }));
  const k2 = byKey(failed).get(nameKey('김솔'))!;
  assert.equal(k2.challenges[0].result, 'fail');
  assert.equal(k2.challenges[0].at, at(5).toISOString()); // 판정(updatedAt 9분)으로 밀리지 않음
  assert.equal(k2.quizAt, null);
});

test('참여자 — 2차 회식(손님 표 afterParty) · 기기 여럿이면 마지막에 고른 값 · 안 골랐으면 null', () => {
  seq = 0;
  const seats = seatList([['김솔', 2, 1], ['이하나', 2, 2]]);
  const rows = buildPeople(input({
    seats,
    tickets: [ticket('김솔', D1, 1)],
    guests: [
      { deviceId: D1, name: '김솔', lastSeenAt: at(3), afterParty: 'yes', afterPartyAt: at(5) },
      { deviceId: D2, name: '김솔', lastSeenAt: at(3), afterParty: 'no', afterPartyAt: at(9) },
      { deviceId: D3, name: '이하나', lastSeenAt: at(3), afterParty: null, afterPartyAt: null },
    ],
  }));
  const m = byKey(rows);
  assert.deepEqual(m.get(nameKey('김솔'))!.afterParty, { going: 'no', at: at(9).toISOString() });
  assert.equal(m.get(nameKey('이하나'))!.afterParty, null);
});

test('참여자 — 어드민이 이름을 고친 뒤(응모권은 새 이름 줄로) 옛 이름이 남은 폰의 기록은 새 이름 줄에 붙고 유령 줄이 안 생김', () => {
  seq = 0;
  const seats = seatList([['김솔비', 3, 8], ['이하나', 2, 2]]);
  const rows = buildPeople(input({
    seats,
    tickets: [ticket('김솔비', D1, 1)],
    guests: [
      { deviceId: D1, name: '김솔', lastSeenAt: at(4), afterParty: 'yes', afterPartyAt: at(6) },
      // 응모권이 없는 다른 폰이 명단에 없는 이름이면 예전처럼 명단 밖(응모권 없으니 판엔 안 남음)
      { deviceId: D2, name: '방문객', lastSeenAt: at(4) },
    ],
    surveys: [{ deviceId: D1, name: '김솔', updatedAt: at(7) }],
  }));
  const m = byKey(rows);
  const p = m.get(nameKey('김솔비'))!;
  assert.equal(p.ticket?.number, 1);
  assert.equal(p.devices, 1);
  assert.deepEqual(p.afterParty, { going: 'yes', at: at(6).toISOString() });
  assert.ok(p.surveyAt);
  assert.equal(rows.some((r) => r.key === `x:${nameKey('김솔')}`), false);
  assert.equal(rows.some((r) => !r.listed), false);
});

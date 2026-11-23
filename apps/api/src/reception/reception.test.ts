import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Prisma } from '@prisma/client';
import {
  SEAT_ROWS_MAX,
  TICKETS_AUTO_FROM,
  TICKETS_AUTO_UNTIL,
  VOTE_LIMIT,
  baseNameKey,
  cleanName,
  cleanPrize,
  DRAW_PRIZES,
  compareRank,
  nameKey,
  parseDeviceId,
  parseSeatRows,
  parseSurvey,
  parseTableNo,
  sameNameKey,
  ticketsOpen,
} from './reception.rules';
import {
  QUIZ_QUESTIONS,
  applyQuizAction,
  autoCorrect,
  defaultQuizState,
  finalCorrect,
  displayAnswer,
  normalizeQuizText,
  parseQuizAnswer,
  parseQuizState,
  quizAdmin,
  quizBoard,
  quizMine,
  quizPublicShared,
  parseQuizBonus,
  quizQuestion,
  quizBoardIds,
  MISSION_CHALLENGE,
  type QuizAnswerRow,
} from './reception-quiz';
import { ReceptionService } from './reception.service';
import { ReceptionLiveService } from './reception-live.service';
import { ReceptionQuizService } from './reception-quiz.service';

const D1 = '11111111-1111-4111-8111-111111111111';
const D2 = '22222222-2222-4222-8222-222222222222';
const D3 = '33333333-3333-4333-8333-333333333333';

test('규칙 — 기기 id·이름·설문', () => {
  assert.equal(parseDeviceId(D1.toUpperCase()), D1);
  assert.equal(parseDeviceId('abc'), null);
  assert.equal(parseDeviceId(undefined), null);
  assert.equal(cleanName('  김  지현 '), '김 지현');
  assert.equal(cleanName(''), null);
  assert.equal(cleanName('가'.repeat(21)), null);
  assert.equal(typeof parseSurvey({ rating: 0, again: 'yes' }), 'string');
  assert.equal(typeof parseSurvey({ rating: 5, again: 'later' }), 'string');
  assert.deepEqual(parseSurvey({ rating: 4, again: 'maybe', best: ' 베스트드레서 어워즈 ', comment: ' 좋았어요 ' }), {
    rating: 4, again: 'maybe', best: '베스트드레서 어워즈', comment: '좋았어요',
  });
});

test('순위 — 공감 → 좋아요 → 먼저 올린 순', () => {
  const t = (s: number) => new Date(1_700_000_000_000 + s * 1000);
  const rows = [
    { id: 'a', likes: 9, empathies: 1, createdAt: t(1) },
    { id: 'b', likes: 0, empathies: 3, createdAt: t(5) },
    { id: 'c', likes: 2, empathies: 3, createdAt: t(9) },
    { id: 'd', likes: 2, empathies: 3, createdAt: t(2) },
  ];
  assert.deepEqual([...rows].sort(compareRank).map((r) => r.id), ['d', 'c', 'b', 'a']);
});

/** 표 두 개만 흉내 낸 가짜 prisma — 서비스의 상한·본인 사진·지우기 흐름 확인용 */
function fakePrisma() {
  const photos: any[] = [];
  const votes: any[] = [];
  const match = (row: any, where: any = {}) => Object.entries(where).every(([k, v]: [string, any]) => {
    if (v && typeof v === 'object' && 'gt' in v) return row[k] > v.gt;
    return row[k] === v;
  });
  const photoApi = {
    findMany: async ({ where }: any) => photos.filter((p) => match(p, where)).sort((a, b) => b.createdAt - a.createdAt),
    findFirst: async ({ where }: any) => photos.find((p) => match(p, where)) || null,
    count: async ({ where }: any) => photos.filter((p) => match(p, where)).length,
    create: async ({ data }: any) => { const row = { id: `p${photos.length + 1}`, createdAt: new Date(Date.now() + photos.length), deletedAt: null, ...data }; photos.push(row); return row; },
    update: async ({ where, data }: any) => Object.assign(photos.find((p) => p.id === where.id), data),
  };
  const voteApi = {
    findMany: async ({ where }: any) => votes.filter((v) => match(v, where)),
    count: async ({ where }: any) => votes.filter((v) => match(v, where)).length,
    create: async ({ data }: any) => { votes.push({ id: `v${votes.length + 1}`, ...data }); },
    deleteMany: async ({ where }: any) => { for (let i = votes.length - 1; i >= 0; i--) if (match(votes[i], where)) votes.splice(i, 1); },
    groupBy: async ({ where }: any) => {
      const m = new Map<string, any>();
      for (const v of votes.filter((x) => match(x, where))) {
        const k = `${v.photoId}|${v.kind}`;
        const g = m.get(k) || { photoId: v.photoId, kind: v.kind, _count: { _all: 0 } };
        g._count._all++;
        m.set(k, g);
      }
      return [...m.values()];
    },
  };
  const prisma: any = {
    receptionPhoto: photoApi,
    receptionVote: voteApi,
    $transaction: async (arg: any) => (typeof arg === 'function' ? arg({ ...prisma, $executeRaw: async () => 0 }) : Promise.all(arg)),
  };
  return { prisma, photos, votes };
}

function service(prisma: any) {
  return Object.assign(Object.create(ReceptionService.prototype), { prisma, feedCache: new Map(), logger: { warn() {} } }) as ReceptionService;
}

test('투표 — 종류별 10개 상한 · 내 사진 금지 · 지우면 돌려받음', async () => {
  const { prisma, photos } = fakePrisma();
  for (let i = 0; i < VOTE_LIMIT + 1; i++) {
    await prisma.receptionPhoto.create({ data: { eventKey: 'wmak-2026', deviceId: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`, name: `손님${i}`, imageUrl: 'x', thumbUrl: 'x', width: 1, height: 1 } });
  }
  const mine = await prisma.receptionPhoto.create({ data: { eventKey: 'wmak-2026', deviceId: D1, name: '나', imageUrl: 'x', thumbUrl: 'x', width: 1, height: 1 } });
  const svc = service(prisma);

  await assert.rejects(svc.vote('wmak-2026', D1, mine.id, 'empathy', true), /내 사진/);

  for (let i = 0; i < VOTE_LIMIT; i++) await svc.vote('wmak-2026', D1, photos[i].id, 'empathy', true);
  await assert.rejects(svc.vote('wmak-2026', D1, photos[VOTE_LIMIT].id, 'empathy', true), /10개까지/);
  // 좋아요는 따로 10개
  const afterLike = await svc.vote('wmak-2026', D1, photos[VOTE_LIMIT].id, 'like', true);
  assert.equal(afterLike.me.empathiesLeft, 0);
  assert.equal(afterLike.me.likesLeft, VOTE_LIMIT - 1);
  assert.equal(afterLike.me.myPhotoId, mine.id);

  // 같은 사진 두 번 눌러도 1개
  await svc.vote('wmak-2026', D1, photos[VOTE_LIMIT].id, 'like', true);
  // 거두면 다시 쓸 수 있다
  await svc.vote('wmak-2026', D1, photos[0].id, 'empathy', false);
  const again = await svc.vote('wmak-2026', D1, photos[VOTE_LIMIT].id, 'empathy', true);
  assert.equal(again.me.empathiesLeft, 0);
  assert.equal(again.me.likesLeft, VOTE_LIMIT - 1);
  const top = again.photos.find((p) => p.id === photos[VOTE_LIMIT].id)!;
  assert.equal(top.empathies, 1);
  assert.equal(top.likes, 1);
  assert.equal(top.rank, 1); // 공감 1 + 좋아요 1 → 공감 1 인 사진들 중 맨 위
  assert.equal(top.liked && top.empathized, true);

  // 남(D2)이 보면 내 표는 안 보인다
  const other = await svc.feed('wmak-2026', D2);
  assert.equal(other.photos.find((p) => p.id === top.id)!.liked, false);
  assert.equal(other.me.likesLeft, VOTE_LIMIT);

  // 사진 주인이 지우면 그 사진에 준 표가 돌아온다
  const ownerDevice = photos[VOTE_LIMIT].deviceId;
  await assert.rejects(svc.remove('wmak-2026', D1, top.id), /내가 올린/);
  await svc.remove('wmak-2026', ownerDevice, top.id);
  const back = await svc.feed('wmak-2026', D1);
  assert.equal(back.me.likesLeft, VOTE_LIMIT);
  assert.equal(back.me.empathiesLeft, 1);
  assert.equal(back.photos.some((p) => p.id === top.id), false);
});

// ───────────── 2차(261122) — 자리 명단 · 응모권 · 퀴즈 ─────────────

test('이름 열쇠 · 테이블 번호 · 경품 이름', () => {
  assert.equal(nameKey('김 솔'), nameKey('김솔'));
  assert.equal(nameKey(' Kim  Sol '), 'kimsol');
  assert.equal(nameKey('ＫＩＭ'), 'kim'); // 전각도 같게(NFKC)
  assert.equal(parseTableNo(1), 1);
  assert.equal(parseTableNo('18'), 18);
  assert.equal(parseTableNo(' 3 '), 3);
  for (const bad of [0, 19, 20, 1.5, '3번', 'abc', null, undefined, '', [3]]) assert.equal(parseTableNo(bad), null);
  assert.equal(cleanPrize('  횡성한우세트 '), '횡성한우세트');
  assert.equal(cleanPrize(''), null);
  assert.equal(cleanPrize('가'.repeat(41)), null);
});

test('응모권 발급 — 열기·닫기·자동(행사 당일 15:00 ~ 다음 날 03:00 KST) 경계', () => {
  assert.equal(TICKETS_AUTO_FROM, Date.parse('2026-11-23T06:00:00Z'));
  assert.equal(TICKETS_AUTO_UNTIL, Date.parse('2026-11-23T18:00:00Z'));
  assert.equal(ticketsOpen('auto', TICKETS_AUTO_FROM - 1), false);
  assert.equal(ticketsOpen('auto', TICKETS_AUTO_FROM), true);
  assert.equal(ticketsOpen('auto', new Date('2026-11-23T17:30:00+09:00')), true);
  assert.equal(ticketsOpen('auto', TICKETS_AUTO_UNTIL - 1), true);
  assert.equal(ticketsOpen('auto', TICKETS_AUTO_UNTIL), false);
  assert.equal(ticketsOpen('open', new Date('2026-11-22T12:00:00+09:00')), true);
  assert.equal(ticketsOpen('closed', new Date('2026-11-23T18:00:00+09:00')), false);
});

test('자리 명단 검사 — 줄 번호·이유 · 동명이인 · 같은 테이블 겹침 · 최대 줄 수', () => {
  assert.deepEqual(parseSeatRows([
    { name: ' 김  솔 ', table: 3, seat: 2 },
    { name: '이하나', table: '18', seat: '' },
    { name: 'Park', table: 1 },
  ]), [
    { name: '김 솔', nameKey: '김솔', table: 3, seat: 2 },
    { name: '이하나', nameKey: '이하나', table: 18, seat: null },
    { name: 'Park', nameKey: 'park', table: 1, seat: null },
  ]);
  assert.deepEqual(parseSeatRows([]), []);
  assert.match(parseSeatRows('x') as string, /형식/);
  assert.match(parseSeatRows([{ name: '', table: 1 }]) as string, /^1번째 줄 이름/);
  assert.match(parseSeatRows([{ name: '가', table: 1 }, { name: '나', table: 19 }]) as string, /^2번째 줄\(나\) 테이블은 1~18/);
  assert.match(parseSeatRows([{ name: '가', table: 1, seat: 9 }]) as string, /좌석은 1~8/);
  assert.match(parseSeatRows([{ name: '가', table: 1, seat: 0 }]) as string, /좌석/);
  // 다른 테이블의 같은 이름 = 동명이인 — 줄 열쇠에 테이블을 붙인다(이름 열쇠와 겹치지 않게)
  assert.deepEqual(parseSeatRows([{ name: '김 솔', table: 1 }, { name: '김솔', table: 2, seat: 6 }, { name: '박', table: 3 }]), [
    { name: '김 솔', nameKey: '김솔 @1', table: 1, seat: null },
    { name: '김솔', nameKey: '김솔 @2', table: 2, seat: 6 },
    { name: '박', nameKey: '박', table: 3, seat: null },
  ]);
  assert.equal(baseNameKey(sameNameKey(nameKey('김 솔'), 12)), '김솔');
  assert.equal(baseNameKey('김솔'), '김솔');
  // 같은 테이블에 같은 이름 = 잘못 넣은 줄
  const dup = parseSeatRows([{ name: '김 솔', table: 1 }, { name: '김솔', table: 1 }, { name: '박', table: 3 }, { name: '박', table: 4 }, { name: '박', table: 3 }]);
  assert.equal(dup, '같은 테이블에 같은 이름이 두 번 있어요: 김 솔, 박');
  const many = Array.from({ length: SEAT_ROWS_MAX + 1 }, (_, i) => ({ name: `손님${i}`, table: 1 }));
  assert.match(parseSeatRows(many) as string, /400줄/);
});

test('퀴즈 문제 — 오프닝 2 + 11문제 · id 겹침 없음 · 라운드 제목', () => {
  assert.equal(QUIZ_QUESTIONS.length, 13);
  assert.equal(new Set(QUIZ_QUESTIONS.map((x) => x.id)).size, 13);
  assert.deepEqual([...new Set(QUIZ_QUESTIONS.map((x) => `${x.round}:${x.roundTitle}`))], ['0:오프닝', '1:워밍업', '2:브레인스토밍', '3:Wedding']);
  assert.deepEqual(QUIZ_QUESTIONS.slice(0, 2).map((x) => [x.id, x.kind, x.points, x.open]), [['r0q1', 'text', 0, true], ['r0q2', 'text', 0, true]]);
  for (const x of QUIZ_QUESTIONS) {
    if (x.kind === 'choice') assert.ok(Number(x.answer) >= 1 && Number(x.answer) <= x.options!.length, x.id);
    if (x.kind === 'match') assert.equal(x.answer.length, x.slots!.length, x.id);
    if (x.kind === 'text' && !x.open) assert.ok(autoCorrect(x, x.answer), `${x.id} 대표 답은 정답이어야`);
  }
});

test('퀴즈 정규화 · 자동 채점', () => {
  const Q = (id: string) => quizQuestion(id)!;
  assert.equal(normalizeQuizText(' Bridal-Shower! '), 'bridalshower');
  assert.equal(normalizeQuizText('“슈슈 몽드” (웨딩홀).'), '슈슈몽드웨딩홀');
  assert.equal(normalizeQuizText('ＦＲＥＥＴＩＦＵＬ'), 'freetiful');
  assert.equal(autoCorrect(Q('r1q1'), 'Freetiful'), true);
  assert.equal(autoCorrect(Q('r1q1'), 'free tiful.'), true);
  assert.equal(autoCorrect(Q('r1q1'), 'prettyful'), false);
  assert.equal(autoCorrect(Q('r3q1'), 'bridal shower'), true);
  assert.equal(autoCorrect(Q('r3q1'), 'bachelorette'), false);
  assert.equal(autoCorrect(Q('r3q2'), 'Chouchou Monde'), true);
  assert.equal(autoCorrect(Q('r3q2'), '슈슈몽드 웨딩홀'), true);
  assert.equal(autoCorrect(Q('r3q2'), '!!!'), false);
  assert.equal(autoCorrect(Q('r1q2'), 'X'), true);
  assert.equal(autoCorrect(Q('r1q2'), 'O'), false);
  assert.equal(autoCorrect(Q('r1q3'), '4'), true);
  assert.equal(autoCorrect(Q('r1q3'), '3'), false);
  assert.equal(autoCorrect(Q('r2q1'), 'BDAC'), true);
  assert.equal(autoCorrect(Q('r2q1'), 'BDCA'), false);
  assert.equal(autoCorrect(Q('r3q3'), 'anything'), false);
  assert.equal(autoCorrect(Q('r1q1'), null), false);
});

test('퀴즈 답 검사 — 종류별 저장 모양', () => {
  const Q = (id: string) => quizQuestion(id)!;
  const ok = (id: string, raw: unknown) => (parseQuizAnswer(Q(id), raw) as { answer?: string }).answer;
  const err = (id: string, raw: unknown) => (parseQuizAnswer(Q(id), raw) as { error?: string }).error;
  assert.equal(ok('r1q1', '  free\ntiful  '), 'free tiful');
  assert.match(err('r1q1', '   ')!, /적어/);
  assert.match(err('r1q1', 3)!, /적어/);
  assert.match(err('r1q1', '가'.repeat(41))!, /40자/);
  assert.equal(ok('r1q1', '가'.repeat(40)), '가'.repeat(40));
  assert.equal(ok('r1q2', 'o'), 'O');
  assert.equal(ok('r1q2', ' x '), 'X');
  assert.equal(ok('r1q2', 'Ｘ'), 'X');
  assert.match(err('r1q2', 'Y')!, /O 또는 X/);
  assert.equal(ok('r1q3', 4), '4');
  assert.equal(ok('r1q3', '1'), '1');
  assert.match(err('r1q3', 5)!, /보기/);
  assert.match(err('r1q3', 0)!, /보기/);
  assert.match(err('r2q5', '3')!, /보기/);
  assert.equal(ok('r2q5', 2), '2');
  assert.equal(ok('r2q1', 'b d a c'), 'BDAC');
  assert.equal(ok('r2q1', ['B', 'D', 'A', 'C']), 'BDAC');
  assert.equal(ok('r2q1', 'AAAA'), 'AAAA'); // 같은 글자 겹쳐도 됨(채점은 문자열 비교)
  assert.match(err('r2q1', 'BDA')!, /4칸/);
  assert.match(err('r2q1', 'BDAE')!, /A~D/);
  assert.match(err('r3q3', 'O')!, /미션/);
});

test('퀴즈 사람이 읽는 답', () => {
  const Q = (id: string) => quizQuestion(id)!;
  assert.equal(displayAnswer(Q('r1q3'), '4'), '④ 2,011건');
  assert.equal(displayAnswer(Q('r2q5'), '2'), '② 아리송하다');
  assert.equal(displayAnswer(Q('r1q2'), 'O'), 'O');
  assert.equal(displayAnswer(Q('r2q1'), 'BDAC'), '1)B 2)D 3)A 4)C');
  assert.equal(displayAnswer(Q('r3q2'), '슈슈 몽드'), '슈슈 몽드');
  assert.equal(displayAnswer(Q('r1q1'), null), null);
});

const at = new Date('2026-11-23T19:52:00+09:00');
const row = (questionId: string, tableNo: number, answer: string | null, correct: boolean | null = null, name: string | null = '김솔'): QuizAnswerRow =>
  ({ questionId, tableNo, answer, name, correct, updatedAt: at });

test('퀴즈 점수판 — 공개된 문제만 · 어드민 판정 우선 · 점수 → 테이블 순', () => {
  const rows = [
    row('r1q1', 5, 'Freetiful'), // 100
    row('r1q2', 5, 'X'), // 100
    row('r1q2', 2, 'X'), // 100
    row('r1q3', 2, '1', true), // 틀렸지만 어드민이 O → 100
    row('r1q1', 7, 'Freetiful', false), // 맞았지만 어드민이 X → 0
    row('r3q3', 9, null, true), // 미션 성공 300
    row('r2q1', 1, 'BDAC'), // 공개 안 됨 → 0
  ];
  const board = quizBoard(rows, ['r1q1', 'r1q2', 'r1q3', 'r3q3']);
  assert.equal(board.length, 18);
  assert.deepEqual(board.slice(0, 4), [
    { table: 9, score: 300, correct: 1 },
    { table: 2, score: 200, correct: 2 },
    { table: 5, score: 200, correct: 2 },
    { table: 1, score: 0, correct: 0 },
  ]);
  assert.equal(board.find((b) => b.table === 7)!.score, 0);
  assert.deepEqual(quizBoard(rows, []).slice(0, 3).map((b) => b.table), [1, 2, 3]);
});

test('퀴즈 추가 점수 — quiz-bonus 줄은 테이블 점수에만 더함(맞힌 수 그대로) · 모양 틀린 칸 버림', () => {
  const bonus = parseQuizBonus({ '5': 100, '6': 200, '11': 200, '12': 100, '14': 100, '15': 200, '18': 300, '19': 500, '0': 100, x: 1, '7': 1.5, '8': '100', '9': 99999 });
  assert.deepEqual(bonus, { 5: 100, 6: 200, 11: 200, 12: 100, 14: 100, 15: 200, 18: 300 });
  assert.deepEqual(parseQuizBonus(null), {});
  assert.deepEqual(parseQuizBonus([100]), {});
  const rows: QuizAnswerRow[] = [{ questionId: 'r1q2', tableNo: 5, answer: 'X', name: '가', correct: null, updatedAt: new Date() }];
  const board = quizBoard(rows, ['r1q2'], bonus);
  assert.deepEqual(board.find((b) => b.table === 5), { table: 5, score: 200, correct: 1 });
  assert.deepEqual(board.find((b) => b.table === 18), { table: 18, score: 300, correct: 0 });
  assert.equal(board[0].table, 18);
  assert.equal(board.find((b) => b.table === 1)!.score, 0);
  assert.equal(quizPublicShared(defaultQuizState(), rows, bonus).board.find((b) => b.table === 6)!.score, 200);
  const adm = quizAdmin(defaultQuizState(), rows, bonus);
  assert.equal(adm.board.find((b) => b.table === 15)!.score, 200);
  assert.equal(adm.boardAll.find((b) => b.table === 5)!.score, 200);
  assert.equal(quizBoard(rows, ['r1q2']).find((b) => b.table === 5)!.score, 100);
});

test('퀴즈 진행 상태 — open · lock · reveal · unreveal · board · reset', () => {
  const now = new Date('2026-11-23T19:50:00+09:00');
  let s = defaultQuizState();
  assert.match(applyQuizAction(s, { action: 'lock' }, now) as string, /진행 중인 문제/);
  assert.match(applyQuizAction(s, { action: 'reveal' }, now) as string, /진행 중인 문제/);
  assert.match(applyQuizAction(s, { action: 'open', questionId: 'nope' }, now) as string, /없는 문제/);
  assert.match(applyQuizAction(s, { action: 'fly' }, now) as string, /없는 동작/);

  s = applyQuizAction(s, { action: 'open', questionId: 'r1q1' }, now) as any;
  assert.deepEqual(s, { currentId: 'r1q1', phase: 'open', openedAt: now.toISOString(), extraSec: 0, revealed: [], showBoard: false });
  // [+60초] — 받는 중일 때만 · 60초씩 · 한 문제 10분까지 · 다시 열면 0
  let ext = applyQuizAction(s, { action: 'extend' }, now) as any;
  ext = applyQuizAction(ext, { action: 'extend' }, now) as any;
  assert.equal(ext.extraSec, 120);
  assert.equal(ext.openedAt, now.toISOString()); // 연 시각은 그대로(손님 등장 연출이 다시 안 돌게)
  for (let i = 0; i < 8; i++) ext = applyQuizAction(ext, { action: 'extend' }, now) as any;
  assert.equal(ext.extraSec, 600);
  assert.match(applyQuizAction(ext, { action: 'extend' }, now) as string, /10분까지/);
  assert.equal((applyQuizAction(ext, { action: 'open', questionId: 'r1q2' }, now) as any).extraSec, 0);
  assert.match(applyQuizAction({ ...ext, phase: 'locked' }, { action: 'extend' }, now) as string, /받는 중인 문제가 없어요/);
  assert.match(applyQuizAction(defaultQuizState(), { action: 'extend' }, now) as string, /받는 중인 문제가 없어요/);
  s = applyQuizAction(s, { action: 'lock' }, now) as any;
  assert.equal(s.phase, 'locked');
  s = applyQuizAction(s, { action: 'reveal' }, now) as any;
  s = applyQuizAction(s, { action: 'reveal' }, now) as any;
  assert.deepEqual(s.revealed, ['r1q1']); // 두 번 눌러도 한 번
  assert.equal(s.phase, 'revealed');
  // 공개 취소 — 지금 문제면 마감으로
  const un = applyQuizAction(s, { action: 'unreveal', questionId: 'r1q1' }, now) as any;
  assert.deepEqual([un.phase, un.revealed], ['locked', []]);
  // 다시 열면 공개도 다시 해야 한다
  const reopened = applyQuizAction(s, { action: 'open', questionId: 'r1q1' }, now) as any;
  assert.deepEqual([reopened.phase, reopened.revealed], ['open', []]);
  // 다음 문제로 넘어가도 지난 공개는 남는다
  const next = applyQuizAction(s, { action: 'open', questionId: 'r1q2' }, now) as any;
  assert.deepEqual([next.currentId, next.revealed], ['r1q2', ['r1q1']]);
  assert.match(applyQuizAction(s, { action: 'board' }, now) as string, /켜기/);
  assert.equal((applyQuizAction(s, { action: 'board', on: true }, now) as any).showBoard, true);
  const idle = applyQuizAction(s, { action: 'idle' }, now) as any;
  assert.deepEqual([idle.currentId, idle.phase, idle.revealed], [null, 'idle', ['r1q1']]);
  assert.deepEqual(applyQuizAction(s, { action: 'reset', questionId: 'r1q1' }, now), s); // 문제 하나 = 답만 지움(상태 그대로)
  assert.deepEqual(applyQuizAction(s, { action: 'reset' }, now), defaultQuizState());
  assert.match(applyQuizAction(s, { action: 'reset', questionId: 'zz' }, now) as string, /없는 문제/);
});

test('퀴즈 상태 읽기 — 모양이 틀리면 기본값 · 없는 문제 id 버림', () => {
  assert.deepEqual(parseQuizState(null), defaultQuizState());
  assert.deepEqual(parseQuizState('x'), defaultQuizState());
  assert.deepEqual(parseQuizState({ currentId: 'zz', phase: 'open', revealed: ['r1q1', 'zz', 'r1q1'], showBoard: 1 }), {
    currentId: null, phase: 'idle', openedAt: null, extraSec: 0, revealed: ['r1q1'], showBoard: false,
  });
  assert.equal(parseQuizState({ currentId: 'r1q2', phase: 'open', extraSec: 120 }).extraSec, 120);
  assert.equal(parseQuizState({ currentId: 'r1q2', phase: 'open', extraSec: -5 }).extraSec, 0);
  assert.equal(parseQuizState({ currentId: 'r1q2', phase: 'open', extraSec: 1.5 }).extraSec, 0);
  assert.equal(parseQuizState({ currentId: 'r1q2', phase: 'open', extraSec: 99999 }).extraSec, 600);
  assert.equal(parseQuizState({ currentId: 'r1q2', phase: 'weird' }).phase, 'idle');
});

test('손님 퀴즈 화면 — 정답 칸은 안 보내고 공개된 문제만 정답·테이블 답', () => {
  const rows = [row('r1q1', 3, 'freetiful'), row('r1q2', 3, 'O', null, '이하나'), row('r1q2', 4, 'X')];
  const closed = { ...defaultQuizState(), currentId: 'r1q2', phase: 'open' as const, openedAt: at.toISOString(), revealed: [] };
  const pub = quizPublicShared(closed, rows);
  const json = JSON.stringify(pub);
  assert.equal(pub.questions.length, 13);
  assert.ok(!json.includes('"accept"') && !json.includes('"answer"') && !json.includes('answerLabel') && !json.includes('chouchoumonde'));
  assert.deepEqual(pub.results, {});
  assert.equal(pub.board.every((b) => b.score === 0), true);

  // 우리 테이블 답(mine)
  assert.equal(quizMine(closed, rows, null), null);
  assert.equal(quizMine(closed, rows, 9), null);
  assert.deepEqual(quizMine(closed, rows, 3), { questionId: 'r1q2', answer: 'O', display: 'O', name: '이하나', updatedAt: at.toISOString() });

  const revealed = { ...closed, phase: 'revealed' as const, revealed: ['r1q1', 'r1q2'] };
  const pub2 = quizPublicShared(revealed, rows);
  assert.deepEqual(Object.keys(pub2.results), ['r1q1', 'r1q2']);
  assert.equal(pub2.questions.find((x) => x.id === 'r1q2')!.answerLabel, 'X');
  assert.equal(pub2.questions.find((x) => x.id === 'r1q3')!.answerLabel, undefined);
  assert.ok(!JSON.stringify(pub2).includes('"accept"'));
  const t = pub2.results.r1q2.tables;
  assert.equal(t.length, 18);
  assert.deepEqual(t[2], { table: 3, answer: 'O', display: 'O', name: '이하나', correct: false });
  assert.deepEqual(t[3], { table: 4, answer: 'X', display: 'X', name: '김솔', correct: true });
  assert.deepEqual(t[0], { table: 1, answer: null, display: null, name: null, correct: false });
  assert.equal(pub2.results.r1q2.explanation?.startsWith('프리티풀은'), true);
  assert.deepEqual(pub2.board.slice(0, 2), [{ table: 3, score: 100, correct: 1 }, { table: 4, score: 100, correct: 1 }]);
});

test('어드민 퀴즈판 — 자동·판정·최종 · 낸 수 · 전체 채점', () => {
  const rows = [row('r1q1', 1, 'freetiful'), row('r1q1', 2, 'pretiful', true), row('r1q1', 3, 'freetiful', false), row('r3q3', 4, null, true)];
  const a = quizAdmin({ ...defaultQuizState(), revealed: ['r1q1'] }, rows);
  assert.equal(Object.keys(a.results).length, 13);
  assert.equal(a.questions.every((x) => typeof x.answerLabel === 'string'), true);
  assert.ok(!JSON.stringify(a.questions).includes('"accept"'));
  const r = a.results.r1q1;
  assert.equal(r.submitted, 3);
  assert.equal(r.correctCount, 2);
  assert.deepEqual(r.tables.slice(0, 3).map((x) => [x.auto, x.override, x.correct]), [[true, null, true], [false, true, true], [true, false, false]]);
  assert.equal(r.tables[0].updatedAt, at.toISOString());
  assert.equal(r.tables[5].updatedAt, null);
  assert.equal(a.results.r3q3.submitted, 0);
  assert.equal(a.results.r3q3.correctCount, 1);
  // (261122 미션 도전) 미션은 숨길 정답이 없어 공개 전에도 점수판에 — 성공 찍은 4번 테이블 300점이 맨 위
  assert.deepEqual(a.board.slice(0, 3).map((b) => [b.table, b.score]), [[4, 300], [1, 100], [2, 100]]);
  assert.equal(a.boardAll[0].table, 4);
  assert.equal(a.boardAll[0].score, 300);
});

test('미션 도전 — 점수판 = 공개 문제 + 미션 · 우리 테이블 결과(대기 · 성공 · 실패) · 도전 없이 결과만 찍은 줄', () => {
  assert.deepEqual(quizBoardIds({ revealed: [] }), ['r3q3']);
  assert.deepEqual(quizBoardIds({ revealed: ['r1q1', 'r3q3'] }), ['r1q1', 'r3q3']);
  const open = { ...defaultQuizState(), currentId: 'r3q3', phase: 'open' as const, openedAt: at.toISOString() };
  const rows = [
    row('r3q3', 2, MISSION_CHALLENGE, null, '김솔'),
    row('r3q3', 3, MISSION_CHALLENGE, true, '이하나'),
    row('r3q3', 4, MISSION_CHALLENGE, false, '박민'),
    row('r3q3', 5, null, false, null), // 운영팀이 도전 없이 실패만 찍음(패스)
    row('r1q1', 2, 'freetiful'), // 공개 전 — 점수 X
  ];
  const pub = quizPublicShared(open, rows);
  assert.deepEqual(pub.board.slice(0, 2).map((b) => [b.table, b.score]), [[3, 300], [1, 0]]);
  assert.equal(pub.board.find((b) => b.table === 2)!.score, 0);
  assert.deepEqual(pub.results, {}); // 테이블별 답은 공개 때만(지금 문제 결과는 mine 으로)
  assert.deepEqual(quizMine(open, rows, 2), { questionId: 'r3q3', answer: MISSION_CHALLENGE, display: MISSION_CHALLENGE, name: '김솔', updatedAt: at.toISOString(), result: 'pending' });
  assert.equal(quizMine(open, rows, 3)!.result, 'success');
  assert.equal(quizMine(open, rows, 4)!.result, 'fail');
  assert.deepEqual(quizMine(open, rows, 5), { questionId: 'r3q3', answer: '', display: '', name: '', updatedAt: at.toISOString(), result: 'fail' });
  assert.equal(quizMine(open, rows, 6), null);
  // 손님 답 내기 규칙은 그대로 — 미션은 답을 안 냄
  assert.match((parseQuizAnswer(quizQuestion('r3q3')!, '도전') as { error: string }).error, /미션/);
  // 보통 문제 mine 에는 result 가 없다(공개 전 정답 새지 않게)
  const q1 = { ...open, currentId: 'r1q1' };
  assert.equal('result' in (quizMine(q1, rows, 2) as object), false);
});

/** 응모권·명단·추첨 표만 흉내 낸 가짜 prisma — 한 사람 한 장 · 번호 겹침 다시 시도 · 추첨 중복 없음 확인용 */
function fakeLivePrisma() {
  const tickets: any[] = [];
  const draws: any[] = [];
  const seats: any[] = [];
  /** 손님 표 쓰기(upsert 부른 횟수 = 길이) */
  const guests: any[] = [];
  /** 손님 표 지금 줄(eventKey:deviceId → 줄) — upsert 의 create/update 를 그대로 적용 */
  const guestRows = new Map<string, any>();
  const guestMatch = (g: any, where: any): boolean =>
    (!where.eventKey || g.eventKey === where.eventKey) &&
    (!where.deviceId || g.deviceId === where.deviceId) &&
    (!where.userId?.not || g.userId != null);
  const byLastSeen = (a: any, b: any) => b.lastSeenAt - a.lastSeenAt;
  const state = new Map<string, any>();
  let failNextCreate = 0;
  let n = 0;
  const withDraws = (t: any) => ({ ...t, draws: draws.filter((d) => d.ticketId === t.id && !d.cancelledAt).sort((a, b) => b.createdAt - a.createdAt).slice(0, 1) });
  const ticketMatch = (t: any, where: any): boolean =>
    (!where.eventKey || t.eventKey === where.eventKey) &&
    (!where.id || t.id === where.id) &&
    (!where.nameKey || t.nameKey === where.nameKey) &&
    (!where.deviceId || t.deviceId === where.deviceId) &&
    (!where.OR || where.OR.some((w: any) => ticketMatch(t, w))) &&
    (!where.draws?.none || !draws.some((d) => d.ticketId === t.id));
  // 원시 SQL 은 지운 이름 목록(reception_state) 잠금·기본 줄만 흉내 — 값 순서 = eventKey, key
  const stateRaw = (strings: TemplateStringsArray, ...values: any[]) => {
    const sql = strings.join('?');
    if (!sql.includes('reception_state')) return null;
    const k = `${values[0]}:${values[1]}`;
    if (sql.includes('INSERT') && !state.has(k)) state.set(k, JSON.parse(values[2]));
    return [{ value: state.get(k) }];
  };
  const prisma: any = {
    receptionGuest: {
      upsert: async (args: any) => {
        guests.push(args);
        const k = `${args.where.eventKey_deviceId.eventKey}:${args.where.eventKey_deviceId.deviceId}`;
        const prev = guestRows.get(k);
        const row = prev ? Object.assign(prev, args.update) : { userId: null, createdAt: new Date(), lastSeenAt: new Date(), ...args.create };
        guestRows.set(k, row);
        return row;
      },
      findFirst: async ({ where }: any) => [...guestRows.values()].filter((g) => guestMatch(g, where)).sort(byLastSeen)[0] ?? null,
      findMany: async ({ where }: any) => [...guestRows.values()].filter((g) => guestMatch(g, where)).sort(byLastSeen),
    },
    receptionSeat: { findMany: async ({ where }: any) => seats.filter((s) => s.eventKey === where.eventKey).map((s) => ({ ...s })) },
    receptionState: {
      findUnique: async ({ where }: any) => {
        const v = state.get(`${where.eventKey_key.eventKey}:${where.eventKey_key.key}`);
        return v ? { value: v } : null;
      },
      update: async ({ where, data }: any) => {
        state.set(`${where.eventKey_key.eventKey}:${where.eventKey_key.key}`, JSON.parse(JSON.stringify(data.value)));
        return data;
      },
    },
    receptionTicket: {
      findUnique: async ({ where }: any) => {
        const k = where.eventKey_nameKey;
        const t = tickets.find((x) => x.eventKey === k.eventKey && x.nameKey === k.nameKey);
        return t ? withDraws(t) : null;
      },
      findMany: async ({ where }: any) => tickets.filter((t) => ticketMatch(t, where)).sort((a, b) => a.number - b.number).map(withDraws),
      findFirst: async ({ where }: any) => tickets.find((t) => ticketMatch(t, where)) ?? null,
      count: async ({ where }: any) => tickets.filter((t) => ticketMatch(t, where)).length,
      aggregate: async ({ where }: any) => ({ _max: { number: tickets.filter((t) => t.eventKey === where.eventKey).reduce((m, t) => Math.max(m, t.number), 0) || null } }),
      create: async ({ data }: any) => {
        if (failNextCreate > 0) {
          failNextCreate--;
          // 다른 요청이 같은 번호를 막 가져간 것처럼
          tickets.push({ id: `t${++n}`, eventKey: data.eventKey, number: data.number, nameKey: `other${n}`, name: `다른손님${n}`, deviceId: 'x', createdAt: new Date(), lastSeenAt: new Date() });
          throw new Prisma.PrismaClientKnownRequestError('dup', { code: 'P2002', clientVersion: 'test' });
        }
        if (tickets.some((t) => t.eventKey === data.eventKey && (t.number === data.number || t.nameKey === data.nameKey))) {
          throw new Prisma.PrismaClientKnownRequestError('dup', { code: 'P2002', clientVersion: 'test' });
        }
        const t = { id: `t${++n}`, createdAt: new Date(Date.now() + n), lastSeenAt: new Date(), ...data };
        tickets.push(t);
        return withDraws(t);
      },
      updateMany: async ({ where, data }: any) => {
        const hit = tickets.filter((t) => ticketMatch(t, where));
        if (data.nameKey && hit.length && tickets.some((t) => !hit.includes(t) && t.eventKey === hit[0].eventKey && t.nameKey === data.nameKey)) {
          throw new Prisma.PrismaClientKnownRequestError('dup', { code: 'P2002', clientVersion: 'test' });
        }
        for (const t of hit) Object.assign(t, data);
        return { count: hit.length };
      },
      deleteMany: async ({ where }: any) => {
        const i = tickets.findIndex((t) => t.id === where.id && t.eventKey === where.eventKey);
        if (i < 0) return { count: 0 };
        const [t] = tickets.splice(i, 1);
        for (let j = draws.length - 1; j >= 0; j--) if (draws[j].ticketId === t.id) draws.splice(j, 1);
        return { count: 1 };
      },
    },
    receptionDraw: {
      findMany: async ({ where }: any) => draws.filter((d) => d.eventKey === where.eventKey).sort((a, b) => b.createdAt - a.createdAt),
      deleteMany: async ({ where }: any) => {
        let count = 0;
        for (let i = draws.length - 1; i >= 0; i--) {
          if (draws[i].eventKey === where.eventKey && where.id.in.includes(draws[i].id)) { draws.splice(i, 1); count++; }
        }
        return { count };
      },
      findFirst: async ({ where }: any) =>
        draws.find((d) => d.id === where.id && d.eventKey === where.eventKey && (where.cancelledAt !== null || !d.cancelledAt)) ?? null,
      create: async ({ data }: any) => { const d = { id: `d${++n}`, createdAt: new Date(Date.now() + n), cancelledAt: null, ...data }; draws.push(d); return d; },
      updateMany: async ({ where, data }: any) => {
        const d = draws.find((x) => x.id === where.id && x.eventKey === where.eventKey && !x.cancelledAt);
        if (!d) return { count: 0 };
        Object.assign(d, data);
        return { count: 1 };
      },
      count: async ({ where }: any) => draws.filter((d) => d.eventKey === where.eventKey &&
        (!where.id || d.id === where.id) && (!where.prize || d.prize === where.prize) &&
        (where.cancelledAt !== null || !d.cancelledAt)).length,
    },
    $transaction: async (arg: any) =>
      typeof arg === 'function'
        ? arg({ ...prisma, $executeRaw: async (s: TemplateStringsArray, ...v: any[]) => (stateRaw(s, ...v) ? 1 : 0), $queryRaw: async (s: TemplateStringsArray, ...v: any[]) => stateRaw(s, ...v) ?? [] })
        : Promise.all(arg),
  };
  return { prisma, tickets, draws, seats, guests, guestRows, state, failCreates: (k: number) => { failNextCreate = k; } };
}

/** 알림 서비스 흉내 — createNotification 부른 것을 남긴다(fail 이면 던짐) */
function fakeNotifications(fail = false) {
  const calls: Array<{ userId: string; type: string; title: string; body: string; data: any }> = [];
  return {
    calls,
    createNotification: (userId: string, type: string, title: string, body: string, data: any) => {
      calls.push({ userId, type, title, body, data });
      if (fail) throw new Error('push down');
      return Promise.resolve({ id: `n${calls.length}` });
    },
  };
}

function liveService(prisma: any, notifications: any = fakeNotifications(), warns: string[] = [], drawPushDelayMs = 0) {
  const reception = Object.assign(Object.create(ReceptionService.prototype), { prisma, feedCache: new Map(), logger: { warn() {} } });
  return Object.assign(Object.create(ReceptionLiveService.prototype), {
    prisma, reception, notifications, seatCache: new Map(), modeCache: new Map(), renameCache: new Map(), touched: new Map(), drawPushDelayMs,
    logger: { warn: (m: string) => { warns.push(m); }, log() {}, error() {} },
  }) as ReceptionLiveService;
}

/** 추첨 뒤 늦춰(테스트는 0ms) 보내는 푸시가 끝나게 — 가짜 prisma 는 전부 마이크로태스크 */
const settle = (ms = 5) => new Promise((r) => setTimeout(r, ms));

test('손님 자리·응모권 — 닫힘이면 안 나옴 · 이름당 한 장 · 번호 겹치면 다시 · 명단 자리', async () => {
  const f = fakeLivePrisma();
  const svc = liveService(f.prisma);
  const EK = 'wmak-2026' as const;
  f.state.set(`${EK}:tickets`, { mode: 'closed' });
  const closed = await svc.guest(EK, D1, '김 솔');
  assert.deepEqual(closed, { ok: true, name: '김 솔', seatListLoaded: false, seat: null, sameName: null, ticketsOpen: false, ticket: null });
  await assert.rejects(svc.guest(EK, D1, '  '), /이름을 먼저/);

  (svc as any).modeCache.clear();
  f.state.set(`${EK}:tickets`, { mode: 'open' });
  f.seats.push({ eventKey: EK, nameKey: '김솔', name: '김솔', tableNo: 7, seatNo: 3 });
  (svc as any).seatCache.clear();
  const me = await svc.guest(EK, D1, '김 솔');
  assert.equal(me.ticketsOpen, true);
  assert.deepEqual(me.seat, { table: 7, seat: 3 });
  assert.equal(me.seatListLoaded, true);
  assert.equal(me.ticket!.number, 1);
  // 다른 기기·띄어쓰기 달라도 같은 이름이면 같은 응모권
  const again = await svc.guest(EK, D2, '김솔');
  assert.equal(again.ticket!.number, 1);
  assert.equal(f.tickets.length, 1);
  assert.equal(again.seat!.table, 7);

  // 번호 겹침 두 번 → 다시 시도해서 다음 번호
  f.failCreates(2);
  const other = await svc.guest(EK, D2, '이하나');
  assert.equal(other.ticket!.number, 4);
  assert.equal(other.seat, null);
  // 닫혀도 이미 받은 응모권은 보인다
  (svc as any).modeCache.clear();
  f.state.set(`${EK}:tickets`, { mode: 'closed' });
  assert.equal((await svc.guest(EK, D1, '김솔')).ticket!.number, 1);

  // 손님 표는 같은 기기·같은 이름이면 1분에 한 번만 쓴다
  const before = f.guests.length;
  await svc.guest(EK, D1, '김솔');
  assert.equal(f.guests.length, before);

  const live = await svc.live(EK);
  assert.equal(live.summary.arrived, 4);
  assert.equal(live.summary.listed, 1);
  assert.equal(live.summary.listedArrived, 1);
  assert.equal(live.summary.walkIns, 3);
  assert.equal(live.summary.tables.length, 18);
  assert.deepEqual(live.summary.tables[6], { table: 7, listed: 1, arrived: 1 });
  assert.deepEqual(live.arrivals.map((a) => a.number), [1, 2, 3, 4]);
  assert.equal(live.arrivals[0].listed, true);
  assert.deepEqual([live.seats[0].arrived, live.seats[0].ticketNumber], [true, 1]);
});

test('동명이인 — 고르기 전엔 자리·응모권 없음 · 고른 테이블 줄로 따로 받음 · 입장·당첨 테이블 · 이름으로 막힘 풀기', async () => {
  const f = fakeLivePrisma();
  const svc = liveService(f.prisma);
  const EK = 'wmak-2026' as const;
  f.state.set(`${EK}:tickets`, { mode: 'open' });
  const rows = parseSeatRows([
    { name: '김현우', table: 2, seat: 7 },
    { name: '김태우', table: 2, seat: 1 },
    { name: '김현우', table: 12, seat: 6 },
    { name: '임효준', table: 12, seat: 1 },
    { name: '박병준', table: 12, seat: 5 },
  ]);
  assert.ok(Array.isArray(rows));
  for (const r of rows) f.seats.push({ eventKey: EK, nameKey: r.nameKey, name: r.name, tableNo: r.table, seatNo: r.seat });

  // 안 고름 — 자리 없음, 고를 목록(같은 테이블 사람 좌석 순), 응모권 안 나옴
  const undecided = await svc.guest(EK, D1, '김 현우');
  assert.equal(undecided.seatListLoaded, true);
  assert.equal(undecided.seat, null);
  assert.equal(undecided.ticket, null);
  assert.deepEqual(undecided.sameName, [
    { table: 2, seat: 7, mates: ['김태우'] },
    { table: 12, seat: 6, mates: ['임효준', '박병준'] },
  ]);
  assert.equal(f.tickets.length, 0);
  // 목록에 없는 테이블을 골라도 안 고른 것과 같다
  assert.equal((await svc.guest(EK, D1, '김현우', 5)).seat, null);
  assert.equal((await svc.guest(EK, D1, '김현우', 'x')).seat, null);
  assert.equal(f.tickets.length, 0);

  // 고름 — 그 줄 자리 + 그 줄 열쇠로 응모권(다른 기기·다른 테이블이면 따로)
  const a = await svc.guest(EK, D1, '김현우', 12);
  assert.deepEqual(a.seat, { table: 12, seat: 6 });
  assert.equal(a.sameName!.length, 2);
  assert.equal(a.ticket!.number, 1);
  assert.equal(f.tickets[0].nameKey, '김현우 @12');
  const b = await svc.guest(EK, D2, '김현우', '2');
  assert.deepEqual(b.seat, { table: 2, seat: 7 });
  assert.equal(b.ticket!.number, 2);
  assert.equal(f.tickets[1].nameKey, '김현우 @2');
  // 다시 골라도 이 기기 응모권은 내 것 그대로 — 그 줄에 남의 응모권이 있으면 옮기지도, 남의 것을 보여 주지도 않는다
  assert.equal((await svc.guest(EK, D1, '김현우', 2)).ticket!.number, 1);
  assert.equal(f.tickets[0].nameKey, '김현우 @12');
  assert.equal((await svc.guest(EK, D1, '김현우', 12)).ticket!.number, 1);
  assert.equal(f.tickets.length, 2);
  // 안 고른 상태 — 이 기기 것만(같은 이름 다른 사람 응모권 X)
  assert.equal((await svc.guest(EK, D3, '김현우')).ticket, null);
  assert.equal((await svc.guest(EK, D1, '김현우')).ticket!.number, 1);
  // 동명이인 아닌 사람은 pick 을 무시
  const c = await svc.guest(EK, D3, '박병준', 2);
  assert.equal(c.ticket!.number, 3);
  assert.deepEqual([c.seat, c.sameName, c.ticket!.number], [{ table: 12, seat: 5 }, null, 3]);

  const live = await svc.live(EK);
  assert.equal(live.summary.walkIns, 0);
  assert.deepEqual(live.arrivals.map((x) => [x.number, x.name, x.table, x.listed]), [[1, '김현우', 12, true], [2, '김현우', 2, true], [3, '박병준', 12, true]]);
  const seen = live.seats.filter((x) => x.name === '김현우').map((x) => [x.table, x.arrived, x.ticketNumber]);
  assert.deepEqual(seen, [[2, true, 2], [12, true, 1]]);
  assert.deepEqual(live.summary.tables[11], { table: 12, listed: 3, arrived: 2 });

  // 당첨 테이블 = 그 응모권의 줄
  const won: number[] = [];
  for (let i = 0; i < 3; i++) won.push((await svc.draw(EK, '경품')).draw.table!);
  const board = await svc.drawBoard(EK);
  assert.equal(board.tickets, 3);
  const byNo = new Map(board.draws.map((d) => [d.number, d.table]));
  assert.deepEqual([byNo.get(1), byNo.get(2), byNo.get(3)], [12, 2, 12]);
  assert.equal(won.length, 3);

  // 지우면 그 줄 열쇠로 막힘 → 이름으로 풀면 풀린다
  await svc.deleteTicket(EK, f.tickets.find((t) => t.nameKey === '김현우 @2').id);
  const blocked = await svc.live(EK);
  assert.deepEqual(blocked.blocked.map((x) => x.nameKey), ['김현우 @2']);
  const unblocked = await svc.unblockTicket(EK, '김현우');
  assert.deepEqual(unblocked.blocked, []);
});

test('동명이인 — 잘못 골랐다 다시 고르면 응모권이 그 줄로 옮겨 감 · 명단을 고쳐도 응모권이 제 줄에', async () => {
  const f = fakeLivePrisma();
  const svc = liveService(f.prisma);
  const EK = 'wmak-2026' as const;
  f.state.set(`${EK}:tickets`, { mode: 'open' });
  const load = (list: any[]) => {
    f.seats.length = 0;
    const rows = parseSeatRows(list);
    assert.ok(Array.isArray(rows));
    for (const r of rows) f.seats.push({ eventKey: EK, nameKey: r.nameKey, name: r.name, tableNo: r.table, seatNo: r.seat });
    (svc as any).seatCache.clear();
  };
  load([{ name: '김현우', table: 2, seat: 7 }, { name: '김현우', table: 12, seat: 6 }]);
  // 2번 김현우(D1)가 12를 잘못 고름 → #1 '@12' → 다시 2 → #1 이 '@2' 로 옮겨 감
  assert.equal((await svc.guest(EK, D1, '김현우', 12)).ticket!.number, 1);
  const back = await svc.guest(EK, D1, '김현우', 2);
  assert.deepEqual([back.seat, back.ticket!.number], [{ table: 2, seat: 7 }, 1]);
  assert.equal(f.tickets[0].nameKey, '김현우 @2');
  // 진짜 12번 김현우(D2)는 자기 응모권을 새로 받는다
  const other = await svc.guest(EK, D2, '김현우', 12);
  assert.deepEqual([other.seat, other.ticket!.number, f.tickets[1].nameKey], [{ table: 12, seat: 6 }, 2, '김현우 @12']);
  let live = await svc.live(EK);
  assert.deepEqual(live.seats.map((x) => [x.table, x.ticketNumber]), [[2, 1], [12, 2]]);

  // 명단 고침 — 12번 김현우를 빼서 이름이 하나뿐 → 남은 줄 열쇠 '김현우'. 옛 '@2' 응모권도 그 줄에 붙고(입장), 폰이 다시 부르면 열쇠도 옮김
  load([{ name: '김현우', table: 2, seat: 7 }]);
  live = await svc.live(EK);
  assert.deepEqual(live.seats.map((x) => [x.table, x.arrived, x.ticketNumber]), [[2, true, 1]]);
  assert.deepEqual(live.arrivals.map((a) => [a.number, a.table, a.listed]), [[1, 2, true], [2, null, false]]);
  const again = await svc.guest(EK, D1, '김현우', 2);
  assert.deepEqual([again.seat, again.sameName, again.ticket!.number, f.tickets[0].nameKey], [{ table: 2, seat: 7 }, null, 1, '김현우']);
  const won = await svc.draw(EK, '경품');
  assert.equal(won.draw.table, won.draw.number === 1 ? 2 : null);
});

test('럭키드로우 — 같은 응모권 두 번 안 뽑힘 · 무효도 다시 안 뽑음 · 다 뽑으면 400', async () => {
  const f = fakeLivePrisma();
  const svc = liveService(f.prisma);
  const EK = 'wmak-2026' as const;
  f.state.set(`${EK}:tickets`, { mode: 'open' });
  for (const [name, device] of [['가', D1], ['나', D2], ['다', D3]]) await svc.guest(EK, device, name);
  await assert.rejects(svc.draw(EK, ''), /경품 이름/);
  const P0 = DRAW_PRIZES[0].name;

  const first = await svc.draw(EK, P0);
  assert.deepEqual(first.participants.map(ticket => ticket.number).sort((a, b) => a - b), [1, 2, 3]);
  assert.equal(first.board.eligible, 2);
  assert.equal(first.board.tickets, 3);
  assert.equal(first.board.prizes[0].drawn, 1);
  const cancelled = await svc.cancelDraw(EK, first.draw.id);
  assert.equal(cancelled.prizes[0].drawn, 0);
  assert.equal(cancelled.draws[0].cancelled, true);
  assert.equal(cancelled.eligible, 2); // 무효된 사람도 다시 안 뽑음
  await svc.cancelDraw(EK, first.draw.id); // 두 번 눌러도 그대로
  await assert.rejects(svc.cancelDraw(EK, 'nope'), /찾을 수 없어요/);

  const second = await svc.draw(EK, P0);
  assert.equal(second.participants.some(ticket => ticket.number === first.draw.number), false);
  const third = await svc.draw(EK, '체스타필드 정장 세트');
  assert.equal(new Set([first.draw.number, second.draw.number, third.draw.number]).size, 3);
  await assert.rejects(svc.draw(EK, P0), /뽑을 응모권이 없어요/);
  assert.equal(third.board.eligible, 0);

  // 응모권 지우면 추첨 기록도 같이
  const t = f.tickets.find((x) => x.number === second.draw.number)!;
  await svc.deleteTicket(EK, t.id);
  assert.equal(f.draws.some((d) => d.ticketId === t.id), false);
  await assert.rejects(svc.deleteTicket(EK, t.id), /찾을 수 없어요/);
});

test('batch draws reserve the catalog quantities with a full eligible snapshot', async () => {
  const f = fakeLivePrisma();
  const svc = liveService(f.prisma);
  const event = 'wmak-2026' as const;
  const tickets = Array.from({ length: 156 }, (_, i) => ({
    id: `batch-${i}`, eventKey: event, number: i + 1, nameKey: `guest-${i}`, name: `guest ${i}`, createdAt: new Date(),
  }));
  f.tickets.push(...tickets);
  const picked = new Set<number>();
  for (const [i, count] of [[4, 2], [3, 4], [1, 3], [0, 3]]) {
    const { winners, participants, board } = await svc.draw(event, DRAW_PRIZES[i].name, true);
    assert.equal(winners.length, count);
    assert.equal(participants.length, tickets.length - picked.size);
    assert.ok(winners.every(w => participants.some(p => p.number === w.number)));
    for (const w of winners) { assert.ok(!picked.has(w.number)); picked.add(w.number); }
    assert.equal(board.prizes[i].drawn, count);
    await assert.rejects(svc.draw(event, DRAW_PRIZES[i].name, true), /남은 경품/);
  }
  const prize = DRAW_PRIZES[3].name;
  await svc.cancelDraw(event, f.draws.find(d => d.prize === prize).id);
  const replacement = await svc.draw(event, prize, true);
  assert.equal(replacement.winners.length, 1);
  assert.ok(!picked.has(replacement.draw.number));
  const insufficient = fakeLivePrisma();
  insufficient.tickets.push(tickets[0]);
  await assert.rejects(liveService(insufficient.prisma).draw(event, DRAW_PRIZES[4].name, true), /응모권이 적어요/);
  assert.equal(insufficient.draws.length, 0);
});

test('diffuser batch preserves a prior draw and fills exactly the two unawarded prizes', async () => {
  const f = fakeLivePrisma();
  const svc = liveService(f.prisma);
  const event = 'wmak-2026' as const;
  f.state.set(`${event}:tickets`, { mode: 'open' });
  for (const [device, name] of [[D1, '가'], [D2, '나'], [D3, '다']]) await svc.guest(event, device, name);
  const prize = DRAW_PRIZES[0].name;
  const { draw } = await svc.draw(event, prize);
  const { winners, board } = await svc.draw(event, prize, true);
  assert.equal(winners.length, 2);
  assert.equal(board.prizes[0].drawn, 3);
  assert.equal(new Set([draw.number, ...winners.map(w => w.number)]).size, 3);
});

test('pick — 무대 물리가 정한 순서 그대로 기록 · 뽑힌/없는 응모권·남은 수 초과·겹침은 하나도 안 넣음', async () => {
  const f = fakeLivePrisma();
  const svc = liveService(f.prisma);
  const event = 'wmak-2026' as const;
  f.tickets.push(...Array.from({ length: 10 }, (_, i) => ({
    id: `pick-${i}`, eventKey: event, number: i + 1, nameKey: `guest-${i}`, name: `guest ${i}`, createdAt: new Date(),
  })));
  const hanwoo = DRAW_PRIZES[3]; // 1++ 한우선물세트 4개
  // 판에 들어간 응모권 id(번호와 같은 순서) — 번호만으론 주인이 바뀐 걸 모른다
  const ids = (ns: number[]) => ns.map((n) => `pick-${n - 1}`);
  await assert.rejects(svc.pick(event, hanwoo.name, [1, 2]), /새로고침/);
  await assert.rejects(svc.pick(event, hanwoo.name, [1, 2], ['pick-0']), /새로고침/);
  await assert.rejects(svc.pick(event, hanwoo.name, [1, 2], ['pick-0', 7]), /새로고침/);
  // 맨 끝 번호를 지우고 다음 손님이 같은 번호를 받은 경우 — 판의 응모권(id)과 다르면 하나도 안 넣는다
  await assert.rejects(svc.pick(event, hanwoo.name, [1, 10], ['pick-0', 'old-ticket-10']), /No\.010 응모권은 이미 뽑혔거나 지워졌어요\(주인이 바뀌었을/);
  await assert.rejects(svc.pick(event, hanwoo.name, [], ids([])), /번호를 확인/);
  await assert.rejects(svc.pick(event, hanwoo.name, [1, 1], ids([1, 1])), /두 번/);
  await assert.rejects(svc.pick(event, hanwoo.name, [1, 2.5], ids([1, 2.5])), /번호를 확인/);
  await assert.rejects(svc.pick(event, hanwoo.name, [1, 2, 3, 4, 5], ids([1, 2, 3, 4, 5])), /남은 경품은 4개/);
  await assert.rejects(svc.pick(event, hanwoo.name, [1, 99], ids([1, 99])), /No\.099/);
  assert.equal(f.draws.length, 0);

  const first = await svc.pick(event, hanwoo.name, [7, 2, 9], ids([7, 2, 9]));
  assert.deepEqual(first.winners.map((w) => w.number), [7, 2, 9]);
  assert.equal(first.draw.number, 7);
  assert.equal(first.board.prizes[3].drawn, 3);
  assert.equal(first.board.eligible, 7);
  // 이미 뽑힌 응모권은 안 됨(무효로 돌려도 다시 안 뽑는 규칙 그대로)
  await assert.rejects(svc.pick(event, hanwoo.name, [2], ids([2])), /No\.002 응모권은 이미 뽑혔거나/);
  await svc.cancelDraw(event, first.winners[1].id);
  await assert.rejects(svc.pick(event, hanwoo.name, [2], ids([2])), /이미 뽑혔거나/);
  // 무효 1건 → 한우 남은 2개
  await assert.rejects(svc.pick(event, hanwoo.name, [1, 3, 4], ids([1, 3, 4])), /남은 경품은 2개/);
  const second = await svc.pick(event, hanwoo.name, [1, 3], ids([1, 3]));
  assert.equal(second.board.prizes[3].drawn, 4);
  await assert.rejects(svc.pick(event, hanwoo.name, [4], ids([4])), /남은 경품이 없어요/);

  // 체스타필드 1벌 · 목록에 없는 경품은 수량 제한 없이
  const chester = DRAW_PRIZES.find((p) => p.name.includes('체스타필드'))!;
  await assert.rejects(svc.pick(event, chester.name, [4, 5], ids([4, 5])), /남은 경품은 1벌/);
  assert.equal((await svc.pick(event, chester.name, [4], ids([4]))).winners[0].prize, chester.name);
  assert.equal((await svc.pick(event, '직접 입력 경품', [5, 6], ids([5, 6]))).winners.length, 2);
});

test('reset clears only the confirmed event draw history and makes its tickets eligible again', async () => {
  const f = fakeLivePrisma();
  const svc = liveService(f.prisma);
  const event = 'wmak-2026' as const;
  f.state.set(`${event}:tickets`, { mode: 'open' });
  await svc.guest(event, D1, '김솔');
  await svc.guest(event, D2, '이하나');
  const a = await svc.draw(event, '첫 경품');
  const b = await svc.draw(event, '둘째 경품');
  await svc.cancelDraw(event, a.draw.id);
  f.draws.push({ ...f.draws[0], eventKey: 'another-event', id: 'elsewhere' });
  await assert.rejects(svc.resetDraws(event, []), /확인해 주세요/);
  await assert.rejects(svc.resetDraws(event, [a.draw.id]), /내역이 바뀌었어요/);
  const board = await svc.resetDraws(event, [a.draw.id, b.draw.id]);
  assert.deepEqual(board.draws, []);
  assert.equal(board.tickets, 2);
  assert.equal(board.eligible, 2);
  assert.deepEqual(f.draws.map(d => d.id), ['elsewhere']);
});

test('응모권 — 한 기기 한 장(이름만 바꿔도 같은 것) · 지운 이름은 다시 안 나옴 · 풀면 다시', async () => {
  const f = fakeLivePrisma();
  const svc = liveService(f.prisma);
  const EK = 'wmak-2026' as const;
  f.state.set(`${EK}:tickets`, { mode: 'open' });
  const first = await svc.guest(EK, D1, '김솔');
  assert.equal(first.ticket!.number, 1);
  // 같은 폰에서 이름만 바꿔도 새로 안 나오고 그 폰의 응모권
  const renamed = await svc.guest(EK, D1, '김솔2');
  assert.deepEqual([renamed.name, renamed.ticket!.number, renamed.ticket!.name], ['김솔2', 1, '김솔']);
  assert.equal(f.tickets.length, 1);
  // 다른 폰에서 같은 이름이면 같은 응모권, 다른 이름이면 새 응모권
  assert.equal((await svc.guest(EK, D2, '김 솔')).ticket!.number, 1);
  const other = await svc.guest(EK, D2, '이하나');
  assert.equal(other.ticket!.number, 2);

  // 지우면 그 이름은 폴링이 다시 와도 안 나온다(발급 열림이어도)
  const live = await svc.deleteTicket(EK, f.tickets.find((x) => x.number === 2)!.id);
  assert.deepEqual(live.blocked.map((b) => [b.nameKey, b.name]), [['이하나', '이하나']]);
  const again = await svc.guest(EK, D2, '이하나');
  assert.deepEqual([again.ticketsOpen, again.ticket], [true, null]);
  assert.equal(f.tickets.length, 1);
  // 없는 이름을 풀어도 그대로 성공 · 빈 이름은 400
  await svc.unblockTicket(EK, '없는사람');
  await assert.rejects(svc.unblockTicket(EK, '  '), /이름을 확인/);
  assert.equal((await svc.live(EK)).blocked.length, 1);

  // 풀면 다시 받는다(새 번호)
  const unblocked = await svc.unblockTicket(EK, '이 하나');
  assert.deepEqual(unblocked.blocked, []);
  assert.equal((await svc.guest(EK, D2, '이하나')).ticket!.number, 2);
});

// ───────────── 3차(261122) — 응모권 계정 연결 · 당첨 푸시 ─────────────

test('계정 연결 — 손님 표·응모권에 userId · null 로 안 지움 · 받은 기기만 바꿈 · 빈 칸은 다른 기기도 채움', async () => {
  const f = fakeLivePrisma();
  const svc = liveService(f.prisma);
  const EK = 'wmak-2026' as const;
  f.state.set(`${EK}:tickets`, { mode: 'open' });
  const g = (d: string) => f.guestRows.get(`${EK}:${d}`);

  await svc.guest(EK, D1, '김솔', undefined, 'u1');
  assert.equal(g(D1).userId, 'u1');
  assert.equal(f.tickets[0].userId, 'u1');

  // 토큰 없는 요청 — 1분 묶음이 지나도(touched 비움) 계정은 그대로
  (svc as any).touched.clear();
  f.tickets[0].lastSeenAt = new Date(0);
  await svc.guest(EK, D1, '김솔');
  assert.equal(g(D1).userId, 'u1');
  assert.equal(f.tickets[0].userId, 'u1');
  assert.ok(f.tickets[0].lastSeenAt.getTime() > 0); // lastSeenAt 은 그대로 갱신

  // 다른 기기·같은 이름·다른 계정 — 손님 표는 그 기기 계정, 응모권은 받은 기기 계정 그대로
  await svc.guest(EK, D2, '김 솔', undefined, 'u2');
  assert.equal(g(D2).userId, 'u2');
  assert.equal(f.tickets[0].userId, 'u1');
  // 받은 기기에서 다른 계정으로 — 그 계정으로 바뀜
  await svc.guest(EK, D1, '김솔', undefined, 'u3');
  assert.equal(f.tickets[0].userId, 'u3');
  assert.equal(g(D1).userId, 'u3');

  // 로그인 없이 받은 응모권(계정 빈 칸)은 같은 이름으로 들어온 다른 기기 계정이 채운다
  const t2 = await svc.guest(EK, D3, '이하나');
  assert.equal(t2.ticket!.number, 2);
  assert.equal(f.tickets[1].userId, null);
  await svc.guest(EK, D2, '이하나', undefined, 'u2');
  assert.equal(f.tickets[1].userId, 'u2');
  assert.equal(f.tickets.length, 2);
});

test('계정 연결 — 1분 묶음이 처음 온 계정을 삼키지 않음', async () => {
  const f = fakeLivePrisma();
  const svc = liveService(f.prisma);
  const EK = 'wmak-2026' as const;
  f.state.set(`${EK}:tickets`, { mode: 'closed' });
  await svc.guest(EK, D1, '박병준');
  assert.equal(f.guests.length, 1);
  assert.equal(f.guestRows.get(`${EK}:${D1}`).userId, null);
  // 바로 다음 요청에 계정이 처음 옴 → 묶지 않고 쓴다
  await svc.guest(EK, D1, '박병준', undefined, 'u9');
  assert.equal(f.guests.length, 2);
  assert.equal(f.guestRows.get(`${EK}:${D1}`).userId, 'u9');
  // 같은 계정 · 계정 없는 요청은 1분 안이면 건너뜀
  await svc.guest(EK, D1, '박병준', undefined, 'u9');
  await svc.guest(EK, D1, '박병준');
  assert.equal(f.guests.length, 2);
  assert.equal(f.guestRows.get(`${EK}:${D1}`).userId, 'u9');
  // 다른 계정이면 다시 쓴다
  await svc.guest(EK, D1, '박병준', undefined, 'u10');
  assert.equal(f.guests.length, 3);
  assert.equal(f.guestRows.get(`${EK}:${D1}`).userId, 'u10');
});

test('당첨 푸시 — 커밋 뒤 당첨자 계정에 한 번 · 이벤트 탭으로 · 무효는 안 보냄 · 계정 없으면 안 보냄', async () => {
  const f = fakeLivePrisma();
  const n = fakeNotifications();
  const warns: string[] = [];
  const svc = liveService(f.prisma, n, warns);
  const EK = 'wmak-2026' as const;
  f.state.set(`${EK}:tickets`, { mode: 'open' });
  await svc.guest(EK, D1, '김솔', undefined, 'u1');

  const won = await svc.draw(EK, '횡성한우세트');
  await settle();
  assert.equal(n.calls.length, 1);
  const c = n.calls[0];
  assert.equal(c.userId, 'u1');
  assert.equal(c.type, 'system');
  assert.equal(c.data.url, '/reception/event');
  assert.deepEqual([c.data.type, c.data.drawId, c.data.eventKey], ['reception_draw', won.draw.id, EK]);
  assert.match(c.body, /횡성한우세트에 당첨됐어요/);
  // 알림톡 템플릿에 걸리는 말이 없다(biztalk resolveTemplate)
  assert.doesNotMatch(`${c.title} ${c.body}`, /채팅|님의 메시지|견적|섭외|예약이 확정|결제가 완료|오늘 행사가/);
  await svc.cancelDraw(EK, won.draw.id);
  await settle();
  assert.equal(n.calls.length, 1);

  // 계정 없는 응모권 · 손님 표에도 계정 없음 → 안 보내고 기록만
  await svc.guest(EK, D2, '이하나');
  const none = await svc.draw(EK, '체스타필드 정장 세트');
  await settle();
  assert.equal(none.draw.name, '이하나');
  assert.equal(n.calls.length, 1);
  assert.ok(warns.some((w) => w.includes('no account')));
});

test('당첨 푸시 — 응모권 계정이 비면 받은 기기 손님 표 → 같은 이름 손님 표(하나로 모일 때만) · 경품 이름에 알림톡 말이 섞이면 뺌', async () => {
  const f = fakeLivePrisma();
  const n = fakeNotifications();
  const svc = liveService(f.prisma, n);
  const EK = 'wmak-2026' as const;
  f.state.set(`${EK}:tickets`, { mode: 'open' });

  // 받은 기기 손님 표의 계정
  await svc.guest(EK, D1, '가');
  f.guestRows.get(`${EK}:${D1}`).userId = 'ud';
  await svc.draw(EK, '채팅 상품권');
  await settle();
  assert.deepEqual(n.calls.map((x) => x.userId), ['ud']);
  assert.doesNotMatch(n.calls[0].body, /채팅/);

  // 같은 이름 손님 표(다른 기기) — 계정이 하나면 그 계정
  f.tickets.push({ id: 'tx', eventKey: EK, number: 50, nameKey: '나', name: '나', deviceId: 'gone', userId: null, createdAt: new Date(), lastSeenAt: new Date() });
  await svc.guest(EK, D2, '나 ', undefined, 'un');
  f.tickets.find((t) => t.id === 'tx').userId = null; // 응모권엔 계정이 안 붙은 경우
  await svc.draw(EK, '경품');
  await settle();
  assert.deepEqual(n.calls.map((x) => x.userId), ['ud', 'un']);

  // 같은 이름 계정이 둘이면(다른 사람일 수 있음) 안 보냄
  f.tickets.push({ id: 'ty', eventKey: EK, number: 51, nameKey: '다', name: '다', deviceId: 'gone', userId: null, createdAt: new Date(), lastSeenAt: new Date() });
  f.guestRows.set(`${EK}:a`, { eventKey: EK, deviceId: 'a', name: '다', userId: 'ua', lastSeenAt: new Date() });
  f.guestRows.set(`${EK}:b`, { eventKey: EK, deviceId: 'b', name: '다', userId: 'ub', lastSeenAt: new Date() });
  await svc.draw(EK, '경품');
  await settle();
  assert.equal(n.calls.length, 2);
});

test('당첨 푸시 — 무대 발표 뒤로 늦춰 보냄 · 그 사이 무효로 돌리면 안 보냄', async () => {
  const f = fakeLivePrisma();
  const n = fakeNotifications();
  const svc = liveService(f.prisma, n, [], 30);
  const EK = 'wmak-2026' as const;
  f.state.set(`${EK}:tickets`, { mode: 'open' });
  await svc.guest(EK, D1, '김솔', undefined, 'u1');
  await svc.guest(EK, D2, '이하나', undefined, 'u2');
  const first = await svc.draw(EK, '횡성한우세트');
  assert.equal(n.calls.length, 0); // 추첨 응답은 푸시를 기다리지 않는다
  await svc.cancelDraw(EK, first.draw.id);
  const second = await svc.draw(EK, '횡성한우세트');
  await settle(80);
  assert.deepEqual(n.calls.map((x) => x.data.drawId), [second.draw.id]);
});

test('당첨 푸시 — 알림이 터져도 추첨은 그대로 성공', async () => {
  const f = fakeLivePrisma();
  const n = fakeNotifications(true);
  const warns: string[] = [];
  const svc = liveService(f.prisma, n, warns);
  const EK = 'wmak-2026' as const;
  f.state.set(`${EK}:tickets`, { mode: 'open' });
  await svc.guest(EK, D1, '김솔', undefined, 'u1');
  const won = await svc.draw(EK, '횡성한우세트');
  await settle();
  assert.equal(won.draw.name, '김솔');
  assert.equal(won.board.draws.length, 1);
  assert.equal(n.calls.length, 1);
  assert.ok(warns.some((w) => w.includes('push failed')));
});

test('계정 연결 — 공용 폰에서 다른 이름(다른 사람)은 받은 사람 응모권 계정을 바꾸지 않음(빈 칸만 채움)', async () => {
  const f = fakeLivePrisma();
  const svc = liveService(f.prisma);
  const EK = 'wmak-2026' as const;
  f.state.set(`${EK}:tickets`, { mode: 'open' });
  await svc.guest(EK, D1, '김솔', undefined, 'u1');
  // 같은 폰에 다른 사람이 자기 계정·자기 이름으로 — 기기 한 장 규칙상 보이는 건 김솔 응모권이지만 계정은 그대로
  const shown = await svc.guest(EK, D1, '이하나', undefined, 'u2');
  assert.equal(shown.ticket!.number, 1);
  assert.equal(f.tickets.length, 1);
  assert.equal(f.tickets[0].userId, 'u1');
  // 계정 빈 응모권이면 채운다(로그인 없이 받고 이름을 고쳐 넣은 본인일 수 있음)
  f.tickets[0].userId = null;
  await svc.guest(EK, D1, '이하나', undefined, 'u2');
  assert.equal(f.tickets[0].userId, 'u2');
});

test('당첨 푸시 — 알림 서비스가 주입 안 돼도(모듈 imports 누락) 추첨은 그대로 · 기록만', async () => {
  const f = fakeLivePrisma();
  const warns: string[] = [];
  const svc = liveService(f.prisma, undefined, warns);
  (svc as any).notifications = undefined;
  const EK = 'wmak-2026' as const;
  f.state.set(`${EK}:tickets`, { mode: 'open' });
  await svc.guest(EK, D1, '김솔', undefined, 'u1');
  const won = await svc.draw(EK, '횡성한우세트');
  await settle();
  assert.equal(won.draw.name, '김솔');
  assert.ok(warns.some((w) => w.includes('NotificationService missing')));
});

test('어드민 답 고치기 — 판정만 바꿀 땐 답·낸 사람 안 씀 · 없던 줄은 안 지움 · 답 바뀌면 판정 버림', async () => {
  const EK = 'wmak-2026' as const;
  let row: { answer: string | null; correct: boolean | null } | null = null;
  const upserts: any[] = [];
  const deletes: any[] = [];
  const tx: any = {
    // 잠그고 읽기(FOR UPDATE) — 지금 줄
    $queryRaw: async (strings: TemplateStringsArray) => {
      assert.match(strings.join('?'), /FOR UPDATE/);
      return row ? [{ ...row }] : [];
    },
    receptionQuizAnswer: {
      upsert: async (args: any) => { upserts.push(args); return {}; },
      deleteMany: async (args: any) => { deletes.push(args); return { count: 1 }; },
    },
  };
  const prisma: any = {
    $transaction: async (fn: any) => fn(tx),
    receptionState: { findUnique: async () => null, findMany: async () => [] },
    receptionQuizAnswer: { findMany: async () => [] },
  };
  const svc = new ReceptionQuizService(prisma);

  // 판정만 — update 에 answer·name·deviceId 없음(그 사이 손님 답을 덮지 않게)
  row = { answer: '피자헛', correct: null };
  await svc.adminAnswer(EK, { questionId: 'r1q1', table: 5, correct: true });
  assert.deepEqual(upserts[0].update, { correct: true });
  assert.equal(upserts[0].create.answer, '피자헛');

  // 답이 바뀌면 판정 버리고 낸 사람 = 운영팀
  row = { answer: 'freetifull', correct: false };
  await svc.adminAnswer(EK, { questionId: 'r1q1', table: 5, answer: 'freetiful' });
  assert.deepEqual(upserts[1].update, { correct: null, answer: 'freetiful', name: '운영팀', deviceId: null });
  // 같은 답이면 판정 그대로
  row = { answer: 'freetiful', correct: true };
  await svc.adminAnswer(EK, { questionId: 'r1q1', table: 5, answer: 'freetiful' });
  assert.deepEqual(upserts[2].update, { correct: true, answer: 'freetiful' });

  // 답도 판정도 없게 되면 — 있던 줄만 지운다
  row = null;
  await svc.adminAnswer(EK, { questionId: 'r1q1', table: 5, correct: null });
  assert.equal(deletes.length, 0);
  row = { answer: null, correct: true };
  await svc.adminAnswer(EK, { questionId: 'r3q3', table: 5, correct: null });
  assert.equal(deletes.length, 1);
  assert.equal(upserts.length, 3);
});

// ───────────── 2차 회식 참여(261122 설문 첫 질문) ─────────────

test('설문 — 2차 회식 참여: 없으면 그대로 통과(옛 화면) · yes/no 만 · 이상한 값은 400 이유', () => {
  const base = { rating: 5, again: 'yes', best: '', comment: '' };
  assert.deepEqual(parseSurvey(base), { rating: 5, again: 'yes', best: '', comment: '' });
  assert.equal('afterParty' in (parseSurvey(base) as object), false);
  assert.equal('afterParty' in (parseSurvey({ ...base, afterParty: null }) as object), false);
  assert.deepEqual(parseSurvey({ ...base, afterParty: 'yes' }), { afterParty: 'yes', rating: 5, again: 'yes', best: '', comment: '' });
  assert.equal((parseSurvey({ ...base, afterParty: 'no' }) as { afterParty?: string }).afterParty, 'no');
  for (const bad of ['maybe', '', 'YES', 1, true]) assert.equal(parseSurvey({ ...base, afterParty: bad }), '2차 회식 참여 여부를 골라 주세요.');
  // 2차 칸이 맞아도 다른 칸이 틀리면 그 이유
  assert.equal(parseSurvey({ afterParty: 'yes', rating: 0, again: 'yes' }), '만족도를 골라 주세요.');
});

/** 손님 표 · 설문 — 2차 회식 저장 흉내(upsert 의 create/update 그대로, 원시 SQL = 설문 답 afterParty 고치기) */
function fakeAfterPartyPrisma() {
  const guests = new Map<string, any>();
  const surveys = new Map<string, any>();
  const k = (w: any) => `${w.eventKey_deviceId.eventKey}:${w.eventKey_deviceId.deviceId}`;
  const prisma: any = {
    receptionGuest: {
      findUnique: async ({ where }: any) => {
        const g = guests.get(k(where));
        return g ? { afterParty: g.afterParty ?? null, afterPartyAt: g.afterPartyAt ?? null } : null;
      },
      upsert: async ({ where, create, update }: any) => {
        const prev = guests.get(k(where));
        const row = prev ? Object.assign(prev, update) : { userId: null, afterParty: null, afterPartyAt: null, ...create };
        guests.set(k(where), row);
        return row;
      },
    },
    receptionSurvey: {
      findUnique: async ({ where }: any) => surveys.get(k(where)) ?? null,
      upsert: async ({ where, create, update }: any) => {
        const prev = surveys.get(k(where));
        const row = prev ? Object.assign(prev, update, { updatedAt: new Date() }) : { ...create, createdAt: new Date(), updatedAt: new Date() };
        surveys.set(k(where), row);
        return row;
      },
    },
    // UPDATE reception_surveys … jsonb_set — 값 순서 = going, eventKey, deviceId, going(같으면 건너뛰는 비교)
    $executeRaw: async (strings: TemplateStringsArray, ...values: any[]) => {
      const sql = strings.join('?');
      assert.match(sql, /UPDATE "reception_surveys"/);
      assert.doesNotMatch(sql, /updatedAt/);
      const [going, eventKey, deviceId] = values;
      const row = surveys.get(`${eventKey}:${deviceId}`);
      if (!row) return 0;
      row.answers = { ...row.answers, afterParty: going };
      return 1;
    },
  };
  return { prisma, guests, surveys };
}

test('2차 회식 — 누르는 순간 손님 표(줄 없으면 만듦 · 이름 맞춤) · 같은 답은 시각 그대로 · 설문과 어긋나지 않게', async () => {
  const f = fakeAfterPartyPrisma();
  const svc = service(f.prisma);
  const EK = 'wmak-2026';

  await assert.rejects(svc.setAfterParty(EK, D1, '', 'yes'), /이름을 먼저/);
  await assert.rejects(svc.setAfterParty(EK, D1, '김솔', 'maybe'), /2차 회식 참여 여부/);
  assert.equal(f.guests.size, 0);

  // 설문 전 — 손님 표 줄을 만들고 2차 = yes
  const first = await svc.setAfterParty(EK, D1, ' 김솔 ', 'yes');
  assert.equal(first.afterParty, 'yes');
  const g = f.guests.get(`${EK}:${D1}`);
  assert.equal(g.name, '김솔');
  assert.equal(g.afterParty, 'yes');
  assert.equal(g.afterPartyAt.toISOString(), first.afterPartyAt);
  assert.deepEqual((await svc.getSurvey(EK, D1)).afterParty, 'yes');
  assert.equal((await svc.getSurvey(EK, D1)).survey, null);

  // 같은 답 다시 — 시각 그대로(어드민 판 순서가 안 튐), 이름은 마지막 것
  await new Promise((r) => setTimeout(r, 3));
  const again = await svc.setAfterParty(EK, D1, '김 솔', 'yes');
  assert.equal(again.afterPartyAt, first.afterPartyAt);
  assert.equal(g.name, '김 솔');

  // 옛 화면으로 설문(2차 칸 없음) — 먼저 눌러 둔 2차 답이 설문에도 들어간다
  await svc.saveSurvey(EK, D1, '김솔', { rating: 5, again: 'yes' });
  assert.equal(f.surveys.get(`${EK}:${D1}`).answers.afterParty, 'yes');

  // 설문 낸 뒤 2차만 바꿈 — 손님 표 + 설문 답 둘 다, 설문 updatedAt 은 그대로
  const surveyAt = f.surveys.get(`${EK}:${D1}`).updatedAt;
  await new Promise((r) => setTimeout(r, 3));
  const changed = await svc.setAfterParty(EK, D1, '김솔', 'no');
  assert.notEqual(changed.afterPartyAt, first.afterPartyAt);
  assert.equal(g.afterParty, 'no');
  assert.equal(f.surveys.get(`${EK}:${D1}`).answers.afterParty, 'no');
  assert.equal(f.surveys.get(`${EK}:${D1}`).updatedAt, surveyAt);

  // 설문에 2차를 담아 내면 손님 표도 맞춘다(다른 기기는 손님 표 줄이 새로 생김)
  const res = await svc.saveSurvey(EK, D2, '이하나', { afterParty: 'yes', rating: 4, again: 'maybe' });
  assert.equal(res.afterParty, 'yes');
  assert.equal(f.guests.get(`${EK}:${D2}`).afterParty, 'yes');
  assert.equal(f.guests.get(`${EK}:${D2}`).name, '이하나');
  await assert.rejects(svc.saveSurvey(EK, D2, '이하나', { afterParty: 'later', rating: 4, again: 'maybe' }), /2차 회식 참여 여부/);
  assert.deepEqual(await svc.getAfterParty(EK, D3), { afterParty: null, afterPartyAt: null });
});

test('설문 화면 2차 회식 — 같은 이름 기기 여럿은 한 사람(마지막 답) · 설문 낸 기록은 어느 기기든 · 이름 없는 기기는 따로', async () => {
  const T = (m: number) => new Date(Date.parse('2026-11-23T20:00:00+09:00') + m * 60_000);
  const prisma = {
    receptionGuest: { findMany: async () => [
      { deviceId: 'a', name: '김솔', createdAt: T(0), lastSeenAt: T(5), afterParty: 'yes', afterPartyAt: T(1) },
      { deviceId: 'b', name: '김 솔', createdAt: T(0), lastSeenAt: T(5), afterParty: 'yes', afterPartyAt: T(3) },
      { deviceId: 'c', name: '이하나', createdAt: T(0), lastSeenAt: T(5), afterParty: 'yes', afterPartyAt: T(2) },
      { deviceId: 'd', name: '이하나', createdAt: T(0), lastSeenAt: T(5), afterParty: 'no', afterPartyAt: T(4) },
      { deviceId: 'e', name: '', createdAt: T(0), lastSeenAt: T(5), afterParty: 'yes', afterPartyAt: T(0) },
    ] },
    receptionVote: { groupBy: async () => [] },
    receptionSurvey: { findMany: async () => [{ deviceId: 'a', name: '김솔', answers: { rating: 5, again: 'yes' }, createdAt: T(2), updatedAt: T(2) }] },
  };
  const svc = service(prisma);
  (svc as any).feedRows = async () => [];
  const o: any = await svc.adminOverview('wmak-2026');
  assert.deepEqual(o.summary.afterParty, { yes: 2, no: 1, noSurvey: 1 });
  assert.deepEqual(o.afterParty.map((p: any) => [p.deviceId, p.afterParty, !!p.surveyAt]), [['d', 'no', false], ['b', 'yes', true], ['e', 'yes', false]]);
});

test('오프닝 주관식 — 아무 답이나 받고 · 채점 · 점수 · O/X 없음 · 공개 땐 테이블 답만', () => {
  const o1 = quizQuestion('r0q1')!;
  assert.deepEqual(parseQuizAnswer(o1, '  차은우 '), { answer: '차은우' });
  assert.equal(autoCorrect(o1, '차은우'), false);
  assert.equal(finalCorrect(o1, '차은우', true), false); // 어드민 O 가 남아 있어도 맞힘 아님
  const rows = [row('r0q1', 3, '차은우', true), row('r0q2', 3, '올해 제일 열심히 일해서'), row('r1q1', 4, 'freetiful')];
  const ids = quizBoardIds({ revealed: ['r0q1', 'r0q2', 'r1q1'] });
  assert.ok(!ids.includes('r0q1') && !ids.includes('r0q2') && ids.includes('r1q1'));
  const board = quizBoard(rows, QUIZ_QUESTIONS.map((x) => x.id)); // 전 문제를 넣어도 오프닝은 0
  assert.deepEqual(board.find((b) => b.table === 3), { table: 3, score: 0, correct: 0 });
  assert.deepEqual(board[0], { table: 4, score: 100, correct: 1 });
  const shared = quizPublicShared({ ...defaultQuizState(), currentId: 'r0q1', phase: 'revealed', revealed: ['r0q1'] }, rows);
  const t3 = shared.results.r0q1.tables.find((t) => t.table === 3)!;
  assert.deepEqual([t3.display, t3.correct], ['차은우', false]);
  assert.equal(shared.questions[0].open, true);
  assert.equal(shared.questions[0].answerLabel, '');
  const adminT3 = quizAdmin(defaultQuizState(), rows).results.r0q1.tables.find((t) => t.table === 3)!;
  assert.deepEqual([adminT3.override, adminT3.correct, adminT3.auto], [null, false, false]);
});

test('2부 이름 다시 받기 — 자동은 2부 시작부터 · 지금 받기는 누른 때가 회차 · 끄기 · 모양 틀리면 자동', () => {
  const { NAME_CHECK_AUTO_AT, nameCheckId, parseNameCheck } = require('./reception.rules') as typeof import('./reception.rules');
  const before = NAME_CHECK_AUTO_AT - 60_000;
  const after = NAME_CHECK_AUTO_AT + 60_000;
  const auto = parseNameCheck(null);
  assert.deepEqual(auto, { mode: 'auto', at: null });
  assert.equal(nameCheckId(auto, before), '');
  assert.equal(nameCheckId(auto, after), new Date(NAME_CHECK_AUTO_AT).toISOString());
  const now = parseNameCheck({ mode: 'now', at: '2026-11-23T10:05:00.000Z' });
  assert.equal(nameCheckId(now, before), '2026-11-23T10:05:00.000Z');
  assert.equal(nameCheckId(now, after), '2026-11-23T10:05:00.000Z'); // 자동 시각이 지나도 누른 회차 그대로(두 번 안 물음)
  assert.equal(nameCheckId(parseNameCheck({ mode: 'off' }), after), '');
  assert.deepEqual(parseNameCheck({ mode: 'now' }), { mode: 'auto', at: null }); // 시각 없는 now = 자동
  assert.deepEqual(parseNameCheck({ mode: 'weird', at: 'x' }), { mode: 'auto', at: null });
  assert.equal(new Date(NAME_CHECK_AUTO_AT).toISOString(), '2026-11-23T10:40:00.000Z'); // 19:40 KST
});

test('미션 도전 테이블 — 지금 문제가 미션일 때만 · 도전 줄과 운영팀 성공 줄 · 테이블 순 · 공개 전에도', () => {
  const { missionChallengers } = require('./reception-quiz') as typeof import('./reception-quiz');
  const rows = [
    row('r3q3', 9, MISSION_CHALLENGE, null, '박팀장'),
    row('r3q3', 2, MISSION_CHALLENGE, true, '김대표'),
    row('r3q3', 5, null, true, ''), // 도전 없이 운영팀이 성공
    row('r3q3', 7, null, false, ''), // 결과만 실패 — 수락 안 함
    row('r1q1', 4, 'freetiful'),
  ];
  const open = { ...defaultQuizState(), currentId: 'r3q3', phase: 'open' as const };
  assert.deepEqual(missionChallengers(open, rows), [
    { table: 2, name: '김대표', seat: null, result: 'success' },
    { table: 5, name: '', seat: null, result: 'success' },
    { table: 9, name: '박팀장', seat: null, result: 'pending' },
  ]);
  assert.equal(missionChallengers({ ...open, currentId: 'r1q1' }, rows), undefined);
  assert.equal(missionChallengers(defaultQuizState(), rows), undefined);
  assert.equal(quizPublicShared(open, rows).challengers?.length, 3);
  assert.equal('challengers' in quizPublicShared({ ...open, currentId: 'r1q1' }, rows), false);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { VOTE_LIMIT, cleanName, compareRank, parseDeviceId, parseSurvey } from './reception.rules';
import { ReceptionService } from './reception.service';

const D1 = '11111111-1111-4111-8111-111111111111';
const D2 = '22222222-2222-4222-8222-222222222222';

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

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ReceptionLiveService, matchTickets, type SeatList } from './reception-live.service';
import {
  MISSION_CHALLENGE,
  MissionResult,
  QuizBoardRow,
  missionResult,
  parseQuizState,
  parseQuizBonus,
  quizBoard,
  quizBoardIds,
  quizQuestion,
} from './reception-quiz';
import {
  ReceptionEventKey,
  TicketBlock,
  TicketsMode,
  baseNameKey,
  compareRank,
  isTicketsMode,
  nameKey,
  parseTicketBlocks,
  ticketsOpen,
} from './reception.rules';

/**
 * 송년회 참여자 판(261122 사장 '참여자는 내가 자리를 전부 줬잖아 거기에 모든 리스트가 다 뜨는거야 · 앱에 이름을 입력하면
 * 어드민에 실시간으로 해당 테이블이 최상단으로 · 은은한 하늘색 · 이름 옆에 도착 태그 · 럭키드로우·이벤트 참여하면 태그·색이 바뀌고 위로').
 *  · 한 줄 = 한 사람 = 자리 명단 한 줄(reception_seats, 동명이인도 줄마다 따로) + 명단 밖에서 와 응모권을 받은 사람.
 *  · 도착 = 그 사람 응모권이 나온 때(예전 '입장 현황'과 같은 규칙 — 손님이 자리 탭에 이름을 넣으면 응모권 한 장 = 도착).
 *  · 기기 → 사람은 이름으로(로그인 없음): 손님 표 이름(없으면 설문 · 사진 · 퀴즈 답에 적힌 이름) → 이름 열쇠 → 이 기기 응모권이 정한 줄 →
 *    명단의 그 이름 줄(동명이인인데 이 기기 응모권이 없으면 첫 줄) → (이름이 명단 · 응모권 어디에도 없으면) 이 기기 응모권 주인
 *    (어드민이 이름을 고친 뒤 옛 이름이 남은 폰) → 명단 밖이면 'x:이름열쇠'(같은 이름 기기끼리 합침).
 *  · 명단 밖 사람은 응모권이 있을 때만 판에 남긴다(= 도착한 walk-in). 11/08부터 쌓인 시험 기기('테스트' · 'ㅇㅇ' 등)가
 *    '명단 밖 · 아직' 줄로 영영 남아 미도착 수를 부풀리지 않게 — 사장 '내가 자리를 준 명단이 다 뜨는 것'(fix 261122).
 *  · 퀴즈 시각 = 손님이 낸 때. 어드민이 O/X 를 매기면(판정만) @updatedAt 이 그 탭 시각으로 밀리므로, 판정이 붙은 줄은
 *    createdAt(그 테이블이 처음 낸 때)을 쓴다 — 운영자가 채점할 때마다 그 테이블 사람이 '퀴즈 참여'로 맨 위에 튀지 않게(quizRowAt).
 *  · (261122 사장 '퀴즈에 도전 버튼 → 참여자 명단에 실패 성공 버튼 → 성공이면 몇점 올라가게 테이블에') 스페셜 미션 도전 줄(answer '도전')은
 *    퀴즈 수에 안 세고 challenges 로 따로 — 도전한 기기의 사람 줄에 붙는다(id 로 판정 · 시각 = 도전한 때 createdAt, 판정해도 안 밀림).
 *    quizScores = 테이블별 퀴즈 점수(손님 점수판과 같은 규칙: 공개된 문제 + 미션) — 성공을 찍으면 그 테이블 점수가 바로 오른다.
 *  · 태그·색·줄 순서(누가 맨 위인지)는 웹(receptionAdmin.ts personStage)이 이 값으로 정한다 — 서버는 시각만 준다.
 * 태블릿 한 대가 2초마다 부른다 — 열 개 남짓 가벼운 조회를 한 번에, 1초 묶음(겹친 요청은 같은 결과). ?fresh=1 = 묶음 건너뛰기(어드민이 고친 직후).
 */

export interface PersonPhoto {
  thumbUrl: string;
  imageUrl: string;
  /** 1부터 — 공감 → 좋아요 → 먼저 올린 순(손님 화면과 같은 순위) */
  rank: number;
  likes: number;
  empathies: number;
  at: string;
}

/** 스페셜 미션 도전(테이블 대표 1명) — id 로 판정(PUT quiz/challenge) */
export interface PersonChallenge {
  /** 퀴즈 답 줄 id */
  id: string;
  questionId: string;
  title: string;
  table: number;
  /** 성공하면 받는 점수(문제 점수) */
  points: number;
  result: MissionResult;
  /** 도전한 때 */
  at: string;
}

export interface PersonRow {
  /** 명단 줄 = 그 줄 nameKey(동명이인은 '이름열쇠 @테이블'), 명단 밖 = 'x:' + 이름열쇠 */
  key: string;
  name: string;
  listed: boolean;
  table: number | null;
  seat: number | null;
  /** 응모권이 나온 때(= 도착). 없으면 아직 안 옴 */
  arrivedAt: string | null;
  ticket: { id: string; number: number } | null;
  /** 이 사람 기기가 낸 퀴즈 답(테이블당 한 줄 · 마지막 낸 사람 것이라 테이블 친구가 덮으면 빠질 수 있다) — 마지막 낸 시각(quizRowAt) · 줄 수 */
  quizAt: string | null;
  quizCount: number;
  /** 이 사람 기기의 살아 있는 사진(여럿이면 순위 높은 것) */
  photo: PersonPhoto | null;
  /** 좋아요·공감을 마지막으로 누른 때 · 누른 수(지금 남아 있는 것) */
  votedAt: string | null;
  likesUsed: number;
  empathiesUsed: number;
  surveyAt: string | null;
  /** 무효 안 된 마지막 추첨 */
  win: { prize: string; at: string } | null;
  /** 스페셜 미션 도전(먼저 한 것 위) */
  challenges: PersonChallenge[];
  /** 2차 회식 참여(설문 첫 질문 — 누르는 순간 손님 표에 저장). 기기 여럿이면 마지막에 고른 것. 안 골랐으면 null */
  afterParty: { going: 'yes' | 'no'; at: string | null } | null;
  devices: number;
  lastSeenAt: string | null;
}

export interface ReceptionPeople {
  serverTime: string;
  ticketsMode: TicketsMode;
  ticketsOpen: boolean;
  /** 응모권을 지운 이름(최근 위) — 입장 현황(live)의 blocked 와 같은 것 */
  blocked: TicketBlock[];
  people: PersonRow[];
  /** 테이블 퀴즈 점수(손님 점수판과 같음 — 공개된 문제 + 미션) */
  quizScores: QuizBoardRow[];
}

/* ─── 순수 계산(buildPeople) 입력 — Prisma 와 떼어 단위 시험이 되게 ─── */

export interface PeopleTicket {
  id: string;
  number: number;
  nameKey: string;
  name: string;
  deviceId: string;
  createdAt: Date;
  lastSeenAt: Date;
  win: { prize: string; at: Date } | null;
}

export interface PeopleInput {
  seats: SeatList;
  tickets: ReadonlyArray<PeopleTicket>;
  guests: ReadonlyArray<{ deviceId: string; name: string; lastSeenAt: Date; afterParty?: string | null; afterPartyAt?: Date | null }>;
  /** 살아 있는 사진만(지운 것 X) */
  photos: ReadonlyArray<{ id: string; deviceId: string; name: string; thumbUrl: string; imageUrl: string; createdAt: Date }>;
  /** 사진별 받은 수(groupBy photoId · kind) */
  photoVotes: ReadonlyArray<{ photoId: string; kind: string; count: number }>;
  /** 기기별 누른 수 · 마지막 누른 때(groupBy voterDeviceId · kind) */
  voterVotes: ReadonlyArray<{ deviceId: string; kind: string; count: number; lastAt: Date | null }>;
  surveys: ReadonlyArray<{ deviceId: string; name: string; updatedAt: Date }>;
  /** 퀴즈 답 줄(테이블당 한 줄 · deviceId = 마지막 낸 사람). correct · createdAt 은 quizRowAt 용(없으면 updatedAt 그대로) */
  quiz: ReadonlyArray<PeopleQuizRow>;
}

export interface PeopleQuizRow {
  deviceId: string;
  name: string | null;
  updatedAt: Date;
  createdAt?: Date;
  /** 어드민 O/X 판정(null = 자동 채점) */
  correct?: boolean | null;
  /** 미션 도전 가르기용(없으면 보통 퀴즈 답으로 셈) */
  id?: string;
  questionId?: string;
  tableNo?: number;
  answer?: string | null;
}

/** 이 줄이 스페셜 미션 도전인지 — 미션 문제 + answer '도전' */
export function isChallengeRow(r: Pick<PeopleQuizRow, 'questionId' | 'answer'>): boolean {
  return r.answer === MISSION_CHALLENGE && quizQuestion(r.questionId)?.kind === 'mission';
}

/**
 * 퀴즈 답 줄의 '손님이 낸 시각'(순수).
 *  · 판정 없음(correct null) = updatedAt — 손님이 낼 때마다 CURRENT_TIMESTAMP 로 새로 찍힌다(답을 바꿔 다시 낸 것도 보인다).
 *  · 판정 있음 = createdAt — 어드민 O/X(판정만 고침, reception-quiz.service adminAnswer)는 deviceId 를 그대로 두고 @updatedAt 만 밀어서
 *    updatedAt 이 '채점한 때'가 된다. createdAt 은 판정 · 다시 내기로 안 바뀐다(그 테이블 첫 답 시각 — 테이블 친구가 덮어쓴 줄이면 몇 초~몇 분 이를 수 있음).
 *  · 손님이 답을 바꿔 내면 판정이 지워지므로(correct NULL) 다시 updatedAt 을 쓴다.
 */
export function quizRowAt(r: PeopleQuizRow): Date {
  return r.correct != null && r.createdAt ? r.createdAt : r.updatedAt;
}

interface Acc {
  row: PersonRow;
  ticketNo: number | null;
  photoRank: number;
  arrived: Date | null;
  lastSeen: Date | null;
  quiz: Date | null;
  voted: Date | null;
  survey: Date | null;
}

const later = (a: Date | null, b: Date | null) => (!a ? b : !b ? a : b > a ? b : a);
const iso = (d: Date | null) => (d ? d.toISOString() : null);

/**
 * 사람 목록 만들기(순수) — 명단 줄 전원 + 응모권이 있는 명단 밖 사람. 순서 = 명단(테이블 → 좌석 → 이름) 다음 명단 밖(응모권 번호 → 이름).
 * 응모권 → 줄은 matchTickets(열쇠가 딱 맞는 것 먼저, 그다음 이름이 하나뿐인 줄 — 입장 현황·추첨과 같은 규칙).
 */
export function buildPeople(input: PeopleInput): PersonRow[] {
  const { seats } = input;
  const people = new Map<string, Acc>();
  const add = (key: string, name: string, listed: boolean, table: number | null, seat: number | null): Acc => {
    const acc: Acc = {
      row: {
        key, name, listed, table, seat,
        arrivedAt: null, ticket: null, quizAt: null, quizCount: 0, photo: null,
        votedAt: null, likesUsed: 0, empathiesUsed: 0, surveyAt: null, win: null, challenges: [], afterParty: null, devices: 0, lastSeenAt: null,
      },
      ticketNo: null, photoRank: Infinity, arrived: null, lastSeen: null, quiz: null, voted: null, survey: null,
    };
    people.set(key, acc);
    return acc;
  };

  // 1) 명단 전원(아직 안 온 사람도)
  for (const r of seats.rows) add(r.nameKey, r.name, true, r.tableNo, r.seatNo);

  // 2) 응모권 = 도착 — 명단 줄에 붙이고, 못 붙인 것(명단 밖)은 'x:응모권열쇠' 사람으로
  const tickets = [...input.tickets].sort((a, b) => a.number - b.number);
  const rowOf = matchTickets(seats, tickets);
  const ticketPerson = new Map<string, Acc>();
  const ticketsByBase = new Map<string, PeopleTicket[]>();
  /** 기기 → 그 기기가 받은 응모권(한 기기 한 장 · 번호 빠른 것) — 어드민이 이름을 고친 뒤 옛 이름 기기를 찾아 붙이려고 */
  const ticketByDevice = new Map<string, PeopleTicket>();
  for (const t of tickets) {
    const row = rowOf.get(t.id);
    const key = row ? row.nameKey : `x:${t.nameKey}`;
    const p = people.get(key) ?? add(key, t.name, false, null, null);
    if (!p.row.ticket) {
      p.row.ticket = { id: t.id, number: t.number };
      p.ticketNo = t.number;
      p.arrived = t.createdAt;
      p.row.win = t.win ? { prize: t.win.prize, at: t.win.at.toISOString() } : null;
    }
    p.lastSeen = later(p.lastSeen, t.lastSeenAt);
    ticketPerson.set(t.id, p);
    const base = baseNameKey(t.nameKey);
    ticketsByBase.set(base, [...(ticketsByBase.get(base) || []), t]);
    if (!ticketByDevice.has(t.deviceId)) ticketByDevice.set(t.deviceId, t);
  }

  // 3) 기기 이름 — 손님 표 > 설문 > 사진 > 퀴즈 답(손님 표가 생기기 전에 참여한 기기도 빠지지 않게)
  const deviceName = new Map<string, string>();
  for (const g of input.guests) deviceName.set(g.deviceId, g.name);
  for (const list of [input.surveys, input.photos, input.quiz] as ReadonlyArray<ReadonlyArray<{ deviceId: string; name: string | null }>>) {
    for (const r of list) if (r.name && !deviceName.has(r.deviceId)) deviceName.set(r.deviceId, r.name);
  }

  // 4) 기기 → 사람
  const personOf = new Map<string, Acc>();
  for (const [deviceId, name] of deviceName) {
    const key = nameKey(name);
    if (!key) continue;
    const cands = ticketsByBase.get(key) || [];
    const rows = seats.byName.get(key) || [];
    const own = cands.find((t) => t.deviceId === deviceId);
    let p: Acc | undefined;
    if (own) p = ticketPerson.get(own.id); // 이 기기가 받은 응모권이 정한 줄(동명이인도 여기서 갈린다)
    else if (cands.length === 1 && rows.length <= 1) p = ticketPerson.get(cands[0].id); // 같은 사람 두 번째 폰
    else if (rows.length) p = people.get(rows[0].nameKey); // 명단 그 이름 줄(동명이인인데 못 가르면 첫 줄)
    else if (cands.length) p = ticketPerson.get(cands[0].id);
    // 이 이름은 명단에도 응모권에도 없는데 이 기기가 받은 응모권이 있다 = 어드민이 테이블 배치에서 이름을 고쳤고(응모권은 새 이름 줄로 옮겨짐)
    // 손님 폰엔 옛 이름이 남은 경우 — 'x:옛이름' 유령 줄을 만들지 않고 응모권 주인(새 이름 줄)에 퀴즈 · 설문 · 사진 · 2차 기록을 붙인다(fix 261123)
    if (!p && !rows.length && !cands.length) {
      const mine = ticketByDevice.get(deviceId);
      if (mine) p = ticketPerson.get(mine.id);
    }
    if (!p) p = people.get(`x:${key}`) ?? add(`x:${key}`, name, false, null, null);
    personOf.set(deviceId, p);
    p.row.devices += 1;
  }

  // 5) 모으기
  for (const g of input.guests) {
    const p = personOf.get(g.deviceId);
    if (!p) continue;
    p.lastSeen = later(p.lastSeen, g.lastSeenAt);
    // 2차 회식 — 이 사람 기기 중 마지막으로 고른 값(시각 없는 옛 줄은 시각 있는 값에 밀림)
    if (g.afterParty === 'yes' || g.afterParty === 'no') {
      const at = g.afterPartyAt ?? null;
      const cur = p.row.afterParty;
      const curAt = cur?.at ? Date.parse(cur.at) : -Infinity;
      if (!cur || (at ? at.getTime() : -Infinity) >= curAt) p.row.afterParty = { going: g.afterParty, at: at ? at.toISOString() : null };
    }
  }
  for (const q of input.quiz) {
    const p = personOf.get(q.deviceId);
    if (!p) continue;
    if (isChallengeRow(q)) {
      const question = quizQuestion(q.questionId)!;
      p.row.challenges.push({
        id: q.id || '',
        questionId: question.id,
        title: question.prompt,
        table: q.tableNo ?? 0,
        points: question.points,
        result: missionResult(q.correct),
        at: (q.createdAt ?? q.updatedAt).toISOString(),
      });
      continue;
    }
    p.row.quizCount += 1;
    p.quiz = later(p.quiz, quizRowAt(q));
  }
  for (const p of people.values()) if (p.row.challenges.length > 1) p.row.challenges.sort((a, b) => a.at.localeCompare(b.at));
  const tally = new Map<string, { likes: number; empathies: number }>();
  for (const v of input.photoVotes) {
    const t = tally.get(v.photoId) || { likes: 0, empathies: 0 };
    if (v.kind === 'like') t.likes += v.count;
    else if (v.kind === 'empathy') t.empathies += v.count;
    tally.set(v.photoId, t);
  }
  const ranked = input.photos
    .map((ph) => ({ ...ph, likes: tally.get(ph.id)?.likes || 0, empathies: tally.get(ph.id)?.empathies || 0 }))
    .sort(compareRank);
  ranked.forEach((ph, i) => {
    const p = personOf.get(ph.deviceId);
    if (!p || i + 1 >= p.photoRank) return;
    p.photoRank = i + 1;
    p.row.photo = { thumbUrl: ph.thumbUrl, imageUrl: ph.imageUrl, rank: i + 1, likes: ph.likes, empathies: ph.empathies, at: ph.createdAt.toISOString() };
  });
  for (const v of input.voterVotes) {
    const p = personOf.get(v.deviceId);
    if (!p) continue;
    if (v.kind === 'like') p.row.likesUsed += v.count;
    else if (v.kind === 'empathy') p.row.empathiesUsed += v.count;
    p.voted = later(p.voted, v.lastAt);
  }
  for (const s of input.surveys) {
    const p = personOf.get(s.deviceId);
    if (p) p.survey = later(p.survey, s.updatedAt);
  }

  const all = [...people.values()];
  for (const p of all) {
    p.row.arrivedAt = iso(p.arrived);
    p.row.quizAt = iso(p.quiz);
    p.row.votedAt = iso(p.voted);
    p.row.surveyAt = iso(p.survey);
    p.row.lastSeenAt = iso(p.lastSeen);
  }
  // 명단 줄은 seats.rows 순서(테이블 → 좌석 → 이름) 그대로, 명단 밖은 응모권 번호 → 이름.
  // 명단 밖인데 응모권이 없는 사람(이름만 넣은 시험 기기 등)은 뺀다 — 도착이 없으니 태그 · 순서 · 숫자 어디에도 안 쓰이고 '아직' 줄만 늘린다
  const listed = all.filter((p) => p.row.listed);
  // 단, 미션 도전 · 2차 참여 '예'를 한 사람은 남긴다(응모권이 막힌 명단 밖 손님이 도전하면 판정 단추가 사라지고 그 테이블이 막히지 않게)
  const unlisted = all
    .filter((p) => !p.row.listed && (p.row.ticket || p.row.challenges.length > 0 || p.row.afterParty?.going === 'yes'))
    .sort((a, b) => (a.ticketNo ?? Infinity) - (b.ticketNo ?? Infinity) || a.row.name.localeCompare(b.row.name, 'ko'));
  return [...listed, ...unlisted].map((p) => p.row);
}

/** 손님 화면이 쓰는 상태 열쇠 — reception-live.service.ts 와 같은 것(발급 모드 · 지운 이름) + 퀴즈 진행(reception-quiz.service.ts) */
const TICKETS_KEY = 'tickets';
const BLOCKS_KEY = 'ticket-blocks';
const QUIZ_KEY = 'quiz';
/** 퀴즈 추가 점수(reception-quiz.service.ts 와 같은 열쇠) */
const QUIZ_BONUS_KEY = 'quiz-bonus';
/** 태블릿 2초 폴링 — 1초 안 겹친 요청은 같은 조회 결과를 나눠 쓴다 */
const PEOPLE_CACHE_MS = 1000;

@Injectable()
export class ReceptionPeopleService {
  private readonly cache = new Map<string, { at: number; p: Promise<ReceptionPeople> }>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly live: ReceptionLiveService,
  ) {}

  /** 참여자 판 — fresh = 묶음 건너뛰기(응모권 지우기 · 발급 모드 바꾼 직후 바로 보이게) */
  people(eventKey: ReceptionEventKey, fresh = false): Promise<ReceptionPeople> {
    const hit = this.cache.get(eventKey);
    if (!fresh && hit && Date.now() - hit.at < PEOPLE_CACHE_MS) return hit.p;
    const entry = { at: Date.now(), p: this.load(eventKey) };
    this.cache.set(eventKey, entry);
    entry.p.catch(() => {
      if (this.cache.get(eventKey) === entry) this.cache.delete(eventKey);
    });
    return entry.p;
  }

  private async load(eventKey: ReceptionEventKey): Promise<ReceptionPeople> {
    // 칸은 꼭 필요한 것만 고른다(select) — 다른 작업이 표에 칸을 더해도(userId 등) 이 조회는 그대로
    const [seats, state, tickets, guests, photos, photoVotes, voterVotes, surveys, quiz] = await Promise.all([
      this.live.seatList(eventKey),
      this.prisma.receptionState.findMany({ where: { eventKey, key: { in: [TICKETS_KEY, BLOCKS_KEY, QUIZ_KEY, QUIZ_BONUS_KEY] } }, select: { key: true, value: true } }),
      this.prisma.receptionTicket.findMany({
        where: { eventKey },
        orderBy: { number: 'asc' },
        select: {
          id: true,
          number: true,
          nameKey: true,
          name: true,
          deviceId: true,
          createdAt: true,
          lastSeenAt: true,
          draws: { where: { cancelledAt: null }, orderBy: { createdAt: 'desc' }, take: 1, select: { prize: true, createdAt: true } },
        },
      }),
      this.prisma.receptionGuest.findMany({ where: { eventKey }, select: { deviceId: true, name: true, lastSeenAt: true, afterParty: true, afterPartyAt: true } }),
      this.prisma.receptionPhoto.findMany({
        where: { eventKey, deletedAt: null },
        select: { id: true, deviceId: true, name: true, thumbUrl: true, imageUrl: true, createdAt: true },
      }),
      this.prisma.receptionVote.groupBy({ by: ['photoId', 'kind'], where: { eventKey }, _count: { _all: true } }),
      this.prisma.receptionVote.groupBy({ by: ['voterDeviceId', 'kind'], where: { eventKey }, _count: { _all: true }, _max: { createdAt: true } }),
      this.prisma.receptionSurvey.findMany({ where: { eventKey }, select: { deviceId: true, name: true, updatedAt: true } }),
      // 점수판(quizScores)에 운영팀이 넣은 답(기기 없음)도 들어가야 해서 전부 — 사람 붙이기는 기기 있는 줄만
      this.prisma.receptionQuizAnswer.findMany({
        where: { eventKey },
        select: { id: true, questionId: true, tableNo: true, answer: true, deviceId: true, name: true, correct: true, createdAt: true, updatedAt: true },
      }),
    ]);

    const now = new Date();
    const rawMode = (state.find((s) => s.key === TICKETS_KEY)?.value as { mode?: unknown } | null)?.mode;
    const mode: TicketsMode = isTicketsMode(rawMode) ? rawMode : 'auto';
    const blocked = parseTicketBlocks(state.find((s) => s.key === BLOCKS_KEY)?.value).sort((a, b) => b.at.localeCompare(a.at));

    const people = buildPeople({
      seats,
      tickets: tickets.map((t) => ({
        id: t.id,
        number: t.number,
        nameKey: t.nameKey,
        name: t.name,
        deviceId: t.deviceId,
        createdAt: t.createdAt,
        lastSeenAt: t.lastSeenAt,
        win: t.draws[0] ? { prize: t.draws[0].prize, at: t.draws[0].createdAt } : null,
      })),
      guests,
      photos,
      photoVotes: photoVotes.map((v) => ({ photoId: v.photoId, kind: v.kind, count: v._count._all })),
      voterVotes: voterVotes.map((v) => ({ deviceId: v.voterDeviceId, kind: v.kind, count: v._count._all, lastAt: v._max.createdAt ?? null })),
      surveys,
      quiz: quiz.flatMap((q) =>
        q.deviceId
          ? [{
              deviceId: q.deviceId, name: q.name, correct: q.correct, createdAt: q.createdAt, updatedAt: q.updatedAt,
              id: q.id, questionId: q.questionId, tableNo: q.tableNo, answer: q.answer,
            }]
          : [],
      ),
    });
    const quizState = parseQuizState(state.find((s) => s.key === QUIZ_KEY)?.value);
    const quizScores = quizBoard(quiz, quizBoardIds(quizState), parseQuizBonus(state.find((s) => s.key === QUIZ_BONUS_KEY)?.value));

    return { serverTime: now.toISOString(), ticketsMode: mode, ticketsOpen: ticketsOpen(mode, now), blocked, people, quizScores };
  }
}

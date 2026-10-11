import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '@prisma/client';
import { createHash, createHmac, randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AdminActor } from '../admin/admin-audit.service';
import {
  DAY_MS,
  WR_ACCOUNT_SWEEP_EVERY_MS,
  WR_BOARD_CACHE_MS,
  WR_CLEANUP_BATCH,
  WR_CLEANUP_EVERY_MS,
  WR_DURATION_SLACK_MS,
  WR_KEEP_DAY_BESTS_DAYS,
  WR_KEEP_WEEK_BESTS_DAYS,
  WR_LEADERBOARD_LIMIT,
  WR_OPEN_SESSIONS_PER_DEVICE,
  WR_OPEN_SESSIONS_PER_IP,
  WR_RANK_CACHE_MS,
  WR_RATE_DEVICE_SCORES_PER_MIN,
  WR_RATE_DEVICE_SESSIONS_PER_MIN,
  WR_RATE_IP_READS_PER_MIN,
  WR_RATE_IP_SCORES_PER_MIN,
  WR_RATE_IP_SESSIONS_PER_MIN,
  WR_RATE_WINDOW_MS,
  WR_SESSION_AUDIENCE,
  WR_SESSION_KEEP_MS,
  WR_SESSION_TTL_MS,
  WR_TOP_N,
  wrPeriodKey,
  wrPeriodKeysAt,
  wrPeriodRange,
} from './game.constants';
import {
  AdminHideScoreBody,
  AdminPlayerBody,
  AdminScoreRow,
  CreateSessionResult,
  LeaderboardResult,
  ParsedScore,
  PublicScoreResult,
  SubmitScoreResult,
  UUID_RE,
  parseDeviceId,
  parseOptionalBool,
  parsePeriod,
  parseReason,
  parseSubmitScoreBody,
} from './game.dto';
import { checkWeddingRunNickname, defaultWeddingRunNickname, isUnsetNickname } from './game-nickname';
import { wrCheckRun, wrHoldReason } from './game-rules';

/** 요청자 정보 — 컨트롤러가 채운다(userId 는 OptionalJwtAuthGuard 가 확인한 계정, 없으면 게스트 · ip 는 game-ip.ts 가 정한 키) */
export interface GameRequestContext {
  ip?: string | null;
  userId?: string | null;
}

/** 세션 토큰 내용 — 서버 비밀로 서명, 30분 만료. 진짜 근거는 DB 세션 행(시작 시각·사용 여부) */
interface SessionClaims {
  typ: 'wr';
  sid: string;
  did: string;
  sat: number;
  uid?: string;
}

/** 순위 목록 한 줄(캐시 안 — playerKey·userId 는 밖으로 내보내지 않는다) */
interface BoardRow {
  rank: number;
  playerKey: string;
  nickname: string;
  score: number;
  stage: number;
  arrived: boolean;
}

interface Board {
  at: number;
  participants: number;
  rows: BoardRow[];
}

/** 한 플레이어의 기간 순위 */
interface RankInfo {
  rank: number;
  participants: number;
  score: number;
  stage: number;
  arrived: boolean;
  nickname: string;
  aboveScore: number | null;
  topNScore: number | null;
}

interface BestValue {
  scoreId: string;
  score: number;
  stage: number;
  arrived: boolean;
  achievedAt: Date;
  hidden: boolean;
}

type Tx = Prisma.TransactionClient;

/** 순위 정렬 — 점수 높은 순, 동점은 그 점수를 먼저 낸 사람, 그래도 같으면 판 id */
const BOARD_ORDER: Prisma.WeddingRunBestOrderByWithRelationInput[] = [{ score: 'desc' }, { achievedAt: 'asc' }, { scoreId: 'asc' }];

/**
 * 1분 고정 창 속도 제한(메모리). 서버 한 대 기준 — 여러 대로 늘면 대당 한도가 된다.
 * 오래된 칸은 창마다 쓸어 내고, 그래도 키가 너무 많으면(기기 id 를 바꿔 가며 두드림) 가장 오래된 칸부터 덜어 낸다
 * (261011 검증 반영: 예전엔 통째로 비워 남의 카운터까지 지울 수 있었다 — 지금 창의 최근 칸은 남는다).
 */
export class FixedWindowLimiter {
  private hits = new Map<string, { start: number; count: number }>();
  private lastSweep = 0;
  static readonly MAX_KEYS = 50_000;

  /** 한도 안이면 true(이번 요청을 센다), 넘었으면 false */
  hit(key: string, limit: number, windowMs: number, now: number): boolean {
    if (now - this.lastSweep > windowMs) {
      for (const [k, v] of this.hits) if (now - v.start >= windowMs) this.hits.delete(k);
      this.lastSweep = now;
    }
    if (this.hits.size > FixedWindowLimiter.MAX_KEYS) {
      // Map 은 넣은 순서 — 앞쪽(가장 먼저 생긴) 10% 를 덜어 낸다
      let drop = Math.ceil(FixedWindowLimiter.MAX_KEYS * 0.1);
      for (const k of this.hits.keys()) {
        if (drop-- <= 0) break;
        this.hits.delete(k);
      }
    }
    const cur = this.hits.get(key);
    if (!cur || now - cur.start >= windowMs) {
      this.hits.set(key, { start: now, count: 1 });
      return true;
    }
    if (cur.count >= limit) return false;
    cur.count += 1;
    return true;
  }
}

function tooMany(): HttpException {
  return new HttpException('잠시 후 다시 시도해 주세요', HttpStatus.TOO_MANY_REQUESTS);
}

/** Prisma unique 위반이 이 칸(들)에서 났는가 */
function isUniqueViolation(e: unknown, field: string): boolean {
  if (!(e instanceof Prisma.PrismaClientKnownRequestError) || e.code !== 'P2002') return false;
  const target = (e.meta as { target?: unknown } | undefined)?.target;
  const text = Array.isArray(target) ? target.join(',') : String(target ?? '');
  return text.includes(field);
}

/**
 * 웨딩런 '신혼집까지 달려!' 점수·순위(261011 사장 '원라인솔루션 에그점프처럼 점프게임').
 * (261011 랭킹 API 검증 보강 — 아래 '부정행위 방지'·'순위' 전부 이번에 다시 짬)
 *
 * 부정행위 방지:
 *  1) 판 시작 = 세션 DB 행(wedding_run_sessions: 기기·플레이어·IP 해시·시작 시각) + 서명 토큰(JWT_SECRET 에서 파생한 별도 비밀·audience, 30분).
 *     같은 기기에 열린 판은 3개까지(넘으면 오래된 것부터 닫음), 같은 IP 의 다른 기기 판은 200개까지(넘으면 429, IP 별 트랜잭션 잠금으로 셈)
 *     — 판을 잔뜩 열어 두고 기다리는 공격의 상한. 그만둔·안 쓴 판은 웹이 sessions/abandon 으로 닫는다.
 *  2-1) (261011 검증) 대조를 통과했지만 사람이 내기 어려운 판(완주 3번 이상·12분 초과·수집이 거리 상한의 0.62~0.50배 초과(길수록 낮게)·초당 66점 초과,
 *       game.constants.ts WR_HOLD_*)은 숨김(보류 'auto:…')으로 저장 → 운영 화면 /admin/wedding-run '자동 보류'에서 확인 뒤 반영.
 *  2) 제출 = 토큰 서명·만료·기기 일치 + DB 세션이 열려 있고 30분 안 → 트랜잭션 안에서 usedAt 을 찍어 한 번만(동시 제출도 하나만 통과).
 *  3) 점수 ≤ min(서버가 잰 세션 시작~제출, durationMs) × WR_MAX_SCORE_PER_SEC + 200, 그리고 진행(완주 수·구간·단계)·점수·수집 개수·시간
 *     서로 대조(game-rules.ts) — '입주' 배지·단계 위조 차단.
 *  4) 속도 제한(메모리): 기기·IP 단위. IP 는 웹 비밀 머리글이 맞을 때만 x-forwarded-for 를 믿는다(game-ip.ts).
 *  5) 닉네임: NFKC·닮은꼴 글자 거부·금칙어·다른 플레이어와 같은 이름 금지(game-nickname.ts). IP 는 해시만 저장.
 *  6) 운영: 판 숨김·플레이어 숨김·닉네임 초기화(+잠금) API(game-admin.controller.ts, AdminGuard) — 변경 이력은 admin_audit_logs.
 * 실패는 400(이유 짧게), 속도 제한만 429. 401 은 내지 않는다(웹 인터셉터가 401 이면 토큰 갱신·로그인 유도를 하기 때문).
 *
 * 순위: 기간(오늘=KST 자정부터 · 이번 주=KST 월요일 0시부터 · 전체) 안 플레이어(로그인=u:userId, 게스트=d:deviceId)당 최고점,
 *       동점은 그 점수를 먼저 낸 사람이 위. 점수 표를 매번 정렬하지 않고 기간별 요약(wedding_run_bests)을 제출 때 갱신해 색인으로 읽는다.
 *       보이는 닉네임 = 그 플레이어가 마지막으로 정한 닉네임(wedding_run_players) — 근거:
 *         · 한 사람은 순위·공유 링크 어디서나 같은 이름이어야 알아본다(기록마다 다른 이름이면 같은 사람인지 모름).
 *         · 이름을 바꾸거나 운영자가 초기화하면 옛 기록에도 바로 반영돼, 실수로 넣은 개인정보·문제 닉네임이 공개 순위에 남지 않는다.
 *         · 걱정이던 '1위 뒤 이름 바꿔 사칭'은 바꿀 때마다 같은 검사(금칙어·닮은꼴·다른 플레이어와 같은 이름 금지)를 다시 거치고,
 *           운영자 닉네임 초기화+잠금으로 막는다. (최고 기록 판의 닉네임을 쓰면 문제 닉네임이 그 기록과 함께 굳어 버린다.)
 *       탈퇴·정지 계정은 숨긴다(순위 목록에 보일 때마다 확인 + 5분마다 쓸어 담기). 게스트로 하다 로그인해 제출하면 그 기기 게스트 기록을 계정으로 옮긴다.
 */
@Injectable()
export class GameService {
  private readonly logger = new Logger(GameService.name);
  private readonly limiter = new FixedWindowLimiter();
  private readonly boards = new Map<string, Board>();
  /** playerKey → (periodKey → 내 순위) */
  private readonly ranks = new Map<string, Map<string, { at: number; value: RankInfo | null }>>();
  private derived: { session: string; ip: string } | null = null;
  private lastCleanupAt = 0;
  private lastSweepAt = 0;

  /** 시계 — 시험 스크립트에서 바꿔 끼운다 */
  now: () => number = () => Date.now();

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  // ── 비밀 ──

  /** JWT_SECRET 에서 용도별 비밀을 파생 — 로그인 토큰 비밀을 그대로 쓰지 않는다 */
  private secrets() {
    if (this.derived) return this.derived;
    const base = this.config.get<string>('JWT_SECRET');
    if (!base) throw new InternalServerErrorException('server misconfigured');
    this.derived = {
      session: createHmac('sha256', base).update('wedding-run:session:v1').digest('hex'),
      ip: createHmac('sha256', base).update('wedding-run:ip:v1').digest('hex'),
    };
    return this.derived;
  }

  private hashIp(ip?: string | null): string | null {
    const v = String(ip || '').trim();
    if (!v) return null;
    return createHash('sha256').update(`${this.secrets().ip}|${v}`).digest('hex').slice(0, 32);
  }

  private rateLimit(kind: 'session' | 'score' | 'read' | 'abandon', ipHash: string | null, deviceId: string | null, now: number) {
    const ipLimit = kind === 'session' ? WR_RATE_IP_SESSIONS_PER_MIN : kind === 'read' ? WR_RATE_IP_READS_PER_MIN : WR_RATE_IP_SCORES_PER_MIN;
    const deviceLimit = kind === 'session' ? WR_RATE_DEVICE_SESSIONS_PER_MIN : WR_RATE_DEVICE_SCORES_PER_MIN;
    // IP 먼저 — IP 한도를 넘은 요청은 기기 칸을 만들지 않는다(기기 id 를 바꿔 가며 칸을 잔뜩 만들어 남의 칸을 밀어내지 못하게)
    if (ipHash && !this.limiter.hit(`${kind}:ip:${ipHash}`, ipLimit, WR_RATE_WINDOW_MS, now)) throw tooMany();
    if (deviceId && kind !== 'read' && !this.limiter.hit(`${kind}:d:${deviceId}`, deviceLimit, WR_RATE_WINDOW_MS, now)) throw tooMany();
  }

  // ── 캐시 ──

  private cachedRank(playerKey: string, periodKey: string, now: number): RankInfo | null | undefined {
    const hit = this.ranks.get(playerKey)?.get(periodKey);
    return hit && now - hit.at < WR_RANK_CACHE_MS ? hit.value : undefined;
  }

  private storeRank(playerKey: string, periodKey: string, now: number, value: RankInfo | null) {
    if (this.ranks.size > 5000) this.ranks.clear();
    let m = this.ranks.get(playerKey);
    if (!m) this.ranks.set(playerKey, (m = new Map()));
    m.set(periodKey, { at: now, value });
  }

  /** 제출 뒤 — 내 순위 캐시는 비우고, 기간 목록은 이번 점수가 그 목록을 바꿀 때만 비운다(TTL 만료가 기본) */
  private invalidateAfterSubmit(playerKeys: string[], score: number, periodKeys: string[]) {
    for (const k of playerKeys) this.ranks.delete(k);
    for (const pk of periodKeys) {
      const b = this.boards.get(pk);
      if (!b) continue;
      const last = b.rows[b.rows.length - 1];
      if (b.rows.length < WR_LEADERBOARD_LIMIT || !last || score >= last.score || b.rows.some((r) => playerKeys.includes(r.playerKey))) {
        this.boards.delete(pk);
      }
    }
  }

  /** 운영 조치·계정 숨김 뒤 — 전부 */
  private clearCaches() {
    this.boards.clear();
    this.ranks.clear();
  }

  // ── 세션 ──

  async createSession(body: unknown, ctx: GameRequestContext = {}): Promise<CreateSessionResult> {
    const deviceId = parseDeviceId((body as any)?.deviceId);
    if (!deviceId) throw new BadRequestException('기기 정보가 올바르지 않아요');
    const now = this.now();
    const ipHash = this.hashIp(ctx.ip);
    this.rateLimit('session', ipHash, deviceId, now);

    const userId = ctx.userId || null;
    const openSince = new Date(now - WR_SESSION_TTL_MS);
    // (261011 검증 medium) ① 같은 기기 정리를 IP 상한보다 먼저 — 자기 판 때문에 막히지 않게(예전엔 IP 상한부터 세어 재활용 대신 429)
    // 같은 기기는 새 판을 늘 열어 주되, 열린 판이 상한을 넘으면 오래된 것부터 닫는다(그만둔 판·새로고침)
    const open = await this.prisma.weddingRunSession.findMany({
      where: { deviceId, usedAt: null, startedAt: { gt: openSince } },
      orderBy: [{ startedAt: 'desc' }, { id: 'desc' }],
      select: { id: true },
    });
    const stale = open.slice(Math.max(0, WR_OPEN_SESSIONS_PER_DEVICE - 1)).map((r) => r.id);
    if (stale.length) {
      await this.prisma.weddingRunSession.updateMany({
        where: { id: { in: stale }, usedAt: null },
        data: { usedAt: new Date(now), closeReason: 'superseded' },
      });
    }

    const sessionId = randomUUID();
    const data = { id: sessionId, deviceId, playerKey: userId ? `u:${userId}` : `d:${deviceId}`, userId, ipHash, startedAt: new Date(now) };
    if (ipHash) {
      // ② 같은 IP 에 (다른 기기의) 열린 판이 너무 많으면 거절 — 기기 id 를 바꿔 가며 판을 열어 두는 공격(DB 로 세어 서버 대수와 상관없다).
      // 세기와 넣기를 IP 별 트랜잭션 잠금(advisory xact lock) 안에서 — 동시에 몰려도 상한을 넘지 않게(예전엔 count 뒤 insert 라 넘칠 수 있었다).
      await this.prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`wr-ip:${ipHash}`}))`;
        const openIp = await tx.weddingRunSession.count({ where: { ipHash, usedAt: null, startedAt: { gt: openSince }, deviceId: { not: deviceId } } });
        if (openIp >= WR_OPEN_SESSIONS_PER_IP) throw tooMany();
        await tx.weddingRunSession.create({ data });
      });
    } else {
      await this.prisma.weddingRunSession.create({ data });
    }
    const iat = Math.floor(now / 1000);
    const claims: SessionClaims & { iat: number; exp: number } = {
      typ: 'wr',
      sid: sessionId,
      did: deviceId,
      sat: now,
      ...(userId ? { uid: userId } : {}),
      iat,
      exp: iat + Math.floor(WR_SESSION_TTL_MS / 1000),
    };
    const token = this.jwt.sign(claims, { secret: this.secrets().session, audience: WR_SESSION_AUDIENCE, algorithm: 'HS256' });
    this.maybeCleanup(now);
    return { sessionId, token, startedAt: now };
  }

  private verifySession(token: string, now: number): SessionClaims {
    let c: any;
    try {
      c = this.jwt.verify(token, {
        secret: this.secrets().session,
        audience: WR_SESSION_AUDIENCE,
        algorithms: ['HS256'],
        clockTimestamp: Math.floor(now / 1000),
      });
    } catch {
      throw new BadRequestException('세션이 만료됐거나 올바르지 않아요');
    }
    if (
      !c ||
      c.typ !== 'wr' ||
      typeof c.sid !== 'string' ||
      !UUID_RE.test(c.sid) ||
      typeof c.did !== 'string' ||
      typeof c.sat !== 'number' ||
      !Number.isFinite(c.sat) ||
      c.sat > now + WR_DURATION_SLACK_MS ||
      (c.uid != null && typeof c.uid !== 'string')
    ) {
      throw new BadRequestException('세션이 만료됐거나 올바르지 않아요');
    }
    return c as SessionClaims;
  }

  /**
   * 판 포기 — 그만둔 판(홈·일시정지 중 다시 도전)·안 쓴 판(페이지 떠남)의 세션을 닫는다. 토큰이 곧 증명(로그인 불필요).
   * 이미 닫혔거나 만료·위조면 조용히 { closed: false }(웹은 결과를 기다리지 않는다). 261011 검증 medium.
   */
  async abandonSession(body: unknown, ctx: GameRequestContext = {}): Promise<{ closed: boolean }> {
    const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
    const token = typeof b.token === 'string' ? b.token.trim() : '';
    const deviceId = parseDeviceId(b.deviceId);
    if (!token || token.length > 2048 || !deviceId) throw new BadRequestException('세션 정보가 없어요');
    const now = this.now();
    this.rateLimit('abandon', this.hashIp(ctx.ip), deviceId, now);
    let claims: SessionClaims;
    try {
      claims = this.verifySession(token, now);
    } catch {
      return { closed: false };
    }
    if (claims.did !== deviceId) return { closed: false };
    const r = await this.prisma.weddingRunSession.updateMany({
      where: { id: claims.sid, deviceId, usedAt: null },
      data: { usedAt: new Date(now), closeReason: 'abandoned' },
    });
    return { closed: r.count === 1 };
  }

  // ── 점수 제출 ──

  async submitScore(body: unknown, ctx: GameRequestContext = {}): Promise<SubmitScoreResult> {
    const parsed = parseSubmitScoreBody(body);
    if (!parsed.ok) throw new BadRequestException(parsed.reason);
    const v = parsed.value;
    const now = this.now();
    const ipHash = this.hashIp(ctx.ip);
    this.rateLimit('score', ipHash, v.deviceId, now);

    const claims = this.verifySession(v.token, now);
    if (claims.did !== v.deviceId) throw new BadRequestException('기기 정보가 맞지 않아요');
    // 시작 시각·사용 여부의 근거는 DB 세션 행(토큰은 서명 확인용)
    const session = await this.prisma.weddingRunSession.findUnique({ where: { id: claims.sid } });
    if (!session || session.deviceId !== v.deviceId) throw new BadRequestException('세션이 만료됐거나 올바르지 않아요');
    if (session.usedAt) throw new BadRequestException(session.closeReason === 'submitted' ? '이미 기록한 판이에요' : '세션이 만료됐어요');
    const elapsed = now - session.startedAt.getTime();
    if (elapsed > WR_SESSION_TTL_MS) throw new BadRequestException('세션이 만료됐어요');
    const bad = wrCheckRun(v, elapsed);
    if (bad) throw new BadRequestException(bad);
    // 대조는 통과했지만 사람이 내기 어려운 판 → 숨김(보류) 저장, 운영 확인 뒤 반영(261011 검증 medium)
    const hold = wrHoldReason(v);

    // 제출한(지금 로그인한) 계정이 우선, 로그아웃 상태로 내면 세션을 연 계정 — (261011 검증 low) 계정을 바꾼 뒤 옛 계정으로 받아 둔 토큰으로 달린 판이
    // 옛 계정 기록·이름으로 들어가 다음 판에 '이미 다른 분이 쓰는 닉네임'이 뜨던 것(웹도 토큰을 계정에 묶어 바꾸면 새로 받는다)
    const userId = ctx.userId || session.userId || null;
    const playerKey = userId ? `u:${userId}` : `d:${v.deviceId}`;
    const periodKeys = wrPeriodKeysAt(now);

    let rec: Awaited<ReturnType<GameService['recordRun']>>;
    try {
      rec = await this.recordRun(v, { sessionId: session.id, userId, playerKey, ipHash, now, periodKeys, hold }, false);
    } catch (e) {
      // 같은 닉네임을 동시에 두 사람이 정한 드문 경우 — 닉네임만 그대로 두고 한 번 더
      if (isUniqueViolation(e, 'nicknameKey')) {
        rec = await this.recordRun(v, { sessionId: session.id, userId, playerKey, ipHash, now, periodKeys, hold }, true);
      } else if (isUniqueViolation(e, 'sessionId')) {
        throw new BadRequestException('이미 기록한 판이에요');
      } else {
        throw e;
      }
    }
    this.invalidateAfterSubmit(userId ? [playerKey, `d:${v.deviceId}`] : [playerKey], v.score, periodKeys);

    const mine = await this.rankOf(wrPeriodKey('today', now), playerKey, now, true);
    if (hold) {
      // 보류 판은 순위 요약에 안 들어갔다 — 순위는 이 판을 뺀 오늘 기록(없으면 0)
      return {
        id: rec.id,
        isNewBest: false,
        best: rec.prevBest ?? 0,
        today: { rank: mine?.rank ?? 0, participants: mine?.participants ?? 0 },
        nextGoal: null,
        top10Gap: null,
        nickname: rec.nickname,
        nicknameRejected: rec.rejected,
        held: true,
      };
    }
    // 방금 넣은 줄이라 늘 있다 — 혹시 없으면(복제 지연 등) 이번 판만으로
    const rank = mine?.rank ?? 1;
    const todayBest = mine?.score ?? v.score;
    return {
      id: rec.id,
      isNewBest: rec.prevBest == null || v.score > rec.prevBest,
      best: Math.max(rec.prevBest ?? 0, v.score),
      today: { rank, participants: mine?.participants ?? 1 },
      nextGoal: mine && rank > 1 && mine.aboveScore != null ? { rank: rank - 1, gap: mine.aboveScore - todayBest + 1 } : null,
      top10Gap: mine && rank > WR_TOP_N && mine.topNScore != null ? mine.topNScore - todayBest + 1 : null,
      nickname: rec.nickname,
      nicknameRejected: rec.rejected,
      held: false,
    };
  }

  /** 한 트랜잭션: 세션 쓰기(한 번만) → 게스트 기록 옮기기 → 닉네임 → 판 저장 → 기간별 요약 */
  private async recordRun(
    v: ParsedScore,
    o: { sessionId: string; userId: string | null; playerKey: string; ipHash: string | null; now: number; periodKeys: string[]; hold?: string | null },
    keepNickname: boolean,
  ) {
    const at = new Date(o.now);
    return this.prisma.$transaction(async (tx) => {
      const claimed = await tx.weddingRunSession.updateMany({
        where: { id: o.sessionId, usedAt: null },
        data: { usedAt: at, closeReason: 'submitted' },
      });
      if (claimed.count !== 1) throw new BadRequestException('이미 기록한 판이에요');
      if (o.userId) await this.mergeGuestInto(tx, v.deviceId, o.userId);
      const player = await this.applyNickname(tx, o.playerKey, o.userId, v.deviceId, v.nickname, keepNickname, v.resetNickname, v.nicknameSoft);
      const prev = await tx.weddingRunBest.findUnique({
        where: { periodKey_playerKey: { periodKey: 'all', playerKey: o.playerKey } },
        select: { score: true },
      });
      const row = await tx.weddingRunScore.create({
        data: {
          sessionId: o.sessionId,
          playerKey: o.playerKey,
          userId: o.userId,
          deviceId: v.deviceId,
          nickname: player.nickname,
          score: v.score,
          stage: v.stage,
          segment: v.segment,
          arrived: v.arrived,
          laps: v.laps,
          durationMs: v.durationMs,
          hearts: v.hearts,
          envelopes: v.envelopes,
          ipHash: o.ipHash,
          // 기간 경계(오늘·이번 주)를 같은 시계로 계산하려고 앱 시계로 넣는다
          createdAt: at,
          // 자동 보류 — 숨김으로 저장(운영자가 숨김 해제하면 rebuildBests 로 순위 요약에 들어간다)
          ...(o.hold ? { hiddenAt: at, hiddenReason: `auto:${o.hold}` } : {}),
        },
        select: { id: true },
      });
      if (!o.hold) {
        await this.upsertBests(
          tx,
          o.playerKey,
          o.periodKeys,
          { scoreId: row.id, score: v.score, stage: v.stage, arrived: v.arrived, achievedAt: at, hidden: player.hidden },
        );
      }
      return { id: row.id, prevBest: prev?.score ?? null, nickname: player.nickname, rejected: player.rejected };
    });
  }

  /** 기간별 요약 갱신 — 없으면 넣고, 있으면 더 높을 때만(동점은 먼저 낸 판 유지). 각각 한 문장이라 동시 제출에도 낮은 점수가 덮지 않는다 */
  private async upsertBests(tx: Tx, playerKey: string, periodKeys: string[], b: BestValue) {
    await tx.weddingRunBest.createMany({
      data: periodKeys.map((periodKey) => ({ periodKey, playerKey, ...b })),
      skipDuplicates: true,
    });
    await tx.weddingRunBest.updateMany({
      where: {
        playerKey,
        periodKey: { in: periodKeys },
        OR: [{ score: { lt: b.score } }, { score: b.score, achievedAt: { gt: b.achievedAt } }],
      },
      data: { ...b },
    });
  }

  /**
   * 게스트로 하던 기기(d:deviceId)의 기록을 계정(u:userId)으로 옮긴다 — 한 사람이 순위에 두 번 나오지 않게.
   * 그 기기에서 로그인 전에 낸 기록은 처음 로그인해 제출한 계정 것으로 본다. 운영자가 숨긴 게스트는 옮기지 않는다(숨김 세탁 방지).
   */
  private async mergeGuestInto(tx: Tx, deviceId: string, userId: string) {
    const d = `d:${deviceId}`;
    const u = `u:${userId}`;
    const guest = await tx.weddingRunPlayer.findUnique({ where: { playerKey: d } });
    if (!guest || guest.hiddenAt) return;
    const owner = await tx.weddingRunPlayer.findUnique({ where: { playerKey: u } });
    await tx.weddingRunScore.updateMany({ where: { playerKey: d }, data: { playerKey: u, userId } });
    const bests = await tx.weddingRunBest.findMany({ where: { playerKey: d } });
    for (const b of bests) {
      await this.upsertBests(tx, u, [b.periodKey], {
        scoreId: b.scoreId,
        score: b.score,
        stage: b.stage,
        arrived: b.arrived,
        achievedAt: b.achievedAt,
        hidden: !!owner?.hiddenAt,
      });
    }
    await tx.weddingRunBest.deleteMany({ where: { playerKey: d } });
    // 게스트 행을 먼저 지워야 닉네임 키(unique)를 계정이 넘겨받을 수 있다(동시에 두 번 와도 deleteMany·upsert 라 500 없음)
    await tx.weddingRunPlayer.deleteMany({ where: { playerKey: d } });
    if (!owner) {
      await tx.weddingRunPlayer.upsert({
        where: { playerKey: u },
        create: { playerKey: u, userId, deviceId, nickname: guest.nickname, nicknameKey: guest.nicknameKey, nicknameLocked: guest.nicknameLocked },
        update: {},
      });
    } else if (!owner.nicknameKey && !owner.nicknameLocked && guest.nicknameKey) {
      // 계정은 기본 닉네임 그대로인데 게스트 때 직접 정한 이름이 있으면 그걸로(= 마지막으로 정한 이름)
      await tx.weddingRunPlayer.update({ where: { playerKey: u }, data: { nickname: guest.nickname, nicknameKey: guest.nicknameKey } });
    }
  }

  /**
   * 공개 닉네임 정하기 — 보낸 이름이 '정하지 않음'(비었거나 이 기기 기본 닉네임)이면 지금 이름 유지(처음이면 기본),
   * 직접 정한 이름이면 검사 + 다른 플레이어와 같은 이름 금지 → 통과하면 바꾸고, 아니면 지금 이름 유지 + 이유.
   */
  private async applyNickname(
    tx: Tx,
    playerKey: string,
    userId: string | null,
    deviceId: string,
    raw: unknown,
    keepOnly: boolean,
    reset = false,
    soft = false,
  ) {
    const existing = await tx.weddingRunPlayer.findUnique({ where: { playerKey } });
    let nickname = existing?.nickname ?? defaultWeddingRunNickname(deviceId);
    let nicknameKey = existing ? existing.nicknameKey : null;
    let rejected: string | null = null;
    // 손님 때 정한 이름 옮기기(soft) — 계정에 직접 정한 이름이 이미 있으면(다른 이름) 그대로 두고 조용히 넘어간다
    let softKeep = false;
    if (soft && existing?.nicknameKey && !isUnsetNickname(raw, deviceId)) {
      const c0 = checkWeddingRunNickname(raw);
      softKeep = !c0.ok || c0.key !== existing.nicknameKey;
    }
    if (softKeep) {
      // 지금 이름 유지
    } else if (reset && isUnsetNickname(raw, deviceId)) {
      // 기본 닉네임으로 되돌리기(웹 '기본값') — 직접 정한 이름·비교 키를 지운다. 운영자가 잠갔으면 그대로(잠금 = 이미 기본값)
      if (!existing?.nicknameLocked) {
        nickname = defaultWeddingRunNickname(deviceId);
        nicknameKey = null;
      }
    } else if (!isUnsetNickname(raw, deviceId)) {
      if (keepOnly) rejected = '이미 다른 분이 쓰는 닉네임이에요';
      else if (existing?.nicknameLocked) rejected = '지금은 닉네임을 바꿀 수 없어요';
      else {
        const c = checkWeddingRunNickname(raw);
        if (!c.ok) rejected = c.reason;
        else {
          const taken =
            c.key && c.key !== existing?.nicknameKey
              ? await tx.weddingRunPlayer.findUnique({ where: { nicknameKey: c.key }, select: { playerKey: true } })
              : null;
          if (taken && taken.playerKey !== playerKey) rejected = '이미 다른 분이 쓰는 닉네임이에요';
          else {
            nickname = c.nickname;
            nicknameKey = c.key;
          }
        }
      }
    }
    const data = { userId, deviceId, nickname, nicknameKey };
    // upsert(한 문장) — 새 플레이어의 첫 두 판이 동시에 들어와도 기본 키 충돌로 500 이 나지 않게
    const saved = await tx.weddingRunPlayer.upsert({
      where: { playerKey },
      create: { playerKey, ...data },
      update: data,
      select: { hiddenAt: true },
    });
    return { nickname, rejected, hidden: !!saved.hiddenAt };
  }

  // ── 순위 ──

  /** 기간 상위 N명 + 참여자 수(10초 캐시). 목록에 보이는 계정이 탈퇴·정지됐으면 숨기고 다시 */
  private async board(periodKey: string, now: number): Promise<Board> {
    const hit = this.boards.get(periodKey);
    if (hit && now - hit.at < WR_BOARD_CACHE_MS) return hit;
    await this.maybeSweepAccounts(now);
    let built: Board | null = null;
    for (let attempt = 0; attempt < 2 && !built; attempt++) {
      const [rows, participants] = await Promise.all([
        this.prisma.weddingRunBest.findMany({
          where: { periodKey, hidden: false },
          orderBy: BOARD_ORDER,
          take: WR_LEADERBOARD_LIMIT,
          select: { playerKey: true, score: true, stage: true, arrived: true },
        }),
        this.prisma.weddingRunBest.count({ where: { periodKey, hidden: false } }),
      ]);
      const players = rows.length
        ? await this.prisma.weddingRunPlayer.findMany({
            where: { playerKey: { in: rows.map((r) => r.playerKey) } },
            select: { playerKey: true, nickname: true, userId: true },
          })
        : [];
      const userIds = players.map((p) => p.userId).filter((x): x is string => !!x);
      if (attempt === 0 && userIds.length) {
        const gone = await this.prisma.user.findMany({
          where: { id: { in: userIds }, OR: [{ deletedAt: { not: null } }, { isBanned: true }] },
          select: { id: true },
        });
        if (gone.length) {
          await this.setPlayersHiddenByUser(gone.map((g) => g.id), 'account-inactive');
          continue;
        }
      }
      const nick = new Map(players.map((p) => [p.playerKey, p.nickname]));
      built = {
        at: now,
        participants,
        rows: rows.map((r, i) => ({ rank: i + 1, playerKey: r.playerKey, nickname: nick.get(r.playerKey) ?? '', score: r.score, stage: r.stage, arrived: r.arrived })),
      };
    }
    if (this.boards.size > 50) this.boards.clear();
    this.boards.set(periodKey, built!);
    return built!;
  }

  /**
   * 한 플레이어의 기간 순위(10초 캐시) — '내 최고점보다 위인 보이는 플레이어 수 + 1'을 색인으로 센다(전체 정렬 없음).
   * 운영자가 숨긴 플레이어도 자기 순위는 보인다(다른 사람 목록에는 안 보임 — 숨김을 눈치채고 새 기기로 우회하지 않게).
   */
  private async rankOf(periodKey: string, playerKey: string, now: number, fresh = false): Promise<RankInfo | null> {
    if (!fresh) {
      const c = this.cachedRank(playerKey, periodKey, now);
      if (c !== undefined) return c;
    }
    const mine = await this.prisma.weddingRunBest.findUnique({ where: { periodKey_playerKey: { periodKey, playerKey } } });
    let value: RankInfo | null = null;
    if (mine) {
      // '나보다 위' = 점수가 높거나, 같은 점수를 먼저 냈거나, 그것도 같으면 판 id 가 앞. 세 갈래로 나눠 세야 각각 색인 범위로 읽는다
      // (OR 한 번이면 기간 안 모든 행을 걸러 읽는다 — 실행 계획 확인)
      const scope = { periodKey, hidden: false };
      const tieAbove: Prisma.WeddingRunBestWhereInput[] = [
        { ...scope, score: { gt: mine.score } },
        { ...scope, score: mine.score, achievedAt: { lt: mine.achievedAt } },
        { ...scope, score: mine.score, achievedAt: mine.achievedAt, scoreId: { lt: mine.scoreId } },
      ];
      const cachedBoard = this.boards.get(periodKey);
      const [c1, c2, c3, visible, player] = await Promise.all([
        this.prisma.weddingRunBest.count({ where: tieAbove[0] }),
        this.prisma.weddingRunBest.count({ where: tieAbove[1] }),
        this.prisma.weddingRunBest.count({ where: tieAbove[2] }),
        // 참여자 수는 목록 캐시가 살아 있으면 그 값(제출 직후 fresh 일 때는 새로 셈 — 방금 들어온 사람 포함)
        !fresh && cachedBoard && now - cachedBoard.at < WR_BOARD_CACHE_MS
          ? Promise.resolve(cachedBoard.participants)
          : this.prisma.weddingRunBest.count({ where: scope }),
        this.prisma.weddingRunPlayer.findUnique({ where: { playerKey }, select: { nickname: true } }),
      ]);
      const rank = c1 + c2 + c3 + 1;
      // 바로 위 사람 점수 — 같은 점수가 위에 있으면 내 점수, 아니면 나보다 높은 점수 중 가장 낮은 것(색인을 거꾸로 한 칸)
      let aboveScore: number | null = c2 + c3 > 0 ? mine.score : null;
      if (aboveScore == null && c1 > 0) {
        const nearest = await this.prisma.weddingRunBest.findFirst({
          where: tieAbove[0],
          orderBy: [{ score: 'asc' }, { achievedAt: 'desc' }, { scoreId: 'desc' }],
          select: { score: true },
        });
        aboveScore = nearest?.score ?? null;
      }
      let topNScore: number | null = null;
      if (rank > WR_TOP_N) {
        const t = await this.prisma.weddingRunBest.findMany({
          where: { periodKey, hidden: false },
          orderBy: BOARD_ORDER,
          skip: WR_TOP_N - 1,
          take: 1,
          select: { score: true },
        });
        topNScore = t[0]?.score ?? null;
      }
      value = {
        rank,
        participants: visible + (mine.hidden ? 1 : 0),
        score: mine.score,
        stage: mine.stage,
        arrived: mine.arrived,
        nickname: player?.nickname ?? '',
        aboveScore,
        topNScore,
      };
    }
    this.storeRank(playerKey, periodKey, now, value);
    return value;
  }

  async leaderboard(periodRaw: unknown, deviceIdRaw: unknown, userId?: string | null, ctx: GameRequestContext = {}): Promise<LeaderboardResult> {
    const period = parsePeriod(periodRaw);
    if (!period) throw new BadRequestException('기간이 올바르지 않아요');
    const now = this.now();
    this.rateLimit('read', this.hashIp(ctx.ip), null, now);
    const periodKey = wrPeriodKey(period, now);
    const board = await this.board(periodKey, now);

    const deviceId = parseDeviceId(deviceIdRaw);
    // 로그인했지만 이 기기 게스트 기록을 아직 안 옮겼으면(로그인 뒤 첫 제출 전) 게스트 기록으로라도 '내 순위'를 보여 준다
    const myKeys = [userId ? `u:${userId}` : null, deviceId ? `d:${deviceId}` : null].filter((k): k is string => !!k);
    let me: LeaderboardResult['me'] = null;
    let meKey: string | null = null;
    let participants = board.participants;
    for (const key of myKeys) {
      const inTop = board.rows.find((r) => r.playerKey === key);
      if (inTop) {
        me = { rank: inTop.rank, nickname: inTop.nickname, best: inTop.score, stage: inTop.stage, arrived: inTop.arrived };
        meKey = key;
        break;
      }
      const mine = await this.rankOf(periodKey, key, now);
      if (mine) {
        me = { rank: mine.rank, nickname: mine.nickname, best: mine.score, stage: mine.stage, arrived: mine.arrived };
        participants = Math.max(participants, mine.participants);
        break;
      }
    }
    return {
      period,
      participants,
      // playerKey(계정·기기 id)는 절대 내보내지 않는다
      top: board.rows.map((r) => ({
        rank: r.rank,
        nickname: r.nickname,
        score: r.score,
        stage: r.stage,
        arrived: r.arrived,
        isMe: meKey != null && r.playerKey === meKey,
      })),
      me,
    };
  }

  /** 공유 링크 '○○님의 1,280점에 도전!' — 공개 정보만. 숨긴 판·숨긴 플레이어·탈퇴/정지 계정은 없는 기록처럼 404 */
  async getScore(id: string, ctx: GameRequestContext = {}): Promise<PublicScoreResult> {
    const now = this.now();
    this.rateLimit('read', this.hashIp(ctx.ip), null, now);
    if (!UUID_RE.test(String(id || ''))) throw new NotFoundException('기록을 찾을 수 없어요');
    const row = await this.prisma.weddingRunScore.findUnique({
      where: { id },
      select: { id: true, playerKey: true, userId: true, score: true, stage: true, segment: true, arrived: true, hiddenAt: true },
    });
    if (!row || row.hiddenAt) throw new NotFoundException('기록을 찾을 수 없어요');
    const player = await this.prisma.weddingRunPlayer.findUnique({ where: { playerKey: row.playerKey }, select: { nickname: true, hiddenAt: true } });
    if (!player || player.hiddenAt) throw new NotFoundException('기록을 찾을 수 없어요');
    if (row.userId) {
      const u = await this.prisma.user.findUnique({ where: { id: row.userId }, select: { deletedAt: true, isBanned: true } });
      if (!u || u.deletedAt || u.isBanned) throw new NotFoundException('기록을 찾을 수 없어요');
    }
    return { id: row.id, nickname: player.nickname, score: row.score, stage: row.stage, segment: row.segment, arrived: row.arrived };
  }

  // ── 숨김(운영·계정) ──

  /** 플레이어 숨김/해제 — 플레이어 행과 그 플레이어의 모든 기간 요약을 같이 */
  private async setPlayersHidden(where: Prisma.WeddingRunPlayerWhereInput, hidden: boolean, reason: string | null, tx?: Tx) {
    const run = async (db: Tx) => {
      const targets = await db.weddingRunPlayer.findMany({ where, select: { playerKey: true } });
      const keys = targets.map((t) => t.playerKey);
      if (!keys.length) return 0;
      await db.weddingRunPlayer.updateMany({
        where: { playerKey: { in: keys } },
        data: hidden ? { hiddenAt: new Date(this.now()), hiddenReason: reason } : { hiddenAt: null, hiddenReason: null },
      });
      await db.weddingRunBest.updateMany({ where: { playerKey: { in: keys } }, data: { hidden } });
      return keys.length;
    };
    const n = tx ? await run(tx) : await this.prisma.$transaction((t) => run(t));
    this.clearCaches();
    return n;
  }

  /** 탈퇴·정지 계정의 플레이어 숨김 */
  private setPlayersHiddenByUser(userIds: string[], reason: string) {
    return this.setPlayersHidden({ userId: { in: userIds }, hiddenAt: null }, true, reason);
  }

  /**
   * 탈퇴·정지 계정 쓸어 담기(5분마다, 서버 한 대 기준). users 를 직접 고치지 않고(탈퇴 처리는 users 모듈) 여기서 읽어 숨긴다.
   * 실패해도 순위 화면은 계속(다음 차례에 다시).
   */
  private async maybeSweepAccounts(now: number) {
    if (now - this.lastSweepAt < WR_ACCOUNT_SWEEP_EVERY_MS) return;
    this.lastSweepAt = now;
    try {
      const rows = await this.prisma.$queryRaw<{ userId: string }[]>(Prisma.sql`/* wr:sweep */
        SELECT p."userId" FROM "wedding_run_players" p
        JOIN "users" u ON u."id" = p."userId"
        WHERE p."hiddenAt" IS NULL AND (u."deletedAt" IS NOT NULL OR u."isBanned" = true)
        LIMIT 500`);
      if (rows.length) await this.setPlayersHiddenByUser(rows.map((r) => String(r.userId)), 'account-inactive');
    } catch (e) {
      this.logger.warn(`wedding-run account sweep failed: ${(e as Error)?.message || e}`);
    }
  }

  /** 계정 탈퇴 때 바로 숨기기 — users 모듈이 부를 수 있게 열어 둔다(지금은 5분 청소·목록 확인이 대신한다) */
  async forgetUser(userId: string) {
    return this.setPlayersHiddenByUser([userId], 'account-deleted');
  }

  /** 기간 요약 다시 계산 — 숨긴 판을 빼고 그 플레이어의 그 기간 최고점을 점수 표에서 다시 찾는다 */
  private async rebuildBests(tx: Tx, playerKey: string, periodKeys: string[]) {
    const player = await tx.weddingRunPlayer.findUnique({ where: { playerKey }, select: { hiddenAt: true } });
    for (const periodKey of periodKeys) {
      const range = wrPeriodRange(periodKey);
      const best = await tx.weddingRunScore.findFirst({
        where: { playerKey, hiddenAt: null, ...(range ? { createdAt: { gte: new Date(range.from), lt: new Date(range.to) } } : {}) },
        orderBy: [{ score: 'desc' }, { createdAt: 'asc' }, { id: 'asc' }],
        select: { id: true, score: true, stage: true, arrived: true, createdAt: true },
      });
      await tx.weddingRunBest.deleteMany({ where: { periodKey, playerKey } });
      if (best) {
        await tx.weddingRunBest.create({
          data: {
            periodKey,
            playerKey,
            scoreId: best.id,
            score: best.score,
            stage: best.stage,
            arrived: best.arrived,
            achievedAt: best.createdAt,
            hidden: !!player?.hiddenAt,
          },
        });
      }
    }
  }

  // ── 운영 API(AdminGuard) ──

  /** 운영 목록 — sort: recent(최신) | top(점수) | long(달린 시간). hidden: '1' 숨긴 것만 · '0' 보이는 것만. playerOf=<판 id> 그 플레이어 판만 */
  async adminListScores(q: { sort?: string; hidden?: string; playerOf?: string; limit?: string; page?: string }) {
    const limit = Math.min(100, Math.max(1, Number(q.limit) || 50));
    const page = Math.max(1, Number(q.page) || 1);
    const where: Prisma.WeddingRunScoreWhereInput = {};
    if (q.hidden === '1') where.hiddenAt = { not: null };
    if (q.hidden === '0') where.hiddenAt = null;
    // (261011 검증 E5) 자동 보류 판만(운영 확인 대기) — hiddenReason 'auto:…'
    if (q.hidden === 'auto') {
      where.hiddenAt = { not: null };
      where.hiddenReason = { startsWith: 'auto:' };
    }
    if (q.playerOf) {
      if (!UUID_RE.test(q.playerOf)) throw new BadRequestException('판 id 가 올바르지 않아요');
      const of = await this.prisma.weddingRunScore.findUnique({ where: { id: q.playerOf }, select: { playerKey: true } });
      if (!of) throw new NotFoundException('기록을 찾을 수 없어요');
      where.playerKey = of.playerKey;
    }
    // top·long 은 색인 없이 정렬(운영자만 가끔 — 쓰기 비용을 늘리는 전역 점수 색인은 일부러 두지 않음)
    const orderBy: Prisma.WeddingRunScoreOrderByWithRelationInput[] =
      q.sort === 'top' ? [{ score: 'desc' }, { createdAt: 'asc' }] : q.sort === 'long' ? [{ durationMs: 'desc' }, { createdAt: 'desc' }] : [{ createdAt: 'desc' }];
    const [rows, total] = await Promise.all([
      this.prisma.weddingRunScore.findMany({ where, orderBy, skip: (page - 1) * limit, take: limit }),
      this.prisma.weddingRunScore.count({ where }),
    ]);
    const players = rows.length
      ? await this.prisma.weddingRunPlayer.findMany({ where: { playerKey: { in: Array.from(new Set(rows.map((r) => r.playerKey))) } } })
      : [];
    const pmap = new Map(players.map((p) => [p.playerKey, p]));
    const data: AdminScoreRow[] = rows.map((r) => {
      const p = pmap.get(r.playerKey);
      return {
        id: r.id,
        playerKey: r.playerKey,
        userId: r.userId,
        deviceId: r.deviceId,
        nickname: r.nickname,
        playerNickname: p?.nickname ?? null,
        score: r.score,
        stage: r.stage,
        segment: r.segment,
        arrived: r.arrived,
        laps: r.laps,
        durationMs: r.durationMs,
        hearts: r.hearts,
        envelopes: r.envelopes,
        scorePerSec: r.durationMs > 0 ? Math.round((r.score / (r.durationMs / 1000)) * 10) / 10 : 0,
        createdAt: r.createdAt.toISOString(),
        hiddenAt: r.hiddenAt ? r.hiddenAt.toISOString() : null,
        hiddenReason: r.hiddenReason,
        playerHiddenAt: p?.hiddenAt ? p.hiddenAt.toISOString() : null,
        playerHiddenReason: p?.hiddenReason ?? null,
      };
    });
    return { data, total, page, limit };
  }

  /** 운영 — 판 하나 숨김/해제(그 판이 들어간 기간 요약을 다시 계산) */
  async adminHideScore(id: string, body: AdminHideScoreBody, actor: AdminActor) {
    if (!UUID_RE.test(String(id || ''))) throw new NotFoundException('기록을 찾을 수 없어요');
    const hidden = parseOptionalBool(body?.hidden);
    if (hidden === null) throw new BadRequestException('hidden 은 참/거짓이어야 해요');
    const want = hidden ?? true;
    const reason = parseReason(body?.reason);
    const row = await this.prisma.weddingRunScore.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('기록을 찾을 수 없어요');
    await this.prisma.$transaction(async (tx) => {
      await tx.weddingRunScore.update({
        where: { id },
        data: want ? { hiddenAt: new Date(this.now()), hiddenReason: reason ? `admin:${reason}` : 'admin' } : { hiddenAt: null, hiddenReason: null },
      });
      await this.rebuildBests(tx, row.playerKey, wrPeriodKeysAt(row.createdAt.getTime()));
      await this.audit(tx, actor, want ? 'game.wedding_run.score_hide' : 'game.wedding_run.score_unhide', 'wedding_run_score', id, { hiddenAt: row.hiddenAt }, { hidden: want }, reason);
    });
    this.clearCaches();
    return { id, hidden: want };
  }

  /** 운영 — 그 판을 낸 플레이어 숨김/해제 · 닉네임을 기본값으로 되돌리기(기본 잠금) · 닉네임 잠금/해제 */
  async adminUpdatePlayer(scoreId: string, body: AdminPlayerBody, actor: AdminActor) {
    if (!UUID_RE.test(String(scoreId || ''))) throw new NotFoundException('기록을 찾을 수 없어요');
    const hidden = parseOptionalBool(body?.hidden);
    const resetNickname = parseOptionalBool(body?.resetNickname);
    const lockNickname = parseOptionalBool(body?.lockNickname);
    if (hidden === null || resetNickname === null || lockNickname === null) throw new BadRequestException('참/거짓 칸이 올바르지 않아요');
    if (hidden === undefined && !resetNickname && lockNickname === undefined) throw new BadRequestException('바꿀 내용이 없어요');
    const reason = parseReason(body?.reason);
    const row = await this.prisma.weddingRunScore.findUnique({ where: { id: scoreId }, select: { playerKey: true } });
    if (!row) throw new NotFoundException('기록을 찾을 수 없어요');
    const player = await this.prisma.weddingRunPlayer.findUnique({ where: { playerKey: row.playerKey } });
    if (!player) throw new NotFoundException('플레이어를 찾을 수 없어요');
    const result = await this.prisma.$transaction(async (tx) => {
      if (hidden !== undefined) {
        await this.setPlayersHidden({ playerKey: player.playerKey }, hidden, hidden ? (reason ? `admin:${reason}` : 'admin') : null, tx);
      }
      const nickData: Prisma.WeddingRunPlayerUpdateInput = {};
      if (resetNickname) {
        nickData.nickname = defaultWeddingRunNickname(player.deviceId);
        nickData.nicknameKey = null;
        nickData.nicknameLocked = lockNickname ?? true;
      } else if (lockNickname !== undefined) {
        nickData.nicknameLocked = lockNickname;
      }
      if (Object.keys(nickData).length) await tx.weddingRunPlayer.update({ where: { playerKey: player.playerKey }, data: nickData });
      const after = await tx.weddingRunPlayer.findUnique({ where: { playerKey: player.playerKey } });
      await this.audit(
        tx,
        actor,
        'game.wedding_run.player_update',
        'wedding_run_player',
        player.playerKey,
        { nickname: player.nickname, nicknameLocked: player.nicknameLocked, hiddenAt: player.hiddenAt },
        { nickname: after?.nickname, nicknameLocked: after?.nicknameLocked, hiddenAt: after?.hiddenAt, hidden, resetNickname, lockNickname },
        reason,
      );
      return after;
    });
    this.clearCaches();
    return {
      playerKey: player.playerKey,
      nickname: result?.nickname ?? player.nickname,
      nicknameLocked: !!result?.nicknameLocked,
      hidden: !!result?.hiddenAt,
    };
  }

  /** 운영 변경 이력(admin_audit_logs) — 바꾸는 쿼리와 같은 트랜잭션 */
  private async audit(tx: Tx, actor: AdminActor, action: string, targetType: string, targetId: string, before: unknown, after: unknown, reason: string | null) {
    await tx.adminAuditLog.create({
      data: {
        adminId: actor.id,
        adminEmail: actor.email,
        action,
        targetType,
        targetId,
        beforeState: JSON.parse(JSON.stringify(before ?? {})),
        afterState: JSON.parse(JSON.stringify(after ?? {})),
        reason,
      },
    });
  }

  // ── 청소 ──

  /** 다 쓴·만료된 세션(하루 지난 것)과 지난 기간 요약을 조금씩 지운다(10분마다, 응답을 기다리게 하지 않음) */
  private maybeCleanup(now: number) {
    if (now - this.lastCleanupAt < WR_CLEANUP_EVERY_MS) return;
    this.lastCleanupAt = now;
    this.cleanup(now).catch((e) => this.logger.warn(`wedding-run cleanup failed: ${(e as Error)?.message || e}`));
  }

  /** 한 번 청소 — 지운 행 수(시험 스크립트가 바로 부른다) */
  async cleanup(now: number): Promise<{ sessions: number; bests: number }> {
    const cutoff = new Date(now - WR_SESSION_KEEP_MS).toISOString();
    const sessions = await this.prisma.$executeRaw(Prisma.sql`/* wr:cleanup-sessions */
      DELETE FROM "wedding_run_sessions" WHERE "id" IN (
        SELECT "id" FROM "wedding_run_sessions" WHERE "startedAt" < ${cutoff}::timestamptz LIMIT ${WR_CLEANUP_BATCH}
      )`);
    const dayCut = wrPeriodKey('today', now - WR_KEEP_DAY_BESTS_DAYS * DAY_MS);
    const weekCut = wrPeriodKey('week', now - WR_KEEP_WEEK_BESTS_DAYS * DAY_MS);
    const bests = await this.prisma.$executeRaw(Prisma.sql`/* wr:cleanup-bests */
      DELETE FROM "wedding_run_bests" WHERE ("periodKey", "playerKey") IN (
        SELECT "periodKey", "playerKey" FROM "wedding_run_bests"
        WHERE ("periodKey" > 'd:' AND "periodKey" < ${dayCut}) OR ("periodKey" > 'w:' AND "periodKey" < ${weekCut})
        LIMIT ${WR_CLEANUP_BATCH}
      )`);
    return { sessions, bests };
  }
}

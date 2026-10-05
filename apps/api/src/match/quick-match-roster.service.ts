import { BadRequestException, Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MATCH_EXCLUDED_PRO_IDS, QUICK_MATCH_FEATURED } from './quick-match.config';

/**
 * 퀵매칭 지정 사회자 명단(261005) — 단일 진실 = DB 표 quick_match_designated_pros(어드민 회원 관리 · 사회자 '퀵매칭' 스위치).
 *
 * · 첫 화면(리롤 전) 후보 = 이 명단, 성별 묶음(male/female)도 이 표의 gender 로 나눈다(프로필 성별 아님 — 260927 사장 명단 기준을 그대로 옮김).
 *   순서 = 넣은 순(createdAt) — 마이그레이션이 config 순서대로 1ms 씩 벌려 넣었다. 화면은 묶음 안에서 섞는다.
 * · 고객 번호 공개 = 퀵매칭 신청 때 '고른 사회자 ∩ 이 명단'(match.service createMatchRequest).
 * · 표가 아직 없으면(SQL 적용 전 배포) quick-match.config.ts 의 옛 명단으로 그대로 돈다 → SQL·API 배포 순서가 바뀌어도 안전.
 *   pro_profiles 에 컬럼을 붙이지 않은 것도 같은 이유(컬럼이면 SQL 전 배포 때 pro_profiles 를 읽는 모든 조회가 깨진다).
 * · 60초 기억, 어드민에서 바꾸면 바로 지운다(같은 프로세스). 인스턴스가 여럿이어도 60초 안에 맞춰진다.
 * · 매칭 제외(MATCH_EXCLUDED_PRO_IDS)는 그대로 config — 제외 사회자는 명단에 넣을 수 없고, 혹시 표에 있어도 읽을 때 뺀다.
 */
export type QuickMatchGender = 'male' | 'female';
export type QuickMatchFeatured = { male: string[]; female: string[] };
export type QuickMatchRoster = {
  featured: QuickMatchFeatured;
  ids: Set<string>;
  byId: Map<string, QuickMatchGender>;
  /** db = 표에서 읽음 · config = 표가 없어(또는 읽기 실패로) 옛 명단 */
  source: 'db' | 'config';
  /** true = DB 일시 오류로 대신 쓴 명단(마지막 명단 또는 config) — 고객 번호 공개처럼 넓히면 안 되는 곳은 이걸 보고 닫는다 */
  degraded?: boolean;
};

/** 어드민 스위치 응답(API 계약: { id, quickMatchDesignated } + 덧붙인 칸) */
export type QuickMatchToggleResult = {
  id: string;
  quickMatchDesignated: boolean;
  quickMatchGender: QuickMatchGender | null;
  quickMatchCount: number;
  quickMatchEditable: boolean;
};

export const QUICK_MATCH_ROSTER_TTL_MS = 60_000;

/** 프로필 성별 글자(남성/여성/male/female …) → 묶음. 화면 quick-match matchesGender 와 같은 규칙 */
export function genderBucketOf(raw: unknown): QuickMatchGender | null {
  const v = String(raw ?? '').trim().toLowerCase();
  if (!v) return null;
  if (v === 'male' || v === 'm') return 'male';
  if (v === 'female' || v === 'f') return 'female';
  const m = v.includes('남');
  const f = v.includes('여');
  if (m && !f) return 'male';
  if (f && !m) return 'female';
  return null;
}

/** 표 줄(넣은 순) → 명단. 성별 모르는 줄·중복·매칭 제외는 뺀다 */
export function buildRoster(rows: Array<{ proProfileId: string; gender: string }>, source: 'db' | 'config'): QuickMatchRoster {
  const featured: QuickMatchFeatured = { male: [], female: [] };
  const byId = new Map<string, QuickMatchGender>();
  for (const r of rows) {
    const g = genderBucketOf(r.gender);
    if (!g || byId.has(r.proProfileId) || MATCH_EXCLUDED_PRO_IDS.has(r.proProfileId)) continue;
    byId.set(r.proProfileId, g);
    featured[g].push(r.proProfileId);
  }
  return { featured, ids: new Set(byId.keys()), byId, source };
}

/** 옛 명단(quick-match.config.ts) — 표가 없을 때 · 마이그레이션 초기값과 같은 순서 */
export function configRoster(): QuickMatchRoster {
  return buildRoster(
    [
      ...QUICK_MATCH_FEATURED.male.map((proProfileId) => ({ proProfileId, gender: 'male' })),
      ...QUICK_MATCH_FEATURED.female.map((proProfileId) => ({ proProfileId, gender: 'female' })),
    ],
    'config',
  );
}

/** 표가 아직 없다 — SQL 적용 전(Prisma P2021 / Postgres 42P01) */
export function isMissingRosterTable(e: unknown): boolean {
  const err = e as { code?: string; message?: string; meta?: { code?: string; table?: string } } | null;
  if (!err) return false;
  if (err.code === 'P2021') return true;
  if (err.code === '42P01' || err.meta?.code === '42P01') return true;
  const msg = String(err.message || '');
  return /quick_match_designated_pros/.test(msg) && /does not exist/i.test(msg);
}

function isUniqueViolation(e: unknown): boolean {
  return (e as { code?: string } | null)?.code === 'P2002';
}

/** 요청 본문 → 켬/끔. 계약은 { designated: boolean }, 예전 이름 on 도 받는다 */
export function parseDesignated(body: unknown): boolean | null {
  const b = (body && typeof body === 'object' ? body : {}) as { designated?: unknown; on?: unknown };
  if (typeof b.designated === 'boolean') return b.designated;
  if (typeof b.on === 'boolean') return b.on;
  return null;
}

@Injectable()
export class QuickMatchRosterService {
  private readonly logger = new Logger(QuickMatchRosterService.name);
  private cache: { at: number; roster: QuickMatchRoster } | null = null;
  /** 마지막으로 DB 에서 읽은 명단 — 일시 오류 때 옛 config 보다 먼저 쓴다(invalidate 해도 남김) */
  private lastGood: QuickMatchRoster | null = null;
  private inflight: Promise<QuickMatchRoster> | null = null;
  private version = 0;
  private warnedMissing = false;

  constructor(private prisma: PrismaService) {}

  /** 지금 명단(60초 기억). 절대 throw 하지 않는다 — 못 읽으면 마지막 명단 → config */
  async roster(): Promise<QuickMatchRoster> {
    if (this.cache && Date.now() - this.cache.at < QUICK_MATCH_ROSTER_TTL_MS) return this.cache.roster;
    if (this.inflight) return this.inflight;
    const v = this.version;
    const p = this.load().then(({ roster, cacheable }) => {
      // 읽는 사이 어드민이 바꿨으면(version 다름) 이 결과는 기억하지 않는다
      if (cacheable && v === this.version) {
        this.cache = { at: Date.now(), roster };
        if (roster.source === 'db') this.lastGood = roster;
      }
      return roster;
    });
    this.inflight = p;
    p.finally(() => {
      if (this.inflight === p) this.inflight = null;
    }).catch(() => {});
    return p;
  }

  /** 어드민에서 바꾼 직후 — 다음 읽기는 DB 에서 새로(읽는 중이던 옛 결과는 기억하지 않는다) */
  invalidate() {
    this.version++;
    this.cache = null;
    this.inflight = null;
  }

  private async load(): Promise<{ roster: QuickMatchRoster; cacheable: boolean }> {
    try {
      const rows = await this.prisma.quickMatchDesignatedPro.findMany({
        select: { proProfileId: true, gender: true },
        orderBy: [{ createdAt: 'asc' }, { proProfileId: 'asc' }],
      });
      this.warnedMissing = false;
      return { roster: buildRoster(rows, 'db'), cacheable: true };
    } catch (e) {
      if (isMissingRosterTable(e)) {
        if (!this.warnedMissing) {
          this.warnedMissing = true;
          this.logger.warn('quick_match_designated_pros 표가 없어 quick-match.config.ts 명단을 씁니다(SQL 적용 전).');
        }
        return { roster: configRoster(), cacheable: true };
      }
      // DB 일시 오류 — 마지막 명단이 있으면 그것, 없으면 옛 명단(degraded 표시). 기억하지 않는다(다음 요청에서 다시 읽기).
      // 첫 화면 후보는 이걸로 그대로 돌고, 번호 공개(match.service)는 degraded 면 닫는다.
      this.logger.warn(`퀵매칭 명단 읽기 실패: ${e instanceof Error ? e.message : String(e)}`);
      return { roster: { ...(this.lastGood ?? configRoster()), degraded: true }, cacheable: false };
    }
  }

  /**
   * 어드민 스위치 — designated=true 면 명단에 넣고(성별 묶음 = 받은 gender → 이미 있던 값 → 프로필 성별), false 면 뺀다.
   * audit 는 같은 트랜잭션에서 변경 이력을 남기는 데 쓴다(바뀐 게 있을 때만).
   */
  async set(
    proProfileId: string,
    input: { designated: boolean; gender?: unknown },
    opts: {
      updatedBy?: string | null;
      audit?: (db: Prisma.TransactionClient, before: { gender: QuickMatchGender } | null, after: { gender: QuickMatchGender } | null) => Promise<unknown>;
    } = {},
  ): Promise<QuickMatchToggleResult> {
    const on = input.designated === true;
    const hasGender = input.gender != null && input.gender !== '';
    const wanted = hasGender ? genderBucketOf(input.gender) : null;
    if (hasGender && !wanted) throw new BadRequestException('성별 묶음은 남(male)·여(female) 중 하나예요.');

    const profile = await this.prisma.proProfile.findUnique({ where: { id: proProfileId }, select: { id: true, gender: true } });
    if (!profile) throw new NotFoundException('사회자를 찾을 수 없어요.');
    if (on && MATCH_EXCLUDED_PRO_IDS.has(proProfileId)) {
      throw new BadRequestException('매칭 제외 사회자라 퀵매칭에 넣을 수 없어요.');
    }

    const apply = () =>
      this.prisma.$transaction(async (tx) => {
        const cur = await tx.quickMatchDesignatedPro.findUnique({ where: { proProfileId }, select: { gender: true } });
        const curGender = cur ? genderBucketOf(cur.gender) : null;
        const before = cur && curGender ? { gender: curGender } : null;
        let after: { gender: QuickMatchGender } | null = null;
        if (on) {
          const gender = wanted ?? curGender ?? genderBucketOf(profile.gender);
          if (!gender) {
            // 화면은 이 code 를 보면 남/여 묶음을 골라 gender 와 함께 다시 보낸다
            throw new BadRequestException({
              statusCode: 400,
              code: 'QUICK_MATCH_GENDER_REQUIRED',
              message: '프로필 성별이 비어 있어요. 퀵매칭 첫 화면의 남/여 묶음을 골라 주세요(사회자 수정에서 성별을 정해 둬도 돼요).',
            });
          }
          if (!cur) {
            await tx.quickMatchDesignatedPro.create({ data: { proProfileId, gender, updatedBy: opts.updatedBy ?? null } });
          } else if (cur.gender !== gender) {
            // updateMany — 다른 창이 그 사이 줄을 지웠어도 P2025(500) 대신 0행으로 끝난다
            const { count } = await tx.quickMatchDesignatedPro.updateMany({ where: { proProfileId }, data: { gender, updatedBy: opts.updatedBy ?? null } });
            if (count === 0) await tx.quickMatchDesignatedPro.create({ data: { proProfileId, gender, updatedBy: opts.updatedBy ?? null } });
          }
          after = { gender };
        } else if (cur) {
          // deleteMany — 두 창이 거의 동시에 끄면 뒤쪽은 0행(이미 꺼짐)이라 이력을 남기지 않고 '꺼짐'으로 끝낸다
          const { count } = await tx.quickMatchDesignatedPro.deleteMany({ where: { proProfileId } });
          if (count === 0) return null;
        }
        const changed = (before?.gender ?? null) !== (after?.gender ?? null);
        if (changed && opts.audit) await opts.audit(tx, before, after);
        return after;
      });

    let result: { gender: QuickMatchGender } | null;
    try {
      try {
        result = await apply();
      } catch (e) {
        // 같은 사람을 두 창에서 동시에 켬 — 한쪽이 먼저 넣었으면 다시 한 번(이번엔 '이미 있음' 길)
        if (!isUniqueViolation(e)) throw e;
        result = await apply();
      }
    } catch (e) {
      if (isMissingRosterTable(e)) {
        throw new ServiceUnavailableException('퀵매칭 명단 표가 아직 없어요 — DB 반영(SQL) 뒤에 바꿀 수 있어요.');
      }
      throw e;
    } finally {
      this.invalidate();
    }
    const roster = await this.roster();
    return {
      id: proProfileId,
      quickMatchDesignated: !!result,
      quickMatchGender: result?.gender ?? null,
      quickMatchCount: roster.ids.size,
      quickMatchEditable: roster.source === 'db',
    };
  }
}

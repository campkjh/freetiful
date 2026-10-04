import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/** 요청한 관리자 — AdminGuard 가 JWT 관리자면 req.user 를 채운다. x-admin-key 로 들어오면 'admin-key' */
export type AdminActor = { id: string; email: string | null };

export function actorFrom(req: any): AdminActor {
  const u = req?.user;
  if (u?.id) return { id: String(u.id), email: u.email ? String(u.email) : null };
  return { id: 'admin-key', email: null };
}

/** 트랜잭션 안에서도 쓰도록 — prisma 또는 interactive tx */
type Db = Pick<PrismaService, 'adminAuditLog'>;

export type AuditEntry = {
  action: string;
  targetType: string;
  targetId?: string | null;
  before?: unknown;
  after?: unknown;
  reason?: string | null;
};

/** Json 칸에 넣을 수 있게 — Date 는 ISO 문자열로, undefined 는 빼고 */
function toJson(v: unknown): any {
  if (v === undefined) return undefined;
  return JSON.parse(JSON.stringify(v ?? null));
}

/**
 * 관리자 변경 이력(261004 — 운영 프로필 생성·운영 글 게시·수치 수정 등): 관리자 id · 대상 id · 변경 전후 · 사유 · 시각.
 * 바꾸는 쿼리와 같은 트랜잭션(db 인자)으로 넣으면 기록 없이 바뀌는 일이 없다.
 */
@Injectable()
export class AdminAuditService {
  private readonly logger = new Logger(AdminAuditService.name);

  constructor(private prisma: PrismaService) {}

  async log(actor: AdminActor, entry: AuditEntry, db: Db = this.prisma) {
    return db.adminAuditLog.create({
      data: {
        adminId: actor.id,
        adminEmail: actor.email,
        action: entry.action,
        targetType: entry.targetType,
        targetId: entry.targetId ?? null,
        beforeState: toJson(entry.before),
        afterState: toJson(entry.after),
        reason: entry.reason?.trim() || null,
      },
    });
  }

  /** 변경 이력 목록 — 최신순. group: operator(운영 프로필·글) · metric(수치) · test(테스트 수치) · community(숨김·신고) */
  async list(params: { page?: number; limit?: number; group?: string; targetId?: string; q?: string }) {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(100, Math.max(1, params.limit || 30));
    const where: any = {};
    const prefixes: Record<string, string[]> = {
      operator: ['operator_profile.', 'operator_post.'],
      metric: ['metric.'],
      test: ['test_metric.'],
      community: ['community.'],
    };
    if (params.group && prefixes[params.group]) where.OR = prefixes[params.group].map((p) => ({ action: { startsWith: p } }));
    if (params.targetId) where.targetId = params.targetId;
    const q = (params.q || '').trim();
    if (q) where.AND = [{ OR: [{ reason: { contains: q, mode: 'insensitive' } }, { targetId: q }, { adminEmail: { contains: q, mode: 'insensitive' } }] }];

    const [rows, total] = await Promise.all([
      this.prisma.adminAuditLog.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
      this.prisma.adminAuditLog.count({ where }),
    ]);
    // 관리자 이름(계정 id 인 것만)
    const adminIds = Array.from(new Set(rows.map((r) => r.adminId).filter((id) => /^[0-9a-f-]{36}$/i.test(id))));
    const admins = adminIds.length ? await this.prisma.user.findMany({ where: { id: { in: adminIds } }, select: { id: true, name: true, email: true } }) : [];
    const adminMap = new Map(admins.map((a) => [a.id, a]));
    return {
      data: rows.map((r) => {
        const a = adminMap.get(r.adminId);
        return {
          id: r.id,
          adminId: r.adminId,
          adminName: a?.name || (r.adminId.startsWith('system') ? '시스템' : r.adminId === 'admin-key' ? '관리자 키' : null),
          adminEmail: r.adminEmail || a?.email || null,
          action: r.action,
          targetType: r.targetType,
          targetId: r.targetId,
          before: r.beforeState,
          after: r.afterState,
          reason: r.reason,
          createdAt: r.createdAt,
        };
      }),
      total,
      page,
      limit,
    };
  }

  /** 잘못 넣은 기록이라도 본 작업은 막지 않아야 할 때(예: 조회 화면) */
  async tryLog(actor: AdminActor, entry: AuditEntry) {
    try {
      await this.log(actor, entry);
    } catch (e: any) {
      this.logger.warn(`audit log failed ${entry.action}: ${e?.message || e}`);
    }
  }
}

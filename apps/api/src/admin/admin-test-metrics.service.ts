import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AdminActor, AdminAuditService } from './admin-audit.service';
import { isTestMetricsEnabled } from '../common/app-env';

/**
 * 테스트 좋아요·조회수(261004) — 개발·스테이징 서버(APP_ENV=development|staging)에서만.
 *  · 실제 수치(community_post_likes 행 · community_post_views)는 건드리지 않고 community_test_metrics 에만 쓴다.
 *  · 운영 서버: 컨트롤러 가드가 404, 여기서도 한 번 더 막는다(다른 곳에서 불러도 실행 안 됨).
 */
const MAX_TEST_VALUE = 10_000_000;

@Injectable()
export class AdminTestMetricsService {
  constructor(
    private prisma: PrismaService,
    private audit: AdminAuditService,
  ) {}

  private assertEnabled() {
    if (!isTestMetricsEnabled()) throw new NotFoundException('Cannot find this route');
  }

  private async run<T>(fn: (db: any) => Promise<T>): Promise<T> {
    const p: any = this.prisma;
    if (typeof p.$transaction === 'function') return p.$transaction((tx: any) => fn(tx), { timeout: 20000 });
    return fn(p);
  }

  private toValue(raw: unknown, label: string) {
    const n = Number(raw);
    if (!Number.isInteger(n) || n < 0 || n > MAX_TEST_VALUE) throw new BadRequestException(`${label}는 0~${MAX_TEST_VALUE.toLocaleString()} 사이 정수로 넣어 주세요`);
    return n;
  }

  async list() {
    this.assertEnabled();
    const rows = await this.prisma.communityTestMetric.findMany({ orderBy: { updatedAt: 'desc' }, take: 500 });
    const posts = rows.length ? await this.prisma.communityPost.findMany({ where: { id: { in: rows.map((r) => r.postId) } }, select: { id: true, title: true } }) : [];
    const title = new Map(posts.map((p) => [p.id, p.title]));
    return { data: rows.map((r) => ({ postId: r.postId, title: title.get(r.postId) || null, likes: r.likes, views: r.views, updatedAt: r.updatedAt })) };
  }

  async set(actor: AdminActor, postId: string, body: any) {
    this.assertEnabled();
    const likes = this.toValue(body?.likes ?? 0, '테스트 좋아요');
    const views = this.toValue(body?.views ?? 0, '테스트 조회수');
    const post = await this.prisma.communityPost.findUnique({ where: { id: postId }, select: { id: true } });
    if (!post) throw new NotFoundException('글을 찾을 수 없어요');
    return this.run(async (db) => {
      const prev = await db.communityTestMetric.findUnique({ where: { postId } });
      await db.communityTestMetric.upsert({ where: { postId }, create: { postId, likes, views, updatedByAdminId: actor.id }, update: { likes, views, updatedByAdminId: actor.id } });
      await this.audit.log(
        actor,
        { action: 'test_metric.set', targetType: 'community_post', targetId: postId, before: prev ? { likes: prev.likes, views: prev.views } : null, after: { likes, views }, reason: body?.reason },
        db,
      );
      return { postId, likes, views };
    });
  }

  async reset(actor: AdminActor, postId: string) {
    this.assertEnabled();
    return this.run(async (db) => {
      const prev = await db.communityTestMetric.findUnique({ where: { postId } });
      if (!prev) return { postId, reset: false };
      await db.communityTestMetric.delete({ where: { postId } });
      await this.audit.log(actor, { action: 'test_metric.reset', targetType: 'community_post', targetId: postId, before: { likes: prev.likes, views: prev.views }, after: null }, db);
      return { postId, reset: true };
    });
  }

  async resetAll(actor: AdminActor) {
    this.assertEnabled();
    return this.run(async (db) => {
      const r = await db.communityTestMetric.deleteMany({});
      await this.audit.log(actor, { action: 'test_metric.reset_all', targetType: 'community_test_metric', targetId: null, after: { deleted: r.count } }, db);
      return { deleted: r.count };
    });
  }
}

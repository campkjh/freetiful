import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AdminActor, AdminAuditService } from './admin-audit.service';
import { POST_STATUSES, normalizeOperatorName, operatorNameProblem } from '../community/community-operator';
import { REACTION_TYPES } from '../community/community.constants';
import { appEnv, isTestMetricsEnabled } from '../common/app-env';

/**
 * 커뮤니티 운영 콘텐츠(261004) — 운영 프로필 · 운영 글(임시저장·예약·공개/비공개) · 실제 반응 통계 · 조회수 보정.
 *  · 운영 프로필 = 전용 계정(로그인 수단 없음, operator-…@freetiful.local) + community_operator_profiles. 앱 글·댓글에 늘 '운영팀' 표시.
 *    회원 계정으로 글을 쓰는 길은 없다(사칭 금지) — 글의 작성 계정은 운영 프로필 계정만.
 *  · 글 노출은 앱이 이미 쓰는 isActive 로만: published 일 때만 true. draft·scheduled·private 은 앱에 안 보인다.
 *  · 조회수 보정은 '줄이기'만 — 실제 조회 기록(행)이 없어 늘리는 근거를 댈 수 없다. 좋아요는 실제로 누른 행을 세므로 보정할 게 없다.
 *  · 모든 변경은 같은 트랜잭션으로 admin_audit_logs 에 남긴다.
 */
const SYSTEM_SCHEDULE: AdminActor = { id: 'system:schedule', email: null };
const MAX_TITLE = 120;
const MAX_CONTENT = 10000;
const MAX_BIO = 120;
const MAX_IMAGES = 5;

type Status = (typeof POST_STATUSES)[number];
type PostInput = { title?: string; content?: string; groupId?: string; imageUrls?: string[] };

const okImageUrl = (u: unknown): u is string =>
  typeof u === 'string' && u.length < 1000 && (/^https:\/\//.test(u) || u.startsWith('/uploads/') || u.startsWith('/images/'));

function pick<T extends Record<string, any>>(o: T, keys: string[]) {
  const r: Record<string, any> = {};
  for (const k of keys) r[k] = o[k];
  return r;
}

@Injectable()
export class AdminOperatorService {
  private readonly logger = new Logger(AdminOperatorService.name);

  constructor(
    private prisma: PrismaService,
    private audit: AdminAuditService,
  ) {}

  /** 트랜잭션으로 묶어 돌린다(이미 트랜잭션 안이면 그대로) — 바꾸기와 기록이 같이 성공하거나 같이 실패 */
  private async run<T>(fn: (db: any) => Promise<T>): Promise<T> {
    const p: any = this.prisma;
    if (typeof p.$transaction === 'function') return p.$transaction((tx: any) => fn(tx), { timeout: 20000 });
    return fn(p);
  }

  env() {
    return { appEnv: appEnv(), testMetricsEnabled: isTestMetricsEnabled() };
  }

  // ─── 운영 프로필 ────────────────────────────────────────────────────
  private cleanAvatar(raw: unknown): string | null {
    if (raw === null || raw === undefined || raw === '') return null;
    if (!okImageUrl(raw)) throw new BadRequestException('프로필 사진 주소가 올바르지 않아요 — 사진을 다시 올려 주세요');
    return raw;
  }

  private cleanBio(raw: unknown): string | null {
    const t = String(raw ?? '').replace(/\s+/g, ' ').trim();
    if (t.length > MAX_BIO) throw new BadRequestException(`소개는 ${MAX_BIO}자까지 쓸 수 있어요`);
    return t || null;
  }

  /** 이름 규칙 + 다른 계정(회원·사회자·업체·다른 운영 프로필)·웨딩숲 닉네임과 겹치지 않게 */
  private async assertNameAvailable(name: string, exceptUserId?: string) {
    const problem = operatorNameProblem(name);
    if (problem) throw new BadRequestException(problem);
    const [userSame, nickSame] = await Promise.all([
      this.prisma.user.findFirst({
        where: { name: { equals: name, mode: 'insensitive' }, ...(exceptUserId ? { id: { not: exceptUserId } } : {}) },
        select: { id: true },
      }),
      this.prisma.communityNickname.findFirst({ where: { nickname: { equals: name, mode: 'insensitive' } }, select: { userId: true } }),
    ]);
    if (userSame || nickSame) throw new BadRequestException('이미 다른 계정이 쓰는 이름이에요 — 회원과 헷갈리지 않게 다른 이름으로 정해 주세요');
  }

  async listProfiles() {
    const rows = await this.prisma.communityOperatorProfile.findMany({ orderBy: [{ isActive: 'desc' }, { createdAt: 'asc' }] });
    const userIds = rows.map((r) => r.userId);
    const [users, counts, last] = await Promise.all([
      this.prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, profileImageUrl: true } }),
      this.prisma.communityPost.groupBy({ by: ['userId', 'status'], where: { userId: { in: userIds } }, _count: { _all: true } }),
      this.prisma.communityPost.groupBy({ by: ['userId'], where: { userId: { in: userIds }, status: 'published' }, _max: { createdAt: true } }),
    ]);
    const userMap = new Map(users.map((u) => [u.id, u]));
    const lastMap = new Map(last.map((l) => [l.userId as string, l._max.createdAt]));
    return {
      data: rows.map((r) => {
        const u = userMap.get(r.userId);
        const posts: Record<Status, number> = { published: 0, draft: 0, scheduled: 0, private: 0 };
        for (const c of counts) if (c.userId === r.userId && (POST_STATUSES as readonly string[]).includes(c.status)) posts[c.status as Status] = c._count._all;
        return {
          id: r.id,
          userId: r.userId,
          nickname: u?.name || r.nickname,
          avatarUrl: u?.profileImageUrl ?? r.avatarUrl,
          bio: r.bio,
          isActive: r.isActive,
          createdByAdminId: r.createdByAdminId,
          createdAt: r.createdAt,
          posts,
          lastPostAt: lastMap.get(r.userId) || null,
        };
      }),
    };
  }

  async createProfile(actor: AdminActor, body: any) {
    const nickname = normalizeOperatorName(body?.nickname);
    await this.assertNameAvailable(nickname);
    const avatarUrl = this.cleanAvatar(body?.avatarUrl);
    const bio = this.cleanBio(body?.bio);
    return this.run(async (db) => {
      const suffix = randomUUID().replace(/-/g, '').slice(0, 12);
      // 로그인 수단 없는 전용 계정 — 회원 계정을 빌리지 않는다
      const user = await db.user.create({
        data: {
          role: 'general',
          name: nickname,
          email: `operator-${suffix}@freetiful.local`,
          referralCode: `OP${suffix.slice(0, 10).toUpperCase()}`,
          profileImageUrl: avatarUrl,
        },
      });
      const profile = await db.communityOperatorProfile.create({
        data: { userId: user.id, nickname, avatarUrl, bio, createdByAdminId: actor.id },
      });
      await this.audit.log(
        actor,
        { action: 'operator_profile.create', targetType: 'operator_profile', targetId: profile.id, after: { userId: user.id, nickname, avatarUrl, bio }, reason: body?.reason },
        db,
      );
      return { id: profile.id, userId: user.id };
    });
  }

  async updateProfile(actor: AdminActor, id: string, body: any) {
    const prof = await this.prisma.communityOperatorProfile.findUnique({ where: { id } });
    if (!prof) throw new NotFoundException('운영 프로필을 찾을 수 없어요');
    const user = await this.prisma.user.findUnique({ where: { id: prof.userId }, select: { name: true, profileImageUrl: true } });
    const before = { nickname: user?.name || prof.nickname, avatarUrl: user?.profileImageUrl ?? prof.avatarUrl, bio: prof.bio, isActive: prof.isActive };
    const next = { ...before };
    if (body?.nickname !== undefined) {
      next.nickname = normalizeOperatorName(body.nickname);
      if (next.nickname !== before.nickname) await this.assertNameAvailable(next.nickname, prof.userId);
    }
    if (body?.avatarUrl !== undefined) next.avatarUrl = this.cleanAvatar(body.avatarUrl);
    if (body?.bio !== undefined) next.bio = this.cleanBio(body.bio);
    if (body?.isActive !== undefined) next.isActive = !!body.isActive;
    const changed = (Object.keys(before) as (keyof typeof before)[]).filter((k) => before[k] !== next[k]);
    if (changed.length === 0) return { success: true, changed: [] };
    const renamed = next.nickname !== before.nickname || next.avatarUrl !== before.avatarUrl;
    await this.run(async (db) => {
      if (renamed) {
        // 앱 '에디터 이름 바꾸기'와 같은 규칙 — 이미 보여준 글·댓글엔 그때 이름·사진을 박아 둔다(이름을 바꿔도 예전 글은 그대로).
        // 아직 안 올라간 임시저장·예약 글은 새 이름으로 올라가게 둔다.
        await db.communityPost.updateMany({
          where: { userId: prof.userId, authorName: null, status: { in: ['published', 'private'] } },
          data: { authorName: before.nickname, authorAvatar: before.avatarUrl },
        });
        await db.communityComment.updateMany({ where: { userId: prof.userId, authorName: null }, data: { authorName: before.nickname, authorAvatar: before.avatarUrl } });
        await db.user.update({ where: { id: prof.userId }, data: { name: next.nickname, profileImageUrl: next.avatarUrl } });
      }
      await db.communityOperatorProfile.update({ where: { id }, data: { nickname: next.nickname, avatarUrl: next.avatarUrl, bio: next.bio, isActive: next.isActive } });
      await this.audit.log(
        actor,
        {
          action: changed.length === 1 && changed[0] === 'isActive' ? (next.isActive ? 'operator_profile.activate' : 'operator_profile.deactivate') : 'operator_profile.update',
          targetType: 'operator_profile',
          targetId: id,
          before: pick(before, changed),
          after: pick(next, changed),
          reason: body?.reason,
        },
        db,
      );
    });
    return { success: true, changed };
  }

  // ─── 운영 글 ────────────────────────────────────────────────────────
  private async profilesByUser() {
    const rows = await this.prisma.communityOperatorProfile.findMany({ select: { id: true, userId: true, nickname: true, avatarUrl: true, isActive: true } });
    return new Map(rows.map((r) => [r.userId, r]));
  }

  private async activeProfile(profileId: unknown) {
    const id = typeof profileId === 'string' ? profileId : '';
    const prof = id ? await this.prisma.communityOperatorProfile.findUnique({ where: { id } }) : null;
    if (!prof || !prof.isActive) throw new BadRequestException('글을 올릴 운영 프로필을 골라 주세요(쉬는 프로필은 쓸 수 없어요)');
    return prof;
  }

  /** 넘어온 칸만 검사해서 돌려준다 */
  private async cleanPostInput(body: any): Promise<PostInput> {
    const out: PostInput = {};
    if (body?.title !== undefined) {
      const t = String(body.title ?? '').trim();
      if (!t) throw new BadRequestException('제목을 입력해 주세요');
      if (t.length > MAX_TITLE) throw new BadRequestException(`제목은 ${MAX_TITLE}자까지예요`);
      out.title = t;
    }
    if (body?.content !== undefined) {
      const c = String(body.content ?? '').trim();
      if (c.length > MAX_CONTENT) throw new BadRequestException(`본문은 ${MAX_CONTENT.toLocaleString()}자까지예요`);
      out.content = c;
    }
    if (body?.groupId !== undefined) {
      const g = typeof body.groupId === 'string' ? await this.prisma.communityGroup.findUnique({ where: { id: body.groupId }, include: { children: { select: { id: true } } } }) : null;
      if (!g || !g.isActive) throw new BadRequestException('카테고리를 골라 주세요');
      if (g.children.length > 0) throw new BadRequestException('소분류 카테고리를 골라 주세요');
      out.groupId = g.id;
    }
    if (body?.imageUrls !== undefined) {
      if (!Array.isArray(body.imageUrls)) throw new BadRequestException('사진 목록이 올바르지 않아요');
      const urls = body.imageUrls.filter(okImageUrl);
      if (urls.length !== body.imageUrls.length) throw new BadRequestException('올릴 수 없는 사진 주소가 있어요 — 다시 올려 주세요');
      if (urls.length > MAX_IMAGES) throw new BadRequestException(`사진은 ${MAX_IMAGES}장까지예요`);
      out.imageUrls = urls;
    }
    return out;
  }

  /** 예약 시각 — 지금부터 1분 뒤 ~ 1년 안 */
  private parseFuture(raw: unknown): Date {
    const t = Date.parse(String(raw ?? ''));
    if (!Number.isFinite(t)) throw new BadRequestException('예약 시각을 정해 주세요');
    if (t < Date.now() + 60_000) throw new BadRequestException('예약 시각은 지금부터 1분 뒤 이후로 정해 주세요');
    if (t > Date.now() + 366 * 86400000) throw new BadRequestException('예약은 1년 안으로만 할 수 있어요');
    return new Date(t);
  }

  /** 실제 반응 — 좋아요(종류별)·댓글·조회 */
  private async realStats(postIds: string[]) {
    const empty = () => ({ likes: 0, likesByType: Object.fromEntries(REACTION_TYPES.map((t) => [t, 0])) as Record<string, number>, comments: 0, replies: 0, views: 0 });
    const out = new Map<string, ReturnType<typeof empty>>();
    if (postIds.length === 0) return out;
    const [likeRows, commentRows, viewRows] = await Promise.all([
      this.prisma.communityPostLike.groupBy({ by: ['postId', 'type'], where: { postId: { in: postIds } }, _count: { _all: true } }),
      this.prisma.communityComment.groupBy({ by: ['postId', 'parentId'], where: { postId: { in: postIds }, isActive: true }, _count: { _all: true } }),
      this.prisma.communityPostView.findMany({ where: { postId: { in: postIds } }, select: { postId: true, count: true } }),
    ]);
    for (const id of postIds) out.set(id, empty());
    for (const r of likeRows) {
      const s = out.get(r.postId)!;
      s.likes += r._count._all;
      s.likesByType[r.type] = (s.likesByType[r.type] || 0) + r._count._all;
    }
    for (const r of commentRows) {
      const s = out.get(r.postId)!;
      s.comments += r._count._all;
      if (r.parentId) s.replies += r._count._all;
    }
    for (const r of viewRows) out.get(r.postId)!.views = r.count;
    return out;
  }

  /** 테스트 수치(개발·스테이징에서만 읽는다) */
  private async testMetrics(postIds: string[]) {
    const m = new Map<string, { likes: number; views: number }>();
    if (!isTestMetricsEnabled() || postIds.length === 0) return m;
    const rows = await this.prisma.communityTestMetric.findMany({ where: { postId: { in: postIds } } });
    for (const r of rows) m.set(r.postId, { likes: r.likes, views: r.views });
    return m;
  }

  private excerpt(text: string, n = 110) {
    const t = (text || '').replace(/\s+/g, ' ').trim();
    return t.length > n ? `${t.slice(0, n)}…` : t;
  }

  async listPosts(params: { page?: number; limit?: number; status?: string; profileId?: string; q?: string }) {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(100, Math.max(1, params.limit || 20));
    const profiles = await this.profilesByUser();
    let userIds = Array.from(profiles.keys());
    if (params.profileId) userIds = Array.from(profiles.values()).filter((p) => p.id === params.profileId).map((p) => p.userId);
    const where: any = { userId: { in: userIds } };
    if (params.status === 'hidden') Object.assign(where, { status: 'published', isActive: false });
    else if (params.status && (POST_STATUSES as readonly string[]).includes(params.status)) where.status = params.status;
    const q = (params.q || '').trim();
    if (q) where.OR = [{ title: { contains: q, mode: 'insensitive' } }, { content: { contains: q, mode: 'insensitive' } }];

    const [rows, total, statusCounts] = await Promise.all([
      this.prisma.communityPost.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          group: { select: { id: true, name: true, parent: { select: { name: true } } } },
          images: { select: { imageUrl: true }, orderBy: { sortOrder: 'asc' }, take: 1 },
          _count: { select: { images: true } },
        },
      }),
      this.prisma.communityPost.count({ where }),
      this.prisma.communityPost.groupBy({ by: ['status'], where: { userId: { in: Array.from(profiles.keys()) } }, _count: { _all: true } }),
    ]);
    const ids = rows.map((r) => r.id);
    const [stats, test] = await Promise.all([this.realStats(ids), this.testMetrics(ids)]);
    const counts: Record<string, number> = { published: 0, draft: 0, scheduled: 0, private: 0 };
    for (const c of statusCounts) counts[c.status] = c._count._all;
    return {
      data: rows.map((p) => {
        const prof = profiles.get(p.userId || '');
        return {
          id: p.id,
          title: p.title,
          excerpt: this.excerpt(p.content),
          status: p.status,
          isActive: p.isActive,
          publishAt: p.publishAt,
          createdAt: p.createdAt,
          updatedAt: p.updatedAt,
          group: { id: p.group?.id || null, name: p.group?.name || null, parentName: p.group?.parent?.name || null },
          profile: prof ? { id: prof.id, nickname: p.authorName || prof.nickname, avatarUrl: p.authorName ? p.authorAvatar : prof.avatarUrl } : null,
          image: p.images[0]?.imageUrl || null,
          imageCount: p._count.images,
          stats: stats.get(p.id),
          test: test.get(p.id) || null,
        };
      }),
      total,
      page,
      limit,
      counts,
      testMetricsEnabled: isTestMetricsEnabled(),
    };
  }

  async getPost(id: string) {
    const p = await this.prisma.communityPost.findUnique({
      where: { id },
      include: {
        group: { select: { id: true, name: true, parent: { select: { name: true } } } },
        images: { select: { imageUrl: true }, orderBy: { sortOrder: 'asc' } },
      },
    });
    if (!p) throw new NotFoundException('글을 찾을 수 없어요');
    const prof = p.userId ? await this.prisma.communityOperatorProfile.findUnique({ where: { userId: p.userId } }) : null;
    if (!prof) throw new BadRequestException('운영 프로필로 쓴 글이 아니에요');
    const [stats, test] = await Promise.all([this.realStats([id]), this.testMetrics([id])]);
    return {
      id: p.id,
      profileId: prof.id,
      groupId: p.groupId,
      title: p.title,
      content: p.content,
      imageUrls: p.images.map((i) => i.imageUrl),
      status: p.status,
      isActive: p.isActive,
      publishAt: p.publishAt,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      group: { id: p.group?.id || null, name: p.group?.name || null, parentName: p.group?.parent?.name || null },
      stats: stats.get(id),
      test: test.get(id) || null,
    };
  }

  async createPost(actor: AdminActor, body: any) {
    const prof = await this.activeProfile(body?.profileId);
    const input = await this.cleanPostInput({ title: body?.title ?? '', content: body?.content ?? '', groupId: body?.groupId ?? null, imageUrls: body?.imageUrls ?? [] });
    if (!input.content && !(input.imageUrls || []).length) throw new BadRequestException('본문이나 사진을 넣어 주세요');
    const mode = String(body?.mode || '');
    let status: Status;
    let publishAt: Date | null = null;
    if (mode === 'publish') status = 'published';
    else if (mode === 'draft') status = 'draft';
    else if (mode === 'schedule') {
      status = 'scheduled';
      publishAt = this.parseFuture(body?.publishAt);
    } else throw new BadRequestException('게시 방법(지금 게시·예약·임시저장)을 골라 주세요');

    return this.run(async (db) => {
      const post = await db.communityPost.create({
        data: {
          userId: prof.userId,
          groupId: input.groupId!,
          title: input.title!,
          content: input.content || '',
          type: 'normal',
          status,
          isActive: status === 'published',
          publishAt,
          images: input.imageUrls?.length ? { create: input.imageUrls.map((imageUrl, i) => ({ imageUrl, sortOrder: i })) } : undefined,
          view: { create: { count: 0 } },
        },
      });
      await this.audit.log(
        actor,
        {
          action: status === 'published' ? 'operator_post.publish' : status === 'scheduled' ? 'operator_post.schedule' : 'operator_post.create',
          targetType: 'community_post',
          targetId: post.id,
          after: { profileId: prof.id, nickname: prof.nickname, groupId: input.groupId, title: input.title, content: input.content, imageUrls: input.imageUrls || [], status, publishAt },
          reason: body?.reason,
        },
        db,
      );
      return { id: post.id, status };
    });
  }

  async updatePost(actor: AdminActor, id: string, body: any) {
    const post = await this.prisma.communityPost.findUnique({ where: { id }, include: { images: { orderBy: { sortOrder: 'asc' } } } });
    if (!post) throw new NotFoundException('글을 찾을 수 없어요');
    const prof = post.userId ? await this.prisma.communityOperatorProfile.findUnique({ where: { userId: post.userId } }) : null;
    if (!prof) throw new BadRequestException('운영 프로필로 쓴 글만 여기서 고칠 수 있어요');
    const status = post.status as Status;
    const before: Record<string, any> = {
      profileId: prof.id,
      groupId: post.groupId,
      title: post.title,
      content: post.content,
      imageUrls: post.images.map((i) => i.imageUrl),
      status,
      publishAt: post.publishAt,
      isActive: post.isActive,
    };
    const input = await this.cleanPostInput(body);
    const after: Record<string, any> = { ...before, ...input };
    const data: any = {};
    if (input.title !== undefined) data.title = input.title;
    if (input.content !== undefined) data.content = input.content;
    if (input.groupId !== undefined) data.groupId = input.groupId;

    if (body?.profileId !== undefined && body.profileId !== prof.id) {
      if (status === 'published' || status === 'private') throw new BadRequestException('이미 게시한 글은 쓴 프로필을 바꿀 수 없어요');
      const np = await this.activeProfile(body.profileId);
      data.userId = np.userId;
      after.profileId = np.id;
    }

    const action = String(body?.action || 'save');
    let auditAction = 'operator_post.update';
    const now = new Date();
    switch (action) {
      case 'save':
        break;
      case 'publish':
        // 처음 게시(임시저장·예약 → 게시)는 지금 시각으로 올라가 피드 맨 위에, 비공개/숨김 → 다시 공개는 원래 시각 그대로
        if (status === 'draft' || status === 'scheduled') data.createdAt = now;
        Object.assign(data, { status: 'published', isActive: true, publishAt: null });
        auditAction = status === 'private' || (status === 'published' && !post.isActive) ? 'operator_post.visibility' : 'operator_post.publish';
        break;
      case 'schedule':
        if (status !== 'draft' && status !== 'scheduled') throw new BadRequestException('이미 게시한 글은 예약할 수 없어요');
        Object.assign(data, { status: 'scheduled', isActive: false, publishAt: this.parseFuture(body?.publishAt) });
        auditAction = 'operator_post.schedule';
        break;
      case 'unschedule':
        if (status !== 'scheduled') throw new BadRequestException('예약된 글이 아니에요');
        Object.assign(data, { status: 'draft', isActive: false, publishAt: null });
        auditAction = 'operator_post.unschedule';
        break;
      case 'private':
        if (status !== 'published') throw new BadRequestException('게시된 글만 비공개로 바꿀 수 있어요');
        Object.assign(data, { status: 'private', isActive: false });
        auditAction = 'operator_post.visibility';
        break;
      default:
        throw new BadRequestException('알 수 없는 동작이에요');
    }
    Object.assign(after, pick(data, ['status', 'isActive', 'publishAt'].filter((k) => k in data)));

    if (!after.title) throw new BadRequestException('제목을 입력해 주세요');
    if (!after.content && !(after.imageUrls || []).length) throw new BadRequestException('본문이나 사진을 넣어 주세요');

    const changed = Object.keys(after).filter((k) => JSON.stringify(after[k]) !== JSON.stringify(before[k]));
    if (changed.length === 0) return { success: true, changed: [] };

    await this.run(async (db) => {
      if (Object.keys(data).length) await db.communityPost.update({ where: { id }, data });
      if (input.imageUrls !== undefined && changed.includes('imageUrls')) {
        await db.communityPostImage.deleteMany({ where: { postId: id } });
        if (input.imageUrls.length) await db.communityPostImage.createMany({ data: input.imageUrls.map((imageUrl, i) => ({ postId: id, imageUrl, sortOrder: i })) });
      }
      await this.audit.log(actor, { action: auditAction, targetType: 'community_post', targetId: id, before: pick(before, changed), after: pick(after, changed), reason: body?.reason }, db);
    });
    return { success: true, changed, status: after.status };
  }

  async deletePost(actor: AdminActor, id: string, reason?: string) {
    const post = await this.prisma.communityPost.findUnique({ where: { id }, include: { images: { orderBy: { sortOrder: 'asc' } } } });
    if (!post) throw new NotFoundException('글을 찾을 수 없어요');
    const prof = post.userId ? await this.prisma.communityOperatorProfile.findUnique({ where: { userId: post.userId } }) : null;
    if (!prof) throw new BadRequestException('운영 프로필로 쓴 글만 여기서 지울 수 있어요');
    const stats = (await this.realStats([id])).get(id);
    await this.run(async (db) => {
      await db.communityPost.delete({ where: { id } });
      await this.audit.log(
        actor,
        {
          action: 'operator_post.delete',
          targetType: 'community_post',
          targetId: id,
          before: { profileId: prof.id, title: post.title, content: post.content, imageUrls: post.images.map((i) => i.imageUrl), status: post.status, createdAt: post.createdAt, stats },
          reason,
        },
        db,
      );
    });
    return { success: true };
  }

  /** 예약 게시 — 1분마다. 여러 서버가 같이 돌아도 status 조건부 갱신이라 한 번만 게시·기록된다 */
  @Cron(CronExpression.EVERY_MINUTE)
  async publishDueScheduled(now: Date = new Date()) {
    try {
      const due = await this.prisma.communityPost.findMany({
        where: { status: 'scheduled', publishAt: { lte: now } },
        select: { id: true, publishAt: true, title: true },
        orderBy: { publishAt: 'asc' },
        take: 50,
      });
      let published = 0;
      for (const p of due) {
        await this.run(async (db) => {
          const r = await db.communityPost.updateMany({ where: { id: p.id, status: 'scheduled' }, data: { status: 'published', isActive: true, createdAt: now } });
          if (r.count !== 1) return;
          published += 1;
          await this.audit.log(
            SYSTEM_SCHEDULE,
            { action: 'operator_post.publish', targetType: 'community_post', targetId: p.id, before: { status: 'scheduled', publishAt: p.publishAt }, after: { status: 'published', publishedAt: now }, reason: '예약 시각이 되어 자동 게시' },
            db,
          );
        });
      }
      if (published) this.logger.log(`scheduled community posts published: ${published}`);
      return { published };
    } catch (e: any) {
      this.logger.warn(`scheduled publish failed: ${e?.message || e}`);
      return { published: 0 };
    }
  }

  // ─── 실제 반응 통계 · 조회수 보정 ───────────────────────────────────
  async metrics(params: { page?: number; limit?: number; kind?: string; q?: string }) {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(100, Math.max(1, params.limit || 20));
    const profiles = await this.profilesByUser();
    const where: any = params.kind === 'all' ? { status: 'published' } : { userId: { in: Array.from(profiles.keys()) } };
    const q = (params.q || '').trim();
    if (q) where.OR = [{ title: { contains: q, mode: 'insensitive' } }, { content: { contains: q, mode: 'insensitive' } }];
    const [rows, total] = await Promise.all([
      this.prisma.communityPost.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: { id: true, title: true, status: true, isActive: true, userId: true, authorName: true, createdAt: true, group: { select: { name: true } } },
      }),
      this.prisma.communityPost.count({ where }),
    ]);
    const ids = rows.map((r) => r.id);
    const [stats, test, corrections] = await Promise.all([
      this.realStats(ids),
      this.testMetrics(ids),
      ids.length
        ? this.prisma.adminAuditLog.findMany({ where: { action: 'metric.view_correction', targetId: { in: ids } }, orderBy: { createdAt: 'desc' }, select: { targetId: true, createdAt: true, reason: true } })
        : Promise.resolve([] as { targetId: string | null; createdAt: Date; reason: string | null }[]),
    ]);
    const lastCorrection = new Map<string, { at: Date; reason: string | null }>();
    for (const c of corrections) if (c.targetId && !lastCorrection.has(c.targetId)) lastCorrection.set(c.targetId, { at: c.createdAt, reason: c.reason });
    return {
      data: rows.map((p) => {
        const prof = profiles.get(p.userId || '');
        return {
          id: p.id,
          title: p.title,
          status: p.status,
          isActive: p.isActive,
          createdAt: p.createdAt,
          groupName: p.group?.name || null,
          isOperator: !!prof,
          authorName: prof ? p.authorName || prof.nickname : null,
          stats: stats.get(p.id),
          test: test.get(p.id) || null,
          lastCorrection: lastCorrection.get(p.id) || null,
        };
      }),
      total,
      page,
      limit,
      testMetricsEnabled: isTestMetricsEnabled(),
    };
  }

  /** 실제 조회수 보정 — 줄이기만(중복·봇 집계 정정). 사유 필수, 전후 값 기록 */
  async correctViews(actor: AdminActor, postId: string, body: any) {
    const value = Number(body?.value);
    if (!Number.isInteger(value) || value < 0) throw new BadRequestException('바꿀 조회수를 0 이상 정수로 넣어 주세요');
    const reason = String(body?.reason ?? '').trim();
    if (reason.length < 5) throw new BadRequestException('보정 사유를 5자 이상 적어 주세요');
    const post = await this.prisma.communityPost.findUnique({ where: { id: postId }, select: { id: true } });
    if (!post) throw new NotFoundException('글을 찾을 수 없어요');
    return this.run(async (db) => {
      // 보정하는 동안 들어오는 조회수 증가와 겹치지 않게 그 줄을 잠근다
      const rows: { count: number }[] = await db.$queryRaw`SELECT "count" FROM "community_post_views" WHERE "postId" = ${postId} FOR UPDATE`;
      const current = rows[0]?.count ?? 0;
      if (value >= current) throw new BadRequestException(`조회수는 줄이는 보정만 할 수 있어요(지금 ${current.toLocaleString()}) — 늘릴 근거가 되는 조회 기록이 없어서예요`);
      await db.communityPostView.upsert({ where: { postId }, create: { postId, count: value }, update: { count: value } });
      await this.audit.log(actor, { action: 'metric.view_correction', targetType: 'community_post', targetId: postId, before: { views: current }, after: { views: value }, reason }, db);
      return { views: value, before: current };
    });
  }
}

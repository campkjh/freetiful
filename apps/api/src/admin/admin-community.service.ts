import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AVATAR_ANIMALS, EXTRA_ANIMALS, MODIFIERS, communityNickname, memberCommunityDisplay } from '../community/community-nickname';
import { memberNicknameProblem } from '../community/community-operator';
import { AdminActor, AdminAuditService } from './admin-audit.service';

/**
 * 어드민 '커뮤니티 관리'(261004 사장 '커뮤니티 관리도 추가해줘') — 웨딩숲 글·댓글·신고.
 *  · 숨기기 = isActive false(앱 피드·상세·댓글에서 빠짐, 되살릴 수 있음). 글 삭제는 완전 삭제(댓글·반응까지).
 *  · 신고 상태 = 접수(처리 대기) → 처리(대상 숨김) / 기각(그대로 둠).
 *  · 작성자 = 웨딩숲에 보이는 이름(꾸밈말 동물·에디터 이름) + 실제 계정 이름·역할(관리용).
 */
const KST_MS = 9 * 3600000;
const DAY_MS = 86400000;

type AuthorView = { id: string | null; nickname: string; realName: string | null; role: string | null; avatar: string | null; isOperator: boolean };

@Injectable()
export class AdminCommunityService {
  constructor(
    private prisma: PrismaService,
    private audit: AdminAuditService,
  ) {}

  private async run<T>(fn: (db: any) => Promise<T>): Promise<T> {
    const p: any = this.prisma;
    if (typeof p.$transaction === 'function') return p.$transaction((tx: any) => fn(tx), { timeout: 20000 });
    return fn(p);
  }

  /** 운영 프로필 계정 id 들(운영 글 구분용) */
  private async operatorUserIds() {
    const rows = await this.prisma.communityOperatorProfile.findMany({ select: { userId: true } });
    return rows.map((r) => r.userId);
  }

  /** 'YYYY-MM-DD'(KST) 범위 → createdAt 조건 */
  private dateRange(startDate?: string, endDate?: string) {
    const r: any = {};
    const ok = (s?: string) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
    if (ok(startDate)) r.gte = new Date(Date.parse(`${startDate}T00:00:00Z`) - KST_MS);
    if (ok(endDate)) r.lt = new Date(Date.parse(`${endDate}T00:00:00Z`) - KST_MS + DAY_MS);
    return Object.keys(r).length ? r : undefined;
  }

  private kstTodayStart() {
    const now = Date.now();
    return new Date(Math.floor((now + KST_MS) / DAY_MS) * DAY_MS - KST_MS);
  }

  /** 작성자 표시 — 글·댓글에 박제된 이름(에디터 옛 이름)이 있으면 그것, 없으면 지금 웨딩숲 이름 */
  private async authors(rows: { userId: string | null; authorName?: string | null; authorAvatar?: string | null }[]) {
    const ids = Array.from(new Set(rows.map((r) => r.userId).filter((v): v is string => !!v)));
    const [users, nicks, ops] = await Promise.all([
      this.prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, role: true, profileImageUrl: true } }),
      this.prisma.communityNickname.findMany({ where: { userId: { in: ids } }, select: { userId: true, nickname: true, avatarUrl: true } }),
      this.prisma.communityOperatorProfile.findMany({ where: { userId: { in: ids } }, select: { userId: true } }),
    ]);
    const userMap = new Map(users.map((u) => [u.id, u]));
    const nickMap = new Map(nicks.map((n) => [n.userId, n]));
    const opSet = new Set(ops.map((o) => o.userId));
    return (r: { userId: string | null; authorName?: string | null; authorAvatar?: string | null }): AuthorView => {
      const u = r.userId ? userMap.get(r.userId) : undefined;
      if (!u) return { id: r.userId, nickname: r.authorName || '(탈퇴한 사용자)', realName: null, role: null, avatar: r.authorAvatar || null, isOperator: false };
      const isOperator = opSet.has(u.id);
      const own = nickMap.get(u.id);
      // 앱과 같은 이름·사진 — 실제 사진(카톡 등)이 있는 회원은 실명(261006)
      const member = memberCommunityDisplay(u, own);
      return {
        id: u.id,
        nickname: r.authorName || (isOperator ? u.name : member.nickname),
        realName: isOperator ? null : u.name || null,
        role: isOperator ? 'operator' : u.role || null,
        avatar: r.authorAvatar || (isOperator ? u.profileImageUrl : member.avatar) || null,
        isOperator,
      };
    };
  }

  /** 처리 대기 신고 수 — 글별 / 댓글별 */
  private async pendingReportCounts(kind: 'post' | 'comment', ids: string[]) {
    if (!ids.length) return new Map<string, number>();
    if (kind === 'post') {
      const rows = await this.prisma.communityReport.groupBy({
        by: ['postId'],
        where: { targetType: 'post', status: '접수', postId: { in: ids } },
        _count: { _all: true },
      });
      return new Map(rows.map((r) => [r.postId as string, r._count._all]));
    }
    const rows = await this.prisma.communityReport.groupBy({
      by: ['commentId'],
      where: { targetType: 'comment', status: '접수', commentId: { in: ids } },
      _count: { _all: true },
    });
    return new Map(rows.map((r) => [r.commentId as string, r._count._all]));
  }

  private excerpt(text: string, n = 120) {
    const t = (text || '').replace(/\s+/g, ' ').trim();
    return t.length > n ? `${t.slice(0, n)}…` : t;
  }

  // ─── 요약 ───────────────────────────────────────────────────────────
  async summary() {
    const today = this.kstTodayStart();
    const [posts, postsToday, hiddenPosts, comments, commentsToday, reportsPending] = await Promise.all([
      this.prisma.communityPost.count({ where: { isActive: true } }),
      this.prisma.communityPost.count({ where: { isActive: true, createdAt: { gte: today } } }),
      // 관리자가 숨긴 글만(운영 글의 임시저장·예약·비공개는 '운영 콘텐츠'에서 따로 센다)
      this.prisma.communityPost.count({ where: { isActive: false, status: 'published' } }),
      this.prisma.communityComment.count({ where: { isActive: true } }),
      this.prisma.communityComment.count({ where: { isActive: true, createdAt: { gte: today } } }),
      this.prisma.communityReport.count({ where: { status: '접수' } }),
    ]);
    return { posts, postsToday, hiddenPosts, comments, commentsToday, reportsPending };
  }

  /** 거르기용 카테고리 — 대분류 아래 소분류 */
  async groups() {
    const rows = await this.prisma.communityGroup.findMany({
      where: { isActive: true },
      select: { id: true, name: true, parentId: true, sortOrder: true },
      orderBy: { sortOrder: 'asc' },
    });
    const majors = rows.filter((g) => !g.parentId);
    return {
      data: majors.map((m) => ({
        id: m.id,
        name: m.name,
        children: rows.filter((g) => g.parentId === m.id).map((c) => ({ id: c.id, name: c.name })),
      })),
    };
  }

  // ─── 글 ─────────────────────────────────────────────────────────────
  async listPosts(params: { page?: number; limit?: number; q?: string; groupId?: string; status?: string; startDate?: string; endDate?: string; kind?: string }) {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(100, Math.max(1, params.limit || 20));
    // 앱에 한 번이라도 올라간 글만(운영 글 임시저장·예약·비공개는 '운영 콘텐츠' 화면에서)
    const where: any = { status: 'published' };
    // 작성 주체: operator = 운영 프로필 글, member = 회원 글
    if (params.kind === 'operator' || params.kind === 'member') {
      const opIds = await this.operatorUserIds();
      where.userId = params.kind === 'operator' ? { in: opIds } : { notIn: opIds };
    }
    const q = (params.q || '').trim();
    if (q) where.OR = [{ title: { contains: q, mode: 'insensitive' } }, { content: { contains: q, mode: 'insensitive' } }];
    if (params.groupId) {
      const children = await this.prisma.communityGroup.findMany({ where: { parentId: params.groupId }, select: { id: true } });
      where.groupId = { in: [params.groupId, ...children.map((c) => c.id)] };
    }
    if (params.status === 'visible') where.isActive = true;
    else if (params.status === 'hidden') where.isActive = false;
    else if (params.status === 'reported') {
      const reported = await this.prisma.communityReport.findMany({
        where: { targetType: 'post', status: '접수', postId: { not: null } },
        select: { postId: true },
        distinct: ['postId'],
      });
      where.id = { in: reported.map((r) => r.postId as string) };
    }
    const range = this.dateRange(params.startDate, params.endDate);
    if (range) where.createdAt = range;

    const [rows, total] = await Promise.all([
      this.prisma.communityPost.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          group: { select: { id: true, name: true, parent: { select: { name: true } } } },
          images: { select: { imageUrl: true }, orderBy: { sortOrder: 'asc' }, take: 3 },
          view: { select: { count: true } },
          _count: { select: { images: true, likes: true, comments: { where: { isActive: true } } } },
        },
      }),
      this.prisma.communityPost.count({ where }),
    ]);
    const [author, reports] = await Promise.all([this.authors(rows), this.pendingReportCounts('post', rows.map((r) => r.id))]);
    return {
      data: rows.map((p) => ({
        id: p.id,
        title: p.title,
        excerpt: this.excerpt(p.content),
        type: p.type,
        isActive: p.isActive,
        createdAt: p.createdAt,
        group: { id: p.group?.id || null, name: p.group?.name || null, parentName: p.group?.parent?.name || null },
        author: author(p),
        images: p.images.map((i) => i.imageUrl),
        imageCount: p._count.images,
        likeCount: p._count.likes,
        commentCount: p._count.comments,
        viewCount: p.view?.count || 0,
        reportCount: reports.get(p.id) || 0,
      })),
      total,
      page,
      limit,
    };
  }

  async getPost(id: string) {
    const p = await this.prisma.communityPost.findUnique({
      where: { id },
      include: {
        group: { select: { id: true, name: true, parent: { select: { name: true } } } },
        images: { select: { imageUrl: true }, orderBy: { sortOrder: 'asc' } },
        view: { select: { count: true } },
        pollOptions: { select: { id: true, text: true, _count: { select: { votes: true } } }, orderBy: { sortOrder: 'asc' } },
        comments: {
          orderBy: { createdAt: 'asc' },
          select: { id: true, parentId: true, userId: true, authorName: true, authorAvatar: true, content: true, isActive: true, createdAt: true, _count: { select: { likes: true } } },
        },
        _count: { select: { likes: true } },
      },
    });
    if (!p) throw new NotFoundException('글을 찾을 수 없어요.');
    const reports = await this.prisma.communityReport.findMany({
      where: { OR: [{ postId: id }, { commentId: { in: p.comments.map((c) => c.id) } }] },
      orderBy: { createdAt: 'desc' },
    });
    const author = await this.authors([p, ...p.comments, ...reports.map((r) => ({ userId: r.userId }))]);
    const pendingByComment = new Map<string, number>();
    for (const r of reports) if (r.targetType === 'comment' && r.commentId && r.status === '접수') pendingByComment.set(r.commentId, (pendingByComment.get(r.commentId) || 0) + 1);
    return {
      id: p.id,
      title: p.title,
      content: p.content,
      type: p.type,
      isActive: p.isActive,
      isBlinded: p.isBlinded,
      createdAt: p.createdAt,
      group: { id: p.group?.id || null, name: p.group?.name || null, parentName: p.group?.parent?.name || null },
      author: author(p),
      images: p.images.map((i) => i.imageUrl),
      likeCount: p._count.likes,
      viewCount: p.view?.count || 0,
      poll: p.pollOptions.map((o) => ({ id: o.id, text: o.text, votes: o._count.votes })),
      comments: p.comments.map((c) => ({
        id: c.id,
        parentId: c.parentId,
        content: c.content,
        isActive: c.isActive,
        createdAt: c.createdAt,
        author: author(c),
        likeCount: c._count.likes,
        reportCount: pendingByComment.get(c.id) || 0,
      })),
      reports: reports.map((r) => ({
        id: r.id,
        targetType: r.targetType,
        commentId: r.commentId,
        reason: r.reason,
        detail: r.detail,
        status: r.status,
        createdAt: r.createdAt,
        reporter: author({ userId: r.userId }).nickname,
      })),
    };
  }

  async setPostActive(actor: AdminActor, id: string, isActive: boolean) {
    const p = await this.prisma.communityPost.findUnique({ where: { id }, select: { id: true, title: true, isActive: true, status: true } });
    if (!p) throw new NotFoundException('글을 찾을 수 없어요.');
    if (p.status === 'draft' || p.status === 'scheduled') throw new BadRequestException('임시저장·예약 글은 \'운영 콘텐츠\'에서 게시해 주세요.');
    if (p.isActive === isActive && (p.status === 'published' || !isActive)) return { success: true, isActive };
    // 운영 글의 비공개(private)를 다시 켜면 게시로 — 앱 노출(isActive)과 상태(status)를 같이 맞춘다
    const data: any = { isActive, ...(p.status === 'private' && isActive ? { status: 'published' } : {}) };
    await this.run(async (db) => {
      await db.communityPost.update({ where: { id }, data });
      // 숨기면 그 글에 걸린 처리 대기 신고는 '처리'로
      if (!isActive) await db.communityReport.updateMany({ where: { targetType: 'post', postId: id, status: '접수' }, data: { status: '처리' } });
      await this.audit.log(actor, { action: 'community.post_visibility', targetType: 'community_post', targetId: id, before: { isActive: p.isActive, status: p.status, title: p.title }, after: { isActive, status: data.status || p.status } }, db);
    });
    return { success: true, isActive };
  }

  async deletePost(actor: AdminActor, id: string) {
    const p = await this.prisma.communityPost.findUnique({ where: { id }, select: { id: true, title: true, content: true, userId: true, status: true, isActive: true, createdAt: true } });
    if (!p) throw new NotFoundException('글을 찾을 수 없어요.');
    await this.run(async (db) => {
      await db.communityPost.delete({ where: { id } });
      await db.communityReport.updateMany({ where: { postId: id, status: '접수' }, data: { status: '처리' } });
      await this.audit.log(actor, { action: 'community.post_delete', targetType: 'community_post', targetId: id, before: { title: p.title, content: p.content, userId: p.userId, status: p.status, isActive: p.isActive, createdAt: p.createdAt } }, db);
    });
    return { success: true };
  }

  // ─── 댓글 ───────────────────────────────────────────────────────────
  async listComments(params: { page?: number; limit?: number; q?: string; status?: string; startDate?: string; endDate?: string }) {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(100, Math.max(1, params.limit || 20));
    const where: any = {};
    const q = (params.q || '').trim();
    if (q) where.content = { contains: q, mode: 'insensitive' };
    if (params.status === 'visible') where.isActive = true;
    else if (params.status === 'hidden') where.isActive = false;
    else if (params.status === 'reported') {
      const reported = await this.prisma.communityReport.findMany({
        where: { targetType: 'comment', status: '접수', commentId: { not: null } },
        select: { commentId: true },
        distinct: ['commentId'],
      });
      where.id = { in: reported.map((r) => r.commentId as string) };
    }
    const range = this.dateRange(params.startDate, params.endDate);
    if (range) where.createdAt = range;

    const [rows, total] = await Promise.all([
      this.prisma.communityComment.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          post: { select: { id: true, title: true, isActive: true } },
          _count: { select: { likes: true } },
        },
      }),
      this.prisma.communityComment.count({ where }),
    ]);
    const [author, reports] = await Promise.all([this.authors(rows), this.pendingReportCounts('comment', rows.map((r) => r.id))]);
    return {
      data: rows.map((c) => ({
        id: c.id,
        content: c.content,
        isReply: !!c.parentId,
        isActive: c.isActive,
        createdAt: c.createdAt,
        post: { id: c.post.id, title: c.post.title, isActive: c.post.isActive },
        author: author(c),
        likeCount: c._count.likes,
        reportCount: reports.get(c.id) || 0,
      })),
      total,
      page,
      limit,
    };
  }

  async setCommentActive(actor: AdminActor, id: string, isActive: boolean) {
    const c = await this.prisma.communityComment.findUnique({ where: { id }, select: { id: true, isActive: true, content: true, postId: true } });
    if (!c) throw new NotFoundException('댓글을 찾을 수 없어요.');
    if (c.isActive === isActive) return { success: true, isActive };
    await this.run(async (db) => {
      await db.communityComment.update({ where: { id }, data: { isActive } });
      if (!isActive) await db.communityReport.updateMany({ where: { targetType: 'comment', commentId: id, status: '접수' }, data: { status: '처리' } });
      await this.audit.log(actor, { action: 'community.comment_visibility', targetType: 'community_comment', targetId: id, before: { isActive: c.isActive, content: c.content, postId: c.postId }, after: { isActive } }, db);
    });
    return { success: true, isActive };
  }

  // ─── 신고 ───────────────────────────────────────────────────────────
  async listReports(params: { page?: number; limit?: number; status?: string }) {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(100, Math.max(1, params.limit || 20));
    const where: any = {};
    if (params.status && params.status !== 'all') where.status = params.status;

    const [rows, total] = await Promise.all([
      this.prisma.communityReport.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
      this.prisma.communityReport.count({ where }),
    ]);
    const postIds = Array.from(new Set(rows.map((r) => r.postId).filter((v): v is string => !!v)));
    const commentIds = Array.from(new Set(rows.map((r) => r.commentId).filter((v): v is string => !!v)));
    const [posts, comments] = await Promise.all([
      this.prisma.communityPost.findMany({ where: { id: { in: postIds } }, select: { id: true, title: true, isActive: true, userId: true, authorName: true, authorAvatar: true } }),
      this.prisma.communityComment.findMany({ where: { id: { in: commentIds } }, select: { id: true, postId: true, content: true, isActive: true, userId: true, authorName: true, authorAvatar: true } }),
    ]);
    const postMap = new Map(posts.map((p) => [p.id, p]));
    const commentMap = new Map(comments.map((c) => [c.id, c]));
    const author = await this.authors([...rows.map((r) => ({ userId: r.userId })), ...posts, ...comments]);
    // 같은 대상에 쌓인 처리 대기 신고 수
    const [pPending, cPending] = await Promise.all([this.pendingReportCounts('post', postIds), this.pendingReportCounts('comment', commentIds)]);
    return {
      data: rows.map((r) => {
        const post = r.postId ? postMap.get(r.postId) : undefined;
        const comment = r.commentId ? commentMap.get(r.commentId) : undefined;
        const target = r.targetType === 'comment' ? comment : post;
        return {
          id: r.id,
          targetType: r.targetType,
          reason: r.reason,
          detail: r.detail,
          status: r.status,
          createdAt: r.createdAt,
          reporter: author({ userId: r.userId }).nickname,
          postId: r.postId || comment?.postId || null,
          post: post ? { id: post.id, title: post.title, isActive: post.isActive } : null,
          comment: comment ? { id: comment.id, content: this.excerpt(comment.content, 140), isActive: comment.isActive } : null,
          /** 대상이 지워졌으면 null */
          targetAuthor: target ? author(target) : null,
          targetActive: target ? target.isActive : null,
          sameTargetPending: r.targetType === 'comment' ? cPending.get(r.commentId || '') || 0 : pPending.get(r.postId || '') || 0,
        };
      }),
      total,
      page,
      limit,
    };
  }

  /** hide = 대상 숨기고 그 대상의 처리 대기 신고 전부 '처리' · dismiss = 그 대상 신고 전부 '기각'(그대로 둠) */
  async resolveReport(actor: AdminActor, id: string, action: string) {
    const r = await this.prisma.communityReport.findUnique({ where: { id } });
    if (!r) throw new NotFoundException('신고를 찾을 수 없어요.');
    if (action !== 'hide' && action !== 'dismiss') throw new BadRequestException('처리 방법을 골라 주세요.');
    const targetId = r.targetType === 'comment' ? r.commentId : r.postId;
    // 대상 id 가 비어 있으면(옛 데이터) 이 신고 한 건만 — null 로 묶으면 엉뚱한 신고까지 닫힌다
    const sameTarget: any = !targetId ? { id: r.id } : r.targetType === 'comment' ? { targetType: 'comment', commentId: targetId } : { targetType: 'post', postId: targetId };
    const status = action === 'hide' ? '처리' : '기각';
    await this.run(async (db) => {
      if (action === 'hide') {
        if (r.targetType === 'comment' && r.commentId) await db.communityComment.updateMany({ where: { id: r.commentId }, data: { isActive: false } });
        if (r.targetType !== 'comment' && r.postId) await db.communityPost.updateMany({ where: { id: r.postId }, data: { isActive: false } });
      }
      const closed = await db.communityReport.updateMany({ where: { ...sameTarget, status: '접수' }, data: { status } });
      await db.communityReport.update({ where: { id }, data: { status } });
      await this.audit.log(
        actor,
        {
          action: 'community.report_resolve',
          targetType: r.targetType === 'comment' ? 'community_comment' : 'community_post',
          targetId: targetId || null,
          before: { reportId: r.id, reason: r.reason, status: r.status },
          after: { status, hidTarget: action === 'hide', closedReports: closed.count },
        },
        db,
      );
    });
    return { success: true, status };
  }

  // ─── 웨딩숲 닉네임 관리(261004 사장 '부적절한 닉네임일 수 있으니 어드민에서 바꿀 수 있게') ───
  //  · 일반 회원 = 계정 id 로 정해지는 '꾸밈말 동물'(저장 안 됨), 허용 계정 = 직접 정한 닉네임, 사회자·업체 = 실명.
  //  · 관리자가 바꾸면 community_nicknames 에 넣는다 → 앱의 글·댓글·좋아요 목록·본인 글쓰기 칸까지 새 이름(예전 글 포함).
  //  · 운영 프로필은 여기서 안 바꾼다(운영 콘텐츠 › 운영 프로필).

  /** 웨딩숲에 글·댓글을 쓴 계정 + 닉네임을 따로 가진 계정 — 지금 보이는 이름과 출처 */
  async listMembers(params: { page?: number; limit?: number; q?: string; source?: string }) {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(100, Math.max(1, params.limit || 30));
    const [postUsers, commentUsers, nickRows, opRows] = await Promise.all([
      this.prisma.communityPost.groupBy({ by: ['userId'], where: { userId: { not: null } }, _count: { _all: true }, _max: { createdAt: true } }),
      this.prisma.communityComment.groupBy({ by: ['userId'], where: { userId: { not: null } }, _count: { _all: true }, _max: { createdAt: true } }),
      this.prisma.communityNickname.findMany({ select: { userId: true, nickname: true, avatarUrl: true, updatedAt: true } }),
      this.prisma.communityOperatorProfile.findMany({ select: { userId: true } }),
    ]);
    const opSet = new Set(opRows.map((r) => r.userId));
    const postMap = new Map(postUsers.map((r) => [r.userId as string, r]));
    const commentMap = new Map(commentUsers.map((r) => [r.userId as string, r]));
    const nickMap = new Map(nickRows.map((r) => [r.userId, r]));
    const ids = Array.from(new Set([...postMap.keys(), ...commentMap.keys(), ...nickMap.keys()])).filter((id) => id && !opSet.has(id));
    const [users, changes] = await Promise.all([
      this.prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, role: true, profileImageUrl: true } }),
      this.prisma.adminAuditLog.findMany({
        where: { action: 'community.nickname_change', targetId: { in: ids } },
        orderBy: { createdAt: 'desc' },
        select: { targetId: true, createdAt: true, afterState: true },
      }),
    ]);
    const lastChange = new Map<string, { at: Date; nickname: string | null }>();
    for (const c of changes) {
      if (!c.targetId || lastChange.has(c.targetId)) continue;
      const after = (c.afterState || {}) as Record<string, any>;
      lastChange.set(c.targetId, { at: c.createdAt, nickname: typeof after.nickname === 'string' ? after.nickname : null });
    }
    const rows = users.map((u) => {
      const own = nickMap.get(u.id);
      const auto = communityNickname(u);
      const lc = lastChange.get(u.id);
      const shown = memberCommunityDisplay(u, own);
      // 실제 사진(카톡 등) 회원은 실명으로 보여 '실명'(261006)
      const source = shown.real ? 'name' : own ? (lc && lc.nickname === own.nickname ? 'admin' : 'custom') : u.role === 'general' ? 'auto' : 'name';
      const p = postMap.get(u.id);
      const c = commentMap.get(u.id);
      const last = [p?._max.createdAt, c?._max.createdAt].filter(Boolean).sort((a: any, b: any) => +b - +a)[0] || null;
      return {
        userId: u.id,
        nickname: shown.nickname,
        autoNickname: auto,
        source,
        realName: u.name || null,
        role: u.role,
        avatar: shown.avatar,
        posts: p?._count._all || 0,
        comments: c?._count._all || 0,
        lastActiveAt: last,
        changedAt: source === 'admin' ? lc?.at || null : null,
      };
    });
    const counts = { auto: 0, custom: 0, admin: 0, name: 0 } as Record<string, number>;
    for (const r of rows) counts[r.source] += 1;
    const q = (params.q || '').trim().toLowerCase();
    let filtered = rows;
    if (params.source && counts[params.source] !== undefined) filtered = filtered.filter((r) => r.source === params.source);
    if (q) filtered = filtered.filter((r) => r.nickname.toLowerCase().includes(q) || (r.realName || '').toLowerCase().includes(q) || r.autoNickname.toLowerCase().includes(q));
    filtered.sort((a, b) => +(b.lastActiveAt || 0) - +(a.lastActiveAt || 0));
    return { data: filtered.slice((page - 1) * limit, page * limit), total: filtered.length, page, limit, counts };
  }

  /** 바꿀 닉네임 추천 — 회원 닉네임과 같은 '꾸밈말 동물' 모양 */
  suggestNicknames(count = 6) {
    const animals = [...AVATAR_ANIMALS, ...EXTRA_ANIMALS];
    const out = new Set<string>();
    while (out.size < count) out.add(`${MODIFIERS[Math.floor(Math.random() * MODIFIERS.length)]} ${animals[Math.floor(Math.random() * animals.length)]}`);
    return { items: Array.from(out) };
  }

  private async nicknameTarget(userId: string) {
    const u = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, role: true, profileImageUrl: true } });
    if (!u) throw new NotFoundException('회원을 찾을 수 없어요.');
    const op = await this.prisma.communityOperatorProfile.findUnique({ where: { userId }, select: { id: true } });
    if (op) throw new BadRequestException('운영 프로필 이름은 운영 콘텐츠 › 운영 프로필에서 바꿔 주세요.');
    const own = await this.prisma.communityNickname.findUnique({ where: { userId } });
    const shown = memberCommunityDisplay(u, own);
    return { u, own, current: shown.nickname, real: shown.real };
  }

  /** 한 사람 — 지금 이름 · 원래(자동) 이름 · 출처(바꾸기 창용) */
  async getNickname(userId: string) {
    const { u, own, current, real } = await this.nicknameTarget(userId);
    const last = own
      ? await this.prisma.adminAuditLog.findFirst({ where: { action: 'community.nickname_change', targetId: userId }, orderBy: { createdAt: 'desc' }, select: { afterState: true } })
      : null;
    const lastNick = (last?.afterState as any)?.nickname;
    return {
      userId,
      nickname: current,
      autoNickname: communityNickname(u),
      source: real ? 'name' : own ? (lastNick === own.nickname ? 'admin' : 'custom') : u.role === 'general' ? 'auto' : 'name',
      realName: u.name || null,
      role: u.role,
      avatar: real ? u.profileImageUrl || null : own?.avatarUrl || u.profileImageUrl || null,
    };
  }

  /** 관리자가 닉네임 바꾸기 — 규칙은 회원이 직접 정할 때와 같고, 운영팀 이름과 같은 이름은 안 된다 */
  async setNickname(actor: AdminActor, userId: string, body: any) {
    const nickname = String(body?.nickname ?? '').replace(/\s+/g, ' ').trim();
    const problem = memberNicknameProblem(nickname);
    if (problem) throw new BadRequestException(problem);
    const { own, current } = await this.nicknameTarget(userId);
    if (nickname === current) return { success: true, changed: false, nickname };
    const opSame = await this.prisma.communityOperatorProfile.findFirst({ where: { nickname: { equals: nickname, mode: 'insensitive' } }, select: { id: true } });
    if (opSame) throw new BadRequestException('운영팀 이름과 같은 닉네임은 쓸 수 없어요.');
    await this.run(async (db) => {
      await db.communityNickname.upsert({ where: { userId }, create: { userId, nickname }, update: { nickname } });
      await this.audit.log(
        actor,
        { action: 'community.nickname_change', targetType: 'user', targetId: userId, before: { nickname: current, custom: !!own }, after: { nickname }, reason: body?.reason },
        db,
      );
    });
    return { success: true, changed: true, nickname };
  }

  /** 원래대로 — 직접/관리자 닉네임을 지우고 자동 닉네임(회원)·실명(사회자·업체)으로. 웨딩숲 사진은 그대로 둔다 */
  async resetNickname(actor: AdminActor, userId: string, reason?: string) {
    const { u, own } = await this.nicknameTarget(userId);
    if (!own) return { success: true, changed: false };
    const auto = communityNickname(u);
    await this.run(async (db) => {
      if (own.avatarUrl) await db.communityNickname.update({ where: { userId }, data: { nickname: auto } });
      else await db.communityNickname.delete({ where: { userId } });
      await this.audit.log(actor, { action: 'community.nickname_reset', targetType: 'user', targetId: userId, before: { nickname: own.nickname }, after: { nickname: auto }, reason }, db);
    });
    return { success: true, changed: true, nickname: auto };
  }
}

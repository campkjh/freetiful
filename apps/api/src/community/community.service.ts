import {
  Injectable,
  Logger,
  OnModuleInit,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CommunityAiService } from './community-ai.service';
import { ImageService } from '../image/image.service';
import {
  REACTION_TYPES,
  REPORT_REASONS,
  QUIZ_MAX_QUESTIONS_PER_POST,
  QUIZ_MAX_POSTS_PER_DAY,
  tierForScore,
  TAXONOMY,
  tagSlug,
  LEGACY_GROUP_SLUGS,
  ReactionType,
  BADGE_THRESHOLDS,
  BADGES,
  ROLE_LABELS,
  BadgeKey,
  BadgeTone,
} from './community.constants';
import { AVATAR_ANIMALS, EXTRA_ANIMALS, MODIFIERS, animalAvatarUrl, communityNickname } from './community-nickname';
import { MEMBER_NICKNAME_BLOCK, OPERATOR_NAME_BLOCK, OPERATOR_ROLE_LABEL, looksLikeMemberNickname, memberNicknameProblem } from './community-operator';
import { isTestMetricsEnabled } from '../common/app-env';

/**
 * 웨딩숲 닉네임을 직접 정할 수 있는 계정(260928 사장 지정). 이메일은 개인정보라 웹 번들에 싣지 않고 서버에서만 본다.
 * 닉네임은 계정당 하나 — 댓글마다 다른 이름을 쓰면 한 사람이 여러 회원처럼 보여서(사칭·가짜 반응) 그렇게 만들지 않았다.
 */
// 261006 사장: 차보경(cbkyeong@naver.com)·황지애(hjalover@hanmail.net) 운영진 → 일반 회원(이미 정한 닉네임은 회원 모양이라 그대로, 바꾸기·에디터 이름 올리기만 막힘)
const CUSTOM_NICKNAME_EMAILS = new Set(['seeipssister@naver.com', 'campkjh@nate.com']);
/** 운영진·사회자처럼 보이는 이름은 막는다 */
/** 운영진 에디터 계정 — 허용 계정(CUSTOM_NICKNAME_EMAILS)은 글·댓글을 이 이름으로 올릴 수 있다(260930 사장).
 *  이름에 '프리티풀'이 붙어 운영진 글로 보인다(회원인 척이 아님). 실제로 쓴 계정은 postedById 에 남긴다. */
const EDITOR_PERSONA_IDS = [
  '939313a1-1b41-4f2a-b3c0-f9c189616daa', // 프리티풀 에디터 하나
  'fe30b69f-5396-4fa6-b466-6e0cdca3431a', // 프리티풀 에디터 도윤
  '03d9933c-454f-4913-9493-d75dff85e8e7', // 프리티풀 웨딩가이드 서아
  'b30daa89-aad7-488a-acdf-3e2ddc47e7fa', // 프리티풀 에디터 준
];
const NICKNAME_BLOCK = MEMBER_NICKNAME_BLOCK;
/** 운영진 에디터 이름에 못 쓰는 말 · 회원 닉네임 모양 검사 — 운영 프로필과 같은 규칙(community-operator.ts, 261001→261004) */
const EDITOR_NAME_BLOCK = OPERATOR_NAME_BLOCK;

type Author = {
  nickname: string;
  avatar: string | null;
  isAdmin: boolean;
  tier: string;
  isAnswerKing: boolean;
  isPickKing: boolean;
  roleLabel: string | null; // 아바타 아래 라벨(사회자/업체/운영자)
  followerCount: number;
  isFollowing: boolean; // 뷰어가 이 작성자를 팔로우 중
  badges: { key: BadgeKey; label: string; tone: BadgeTone }[]; // 우선순위순, [0]이 대표
  /** 운영 프로필(운영팀) 계정 — 글·댓글에 늘 '운영팀' 표시(261004) */
  isOperator: boolean;
  /** 운영 프로필 소개(운영팀만) */
  bio: string | null;
};

@Injectable()
export class CommunityService implements OnModuleInit {
  private readonly logger = new Logger(CommunityService.name);

  constructor(
    private prisma: PrismaService,
    private ai: CommunityAiService,
    private images: ImageService,
  ) {}

  // ── 글쓰기 보조 ──
  // 본문 → 소분류 1개 + 대분류 태그 0~3개 추천(기존 목록 안에서만). groupId 가 소분류면 고정하고 태그만 고른다.
  async suggestMeta(content: string, groupId?: string | null) {
    const { groups } = await this.listGroups();
    const majors = groups.map((m) => ({
      id: m.id,
      name: m.name,
      tags: m.tags.map((t) => ({ id: t.id, name: t.name })),
      subs: m.children.map((c) => ({ id: c.id, name: c.name, slug: c.slug })),
    }));
    const locked = groupId ? majors.flatMap((m) => m.subs).find((s) => s.id === groupId) ?? null : null;
    const r = await this.ai.suggest(String(content || ''), majors, locked?.slug ?? null);
    const major = majors.find((m) => m.subs.some((s) => s.slug === r.subSlug)) ?? null;
    const sub = major?.subs.find((s) => s.slug === r.subSlug) ?? null;
    const tagByName = new Map((major?.tags ?? []).map((t) => [t.name, t]));
    return {
      groupId: sub?.id ?? null,
      groupName: sub?.name ?? null,
      majorName: major?.name ?? null,
      tags: r.tagNames.map((n) => tagByName.get(n)).filter(Boolean),
      source: r.source,
    };
  }

  // 커뮤니티 본문 이미지 업로드 — 공용 이미지 파이프라인(webp 변환·스토리지)을 그대로 쓴다.
  async uploadImage(file: any) {
    if (!file) throw new BadRequestException('이미지 파일이 필요합니다.');
    const processed = await this.images.processImage(file, {
      maxWidth: 1600,
      maxHeight: 1600,
      quality: 82,
      requireFace: false,
    });
    return { url: processed.webpPath || processed.path, width: processed.width, height: processed.height };
  }

  async onModuleInit() {
    try {
      await this.seedDefaultTaxonomy();
    } catch (e) {
      this.logger.warn(`community taxonomy seed skipped: ${(e as Error).message}`);
    }
  }

  // ─── 기본 카테고리 시드/정합 ─────────────────────────────────────
  // slug 기준 upsert(이름/순서 갱신·누락 생성) + 구 카테고리 정리.
  private async seedDefaultTaxonomy() {
    // 대분류(parentId=null, icon) → 소분류(parentId=대분류) 트리 + 대분류별 태그.
    for (let mi = 0; mi < TAXONOMY.length; mi++) {
      const m = TAXONOMY[mi];
      const major = await this.prisma.communityGroup.upsert({
        where: { slug: m.slug },
        create: { name: m.name, slug: m.slug, icon: m.icon, parentId: null, sortOrder: mi, isActive: true },
        update: { name: m.name, icon: m.icon, parentId: null, sortOrder: mi, isActive: true },
      });
      for (let si = 0; si < m.subs.length; si++) {
        const s = m.subs[si];
        await this.prisma.communityGroup.upsert({
          where: { slug: s.slug },
          create: { name: s.name, slug: s.slug, parentId: major.id, sortOrder: si, isActive: true },
          update: { name: s.name, parentId: major.id, icon: null, sortOrder: si, isActive: true },
        });
      }
      for (let ti = 0; ti < m.tags.length; ti++) {
        const name = m.tags[ti];
        const slug = tagSlug(name);
        await this.prisma.communityTag
          .upsert({
            where: { groupId_slug: { groupId: major.id, slug } },
            create: { groupId: major.id, name, slug, sortOrder: ti },
            update: { name, sortOrder: ti, isActive: true },
          })
          .catch(() => null);
      }
    }
    // 태그는 대분류에만 둔다 — 소분류에 남은 옛 태그 정리(멱등).
    await this.prisma.communityTag.deleteMany({ where: { group: { parentId: { not: null } } } });
    // 구 카테고리(초기 6종 중 폐기) + 그 하위 글 정리. post.group 은 Restrict 라 글 먼저 삭제.
    const legacy = await this.prisma.communityGroup.findMany({
      where: { slug: { in: LEGACY_GROUP_SLUGS } },
      select: { id: true },
    });
    const legacyIds = legacy.map((x) => x.id);
    if (legacyIds.length) {
      await this.prisma.communityPost.deleteMany({ where: { groupId: { in: legacyIds } } });
      await this.prisma.communityGroup.deleteMany({ where: { id: { in: legacyIds } } });
    }
    this.logger.log(`community: taxonomy reconciled (${TAXONOMY.length} majors)`);
  }

  // ─── 그룹/태그 ────────────────────────────────────────────────────
  // 대분류 트리: [{ ...대분류, icon, tags, children:[소분류] }]. postCount 는 하위 합산.
  async listGroups() {
    const all = await this.prisma.communityGroup.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      include: {
        tags: { where: { isActive: true }, orderBy: { sortOrder: 'asc' } },
      },
    });
    const counts = await this.prisma.communityPost.groupBy({
      by: ['groupId'],
      where: { isActive: true },
      _count: { _all: true },
    });
    const cmap = new Map(counts.map((c) => [c.groupId, c._count._all]));
    const subsByParent = new Map<string, typeof all>();
    for (const g of all) {
      if (!g.parentId) continue;
      const arr = subsByParent.get(g.parentId) || [];
      arr.push(g);
      subsByParent.set(g.parentId, arr);
    }
    const majors = all.filter((g) => !g.parentId);
    return {
      groups: majors.map((m) => {
        const children = (subsByParent.get(m.id) || []).map((s) => ({
          id: s.id,
          name: s.name,
          slug: s.slug,
          parentId: m.id,
          postCount: cmap.get(s.id) || 0,
        }));
        return {
          id: m.id,
          name: m.name,
          slug: m.slug,
          icon: m.icon,
          description: m.description,
          postCount: children.reduce((a, c) => a + c.postCount, 0) + (cmap.get(m.id) || 0),
          tags: m.tags.map((t) => ({ id: t.id, name: t.name, slug: t.slug })),
          children,
        };
      }),
    };
  }

  // 대분류 id 면 하위 소분류 전체, 소분류 id 면 그 하나.
  private async resolveGroupFilter(groupId: string): Promise<string[]> {
    const children = await this.prisma.communityGroup.findMany({
      where: { parentId: groupId, isActive: true },
      select: { id: true },
    });
    return children.length ? [groupId, ...children.map((c) => c.id)] : [groupId];
  }

  // 태그는 대분류에 달려 있다 — 소분류 id 가 오면 부모 대분류의 태그를 준다.
  async listTags(groupId?: string) {
    let gid = groupId;
    if (gid) {
      const g = await this.prisma.communityGroup.findUnique({
        where: { id: gid },
        select: { parentId: true },
      });
      if (g?.parentId) gid = g.parentId;
    }
    const tags = await this.prisma.communityTag.findMany({
      where: { isActive: true, ...(gid ? { groupId: gid } : {}) },
      orderBy: [{ groupId: 'asc' }, { sortOrder: 'asc' }],
    });
    return {
      tags: tags.map((t) => ({
        id: t.id,
        groupId: t.groupId,
        name: t.name,
        slug: t.slug,
      })),
    };
  }

  // ─── 차단 목록(내가 차단한 사람) ─────────────────────────────────
  private async getBlockedIds(viewerId?: string): Promise<Set<string>> {
    if (!viewerId) return new Set();
    const rows = await this.prisma.communityBlock.findMany({
      where: { blockerId: viewerId },
      select: { blockedId: true },
    });
    return new Set(rows.map((r) => r.blockedId));
  }

  // ─── 작성자 정보 + 티어 + 킹 배지 (배치) ─────────────────────────
  private async mapAuthors(userIds: string[], viewerId?: string): Promise<Map<string, Author>> {
    const ids = Array.from(new Set(userIds.filter(Boolean)));
    const map = new Map<string, Author>();
    if (ids.length === 0) return map;

    const users = await this.prisma.user.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true, profileImageUrl: true, role: true },
    });
    const customNick = await this.customNicknames(ids);
    const operators = await this.operatorProfiles(ids);

    // 활동 점수(글×10 + 댓글×3 + 받은좋아요×2 + 보너스)
    const [postCounts, commentCounts, bonuses] = await Promise.all([
      this.prisma.communityPost.groupBy({
        by: ['userId'],
        where: { userId: { in: ids }, isActive: true },
        _count: { _all: true },
      }),
      this.prisma.communityComment.groupBy({
        by: ['userId'],
        where: { userId: { in: ids }, isActive: true },
        _count: { _all: true },
      }),
      this.prisma.communityScoreBonus.findMany({ where: { userId: { in: ids } } }),
    ]);
    // 받은 좋아요: 내 글들에 달린 like 수
    const likesReceived = await this.prisma.$queryRawUnsafe<{ user_id: string; c: bigint }[]>(
      `SELECT p."userId" as user_id, COUNT(l.*) as c
       FROM "community_posts" p JOIN "community_post_likes" l ON l."postId" = p.id
       WHERE p."userId" = ANY($1) GROUP BY p."userId"`,
      ids,
    ).catch(() => [] as { user_id: string; c: bigint }[]);

    const pc = new Map(postCounts.map((r) => [r.userId as string, r._count._all]));
    const cc = new Map(commentCounts.map((r) => [r.userId as string, r._count._all]));
    const bn = new Map(bonuses.map((r) => [r.userId, r.bonus]));
    const lr = new Map(likesReceived.map((r) => [r.user_id, Number(r.c)]));

    // 킹 배지(최근 7일): 답변왕 = 댓글≥10, 채택왕 = 핀≥5
    const since = new Date(Date.now() - 7 * 24 * 3600 * 1000);
    const [recentComments, recentPins] = await Promise.all([
      this.prisma.communityComment.groupBy({
        by: ['userId'],
        where: { userId: { in: ids }, isActive: true, createdAt: { gte: since } },
        _count: { _all: true },
      }),
      this.prisma.$queryRawUnsafe<{ user_id: string; c: bigint }[]>(
        `SELECT c."userId" as user_id, COUNT(*) as c
         FROM "community_pinned_comments" pin JOIN "community_comments" c ON c.id = pin."commentId"
         WHERE c."userId" = ANY($1) AND pin."createdAt" >= $2 GROUP BY c."userId"`,
        ids,
        since,
      ).catch(() => [] as { user_id: string; c: bigint }[]),
    ]);
    const answerKing = new Set(
      recentComments.filter((r) => r._count._all >= 10).map((r) => r.userId as string),
    );
    const pickKing = new Set(recentPins.filter((r) => Number(r.c) >= 5).map((r) => r.user_id));

    // 팔로워 수 + 뷰어의 팔로우 여부
    const [followerGroups, myFollows] = await Promise.all([
      this.prisma.communityFollow.groupBy({
        by: ['followingId'],
        where: { followingId: { in: ids } },
        _count: { _all: true },
      }),
      viewerId
        ? this.prisma.communityFollow.findMany({
            where: { followerId: viewerId, followingId: { in: ids } },
            select: { followingId: true },
          })
        : Promise.resolve([] as { followingId: string }[]),
    ]);
    const fc = new Map(followerGroups.map((r) => [r.followingId, r._count._all]));
    const followingSet = new Set(myFollows.map((r) => r.followingId));

    for (const u of users) {
      const postN = pc.get(u.id) || 0;
      const commentN = cc.get(u.id) || 0;
      const likeN = lr.get(u.id) || 0;
      const followerN = fc.get(u.id) || 0;
      const score = postN * 10 + commentN * 3 + likeN * 2 + (bn.get(u.id) || 0);
      // 배지 — 우선순위 순서로 판정(대표는 [0]).
      const keys: BadgeKey[] = [];
      if (followerN >= BADGE_THRESHOLDS.followerRich) keys.push('followerRich');
      if (likeN >= BADGE_THRESHOLDS.likeRich) keys.push('likeRich');
      if (answerKing.has(u.id)) keys.push('answerKing');
      if (pickKing.has(u.id)) keys.push('pickKing');
      if (commentN >= BADGE_THRESHOLDS.commentRich) keys.push('commentRich');
      if (postN >= BADGE_THRESHOLDS.heavyWriter) keys.push('heavyWriter');
      if (keys.length === 0 && postN <= BADGE_THRESHOLDS.newbieMaxPosts) keys.push('newbie');
      const op = operators.get(u.id);
      const isOperator = !!op || EDITOR_PERSONA_IDS.includes(u.id);
      map.set(u.id, {
        // 운영 프로필은 그 계정 이름·사진(어드민 운영 프로필에서 정함), 일반 회원은 '사랑받는 오리' 식 닉네임(실명 대신),
        // 사회자·업체·운영자는 이름 그대로 — community-nickname.ts
        nickname: isOperator ? u.name || op?.nickname || '운영팀' : customNick.get(u.id)?.nickname || communityNickname(u),
        // 웨딩숲 전용 사진(지정 계정이 고른 동물 친구)이 있으면 그걸로
        avatar: isOperator ? u.profileImageUrl || op?.avatarUrl || null : customNick.get(u.id)?.avatarUrl || u.profileImageUrl || null,
        isAdmin: u.role === 'admin',
        tier: tierForScore(score),
        isAnswerKing: answerKing.has(u.id),
        isPickKing: pickKing.has(u.id),
        // 운영 프로필(옛 운영진 에디터 포함)은 이름과 상관없이 늘 '운영팀' 표시(261001 '운영진' → 261004 '운영팀') — 회원 글처럼 보이지 않게
        roleLabel: isOperator ? OPERATOR_ROLE_LABEL : ROLE_LABELS[u.role as string] || null,
        followerCount: followerN,
        isFollowing: followingSet.has(u.id),
        badges: keys.map((k) => ({ key: k, ...BADGES[k] })),
        isOperator,
        bio: op?.bio || null,
      });
    }
    return map;
  }

  /** 운영 프로필 — 계정 id → 프로필(소개 등) */
  private async operatorProfiles(userIds: string[]) {
    const ids = Array.from(new Set(userIds.filter(Boolean)));
    if (ids.length === 0) return new Map<string, { nickname: string; avatarUrl: string | null; bio: string | null }>();
    const rows: { userId: string; nickname: string; avatarUrl: string | null; bio: string | null }[] = await this.prisma.communityOperatorProfile
      .findMany({ where: { userId: { in: ids } }, select: { userId: true, nickname: true, avatarUrl: true, bio: true } })
      .catch(() => []);
    return new Map(rows.map((r) => [r.userId, { nickname: r.nickname, avatarUrl: r.avatarUrl, bio: r.bio }]));
  }

  /**
   * 테스트 좋아요·조회수 덧씌우기(261004) — 개발·스테이징 서버(APP_ENV)에서만, 정렬·인기 계산이 다 끝난 '보여줄 목록'에만.
   * 운영 서버에서는 표를 읽지도 않고 그대로 돌려준다(공개 수치·인기순·추천·통계에 안 섞임).
   */
  private async withTestMetrics<T extends { id: string; likeCount: number; viewCount: number }>(posts: T[]): Promise<T[]> {
    if (!isTestMetricsEnabled() || posts.length === 0) return posts;
    const rows: { postId: string; likes: number; views: number }[] = await this.prisma.communityTestMetric
      .findMany({ where: { postId: { in: posts.map((p) => p.id) } }, select: { postId: true, likes: true, views: true } })
      .catch(() => []);
    if (rows.length === 0) return posts;
    const m = new Map(rows.map((r) => [r.postId, r]));
    return posts.map((p) => {
      const t = m.get(p.id);
      if (!t) return p;
      return { ...p, likeCount: p.likeCount + t.likes, viewCount: p.viewCount + t.views, testMetrics: { likes: t.likes, views: t.views } };
    });
  }

  private emptyAuthor(): Author {
    return {
      nickname: '(탈퇴한 사용자)',
      avatar: null,
      isAdmin: false,
      tier: 'iron',
      isAnswerKing: false,
      isPickKing: false,
      roleLabel: null,
      followerCount: 0,
      isFollowing: false,
      badges: [],
      isOperator: false,
      bio: null,
    };
  }

  // ─── 피드 목록 ────────────────────────────────────────────────────
  async listPosts(params: {
    groupId?: string;
    tagId?: string;
    q?: string;
    popular?: string;
    sort?: string;
    viewerId?: string;
  }) {
    const { groupId, tagId, q, popular, sort, viewerId } = params;
    const blocked = await this.getBlockedIds(viewerId);

    const where: any = { isActive: true };
    if (groupId) where.groupId = { in: await this.resolveGroupFilter(groupId) };
    if (tagId) where.tags = { some: { tagId } };
    if (q && q.trim()) {
      where.OR = [
        { title: { contains: q.trim(), mode: 'insensitive' } },
        { content: { contains: q.trim(), mode: 'insensitive' } },
      ];
    }
    if (blocked.size) where.userId = { notIn: Array.from(blocked) };

    const isPopular = popular === 'week';
    const isHot = !isPopular && sort === 'popular';
    const posts = await this.prisma.communityPost.findMany({
      where: isPopular
        ? { ...where, createdAt: { gte: new Date(Date.now() - 7 * 24 * 3600 * 1000) } }
        : where,
      orderBy: { createdAt: 'desc' },
      take: isPopular ? 40 : isHot ? 300 : 60,
      include: {
        group: true,
        tags: { include: { tag: true } },
        images: { orderBy: { sortOrder: 'asc' } },
        view: true,
        pollOptions: { orderBy: { sortOrder: 'asc' } },
        quizQuestions: { orderBy: { sortOrder: 'asc' } },
        _count: { select: { likes: true, comments: true } },
      },
    });

    if (isHot) {
      // 인기순 — (좋아요×3 + 댓글×2 + 조회×0.2 + 1) / (경과시간h + 2)^1.3 핫스코어(최근 인기글이 위로).
      const now = Date.now();
      const hot = (p: any) =>
        ((p._count?.likes || 0) * 3 + (p._count?.comments || 0) * 2 + (p.view?.count || 0) * 0.2 + 1) /
        Math.pow((now - new Date(p.createdAt).getTime()) / 3_600_000 + 2, 1.3);
      posts.sort((a, b) => hot(b) - hot(a));
      return { posts: await this.withTestMetrics(await this.buildFeedPosts(posts.slice(0, 60), viewerId)) };
    }

    const mapped = await this.buildFeedPosts(posts, viewerId);

    if (isPopular) {
      mapped.sort(
        (a, b) =>
          b.likeCount * 3 + b.commentCount * 2 + b.viewCount -
          (a.likeCount * 3 + a.commentCount * 2 + a.viewCount),
      );
      return { posts: await this.withTestMetrics(mapped.slice(0, 5)) };
    }
    return { posts: await this.withTestMetrics(mapped) };
  }

  private async buildFeedPosts(posts: any[], viewerId?: string) {
    if (posts.length === 0) return [];
    const postIds = posts.map((p) => p.id);
    const authorIds = posts.map((p) => p.userId).filter(Boolean);
    const authors = await this.mapAuthors(authorIds, viewerId);

    // 뷰어 리액션
    const myReactions = viewerId
      ? await this.prisma.communityPostLike.findMany({
          where: { postId: { in: postIds }, userId: viewerId },
          select: { postId: true, type: true },
        })
      : [];
    const myReactionMap = new Map(myReactions.map((r) => [r.postId, r.type]));

    // 리액션 카운트(그룹)
    const reactionGroups = await this.prisma.communityPostLike.groupBy({
      by: ['postId'],
      where: { postId: { in: postIds } },
      _count: { _all: true },
    });
    const likeCountMap = new Map(reactionGroups.map((r) => [r.postId, r._count._all]));

    // 대표 댓글(핀 우선, 없으면 최신 활성 댓글)
    const topComments = await this.topCommentsForPosts(postIds);

    // 투표/퀴즈 집계
    const pollAgg = await this.pollAggregates(postIds, viewerId);
    const quizAgg = await this.quizAggregates(posts, viewerId);

    // 좋아요한 사람 프로필 스택(좋아요가 하나라도 있는 글) — 최근 5명
    const likers = await this.likersForPosts(posts.filter((p) => (likeCountMap.get(p.id) || 0) > 0).map((p) => p.id));

    return posts.map((p) => {
      const author = (p.userId && authors.get(p.userId)) || this.emptyAuthor();
      return {
        id: p.id,
        userId: p.userId,
        // 에디터 이름을 바꾸기 전에 올린 글은 그때 이름·사진(authorName) 그대로
        nickname: p.authorName || author.nickname,
        avatar: p.authorName ? p.authorAvatar || null : author.avatar,
        authorTier: author.tier,
        authorIsAdmin: author.isAdmin,
        authorIsAnswerKing: author.isAnswerKing,
        authorIsPickKing: author.isPickKing,
        authorRole: author.roleLabel,
        authorIsOperator: author.isOperator,
        authorBio: author.isOperator ? author.bio : null,
        authorBadges: author.badges,
        authorFollowerCount: author.followerCount,
        authorIsFollowing: author.isFollowing,
        isMine: !!viewerId && (p.userId === viewerId || p.postedById === viewerId),
        isEdited: new Date(p.updatedAt).getTime() - new Date(p.createdAt).getTime() > 60_000,
        groupId: p.groupId,
        groupName: p.group?.name || '',
        groupSlug: p.group?.slug || '',
        title: p.title,
        content: p.content,
        type: p.type,
        poll: p.type === 'poll' ? pollAgg.get(p.id) || null : null,
        quiz: p.type === 'quiz' ? quizAgg.get(p.id) || null : null,
        topComment: topComments.get(p.id) || null,
        myReaction: myReactionMap.get(p.id) || null,
        likers: likers.get(p.id) || [],
        isBlinded: p.isBlinded,
        isActive: p.isActive,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
        viewCount: p.view?.count || 0,
        likeCount: likeCountMap.get(p.id) || 0,
        commentCount: p._count?.comments || 0,
        imageUrls: (p.images || []).map((i: any) => i.imageUrl),
        tags: (p.tags || []).map((pt: any) => ({
          id: pt.tag.id,
          name: pt.tag.name,
          slug: pt.tag.slug,
        })),
      };
    });
  }

  private async topCommentsForPosts(postIds: string[]) {
    const map = new Map<string, any>();
    if (postIds.length === 0) return map;
    // 핀 댓글
    const pins = await this.prisma.communityPinnedComment.findMany({
      where: { postId: { in: postIds } },
      include: { comment: true },
    });
    const pinnedByPost = new Map(pins.map((p) => [p.postId, p.comment]));
    // 최신 활성 댓글(핀 없는 글용)
    const latest = await this.prisma.communityComment.findMany({
      where: { postId: { in: postIds }, isActive: true },
      orderBy: { createdAt: 'desc' },
    });
    const latestByPost = new Map<string, any>();
    for (const c of latest) if (!latestByPost.has(c.postId)) latestByPost.set(c.postId, c);

    const chosen: any[] = [];
    for (const pid of postIds) {
      const pinned = pinnedByPost.get(pid);
      const c = pinned || latestByPost.get(pid);
      if (c) chosen.push({ pid, c, pinned: !!pinned });
    }
    const authorMap = await this.mapAuthors(chosen.map((x) => x.c.userId).filter(Boolean));
    for (const x of chosen) {
      const a = (x.c.userId && authorMap.get(x.c.userId)) || this.emptyAuthor();
      map.set(x.pid, {
        id: x.c.id,
        content: x.c.isActive ? x.c.content : '삭제된 댓글입니다',
        nickname: x.c.authorName || a.nickname,
        pinned: x.pinned,
      });
    }
    return map;
  }

  /** 직접 정한 닉네임·웨딩숲 사진(허용 계정만 있음) */
  private async customNicknames(userIds: string[]): Promise<Map<string, { nickname: string; avatarUrl: string | null }>> {
    const ids = Array.from(new Set(userIds.filter(Boolean)));
    if (ids.length === 0) return new Map();
    const rows = await this.prisma.communityNickname.findMany({ where: { userId: { in: ids } }, select: { userId: true, nickname: true, avatarUrl: true } });
    return new Map(rows.map((r) => [r.userId, { nickname: r.nickname, avatarUrl: r.avatarUrl }]));
  }

  /** 내 웨딩숲 프로필 — 보이는 이름·사진 · 직접 정한 값 · 정할 수 있는지 */
  async getMyNickname(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, email: true, role: true, profileImageUrl: true } });
    if (!user) throw new NotFoundException('회원을 찾을 수 없어요');
    const own = (await this.customNicknames([userId])).get(userId);
    return {
      nickname: own?.nickname || communityNickname(user),
      custom: own?.nickname || null,
      avatar: own?.avatarUrl || user.profileImageUrl || null,
      customAvatar: own?.avatarUrl || null,
      canSetNickname: CUSTOM_NICKNAME_EMAILS.has(String(user.email || '').trim().toLowerCase()),
      // 허용 계정만 — 글·댓글을 올릴 수 있는 운영진 에디터 이름들
      editors: CUSTOM_NICKNAME_EMAILS.has(String(user.email || '').trim().toLowerCase())
        ? (await this.prisma.user.findMany({ where: { id: { in: EDITOR_PERSONA_IDS }, isActive: true }, select: { id: true, name: true, profileImageUrl: true } }))
            .sort((a, b) => EDITOR_PERSONA_IDS.indexOf(a.id) - EDITOR_PERSONA_IDS.indexOf(b.id))
            .map((e) => ({ id: e.id, name: e.name, avatar: e.profileImageUrl || null }))
        : [],
    };
  }

  /** 누구 이름으로 올릴지 — asEditorId 가 있으면 허용 계정 + 에디터 목록 안일 때만 그 이름, 실제 쓴 계정은 postedById */
  private async resolveActingAuthor(userId: string, asEditorId?: unknown): Promise<{ authorId: string; postedById: string | null }> {
    const editorId = typeof asEditorId === 'string' ? asEditorId.trim() : '';
    if (!editorId || editorId === userId) return { authorId: userId, postedById: null };
    if (!EDITOR_PERSONA_IDS.includes(editorId)) throw new BadRequestException('올릴 수 없는 이름이에요');
    const me = await this.prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
    if (!CUSTOM_NICKNAME_EMAILS.has(String(me?.email || '').trim().toLowerCase())) throw new ForbiddenException('운영진 이름으로 올릴 수 없는 계정이에요');
    return { authorId: editorId, postedById: userId };
  }

  /** 운영진 에디터 이름·사진 바꾸기(261001, 허용 계정만) — 이름은 자유(2~16자, '프리티풀' 안 붙임), 대신 글·댓글엔 늘 '운영진' 표시(mapAuthors).
   *  회원·예비부부·사회자로 보이는 말, 회원 닉네임('꾸밈말 동물') 모양은 막는다.
   *  바꾸기 직전에 그 에디터의 예전 글·댓글에 그때 이름·사진(authorName·authorAvatar)을 박아 둔다 → 이름을 바꿔도 예전 글은 그대로. */
  async renameEditor(userId: string, editorId: string, body: any) {
    const me = await this.prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
    if (!CUSTOM_NICKNAME_EMAILS.has(String(me?.email || '').trim().toLowerCase())) throw new ForbiddenException('에디터 이름을 바꿀 수 없는 계정이에요');
    if (!EDITOR_PERSONA_IDS.includes(editorId)) throw new BadRequestException('바꿀 수 없는 이름이에요');
    const editor = await this.prisma.user.findUnique({ where: { id: editorId }, select: { id: true, name: true, role: true, profileImageUrl: true } });
    if (!editor) throw new NotFoundException('에디터를 찾을 수 없어요');

    const name = String(body?.name ?? '').replace(/\s+/g, ' ').trim();
    if (name.length < 2 || name.length > 16) throw new BadRequestException('이름은 2~16자로 정해 주세요');
    if (!/^[가-힣a-zA-Z0-9 ._-]+$/.test(name)) throw new BadRequestException('한글·영문·숫자와 . _ - 만 쓸 수 있어요');
    if (EDITOR_NAME_BLOCK.test(name)) throw new BadRequestException('회원·예비부부·사회자로 보일 수 있는 말은 쓸 수 없어요');
    if (looksLikeMemberNickname(name)) throw new BadRequestException('회원 닉네임과 같은 모양(꾸밈말 + 동물)은 쓸 수 없어요');
    const taken = await this.prisma.user.findFirst({ where: { id: { in: EDITOR_PERSONA_IDS.filter((x) => x !== editorId) }, name }, select: { id: true } });
    if (taken) throw new BadRequestException('다른 에디터가 쓰고 있는 이름이에요');

    // 사진 — 동물 친구 20종만(생략하면 그대로)
    let avatarUrl: string | undefined;
    if (body?.avatarUrl) {
      const m = /\/images\/avatars\/animal-(\d{2})\.webp$/.exec(String(body.avatarUrl));
      const n = m ? Number(m[1]) : 0;
      if (n < 1 || n > AVATAR_ANIMALS.length) throw new BadRequestException('동물 친구 사진 중에서 골라 주세요');
      avatarUrl = animalAvatarUrl(AVATAR_ANIMALS[n - 1]) || undefined;
    }

    const sameAvatar = avatarUrl === undefined || avatarUrl === editor.profileImageUrl;
    if (name === editor.name && sameAvatar) return this.getMyNickname(userId);
    // 지금 보이는 이름·사진(mapAuthors 와 같은 규칙)을 예전 글·댓글에 박고 나서 바꾼다 — 한 번에(중간에 끊기면 아무것도 안 바뀜)
    const own = (await this.customNicknames([editorId])).get(editorId);
    const oldName = own?.nickname || communityNickname(editor);
    const oldAvatar = own?.avatarUrl || editor.profileImageUrl || null;
    await this.prisma.$transaction([
      this.prisma.communityPost.updateMany({ where: { userId: editorId, authorName: null }, data: { authorName: oldName, authorAvatar: oldAvatar } }),
      this.prisma.communityComment.updateMany({ where: { userId: editorId, authorName: null }, data: { authorName: oldName, authorAvatar: oldAvatar } }),
      this.prisma.user.update({ where: { id: editorId }, data: { name, ...(avatarUrl !== undefined ? { profileImageUrl: avatarUrl } : {}) } }),
      // 운영 프로필 표(어드민 '운영 프로필' 목록)도 같이 — 261004
      this.prisma.communityOperatorProfile.updateMany({ where: { userId: editorId }, data: { nickname: name, ...(avatarUrl !== undefined ? { avatarUrl } : {}) } }),
      this.prisma.adminAuditLog.create({
        data: {
          adminId: userId,
          adminEmail: String(me?.email || '') || null,
          action: 'operator_profile.update',
          targetType: 'operator_profile',
          targetId: editorId,
          beforeState: { nickname: oldName, avatarUrl: oldAvatar },
          afterState: { nickname: name, avatarUrl: avatarUrl !== undefined ? avatarUrl : oldAvatar, source: 'app' },
          reason: '앱에서 운영진 에디터 이름·사진 변경',
        },
      }),
    ]);
    return this.getMyNickname(userId);
  }

  /** 닉네임(+웨딩숲 사진) 저장 — 계정당 하나. avatarUrl: 동물 친구 20종 주소 · null=원래 사진으로 · 없으면 그대로 */
  async setMyNickname(userId: string, body: any) {
    const me = await this.getMyNickname(userId);
    if (!me.canSetNickname) throw new ForbiddenException('닉네임을 바꿀 수 없는 계정이에요');
    const nickname = String(body?.nickname ?? '').replace(/\s+/g, ' ').trim();
    // 규칙은 관리자 닉네임 변경과 같은 함수(community-operator.ts)
    const problem = memberNicknameProblem(nickname);
    if (problem) throw new BadRequestException(problem);
    let avatarUrl: string | null | undefined;
    if (body && Object.prototype.hasOwnProperty.call(body, 'avatarUrl')) {
      if (body.avatarUrl === null || body.avatarUrl === '') avatarUrl = null;
      else {
        // 아무 사진이나 받지 않는다(실존 인물 사진으로 남 행세 방지) — 동물 친구 20종만
        const m = /\/images\/avatars\/animal-(\d{2})\.webp$/.exec(String(body.avatarUrl));
        const n = m ? Number(m[1]) : 0;
        if (n < 1 || n > AVATAR_ANIMALS.length) throw new BadRequestException('동물 친구 사진 중에서 골라 주세요');
        avatarUrl = animalAvatarUrl(AVATAR_ANIMALS[n - 1]);
      }
    }
    await this.prisma.communityNickname.upsert({
      where: { userId },
      create: { userId, nickname, avatarUrl: avatarUrl ?? null },
      update: { nickname, ...(avatarUrl !== undefined ? { avatarUrl } : {}) },
    });
    return this.getMyNickname(userId);
  }

  /** AI 닉네임 추천 6개 — '꾸밈말 + 동물' + 그 동물 사진. AI 가 모자라면 꾸밈말 목록에서 채운다 */
  async suggestMyNicknames(userId: string) {
    const me = await this.getMyNickname(userId);
    if (!me.canSetNickname) throw new ForbiddenException('닉네임을 바꿀 수 없는 계정이에요');
    const ai = await this.ai.suggestNicknames(8, AVATAR_ANIMALS).catch(() => [] as { modifier: string; animal: string }[]);
    const seen = new Set<string>([me.nickname]);
    const items: { nickname: string; avatarUrl: string }[] = [];
    const push = (modifier: string, animal: string) => {
      const mod = String(modifier || '').replace(/\s+/g, '');
      const avatarUrl = animalAvatarUrl(animal);
      if (!avatarUrl || mod.length < 2 || mod.length > 7 || !/^[가-힣]+$/.test(mod) || NICKNAME_BLOCK.test(mod)) return;
      const nickname = `${mod} ${animal}`;
      if (nickname.length > 12 || seen.has(nickname)) return;
      seen.add(nickname);
      items.push({ nickname, avatarUrl });
    };
    for (const x of ai) push(x.modifier, x.animal);
    for (let guard = 0; items.length < 6 && guard < 200; guard++) {
      push(MODIFIERS[Math.floor(Math.random() * MODIFIERS.length)], AVATAR_ANIMALS[Math.floor(Math.random() * AVATAR_ANIMALS.length)]);
    }
    return { items: items.slice(0, 6), source: ai.length ? 'ai' : 'rule' };
  }

  // 글마다 최근에 좋아요 누른 5명(이름·프사만). 창 함수로 글당 5개만 읽고, 유저는 가볍게 조회한다.
  private async likersForPosts(postIds: string[]) {
    const map = new Map<string, { userId: string; nickname: string; avatar: string | null }[]>();
    if (postIds.length === 0) return map;
    const rows = await this.prisma.$queryRaw<{ postId: string; userId: string }[]>`
      SELECT "postId", "userId" FROM (
        SELECT "postId", "userId", ROW_NUMBER() OVER (PARTITION BY "postId" ORDER BY "createdAt" DESC) AS rn
        FROM community_post_likes
        WHERE "postId" = ANY(${postIds})
      ) t
      WHERE t.rn <= 5
      ORDER BY "postId", t.rn`;
    const users = await this.prisma.user.findMany({
      where: { id: { in: Array.from(new Set(rows.map((r) => r.userId))) } },
      select: { id: true, name: true, profileImageUrl: true, role: true },
    });
    const userMap = new Map(users.map((u) => [u.id, u]));
    const customNick = await this.customNicknames(users.map((u) => u.id));
    for (const r of rows) {
      const u = userMap.get(r.userId);
      const arr = map.get(r.postId) || [];
      const own = u ? customNick.get(u.id) : undefined;
      arr.push({ userId: r.userId, nickname: u ? own?.nickname || communityNickname(u) : '회원', avatar: own?.avatarUrl || u?.profileImageUrl || null });
      map.set(r.postId, arr);
    }
    return map;
  }

  private async pollAggregates(postIds: string[], viewerId?: string) {
    const map = new Map<string, any>();
    const pollPosts = await this.prisma.communityPost.findMany({
      where: { id: { in: postIds }, type: 'poll' },
      include: { pollOptions: { orderBy: { sortOrder: 'asc' } } },
    });
    if (pollPosts.length === 0) return map;
    const ids = pollPosts.map((p) => p.id);
    const votes = await this.prisma.communityPollVote.groupBy({
      by: ['optionId'],
      where: { postId: { in: ids } },
      _count: { _all: true },
    });
    const voteCount = new Map(votes.map((v) => [v.optionId, v._count._all]));
    const myVotes = viewerId
      ? await this.prisma.communityPollVote.findMany({
          where: { postId: { in: ids }, userId: viewerId },
          select: { postId: true, optionId: true },
        })
      : [];
    const myVoteMap = new Map(myVotes.map((v) => [v.postId, v.optionId]));
    for (const p of pollPosts) {
      const total = p.pollOptions.reduce((s, o) => s + (voteCount.get(o.id) || 0), 0);
      map.set(p.id, {
        totalVotes: total,
        myOptionId: myVoteMap.get(p.id) || null,
        options: p.pollOptions.map((o) => ({
          id: o.id,
          text: o.text,
          votes: voteCount.get(o.id) || 0,
          percent: total ? Math.round(((voteCount.get(o.id) || 0) / total) * 100) : 0,
        })),
      });
    }
    return map;
  }

  // 스타디 계약: { questions:[{id,text,myAnswer,correctAnswer,oCount,xCount}], solvedCount, correctCount, participantCount }
  // 정답(correctAnswer)은 뷰어가 그 문제를 푼 뒤에만 공개한다.
  private async quizAggregates(posts: any[], viewerId?: string) {
    const map = new Map<string, any>();
    const quizPosts = posts.filter((p) => p.type === 'quiz');
    if (quizPosts.length === 0) return map;
    const ids = quizPosts.map((p) => p.id);
    const [answerGroups, participantRows, myAnswers] = await Promise.all([
      this.prisma.communityQuizAnswer.groupBy({
        by: ['questionId', 'answer'],
        where: { postId: { in: ids } },
        _count: { _all: true },
      }),
      this.prisma.communityQuizAnswer.groupBy({
        by: ['postId', 'userId'],
        where: { postId: { in: ids } },
        _count: { _all: true },
      }),
      viewerId
        ? this.prisma.communityQuizAnswer.findMany({ where: { postId: { in: ids }, userId: viewerId } })
        : Promise.resolve([] as { questionId: string; answer: boolean }[]),
    ]);
    const ox = new Map<string, { o: number; x: number }>();
    for (const r of answerGroups) {
      const c = ox.get(r.questionId) || { o: 0, x: 0 };
      if (r.answer) c.o += r._count._all;
      else c.x += r._count._all;
      ox.set(r.questionId, c);
    }
    const participants = new Map<string, number>();
    for (const r of participantRows) participants.set(r.postId, (participants.get(r.postId) || 0) + 1);
    const mine = new Map(myAnswers.map((a) => [a.questionId, a.answer]));
    for (const p of quizPosts) {
      let solved = 0;
      let correct = 0;
      const questions = (p.quizQuestions || []).map((q: any) => {
        const my = mine.has(q.id) ? (mine.get(q.id) as boolean) : null;
        if (my !== null) {
          solved += 1;
          if (my === q.answer) correct += 1;
        }
        const c = ox.get(q.id) || { o: 0, x: 0 };
        return {
          id: q.id,
          text: q.text,
          myAnswer: my,
          correctAnswer: my !== null ? q.answer : null,
          oCount: c.o,
          xCount: c.x,
        };
      });
      map.set(p.id, {
        questions,
        solvedCount: solved,
        correctCount: correct,
        participantCount: participants.get(p.id) || 0,
      });
    }
    return map;
  }

  // ─── 글 작성 ──────────────────────────────────────────────────────
  async createPost(
    userId: string,
    body: {
      groupId: string;
      title: string;
      content: string;
      tagIds?: string[];
      imageUrls?: string[];
      isBlinded?: boolean;
      type?: string;
      pollOptions?: string[];
      quizItems?: { text: string; answer: boolean }[];
      /** 운영진 에디터 이름으로 올리기(허용 계정만) */
      asEditorId?: string;
    },
  ) {
    const acting = await this.resolveActingAuthor(userId, body.asEditorId);
    const title = (body.title || '').trim();
    const content = (body.content || '').trim();
    if (!body.groupId) throw new BadRequestException('카테고리를 선택해주세요.');
    const target = await this.prisma.communityGroup.findUnique({
      where: { id: body.groupId },
      include: { children: { select: { id: true } } },
    });
    if (!target || !target.isActive) throw new BadRequestException('카테고리를 찾을 수 없어요.');
    if (target.children.length > 0) throw new BadRequestException('소분류를 선택해주세요.');
    if (!title) throw new BadRequestException('제목을 입력해주세요.');
    if (!content && !(body.imageUrls?.length)) throw new BadRequestException('내용을 입력해주세요.');

    const type = body.type === 'poll' || body.type === 'quiz' ? body.type : 'normal';
    const imageUrls = (body.imageUrls || [])
      .filter((u) => /^https?:\/\//.test(u) || u.startsWith('/uploads/'))
      .slice(0, 5);

    if (type === 'poll') {
      const opts = (body.pollOptions || []).map((t) => t.trim()).filter(Boolean);
      if (opts.length < 2 || opts.length > 4)
        throw new BadRequestException('투표 항목은 2~4개여야 합니다.');
    }
    if (type === 'quiz') {
      const items = (body.quizItems || []).filter((q) => q.text?.trim());
      if (items.length < 1 || items.length > QUIZ_MAX_QUESTIONS_PER_POST)
        throw new BadRequestException(`OX 문제는 1~${QUIZ_MAX_QUESTIONS_PER_POST}개여야 합니다.`);
      // 일일 퀴즈 작성 제한
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayCount = await this.prisma.communityQuizPostLog.count({
        where: { userId, createdAt: { gte: today } },
      });
      if (todayCount >= QUIZ_MAX_POSTS_PER_DAY)
        throw new BadRequestException(`OX 퀴즈는 하루 ${QUIZ_MAX_POSTS_PER_DAY}개까지 작성할 수 있어요.`);
    }

    const post = await this.prisma.communityPost.create({
      data: {
        userId: acting.authorId,
        postedById: acting.postedById,
        groupId: body.groupId,
        title,
        content,
        type,
        isBlinded: !!body.isBlinded,
        tags: body.tagIds?.length
          ? { create: body.tagIds.slice(0, 5).map((tagId) => ({ tagId })) }
          : undefined,
        images: imageUrls.length
          ? { create: imageUrls.map((imageUrl, i) => ({ imageUrl, sortOrder: i })) }
          : undefined,
        pollOptions:
          type === 'poll'
            ? {
                create: (body.pollOptions || [])
                  .map((t) => t.trim())
                  .filter(Boolean)
                  .slice(0, 4)
                  .map((text, i) => ({ text, sortOrder: i })),
              }
            : undefined,
        quizQuestions:
          type === 'quiz'
            ? {
                create: (body.quizItems || [])
                  .filter((q) => q.text?.trim())
                  .slice(0, QUIZ_MAX_QUESTIONS_PER_POST)
                  .map((q, i) => ({ text: q.text.trim(), answer: !!q.answer, sortOrder: i })),
              }
            : undefined,
        view: { create: { count: 0 } },
      },
    });

    if (type === 'quiz') {
      await this.prisma.communityQuizPostLog.create({ data: { userId, postId: post.id } });
    }
    return { id: post.id };
  }

  // ─── 글 상세 + 댓글 ───────────────────────────────────────────────
  async getPost(id: string, opts: { viewerId?: string; sort?: string; track?: boolean }) {
    const post = await this.prisma.communityPost.findFirst({
      where: { id, isActive: true },
      include: {
        group: true,
        tags: { include: { tag: true } },
        images: { orderBy: { sortOrder: 'asc' } },
        view: true,
        pollOptions: { orderBy: { sortOrder: 'asc' } },
        quizQuestions: { orderBy: { sortOrder: 'asc' } },
        pinnedComment: true,
        _count: { select: { likes: true, comments: true } },
      },
    });
    if (!post) throw new NotFoundException('게시글을 찾을 수 없어요.');

    if (opts.track) {
      await this.prisma.communityPostView.upsert({
        where: { postId: id },
        create: { postId: id, count: 1 },
        update: { count: { increment: 1 } },
      });
    }

    const [built] = await this.withTestMetrics(await this.buildFeedPosts([post], opts.viewerId));
    // 상세 전용 추가 필드
    const reactionCounts = await this.prisma.communityPostLike.groupBy({
      by: ['type'],
      where: { postId: id },
      _count: { _all: true },
    });
    const counts: Record<string, number> = {};
    for (const t of REACTION_TYPES) counts[t] = 0;
    for (const r of reactionCounts) counts[r.type] = r._count._all;

    const comments = await this.buildCommentTree(id, opts.sort, opts.viewerId, post.userId);

    return {
      post: {
        ...built,
        likedByMe: !!built.myReaction,
        reactionCounts: counts,
        pinnedCommentId: post.pinnedComment?.commentId || null,
      },
      comments,
    };
  }

  private async buildCommentTree(postId: string, sort?: string, viewerId?: string, postAuthorId?: string | null) {
    const blocked = await this.getBlockedIds(viewerId);
    const all = await this.prisma.communityComment.findMany({
      where: { postId },
      include: { _count: { select: { likes: true } } },
      orderBy: { createdAt: 'asc' },
    });
    const myLikes = viewerId
      ? await this.prisma.communityCommentLike.findMany({
          where: { comment: { postId }, userId: viewerId },
          select: { commentId: true },
        })
      : [];
    const likedSet = new Set(myLikes.map((l) => l.commentId));
    const authors = await this.mapAuthors(
      all.map((c) => c.userId).filter((x): x is string => !!x),
    );
    const pin = await this.prisma.communityPinnedComment.findUnique({ where: { postId } });

    const node = (c: any) => {
      const a = (c.userId && authors.get(c.userId)) || this.emptyAuthor();
      const isBlocked = c.userId && blocked.has(c.userId);
      return {
        id: c.id,
        parentId: c.parentId,
        userId: c.userId,
        // 에디터 이름을 바꾸기 전에 단 댓글은 그때 이름·사진 그대로
        nickname: c.authorName || a.nickname,
        avatar: c.authorName ? c.authorAvatar || null : a.avatar,
        authorTier: a.tier,
        authorIsAdmin: a.isAdmin,
        authorIsAnswerKing: a.isAnswerKing,
        authorIsPickKing: a.isPickKing,
        authorRole: a.roleLabel,
        authorBadges: a.badges,
        isPostAuthor: !!postAuthorId && c.userId === postAuthorId,
        postedByMe: !!viewerId && c.postedById === viewerId,
        isEdited:
          c.isActive && new Date(c.updatedAt).getTime() - new Date(c.createdAt).getTime() > 60_000,
        content: !c.isActive ? '삭제된 댓글입니다' : isBlocked ? '차단한 사용자의 댓글입니다' : c.content,
        isActive: c.isActive,
        isBlocked: !!isBlocked,
        likeCount: c._count.likes,
        likedByMe: likedSet.has(c.id),
        isPinned: pin?.commentId === c.id,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
        replies: [] as any[],
      };
    };

    const nodes = all.map(node);
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const roots: any[] = [];
    for (const n of nodes) {
      if (n.parentId && byId.has(n.parentId)) byId.get(n.parentId)!.replies.push(n);
      else roots.push(n);
    }
    // 정렬(루트)
    const sortRoots = (arr: any[]) => {
      if (sort === 'oldest') arr.sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt));
      else if (sort === 'popular' || sort === 'recommended')
        arr.sort((a, b) => b.likeCount - a.likeCount || +new Date(b.createdAt) - +new Date(a.createdAt));
      else arr.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)); // newest
    };
    // 핀 댓글 최상단
    sortRoots(roots);
    roots.sort((a, b) => (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0));
    return roots;
  }

  // ─── 글 수정/삭제 ─────────────────────────────────────────────────
  private async assertPostOwnerOrAdmin(postId: string, userId: string, isAdmin: boolean) {
    const post = await this.prisma.communityPost.findUnique({ where: { id: postId } });
    if (!post) throw new NotFoundException('게시글을 찾을 수 없어요.');
    if (!isAdmin && post.userId !== userId && post.postedById !== userId) throw new ForbiddenException('권한이 없어요.');
    return post;
  }

  async updatePost(
    id: string,
    userId: string,
    isAdmin: boolean,
    body: { title?: string; content?: string; imageUrls?: string[] },
  ) {
    await this.assertPostOwnerOrAdmin(id, userId, isAdmin);
    const data: any = {};
    if (typeof body.title === 'string') data.title = body.title.trim();
    if (typeof body.content === 'string') data.content = body.content.trim();
    await this.prisma.communityPost.update({ where: { id }, data });
    if (Array.isArray(body.imageUrls)) {
      await this.prisma.communityPostImage.deleteMany({ where: { postId: id } });
      const urls = body.imageUrls
        .filter((u) => /^https?:\/\//.test(u) || u.startsWith('/uploads/'))
        .slice(0, 5);
      if (urls.length)
        await this.prisma.communityPostImage.createMany({
          data: urls.map((imageUrl, i) => ({ postId: id, imageUrl, sortOrder: i })),
        });
    }
    return { success: true };
  }

  async deletePost(id: string, userId: string, isAdmin: boolean) {
    await this.assertPostOwnerOrAdmin(id, userId, isAdmin);
    await this.prisma.communityPost.delete({ where: { id } });
    return { success: true };
  }

  // ─── 댓글 ─────────────────────────────────────────────────────────
  async createComment(postId: string, userId: string, body: { content: string; parentId?: string; asEditorId?: string }) {
    const acting = await this.resolveActingAuthor(userId, body.asEditorId);
    const content = (body.content || '').trim();
    if (!content) throw new BadRequestException('내용을 입력해주세요.');
    if (content.length > 2000) throw new BadRequestException('댓글은 2000자 이내여야 해요.');
    const post = await this.prisma.communityPost.findFirst({ where: { id: postId, isActive: true } });
    if (!post) throw new NotFoundException('게시글을 찾을 수 없어요.');
    // 대댓글은 1단계로 평탄화(대댓글의 대댓글 → 최상위 부모에 붙임)
    let parentId: string | null = null;
    if (body.parentId) {
      const parent = await this.prisma.communityComment.findUnique({ where: { id: body.parentId } });
      if (parent && parent.postId === postId) parentId = parent.parentId || parent.id;
    }
    const c = await this.prisma.communityComment.create({
      data: { postId, userId: acting.authorId, postedById: acting.postedById, content, parentId },
    });
    return { id: c.id };
  }

  async updateComment(id: string, userId: string, isAdmin: boolean, content: string) {
    const c = await this.prisma.communityComment.findUnique({ where: { id } });
    if (!c) throw new NotFoundException('댓글을 찾을 수 없어요.');
    if (!isAdmin && c.userId !== userId && c.postedById !== userId) throw new ForbiddenException('권한이 없어요.');
    const text = (content || '').trim();
    if (!text) throw new BadRequestException('내용을 입력해주세요.');
    if (text.length > 2000) throw new BadRequestException('댓글은 2000자 이내여야 해요.');
    await this.prisma.communityComment.update({ where: { id }, data: { content: text } });
    return { ok: true };
  }

  async deleteComment(id: string, userId: string, isAdmin: boolean) {
    const c = await this.prisma.communityComment.findUnique({ where: { id } });
    if (!c) throw new NotFoundException('댓글을 찾을 수 없어요.');
    if (!isAdmin && c.userId !== userId && c.postedById !== userId) throw new ForbiddenException('권한이 없어요.');
    await this.prisma.communityComment.update({ where: { id }, data: { isActive: false } });
    return { ok: true };
  }

  // ─── 리액션(6종) ──────────────────────────────────────────────────
  async reactPost(postId: string, userId: string, type?: string | null) {
    const post = await this.prisma.communityPost.findFirst({ where: { id: postId, isActive: true } });
    if (!post) throw new NotFoundException('게시글을 찾을 수 없어요.');
    const existing = await this.prisma.communityPostLike.findUnique({
      where: { postId_userId: { postId, userId } },
    });
    if (type === null || (type === undefined && existing)) {
      // 해제(또는 레거시 토글 해제)
      if (existing) await this.prisma.communityPostLike.delete({ where: { postId_userId: { postId, userId } } });
    } else {
      const t: ReactionType = (REACTION_TYPES as readonly string[]).includes(type as string)
        ? (type as ReactionType)
        : 'heart';
      await this.prisma.communityPostLike.upsert({
        where: { postId_userId: { postId, userId } },
        create: { postId, userId, type: t },
        update: { type: t },
      });
    }
    const groups = await this.prisma.communityPostLike.groupBy({
      by: ['type'],
      where: { postId },
      _count: { _all: true },
    });
    const counts: Record<string, number> = {};
    for (const t of REACTION_TYPES) counts[t] = 0;
    let total = 0;
    for (const g of groups) {
      counts[g.type] = g._count._all;
      total += g._count._all;
    }
    const mine = await this.prisma.communityPostLike.findUnique({
      where: { postId_userId: { postId, userId } },
    });
    const likers = await this.likersForPosts(total > 0 ? [postId] : []);
    return {
      myReaction: mine?.type || null,
      counts,
      total,
      liked: !!mine,
      likeCount: total,
      likers: likers.get(postId) || [],
    };
  }

  async likeComment(commentId: string, userId: string) {
    const c = await this.prisma.communityComment.findUnique({ where: { id: commentId } });
    if (!c) throw new NotFoundException('댓글을 찾을 수 없어요.');
    const existing = await this.prisma.communityCommentLike.findUnique({
      where: { commentId_userId: { commentId, userId } },
    });
    if (existing) await this.prisma.communityCommentLike.delete({ where: { commentId_userId: { commentId, userId } } });
    else await this.prisma.communityCommentLike.create({ data: { commentId, userId } });
    const likeCount = await this.prisma.communityCommentLike.count({ where: { commentId } });
    return { liked: !existing, likeCount };
  }

  // ─── 투표 ─────────────────────────────────────────────────────────
  async votePoll(postId: string, userId: string, optionId: string) {
    const opt = await this.prisma.communityPollOption.findFirst({ where: { id: optionId, postId } });
    if (!opt) throw new BadRequestException('잘못된 투표 항목이에요.');
    await this.prisma.communityPollVote.upsert({
      where: { postId_userId: { postId, userId } },
      create: { postId, userId, optionId },
      update: { optionId },
    });
    const agg = await this.pollAggregates([postId], userId);
    return { poll: agg.get(postId) || null };
  }

  // ─── OX 퀴즈 응답 ─────────────────────────────────────────────────
  async answerQuiz(postId: string, userId: string, questionId: string, answer: boolean) {
    const q = await this.prisma.communityQuizQuestion.findFirst({ where: { id: questionId, postId } });
    if (!q) throw new BadRequestException('잘못된 문제예요.');
    // 한 번 응답하면 불변
    await this.prisma.communityQuizAnswer
      .create({ data: { questionId, userId, postId, answer } })
      .catch(() => null); // 이미 응답 → 무시
    const post = await this.prisma.communityPost.findUnique({
      where: { id: postId },
      include: { quizQuestions: { orderBy: { sortOrder: 'asc' } } },
    });
    const agg = await this.quizAggregates([{ ...post, type: 'quiz' }], userId);
    return { quiz: agg.get(postId) || null };
  }

  // ─── 핀(댓글 고정) ───────────────────────────────────────────────
  async pinComment(postId: string, userId: string, isAdmin: boolean, commentId: string | null) {
    await this.assertPostOwnerOrAdmin(postId, userId, isAdmin);
    if (!commentId) {
      await this.prisma.communityPinnedComment.deleteMany({ where: { postId } });
      return { pinnedCommentId: null };
    }
    const c = await this.prisma.communityComment.findFirst({ where: { id: commentId, postId } });
    if (!c) throw new BadRequestException('댓글을 찾을 수 없어요.');
    if (c.parentId) throw new BadRequestException('답글은 고정할 수 없어요.');
    await this.prisma.communityPinnedComment.upsert({
      where: { postId },
      create: { postId, commentId },
      update: { commentId },
    });
    return { pinnedCommentId: commentId };
  }

  // ─── 신고 ─────────────────────────────────────────────────────────
  async createReport(
    userId: string,
    body: { targetType: 'post' | 'comment'; postId?: string; commentId?: string; reason: string; detail?: string },
  ) {
    if (!REPORT_REASONS.includes(body.reason)) throw new BadRequestException('신고 사유를 선택해주세요.');
    let targetUserId: string | null = null;
    if (body.targetType === 'post' && body.postId) {
      const p = await this.prisma.communityPost.findUnique({ where: { id: body.postId } });
      targetUserId = p?.userId || null;
    } else if (body.targetType === 'comment' && body.commentId) {
      const c = await this.prisma.communityComment.findUnique({ where: { id: body.commentId } });
      targetUserId = c?.userId || null;
    }
    if (targetUserId === userId) throw new BadRequestException('자신의 콘텐츠는 신고할 수 없어요.');
    await this.prisma.communityReport
      .create({
        data: {
          targetType: body.targetType,
          postId: body.postId || null,
          commentId: body.commentId || null,
          userId,
          targetUserId,
          reason: body.reason,
          detail: body.detail || null,
        },
      })
      .catch(() => null); // 중복 신고 무시
    return { ok: true };
  }

  // ─── 차단 ─────────────────────────────────────────────────────────
  async listBlocks(userId: string) {
    const blocks = await this.prisma.communityBlock.findMany({
      where: { blockerId: userId },
      orderBy: { createdAt: 'desc' },
    });
    const authors = await this.mapAuthors(blocks.map((b) => b.blockedId));
    const result: any[] = [];
    for (const b of blocks) {
      const a = authors.get(b.blockedId) || this.emptyAuthor();
      const [postCount, commentCount] = await Promise.all([
        this.prisma.communityPost.count({ where: { userId: b.blockedId, isActive: true } }),
        this.prisma.communityComment.count({ where: { userId: b.blockedId, isActive: true } }),
      ]);
      result.push({
        userId: b.blockedId,
        nickname: a.nickname,
        createdAt: b.createdAt,
        postCount,
        commentCount,
      });
    }
    return { blocks: result };
  }

  async toggleBlock(userId: string, targetId: string) {
    if (userId === targetId) throw new BadRequestException('자신은 차단할 수 없어요.');
    const existing = await this.prisma.communityBlock.findUnique({
      where: { blockerId_blockedId: { blockerId: userId, blockedId: targetId } },
    });
    if (existing) {
      await this.prisma.communityBlock.delete({
        where: { blockerId_blockedId: { blockerId: userId, blockedId: targetId } },
      });
      return { blocked: false };
    }
    await this.prisma.communityBlock.create({ data: { blockerId: userId, blockedId: targetId } });
    return { blocked: true };
  }

  // ─── 팔로우 ───────────────────────────────────────────────────────
  async toggleFollow(userId: string, targetId: string) {
    if (!targetId) throw new BadRequestException('대상을 찾을 수 없어요.');
    if (userId === targetId) throw new BadRequestException('자신은 팔로우할 수 없어요.');
    const target = await this.prisma.user.findUnique({ where: { id: targetId }, select: { id: true } });
    if (!target) throw new NotFoundException('사용자를 찾을 수 없어요.');
    const key = { followerId_followingId: { followerId: userId, followingId: targetId } };
    const existing = await this.prisma.communityFollow.findUnique({ where: key });
    if (existing) await this.prisma.communityFollow.delete({ where: key });
    else await this.prisma.communityFollow.create({ data: { followerId: userId, followingId: targetId } });
    const followerCount = await this.prisma.communityFollow.count({ where: { followingId: targetId } });
    return { following: !existing, followerCount };
  }

  // 내가 댓글 단 글 목록('내가 쓴 댓글' 필터용) — 최신순.
  async myComments(userId: string) {
    const comments = await this.prisma.communityComment.findMany({
      where: { userId, isActive: true, post: { isActive: true } },
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: { postId: true, content: true, createdAt: true },
    });
    return { comments };
  }

  // ─── 기타 ─────────────────────────────────────────────────────────
  async latest() {
    const p = await this.prisma.communityPost.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });
    return { latest: p?.createdAt || null };
  }

  async quizQuota(userId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const used = await this.prisma.communityQuizPostLog.count({
      where: { userId, createdAt: { gte: today } },
    });
    return {
      remaining: Math.max(0, QUIZ_MAX_POSTS_PER_DAY - used),
      maxPerDay: QUIZ_MAX_POSTS_PER_DAY,
      maxQuestions: QUIZ_MAX_QUESTIONS_PER_POST,
    };
  }
}

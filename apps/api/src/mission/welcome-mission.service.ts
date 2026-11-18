import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';
import {
  SECRET_ENTRY_STATUSES,
  SECRET_MISSION_INSTAGRAM,
  SECRET_MISSION_PRIZE,
  WELCOME_MISSION_REQUIRED,
  WELCOME_MISSION_REWARD,
  WELCOME_MISSION_START,
  WELCOME_POST_MIN_CHARS,
  isWelcomeMissionPost,
  isWelcomeMissionUser,
  kstDay,
  maskAccount,
  parseInstagramId,
  parseWelcomeClaim,
  welcomeMissionSince,
} from './welcome-mission.rules';

const CLAIM_STATUSES = ['pending', 'paid', 'rejected'] as const;

@Injectable()
export class WelcomeMissionService {
  private readonly logger = new Logger(WelcomeMissionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationService,
  ) {}

  private async user(userId: string) {
    const u = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, createdAt: true, deletedAt: true, isActive: true, phone: true, name: true },
    });
    if (!u) throw new NotFoundException('계정을 찾을 수 없어요.');
    return u;
  }

  /** 미션 진행 — 출석 · 웨딩숲 글 · 견적 수와 지급 신청 */
  async status(userId: string) {
    const u = await this.user(userId);
    const eligible = isWelcomeMissionUser(u);
    const since = welcomeMissionSince(u.createdAt);
    const [days, postRows, requests, quotations, claim, secret] = await Promise.all([
      this.prisma.userAttendance.findMany({ where: { userId }, orderBy: { day: 'asc' }, select: { day: true } }),
      this.prisma.communityPost.findMany({ where: { userId, isActive: true, isBlinded: false, createdAt: { gte: since } }, select: { content: true } }),
      this.prisma.matchRequest.count({ where: { userId, createdAt: { gte: since } } }),
      this.prisma.quotation.count({ where: { proProfile: { userId }, createdAt: { gte: since } } }),
      this.prisma.welcomeMissionClaim.findUnique({ where: { userId } }),
      this.prisma.welcomeSecretEntry.findUnique({ where: { userId } }),
    ]);
    const posts = postRows.filter((p) => isWelcomeMissionPost(p.content)).length;
    const today = kstDay();
    const attendance = days.map((d) => d.day);
    const done = {
      attendance: attendance.length >= WELCOME_MISSION_REQUIRED.attendance,
      post: posts >= WELCOME_MISSION_REQUIRED.post,
      quote: requests + quotations >= WELCOME_MISSION_REQUIRED.quote,
    };
    const completed = done.attendance && done.post && done.quote;
    return {
      eligible,
      reward: WELCOME_MISSION_REWARD,
      startAt: WELCOME_MISSION_START.toISOString(),
      today,
      role: u.role,
      attendance: { days: attendance, count: attendance.length, required: WELCOME_MISSION_REQUIRED.attendance, checkedToday: attendance.includes(today) },
      post: { count: posts, required: WELCOME_MISSION_REQUIRED.post, minChars: WELCOME_POST_MIN_CHARS },
      quote: { count: requests + quotations, required: WELCOME_MISSION_REQUIRED.quote },
      completed,
      claim: claim
        ? {
            status: claim.status,
            createdAt: claim.createdAt.toISOString(),
            paidAt: claim.paidAt?.toISOString() ?? null,
            bankName: claim.bankName,
            account: maskAccount(claim.accountNumber),
            accountHolder: claim.accountHolder,
            adminNote: claim.status === 'rejected' ? claim.adminNote : null,
          }
        : null,
      /** 시크릿 미션(261118) — 5,000원 미션을 다 하면 열린다 */
      secret: {
        open: eligible && completed,
        prize: SECRET_MISSION_PRIZE,
        instagram: SECRET_MISSION_INSTAGRAM,
        entry: secret
          ? {
              status: secret.status as (typeof SECRET_ENTRY_STATUSES)[number],
              instagramId: secret.instagramId,
              createdAt: secret.createdAt.toISOString(),
              adminNote: secret.status === 'rejected' ? secret.adminNote : null,
            }
          : null,
      },
      /** 지급 신청 칸 미리 채우기 */
      phone: u.phone || '',
      name: u.name || '',
    };
  }

  /** 시크릿 미션 응모 — 인스타 아이디만(261118). 계정당 1번(반려면 다시), 같은 아이디로 다른 계정은 안 됨(반려된 응모는 빼고) */
  async enterSecret(userId: string, rawInstagramId: unknown) {
    const st = await this.status(userId);
    if (!st.eligible) throw new ForbiddenException('신규 가입 미션 참여자만 응모할 수 있어요.');
    if (!st.completed) throw new BadRequestException('5,000원 미션을 모두 마치면 참여할 수 있어요.');
    if (st.secret.entry && st.secret.entry.status !== 'rejected') throw new BadRequestException('이미 응모했어요.');
    const input = parseInstagramId(rawInstagramId);
    if (typeof input === 'string') throw new BadRequestException(input);
    const dup = await this.prisma.welcomeSecretEntry.findFirst({
      where: { userId: { not: userId }, instagramId: input.instagramId, status: { not: 'rejected' } },
      select: { id: true },
    });
    if (dup) throw new BadRequestException('이미 다른 계정으로 응모한 인스타그램 아이디예요.');
    await this.prisma.welcomeSecretEntry.upsert({
      where: { userId },
      create: { userId, instagramId: input.instagramId },
      update: { instagramId: input.instagramId, imageUrl: null, thumbUrl: null, status: 'entered', adminNote: null, wonAt: null },
    });
    this.notifications
      .createNotification(userId, 'system' as any, '시크릿 미션 응모 완료', `${SECRET_MISSION_PRIZE} 추첨 결과는 알림으로 알려 드릴게요.`, {
        type: 'welcome_secret_entered',
        url: '/my/mission',
      })
      .catch(() => undefined);
    return this.status(userId);
  }

  /** 오늘 출석 — 미션 화면을 열 때. 처음 찍힌 날이면 justCheckedIn(화면이 'N일째' 연출을 띄운다) */
  async checkin(userId: string) {
    const u = await this.user(userId);
    if (!isWelcomeMissionUser(u)) return { ...(await this.status(userId)), justCheckedIn: false };
    const day = kstDay();
    let justCheckedIn = false;
    try {
      await this.prisma.userAttendance.create({ data: { userId, day } });
      justCheckedIn = true;
    } catch (e: any) {
      if (e?.code !== 'P2002') throw e; // 이미 오늘 출석 — 그대로
    }
    return { ...(await this.status(userId)), justCheckedIn };
  }

  /** 지급 신청 — 미션을 다 했을 때만. 반려된 신청은 고쳐서 다시 낼 수 있다 */
  async claim(userId: string, body: unknown) {
    const st = await this.status(userId);
    if (!st.eligible) throw new ForbiddenException('신규 가입자만 참여할 수 있는 미션이에요.');
    if (!st.completed) throw new BadRequestException('미션을 모두 마치면 신청할 수 있어요.');
    if (st.claim && st.claim.status !== 'rejected') throw new BadRequestException('이미 신청했어요.');
    const input = parseWelcomeClaim(body);
    if (typeof input === 'string') throw new BadRequestException(input);
    // 같은 연락처 · 계좌로 다른 계정이 또 받지 못하게(반려된 신청은 빼고)
    const dup = await this.prisma.welcomeMissionClaim.findFirst({
      where: {
        userId: { not: userId },
        status: { not: 'rejected' },
        OR: [{ phone: input.phone }, { accountNumber: input.accountNumber }],
      },
      select: { id: true },
    });
    if (dup) throw new BadRequestException('이미 다른 계정으로 신청된 연락처나 계좌예요.');
    const claim = await this.prisma.welcomeMissionClaim.upsert({
      where: { userId },
      create: { userId, rewardAmount: WELCOME_MISSION_REWARD, ...input },
      update: { ...input, rewardAmount: WELCOME_MISSION_REWARD, status: 'pending', adminNote: null, paidAt: null },
    });
    this.notifications
      .createNotification(userId, 'system' as any, '5,000원 지급 신청이 접수됐어요', '확인 후 입력하신 계좌로 보내 드릴게요.', {
        type: 'welcome_mission_claim_submitted',
        claimId: claim.id,
      })
      .catch(() => undefined);
    return this.status(userId);
  }

  // ─── 어드민 ───

  async adminList(params: { status?: string; q?: string }) {
    const status = CLAIM_STATUSES.includes(params.status as any) ? params.status : undefined;
    const q = params.q?.trim();
    const claims = await this.prisma.welcomeMissionClaim.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(q ? { OR: [{ accountHolder: { contains: q } }, { phone: { contains: q.replace(/[^0-9]/g, '') || q } }] } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
    const users = await this.prisma.user.findMany({
      where: { id: { in: claims.map((c) => c.userId) } },
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    });
    const byId = new Map(users.map((u) => [u.id, u]));
    const [counts, participants] = await Promise.all([
      this.prisma.welcomeMissionClaim.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.userAttendance.groupBy({ by: ['userId'], _count: { _all: true } }),
    ]);
    return {
      summary: {
        participants: participants.length,
        pending: counts.find((c) => c.status === 'pending')?._count._all ?? 0,
        paid: counts.find((c) => c.status === 'paid')?._count._all ?? 0,
        rejected: counts.find((c) => c.status === 'rejected')?._count._all ?? 0,
      },
      claims: claims.map((c) => ({
        id: c.id,
        userId: c.userId,
        user: byId.get(c.userId) ?? null,
        rewardAmount: c.rewardAmount,
        phone: c.phone,
        bankName: c.bankName,
        accountNumber: c.accountNumber,
        accountHolder: c.accountHolder,
        status: c.status,
        adminNote: c.adminNote,
        paidAt: c.paidAt?.toISOString() ?? null,
        createdAt: c.createdAt.toISOString(),
      })),
    };
  }

  /** 어드민 — 시크릿 미션 응모 목록(최신순 500) */
  async adminSecretList(params: { status?: string; q?: string }) {
    const status = SECRET_ENTRY_STATUSES.includes(params.status as any) ? params.status : undefined;
    const q = params.q?.trim().replace(/^@+/, '');
    const entries = await this.prisma.welcomeSecretEntry.findMany({
      where: { ...(status ? { status } : {}), ...(q ? { instagramId: { contains: q.toLowerCase() } } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
    const users = await this.prisma.user.findMany({
      where: { id: { in: entries.map((e) => e.userId) } },
      select: { id: true, name: true, email: true, phone: true, role: true },
    });
    const byId = new Map(users.map((u) => [u.id, u]));
    const counts = await this.prisma.welcomeSecretEntry.groupBy({ by: ['status'], _count: { _all: true } });
    const n = (s: string) => counts.find((c) => c.status === s)?._count._all ?? 0;
    return {
      summary: { total: n('entered') + n('won') + n('rejected'), entered: n('entered'), won: n('won'), rejected: n('rejected') },
      entries: entries.map((e) => ({
        id: e.id,
        userId: e.userId,
        user: byId.get(e.userId) ?? null,
        instagramId: e.instagramId,
        imageUrl: e.imageUrl,
        thumbUrl: e.thumbUrl,
        status: e.status,
        adminNote: e.adminNote,
        wonAt: e.wonAt?.toISOString() ?? null,
        createdAt: e.createdAt.toISOString(),
      })),
    };
  }

  /** 어드민 — 당첨 · 반려 · 되돌리기. 당첨/반려로 바뀔 때만 알림 */
  async adminSecretUpdate(id: string, body: { status?: string; adminNote?: string }) {
    const status = body.status;
    if (!SECRET_ENTRY_STATUSES.includes(status as any)) throw new BadRequestException('상태가 올바르지 않아요.');
    const prev = await this.prisma.welcomeSecretEntry.findUnique({ where: { id } });
    if (!prev) throw new NotFoundException('응모를 찾을 수 없어요.');
    const adminNote = typeof body.adminNote === 'string' ? body.adminNote.trim().slice(0, 300) || null : prev.adminNote;
    const entry = await this.prisma.welcomeSecretEntry.update({
      where: { id },
      data: { status, adminNote, wonAt: status === 'won' ? prev.wonAt ?? new Date() : null },
    });
    if (prev.status !== status && (status === 'won' || status === 'rejected')) {
      const [title, text, url] =
        status === 'won'
          ? ['시크릿 미션에 당첨됐어요', `축하해요! ${SECRET_MISSION_PRIZE}를 보내 드릴게요. 받으실 곳은 따로 연락드릴게요.`, '/my/mission']
          : ['시크릿 미션 응모를 다시 확인해 주세요', entry.adminNote || `스토리에서 @${SECRET_MISSION_INSTAGRAM} 태그를 찾지 못했어요. 스토리를 올리고 다시 응모해 주세요.`, '/my/mission/secret'];
      this.notifications
        .createNotification(entry.userId, 'system' as any, title, text, { type: `welcome_secret_${status}`, entryId: entry.id, url })
        .catch((e) => this.logger.warn(`notify failed: ${e?.message}`));
    }
    return { ok: true, status: entry.status, wonAt: entry.wonAt?.toISOString() ?? null };
  }

  async adminUpdate(id: string, body: { status?: string; adminNote?: string }) {
    const status = body.status;
    if (!CLAIM_STATUSES.includes(status as any)) throw new BadRequestException('상태가 올바르지 않아요.');
    const prev = await this.prisma.welcomeMissionClaim.findUnique({ where: { id } });
    if (!prev) throw new NotFoundException('신청을 찾을 수 없어요.');
    const adminNote = typeof body.adminNote === 'string' ? body.adminNote.trim().slice(0, 300) || null : prev.adminNote;
    const claim = await this.prisma.welcomeMissionClaim.update({
      where: { id },
      data: { status, adminNote, paidAt: status === 'paid' ? prev.paidAt ?? new Date() : null },
    });
    if (prev.status !== status && (status === 'paid' || status === 'rejected')) {
      const [title, text] =
        status === 'paid'
          ? ['5,000원을 보냈어요', `${claim.bankName} 계좌로 미션 보상 5,000원을 보냈어요.`]
          : ['지급 신청을 다시 확인해 주세요', claim.adminNote || '입력하신 정보를 확인할 수 없어요. 미션 화면에서 다시 신청해 주세요.'];
      this.notifications
        .createNotification(claim.userId, 'system' as any, title, text, { type: `welcome_mission_claim_${status}`, claimId: claim.id })
        .catch((e) => this.logger.warn(`notify failed: ${e?.message}`));
    }
    return { ok: true, status: claim.status, paidAt: claim.paidAt?.toISOString() ?? null };
  }
}

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import type { MatchAlimtalkDelivery, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { isTestLeadUserId } from '../match/test-lead';
import { MatchAlimtalkProvider } from './match-alimtalk-provider';
import { chatAlimtalkKind, isMatchAlimtalkKind, isReminder, koreanMobile, nextReminderHour, reminderDecision, type MatchAlimtalkContext, type MatchAlimtalkKind } from './match-alimtalk-policy';

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;
const REQUEST = {
  id: true, userId: true, status: true, rawUserInput: true, eventDate: true, eventTime: true, eventLocation: true,
  category: { select: { name: true } }, eventCategory: { select: { name: true } }, user: { select: { name: true } },
} as const;
type RequestInfo = Prisma.MatchRequestGetPayload<{ select: typeof REQUEST }>;
type Job = MatchAlimtalkDelivery & { kind: MatchAlimtalkKind };
type Target = { phone: string; context: MatchAlimtalkContext };
const notice: Record<MatchAlimtalkKind, string> = {
  request_received: '사회자 섭외 신청이 접수되었습니다.',
  pro_message: '사회자 메시지가 도착했습니다.',
  unread_reminder: '아직 확인하지 않은 사회자 메시지가 있습니다.',
  no_reply_reminder: '사회자에게 답장이 필요한 대화가 있습니다.',
  new_quote_request: '새로운 견적 요청이 도착했습니다.',
  customer_reply: '고객의 답장이 도착했습니다.',
};

function metadata(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function validRequest(request: RequestInfo) {
  return request.status !== 'cancelled' && request.status !== 'expired' &&
    !isTestLeadUserId(request.userId) && metadata(request.rawUserInput).suppressedAsTestLead !== true;
}

@Injectable()
export class MatchAlimtalkService implements OnModuleInit {
  private readonly logger = new Logger(MatchAlimtalkService.name);
  private draining = false;
  private queued = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly provider: MatchAlimtalkProvider,
  ) {}

  get enabled() { return this.provider.missingSettings().length === 0; }

  onModuleInit() {
    const missing = this.provider.missingSettings();
    if (missing.length) this.logger.log(`SOLAPI matching Alimtalk inactive: ${missing.join(', ')}`);
    else this.logger.log('SOLAPI matching Alimtalk enabled');
  }

  private delay(key: string, fallback: number) {
    const minutes = Number(this.config.get<string>(key));
    return (Number.isInteger(minutes) && minutes >= 15 && minutes <= 2880 ? minutes : fallback) * MINUTE;
  }

  private get replyDelay() { return this.delay('SOLAPI_MATCH_NO_REPLY_MINUTES', 1440); }

  async enqueue(kind: 'request_received' | 'new_quote_request', userId: string, requestId: string) {
    if (!this.enabled || !userId || !requestId || isTestLeadUserId(userId)) return;
    await this.insert([{ kind, userId, subjectId: requestId, dueAt: new Date() }]);
  }

  async enqueueChat(userId: string, roomId: string, messageId: string) {
    if (!this.enabled || isTestLeadUserId(userId)) return;
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      select: { roomId: true, senderId: true, type: true, createdAt: true, isDeleted: true, metadata: true, room: {
        select: { userId: true, proProfile: { select: { userId: true } } },
      } },
    });
    if (!message || message.roomId !== roomId || message.isDeleted || message.type === 'system' ||
        isTestLeadUserId(message.senderId) || Number(metadata(message.metadata).autoReplyPart || 0) > 0) return;
    const kind = chatAlimtalkKind(message.senderId, userId, message.room.userId, message.room.proProfile.userId);
    if (!kind) return;
    const jobs: { kind: MatchAlimtalkKind; userId: string; subjectId: string; dueAt: Date }[] = [
      { kind, userId, subjectId: messageId, dueAt: message.createdAt },
    ];
    if (kind === 'pro_message') {
      jobs.push(
        { kind: 'unread_reminder', userId, subjectId: messageId, dueAt: new Date(message.createdAt.getTime() + this.delay('SOLAPI_MATCH_UNREAD_MINUTES', 60)) },
        { kind: 'no_reply_reminder', userId, subjectId: messageId, dueAt: new Date(message.createdAt.getTime() + this.replyDelay) },
      );
    }
    await this.insert(jobs);
  }

  private async insert(jobs: { kind: MatchAlimtalkKind; userId: string; subjectId: string; dueAt: Date }[]) {
    await this.prisma.matchAlimtalkDelivery.createMany({
      data: jobs.map(job => ({ ...job, id: `${job.kind}:${job.userId}:${job.subjectId}` })),
      skipDuplicates: true,
    });
    if (this.queued || this.draining) return;
    this.queued = true;
    setImmediate(() => {
      this.queued = false;
      void this.drain();
    });
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async drain() {
    if (!this.enabled || this.draining) return;
    this.draining = true;
    try {
      const jobs = await this.prisma.matchAlimtalkDelivery.findMany({
        where: { status: 'pending', dueAt: { lte: new Date() } },
        orderBy: [{ dueAt: 'asc' }, { id: 'asc' }], take: 40,
      });
      for (let i = 0; i < jobs.length; i += 5) {
        await Promise.all(jobs.slice(i, i + 5).map(async job => {
          if (!isMatchAlimtalkKind(job.kind)) return;
          try { await this.process({ ...job, kind: job.kind }); }
          catch { this.logger.warn(`SOLAPI job processing failed kind=${job.kind}`); }
        }));
      }
    } catch {
      this.logger.warn('SOLAPI delivery queue unavailable');
    } finally {
      this.draining = false;
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_4AM, { timeZone: 'Asia/Seoul' })
  async cleanHistory() {
    if (!this.enabled) return;
    await this.prisma.matchAlimtalkDelivery.deleteMany({ where: { updatedAt: { lt: new Date(Date.now() - 30 * DAY) } } })
      .catch(() => this.logger.warn('SOLAPI delivery history cleanup failed'));
  }

  private async claim(job: Job, now: Date) {
    const cooldown = isReminder(job.kind) ? DAY : ['pro_message', 'customer_reply'].includes(job.kind) ? 10 * MINUTE : 0;
    return this.prisma.$transaction(async tx => {
      if (cooldown) {
        const key = `match-alimtalk:${job.userId}:${job.kind}`;
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`;
        const previous = await tx.matchAlimtalkDelivery.findFirst({
          where: { id: { not: job.id }, userId: job.userId, kind: job.kind, status: { in: ['accepted', 'processing'] }, updatedAt: { gte: new Date(now.getTime() - cooldown) } },
          select: { id: true },
        });
        if (previous) {
          await tx.matchAlimtalkDelivery.updateMany({ where: { id: job.id, status: 'pending' }, data: { status: 'skipped', reason: 'cooldown' } });
          return false;
        }
      }
      const { count } = await tx.matchAlimtalkDelivery.updateMany({
        where: { id: job.id, status: 'pending', dueAt: { lte: now } },
        data: { status: 'processing' },
      });
      return count === 1;
    });
  }

  private async process(job: Job) {
    const now = new Date();
    const reminder = isReminder(job.kind);
    const quietUntil = reminder ? nextReminderHour(now) : null;
    const target = now.getTime() - job.createdAt.getTime() > (reminder ? 3 * DAY : 2 * 60 * MINUTE)
      ? null : quietUntil ?? await this.target(job, now);
    if (target instanceof Date) {
      await this.prisma.matchAlimtalkDelivery.updateMany({ where: { id: job.id, status: 'pending' }, data: { dueAt: target } });
      return;
    }
    if (!target) {
      await this.prisma.matchAlimtalkDelivery.updateMany({ where: { id: job.id, status: 'pending' }, data: { status: 'skipped', reason: 'recipient_or_state_changed' } });
      return;
    }
    if (!(await this.claim(job, now))) return;
    const result = await this.provider.send(job.kind, target.phone, target.context, async () => {
      if (reminder && nextReminderHour(new Date())) return false;
      const latest = await this.target(job, new Date());
      return !!latest && !(latest instanceof Date) && latest.phone === target.phone;
    }).catch(() => ({ status: 'failed', reason: 'processing_error' } as const));
    await this.prisma.matchAlimtalkDelivery.update({
      where: { id: job.id },
      data: {
        status: result.status,
        providerId: result.status === 'accepted' ? result.providerId : null,
        reason: result.status === 'accepted' ? null : result.reason,
      },
    });
    if (result.status === 'failed') this.logger.warn(`SOLAPI ${job.kind}: ${result.reason}${'unknown' in result && result.unknown?.length ? ` (${result.unknown.join(', ')})` : ''}`);
  }

  private context(job: Job, recipientName: string, customerName: string, proName: string, request: RequestInfo | null, path: string, roomId = ''): MatchAlimtalkContext {
    return {
      recipientName, customerName, proName, path, roomId, requestId: request?.id ?? '',
      category: request?.eventCategory?.name ?? request?.category.name ?? '사회자 섭외',
      eventDate: request?.eventDate?.toISOString().slice(0, 10).replace(/-/g, '.') ?? '미정',
      eventTime: request?.eventTime?.toISOString().slice(11, 16) ?? '미정',
      eventLocation: request?.eventLocation?.trim() || '미정',
      notice: notice[job.kind],
    };
  }

  private async target(job: Job, now: Date): Promise<Target | Date | null> {
    if (isTestLeadUserId(job.userId)) return null;
    const user = await this.prisma.user.findUnique({
      where: { id: job.userId },
      select: {
        phone: true, name: true, isActive: true, isBanned: true, deletedAt: true, mergedToUserId: true,
        notificationSettings: { select: { chatPush: true, systemPush: true } },
      },
    });
    const phone = koreanMobile(user?.phone);
    if (!user?.isActive || user.isBanned || user.deletedAt || user.mergedToUserId || !phone) return null;
    const matchEvent = job.kind === 'request_received' || job.kind === 'new_quote_request';
    if (user.notificationSettings?.[matchEvent ? 'systemPush' : 'chatPush'] === false) return null;
    if (matchEvent) {
      const request = await this.prisma.matchRequest.findUnique({ where: { id: job.subjectId }, select: REQUEST });
      if (!request || !validRequest(request)) return null;
      if (job.kind === 'request_received' ? request.userId !== job.userId : request.userId === job.userId) return null;
      if (job.kind === 'new_quote_request') {
        const delivery = await this.prisma.matchDelivery.findFirst({
          where: { matchRequestId: request.id, proProfile: { userId: job.userId }, status: { in: ['pending', 'viewed', 'replied'] } }, select: { id: true },
        });
        if (!delivery) return null;
      }
      const path = job.kind === 'request_received' ? '/inquiries' : '/pro-dashboard/inquiries';
      return { phone, context: this.context(job, user.name, request.user.name, job.kind === 'new_quote_request' ? user.name : '사회자', request, path) };
    }

    const message = await this.prisma.message.findUnique({
      where: { id: job.subjectId },
      select: { id: true, senderId: true, createdAt: true, isDeleted: true, type: true, metadata: true,
        room: { select: { id: true, userId: true, userDeletedAt: true, proDeletedAt: true,
          user: { select: { name: true } }, proProfile: { select: { userId: true, user: { select: { name: true } } } },
          matchRequest: { select: REQUEST },
          members: { where: { userId: job.userId }, select: { isMuted: true, lastReadAt: true } },
        } },
      },
    });
    if (!message || message.isDeleted || message.type === 'system' || isTestLeadUserId(message.senderId)) return null;
    const { room } = message;
    if (room.matchRequest && !validRequest(room.matchRequest)) return null;
    const senderKind = chatAlimtalkKind(message.senderId, job.userId, room.userId, room.proProfile.userId);
    if (senderKind !== (isReminder(job.kind) ? 'pro_message' : job.kind)) return null;
    if (job.userId === room.userId ? room.userDeletedAt : room.proDeletedAt) return null;
    const member = room.members[0];
    if (!member || member.isMuted) return null;

    if (isReminder(job.kind)) {
      const [latest, paid] = await Promise.all([
        this.prisma.message.findFirst({
          where: { roomId: room.id, isDeleted: false, type: { not: 'system' } },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], select: { id: true, senderId: true, createdAt: true, metadata: true },
        }),
        this.prisma.quotation.findFirst({ where: { chatRoomId: room.id, status: 'paid' }, select: { id: true } }),
      ]);
      if (!latest || paid || latest.senderId !== message.senderId) return null;
      const latestMeta = metadata(latest.metadata);
      // A segmented automated reply belongs to the first message for scheduling.
      const sameReply = Number(latestMeta.autoReplyPart || 0) > 0 && latestMeta.autoReplyId &&
        latestMeta.autoReplyId === metadata(message.metadata).autoReplyId &&
        Math.abs(latest.createdAt.getTime() - message.createdAt.getTime()) < MINUTE;
      if (latest.id !== message.id && !sameReply) return null;
      if (sameReply && await this.prisma.message.findFirst({
        where: { roomId: room.id, senderId: job.userId, createdAt: { gt: message.createdAt }, type: { not: 'system' }, isDeleted: false }, select: { id: true },
      })) return null;
      const readAt = member.lastReadAt && member.lastReadAt >= latest.createdAt ? member.lastReadAt : null;
      if (job.kind === 'no_reply_reminder' && !readAt) return new Date(now.getTime() + 60 * MINUTE);
      const decision = reminderDecision(job.kind, readAt, now, this.replyDelay);
      if (decision !== 'send') return decision === 'skip' ? null : decision;
    } else if (member.lastReadAt && member.lastReadAt >= message.createdAt) {
      return null;
    }
    return { phone, context: this.context(job, user.name, room.user.name, room.proProfile.user.name, room.matchRequest, `/chat/${encodeURIComponent(room.id)}`, room.id) };
  }
}

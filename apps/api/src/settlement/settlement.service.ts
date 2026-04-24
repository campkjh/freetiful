import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';
import { SettlementStatus } from '@prisma/client';

@Injectable()
export class SettlementService {
  private readonly logger = new Logger(SettlementService.name);

  constructor(
    private prisma: PrismaService,
    private notification: NotificationService,
  ) {}

  /** 프로 본인의 정산 로그 조회 */
  async getMyLogs(userId: string, params?: { status?: SettlementStatus; page?: number; limit?: number }) {
    const profile = await this.prisma.proProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!profile) return { data: [], meta: { total: 0, pending: 0, settled: 0, totalAmount: 0, pendingAmount: 0, settledAmount: 0 } };

    const where: any = { proProfileId: profile.id };
    if (params?.status) where.status = params.status;

    const [rawData, totalCount, aggregates] = await Promise.all([
      this.prisma.settlementLog.findMany({
        where,
        include: {
          payment: {
            include: {
              quotations: { orderBy: { createdAt: 'desc' }, take: 1 },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: params?.limit || 50,
        skip: ((params?.page || 1) - 1) * (params?.limit || 50),
      }),
      this.prisma.settlementLog.count({ where }),
      this.prisma.settlementLog.groupBy({
        by: ['status'],
        where: { proProfileId: profile.id },
        _sum: { netAmount: true },
        _count: true,
      }),
    ]);

    // Payment → user 관계가 스키마에 없어서 별도로 User 조회 후 머지
    const userIds = Array.from(new Set(rawData.map((r) => r.payment.userId)));
    const users = userIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, name: true },
        })
      : [];
    const userMap = new Map(users.map((u) => [u.id, u]));
    const data = rawData.map((r) => ({
      ...r,
      payment: { ...r.payment, user: userMap.get(r.payment.userId) || null },
    }));

    const pendingAgg = aggregates.find((a) => a.status === 'pending');
    const settledAgg = aggregates.find((a) => a.status === 'settled');
    const pendingAmount = pendingAgg?._sum.netAmount || 0;
    const settledAmount = settledAgg?._sum.netAmount || 0;

    return {
      data,
      meta: {
        total: totalCount,
        pending: pendingAgg?._count || 0,
        settled: settledAgg?._count || 0,
        totalAmount: pendingAmount + settledAmount,
        pendingAmount,
        settledAmount,
      },
    };
  }

  /** 관리자 — 전체 정산 로그 목록 */
  async adminList(params?: { status?: SettlementStatus; proProfileId?: string; page?: number; limit?: number }) {
    const where: any = {};
    if (params?.status) where.status = params.status;
    if (params?.proProfileId) where.proProfileId = params.proProfileId;

    const limit = params?.limit || 30;
    const page = params?.page || 1;

    const [rawData, total, aggregates] = await Promise.all([
      this.prisma.settlementLog.findMany({
        where,
        include: {
          proProfile: {
            select: {
              id: true,
              user: { select: { id: true, name: true, email: true } },
            },
          },
          payment: {
            select: {
              id: true,
              userId: true,
              amount: true,
              createdAt: true,
              quotations: { select: { title: true, eventDate: true }, orderBy: { createdAt: 'desc' }, take: 1 },
            },
          },
          settledBy: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: (page - 1) * limit,
      }),
      this.prisma.settlementLog.count({ where }),
      this.prisma.settlementLog.groupBy({
        by: ['status'],
        _sum: { netAmount: true },
        _count: true,
      }),
    ]);

    // Payment.user 관계가 스키마에 없어서 별도 쿼리로 User 머지
    const userIds = Array.from(new Set(rawData.map((r) => r.payment.userId)));
    const users = userIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, name: true },
        })
      : [];
    const userMap = new Map(users.map((u) => [u.id, u]));
    const data = rawData.map((r) => ({
      ...r,
      payment: { ...r.payment, user: userMap.get(r.payment.userId) || null },
    }));

    const summary = {
      pendingCount: aggregates.find((a) => a.status === 'pending')?._count || 0,
      pendingAmount: aggregates.find((a) => a.status === 'pending')?._sum.netAmount || 0,
      settledCount: aggregates.find((a) => a.status === 'settled')?._count || 0,
      settledAmount: aggregates.find((a) => a.status === 'settled')?._sum.netAmount || 0,
    };

    return { data, meta: { total, page, limit, hasMore: page * limit < total }, summary };
  }

  /** 관리자가 특정 정산을 "정산완료" 로 표시 */
  async markSettled(id: string, adminUserId: string, note?: string) {
    const log = await this.prisma.settlementLog.findUnique({
      where: { id },
      include: {
        proProfile: { select: { userId: true, user: { select: { name: true } } } },
      },
    });
    if (!log) throw new NotFoundException('정산 로그를 찾을 수 없습니다');
    if (log.status === 'settled') {
      throw new BadRequestException('이미 정산 완료된 내역입니다');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const upd = await tx.settlementLog.update({
        where: { id },
        data: {
          status: 'settled',
          settledAt: new Date(),
          settledByUserId: adminUserId,
          note: note || undefined,
        },
      });
      // Payment.settledAt 도 동기화
      await tx.payment.update({
        where: { id: log.paymentId },
        data: { settledAt: upd.settledAt },
      });
      return upd;
    });

    // 전문가에게 알림
    if (log.proProfile?.userId) {
      this.notification.createNotification(
        log.proProfile.userId,
        'payment' as any,
        '정산이 완료되었습니다 💰',
        `${log.netAmount.toLocaleString()}원이 정산 처리되었습니다.`,
        { settlementLogId: id, paymentId: log.paymentId },
      ).catch(() => {});
    }

    return updated;
  }

  /** 관리자가 정산을 취소 (실수 복구) */
  async unmarkSettled(id: string) {
    const log = await this.prisma.settlementLog.findUnique({ where: { id } });
    if (!log) throw new NotFoundException('정산 로그를 찾을 수 없습니다');
    return this.prisma.$transaction(async (tx) => {
      const upd = await tx.settlementLog.update({
        where: { id },
        data: { status: 'pending', settledAt: null, settledByUserId: null },
      });
      await tx.payment.update({
        where: { id: log.paymentId },
        data: { settledAt: null },
      });
      return upd;
    });
  }
}

import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';
import { SettlementStatus } from '@prisma/client';
import { PAYMENT_EVENT_QUOTATION_SELECT, paymentEventOf } from '../payment/payment-event';
import { paymentPaidAt } from '../payment/refund-policy';

/** 이름 가운데 가리기 — '김하늘' → '김*늘' · '김솔' → '김*' (빌지는 이미지로 카톡 공유되므로 고객 이름을 다 싣지 않는다) */
export function maskName(raw?: string | null): string {
  const name = String(raw ?? '').trim();
  if (!name) return '고객';
  const chars = Array.from(name);
  if (chars.length <= 1) return chars[0] + '*';
  if (chars.length === 2) return `${chars[0]}*`;
  return `${chars[0]}${'*'.repeat(Math.min(3, chars.length - 2))}${chars[chars.length - 1]}`;
}

@Injectable()
export class SettlementService {
  private readonly logger = new Logger(SettlementService.name);

  constructor(
    private prisma: PrismaService,
    private notification: NotificationService,
  ) {}

  private buildDateRange(params?: { startDate?: string; endDate?: string }) {
    const range: any = {};
    if (params?.startDate) {
      const start = this.parseAdminDate(params.startDate, false);
      if (!Number.isNaN(start.getTime())) {
        range.gte = start;
      }
    }
    if (params?.endDate) {
      const end = this.parseAdminDate(params.endDate, true);
      if (!Number.isNaN(end.getTime())) {
        range.lte = end;
      }
    }
    return Object.keys(range).length ? range : undefined;
  }

  private parseAdminDate(value: string, endOfDay: boolean) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return new Date(`${value}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}+09:00`);
    }
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      date.setHours(endOfDay ? 23 : 0, endOfDay ? 59 : 0, endOfDay ? 59 : 0, endOfDay ? 999 : 0);
    }
    return date;
  }

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
  async adminList(params?: { status?: SettlementStatus; proProfileId?: string; page?: number; limit?: number; startDate?: string; endDate?: string }) {
    const where: any = {};
    if (params?.status) where.status = params.status;
    if (params?.proProfileId) where.proProfileId = params.proProfileId;
    const dateRange = this.buildDateRange(params);
    if (dateRange) where.createdAt = dateRange;

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
              // 결제 당시 입력받은 연락처 — 계정 번호보다 우선한다
              customerPhone: true,
              // 어떤 행사였는지(261004 사장 '정산내역에 사회자가 어디서 어떤 고객과 행사를 했는지') — payment-event.ts
              quotations: {
                select: PAYMENT_EVENT_QUOTATION_SELECT,
                orderBy: { createdAt: 'desc' },
                take: 1,
              },
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
        where,
        _sum: { netAmount: true },
        _count: true,
      }),
    ]);

    // Payment.user 관계가 스키마에 없어서 별도 쿼리로 User 머지
    const userIds = Array.from(new Set(rawData.map((r) => r.payment.userId)));
    const users = userIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: userIds } },
          // phone — 어드민 정산내역의 고객 연락처 표시·엑셀 내보내기에 사용
          // (관리자 전용 목록이라 여기서만 노출. getMyLogs 는 프로 본인 조회라 제외)
          select: { id: true, name: true, phone: true },
        })
      : [];
    const userMap = new Map(users.map((u) => [u.id, u]));
    const data = rawData.map((r) => {
      const user = userMap.get(r.payment.userId) || null;
      return {
        ...r,
        payment: {
          ...r.payment,
          // 화면 호환 — 옛 화면은 quotations[0].title·eventDate 를 읽는다(chatRoom 묶음은 event 로 풀어 주고 뺀다)
          quotations: (r.payment.quotations || []).map(({ chatRoom: _chatRoom, ...rest }) => rest),
          user,
          // 표시용 최종 연락처 — 결제 시 입력값 우선, 없으면(연락처 도입 이전 결제분) 계정 번호로 폴백
          customerPhone: r.payment.customerPhone || user?.phone || null,
          event: paymentEventOf(r.payment.quotations?.[0]),
        },
      };
    });

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

    // 전문가에게 알림 — 누르면 정산 명세서(빌지, 이미지로 카톡 공유 가능 — 261005 사장)
    if (log.proProfile?.userId) {
      this.notification.createNotification(
        log.proProfile.userId,
        'payment' as any,
        '정산이 완료되었습니다 💰',
        `${log.netAmount.toLocaleString()}원이 정산 처리되었습니다. 눌러서 정산 명세서를 확인해 보세요.`,
        { settlementLogId: id, paymentId: log.paymentId, link: `/my/settlement/${id}` },
      ).catch(() => {});
    }

    return updated;
  }

  /**
   * 정산 명세서(빌지) — 사회자 본인(userId) 또는 관리자(admin). 정산하기 뒤 관리자 화면·사회자 푸시에서 열고 이미지로 카톡 공유한다(261005).
   *  고객 이름은 가운데를 가리고(maskName) 연락처는 싣지 않는다. 관리자 메모(note)는 관리자에게만.
   *  남의 정산 id 를 넣으면 '없음'으로 답한다(있는지 여부도 알려 주지 않게).
   */
  async getBill(id: string, viewer: { userId?: string; admin?: boolean }) {
    const log = await this.prisma.settlementLog.findUnique({
      where: { id },
      include: {
        proProfile: { select: { userId: true, user: { select: { name: true } } } },
        payment: {
          select: {
            userId: true,
            amount: true,
            method: true,
            createdAt: true,
            updatedAt: true,
            quotations: { select: PAYMENT_EVENT_QUOTATION_SELECT, orderBy: { createdAt: 'desc' }, take: 1 },
          },
        },
      },
    });
    if (!log || (!viewer.admin && (!viewer.userId || log.proProfile?.userId !== viewer.userId))) {
      throw new NotFoundException('정산 내역을 찾을 수 없습니다');
    }
    const customer = await this.prisma.user.findUnique({ where: { id: log.payment.userId }, select: { name: true } });
    return {
      id: log.id,
      /** 명세서 번호 — 정산 id 앞 10자리 */
      no: log.id.replace(/-/g, '').slice(0, 10).toUpperCase(),
      status: log.status,
      proName: log.proProfile?.user?.name || '사회자',
      customerName: maskName(customer?.name),
      event: paymentEventOf(log.payment.quotations?.[0]),
      amount: log.amount,
      platformFee: log.platformFee,
      netAmount: log.netAmount,
      method: log.payment.method || null,
      paidAt: paymentPaidAt(log.payment),
      settledAt: log.settledAt,
      createdAt: log.createdAt,
      ...(viewer.admin ? { note: log.note || null } : {}),
    };
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

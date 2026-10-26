import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';
import { SettlementStatus } from '@prisma/client';
import { PAYMENT_EVENT_QUOTATION_SELECT, paymentEventOf } from '../payment/payment-event';
import { paymentPaidAt } from '../payment/refund-policy';
import { matchesAdminSearch, needsEventKeys, parseAdminPaySort, parseAdminSearch, sortAndPage } from '../payment/admin-list';

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
  async adminList(params?: { status?: SettlementStatus; proProfileId?: string; page?: number; limit?: number; startDate?: string; endDate?: string; search?: string; sort?: string }) {
    const where: any = {};
    if (params?.status) where.status = params.status;
    if (params?.proProfileId) where.proProfileId = params.proProfileId;
    const dateRange = this.buildDateRange(params);
    if (dateRange) where.createdAt = dateRange;

    // 상한 1000 — 어드민 홈 대체 통계(fetchFallbackStats)가 limit=1000 한 번에 받는다
    const limit = Math.min(Math.max(Number(params?.limit) || 30, 1), 1000);
    const page = Math.max(1, Number(params?.page) || 1);

    // 돋보기 검색 · 결제일/예식일 정렬(261026) — 계산값이라 키만 받아 거르고·정렬한 뒤 그 페이지 줄만 자세히(payment/admin-list.ts).
    // 위 요약(대기·완료 건수·금액)도 검색 결과 기준으로 같이 센다.
    const sort = parseAdminPaySort(params?.sort);
    const sq = parseAdminSearch(params?.search);
    const withEvent = needsEventKeys(sort, sq);
    const keyRows: any[] = await this.prisma.settlementLog.findMany({
      where,
      select: {
        id: true,
        status: true,
        netAmount: true,
        createdAt: true,
        proProfile: { select: { user: { select: { name: true } } } },
        payment: {
          select: {
            id: true,
            userId: true,
            method: true,
            createdAt: true,
            updatedAt: true,
            customerPhone: true,
            pgTransactionId: true,
            ...(withEvent ? { quotations: { select: PAYMENT_EVENT_QUOTATION_SELECT, orderBy: { createdAt: 'desc' as const }, take: 1 } } : {}),
          },
        },
      },
    });
    let matched = keyRows;
    if (sq) {
      const qUsers = await this.prisma.user.findMany({
        where: { id: { in: [...new Set(keyRows.map((r) => r.payment.userId))] } },
        select: { id: true, name: true, phone: true },
      });
      const qUserMap = new Map(qUsers.map((u) => [u.id, u]));
      matched = keyRows.filter((r) => {
        const u = qUserMap.get(r.payment.userId);
        const ev = paymentEventOf(r.payment.quotations?.[0]);
        return matchesAdminSearch(sq, {
          texts: [u?.name, r.proProfile?.user?.name, ev.title, ev.kind, ev.location],
          phones: [r.payment.customerPhone, u?.phone],
          ids: [r.id, r.payment.id, r.payment.pgTransactionId],
        });
      });
    }
    const total = matched.length;
    const summary = { pendingCount: 0, pendingAmount: 0, settledCount: 0, settledAmount: 0 };
    for (const r of matched) {
      if (r.status === 'pending') { summary.pendingCount += 1; summary.pendingAmount += r.netAmount || 0; }
      else if (r.status === 'settled') { summary.settledCount += 1; summary.settledAmount += r.netAmount || 0; }
    }
    // 결제일 = 결제의 입금일(가상계좌는 이 정산 로그가 만들어진 입금 확인 시각과 updatedAt 중 이른 쪽)
    const paidAtOf = (r: { createdAt: Date; payment: { method?: string | null; createdAt: Date; updatedAt: Date } }) =>
      paymentPaidAt({ ...r.payment, settlementLog: { createdAt: r.createdAt } });
    const pageIds: string[] = sortAndPage(
      matched,
      sort,
      (r) => ({ id: r.id, paidAt: paidAtOf(r), eventDate: withEvent ? paymentEventOf(r.payment.quotations?.[0]).date : null }),
      page,
      limit,
    ).map((r) => r.id);

    const rawRows = pageIds.length
      ? await this.prisma.settlementLog.findMany({
          where: { id: { in: pageIds } },
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
                method: true,
                createdAt: true,
                updatedAt: true,
                // 환불된 결제인지(261026) — 환불해도 정산 로그는 '대기'로 남아 정산하기를 누를 수 있었다 → 화면에 경고
                status: true,
                refundAmount: true,
                refundedAt: true,
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
        })
      : [];
    const rowById = new Map(rawRows.map((r) => [r.id, r]));
    // 사이에 지워진 줄은 빠진다(정렬 순서는 키 단계 그대로)
    const rawData = pageIds.map((id) => rowById.get(id)).filter((r): r is (typeof rawRows)[number] => !!r);

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
      const { updatedAt: _updatedAt, ...payment } = r.payment;
      return {
        ...r,
        payment: {
          ...payment,
          // 화면 호환 — 옛 화면은 quotations[0].title·eventDate 를 읽는다(chatRoom 묶음은 event 로 풀어 주고 뺀다)
          quotations: (r.payment.quotations || []).map(({ chatRoom: _chatRoom, ...rest }) => rest),
          user,
          // 표시용 최종 연락처 — 결제 시 입력값 우선, 없으면(연락처 도입 이전 결제분) 계정 번호로 폴백
          customerPhone: r.payment.customerPhone || user?.phone || null,
          event: paymentEventOf(r.payment.quotations?.[0]),
          // 결제일(261026 운영팀 '정산 내역에서 결제일이 빌지를 눌러야 보인다')
          paidAt: paidAtOf(r),
        },
      };
    });

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
      // 가상계좌 입금일 = 이 정산 로그 생성(입금 확인) 시각과 updatedAt 중 이른 쪽(정산하기가 updatedAt 을 밀어서)
      paidAt: paymentPaidAt({ ...log.payment, settlementLog: { createdAt: log.createdAt } }),
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

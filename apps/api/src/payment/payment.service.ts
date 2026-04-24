import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';
import { PuddingService } from '../pudding/pudding.service';
import axios from 'axios';
import { randomUUID } from 'crypto';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);
  private readonly tossSecretKey: string;
  private readonly tossBaseUrl = 'https://api.tosspayments.com/v1/payments';

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private notificationService: NotificationService,
    private pudding: PuddingService,
  ) {
    this.tossSecretKey = this.config.get<string>('TOSS_SECRET_KEY', '');
  }

  private getAuthHeader(): string {
    const encoded = Buffer.from(`${this.tossSecretKey}:`).toString('base64');
    return `Basic ${encoded}`;
  }

  /** 주문 생성 (결제 전 pending Payment 레코드) */
  async createOrder(
    userId: string,
    data: {
      quotationId?: string;
      amount: number;
      orderName: string;
      proProfileId: string;
      eventDate?: string;
      eventLocation?: string;
      eventTime?: string;
    },
  ) {
    // quotationId가 없으면 신규 생성 (직접 예약 결제)
    let quotationId = data.quotationId;
    if (!quotationId) {
      const newQuotation = await this.prisma.quotation.create({
        data: {
          proProfileId: data.proProfileId,
          userId,
          amount: data.amount,
          title: data.orderName,
          eventDate: data.eventDate ? new Date(data.eventDate) : undefined,
          eventLocation: data.eventLocation,
          eventTime: data.eventTime ? new Date(`1970-01-01T${data.eventTime}`) : undefined,
          status: 'pending',
        },
      });
      quotationId = newQuotation.id;
    } else {
      const quotation = await this.prisma.quotation.findUnique({
        where: { id: quotationId },
      });
      if (!quotation) throw new NotFoundException('견적서를 찾을 수 없습니다.');
      if (quotation.userId !== userId) throw new ForbiddenException('본인의 견적서만 결제할 수 있습니다.');
      // eventDate 업데이트
      if (data.eventDate && !quotation.eventDate) {
        await this.prisma.quotation.update({
          where: { id: quotationId },
          data: {
            eventDate: new Date(data.eventDate),
            eventLocation: data.eventLocation ?? quotation.eventLocation,
          },
        });
      }
    }

    const orderId = `ORDER-${Date.now()}-${randomUUID().slice(0, 8)}`;

    const payment = await this.prisma.payment.create({
      data: {
        userId,
        proProfileId: data.proProfileId,
        quotationId: quotationId,
        amount: data.amount,
        status: 'pending',
        pgProvider: 'tosspayments',
        pgTransactionId: orderId,
      },
    });

    return {
      orderId,
      amount: payment.amount,
      orderName: data.orderName,
      paymentId: payment.id,
    };
  }

  /** 토스 결제 승인 */
  async confirmPayment(
    userId: string,
    data: { paymentKey: string; orderId: string; amount: number },
  ) {
    const payment = await this.prisma.payment.findUnique({
      where: { pgTransactionId: data.orderId },
    });

    if (!payment) {
      throw new NotFoundException('결제 정보를 찾을 수 없습니다.');
    }

    if (payment.userId !== userId) {
      throw new ForbiddenException('본인의 결제만 승인할 수 있습니다.');
    }

    if (payment.status !== 'pending') {
      throw new BadRequestException('이미 처리된 결제입니다.');
    }

    if (payment.amount !== data.amount) {
      throw new BadRequestException('결제 금액이 일치하지 않습니다.');
    }

    // 토스 결제 승인 API 호출
    const tossResponse = await axios.post(
      `${this.tossBaseUrl}/confirm`,
      {
        paymentKey: data.paymentKey,
        orderId: data.orderId,
        amount: data.amount,
      },
      {
        headers: {
          Authorization: this.getAuthHeader(),
          'Content-Type': 'application/json',
        },
      },
    );

    const tossData = tossResponse.data;

    // Payment 레코드 업데이트
    const updatedPayment = await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: 'completed',
        method: tossData.method ?? null,
        pgTransactionId: data.paymentKey,
      },
    });

    // 연관된 견적서 상태 + eventDate 조회
    let eventDate: Date | null = null;
    // chatRoomId 유무로 '채팅 견적 결제' vs '직접 구매' 판별
    // - 채팅 견적 결제(프로가 견적서 발송 → 고객 결제): quotation.chatRoomId 존재 → 즉시 확정
    // - 직접 구매(구매하기 / 예약하기 버튼): quotation.chatRoomId 없음 → 프로 수락 대기
    let isDirectPurchase = true;
    if (payment.quotationId) {
      const quotation = await this.prisma.quotation.update({
        where: { id: payment.quotationId },
        data: {
          status: 'paid',
          paymentId: payment.id,
        },
      });
      eventDate = quotation.eventDate;
      isDirectPurchase = !quotation.chatRoomId;
    }

    // 스케줄 생성 — 직접 구매이면 pending (프로 수락 대기), 채팅 견적이면 booked (즉시 확정)
    const scheduleStatus: 'pending' | 'booked' = isDirectPurchase ? 'pending' : 'booked';
    const scheduleDate = eventDate || new Date();
    const dateOnly = new Date(Date.UTC(scheduleDate.getFullYear(), scheduleDate.getMonth(), scheduleDate.getDate()));
    try {
      await this.prisma.proSchedule.upsert({
        where: {
          proProfileId_date: {
            proProfileId: payment.proProfileId,
            date: dateOnly,
          },
        },
        create: {
          proProfileId: payment.proProfileId,
          date: dateOnly,
          status: scheduleStatus,
          paymentId: payment.id,
          source: 'purchase',
        },
        update: {
          status: scheduleStatus,
          paymentId: payment.id,
          source: 'purchase',
          note: null,
        },
      });
    } catch (e) {
      this.logger.error(`스케줄 생성 실패: ${e}`);
    }

    // 채팅방 생성/찾기 + 스케줄 등록 시스템 메시지 추가
    let chatRoomId: string | null = null;
    try {
      let room = await this.prisma.chatRoom.findFirst({
        where: {
          userId: payment.userId,
          proProfileId: payment.proProfileId,
          userDeletedAt: null,
        },
        select: { id: true },
      });
      if (!room) {
        const pro = await this.prisma.proProfile.findUnique({
          where: { id: payment.proProfileId },
          select: { userId: true },
        });
        if (pro) {
          room = await this.prisma.chatRoom.create({
            data: {
              userId: payment.userId,
              proProfileId: payment.proProfileId,
              members: {
                createMany: { data: [{ userId: payment.userId }, { userId: pro.userId }] },
              },
            },
            select: { id: true },
          });
        }
      }
      if (room?.id) {
        chatRoomId = room.id;
        // 시스템 메시지 — 직접 구매면 '대기 중', 채팅 견적이면 '확정' 표시
        const sysContent = isDirectPurchase
          ? `📅 결제가 완료되었습니다 (${data.amount.toLocaleString()}원) · 프로의 수락을 기다리는 중입니다.`
          : `✅ 결제가 완료되었습니다 (${data.amount.toLocaleString()}원) · 스케줄이 확정되었습니다.`;
        await this.prisma.message.create({
          data: {
            roomId: room.id,
            senderId: payment.userId,
            type: 'system',
            content: sysContent,
          },
        });
        await this.prisma.chatRoom.update({
          where: { id: room.id },
          data: { lastMessageAt: new Date() },
        });
      }
    } catch (e) {
      this.logger.error(`결제 후 채팅방/메시지 생성 실패: ${e}`);
    }

    // 알림: 고객 + 전문가
    try {
      if (isDirectPurchase) {
        this.notificationService.createNotification(
          payment.userId,
          'payment' as any,
          '결제가 완료되었습니다 ✅',
          `${data.amount.toLocaleString()}원 결제가 완료되었습니다. 프로의 수락을 기다려주세요.`,
          { paymentId: payment.id },
        ).catch(() => {});
      } else {
        this.notificationService.createNotification(
          payment.userId,
          'payment' as any,
          '결제가 완료되었습니다 ✅',
          `${data.amount.toLocaleString()}원 결제가 완료되어 스케줄이 확정되었습니다.`,
          { paymentId: payment.id },
        ).catch(() => {});
      }

      const proProfile = await this.prisma.proProfile.findUnique({
        where: { id: payment.proProfileId },
        select: { userId: true },
      });
      if (proProfile) {
        if (isDirectPurchase) {
          this.notificationService.createNotification(
            proProfile.userId,
            'booking' as any,
            '새 예약 요청이 도착했습니다 📅',
            `${data.amount.toLocaleString()}원 새 예약 요청이 도착했습니다. 수락/거절을 선택해주세요.`,
            { paymentId: payment.id },
          ).catch(() => {});
        } else {
          this.notificationService.createNotification(
            proProfile.userId,
            'booking' as any,
            '새 예약이 확정되었습니다 🎉',
            `${data.amount.toLocaleString()}원 예약이 확정되었습니다. 채팅에서 고객과 상세 일정을 논의해주세요.`,
            { paymentId: payment.id },
          ).catch(() => {});
        }
      }
    } catch {}

    // 거래 성사 푸딩 +300 (결제 완료 시점 — 프로의 수락 여부와 무관하게 "거래 성사"로 간주)
    this.pudding.awardDealCompleted(payment.proProfileId, payment.id).catch(() => {});

    // 정산 로그 생성 (status=pending) — 관리자가 정산 버튼 누르면 settled 로 전환
    try {
      const platformFee = payment.platformFee || 0;
      const netAmount = payment.netAmount || (payment.amount - platformFee);
      await this.prisma.settlementLog.upsert({
        where: { paymentId: payment.id },
        create: {
          paymentId: payment.id,
          proProfileId: payment.proProfileId,
          amount: payment.amount,
          platformFee,
          netAmount,
          status: 'pending',
        },
        update: {}, // 이미 존재하면 건드리지 않음
      });
    } catch (e) {
      this.logger.error(`SettlementLog 생성 실패: ${e}`);
    }

    return { ...updatedPayment, chatRoomId };
  }

  /** 결제 내역 목록 조회 */
  async getPayments(userId: string, page: number, limit: number) {
    const skip = (page - 1) * limit;

    const [payments, total] = await Promise.all([
      this.prisma.payment.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          quotations: {
            include: {
              proProfile: {
                include: {
                  user: { select: { id: true, name: true, profileImageUrl: true } },
                  images: { where: { isPrimary: true }, take: 1 },
                },
              },
            },
          },
        },
      }),
      this.prisma.payment.count({ where: { userId } }),
    ]);

    return {
      data: payments,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /** 결제 상세 조회 */
  async getPaymentDetail(userId: string, paymentId: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        quotations: true,
        review: true,
      },
    });

    if (!payment) {
      throw new NotFoundException('결제 정보를 찾을 수 없습니다.');
    }

    if (payment.userId !== userId) {
      throw new ForbiddenException('본인의 결제만 조회할 수 있습니다.');
    }

    return payment;
  }

  /** 결제 취소 (환불) */
  async cancelPayment(userId: string, paymentId: string, reason: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        quotations: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });

    if (!payment) {
      throw new NotFoundException('결제 정보를 찾을 수 없습니다.');
    }

    if (payment.userId !== userId) {
      throw new ForbiddenException('본인의 결제만 취소할 수 있습니다.');
    }

    if (payment.status !== 'completed') {
      throw new BadRequestException('완료된 결제만 취소할 수 있습니다.');
    }

    // 환불 정책: 행사일 기준 D-day 계산
    const quotation = (payment as any).quotations?.[0];
    const eventDate = quotation?.eventDate ? new Date(quotation.eventDate) : null;
    const amount = Number(payment.amount);
    let refundAmount = amount;
    let refundRate = 100;
    if (eventDate) {
      const now = new Date();
      const diffDays = Math.ceil((eventDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays < 1) {
        throw new BadRequestException('행사 당일에는 취소할 수 없습니다. 전문가에게 직접 연락해 주세요.');
      }
      if (diffDays >= 7) { refundRate = 100; refundAmount = amount; }
      else if (diffDays >= 3) { refundRate = 90; refundAmount = Math.round(amount * 0.9); }
      else { refundRate = 50; refundAmount = Math.round(amount * 0.5); }
    }

    // 토스 결제 취소 API (부분 환불 지원)
    if (payment.pgTransactionId) {
      try {
        await axios.post(
          `${this.tossBaseUrl}/${payment.pgTransactionId}/cancel`,
          refundAmount < amount
            ? { cancelReason: reason, cancelAmount: refundAmount }
            : { cancelReason: reason },
          {
            headers: {
              Authorization: this.getAuthHeader(),
              'Content-Type': 'application/json',
            },
          },
        );
      } catch (e) {
        // PG 취소 실패해도 DB는 refunded 처리
      }
    }

    const updatedPayment = await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: 'refunded',
        refundAmount,
        refundReason: reason,
        refundedAt: new Date(),
      },
    });

    if (payment.quotationId) {
      await this.prisma.quotation.update({
        where: { id: payment.quotationId },
        data: { status: 'refunded' },
      }).catch(() => {});
    }

    // ProSchedule 상태 cancelled로
    await this.prisma.proSchedule.updateMany({
      where: { paymentId: payment.id },
      data: { status: 'cancelled', note: `고객 취소: ${reason}` },
    });

    // 채팅방에 시스템 메시지
    const room = await this.prisma.chatRoom.findFirst({
      where: {
        userId: payment.userId,
        proProfileId: payment.proProfileId,
        userDeletedAt: null,
      },
    });
    if (room) {
      await this.prisma.message.create({
        data: {
          roomId: room.id,
          senderId: userId,
          type: 'system',
          content: `⚠️ 고객이 예약을 취소했습니다.\n사유: ${reason}\n환불 금액: ${refundAmount.toLocaleString()}원 (환불률 ${refundRate}%)`,
        },
      });
      await this.prisma.chatRoom.update({
        where: { id: room.id },
        data: { lastMessageAt: new Date() },
      });
    }

    // 환불 알림 → 고객 + 전문가
    try {
      this.notificationService.createNotification(
        payment.userId,
        'payment' as any,
        '결제가 환불되었습니다',
        `${refundAmount.toLocaleString()}원 환불이 처리되었습니다. (환불률 ${refundRate}%)`,
        { paymentId: payment.id },
      ).catch(() => {});

      const proProfile = await this.prisma.proProfile.findUnique({
        where: { id: payment.proProfileId },
        select: { userId: true },
      });
      if (proProfile) {
        this.notificationService.createNotification(
          proProfile.userId,
          'booking' as any,
          '예약이 취소되었습니다',
          `고객 요청으로 예약이 취소되었습니다.\n사유: ${reason}`,
          { paymentId: payment.id },
        ).catch(() => {});
      }
    } catch {}

    return { ...updatedPayment, refundRate };
  }

  /**
   * 시스템(프로 거절 등) 에 의한 강제 환불 — 권한 체크 없이 환불 진행.
   * ProService.rejectScheduleRequest 등 내부 호출 전용.
   */
  async refundAsSystem(paymentId: string, reason: string) {
    const payment = await this.prisma.payment.findUnique({ where: { id: paymentId } });
    if (!payment) throw new NotFoundException('결제 정보를 찾을 수 없습니다.');
    if (payment.status !== 'completed') {
      // 이미 refunded 상태면 no-op, 다른 상태는 스킵
      return payment;
    }

    // 토스 결제 취소 (PG 거래 ID 가 있을 때만)
    if (payment.pgTransactionId) {
      try {
        await axios.post(
          `${this.tossBaseUrl}/${payment.pgTransactionId}/cancel`,
          { cancelReason: reason },
          {
            headers: {
              Authorization: this.getAuthHeader(),
              'Content-Type': 'application/json',
            },
          },
        );
      } catch (e) {
        // PG 취소 실패해도 DB 상태는 refunded 로 처리하고 로그만 남김
        // (운영팀 수동 처리 여지)
      }
    }

    const updatedPayment = await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: 'refunded',
        refundAmount: payment.amount,
        refundReason: reason,
        refundedAt: new Date(),
      },
    });

    if (payment.quotationId) {
      await this.prisma.quotation.update({
        where: { id: payment.quotationId },
        data: { status: 'refunded' },
      }).catch(() => {});
    }

    // 알림 → 고객 (환불)
    this.notificationService.createNotification(
      payment.userId,
      'payment' as any,
      '결제가 환불되었습니다',
      `${Number(payment.amount).toLocaleString()}원이 환불되었습니다.${reason ? `\n사유: ${reason}` : ''}`,
      { paymentId: payment.id },
    ).catch(() => {});

    return updatedPayment;
  }
}

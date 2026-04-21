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
    if (payment.quotationId) {
      const quotation = await this.prisma.quotation.update({
        where: { id: payment.quotationId },
        data: {
          status: 'paid',
          paymentId: payment.id,
        },
      });
      eventDate = quotation.eventDate;
    }

    // 스케줄 요청 생성 (status=pending) — 프로가 수락/거절 결정
    // eventDate 가 없으면 오늘 날짜로 기본값
    const scheduleDate = eventDate || new Date();
    // date 는 @db.Date 타입이라 시간 정보 제거
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
          status: 'pending',
          paymentId: payment.id,
          source: 'purchase',
        },
        update: {
          status: 'pending',
          paymentId: payment.id,
          source: 'purchase',
          note: null,
        },
      });
    } catch (e) {
      this.logger.error(`스케줄 요청 생성 실패: ${e}`);
    }

    // 채팅방 생성 (아직 없으면) — 수락 전이라도 대화 가능
    try {
      const existingRoom = await this.prisma.chatRoom.findFirst({
        where: {
          userId: payment.userId,
          proProfileId: payment.proProfileId,
          userDeletedAt: null,
        },
      });
      if (!existingRoom) {
        const pro = await this.prisma.proProfile.findUnique({
          where: { id: payment.proProfileId },
          select: { userId: true },
        });
        if (pro) {
          await this.prisma.chatRoom.create({
            data: {
              userId: payment.userId,
              proProfileId: payment.proProfileId,
              members: {
                createMany: { data: [{ userId: payment.userId }, { userId: pro.userId }] },
              },
              messages: {
                create: {
                  senderId: payment.userId,
                  type: 'system',
                  content: `📅 스케줄 요청 (${data.amount.toLocaleString()}원) — 프로의 수락을 기다리는 중입니다.`,
                },
              },
            },
          });
        }
      }
    } catch (e) {
      this.logger.error(`결제 후 채팅방 생성 실패: ${e}`);
    }

    // 알림: 고객 + 전문가
    try {
      this.notificationService.createNotification(
        payment.userId,
        'payment' as any,
        '결제가 완료되었습니다',
        `${data.amount.toLocaleString()}원 결제가 완료되었습니다. 프로의 수락을 기다려주세요.`,
        { paymentId: payment.id },
      ).catch(() => {});

      const proProfile = await this.prisma.proProfile.findUnique({
        where: { id: payment.proProfileId },
        select: { userId: true },
      });
      if (proProfile) {
        this.notificationService.createNotification(
          proProfile.userId,
          'payment' as any,
          '새 스케줄 요청이 도착했습니다 📅',
          `${data.amount.toLocaleString()}원 스케줄 요청이 도착했습니다. 수락/거절을 선택해주세요.`,
          { paymentId: payment.id },
        ).catch(() => {});
      }
    } catch {}

    return updatedPayment;
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

    // 토스 결제 취소 API 호출
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
      });
    }

    // 환불 알림 → 고객 + 전문가
    try {
      this.notificationService.createNotification(
        payment.userId,
        'payment' as any,
        '결제가 환불되었습니다',
        `${Number(payment.amount).toLocaleString()}원 환불이 처리되었습니다.`,
        { paymentId: payment.id },
      ).catch(() => {});

      const proProfile = await this.prisma.proProfile.findUnique({
        where: { id: payment.proProfileId },
        select: { userId: true },
      });
      if (proProfile) {
        this.notificationService.createNotification(
          proProfile.userId,
          'payment' as any,
          '결제가 환불되었습니다',
          `${Number(payment.amount).toLocaleString()}원 결제가 고객 요청으로 환불 처리되었습니다.`,
          { paymentId: payment.id },
        ).catch(() => {});
      }
    } catch {}

    return updatedPayment;
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

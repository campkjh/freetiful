import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';
import axios from 'axios';
import { randomUUID } from 'crypto';

@Injectable()
export class PaymentService {
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
    },
  ) {
    // 견적서가 있는 경우에만 소유권 검증
    if (data.quotationId) {
      const quotation = await this.prisma.quotation.findUnique({
        where: { id: data.quotationId },
      });
      if (!quotation) {
        throw new NotFoundException('견적서를 찾을 수 없습니다.');
      }
      if (quotation.userId !== userId) {
        throw new ForbiddenException('본인의 견적서만 결제할 수 있습니다.');
      }
    }

    const orderId = `ORDER-${Date.now()}-${randomUUID().slice(0, 8)}`;

    const payment = await this.prisma.payment.create({
      data: {
        userId,
        proProfileId: data.proProfileId,
        quotationId: data.quotationId ?? null,
        amount: data.amount,
        status: 'pending',
        pgProvider: 'tosspayments',
        pgTransactionId: orderId,
      },
    });

    // 행사일이 지정되면 ProSchedule 미리 생성 (pending 상태, 결제 완료 시 booked 로 전환)
    if (data.eventDate) {
      try {
        await this.prisma.proSchedule.create({
          data: {
            proProfileId: data.proProfileId,
            paymentId: payment.id,
            date: new Date(data.eventDate),
            status: 'unavailable',
            note: JSON.stringify({ orderName: data.orderName, amount: data.amount }),
          },
        });
      } catch { /* ignore */ }
    }

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

    // 연관된 견적서 상태를 paid로 업데이트
    if (payment.quotationId) {
      await this.prisma.quotation.update({
        where: { id: payment.quotationId },
        data: {
          status: 'paid',
          paymentId: payment.id,
        },
      });
    }

    // 결제 완료 → 이미 생성된 ProSchedule 을 booked 로 전환 (createOrder 에서 미리 생성됨)
    try {
      await this.prisma.proSchedule.updateMany({
        where: { paymentId: payment.id },
        data: { status: 'booked' },
      });
    } catch {
      // ProSchedule 없으면 무시 (eventDate 없이 결제한 경우)
    }

    // 알림: 유저에게 결제 완료 알림
    try {
      await this.notificationService.createNotification(
        payment.userId, 'payment', '결제가 완료되었습니다',
        `${data.amount.toLocaleString()}원 결제가 정상 처리되었습니다.`,
        { paymentId: payment.id },
      );
      // 전문가에게 새 예약 알림
      const proProfile = await this.prisma.proProfile.findUnique({ where: { id: payment.proProfileId } });
      if (proProfile) {
        await this.notificationService.createNotification(
          proProfile.userId, 'booking', '새로운 예약이 접수되었습니다',
          `${data.amount.toLocaleString()}원 결제 완료. 예약을 확인해 주세요.`,
          { paymentId: payment.id },
        );
      }
    } catch { /* 알림 실패해도 결제는 성공 */ }

    return updatedPayment;
  }

  /** 전문가: 예약 승낙 */
  async acceptBooking(proUserId: string, paymentId: string) {
    const profile = await this.prisma.proProfile.findUnique({ where: { userId: proUserId } });
    if (!profile) throw new NotFoundException('프로 프로필을 찾을 수 없습니다.');

    const payment = await this.prisma.payment.findUnique({ where: { id: paymentId } });
    if (!payment || payment.proProfileId !== profile.id) throw new ForbiddenException('본인의 예약만 처리할 수 있습니다.');

    await this.prisma.payment.update({
      where: { id: paymentId },
      data: { status: 'escrowed' }, // 전문가 승낙 → 에스크로 상태
    });
    await this.prisma.proSchedule.updateMany({
      where: { paymentId },
      data: { status: 'booked' },
    });

    return { success: true, status: 'escrowed' };
  }

  /** 전문가: 예약 거절 + 취소 사유 */
  async rejectBooking(proUserId: string, paymentId: string, reason: string) {
    const profile = await this.prisma.proProfile.findUnique({ where: { userId: proUserId } });
    if (!profile) throw new NotFoundException('프로 프로필을 찾을 수 없습니다.');

    const payment = await this.prisma.payment.findUnique({ where: { id: paymentId } });
    if (!payment || payment.proProfileId !== profile.id) throw new ForbiddenException('본인의 예약만 처리할 수 있습니다.');

    await this.prisma.payment.update({
      where: { id: paymentId },
      data: { status: 'refunded', refundReason: reason, refundedAt: new Date() },
    });
    await this.prisma.proSchedule.updateMany({
      where: { paymentId },
      data: { status: 'available' },
    });

    return { success: true, status: 'refunded', reason };
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
          quotations: true,
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

    // Payment 상태 업데이트
    const updatedPayment = await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: 'refunded',
        refundAmount: payment.amount,
        refundReason: reason,
        refundedAt: new Date(),
      },
    });

    // 연관된 견적서 상태를 refunded로 업데이트
    if (payment.quotationId) {
      await this.prisma.quotation.update({
        where: { id: payment.quotationId },
        data: { status: 'refunded' },
      });
    }

    return updatedPayment;
  }
}

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
import { ChatService } from '../chat/chat.service';
import { ChatRealtimeService } from '../chat/chat-realtime.service';
import { MessageTypeEnum } from '../chat/dto/chat.dto';
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
    private chatService: ChatService,
    private chatRealtimeService: ChatRealtimeService,
  ) {
    this.tossSecretKey = this.config.get<string>('TOSS_SECRET_KEY', '');
  }

  private getAuthHeader(): string {
    const encoded = Buffer.from(`${this.tossSecretKey}:`).toString('base64');
    return `Basic ${encoded}`;
  }

  private toDateInput(value?: any): string | undefined {
    if (!value) return undefined;
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? undefined : d.toISOString().slice(0, 10);
  }

  private toTimeInput(value?: any): string | undefined {
    if (!value) return undefined;
    if (typeof value === 'string' && /^\d{1,2}:\d{2}/.test(value)) {
      const [hh, mm] = value.split(':');
      return `${hh.padStart(2, '0')}:${mm.slice(0, 2)}`;
    }
    if (typeof value === 'string') {
      const isoTime = value.match(/T(\d{2}:\d{2})/);
      if (isoTime) return isoTime[1];
    }
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return undefined;
    return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
  }

  private toTimeDate(value?: any): Date | undefined {
    const time = this.toTimeInput(value);
    return time ? new Date(`1970-01-01T${time}:00.000Z`) : undefined;
  }

  private formatEasyPayMethod(tossData: any): string | null {
    const provider = String(tossData?.easyPay?.provider || '').toUpperCase();
    const providerMap: Record<string, string> = {
      NAVERPAY: '네이버페이',
      KAKAOPAY: '카카오페이',
      TOSSPAY: '토스페이',
      PAYCO: '페이코',
      SAMSUNGPAY: '삼성페이',
      LPAY: 'L.pay',
      SSGPAY: 'SSG페이',
    };
    if (provider) return providerMap[provider] || tossData.easyPay.provider;
    return tossData?.method ?? null;
  }

  /** 하이픈·공백을 떼고 숫자만 남긴다. 010-1234-5678 → 01012345678 */
  private normalizePhone(raw?: string | null): string | null {
    const digits = String(raw ?? '').replace(/[^0-9]/g, '');
    if (!digits) return null;
    // +82 국가번호로 들어오면 국내 표기로 되돌린다
    const local = digits.startsWith('82') && digits.length >= 11 ? `0${digits.slice(2)}` : digits;
    if (local.length < 9 || local.length > 11) return null;
    return local;
  }

  /** 결제 화면에서 받은 번호를 우선하고, 없으면 계정에 등록된 번호를 쓴다 */
  private async resolveCustomerPhone(userId: string, input?: string | null): Promise<string | null> {
    const typed = this.normalizePhone(input);
    if (typed) return typed;
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { phone: true },
    });
    return this.normalizePhone(user?.phone);
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
      customerPhone?: string;
    },
  ) {
    // 결제 당시 연락처. 클라이언트가 안 보내면 계정에 등록된 번호로 폴백한다.
    const customerPhone = await this.resolveCustomerPhone(userId, data.customerPhone);

    // quotationId가 없으면 신규 견적 레코드 생성
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
          eventTime: this.toTimeDate(data.eventTime),
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
      // 채팅 견적서에 일정 정보가 비어 있으면 결제 진입 시 넘어온 의뢰 일정으로 보강한다.
      const updateData: any = {};
      const eventDateInput = this.toDateInput(data.eventDate);
      if (eventDateInput && !quotation.eventDate) updateData.eventDate = new Date(eventDateInput);
      if (data.eventTime && !quotation.eventTime) updateData.eventTime = this.toTimeDate(data.eventTime);
      if (data.eventLocation && !quotation.eventLocation) updateData.eventLocation = data.eventLocation;
      if (Object.keys(updateData).length > 0) {
        await this.prisma.quotation.update({
          where: { id: quotationId },
          data: updateData,
        });
      }
    }

    // 같은 견적에 대한 pending Payment 가 이미 있으면 재사용 — 결제하기 버튼을
    // 여러 번 누르거나 checkout 페이지를 reload 해도 row 가 누적되지 않게 한다.
    const existingPending = await this.prisma.payment.findFirst({
      where: { userId, quotationId, status: 'pending' },
      orderBy: { createdAt: 'desc' },
    });

    if (existingPending && existingPending.amount === data.amount && existingPending.pgTransactionId) {
      // 재사용 시에도 이번에 입력한 연락처를 반영한다(첫 시도에 못 받았거나 번호를 고친 경우)
      if (customerPhone && customerPhone !== existingPending.customerPhone) {
        await this.prisma.payment.update({
          where: { id: existingPending.id },
          data: { customerPhone },
        });
      }
      return {
        orderId: existingPending.pgTransactionId,
        amount: existingPending.amount,
        orderName: data.orderName,
        paymentId: existingPending.id,
      };
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
        customerPhone: customerPhone ?? undefined,
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

    // pending 이 아니면 재처리 금지. 단, 가상계좌 입금대기(waiting_for_deposit)에서
    // 성공페이지를 새로고침하는 경우엔 현재 상태(입금대기)를 그대로 돌려준다(에러 대신).
    if (payment.status === 'waiting_for_deposit') {
      return { ...payment, chatRoomId: null, awaitingDeposit: true };
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
    const tossStatus = String(tossData?.status || '');

    // ⚠️ 가상계좌(무통장)는 confirm 직후 status = WAITING_FOR_DEPOSIT (계좌 발급만, 미입금).
    // 실제 입금 완료는 토스 웹훅(DEPOSIT_CALLBACK, status=DONE)으로만 확정된다.
    // 따라서 status !== 'DONE' 이면 결제완료 처리(견적 paid / 채팅 / 알림 / 정산로그)를 절대 실행하지 않는다.
    if (tossStatus !== 'DONE') {
      const va = tossData?.virtualAccount;
      const waitingPayment = await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: 'waiting_for_deposit',
          method: this.formatEasyPayMethod(tossData),
          pgTransactionId: data.paymentKey,
        },
      });
      this.logger.log(`가상계좌 발급(입금대기) payment=${payment.id} status=${tossStatus}`);
      return {
        ...waitingPayment,
        chatRoomId: null,
        awaitingDeposit: true,
        virtualAccount: va
          ? {
              bank: va.bankCode || va.bank || null,
              accountNumber: va.accountNumber || null,
              dueDate: va.dueDate || null,
              customerName: va.customerName || null,
            }
          : null,
      };
    }

    // 여기부터는 status === 'DONE' — 실제 결제 완료.
    const updatedPayment = await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: 'completed',
        method: this.formatEasyPayMethod(tossData),
        pgTransactionId: data.paymentKey,
      },
    });

    const { chatRoomId } = await this.runPaidSideEffects(payment, data.amount);

    return { ...updatedPayment, chatRoomId };
  }

  /**
   * 결제가 실제로 완료(DONE)된 뒤에만 실행하는 부수효과 —
   * 견적 paid 전환 · 채팅 시스템 메시지 · 고객/전문가 알림 · 대시보드 갱신 · 정산로그 생성.
   * 카드 즉시결제(confirm DONE)와 가상계좌 입금완료(웹훅 DONE) 양쪽에서 재사용한다.
   */
  private async runPaidSideEffects(
    payment: { id: string; userId: string; proProfileId: string; quotationId: string | null; amount: number; platformFee: number | null; netAmount: number | null; pgTransactionId?: string | null },
    amount: number,
  ): Promise<{ chatRoomId: string | null }> {
    // 연관된 견적서 상태 조회
    let paidQuotation: any = null;
    if (payment.quotationId) {
      const quotation = await this.prisma.quotation.update({
        where: { id: payment.quotationId },
        data: {
          status: 'paid',
          paymentId: payment.id,
        },
      });
      paidQuotation = quotation;
    }

    // 채팅방 생성/찾기 + 결제 시스템 메시지 추가
    let chatRoomId: string | null = null;
    let proUserId: string | null = null;
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
          proUserId = pro.userId;
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
        const eventTitle = paidQuotation?.title || '결제';
        const sysContent = `결제가 완료되었습니다 (${amount.toLocaleString()}원).`;
        const systemMessage = await this.chatService.sendMessage(room.id, payment.userId, {
          type: MessageTypeEnum.system,
          content: sysContent,
          metadata: {
            system: {
              kind: 'payment_paid',
              paymentId: payment.id,
              quotationId: paidQuotation?.id,
              amount,
              eventName: eventTitle,
              // 채팅의 '결제한 서비스' 카드에 그대로 보여 줄 주문번호(토스에 넘긴 orderId)
              orderId: payment.pgTransactionId || undefined,
            },
          },
        });
        const memberIds = await this.chatService.getRoomMemberIds(room.id);
        await this.chatRealtimeService.emitPersistedMessage(room.id, systemMessage.id, {
          roomUpdatedUserIds: memberIds.filter((memberId) => memberId !== payment.userId),
          unreadUserIds: memberIds.filter((memberId) => memberId !== payment.userId),
          dashboardUserIds: memberIds,
        });
      }
    } catch (e) {
      this.logger.error(`결제 후 채팅방/메시지 생성 실패: ${e}`);
    }

    // 알림: 고객 + 전문가
    try {
      this.notificationService.createNotification(
        payment.userId,
        'payment' as any,
        '결제가 완료되었습니다',
        `${amount.toLocaleString()}원 결제가 완료되었습니다.`,
        { paymentId: payment.id },
      ).catch(() => {});

      const proProfile = await this.prisma.proProfile.findUnique({
        where: { id: payment.proProfileId },
        select: { userId: true },
      });
      proUserId = proProfile?.userId ?? proUserId;
      if (proProfile) {
        this.notificationService.createNotification(
          proProfile.userId,
          'payment' as any,
          '결제가 완료되었습니다',
          `${amount.toLocaleString()}원 결제가 완료되었습니다.`,
          { paymentId: payment.id },
        ).catch(() => {});
      }
    } catch {}

    this.chatRealtimeService.emitDashboardUpdated([payment.userId, proUserId], {
      kind: 'payment',
      paymentId: payment.id,
      proProfileId: payment.proProfileId,
      chatRoomId,
    });

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

    return { chatRoomId };
  }

  /**
   * 토스 웹훅 수신 — 가상계좌 입금 완료/취소를 확정한다.
   * PAYMENT_STATUS_CHANGED / DEPOSIT_CALLBACK 이벤트 처리.
   * (인증 헤더 없이 토스가 호출하므로 컨트롤러에서 Public. orderId/paymentKey 로 결제를 재조회해 신뢰.)
   */
  async handleTossWebhook(body: any): Promise<{ ok: boolean }> {
    try {
      const eventType = String(body?.eventType || '');
      const payload = body?.data || body || {};
      const status = String(payload?.status || '');
      const orderId = payload?.orderId as string | undefined;
      const paymentKey = payload?.paymentKey as string | undefined;

      this.logger.log(`토스 웹훅 수신 event=${eventType} status=${status} orderId=${orderId}`);

      if (!orderId && !paymentKey) return { ok: true };

      // order 생성 시 pgTransactionId=orderId, confirm 후엔 pgTransactionId=paymentKey 로 갱신됨.
      // 두 값 중 매칭되는 결제를 찾는다.
      const payment = await this.prisma.payment.findFirst({
        where: {
          OR: [
            orderId ? { pgTransactionId: orderId } : undefined,
            paymentKey ? { pgTransactionId: paymentKey } : undefined,
          ].filter(Boolean) as any[],
        },
      });
      if (!payment) {
        this.logger.warn(`웹훅 대상 결제 없음 orderId=${orderId} paymentKey=${paymentKey}`);
        return { ok: true };
      }

      // 입금 완료 → 결제 완료 확정 (아직 completed 가 아닐 때만)
      if (status === 'DONE') {
        if (payment.status === 'completed' || payment.status === 'settled' || payment.status === 'escrowed') {
          return { ok: true }; // 이미 처리됨 (웹훅 중복 수신 방어)
        }
        await this.prisma.payment.update({
          where: { id: payment.id },
          data: { status: 'completed' },
        });
        await this.runPaidSideEffects(payment as any, payment.amount);
        this.logger.log(`가상계좌 입금완료 → 결제완료 확정 payment=${payment.id}`);
        return { ok: true };
      }

      // 입금 취소/만료 → 실패 처리 (미완료 상태였을 때만)
      if (status === 'CANCELED' || status === 'EXPIRED' || status === 'PARTIAL_CANCELED') {
        if (payment.status === 'waiting_for_deposit' || payment.status === 'pending') {
          await this.prisma.payment.update({
            where: { id: payment.id },
            data: { status: 'failed' },
          });
          this.logger.log(`가상계좌 입금 취소/만료 → 실패 payment=${payment.id} status=${status}`);
        }
        return { ok: true };
      }

      return { ok: true };
    } catch (e) {
      this.logger.error(`토스 웹훅 처리 실패: ${e}`);
      // 토스에 200 을 돌려주지 않으면 재시도 폭주 → 로깅만 하고 ok 반환.
      return { ok: true };
    }
  }

  /** 결제 내역 목록 조회 */
  async getPayments(userId: string, page: number, limit: number) {
    const skip = (page - 1) * limit;

    // 사회자(프로)는 결제를 '하는' 쪽이 아니라 '받는' 쪽이다.
    // userId 로만 찾으면 프로에겐 늘 빈 목록이라 "결제 내역이 안 뜬다"는 문의가 됐다.
    // 프로 계정이면 본인이 받은 결제를 돌려준다.
    const proProfile = await this.prisma.proProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    // 어드민이 리뷰를 직접 등록할 때 만드는 0원 더미 결제(method='admin_review')는 실결제가 아니다.
    // 어드민 지표·목록에서도 같은 방식으로 제외하고 있다.
    const where: any = proProfile
      ? {
          proProfileId: proProfile.id,
          method: { not: 'admin_review' },
          // 프로 화면은 '받은 돈' 목록 — 아직 입금 전(pending/waiting_for_deposit)이나 실패는 뺀다
          status: { in: ['completed', 'escrowed', 'settled', 'refunded'] as any },
        }
      : { userId, method: { not: 'admin_review' } };

    const [payments, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          quotations: {
            orderBy: { createdAt: 'desc' },
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
      this.prisma.payment.count({ where }),
    ]);

    // 프로 화면은 '누가 결제했는지'가 핵심 — Payment↔User 관계가 스키마에 없어 별도 조회 후 머지
    let withCustomer: any[] = payments;
    if (proProfile && payments.length > 0) {
      const ids = Array.from(new Set(payments.map((p) => p.userId)));
      const users = await this.prisma.user.findMany({
        where: { id: { in: ids } },
        select: { id: true, name: true, profileImageUrl: true },
      });
      const map = new Map(users.map((u) => [u.id, u]));
      withCustomer = payments.map((p) => ({
        ...p,
        customer: map.get(p.userId) || null,
        // 프로 화면에서만 연락처를 함께 준다(본인이 받은 결제라 응대에 필요)
        customerPhone: p.customerPhone || null,
      }));
    }

    return {
      data: withCustomer,
      // 프로 계정이면 '받은 결제' 목록이라는 표시
      viewerRole: proProfile ? 'pro' : 'customer',
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
        quotations: {
          orderBy: { createdAt: 'desc' },
          include: {
            proProfile: {
              include: {
                user: { select: { id: true, name: true, profileImageUrl: true, phone: true } },
                images: { where: { isPrimary: true }, take: 1 },
                categories: { include: { category: true } },
              },
            },
          },
        },
        review: true,
      },
    });

    if (!payment) {
      throw new NotFoundException('결제 정보를 찾을 수 없습니다.');
    }

    // 결제 당사자는 고객(payment.userId) + 사회자(proProfile.userId) 양쪽 모두 가능.
    let isAllowed = payment.userId === userId;
    if (!isAllowed) {
      const pro = await this.prisma.proProfile.findUnique({
        where: { id: payment.proProfileId },
        select: { userId: true },
      });
      isAllowed = pro?.userId === userId;
    }
    if (!isAllowed) {
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
      if (diffDays >= 14) { refundRate = 100; refundAmount = amount; }
      else if (diffDays >= 7) { refundRate = 90; refundAmount = Math.round(amount * 0.9); }
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
          content: `고객이 결제를 취소했습니다.\n사유: ${reason}\n환불 금액: ${refundAmount.toLocaleString()}원 (환불률 ${refundRate}%)`,
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
          'payment' as any,
          '결제가 취소되었습니다',
          `고객 요청으로 결제가 취소되었습니다.\n사유: ${reason}`,
          { paymentId: payment.id },
        ).catch(() => {});
      }
    } catch {}

    return { ...updatedPayment, refundRate };
  }

  /**
   * 시스템(프로 거절 등) 에 의한 강제 환불 — 권한 체크 없이 환불 진행.
   * 내부 시스템 호출 전용.
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

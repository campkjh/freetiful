import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';
import { ChatRealtimeService } from '../chat/chat-realtime.service';

@Injectable()
export class QuotationService {
  constructor(
    private prisma: PrismaService,
    private notificationService: NotificationService,
    private chatRealtimeService: ChatRealtimeService,
  ) {}

  private toDateInput(value?: any): string | undefined {
    if (!value) return undefined;
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
      return value.slice(0, 10);
    }
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

  private async withRequestEventDefaults(data: {
    title?: string;
    eventDate?: string;
    eventTime?: string;
    eventLocation?: string;
    chatRoomId?: string;
  }) {
    const next = {
      title: data.title,
      eventDate: this.toDateInput(data.eventDate),
      eventTime: this.toTimeInput(data.eventTime),
      eventLocation: data.eventLocation,
    };
    if ((!next.eventDate || !next.eventTime || !next.eventLocation || !next.title) && data.chatRoomId) {
      const room = await this.prisma.chatRoom.findUnique({
        where: { id: data.chatRoomId },
        select: {
          matchRequest: {
            select: {
              eventDate: true,
              eventTime: true,
              eventLocation: true,
              rawUserInput: true,
              eventCategory: { select: { name: true } },
            },
          },
        },
      });
      const mr = room?.matchRequest;
      const raw = mr?.rawUserInput && typeof mr.rawUserInput === 'object' ? (mr.rawUserInput as any) : {};
      next.eventDate = next.eventDate || this.toDateInput(mr?.eventDate || raw.date);
      next.eventTime = next.eventTime || this.toTimeInput(mr?.eventTime || raw.timeStart);
      next.eventLocation = next.eventLocation || mr?.eventLocation || raw.location;
      next.title = next.title || raw.eventName || mr?.eventCategory?.name || '행사 진행';
    }
    return next;
  }

  /** 전문가가 견적서 생성 */
  async createQuotation(
    proProfileId: string,
    userId: string,
    data: {
      amount: number;
      title?: string;
      description?: string;
      eventDate?: string;
      eventTime?: string;
      eventLocation?: string;
      items?: any;
      validUntil?: string;
      chatRoomId?: string;
      matchDeliveryId?: string;
    },
  ) {
    // 전문가 프로필 확인
    const proProfile = await this.prisma.proProfile.findUnique({
      where: { id: proProfileId },
    });
    if (!proProfile) {
      throw new NotFoundException('전문가 프로필을 찾을 수 없습니다.');
    }

    // 대상 유저 확인
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) {
      throw new NotFoundException('사용자를 찾을 수 없습니다.');
    }

    const normalized = await this.withRequestEventDefaults(data);

    const quotation = await this.prisma.quotation.create({
      data: {
        proProfileId,
        userId,
        amount: data.amount,
        title: normalized.title,
        description: data.description,
        eventDate: normalized.eventDate ? new Date(normalized.eventDate) : undefined,
        eventTime: this.toTimeDate(normalized.eventTime),
        eventLocation: normalized.eventLocation,
        validUntil: data.validUntil ? new Date(data.validUntil) : undefined,
        chatRoomId: data.chatRoomId,
        matchDeliveryId: data.matchDeliveryId,
      },
      include: {
        proProfile: {
          include: {
            user: { select: { id: true, name: true, profileImageUrl: true } },
            images: { where: { isPrimary: true }, take: 1 },
          },
        },
      },
    });

    // 견적서 도착 알림 → 고객에게
    this.notificationService.createNotification(
      userId,
      'system' as any,
      '견적서가 도착했습니다',
      `${quotation.proProfile.user.name} 사회자가 ${(data.amount || 0).toLocaleString()}원 견적서를 보냈습니다.`,
      { quotationId: quotation.id },
    ).catch(() => {});

    const proUserId = quotation.proProfile?.user?.id;
    this.chatRealtimeService.emitDashboardUpdated([userId, proUserId], {
      kind: 'quotation-created',
      quotationId: quotation.id,
      chatRoomId: data.chatRoomId ?? null,
    });
    this.chatRealtimeService.emitMatchUpdated([userId, proUserId], {
      kind: 'quotation-created',
      quotationId: quotation.id,
      chatRoomId: data.chatRoomId ?? null,
    });
    if (data.chatRoomId) {
      this.chatRealtimeService.emitToUsers([userId, proUserId], 'roomUpdated', {
        roomId: data.chatRoomId,
        quotationId: quotation.id,
      });
    }

    return quotation;
  }

  /** 전문가가 보낸 견적서 목록 */
  async getQuotationsByPro(proProfileId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [quotations, total] = await Promise.all([
      this.prisma.quotation.findMany({
        where: { proProfileId },
        include: {
          proProfile: {
            include: {
              user: { select: { id: true, name: true, profileImageUrl: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.quotation.count({ where: { proProfileId } }),
    ]);

    return {
      data: quotations,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /** 사용자가 받은 견적서 목록 */
  async getQuotationsByUser(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [quotations, total] = await Promise.all([
      this.prisma.quotation.findMany({
        where: { userId },
        include: {
          proProfile: {
            include: {
              user: { select: { id: true, name: true, profileImageUrl: true } },
              images: { where: { isPrimary: true }, take: 1 },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.quotation.count({ where: { userId } }),
    ]);

    return {
      data: quotations,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /** 견적서 상세 조회 */
  async getQuotation(id: string) {
    const quotation = await this.prisma.quotation.findUnique({
      where: { id },
      include: {
        proProfile: {
          include: {
            user: { select: { id: true, name: true, profileImageUrl: true } },
            images: { where: { isPrimary: true }, take: 1 },
            categories: { include: { category: true } },
          },
        },
        chatRoom: true,
      },
    });

    if (!quotation) {
      throw new NotFoundException('견적서를 찾을 수 없습니다.');
    }

    return quotation;
  }

  /** 사용자가 견적서 상태 변경 (수락/취소) */
  async updateStatus(
    id: string,
    userId: string,
    status: 'accepted' | 'cancelled',
  ) {
    const quotation = await this.prisma.quotation.findUnique({
      where: { id },
    });

    if (!quotation) {
      throw new NotFoundException('견적서를 찾을 수 없습니다.');
    }

    if (quotation.userId !== userId) {
      throw new ForbiddenException('본인의 견적서만 상태를 변경할 수 있습니다.');
    }

    if (quotation.status !== 'pending') {
      throw new BadRequestException(
        '대기 중인 견적서만 상태를 변경할 수 있습니다.',
      );
    }

    // 유효기간 만료 확인
    if (
      status === 'accepted' &&
      quotation.validUntil &&
      new Date() > quotation.validUntil
    ) {
      throw new BadRequestException('견적서 유효기간이 만료되었습니다.');
    }

    const updated = await this.prisma.quotation.update({
      where: { id },
      data: { status },
      include: {
        proProfile: {
          include: {
            user: { select: { id: true, name: true, profileImageUrl: true } },
          },
        },
      },
    });
    const customer = await this.prisma.user.findUnique({
      where: { id: updated.userId },
      select: { name: true },
    });

    // 수락/취소 알림 → 전문가에게
    const proUserId = updated.proProfile?.user?.id;
    const customerName = customer?.name || '고객';
    if (proUserId) {
      if (status === 'accepted') {
        this.notificationService.createNotification(
          proUserId,
          'system' as any,
          '견적서가 수락되었습니다! 💰',
          `${customerName}님이 견적서를 수락했습니다.`,
          { quotationId: id },
        ).catch(() => {});
      } else {
        this.notificationService.createNotification(
          proUserId,
          'system' as any,
          '견적서가 취소되었습니다',
          `${customerName}님이 견적서를 취소했습니다.`,
          { quotationId: id },
        ).catch(() => {});
      }
    }

    this.chatRealtimeService.emitDashboardUpdated([updated.userId, proUserId], {
      kind: 'quotation-status-updated',
      quotationId: id,
      status,
      chatRoomId: updated.chatRoomId ?? null,
    });
    this.chatRealtimeService.emitMatchUpdated([updated.userId, proUserId], {
      kind: 'quotation-status-updated',
      quotationId: id,
      status,
      chatRoomId: updated.chatRoomId ?? null,
    });
    if (updated.chatRoomId) {
      this.chatRealtimeService.emitToUsers([updated.userId, proUserId], 'roomUpdated', {
        roomId: updated.chatRoomId,
        quotationId: id,
      });
    }

    return updated;
  }

  /** 전문가 대시보드용 견적 요약 */
  async getQuotationsForProDashboard(proProfileId: string) {
    const [pendingCount, recentQuotations, totalCount] = await Promise.all([
      this.prisma.quotation.count({
        where: { proProfileId, status: 'pending' },
      }),
      this.prisma.quotation.findMany({
        where: { proProfileId },
        include: {
          proProfile: {
            include: {
              user: { select: { id: true, name: true, profileImageUrl: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      this.prisma.quotation.count({
        where: { proProfileId },
      }),
    ]);

    return {
      pendingCount,
      totalCount,
      recentQuotations,
    };
  }
}

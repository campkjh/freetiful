import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';

@Injectable()
export class QuotationService {
  constructor(
    private prisma: PrismaService,
    private notificationService: NotificationService,
  ) {}

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

    const quotation = await this.prisma.quotation.create({
      data: {
        proProfileId,
        userId,
        amount: data.amount,
        title: data.title,
        description: data.description,
        eventDate: data.eventDate ? new Date(data.eventDate) : undefined,
        eventTime: data.eventTime ? new Date(`1970-01-01T${data.eventTime}`) : undefined,
        eventLocation: data.eventLocation,
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
        user: { select: { id: true, name: true } },
      },
    });

    // 수락/취소 알림 → 전문가에게
    const proUserId = updated.proProfile?.user?.id;
    const customerName = updated.user?.name || '고객';
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

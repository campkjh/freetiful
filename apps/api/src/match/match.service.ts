import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';

@Injectable()
export class MatchService {
  constructor(
    private prisma: PrismaService,
    private notificationService: NotificationService,
  ) {}

  /** 사용자가 매칭 요청 생성 */
  async createMatchRequest(
    userId: string,
    data: {
      categoryId: string;
      eventCategoryId?: string;
      eventDate?: string;
      eventTime?: string;
      eventLocation?: string;
      budgetMin?: number;
      budgetMax?: number;
      type: 'multi' | 'single';
      styleOptionIds?: string[];
      personalityOptionIds?: string[];
      rawUserInput?: any;
    },
  ) {
    const category = await this.prisma.category.findUnique({
      where: { id: data.categoryId },
    });
    if (!category) {
      throw new NotFoundException('카테고리를 찾을 수 없습니다.');
    }

    if (data.eventCategoryId) {
      const eventCategory = await this.prisma.eventCategory.findUnique({
        where: { id: data.eventCategoryId },
      });
      if (!eventCategory) {
        throw new NotFoundException('이벤트 카테고리를 찾을 수 없습니다.');
      }
    }

    const matchRequest = await this.prisma.matchRequest.create({
      data: {
        userId,
        type: data.type,
        categoryId: data.categoryId,
        eventCategoryId: data.eventCategoryId,
        eventDate: data.eventDate ? new Date(data.eventDate) : undefined,
        eventTime: data.eventTime
          ? new Date(`1970-01-01T${data.eventTime}`)
          : undefined,
        eventLocation: data.eventLocation,
        budgetMin: data.budgetMin,
        budgetMax: data.budgetMax,
        rawUserInput: data.rawUserInput,
        styles: data.styleOptionIds?.length
          ? {
              create: data.styleOptionIds.map((styleOptionId) => ({
                styleOptionId,
              })),
            }
          : undefined,
        personalities: data.personalityOptionIds?.length
          ? {
              create: data.personalityOptionIds.map(
                (personalityOptionId) => ({ personalityOptionId }),
              ),
            }
          : undefined,
      },
      include: {
        category: true,
        eventCategory: true,
        styles: { include: { styleOption: true } },
        personalities: { include: { personalityOption: true } },
      },
    });

    // 카테고리에 일치하는 승인된 사회자에게 fan-out — matchDelivery 생성 + 푸쉬 알림
    void this.fanoutMatchRequestToPros(matchRequest.id, data.categoryId).catch(() => {});

    return matchRequest;
  }

  /** 새 매칭 요청을 카테고리 일치하는 approved 사회자에게 분배 + 알림 */
  private async fanoutMatchRequestToPros(matchRequestId: string, categoryId: string) {
    let proCategories = await this.prisma.proCategory.findMany({
      where: {
        categoryId,
        proProfile: { status: 'approved' },
      },
      include: {
        proProfile: {
          include: { user: { select: { id: true, name: true } } },
        },
      },
      take: 20, // 무차별 fan-out 방지 — 상위 20명만
    });

    if (proCategories.length === 0) {
      const fallbackPros = await this.prisma.proProfile.findMany({
        where: { status: 'approved' },
        include: { user: { select: { id: true, name: true } } },
        take: 20,
      });
      proCategories = fallbackPros.map((proProfile) => ({
        proProfileId: proProfile.id,
        categoryId,
        proProfile,
      }));
    }

    const matchRequest = await this.prisma.matchRequest.findUnique({
      where: { id: matchRequestId },
      include: {
        user: { select: { name: true } },
        category: { select: { name: true } },
      },
    });
    if (!matchRequest) return;

    const customerName = matchRequest.user?.name || '고객';
    const categoryName = matchRequest.category?.name || '서비스';

    for (const pc of proCategories) {
      const proUserId = pc.proProfile?.user?.id;
      if (!proUserId) continue;
      try {
        await this.prisma.matchDelivery.create({
          data: { matchRequestId, proProfileId: pc.proProfileId },
        });
      } catch {
        // 중복 (같은 요청에 같은 pro 두 번) — 무시
        continue;
      }
      this.notificationService
        .createNotification(
          proUserId,
          'system' as any,
          '새 매칭 요청이 도착했습니다 📋',
          `${customerName}님이 ${categoryName} 견적을 요청했습니다.`,
          { type: 'match_request', matchRequestId },
        )
        .catch(() => {});
    }
  }

  /** 사용자의 매칭 요청 목록 */
  async getMatchRequests(userId: string) {
    return this.prisma.matchRequest.findMany({
      where: { userId },
      include: {
        category: true,
        eventCategory: true,
        styles: { include: { styleOption: true } },
        personalities: { include: { personalityOption: true } },
        deliveries: {
          include: {
            proProfile: {
              include: {
                user: {
                  select: { id: true, name: true, profileImageUrl: true },
                },
                images: { where: { isPrimary: true }, take: 1 },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** 전문가에게 전달된 매칭 요청 목록 */
  async getMatchRequestsForPro(proProfileId: string) {
    const deliveries = await this.prisma.matchDelivery.findMany({
      where: { proProfileId },
      include: {
        matchRequest: {
          include: {
            category: true,
            eventCategory: true,
            styles: { include: { styleOption: true } },
            personalities: { include: { personalityOption: true } },
            user: {
              select: { id: true, name: true, profileImageUrl: true },
            },
          },
        },
      },
      orderBy: { deliveredAt: 'desc' },
    });

    return deliveries;
  }

  /** 전문가가 매칭 요청에 응답 (수락/거절) */
  async respondToMatch(
    proProfileId: string,
    matchDeliveryId: string,
    action: 'accept' | 'reject',
  ) {
    const delivery = await this.prisma.matchDelivery.findUnique({
      where: { id: matchDeliveryId },
      include: {
        matchRequest: {
          include: { user: { select: { id: true, name: true } } },
        },
        proProfile: {
          include: { user: { select: { id: true, name: true } } },
        },
      },
    });

    if (!delivery) {
      throw new NotFoundException('매칭 전달 정보를 찾을 수 없습니다.');
    }

    if (delivery.proProfileId !== proProfileId) {
      throw new ForbiddenException('본인에게 전달된 매칭만 응답할 수 있습니다.');
    }

    if (delivery.status !== 'pending' && delivery.status !== 'viewed') {
      throw new BadRequestException('이미 응답한 매칭입니다.');
    }

    const proName = delivery.proProfile?.user?.name || '사회자';
    const customerId = delivery.matchRequest?.user?.id;

    if (action === 'accept') {
      const result = await this.prisma.matchDelivery.update({
        where: { id: matchDeliveryId },
        data: { status: 'replied', repliedAt: new Date() },
        include: {
          matchRequest: {
            include: {
              category: true,
              eventCategory: true,
              user: { select: { id: true, name: true, profileImageUrl: true } },
            },
          },
        },
      });

      // 수락 알림 → 고객에게
      if (customerId) {
        this.notificationService.createNotification(
          customerId,
          'system' as any,
          '매칭 요청이 수락되었습니다! 🎉',
          `${proName} 사회자가 매칭 요청을 수락했습니다. 채팅으로 연락해보세요.`,
          { matchDeliveryId, proProfileId },
        ).catch(() => {});
      }

      return result;
    } else {
      const result = await this.prisma.matchDelivery.update({
        where: { id: matchDeliveryId },
        data: { status: 'declined' },
        include: {
          matchRequest: { include: { category: true, eventCategory: true } },
        },
      });

      // 거절 알림 → 고객에게
      if (customerId) {
        this.notificationService.createNotification(
          customerId,
          'system' as any,
          '매칭 요청이 거절되었습니다',
          `${proName} 사회자가 매칭 요청을 거절했습니다. 다른 전문가를 찾아보세요.`,
          { matchDeliveryId, proProfileId },
        ).catch(() => {});
      }

      return result;
    }
  }
}

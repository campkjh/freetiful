import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MatchService {
  constructor(private prisma: PrismaService) {}

  /** 사용자가 매칭 요청 생성 + 선택된 전문가에게 발송 */
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
      proProfileIds?: string[];
    },
  ) {
    // 카테고리 확인
    const category = await this.prisma.category.findUnique({
      where: { id: data.categoryId },
    });
    if (!category) {
      throw new NotFoundException('카테고리를 찾을 수 없습니다.');
    }

    // 이벤트 카테고리 확인
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

    // 선택된 전문가들에게 매칭 요청 발송 (MatchDelivery 생성)
    if (data.proProfileIds && data.proProfileIds.length > 0) {
      await this.prisma.matchDelivery.createMany({
        data: data.proProfileIds.map((proProfileId) => ({
          matchRequestId: matchRequest.id,
          proProfileId,
        })),
        skipDuplicates: true,
      });
    }

    return matchRequest;
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
      include: { matchRequest: true },
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

    if (action === 'accept') {
      return this.prisma.matchDelivery.update({
        where: { id: matchDeliveryId },
        data: {
          status: 'replied',
          repliedAt: new Date(),
        },
        include: {
          matchRequest: {
            include: {
              category: true,
              eventCategory: true,
              user: {
                select: { id: true, name: true, profileImageUrl: true },
              },
            },
          },
        },
      });
    } else {
      return this.prisma.matchDelivery.update({
        where: { id: matchDeliveryId },
        data: {
          status: 'declined',
        },
        include: {
          matchRequest: {
            include: {
              category: true,
              eventCategory: true,
            },
          },
        },
      });
    }
  }
}

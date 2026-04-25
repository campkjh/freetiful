import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';

const CATEGORY_ALIASES: Record<string, string[]> = {
  mc: ['사회자', 'MC', '전문 사회자', '전문사회자', '결혼식 사회자', '결혼식사회자'],
  weddingmc: ['사회자', 'MC', '전문 사회자', '전문사회자', '결혼식 사회자', '결혼식사회자'],
  weddinghost: ['사회자', 'MC', '전문 사회자', '전문사회자', '결혼식 사회자', '결혼식사회자'],
  사회자: ['사회자', 'MC', '전문 사회자', '전문사회자', '결혼식 사회자', '결혼식사회자'],
  전문사회자: ['사회자', 'MC', '전문 사회자', '전문사회자', '결혼식 사회자', '결혼식사회자'],
  결혼식사회자: ['사회자', 'MC', '전문 사회자', '전문사회자', '결혼식 사회자', '결혼식사회자'],
  singer: ['가수', '축가'],
  가수: ['가수', '축가'],
  축가: ['가수', '축가'],
  host: ['쇼호스트', '쇼 호스트'],
  showhost: ['쇼호스트', '쇼 호스트'],
  쇼호스트: ['쇼호스트', '쇼 호스트'],
};

const EVENT_ALIASES: Record<string, string[]> = {
  wedding: ['결혼식', '웨딩', '본식'],
  결혼식: ['결혼식', '웨딩', '본식'],
  birthday: ['생신잔치 (환갑/칠순)', '생신잔치', '환갑', '칠순'],
  생신잔치: ['생신잔치 (환갑/칠순)', '생신잔치', '환갑', '칠순'],
  dol: ['돌잔치', '돌'],
  돌잔치: ['돌잔치', '돌'],
  corporate: ['기업행사', '공식행사', '컨퍼런스', '워크숍', '송년회', '체육대회', '레크리에이션', '팀빌딩', '기업PT', '라이브커머스'],
  기업행사: ['기업행사', '공식행사', '컨퍼런스', '워크숍', '송년회', '체육대회', '레크리에이션', '팀빌딩', '기업PT', '라이브커머스'],
  class: ['강의/클래스', '강의', '클래스'],
  강의클래스: ['강의/클래스', '강의', '클래스'],
};

function normalizeLookupKey(value?: string | null) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s._·・/-]+/g, '');
}

function uniqueStrings(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.map((v) => String(v || '').trim()).filter(Boolean)));
}

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
      selectedProProfileIds?: string[];
      rawUserInput?: any;
    },
  ) {
    if (!data.categoryId) {
      throw new BadRequestException('카테고리를 선택해주세요.');
    }

    const category = await this.resolveCategory(data.categoryId, data.rawUserInput);
    const eventCategory = await this.resolveEventCategory(
      category.id,
      data.eventCategoryId,
      data.rawUserInput,
    );
    const [styleOptionIds, personalityOptionIds] = await Promise.all([
      this.resolveStyleOptionIds(category.id, data.styleOptionIds),
      this.resolvePersonalityOptionIds(data.personalityOptionIds),
    ]);

    const matchRequest = await this.prisma.matchRequest.create({
      data: {
        userId,
        type: data.type,
        categoryId: category.id,
        eventCategoryId: eventCategory?.id,
        eventDate: data.eventDate ? new Date(data.eventDate) : undefined,
        eventTime: data.eventTime
          ? new Date(`1970-01-01T${data.eventTime}`)
          : undefined,
        eventLocation: data.eventLocation,
        budgetMin: data.budgetMin,
        budgetMax: data.budgetMax,
        rawUserInput: this.buildRawUserInput(data.rawUserInput, {
          originalCategoryId: data.categoryId,
          originalEventCategoryId: data.eventCategoryId,
          resolvedCategoryId: category.id,
          resolvedCategoryName: category.name,
          resolvedEventCategoryId: eventCategory?.id,
          resolvedEventCategoryName: eventCategory?.name,
        }),
        styles: styleOptionIds.length
          ? {
              create: styleOptionIds.map((styleOptionId) => ({
                styleOptionId,
              })),
            }
          : undefined,
        personalities: personalityOptionIds.length
          ? {
              create: personalityOptionIds.map(
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

    // 선택한 전문가가 있으면 해당 전문가에게만, 없으면 카테고리 일치 전문가에게 fan-out.
    // 전달 레코드가 만들어진 뒤 성공 응답을 보내야 전문가 홈/새요청에 즉시 보인다.
    await this.fanoutMatchRequestToPros(
      matchRequest.id,
      category.id,
      data.selectedProProfileIds,
    );

    return matchRequest;
  }

  private async resolveCategory(categoryInput: string, rawUserInput?: any) {
    const direct = await this.prisma.category.findUnique({
      where: { id: categoryInput },
    });
    if (direct) return direct;

    const candidates = this.categoryNameCandidates(categoryInput, rawUserInput);
    if (candidates.length > 0) {
      const byName = await this.prisma.category.findFirst({
        where: {
          type: 'pro',
          isActive: true,
          OR: [
            { name: { in: candidates } },
            { nameEn: { in: candidates } },
            ...candidates.map((name) => ({ name: { contains: name } })),
          ],
        },
        orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
      });
      if (byName) return byName;
    }

    const socialHostFallback = await this.prisma.category.findFirst({
      where: {
        type: 'pro',
        isActive: true,
        OR: [
          { name: { contains: '사회자' } },
          { nameEn: { contains: 'MC' } },
          { proCategories: { some: { proProfile: { status: 'approved' } } } },
        ],
      },
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
    });
    if (socialHostFallback) return socialHostFallback;

    throw new NotFoundException('카테고리를 찾을 수 없습니다.');
  }

  private categoryNameCandidates(categoryInput: string, rawUserInput?: any) {
    const rawCandidates = uniqueStrings([
      categoryInput,
      rawUserInput?.categoryName,
      rawUserInput?.category,
      rawUserInput?.serviceCategory,
    ]);
    const aliases = rawCandidates.flatMap((value) => {
      const key = normalizeLookupKey(value);
      return CATEGORY_ALIASES[key] || [];
    });
    return uniqueStrings([...rawCandidates, ...aliases]);
  }

  private async resolveEventCategory(
    categoryId: string,
    eventCategoryInput?: string,
    rawUserInput?: any,
  ) {
    if (eventCategoryInput) {
      const direct = await this.prisma.eventCategory.findUnique({
        where: { id: eventCategoryInput },
      });
      if (direct?.categoryId === categoryId) return direct;
    }

    const candidates = this.eventNameCandidates(eventCategoryInput, rawUserInput);
    if (candidates.length === 0) return undefined;

    return this.prisma.eventCategory.findFirst({
      where: {
        categoryId,
        isActive: true,
        OR: [
          { name: { in: candidates } },
          ...candidates.map((name) => ({ name: { contains: name } })),
          ...candidates.map((name) => ({ name: { startsWith: name } })),
        ],
      },
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
    });
  }

  private eventNameCandidates(eventCategoryInput?: string, rawUserInput?: any) {
    const rawCandidates = uniqueStrings([
      eventCategoryInput,
      rawUserInput?.eventName,
      rawUserInput?.eventType,
    ]);
    const aliases = rawCandidates.flatMap((value) => {
      const key = normalizeLookupKey(value);
      return EVENT_ALIASES[key] || [];
    });
    return uniqueStrings([...rawCandidates, ...aliases]);
  }

  private async resolveStyleOptionIds(categoryId: string, inputs?: string[]) {
    const candidates = uniqueStrings(inputs || []);
    if (candidates.length === 0) return [];

    const options = await this.prisma.styleOption.findMany({
      where: {
        categoryId,
        isActive: true,
        OR: [
          { id: { in: candidates } },
          { name: { in: candidates } },
          ...candidates.map((name) => ({ name: { contains: name } })),
        ],
      },
      select: { id: true },
    });
    return uniqueStrings(options.map((o) => o.id));
  }

  private async resolvePersonalityOptionIds(inputs?: string[]) {
    const candidates = uniqueStrings(inputs || []);
    if (candidates.length === 0) return [];

    const options = await this.prisma.personalityOption.findMany({
      where: {
        isActive: true,
        OR: [
          { id: { in: candidates } },
          { name: { in: candidates } },
          ...candidates.map((name) => ({ name: { contains: name } })),
        ],
      },
      select: { id: true },
    });
    return uniqueStrings(options.map((o) => o.id));
  }

  private buildRawUserInput(rawUserInput: any, resolved: Record<string, any>) {
    const base =
      rawUserInput && typeof rawUserInput === 'object' && !Array.isArray(rawUserInput)
        ? rawUserInput
        : rawUserInput
          ? { value: rawUserInput }
          : {};
    return { ...base, ...resolved };
  }

  /** 새 매칭 요청을 카테고리 일치하는 approved 사회자에게 분배 + 알림 */
  private async fanoutMatchRequestToPros(
    matchRequestId: string,
    categoryId: string,
    selectedProProfileIds?: string[],
  ) {
    let deliveryTargets: Array<{
      proProfileId: string;
      categoryId: string;
      proProfile: {
        user?: { id?: string; name?: string | null } | null;
      } | null;
    }> = [];

    const uniqueSelectedIds = Array.from(new Set(selectedProProfileIds || [])).filter(Boolean);

    if (uniqueSelectedIds.length > 0) {
      const selectedPros = await this.prisma.proProfile.findMany({
        where: {
          id: { in: uniqueSelectedIds },
          status: 'approved',
          isProfileHidden: false,
          user: { isActive: true },
        },
        include: { user: { select: { id: true, name: true } } },
      });
      deliveryTargets = selectedPros.map((proProfile) => ({
        proProfileId: proProfile.id,
        categoryId,
        proProfile,
      }));
    } else {
      const proCategories = await this.prisma.proCategory.findMany({
        where: {
          categoryId,
          proProfile: {
            status: 'approved',
            isProfileHidden: false,
            user: { isActive: true },
          },
        },
        include: {
          proProfile: {
            include: { user: { select: { id: true, name: true } } },
          },
        },
        take: 20, // 무차별 fan-out 방지 — 상위 20명만
      });
      deliveryTargets = proCategories;
    }

    if (deliveryTargets.length === 0 && uniqueSelectedIds.length === 0) {
      const fallbackPros = await this.prisma.proProfile.findMany({
        where: {
          status: 'approved',
          isProfileHidden: false,
          user: { isActive: true },
        },
        include: { user: { select: { id: true, name: true } } },
        take: 20,
      });
      deliveryTargets = fallbackPros.map((proProfile) => ({
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

    for (const pc of deliveryTargets) {
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

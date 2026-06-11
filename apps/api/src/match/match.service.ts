import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { v4 as uuid } from 'uuid';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';
import { ChatRealtimeService } from '../chat/chat-realtime.service';

const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

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
    private chatRealtimeService: ChatRealtimeService,
    private jwt: JwtService,
    private config: ConfigService,
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
        // '협의'/'추후 협의' 같은 비정형 입력 방어 — Invalid Date 로 생성 자체가 500 나던 버그.
        // 원문은 rawUserInput 에 보존되므로 파싱 불가 값은 미정(undefined)으로 저장.
        eventDate: (() => {
          if (!data.eventDate) return undefined;
          const d = new Date(data.eventDate);
          return Number.isNaN(d.getTime()) ? undefined : d;
        })(),
        eventTime: (() => {
          if (!data.eventTime) return undefined;
          const t = new Date(`1970-01-01T${data.eventTime}`);
          return Number.isNaN(t.getTime()) ? undefined : t;
        })(),
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
      category.name,
      data.selectedProProfileIds,
    );

    this.chatRealtimeService.emitMatchUpdated([userId], {
      kind: 'match-request-created',
      matchRequestId: matchRequest.id,
    });

    return matchRequest;
  }

  private async resolveCategory(categoryInput: string, rawUserInput?: any) {
    const uuidLike = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(categoryInput || '');
    const direct = !uuidLike ? null : await this.prisma.category.findUnique({
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
    categoryName: string,
    selectedProProfileIds?: string[],
  ) {
    let deliveryTargets: Array<{ proProfileId: string; userId: string }> = [];

    const uniqueSelectedIds = Array.from(new Set(selectedProProfileIds || [])).filter(Boolean);

    if (uniqueSelectedIds.length > 0) {
      const selectedPros = await this.prisma.proProfile.findMany({
        where: {
          id: { in: uniqueSelectedIds },
          status: 'approved',
          isProfileHidden: false,
          user: { isActive: true },
        },
        select: { id: true, userId: true },
      });
      deliveryTargets = selectedPros.map((proProfile) => ({
        proProfileId: proProfile.id,
        userId: proProfile.userId,
      }));
    } else {
      // 다수견적: 카테고리와 무관하게 승인·활동·노출 중인 "모든 사회자"에게 발송.
      // (이전엔 정확히 일치하는 ProCategory 연결이 있는 사회자에게만 가서, 카테고리
      //  연결 누락/심사상태 등으로 일부 사회자에게 안 가는 문제가 있었음)
      const allPros = await this.prisma.proProfile.findMany({
        where: {
          status: 'approved',
          isProfileHidden: false,
          user: { isActive: true },
        },
        select: { id: true, userId: true },
      });
      deliveryTargets = allPros.map((proProfile) => ({
        proProfileId: proProfile.id,
        userId: proProfile.userId,
      }));
    }

    if (deliveryTargets.length === 0 && uniqueSelectedIds.length === 0) {
      const fallbackPros = await this.prisma.proProfile.findMany({
        where: {
          status: 'approved',
          isProfileHidden: false,
          user: { isActive: true },
        },
        select: { id: true, userId: true },
      });
      deliveryTargets = fallbackPros.map((proProfile) => ({
        proProfileId: proProfile.id,
        userId: proProfile.userId,
      }));
    }

    // 1) MatchDelivery 일괄 생성 — N개의 RTT 를 1번으로 압축
    const validTargets = deliveryTargets.filter((pc) => !!pc.userId);
    if (validTargets.length === 0) return;

    await this.prisma.matchDelivery.createMany({
      data: validTargets.map((pc) => ({
        matchRequestId,
        proProfileId: pc.proProfileId,
      })),
      skipDuplicates: true,
    });

    // 2) 알림은 fire-and-forget — 응답 이후(setImmediate)에 시작해 DB 풀/이벤트루프 경쟁도 차단
    setImmediate(() => {
    for (const pc of validTargets) {
      const proUserId = pc.userId;
      this.notificationService
        .createNotification(
          proUserId,
          'system' as any,
          '새 요청이 도착했습니다',
          `고객님이 ${categoryName || '서비스'} 요청을 보냈습니다.`,
          { type: 'match_request', matchRequestId },
        )
        .catch(() => {});
    }
    });

    this.chatRealtimeService.emitMatchUpdated(
      validTargets.map((target) => target.userId),
      {
        kind: 'match-request-delivered',
        matchRequestId,
      },
    );
    this.chatRealtimeService.emitDashboardUpdated(
      validTargets.map((target) => target.userId),
      {
        kind: 'match-request-delivered',
        matchRequestId,
      },
    );
  }

  /** 사용자의 매칭 요청 목록 */
  async getMatchRequests(userId: string, skip = 0, take = 8) {
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
        chatRooms: {
          include: {
            proProfile: {
              include: {
                user: {
                  select: { id: true, name: true, profileImageUrl: true },
                },
                images: { where: { isPrimary: true }, take: 1 },
              },
            },
            quotations: {
              orderBy: { createdAt: 'desc' },
              take: 1,
              include: { payment: true },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: Math.max(0, Number(skip) || 0),
      take: Math.min(Math.max(1, Number(take) || 8), 50),
    });
  }

  /** 전문가에게 전달된 매칭 요청 목록 */
  // userId 로 직접 조인 — 컨트롤러의 proProfile 선조회(DB 왕복 1회) 제거용
  async getMatchRequestsForProUser(userId: string, limit = 50, skip = 0) {
    return this.getMatchRequestsForProWhere({ proProfile: { userId } }, limit, skip);
  }

  async getMatchRequestsForPro(proProfileId: string, limit = 50, skip = 0) {
    return this.getMatchRequestsForProWhere({ proProfileId }, limit, skip);
  }

  private async getMatchRequestsForProWhere(proWhere: any, limit = 50, skip = 0) {
    const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 100);
    // 새 요청 섹션은 pending/viewed, 보관 탭은 archived 만 사용한다.
    // 거절/응답 이력은 DB 단계에서 제외해 전체 매칭 히스토리를 끌어오는 비용을 없앤다.
    const deliveries = await this.prisma.matchDelivery.findMany({
      where: { ...proWhere, status: { in: ['pending', 'viewed', 'archived'] } },
      select: {
        id: true,
        matchRequestId: true,
        proProfileId: true,
        status: true,
        deliveredAt: true,
        viewedAt: true,
        repliedAt: true,
        matchRequest: {
          select: {
            id: true,
            userId: true,
            type: true,
            eventDate: true,
            eventTime: true,
            eventLocation: true,
            rawUserInput: true,
            createdAt: true,
            category: { select: { id: true, name: true } },
            eventCategory: { select: { id: true, name: true } },
            user: {
              select: { id: true, name: true, profileImageUrl: true },
            },
          },
        },
      },
      orderBy: { deliveredAt: 'desc' },
      take: safeLimit,
      skip: Math.max(0, Number(skip) || 0),
    });

    return deliveries;
  }

  /** 전문가가 매칭 요청에 응답 (수락/거절) */
  async respondToMatch(
    proProfileId: string,
    matchDeliveryId: string,
    action: 'accept' | 'reject' | 'archive',
    message?: string,
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
    const proDisplayName =
      proName === '사회자' ? '해당 사회자' : proName.includes('사회자') ? proName : `${proName} 사회자`;
    const customerId = delivery.matchRequest?.user?.id;

    if (action === 'archive') {
      const archived = await this.prisma.matchDelivery.update({
        where: { id: matchDeliveryId },
        data: { status: 'archived' },
        include: {
          matchRequest: { include: { category: true, eventCategory: true } },
        },
      });
      this.chatRealtimeService.emitMatchUpdated([customerId, delivery.proProfile?.user?.id], {
        kind: 'match-request-archived',
        matchDeliveryId,
        matchRequestId: delivery.matchRequestId,
      });
      this.chatRealtimeService.emitDashboardUpdated([customerId, delivery.proProfile?.user?.id], {
        kind: 'match-request-archived',
        matchDeliveryId,
        matchRequestId: delivery.matchRequestId,
      });
      return archived;
    }

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

      this.chatRealtimeService.emitMatchUpdated([customerId, delivery.proProfile?.user?.id], {
        kind: 'match-request-accepted',
        matchDeliveryId,
        matchRequestId: delivery.matchRequestId,
      });
      this.chatRealtimeService.emitDashboardUpdated([customerId, delivery.proProfile?.user?.id], {
        kind: 'match-request-accepted',
        matchDeliveryId,
        matchRequestId: delivery.matchRequestId,
      });

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
          '다른 전문가를 추천드릴게요',
          message?.trim()
            ? `${proDisplayName}: "${message.trim()}"`
            : `${proDisplayName}의 일정 또는 조건이 맞지 않아요. 프리티풀에서 다른 전문가를 바로 확인해보세요.`,
          { matchDeliveryId, proProfileId },
        ).catch(() => {});
      }

      this.chatRealtimeService.emitMatchUpdated([customerId, delivery.proProfile?.user?.id], {
        kind: 'match-request-declined',
        matchDeliveryId,
        matchRequestId: delivery.matchRequestId,
      });
      this.chatRealtimeService.emitDashboardUpdated([customerId, delivery.proProfile?.user?.id], {
        kind: 'match-request-declined',
        matchDeliveryId,
        matchRequestId: delivery.matchRequestId,
      });

      return result;
    }
  }

  /**
   * 랜딩 페이지 익명 제출 — 전화번호로 User upsert + 토큰 발급 + 다수견적 생성.
   * Bearer 토큰이 있으면 그 user 재사용 (소셜 로그인된 케이스).
   */
  async createQuickRequest(
    authorizationHeader: string | undefined,
    body: {
      name?: string;
      phone: string;
      categoryId: string;
      eventCategoryId?: string;
      eventDate?: string;
      eventTime?: string;
      eventLocation?: string;
      type?: 'multi' | 'single';
      selectedProProfileIds?: string[];
      rawUserInput?: any;
    },
  ) {
    const phone = (body.phone || '').replace(/[^0-9]/g, '');
    if (phone.length < 9 || phone.length > 13) {
      throw new BadRequestException('유효한 전화번호를 입력해주세요.');
    }
    if (!body.categoryId) {
      throw new BadRequestException('카테고리를 선택해주세요.');
    }

    let userId = await this.resolveUserIdFromAuthHeader(authorizationHeader);
    let resolvedUser: any = null;   // 마지막 중복 findUnique 제거용

    if (userId) {
      // 로그인 상태 — 전화번호가 비어있으면 채워주기만 함
      const existing = await this.prisma.user.findUnique({ where: { id: userId } });
      resolvedUser = existing;
      if (existing && !existing.phone) {
        this.prisma.user
          .update({ where: { id: userId }, data: { phone } })
          .then((u) => { resolvedUser = u; })
          .catch(() => {});
      }
    } else {
      const name = (body.name || '').trim();
      if (!name) {
        throw new BadRequestException('이름을 입력해주세요.');
      }
      const byPhone = await this.prisma.user.findUnique({ where: { phone } });
      if (byPhone) {
        userId = byPhone.mergedToUserId || byPhone.id;
        resolvedUser = byPhone;
        if (!byPhone.name || byPhone.name.startsWith('[merged]')) {
          this.prisma.user
            .update({ where: { id: userId }, data: { name } })
            .then((u) => { resolvedUser = u; })
            .catch(() => {});
        }
      } else {
        const created = await this.prisma.user.create({
          data: {
            role: 'general',
            name,
            phone,
            referralCode: `FT${uuid().replace(/-/g, '').slice(0, 8).toUpperCase()}`,
          },
        });
        userId = created.id;
        resolvedUser = created;
      }
    }

    // 매칭 생성과 토큰 발급은 독립 — 병렬 실행으로 응답 단축
    const [matchRequest, tokens] = await Promise.all([
      this.createMatchRequest(userId, {
        categoryId: body.categoryId,
        eventCategoryId: body.eventCategoryId,
        eventDate: body.eventDate,
        eventTime: body.eventTime,
        eventLocation: body.eventLocation,
        type: body.type || (body.selectedProProfileIds?.length ? 'single' : 'multi'),
        selectedProProfileIds: body.selectedProProfileIds,
        rawUserInput: body.rawUserInput,
      }),
      this.issueTokensForUser(userId),
    ]);
    const user = resolvedUser ?? (await this.prisma.user.findUnique({ where: { id: userId } }));

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: tokens.expiresIn,
      user,
      matchRequest,
    };
  }

  private async resolveUserIdFromAuthHeader(header: string | undefined): Promise<string | null> {
    if (!header) return null;
    const m = header.match(/^Bearer\s+(.+)$/i);
    if (!m) return null;
    try {
      const payload = this.jwt.verify(m[1]) as { sub?: string };
      if (!payload?.sub) return null;
      const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
      if (!user || !user.isActive || user.isBanned) return null;
      return user.mergedToUserId || user.id;
    } catch {
      return null;
    }
  }

  private async issueTokensForUser(userId: string) {
    const accessToken = this.jwt.sign(
      { sub: userId },
      { expiresIn: this.config.get('JWT_EXPIRES_IN', '7d') },
    );
    const refreshToken = uuid();
    const refreshTokenHash = await bcrypt.hash(refreshToken, 8)   // 랜덤 토큰 해시 — cost 10→8 (응답 단축);
    await this.prisma.session.create({
      data: {
        userId,
        refreshTokenHash,
        deviceInfo: { platform: 'web', source: 'landing_wedding_mc', userAgent: null },
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
      },
    });
    return { accessToken, refreshToken, expiresIn: 900 };
  }
}

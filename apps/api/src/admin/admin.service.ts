import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';
import { ProService } from '../pro/pro.service';
import { DiscoveryService } from '../discovery/discovery.service';
import { ImageService } from '../image/image.service';
import {
  extractBusinessVisibilityFromHtml,
  normalizeBusinessTags,
  resolveBusinessTags,
  stripBusinessTagMarker,
  withBusinessTagMarker,
  withBusinessVisibilityMarker,
} from '../business/business-tags';
import { Decimal } from '@prisma/client/runtime/library';
import { randomUUID } from 'crypto';

const REFERRAL_EVENT_CAMPAIGN_KEY = 'friend-invite-cash-2026';
const REFERRAL_EVENT_REQUIRED_REFERRALS = 4;

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);
  private readonly editableUserRoles = ['general', 'pro', 'business', 'admin'];
  constructor(
    private prisma: PrismaService,
    private notificationService: NotificationService,
    private proService: ProService,
    private discoveryService: DiscoveryService,
    private imageService: ImageService,
  ) {}

  private async safeStatsQuery<T>(label: string, query: Promise<T>, fallback: T): Promise<T> {
    try {
      return await query;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Admin stats query failed (${label}): ${message}`);
      return fallback;
    }
  }

  private buildDateRange(params?: { startDate?: string; endDate?: string }) {
    const range: any = {};
    if (params?.startDate) {
      const start = this.parseAdminDate(params.startDate, false);
      if (!Number.isNaN(start.getTime())) {
        range.gte = start;
      }
    }
    if (params?.endDate) {
      const end = this.parseAdminDate(params.endDate, true);
      if (!Number.isNaN(end.getTime())) {
        range.lte = end;
      }
    }
    return Object.keys(range).length ? range : undefined;
  }

  private parseAdminDate(value: string, endOfDay: boolean) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return new Date(`${value}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}+09:00`);
    }
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      date.setHours(endOfDay ? 23 : 0, endOfDay ? 59 : 0, endOfDay ? 59 : 0, endOfDay ? 999 : 0);
    }
    return date;
  }

  private applyCreatedAtRange(where: any, params?: { startDate?: string; endDate?: string }) {
    const range = this.buildDateRange(params);
    if (range) where.createdAt = range;
  }

  private parseAdminDateTime(value?: string | null, fallback = new Date()) {
    if (!value) return fallback;
    const normalized = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)
      ? `${value}:00.000+09:00`
      : value;
    const date = new Date(normalized);
    return Number.isNaN(date.getTime()) ? fallback : date;
  }

  private parseEventDate(value?: string | null) {
    if (!value) return null;
    const date = /^\d{4}-\d{2}-\d{2}$/.test(value)
      ? new Date(`${value}T00:00:00.000+09:00`)
      : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  private parseEventTime(value?: string | null) {
    if (!value) return null;
    const withSeconds = value.length === 5 ? `${value}:00` : value;
    const date = new Date(`1970-01-01T${withSeconds}.000+09:00`);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  private isKakaoSeededBusinessEmail(email?: string | null) {
    return !!email && email.startsWith('kakao-') && email.endsWith('@freetiful.local');
  }

  private resolveBusinessVisibility(input: { descriptionHtml?: string | null; user?: { email?: string | null } | null }) {
    const explicitVisibility = extractBusinessVisibilityFromHtml(input.descriptionHtml);
    if (typeof explicitVisibility === 'boolean') return explicitVisibility;
    return !this.isKakaoSeededBusinessEmail(input.user?.email);
  }

  private async recalculateProReviewStats(proProfileId: string) {
    const reviews = await this.prisma.review.findMany({
      where: { proProfileId, isVisible: true },
      select: { avgRating: true },
    });
    const avg = reviews.length
      ? reviews.reduce((sum, review) => sum + Number(review.avgRating), 0) / reviews.length
      : 0;
    await this.prisma.proProfile.update({
      where: { id: proProfileId },
      data: {
        avgRating: new Decimal(avg.toFixed(2)),
        reviewCount: reviews.length,
      },
    });
    // 평점/리뷰수 변경 → 디스커버리 캐시 무효화
    this.discoveryService.invalidateCache(proProfileId);
  }

  private formatAdminProProfileSummary(profile: {
    id: string;
    status: string;
    shortIntro: string | null;
    _count?: { images: number; services: number };
  }) {
    const imageCount = profile._count?.images || 0;
    const serviceCount = profile._count?.services || 0;
    return {
      id: profile.id,
      status: profile.status,
      hasIntro: !!profile.shortIntro,
      imageCount,
      serviceCount,
      isEmpty: !profile.shortIntro && imageCount === 0 && serviceCount === 0,
    };
  }

  private async ensureApprovedProProfile(userId: string) {
    const now = new Date();
    const profile = await this.prisma.proProfile.upsert({
      where: { userId },
      create: {
        userId,
        status: 'approved',
        approvedAt: now,
      },
      update: {
        status: 'approved',
        approvedAt: now,
      },
      select: {
        id: true,
        status: true,
        shortIntro: true,
        _count: { select: { images: true, services: true } },
      },
    });
    this.discoveryService.invalidateCache(profile.id);
    return this.formatAdminProProfileSummary(profile);
  }

  private normalizeDevicePlatform(value?: string | null, userAgent?: string | null) {
    const raw = `${value || ''} ${userAgent || ''}`.toLowerCase();
    if (/iphone|ipad|ipod|\bios\b/.test(raw)) return 'ios';
    if (/android/.test(raw)) return 'android';
    if (/web|browser|chrome|safari|firefox|edge|mozilla/.test(raw)) return 'web';
    if (/native|app/.test(raw)) return 'app';
    return '';
  }

  private formatDevicePlatform(platform?: string | null) {
    if (platform === 'ios') return 'iOS';
    if (platform === 'android') return 'Android';
    if (platform === 'web') return 'Web';
    if (platform === 'app') return 'App';
    return 'Web';
  }

  private resolveUserSignupDevice(user: {
    pushTokens?: Array<{ platform: string | null; isActive?: boolean; createdAt?: Date }>;
    sessions?: Array<{ deviceInfo: any; createdAt?: Date }>;
  }) {
    const activePush = user.pushTokens?.find((token) => token.isActive !== false);
    const anyPush = user.pushTokens?.[0];
    const pushPlatform = this.normalizeDevicePlatform(activePush?.platform || anyPush?.platform);
    if (pushPlatform) {
      return {
        platform: pushPlatform,
        label: this.formatDevicePlatform(pushPlatform),
        source: 'push',
      };
    }

    const session = user.sessions?.[0];
    const info = session?.deviceInfo || {};
    const sessionPlatform = this.normalizeDevicePlatform(
      info.platform || info.os || info.deviceType || info.source,
      info.userAgent,
    );
    if (sessionPlatform) {
      return {
        platform: sessionPlatform,
        label: this.formatDevicePlatform(sessionPlatform),
        source: 'session',
      };
    }

    return {
      platform: 'web',
      label: 'Web',
      source: 'fallback',
    };
  }

  // ─── 웨딩 파트너 업체 (BusinessProfile) CRUD ────────────────────────────
  // 어드민이 직접 업체를 등록/수정/삭제. 소유 유저가 없으면 placeholder User 자동 생성.
  async getBusinesses(params: { page?: number; limit?: number; search?: string; startDate?: string; endDate?: string }) {
    const page = params.page || 1;
    const limit = params.limit || 20;
    const where: any = {};
    this.applyCreatedAtRange(where, params);
    if (params.search) {
      where.OR = [
        { businessName: { contains: params.search, mode: 'insensitive' } },
        { businessType: { contains: params.search, mode: 'insensitive' } },
        { address: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.businessProfile.findMany({
        where,
        include: {
          user: { select: { email: true } },
          images: { orderBy: { displayOrder: 'asc' }, take: 1, select: { imageUrl: true } },
          categories: { include: { category: { select: { id: true, name: true } } } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.businessProfile.count({ where }),
    ]);

    return {
      data: data.map((b) => ({
        id: b.id,
        businessName: b.businessName,
        businessType: b.businessType,
        address: b.address,
        phone: b.phone,
        status: b.status,
        isVisible: this.resolveBusinessVisibility(b),
        tags: resolveBusinessTags(b),
        createdAt: b.createdAt,
        images: b.images.map((i) => ({ imageUrl: i.imageUrl })),
        categories: b.categories.map((c) => ({ category: { name: c.category.name } })),
      })),
      total,
      page,
      limit,
    };
  }

  async getBusinessDetail(id: string) {
    const business = await this.prisma.businessProfile.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, email: true } },
        images: { orderBy: { displayOrder: 'asc' } },
        categories: { include: { category: true } },
      },
    });
    if (!business) throw new NotFoundException('업체를 찾을 수 없습니다');
    return {
      ...business,
      isVisible: this.resolveBusinessVisibility(business),
      descriptionHtml: stripBusinessTagMarker(business.descriptionHtml),
      tags: resolveBusinessTags(business),
    };
  }

  async createBusiness(data: {
    businessName: string;
    businessType?: string;
    address?: string;
    addressDetail?: string;
    phone?: string;
    lat?: number | string;
    lng?: number | string;
    descriptionHtml?: string;
    instagramUrl?: string;
    websiteUrl?: string;
    videoUrl?: string;
    tags?: string[];
    categoryNames?: string[];
    status?: string;
    isVisible?: boolean | null;
  }) {
    if (!data.businessName || !data.businessName.trim()) {
      throw new NotFoundException('업체명은 필수입니다');
    }

    // placeholder User (role=business) 자동 생성 — BusinessProfile.userId 제약 때문
    const placeholderEmail = `biz-${randomUUID()}@freetiful.internal`;
    const user = await this.prisma.user.create({
      data: {
        name: data.businessName,
        email: placeholderEmail,
        role: 'business',
        referralCode: Math.random().toString(36).substring(2, 10).toUpperCase(),
      },
    });

    // 카테고리 이름 → id 매핑 (type=business 에 한해)
    const categoryIds: string[] = [];
    if (Array.isArray(data.categoryNames) && data.categoryNames.length > 0) {
      const cats = await this.prisma.category.findMany({
        where: { type: 'business', name: { in: data.categoryNames } },
        select: { id: true },
      });
      categoryIds.push(...cats.map((c) => c.id));
    }

    const descriptionHtml = withBusinessVisibilityMarker(
      withBusinessTagMarker(data.descriptionHtml, data.tags),
      data.isVisible ?? true,
    );

    const profile = await this.prisma.businessProfile.create({
      data: {
        userId: user.id,
        businessName: data.businessName,
        status: (data.status as any) || 'approved',
        businessType: data.businessType || null,
        address: data.address || null,
        addressDetail: data.addressDetail || null,
        phone: data.phone || null,
        lat: data.lat !== undefined && data.lat !== null && data.lat !== '' ? Number(data.lat) : null,
        lng: data.lng !== undefined && data.lng !== null && data.lng !== '' ? Number(data.lng) : null,
        descriptionHtml,
        instagramUrl: data.instagramUrl || null,
        websiteUrl: data.websiteUrl || null,
        videoUrl: data.videoUrl || null,
        approvedAt: (data.status as any) === 'approved' || !data.status ? new Date() : null,
        categories: categoryIds.length
          ? { create: categoryIds.map((categoryId) => ({ categoryId })) }
          : undefined,
      },
      include: {
        images: { orderBy: { displayOrder: 'asc' } },
        categories: { include: { category: true } },
      },
    });
    return { ...profile, tags: resolveBusinessTags(profile) };
  }

  async updateBusiness(
    id: string,
    data: {
      businessName?: string;
      businessType?: string;
      address?: string;
      addressDetail?: string;
      phone?: string;
      lat?: number | string | null;
      lng?: number | string | null;
      descriptionHtml?: string;
      instagramUrl?: string;
      websiteUrl?: string;
      videoUrl?: string;
      tags?: string[];
      categoryNames?: string[];
      status?: string;
      isVisible?: boolean | null;
    },
  ) {
    const existing = await this.prisma.businessProfile.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('업체를 찾을 수 없습니다');

    const allowed: any = {};
    if (data.businessName !== undefined) allowed.businessName = data.businessName;
    if (data.businessType !== undefined) allowed.businessType = data.businessType || null;
    if (data.address !== undefined) allowed.address = data.address || null;
    if (data.addressDetail !== undefined) allowed.addressDetail = data.addressDetail || null;
    if (data.phone !== undefined) allowed.phone = data.phone || null;
    if (data.lat !== undefined) allowed.lat = data.lat === null || data.lat === '' ? null : Number(data.lat);
    if (data.lng !== undefined) allowed.lng = data.lng === null || data.lng === '' ? null : Number(data.lng);
    let nextDescriptionHtml = existing.descriptionHtml;
    if (data.descriptionHtml !== undefined || data.tags !== undefined) {
      nextDescriptionHtml = withBusinessTagMarker(
        data.descriptionHtml !== undefined ? data.descriptionHtml : existing.descriptionHtml,
        data.tags !== undefined ? normalizeBusinessTags(data.tags) : resolveBusinessTags(existing),
      );
      allowed.descriptionHtml = nextDescriptionHtml;
    }
    if (data.instagramUrl !== undefined) allowed.instagramUrl = data.instagramUrl || null;
    if (data.websiteUrl !== undefined) allowed.websiteUrl = data.websiteUrl || null;
    if (data.videoUrl !== undefined) allowed.videoUrl = data.videoUrl || null;
    if (data.isVisible !== undefined) {
      const visibilitySource = data.descriptionHtml !== undefined || data.tags !== undefined
        ? nextDescriptionHtml
        : existing.descriptionHtml;
      allowed.descriptionHtml = withBusinessVisibilityMarker(visibilitySource, data.isVisible);
    }
    if (data.status !== undefined) {
      allowed.status = data.status as any;
      if (data.status === 'approved' && !existing.approvedAt) allowed.approvedAt = new Date();
    }

    // 카테고리 갱신 — 전체 치환 방식 (요청에 categoryNames 포함된 경우에만)
    if (Array.isArray(data.categoryNames)) {
      const cats = await this.prisma.category.findMany({
        where: { type: 'business', name: { in: data.categoryNames } },
        select: { id: true },
      });
      await this.prisma.businessCategory.deleteMany({ where: { businessProfileId: id } });
      if (cats.length > 0) {
        await this.prisma.businessCategory.createMany({
          data: cats.map((c) => ({ businessProfileId: id, categoryId: c.id })),
          skipDuplicates: true,
        });
      }
    }

    const profile = await this.prisma.businessProfile.update({
      where: { id },
      data: allowed,
      include: {
        images: { orderBy: { displayOrder: 'asc' } },
        categories: { include: { category: true } },
      },
    });
    return { ...profile, tags: resolveBusinessTags(profile) };
  }

  async deleteBusiness(id: string) {
    const existing = await this.prisma.businessProfile.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('업체를 찾을 수 없습니다');
    // cascade 가 images/categories 를 자동 삭제 — placeholder user 도 함께 정리
    const userId = existing.userId;
    await this.prisma.businessProfile.delete({ where: { id } });
    // placeholder biz-*@freetiful.internal 유저만 삭제 (실제 유저 보호)
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
    if (user?.email?.startsWith('biz-') && user.email.endsWith('@freetiful.internal')) {
      await this.prisma.user.delete({ where: { id: userId } }).catch(() => {});
    }
    return { success: true };
  }

  async uploadBusinessImage(businessId: string, file: Express.Multer.File) {
    const existing = await this.prisma.businessProfile.findUnique({ where: { id: businessId } });
    if (!existing) throw new NotFoundException('업체를 찾을 수 없습니다');

    const processed = await this.imageService.processImage(file, {
      maxWidth: 1600,
      maxHeight: 1600,
      quality: 85,
      requireFace: false,
    });

    const last = await this.prisma.businessImage.findFirst({
      where: { businessProfileId: businessId },
      orderBy: { displayOrder: 'desc' },
      select: { displayOrder: true },
    });
    const nextOrder = (last?.displayOrder ?? -1) + 1;

    const img = await this.prisma.businessImage.create({
      data: {
        businessProfileId: businessId,
        imageUrl: processed.path,
        displayOrder: nextOrder,
      },
    });
    return img;
  }

  /** 리치텍스트 에디터(상세페이지 HTML) 인라인 이미지 업로드 → URL 반환 */
  async uploadEditorImage(file: Express.Multer.File) {
    if (!file) throw new BadRequestException('이미지 파일이 필요합니다.');
    const processed = await this.imageService.processImage(file, {
      maxWidth: 1600,
      maxHeight: 1600,
      quality: 85,
      requireFace: false,
    });
    return { url: processed.path };
  }

  /** 사회자 소개영상 업로드(어드민) — 원본 저장(/uploads/:id, Range 재생·비율 유지) → URL 반환 */
  async uploadVideo(file: Express.Multer.File) {
    if (!file?.buffer?.length) throw new BadRequestException('영상 파일이 필요합니다.');
    const mime = file.mimetype || '';
    const isVideo = mime.startsWith('video/') || /\.(mp4|mov|m4v|webm|3gp)$/i.test(file.originalname || '');
    if (!isVideo) throw new BadRequestException('동영상 파일만 업로드할 수 있습니다.');
    const url = await this.imageService.saveRawMedia(file.buffer, mime || 'video/mp4', file.originalname);
    return { url };
  }

  async deleteBusinessImage(businessId: string, imageId: string) {
    const img = await this.prisma.businessImage.findUnique({ where: { id: imageId } });
    if (!img || img.businessProfileId !== businessId) {
      throw new NotFoundException('이미지를 찾을 수 없습니다');
    }
    await this.prisma.businessImage.delete({ where: { id: imageId } });
    return { success: true };
  }

  async reorderBusinessImages(businessId: string, imageIds: string[]) {
    const images = await this.prisma.businessImage.findMany({
      where: { businessProfileId: businessId, id: { in: imageIds } },
      select: { id: true },
    });
    const validIds = new Set(images.map((i) => i.id));
    await this.prisma.$transaction(
      imageIds
        .filter((id) => validIds.has(id))
        .map((id, idx) =>
          this.prisma.businessImage.update({
            where: { id },
            data: { displayOrder: idx },
          }),
        ),
    );
    return { success: true };
  }

  async getBusinessCategories() {
    return this.prisma.category.findMany({
      where: { type: 'business', isActive: true },
      orderBy: { displayOrder: 'asc' },
      select: { id: true, name: true, nameEn: true, iconUrl: true, displayOrder: true },
    });
  }

  // ─── Pro 목록 조회 (관리자용) ─────────────────────────────────────────────
  async getPros(params: { page?: number; limit?: number; status?: string; search?: string; startDate?: string; endDate?: string }) {
    const page = params.page || 1;
    const limit = params.limit || 20;
    const visibleStatuses = ['draft', 'pending', 'approved', 'rejected', 'suspended'];
    const where: any = {};
    this.applyCreatedAtRange(where, params);
    if (params.status && visibleStatuses.includes(params.status)) {
      where.status = params.status;
    } else {
      where.status = { in: visibleStatuses };
    }
    if (params.search) {
      where.OR = [
        { user: { name: { contains: params.search, mode: 'insensitive' } } },
        { user: { email: { contains: params.search, mode: 'insensitive' } } },
        { user: { phone: { contains: params.search, mode: 'insensitive' } } },
        { shortIntro: { contains: params.search, mode: 'insensitive' } },
        { mainExperience: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.proProfile.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, profileImageUrl: true, email: true } },
          images: { where: { isPrimary: true }, take: 1 },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.proProfile.count({ where }),
    ]);

    return {
      data: data.map((p) => ({
        id: p.id,
        userId: p.userId,
        name: p.user.name,
        email: p.user.email,
        image: p.images[0]?.imageUrl || p.user.profileImageUrl,
        status: p.status,
        avgRating: Number(p.avgRating),
        reviewCount: p.reviewCount,
        isFeatured: p.isFeatured,
        showPartnersLogo: p.showPartnersLogo,
        isProfileHidden: p.isProfileHidden,
        createdAt: p.createdAt,
      })),
      total,
      page,
      limit,
    };
  }

  // ─── Pro 상세 조회 ─────────────────────────────────────────────────────────
  async getProDetail(proProfileId: string) {
    const profile = await this.prisma.proProfile.findUnique({
      where: { id: proProfileId },
      include: {
        user: { select: { id: true, email: true, name: true, phone: true, profileImageUrl: true, role: true, isActive: true, isBanned: true } },
        images: { orderBy: { displayOrder: 'asc' } },
        services: { orderBy: { displayOrder: 'asc' } },
        faqs: { orderBy: { displayOrder: 'asc' } },
        categories: { include: { category: true } },
        regions: { include: { region: true } },
        languages: true,
        _count: {
          select: {
            images: true,
            services: true,
            reviews: true,
            quotations: true,
            chatRooms: true,
            matchDeliveries: true,
          },
        },
      },
    });
    if (!profile) throw new NotFoundException('전문가를 찾을 수 없습니다');
    const adminRelations = await this.getProAdminRelations(proProfileId);
    return { ...profile, adminRelations };
  }

  private async getProAdminRelations(proProfileId: string) {
    const [
      chatRooms,
      quotations,
      payments,
      reviews,
      matchDeliveries,
      settlementLogs,
    ] = await Promise.all([
      this.prisma.chatRoom.findMany({
        where: { proProfileId },
        include: {
          user: { select: { id: true, name: true, email: true, profileImageUrl: true } },
          matchRequest: { select: { id: true, eventDate: true, eventLocation: true, status: true } },
          _count: { select: { messages: true, quotations: true } },
        },
        orderBy: { lastMessageAt: 'desc' },
        take: 50,
      }),
      this.prisma.quotation.findMany({
        where: { proProfileId },
        include: {
          payment: { select: { id: true, amount: true, status: true, createdAt: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      this.prisma.payment.findMany({
        where: { proProfileId },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      this.prisma.review.findMany({
        where: { proProfileId },
        include: {
          reviewer: { select: { id: true, name: true, email: true } },
          payment: { select: { id: true, amount: true, status: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      this.prisma.matchDelivery.findMany({
        where: { proProfileId },
        include: {
          matchRequest: {
            include: {
              user: { select: { id: true, name: true, email: true, phone: true } },
              category: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: { deliveredAt: 'desc' },
        take: 50,
      }),
      this.prisma.settlementLog.findMany({
        where: { proProfileId },
        include: { payment: { select: { id: true, amount: true, status: true, createdAt: true } } },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
    ]);

    const userIds = Array.from(new Set([...quotations.map((q) => q.userId), ...payments.map((p) => p.userId)].filter(Boolean)));
    const users = userIds.length
      ? await this.prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, email: true, phone: true } })
      : [];
    const userMap = new Map(users.map((u) => [u.id, u]));

    return {
      chatRooms,
      quotations: quotations.map((q) => ({ ...q, user: userMap.get(q.userId) || null })),
      payments: payments.map((p) => ({ ...p, user: userMap.get(p.userId) || null })),
      reviews,
      matchDeliveries,
      settlementLogs,
    };
  }

  // ─── Pro 프로필 업데이트 (어드민이 직접 수정) ────────────────────────────────
  async updatePro(proProfileId: string, data: any) {
    const allowed: any = {};
    const editableFields = [
      'shortIntro', 'mainExperience', 'careerYears', 'awards',
      'youtubeUrl', 'detailHtml', 'gender',
      'isFeatured', 'showPartnersLogo', 'isProfileHidden', 'status',
    ];
    for (const k of editableFields) if (data[k] !== undefined) allowed[k] = data[k];
    if (data.status === 'approved') allowed.approvedAt = new Date();

    const profile = await this.prisma.proProfile.update({
      where: { id: proProfileId },
      data: allowed,
      include: {
        user: { select: { id: true, email: true, name: true, phone: true } },
      },
    });

    // User 레벨 필드도 함께 수정 가능
    if (data.name !== undefined || data.phone !== undefined) {
      await this.prisma.user.update({
        where: { id: profile.userId },
        data: {
          ...(data.name !== undefined && String(data.name).trim() ? { name: String(data.name).trim() } : {}),
          ...(data.phone !== undefined ? { phone: data.phone == null ? null : String(data.phone).trim() || null } : {}),
        },
      });
    }
    if (data.status === 'approved') {
      await this.prisma.user.update({
        where: { id: profile.userId },
        data: { role: 'pro' },
      });
    }

    this.discoveryService.invalidateCache(proProfileId);
    return profile;
  }

  // ─── Pro 프로필 전체 수정 (submitRegistration 재사용) ────────────────────
  // 사진, 서비스, FAQ, 언어 등 전체 필드를 어드민이 수정 가능
  async fullUpdatePro(proProfileId: string, data: any) {
    const profile = await this.prisma.proProfile.findUnique({
      where: { id: proProfileId },
      select: { userId: true, status: true },
    });
    if (!profile) throw new NotFoundException('전문가를 찾을 수 없습니다');

    // submitRegistration 호출 (name 은 제외 — 어드민은 아래에서 User 직접 수정)
    await this.proService.submitRegistration(profile.userId, {
      phone: data.phone,
      gender: data.gender,
      shortIntro: data.shortIntro,
      mainExperience: data.mainExperience,
      careerYears: data.careerYears !== undefined ? Number(data.careerYears) : undefined,
      awards: data.awards,
      youtubeUrl: data.youtubeUrl,
      detailHtml: data.detailHtml,
      photos: Array.isArray(data.photos) ? data.photos : undefined,
      mainPhotoIndex: data.mainPhotoIndex,
      services: Array.isArray(data.services) ? data.services : undefined,
      faqs: Array.isArray(data.faqs) ? data.faqs : undefined,
      languages: Array.isArray(data.languages) ? data.languages : undefined,
      category: typeof data.category === 'string' ? data.category : undefined,
      regions: Array.isArray(data.regions) ? data.regions : undefined,
      tags: Array.isArray(data.tags) ? data.tags : undefined,
    });

    if (Array.isArray(data.photos) && data.photos.length === 0) {
      await this.prisma.proProfileImage.deleteMany({ where: { proProfileId } });
      await this.prisma.user.update({
        where: { id: profile.userId },
        data: { profileImageUrl: null },
      });
    }

    // 어드민은 User.name/phone 과 승인 role 을 직접 바꿀 수 있음
    const userPatch: any = {};
    if (data.name !== undefined && String(data.name).trim()) userPatch.name = String(data.name).trim();
    if (data.phone !== undefined) userPatch.phone = data.phone == null ? null : String(data.phone).trim() || null;
    if (data.status === 'approved') userPatch.role = 'pro';
    if (Object.keys(userPatch).length > 0) {
      await this.prisma.user.update({
        where: { id: profile.userId },
        data: userPatch,
      });
    }

    // 어드민만 수정 가능한 flag 필드
    const adminOnly: any = {};
    if (data.isFeatured !== undefined) adminOnly.isFeatured = data.isFeatured;
    if (data.showPartnersLogo !== undefined) adminOnly.showPartnersLogo = data.showPartnersLogo;
    if (data.isProfileHidden !== undefined) adminOnly.isProfileHidden = data.isProfileHidden;
    if (data.status !== undefined) {
      adminOnly.status = data.status;
      if (data.status === 'approved') adminOnly.approvedAt = new Date();
    }
    if (Object.keys(adminOnly).length > 0) {
      await this.prisma.proProfile.update({
        where: { id: proProfileId },
        data: adminOnly,
      });
    }

    this.discoveryService.invalidateCache(proProfileId);
    return this.getProDetail(proProfileId);
  }

  // ─── 기존 계정 → 대상 계정으로 프로 프로필 이관 ─────────────────────────
  // sourceEmail 의 ProProfile(+이미지/서비스/FAQ/리뷰 등 연관 데이터)을
  // targetEmail 계정으로 통째로 옮기고, source 계정은 비활성화(email 변경)
  async transferProProfile(sourceEmail: string, targetEmail: string) {
    if (!sourceEmail || !targetEmail) {
      throw new NotFoundException('sourceEmail, targetEmail 필요');
    }

    const source = await this.prisma.user.findUnique({
      where: { email: sourceEmail },
      include: { proProfile: true },
    });
    if (!source) throw new NotFoundException(`source 계정 없음: ${sourceEmail}`);
    if (!source.proProfile) throw new NotFoundException(`source 계정에 프로필 없음`);

    const target = await this.prisma.user.findUnique({
      where: { email: targetEmail },
      include: { proProfile: true },
    });
    if (!target) throw new NotFoundException(`target 계정 없음: ${targetEmail}`);

    // target에 기존 proProfile이 있다면 삭제 (userId @unique 제약 때문)
    if (target.proProfile) {
      await this.prisma.proProfile.delete({ where: { id: target.proProfile.id } });
    }

    // ProProfile.userId를 target으로 변경 (연관 데이터는 FK로 따라옴)
    const transferred = await this.prisma.proProfile.update({
      where: { id: source.proProfile.id },
      data: { userId: target.id },
    });

    // target 유저 정보 업데이트: role='pro' 로, 프로필 이미지가 없으면 source 값으로 보완.
    // 이름(User.name)은 target 것을 유지 — 실계정 이름이 덮어쓰이지 않도록.
    await this.prisma.user.update({
      where: { id: target.id },
      data: {
        role: 'pro',
        ...(target.profileImageUrl ? {} : { profileImageUrl: source.profileImageUrl }),
      },
    });

    // source 계정 비활성화: 이메일을 archived-{ts}-... 로 변경해 재시딩/충돌 방지
    await this.prisma.user.update({
      where: { id: source.id },
      data: { email: `archived-${Date.now()}-${sourceEmail}` },
    });

    // 캐시 무효화
    this.discoveryService.invalidateCache(transferred.id);

    return {
      success: true,
      sourceEmail,
      targetEmail,
      transferredProfileId: transferred.id,
      newOwnerUserId: target.id,
    };
  }

  // ─── Pro 승인 ─────────────────────────────────────────────────────────────
  async approvePro(proProfileId: string) {
    const profile = await this.prisma.proProfile.update({
      where: { id: proProfileId },
      data: { status: 'approved', approvedAt: new Date() },
      include: { user: { select: { id: true, name: true } } },
    });

    // user.role을 'pro'로 변경
    await this.prisma.user.update({
      where: { id: profile.userId },
      data: { role: 'pro' },
    });

    // 승인 알림
    this.notificationService.createNotification(
      profile.userId,
      'system' as any,
      '파트너 신청이 승인되었습니다! 🎉',
      '프리티풀 파트너로 등록되었습니다. 지금 바로 프로필을 확인하세요.',
      { proProfileId },
    ).catch(() => {});

    this.discoveryService.invalidateCache(proProfileId);
    return { success: true, proProfileId };
  }

  // ─── Pro 반려 ─────────────────────────────────────────────────────────────
  async rejectPro(proProfileId: string, reason?: string) {
    const profile = await this.prisma.proProfile.update({
      where: { id: proProfileId },
      data: { status: 'rejected' },
      include: { user: { select: { id: true } } },
    });

    this.notificationService.createNotification(
      profile.userId,
      'system' as any,
      '파트너 신청이 반려되었습니다',
      reason || '신청 조건을 재확인 후 다시 신청해 주세요.',
      { proProfileId },
    ).catch(() => {});

    this.discoveryService.invalidateCache(proProfileId);
    return { success: true, proProfileId };
  }

  // ─── 파트너스 로고 토글 ──────────────────────────────────────────────────
  async togglePartnersLogo(proProfileId: string) {
    const profile = await this.prisma.proProfile.findUnique({ where: { id: proProfileId } });
    if (!profile) throw new Error('Pro not found');
    const updated = await this.prisma.proProfile.update({
      where: { id: proProfileId },
      data: { showPartnersLogo: !profile.showPartnersLogo },
    });
    this.discoveryService.invalidateCache(proProfileId);
    return updated;
  }

  // ─── Featured 토글 ───────────────────────────────────────────────────────
  async toggleFeatured(proProfileId: string) {
    const profile = await this.prisma.proProfile.findUnique({ where: { id: proProfileId } });
    if (!profile) throw new Error('Pro not found');
    const updated = await this.prisma.proProfile.update({
      where: { id: proProfileId },
      data: { isFeatured: !profile.isFeatured },
    });
    this.discoveryService.invalidateCache(proProfileId);
    return updated;
  }

  // ─── 통계 ────────────────────────────────────────────────────────────────
  async getStats() {
    const kstOffset = 9 * 60 * 60 * 1000;
    const dayMs = 24 * 60 * 60 * 1000;
    const now = Date.now();
    const todayKey = new Date(now + kstOffset).toISOString().slice(0, 10);
    const thisMonthKey = `${todayKey.slice(0, 7)}-01`;
    const dayRange = (key: string) => ({
      gte: new Date(`${key}T00:00:00.000+09:00`),
      lte: new Date(`${key}T23:59:59.999+09:00`),
    });
    const keyFromOffset = (offset: number) => new Date(now + kstOffset - offset * dayMs).toISOString().slice(0, 10);
    const rangeFromOffset = (offset: number) => ({ gte: dayRange(keyFromOffset(offset)).gte });
    const rate = (numerator: number, denominator: number) => (
      denominator > 0 ? Math.round((numerator / denominator) * 1000) / 10 : 0
    );

    const todayRange = dayRange(todayKey);
    const sevenDayRange = rangeFromOffset(6);
    const thirtyDayRange = rangeFromOffset(29);
    const thisMonthStart = new Date(`${thisMonthKey}T00:00:00.000+09:00`);
    const emptyRows: any[] = [];
    const zeroAmountAggregate = { _sum: { amount: 0 } } as any;
    const zeroSettlementAggregate = { _sum: { netAmount: 0 } } as any;
    const zeroProAggregate = {
      _sum: { profileViews: 0, reviewCount: 0 },
      _avg: { avgRating: 0, responseRate: 0 },
    } as any;
    const zeroBusinessAggregate = { _sum: { profileViews: 0 } } as any;
    const safe = <T>(label: string, query: Promise<T>, fallback: T) => this.safeStatsQuery(label, query, fallback);

    const [
      totalUsers,
      activeUsers,
      bannedUsers,
      newUsersToday,
      newUsers7d,
      newUsers30d,
      userRoles,
      totalPros,
      pendingPros,
      proStatuses,
      proAggregate,
      totalBusinesses,
      businessStatuses,
      businessAggregate,
      totalReviews,
      visibleReviews,
      totalMatchRequests,
      matchStatuses,
      totalDeliveries,
      viewedDeliveries,
      repliedDeliveries,
      totalChatRooms,
      chatRooms7d,
      totalMessages,
      messages7d,
      totalQuotations,
      quotationStatuses,
      totalPayments,
      paymentStatuses,
      revenueToday,
      revenue7d,
      thisMonthRevenue,
      revenue30d,
      totalRevenue,
      settlementStatuses,
      pendingSettlementAmount,
      settledSettlementAmount,
      totalNotifications,
      unreadNotifications,
      sentPushNotifications,
      activePushTokens,
      pushSubscriptions,
      topViewedPros,
      topRevenueGroups,
    ] = await Promise.all([
      safe('totalUsers', this.prisma.user.count(), 0),
      safe('activeUsers', this.prisma.user.count({ where: { isActive: true } }), 0),
      safe('bannedUsers', this.prisma.user.count({ where: { isBanned: true } }), 0),
      safe('newUsersToday', this.prisma.user.count({ where: { createdAt: todayRange } }), 0),
      safe('newUsers7d', this.prisma.user.count({ where: { createdAt: sevenDayRange } }), 0),
      safe('newUsers30d', this.prisma.user.count({ where: { createdAt: thirtyDayRange } }), 0),
      safe('userRoles', this.prisma.user.groupBy({ by: ['role'], _count: true }), emptyRows),
      safe('totalPros', this.prisma.proProfile.count({ where: { status: 'approved' } }), 0),
      safe('pendingPros', this.prisma.proProfile.count({ where: { status: 'pending' } }), 0),
      safe('proStatuses', this.prisma.proProfile.groupBy({ by: ['status'], _count: true }), emptyRows),
      safe('proAggregate', this.prisma.proProfile.aggregate({
        _sum: { profileViews: true, reviewCount: true },
        _avg: { avgRating: true, responseRate: true },
      }), zeroProAggregate),
      safe('totalBusinesses', this.prisma.businessProfile.count(), 0),
      safe('businessStatuses', this.prisma.businessProfile.groupBy({ by: ['status'], _count: true }), emptyRows),
      safe('businessAggregate', this.prisma.businessProfile.aggregate({ _sum: { profileViews: true } }), zeroBusinessAggregate),
      safe('totalReviews', this.prisma.review.count(), 0),
      safe('visibleReviews', this.prisma.review.count({ where: { isVisible: true } }), 0),
      safe('totalMatchRequests', this.prisma.matchRequest.count(), 0),
      safe('matchStatuses', this.prisma.matchRequest.groupBy({ by: ['status'], _count: true }), emptyRows),
      safe('totalDeliveries', this.prisma.matchDelivery.count(), 0),
      safe('viewedDeliveries', this.prisma.matchDelivery.count({ where: { viewedAt: { not: null } } }), 0),
      safe('repliedDeliveries', this.prisma.matchDelivery.count({ where: { repliedAt: { not: null } } }), 0),
      safe('totalChatRooms', this.prisma.chatRoom.count(), 0),
      safe('chatRooms7d', this.prisma.chatRoom.count({ where: { createdAt: sevenDayRange } }), 0),
      safe('totalMessages', this.prisma.message.count({ where: { isDeleted: false } }), 0),
      safe('messages7d', this.prisma.message.count({ where: { isDeleted: false, createdAt: sevenDayRange } }), 0),
      safe('totalQuotations', this.prisma.quotation.count(), 0),
      safe('quotationStatuses', this.prisma.quotation.groupBy({ by: ['status'], _count: true }), emptyRows),
      safe('totalPayments', this.prisma.payment.count(), 0),
      safe('paymentStatuses', this.prisma.payment.groupBy({ by: ['status'], _count: true, _sum: { amount: true } }), emptyRows),
      safe('revenueToday', this.prisma.payment.aggregate({ where: { status: 'completed', createdAt: todayRange }, _sum: { amount: true } }), zeroAmountAggregate),
      safe('revenue7d', this.prisma.payment.aggregate({ where: { status: 'completed', createdAt: sevenDayRange }, _sum: { amount: true } }), zeroAmountAggregate),
      safe('thisMonthRevenue', this.prisma.payment.aggregate({ where: { status: 'completed', createdAt: { gte: thisMonthStart } }, _sum: { amount: true } }), zeroAmountAggregate),
      safe('revenue30d', this.prisma.payment.aggregate({ where: { status: 'completed', createdAt: thirtyDayRange }, _sum: { amount: true } }), zeroAmountAggregate),
      safe('totalRevenue', this.prisma.payment.aggregate({ where: { status: 'completed' }, _sum: { amount: true } }), zeroAmountAggregate),
      safe('settlementStatuses', this.prisma.settlementLog.groupBy({ by: ['status'], _count: true }), emptyRows),
      safe('pendingSettlementAmount', this.prisma.settlementLog.aggregate({ where: { status: 'pending' }, _sum: { netAmount: true } }), zeroSettlementAggregate),
      safe('settledSettlementAmount', this.prisma.settlementLog.aggregate({ where: { status: 'settled' }, _sum: { netAmount: true } }), zeroSettlementAggregate),
      safe('totalNotifications', this.prisma.notification.count(), 0),
      safe('unreadNotifications', this.prisma.notification.count({ where: { isRead: false } }), 0),
      safe('sentPushNotifications', this.prisma.notification.count({ where: { sentPush: true } }), 0),
      safe('activePushTokens', this.prisma.pushToken.count({ where: { isActive: true } }), 0),
      safe('pushSubscriptions', this.prisma.pushSubscription.count(), 0),
      safe('topViewedPros', this.prisma.proProfile.findMany({
        where: { status: 'approved' },
        include: { user: { select: { name: true } } },
        orderBy: { profileViews: 'desc' },
        take: 5,
      }), emptyRows),
      safe('topRevenueGroups', this.prisma.payment.groupBy({
        by: ['proProfileId'],
        where: { status: 'completed' },
        _sum: { amount: true },
        _count: true,
        orderBy: { _sum: { amount: 'desc' } },
        take: 5,
      }), emptyRows),
    ]);

    const seriesKeys = Array.from({ length: 14 }, (_, idx) => keyFromOffset(13 - idx));
    const seriesStart = dayRange(seriesKeys[0]).gte;
    const seriesEnd = dayRange(seriesKeys[seriesKeys.length - 1]).lte;
    const [
      dailyUsersRows,
      dailyMatchRows,
      dailyPaymentRows,
      dailyChatRows,
      dailyMessageRows,
      dailyRevenueRows,
    ] = await Promise.all([
      safe('dailyUsersRows', this.prisma.$queryRaw<any[]>`
        SELECT to_char(("createdAt" + INTERVAL '9 hours'), 'YYYY-MM-DD') AS date, COUNT(*)::int AS value
        FROM users
        WHERE "createdAt" >= ${seriesStart} AND "createdAt" <= ${seriesEnd}
        GROUP BY 1
      `, emptyRows),
      safe('dailyMatchRows', this.prisma.$queryRaw<any[]>`
        SELECT to_char(("createdAt" + INTERVAL '9 hours'), 'YYYY-MM-DD') AS date, COUNT(*)::int AS value
        FROM match_requests
        WHERE "createdAt" >= ${seriesStart} AND "createdAt" <= ${seriesEnd}
        GROUP BY 1
      `, emptyRows),
      safe('dailyPaymentRows', this.prisma.$queryRaw<any[]>`
        SELECT to_char(("createdAt" + INTERVAL '9 hours'), 'YYYY-MM-DD') AS date, COUNT(*)::int AS value
        FROM payments
        WHERE "createdAt" >= ${seriesStart} AND "createdAt" <= ${seriesEnd}
        GROUP BY 1
      `, emptyRows),
      safe('dailyChatRows', this.prisma.$queryRaw<any[]>`
        SELECT to_char(("createdAt" + INTERVAL '9 hours'), 'YYYY-MM-DD') AS date, COUNT(*)::int AS value
        FROM chat_rooms
        WHERE "createdAt" >= ${seriesStart} AND "createdAt" <= ${seriesEnd}
        GROUP BY 1
      `, emptyRows),
      safe('dailyMessageRows', this.prisma.$queryRaw<any[]>`
        SELECT to_char(("createdAt" + INTERVAL '9 hours'), 'YYYY-MM-DD') AS date, COUNT(*)::int AS value
        FROM messages
        WHERE "createdAt" >= ${seriesStart} AND "createdAt" <= ${seriesEnd} AND "isDeleted" = false
        GROUP BY 1
      `, emptyRows),
      safe('dailyRevenueRows', this.prisma.$queryRaw<any[]>`
        SELECT to_char(("createdAt" + INTERVAL '9 hours'), 'YYYY-MM-DD') AS date, COALESCE(SUM(amount), 0)::bigint AS value
        FROM payments
        WHERE "createdAt" >= ${seriesStart} AND "createdAt" <= ${seriesEnd} AND status = 'completed'
        GROUP BY 1
      `, emptyRows),
    ]);
    const valueMap = (rows: Array<{ date: string; value: number | bigint }>) => new Map(
      rows.map((row) => [row.date, Number(row.value || 0)]),
    );
    const dailyUsersMap = valueMap(dailyUsersRows);
    const dailyMatchMap = valueMap(dailyMatchRows);
    const dailyPaymentMap = valueMap(dailyPaymentRows);
    const dailyChatMap = valueMap(dailyChatRows);
    const dailyMessageMap = valueMap(dailyMessageRows);
    const dailyRevenueMap = valueMap(dailyRevenueRows);
    const dailySeries = seriesKeys.map((key) => ({
      date: key.slice(5).replace('-', '.'),
      users: dailyUsersMap.get(key) || 0,
      matchRequests: dailyMatchMap.get(key) || 0,
      payments: dailyPaymentMap.get(key) || 0,
      chats: dailyChatMap.get(key) || 0,
      messages: dailyMessageMap.get(key) || 0,
      revenue: dailyRevenueMap.get(key) || 0,
    }));

    const topRevenueIds = topRevenueGroups.map((row) => row.proProfileId);
    const topRevenueProfiles = topRevenueIds.length
      ? await safe('topRevenueProfiles', this.prisma.proProfile.findMany({
          where: { id: { in: topRevenueIds } },
          include: { user: { select: { name: true } } },
        }), emptyRows)
      : [];
    const topRevenueMap = new Map(topRevenueProfiles.map((p) => [p.id, p.user?.name || '전문가']));
    const groupCount = (value: any) => (
      typeof value === 'number' ? value : Number(value?._all || 0)
    );

    const roleMap = Object.fromEntries(userRoles.map((row: any) => [row.role, groupCount(row._count)]));
    const proStatusMap = Object.fromEntries(proStatuses.map((row: any) => [row.status, groupCount(row._count)]));
    const businessStatusMap = Object.fromEntries(businessStatuses.map((row: any) => [row.status, groupCount(row._count)]));
    const matchStatusMap = Object.fromEntries(matchStatuses.map((row: any) => [row.status, groupCount(row._count)]));
    const quotationStatusMap = Object.fromEntries(quotationStatuses.map((row: any) => [row.status, groupCount(row._count)]));
    const paymentStatusMap = Object.fromEntries(paymentStatuses.map((row: any) => [row.status, groupCount(row._count)]));
    const paymentAmountMap = Object.fromEntries(paymentStatuses.map((row: any) => [row.status, row._sum.amount || 0]));
    const settlementStatusMap = Object.fromEntries(settlementStatuses.map((row: any) => [row.status, groupCount(row._count)]));

    const completedPayments = paymentStatusMap.completed || 0;
    const paidQuotations = quotationStatusMap.paid || 0;
    const totalProfileViews = (proAggregate._sum.profileViews || 0) + (businessAggregate._sum.profileViews || 0);

    return {
      totalUsers: roleMap.general || 0,
      allUsers: totalUsers,
      activeUsers,
      inactiveUsers: Math.max(0, totalUsers - activeUsers),
      bannedUsers,
      newUsersToday,
      newUsers7d,
      newUsers30d,
      userRoles: {
        general: roleMap.general || 0,
        pro: roleMap.pro || 0,
        business: roleMap.business || 0,
        admin: roleMap.admin || 0,
      },
      totalPros,
      pendingPros,
      totalReviews,
      visibleReviews,
      thisMonthRevenue: thisMonthRevenue._sum.amount || 0,
      totalRevenue: totalRevenue._sum.amount || 0,
      revenue: {
        today: revenueToday._sum.amount || 0,
        last7d: revenue7d._sum.amount || 0,
        last30d: revenue30d._sum.amount || 0,
        thisMonth: thisMonthRevenue._sum.amount || 0,
        total: totalRevenue._sum.amount || 0,
      },
      profiles: {
        proViews: proAggregate._sum.profileViews || 0,
        businessViews: businessAggregate._sum.profileViews || 0,
        totalViews: totalProfileViews,
        avgRating: Number(proAggregate._avg.avgRating || 0),
        avgResponseRate: Number(proAggregate._avg.responseRate || 0),
        proStatus: {
          approved: proStatusMap.approved || 0,
          pending: proStatusMap.pending || 0,
          draft: proStatusMap.draft || 0,
          rejected: proStatusMap.rejected || 0,
          suspended: proStatusMap.suspended || 0,
        },
        businessTotal: totalBusinesses,
        businessStatus: {
          approved: businessStatusMap.approved || 0,
          pending: businessStatusMap.pending || 0,
          draft: businessStatusMap.draft || 0,
          rejected: businessStatusMap.rejected || 0,
        },
      },
      engagement: {
        chatRooms: totalChatRooms,
        chatRooms7d,
        messages: totalMessages,
        messages7d,
        notifications: totalNotifications,
        unreadNotifications,
        sentPushNotifications,
        activePushTokens,
        pushSubscriptions,
      },
      funnel: {
        profileViews: totalProfileViews,
        matchRequests: totalMatchRequests,
        deliveries: totalDeliveries,
        viewedDeliveries,
        repliedDeliveries,
        chatRooms: totalChatRooms,
        quotations: totalQuotations,
        paidQuotations,
        payments: totalPayments,
        completedPayments,
        reviews: totalReviews,
      },
      rates: {
        chatCtr: rate(totalChatRooms, totalProfileViews),
        deliveryViewRate: rate(viewedDeliveries, totalDeliveries),
        deliveryReplyRate: rate(repliedDeliveries, totalDeliveries),
        quotationPaidRate: rate(paidQuotations, totalQuotations),
        paymentSuccessRate: rate(completedPayments, totalPayments),
        reviewWriteRate: rate(totalReviews, completedPayments),
        pushSendRate: rate(sentPushNotifications, totalNotifications),
      },
      matchRequests: {
        total: totalMatchRequests,
        open: matchStatusMap.open || 0,
        matched: matchStatusMap.matched || 0,
        cancelled: matchStatusMap.cancelled || 0,
        expired: matchStatusMap.expired || 0,
      },
      quotations: {
        total: totalQuotations,
        pending: quotationStatusMap.pending || 0,
        accepted: quotationStatusMap.accepted || 0,
        paid: quotationStatusMap.paid || 0,
        cancelled: quotationStatusMap.cancelled || 0,
        refunded: quotationStatusMap.refunded || 0,
        expired: quotationStatusMap.expired || 0,
      },
      payments: {
        total: totalPayments,
        pending: paymentStatusMap.pending || 0,
        completed: paymentStatusMap.completed || 0,
        failed: paymentStatusMap.failed || 0,
        refunded: paymentStatusMap.refunded || 0,
        escrowed: paymentStatusMap.escrowed || 0,
        settled: paymentStatusMap.settled || 0,
        completedAmount: paymentAmountMap.completed || 0,
        refundedAmount: paymentAmountMap.refunded || 0,
      },
      settlements: {
        pending: settlementStatusMap.pending || 0,
        settled: settlementStatusMap.settled || 0,
        cancelled: settlementStatusMap.cancelled || 0,
        pendingAmount: pendingSettlementAmount._sum.netAmount || 0,
        settledAmount: settledSettlementAmount._sum.netAmount || 0,
      },
      dailySeries,
      topLists: {
        viewedPros: topViewedPros.map((p) => ({
          id: p.id,
          name: p.user?.name || '전문가',
          value: p.profileViews || 0,
        })),
        revenuePros: topRevenueGroups.map((row) => ({
          id: row.proProfileId,
          name: topRevenueMap.get(row.proProfileId) || '전문가',
          value: row._sum.amount || 0,
          count: groupCount(row._count),
        })),
      },
    };
  }

  // ─── 유저 목록 ───────────────────────────────────────────────────────────
  async getUsers(params: { page?: number; limit?: number; search?: string; role?: string; startDate?: string; endDate?: string }) {
    const page = params.page || 1;
    const limit = params.limit || 20;
    const where: any = {};
    this.applyCreatedAtRange(where, params);
    if (params.role) where.role = params.role;
    if (params.search) {
      where.OR = [
        { name: { contains: params.search, mode: 'insensitive' } },
        { email: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          role: true,
          profileImageUrl: true,
          createdAt: true,
          businessProfile: {
            select: {
              id: true,
              businessName: true,
              businessType: true,
              status: true,
              phone: true,
              address: true,
              createdAt: true,
              _count: { select: { images: true, categories: true } },
            },
          },
          proProfile: {
            select: {
              id: true,
              status: true,
              shortIntro: true,
              images: { select: { id: true }, take: 1 },
              _count: { select: { images: true, services: true } },
            },
          },
          pushTokens: {
            select: { platform: true, isActive: true, createdAt: true },
            orderBy: { createdAt: 'desc' },
            take: 3,
          },
          sessions: {
            select: { deviceInfo: true, createdAt: true },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data: data.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        phone: u.phone,
        role: u.role,
        signupDevice: this.resolveUserSignupDevice(u),
        profileImageUrl: u.profileImageUrl,
        createdAt: u.createdAt,
        paymentCount: 0,
        businessProfile: u.businessProfile
          ? {
              id: u.businessProfile.id,
              businessName: u.businessProfile.businessName,
              businessType: u.businessProfile.businessType,
              status: u.businessProfile.status,
              phone: u.businessProfile.phone,
              address: u.businessProfile.address,
              imageCount: u.businessProfile._count.images,
              categoryCount: u.businessProfile._count.categories,
              createdAt: u.businessProfile.createdAt,
            }
          : null,
        proProfile: u.proProfile
          ? this.formatAdminProProfileSummary(u.proProfile)
          : null,
      })),
      total,
      page,
      limit,
    };
  }

  async getUserDetail(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        authProviders: { select: { id: true, provider: true, providerEmail: true, createdAt: true } },
        notificationSettings: true,
        refundAccount: true,
        businessProfile: {
          include: {
            images: { orderBy: { displayOrder: 'asc' }, take: 3 },
            categories: { include: { category: true } },
          },
        },
        proProfile: {
          include: {
            images: { orderBy: { displayOrder: 'asc' }, take: 5 },
            services: { orderBy: { displayOrder: 'asc' } },
            categories: { include: { category: true } },
            regions: { include: { region: true } },
            languages: true,
            _count: {
              select: {
                reviews: true,
                quotations: true,
                chatRooms: true,
                matchDeliveries: true,
              },
            },
          },
        },
        _count: {
          select: {
            chatRooms: true,
            sentMessages: true,
            notifications: true,
            reviews: true,
            matchRequests: true,
          },
        },
      },
    });
    if (!user) throw new NotFoundException('유저를 찾을 수 없습니다');

    const [
      chatRooms,
      matchRequests,
      quotations,
      payments,
      reviews,
      notifications,
    ] = await Promise.all([
      this.prisma.chatRoom.findMany({
        where: { userId },
        include: {
          proProfile: {
            include: {
              user: { select: { id: true, name: true, email: true, profileImageUrl: true } },
              images: { orderBy: { displayOrder: 'asc' }, take: 1 },
            },
          },
          matchRequest: { select: { id: true, eventDate: true, eventLocation: true, status: true } },
          _count: { select: { messages: true, quotations: true } },
        },
        orderBy: { lastMessageAt: 'desc' },
        take: 80,
      }),
      this.prisma.matchRequest.findMany({
        where: { userId },
        include: {
          category: { select: { id: true, name: true } },
          eventCategory: { select: { id: true, name: true } },
          deliveries: {
            include: {
              proProfile: { include: { user: { select: { id: true, name: true, email: true } } } },
            },
            take: 20,
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      this.prisma.quotation.findMany({
        where: { userId },
        include: {
          proProfile: { include: { user: { select: { id: true, name: true, email: true } } } },
          payment: { select: { id: true, amount: true, status: true, createdAt: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 80,
      }),
      this.prisma.payment.findMany({
        where: { userId },
        include: {
          quotations: { select: { id: true, title: true, eventDate: true, eventLocation: true, status: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 80,
      }),
      this.prisma.review.findMany({
        where: { reviewerId: userId },
        include: {
          proProfile: { include: { user: { select: { id: true, name: true, email: true } } } },
          payment: { select: { id: true, amount: true, status: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      this.prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 80,
      }),
    ]);

    const [paymentPros] = await Promise.all([
      payments.length
        ? this.prisma.proProfile.findMany({
            where: { id: { in: Array.from(new Set(payments.map((p) => p.proProfileId))) } },
            include: { user: { select: { id: true, name: true, email: true } } },
          })
        : Promise.resolve([]),
    ]);
    const paymentProMap = new Map(paymentPros.map((p) => [p.id, p] as const));

    return {
      user,
      relations: {
        chatRooms,
        matchRequests,
        quotations,
        payments: payments.map((p) => ({ ...p, proProfile: paymentProMap.get(p.proProfileId) || null })),
        reviews,
        notifications,
      },
    };
  }

  async updateUser(userId: string, data: any) {
    const allowed: any = {};
    const editableFields = [
      'name',
      'email',
      'phone',
      'role',
      'profileImageUrl',
      'isActive',
      'isBanned',
      'banReason',
      'referralCode',
    ];
    for (const field of editableFields) {
      if (data[field] !== undefined) allowed[field] = data[field] === '' ? null : data[field];
    }
    if (allowed.role !== undefined && !this.editableUserRoles.includes(allowed.role)) {
      throw new BadRequestException('변경할 수 없는 권한입니다.');
    }

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: allowed,
    });

    // 이름/프로필이미지/활성상태 변경이 사회자 상세·리스트에 노출 → 캐시 무효화
    const proOfUser = await this.prisma.proProfile.findUnique({ where: { userId }, select: { id: true } });
    if (proOfUser) this.discoveryService.invalidateCache(proOfUser.id);

    if (allowed.role === 'pro') {
      await this.ensureApprovedProProfile(userId);
    }

    if (data.notificationSettings && typeof data.notificationSettings === 'object') {
      const settingsFields = [
        'chatPush',
        'bookingPush',
        'paymentPush',
        'reviewPush',
        'systemPush',
        'marketingPush',
        'marketingSms',
        'marketingEmail',
      ];
      const settings: any = {};
      for (const field of settingsFields) {
        if (data.notificationSettings[field] !== undefined) {
          settings[field] = Boolean(data.notificationSettings[field]);
        }
      }
      if (Object.keys(settings).length > 0) {
        await this.prisma.notificationSettings.upsert({
          where: { userId },
          update: settings,
          create: { userId, ...settings },
        });
      }
    }

    return this.getUserDetail(user.id);
  }

  async getReferralEventParticipants(params: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
  }) {
    const page = params.page || 1;
    const limit = params.limit || 20;
    const where: any = {
      OR: [
        { referrals: { some: { deletedAt: null, isActive: true } } },
        { referralEventClaims: { some: { campaignKey: REFERRAL_EVENT_CAMPAIGN_KEY } } },
      ],
    };

    if (params.search?.trim()) {
      const keyword = params.search.trim();
      where.AND = [
        ...(where.AND || []),
        {
          OR: [
            { name: { contains: keyword, mode: 'insensitive' } },
            { email: { contains: keyword, mode: 'insensitive' } },
            { referralCode: { contains: keyword, mode: 'insensitive' } },
          ],
        },
      ];
    }

    if (params.status?.trim()) {
      where.AND = [
        ...(where.AND || []),
        {
          referralEventClaims: {
            some: {
              campaignKey: REFERRAL_EVENT_CAMPAIGN_KEY,
              status: params.status.trim(),
            },
          },
        },
      ];
    }

    const [rows, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          referralCode: true,
          createdAt: true,
          referrals: {
            where: { deletedAt: null, isActive: true },
            orderBy: { createdAt: 'desc' },
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              createdAt: true,
              referralCode: true,
            },
          },
          referralEventClaims: {
            where: { campaignKey: REFERRAL_EVENT_CAMPAIGN_KEY },
            orderBy: { submittedAt: 'desc' },
            take: 1,
          },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data: rows.map((row) => {
        const claim = row.referralEventClaims[0] || null;
        return {
          id: row.id,
          name: row.name,
          email: row.email,
          phone: row.phone,
          referralCode: row.referralCode,
          createdAt: row.createdAt,
          referralCount: row.referrals.length,
          claimEligible: row.referrals.length >= REFERRAL_EVENT_REQUIRED_REFERRALS,
          claim,
          referrals: row.referrals,
        };
      }),
      total,
      page,
      limit,
    };
  }

  async updateReferralEventClaim(
    claimId: string,
    data: { status?: string; adminNote?: string },
  ) {
    const claim = await this.prisma.referralEventClaim.findUnique({
      where: { id: claimId },
    });
    if (!claim) {
      throw new NotFoundException('이벤트 신청 내역을 찾을 수 없습니다.');
    }

    const nextStatus = data.status?.trim() || claim.status;
    const nextNote = data.adminNote !== undefined ? String(data.adminNote || '').trim() || null : claim.adminNote;

    const updated = await this.prisma.referralEventClaim.update({
      where: { id: claimId },
      data: {
        status: nextStatus,
        adminNote: nextNote,
      },
      include: {
        user: {
          select: { id: true, name: true, email: true, phone: true, referralCode: true },
        },
      },
    });

    return updated;
  }

  // ─── 유저 권한 변경 ──────────────────────────────────────────────────────
  async updateUserRole(userId: string, role: string) {
    if (!this.editableUserRoles.includes(role)) {
      throw new BadRequestException('변경할 수 없는 권한입니다.');
    }

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { role: role as any },
      select: {
        id: true,
        role: true,
        proProfile: {
          select: {
            id: true,
            status: true,
            shortIntro: true,
            _count: { select: { images: true, services: true } },
          },
        },
      },
    });
    const proProfile = role === 'pro'
      ? await this.ensureApprovedProProfile(userId)
      : user.proProfile
        ? this.formatAdminProProfileSummary(user.proProfile)
        : null;

    return {
      success: true,
      id: user.id,
      role: user.role,
      proProfile,
    };
  }

  // ─── 이메일 중복 유저 진단 / 정리 ─────────────────────────────────────────
  // 검색어 포함 이메일의 모든 유저와 프로프로필을 반환 → 어드민이 눈으로 판단 가능
  async findUsersByEmail(searchEmail: string) {
    if (!searchEmail) return [];
    const users = await this.prisma.user.findMany({
      where: {
        OR: [
          { email: { contains: searchEmail, mode: 'insensitive' } },
          { name: { contains: searchEmail, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        phone: true,
        isActive: true,
        createdAt: true,
        profileImageUrl: true,
        proProfile: {
          select: {
            id: true,
            status: true,
            shortIntro: true,
            _count: { select: { images: true, services: true, reviews: true, quotations: true } },
            createdAt: true,
            updatedAt: true,
          },
        },
        authProviders: { select: { provider: true, providerEmail: true, createdAt: true } },
        _count: { select: { chatRooms: true, sentMessages: true, reviews: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
    return users.map((u) => ({
      ...u,
      proProfileScore: u.proProfile
        ? (u.proProfile._count.images + u.proProfile._count.services + u.proProfile._count.reviews * 2)
        : 0,
    }));
  }

  // 빈 ProProfile 일괄 정리: 이미지 0장이고 shortIntro 없는 프로필을 draft 로 강등
  // (approved 된 빈 프로필이 공개 목록에 잡혀 있던 문제 일괄 수정)
  async cleanupEmptyProProfiles() {
    const empty = await this.prisma.proProfile.findMany({
      where: {
        status: 'approved',
        images: { none: {} },
      },
      select: { id: true, userId: true, user: { select: { name: true, email: true } } },
    });
    const ids = empty.map((p) => p.id);
    if (ids.length === 0) return { archivedCount: 0, archived: [] };
    await this.prisma.proProfile.updateMany({
      where: { id: { in: ids } },
      data: { status: 'draft' },
    });
    this.discoveryService.invalidateCache();
    return {
      archivedCount: ids.length,
      archived: empty.map((p) => ({ id: p.id, userId: p.userId, name: p.user.name, email: p.user.email })),
    };
  }

  /** 합성 이메일 유저(kakao_{id}@kakao.freetiful.com) 목록 + 매칭되는 native 계정 */
  async listLegacyKakaoPairs() {
    const legacyUsers = await this.prisma.user.findMany({
      where: { email: { startsWith: 'kakao_', endsWith: '@kakao.freetiful.com' } },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
        _count: { select: { sentMessages: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    const pairs: Array<{
      legacy: { id: string; email: string; name: string | null; createdAt: Date; messageCount: number };
      native: { id: string; email: string | null; name: string | null } | null;
      providerUserId: string;
    }> = [];

    for (const legacy of legacyUsers) {
      const match = legacy.email?.match(/^kakao_(.+)@kakao\.freetiful\.com$/);
      const providerUserId = match?.[1] || '';
      let native: { id: string; email: string | null; name: string | null } | null = null;
      if (providerUserId) {
        const record = await this.prisma.authProviderRecord.findFirst({
          where: { provider: 'kakao' as any, providerUserId },
          select: { user: { select: { id: true, email: true, name: true } } },
        });
        if (record?.user && record.user.id !== legacy.id) {
          native = record.user;
        }
      }
      pairs.push({
        legacy: {
          id: legacy.id,
          email: legacy.email!,
          name: legacy.name,
          createdAt: legacy.createdAt,
          messageCount: legacy._count.sentMessages,
        },
        native,
        providerUserId,
      });
    }

    return {
      totalLegacy: pairs.length,
      withNativeMatch: pairs.filter((p) => p.native).length,
      orphan: pairs.filter((p) => !p.native).length,
      pairs,
    };
  }

  /** 합성 이메일 유저들을 매칭되는 native 계정으로 일괄 합병 */
  async mergeAllLegacyKakaoPairs() {
    const list = await this.listLegacyKakaoPairs();
    const merged: Array<{ from: string; to: string; movedRooms: number; movedMessages: number }> = [];
    const skipped: Array<{ legacyId: string; reason: string }> = [];

    for (const pair of list.pairs) {
      if (!pair.native) {
        skipped.push({ legacyId: pair.legacy.id, reason: 'no native account' });
        continue;
      }
      const fromId = pair.legacy.id;
      const toId = pair.native.id;
      try {
        // ChatRoom.userId 재매핑
        const roomCount = await this.prisma.chatRoom.updateMany({
          where: { userId: fromId },
          data: { userId: toId },
        });
        // ChatRoomMember 재매핑
        const dupMembers = await this.prisma.chatRoomMember.findMany({
          where: { userId: fromId },
          select: { roomId: true },
        });
        if (dupMembers.length > 0) {
          const roomIds = dupMembers.map((m) => m.roomId);
          const existingTo = await this.prisma.chatRoomMember.findMany({
            where: { userId: toId, roomId: { in: roomIds } },
            select: { roomId: true },
          });
          const alreadyIn = new Set(existingTo.map((m) => m.roomId));
          if (alreadyIn.size > 0) {
            await this.prisma.chatRoomMember.deleteMany({
              where: { userId: fromId, roomId: { in: Array.from(alreadyIn) } },
            });
          }
          await this.prisma.chatRoomMember.updateMany({
            where: { userId: fromId },
            data: { userId: toId },
          });
        }
        // ChatMessage.senderId 재매핑
        const msgCount = await this.prisma.message.updateMany({
          where: { senderId: fromId },
          data: { senderId: toId },
        });
        // 기타 user 참조 모두 이관
        await this.prisma.payment.updateMany({ where: { userId: fromId }, data: { userId: toId } }).catch(() => {});
        await this.prisma.quotation.updateMany({ where: { userId: fromId }, data: { userId: toId } }).catch(() => {});
        await this.prisma.review.updateMany({ where: { reviewerId: fromId }, data: { reviewerId: toId } }).catch(() => {});
        await this.prisma.notification.updateMany({ where: { userId: fromId }, data: { userId: toId } }).catch(() => {});
        await this.prisma.matchRequest.updateMany({ where: { userId: fromId }, data: { userId: toId } }).catch(() => {});
        await this.prisma.authProviderRecord.updateMany({ where: { userId: fromId }, data: { userId: toId } }).catch(() => {});
        await this.prisma.session.deleteMany({ where: { userId: fromId } }).catch(() => {});

        // 레거시 유저 archive (이메일 무효화 + 비활성화) — 완전 삭제 대신 안전하게 보관
        try {
          const legacy = await this.prisma.user.findUnique({ where: { id: fromId }, select: { email: true } });
          if (legacy?.email) {
            await this.prisma.user.update({
              where: { id: fromId },
              data: {
                email: `merged-${Date.now()}-${legacy.email}`.slice(0, 200),
                isActive: false,
                name: `[merged] ${legacy.email.slice(0, 50)}`,
              },
            });
          }
        } catch {}

        merged.push({ from: fromId, to: toId, movedRooms: roomCount.count, movedMessages: msgCount.count });
      } catch (e: any) {
        skipped.push({ legacyId: fromId, reason: e?.message || 'error' });
      }
    }

    if (merged.length) this.discoveryService.invalidateCache();
    return {
      mergedCount: merged.length,
      skippedCount: skipped.length,
      merged,
      skipped,
    };
  }

  // 지정 유저를 소프트 삭제 (email → archived-{ts}-{email}, role→archived)
  // 연관 데이터 (ChatRoom, Payment, Message 등)는 유지 → 참조 무결성 보장
  async archiveUser(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('유저 없음');
    const ts = Date.now();
    const newEmail = user.email ? `archived-${ts}-${user.email}` : null;
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        email: newEmail,
        isActive: false,
      },
    });
    const archivedPro = await this.prisma.proProfile.findUnique({ where: { userId }, select: { id: true } });
    if (archivedPro) this.discoveryService.invalidateCache(archivedPro.id);
    return { success: true, userId, archivedEmail: newEmail };
  }

  // ─── 유저 삭제 ───────────────────────────────────────────────────────────
  /**
   * 유저 완전삭제(회원탈퇴) — 연관 데이터까지 트랜잭션으로 모두 제거.
   * FK에 onDelete:Cascade가 없는 관계(MatchRequest/ChatRoom/ChatRoomMember/Message/
   * Review/Report, 그리고 사회자 프로필의 Quotation/MatchDelivery/Review/ChatRoom)를
   * 순서대로 직접 삭제한 뒤 user.delete()로 나머지(ProProfile/BusinessProfile/Session/
   * Notification/PushToken 등 cascade)를 정리한다. SettlementLog(정산 이력)·추천인 참조는
   * 보존하되 참조만 끊는다(데이터 보존). 누락 FK가 있으면 트랜잭션이 롤백돼 안전.
   */
  async deleteUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, proProfile: { select: { id: true } } },
    });
    if (!user) return { success: true, alreadyDeleted: true };
    const proProfileId = user.proProfile?.id;

    await this.prisma.$transaction(
      async (tx) => {
        // 1) 사회자(pro) 프로필에 매달린 데이터 (cascade 없는 FK) 먼저 제거
        if (proProfileId) {
          await tx.matchDelivery.deleteMany({ where: { proProfileId } });
          await tx.quotation.deleteMany({ where: { proProfileId } });
          await tx.review.deleteMany({ where: { proProfileId } });
          await tx.chatRoom.deleteMany({ where: { proProfileId } }); // room→Message/Member cascade
          // 정산로그: proProfileId 가 필수 Restrict FK 라 남아있으면 proProfile 삭제가 막힘(서나영 케이스)
          await tx.settlementLog.deleteMany({ where: { proProfileId } });
          // 결제: User/ProProfile 에 relation 없는 스칼라 FK — 고아 방지로 함께 제거
          await tx.payment.deleteMany({ where: { proProfileId } });
        }
        // 2) 이 유저가 만든/쓴 데이터 (cascade 없는 FK)
        await tx.review.deleteMany({ where: { reviewerId: userId } });
        await tx.report.deleteMany({ where: { reporterId: userId } });
        await tx.matchRequest.deleteMany({ where: { userId } }); // →MatchDelivery/Style cascade
        await tx.chatRoom.deleteMany({ where: { userId } });     // 고객으로 만든 방→cascade
        await tx.chatRoomMember.deleteMany({ where: { userId } }); // 남은 방 멤버십
        await tx.message.deleteMany({ where: { senderId: userId } }); // 살아남은 방의 메시지
        await tx.payment.deleteMany({ where: { userId } }); // 고객으로 결제한 내역
        // 3) 보존 레코드는 참조만 해제 (정산 이력 / 추천인 연결)
        await tx.settlementLog.updateMany({
          where: { settledByUserId: userId },
          data: { settledByUserId: null },
        });
        await tx.user.updateMany({
          where: { referredByUserId: userId },
          data: { referredByUserId: null },
        });
        // 4) 마지막으로 유저 삭제 (ProProfile/BusinessProfile/Session/Notification 등 cascade)
        await tx.user.delete({ where: { id: userId } });
      },
      { timeout: 30000, maxWait: 10000 },
    );
    if (proProfileId) this.discoveryService.invalidateCache(proProfileId);
    return { success: true };
  }

  // ─── 의뢰/예약 목록 ─────────────────────────────────────────────────────
  async getBookings(params: { page?: number; limit?: number; status?: string; startDate?: string; endDate?: string }) {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(Math.max(1, params.limit || 20), 100);
    const status = params.status && params.status !== 'all' && params.status !== '전체'
      ? params.status
      : undefined;
    const take = page * limit;
    const start = (page - 1) * limit;

    const quotationStatuses =
      status === 'pending' ? ['pending', 'accepted']
      : status === 'confirmed' ? ['paid']
      : status === 'cancelled' ? ['cancelled', 'refunded', 'expired']
      : undefined;
    const matchStatuses =
      status === 'pending' ? ['open']
      : status === 'confirmed' ? ['matched']
      : status === 'cancelled' ? ['cancelled', 'expired']
      : undefined;

    const quotationWhere: any = quotationStatuses ? { status: { in: quotationStatuses } } : {};
    const matchWhere: any = matchStatuses ? { status: { in: matchStatuses } } : {};
    this.applyCreatedAtRange(quotationWhere, params);
    this.applyCreatedAtRange(matchWhere, params);

    const [quotations, quotationTotal, matchRequests, matchTotal] = await Promise.all([
      this.prisma.quotation.findMany({
        where: quotationWhere,
        include: {
          payment: { select: { id: true, status: true, settledAt: true, refundedAt: true } },
          proProfile: { include: { user: { select: { id: true, name: true, email: true } } } },
        },
        orderBy: { createdAt: 'desc' },
        take,
      }),
      this.prisma.quotation.count({ where: quotationWhere }),
      this.prisma.matchRequest.findMany({
        where: matchWhere,
        include: {
          user: { select: { id: true, name: true, email: true, phone: true } },
          category: { select: { id: true, name: true } },
          eventCategory: { select: { id: true, name: true } },
          deliveries: {
            include: { proProfile: { include: { user: { select: { id: true, name: true } } } } },
            orderBy: { deliveredAt: 'desc' },
            take: 3,
          },
          _count: { select: { deliveries: true, chatRooms: true } },
        },
        orderBy: { createdAt: 'desc' },
        take,
      }),
      this.prisma.matchRequest.count({ where: matchWhere }),
    ]);

    const quotationUserIds = Array.from(new Set(quotations.map((q) => q.userId).filter(Boolean)));
    const quotationUsers = quotationUserIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: quotationUserIds } },
          select: { id: true, name: true, email: true, phone: true },
        })
      : [];
    const userMap = new Map(quotationUsers.map((u) => [u.id, u]));

    const normalizeQuotationStatus = (value: string) => (
      value === 'paid' ? 'confirmed'
      : ['cancelled', 'refunded', 'expired'].includes(value) ? 'cancelled'
      : 'pending'
    );
    const normalizeMatchStatus = (value: string) => (
      value === 'matched' ? 'confirmed'
      : ['cancelled', 'expired'].includes(value) ? 'cancelled'
      : 'pending'
    );

    const data = [
      ...quotations.map((q) => {
        const user = userMap.get(q.userId);
        return {
          id: q.id,
          source: 'quotation',
          sourceLabel: '견적',
          status: q.status,
          normalizedStatus: normalizeQuotationStatus(q.status),
          userName: user?.name || null,
          userEmail: user?.email || null,
          userPhone: user?.phone || null,
          proName: q.proProfile?.user?.name || null,
          proEmail: q.proProfile?.user?.email || null,
          categoryName: null,
          eventCategoryName: null,
          eventDate: q.eventDate,
          eventTime: q.eventTime,
          eventLocation: q.eventLocation,
          amount: q.amount,
          paymentStatus: q.payment?.status || null,
          deliveryCount: null,
          chatRoomCount: null,
          deliveredPros: [],
          createdAt: q.createdAt,
        };
      }),
      ...matchRequests.map((m) => ({
        id: m.id,
        source: 'matchRequest',
        sourceLabel: m.type === 'single' ? '1:1 의뢰' : '다중 의뢰',
        status: m.status,
        normalizedStatus: normalizeMatchStatus(m.status),
        userName: m.user?.name || null,
        userEmail: m.user?.email || null,
        userPhone: m.user?.phone || null,
        proName: null,
        proEmail: null,
        categoryName: m.category?.name || null,
        eventCategoryName: m.eventCategory?.name || null,
        eventDate: m.eventDate,
        eventTime: m.eventTime,
        eventLocation: m.eventLocation,
        amount: m.budgetMax || m.budgetMin || null,
        paymentStatus: null,
        deliveryCount: m._count.deliveries,
        chatRoomCount: m._count.chatRooms,
        deliveredPros: m.deliveries.map((d) => ({
          id: d.proProfileId,
          name: d.proProfile?.user?.name || null,
          status: d.status,
        })),
        createdAt: m.createdAt,
      })),
    ]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(start, start + limit);

    const total = quotationTotal + matchTotal;
    return {
      data,
      total,
      page,
      limit,
      hasMore: page * limit < total,
    };
  }

  // ─── 결제 목록 ───────────────────────────────────────────────────────────
  async getPayments(params: { page?: number; limit?: number; status?: string; startDate?: string; endDate?: string }) {
    const page = params.page || 1;
    const limit = params.limit || 20;
    const where: any = {};
    this.applyCreatedAtRange(where, params);
    if (params.status) where.status = params.status;

    const [payments, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.payment.count({ where }),
    ]);

    const userIds = [...new Set(payments.map((p) => p.userId))];
    const proIds = [...new Set(payments.map((p) => p.proProfileId))];

    const [users, proProfiles] = await Promise.all([
      this.prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } }),
      this.prisma.proProfile.findMany({ where: { id: { in: proIds } }, include: { user: { select: { id: true, name: true } } } }),
    ]);

    const userMap = new Map(users.map((u) => [u.id, u.name]));
    const proMap = new Map(proProfiles.map((p) => [p.id, p.user?.name]));

    return {
      data: payments.map((p) => ({
        id: p.id,
        amount: p.amount,
        status: p.status,
        userName: userMap.get(p.userId) || null,
        proName: proMap.get(p.proProfileId) || null,
        createdAt: p.createdAt,
      })),
      total,
      page,
      limit,
    };
  }

  // ─── 리뷰 목록 ───────────────────────────────────────────────────────────
  async getReviews(params: { page?: number; limit?: number; startDate?: string; endDate?: string }) {
    const page = params.page || 1;
    const limit = params.limit || 20;
    const where: any = {};
    this.applyCreatedAtRange(where, params);

    const [data, total] = await Promise.all([
      this.prisma.review.findMany({
        where,
        include: {
          reviewer: { select: { name: true } },
          proProfile: { include: { user: { select: { name: true } } } },
          payment: {
            select: {
              id: true,
              amount: true,
              quotations: {
                select: { eventDate: true, eventTime: true, eventLocation: true, title: true },
                orderBy: { createdAt: 'desc' },
                take: 1,
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.review.count({ where }),
    ]);

    return {
      data: data.map((r) => ({
        id: r.id,
        reviewerName: r.reviewer?.name,
        proName: r.proProfile?.user?.name,
        avgRating: r.avgRating,
        comment: r.comment,
        createdAt: r.createdAt,
        adminCreated: r.adminCreated,
        isVisible: r.isVisible,
        isAnonymous: r.isAnonymous,
        eventDate: r.payment?.quotations?.[0]?.eventDate || null,
        eventTime: r.payment?.quotations?.[0]?.eventTime || null,
        eventLocation: r.payment?.quotations?.[0]?.eventLocation || null,
        eventTitle: r.payment?.quotations?.[0]?.title || null,
        amount: r.payment?.amount || 0,
      })),
      total,
      page,
      limit,
    };
  }

  async createReview(data: {
    proProfileId?: string;
    reviewerId?: string;
    reviewerName?: string;
    reviewerEmail?: string;
    ratingSatisfaction?: number;
    ratingComposition?: number;
    ratingExperience?: number;
    ratingAppearance?: number;
    ratingVoice?: number;
    ratingWit?: number;
    comment?: string;
    isAnonymous?: boolean;
    isVisible?: boolean;
    eventDate?: string;
    eventTime?: string;
    eventLocation?: string;
    eventTitle?: string;
    reviewCreatedAt?: string;
    amount?: number;
  }) {
    if (!data.proProfileId) {
      throw new BadRequestException('사회자를 선택해주세요.');
    }
    const proProfile = await this.prisma.proProfile.findUnique({
      where: { id: data.proProfileId },
      select: { id: true, userId: true },
    });
    if (!proProfile) throw new NotFoundException('전문가 프로필을 찾을 수 없습니다.');
    const comment = (data.comment || '').trim();
    if (!comment) {
      throw new BadRequestException('리뷰 내용을 입력해주세요.');
    }

    const ratings = [
      Number(data.ratingSatisfaction || 5),
      Number(data.ratingComposition || 5),
      Number(data.ratingExperience || 5),
      Number(data.ratingAppearance || 5),
      Number(data.ratingVoice || 5),
      Number(data.ratingWit || 5),
    ].map((rating) => Math.min(5, Math.max(1, Math.round(rating))));
    const avgRating = ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length;
    const reviewCreatedAt = this.parseAdminDateTime(data.reviewCreatedAt);
    const amount = Math.max(0, Math.round(Number(data.amount || 0)));
    const reviewerName = (data.reviewerName || '고객').trim() || '고객';
    const reviewerEmail = (data.reviewerEmail || '').trim().toLowerCase();

    let reviewer = data.reviewerId
      ? await this.prisma.user.findUnique({ where: { id: data.reviewerId } })
      : null;
    if (!reviewer && reviewerEmail) {
      reviewer = await this.prisma.user.findUnique({ where: { email: reviewerEmail } });
    }
    if (!reviewer) {
      reviewer = await this.prisma.user.create({
        data: {
          role: 'general',
          name: reviewerName,
          email: reviewerEmail || `admin-review-${randomUUID().slice(0, 12)}@freetiful.local`,
          referralCode: `AR${randomUUID().replace(/-/g, '').slice(0, 10).toUpperCase()}`,
          createdAt: reviewCreatedAt,
        },
      });
    }

    const review = await this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: {
          userId: reviewer!.id,
          proProfileId: proProfile.id,
          amount,
          platformFee: 0,
          netAmount: amount,
          method: 'admin_review',
          pgProvider: 'admin',
          pgTransactionId: `ADMIN-REVIEW-${Date.now()}-${randomUUID().slice(0, 8)}`,
          status: 'completed',
          escrowReleasedAt: reviewCreatedAt,
          settledAt: reviewCreatedAt,
          createdAt: reviewCreatedAt,
        },
      });
      const quotation = await tx.quotation.create({
        data: {
          proProfileId: proProfile.id,
          userId: reviewer!.id,
          paymentId: payment.id,
          amount,
          title: data.eventTitle || '관리자 등록 리뷰',
          eventDate: this.parseEventDate(data.eventDate) || undefined,
          eventTime: this.parseEventTime(data.eventTime) || undefined,
          eventLocation: data.eventLocation || undefined,
          status: 'paid',
          createdAt: reviewCreatedAt,
        },
      });
      await tx.payment.update({
        where: { id: payment.id },
        data: { quotationId: quotation.id },
      });
      return tx.review.create({
        data: {
          paymentId: payment.id,
          reviewerId: reviewer!.id,
          proProfileId: proProfile.id,
          ratingSatisfaction: ratings[0],
          ratingComposition: ratings[1],
          ratingExperience: ratings[2],
          ratingAppearance: ratings[3],
          ratingVoice: ratings[4],
          ratingWit: ratings[5],
          avgRating: new Decimal(avgRating.toFixed(2)),
          comment,
          isAnonymous: data.isAnonymous ?? false,
          isVisible: data.isVisible ?? true,
          adminCreated: true,
          createdAt: reviewCreatedAt,
        },
      });
    });

    await this.recalculateProReviewStats(proProfile.id);
    return { success: true, reviewId: review.id };
  }

  // ─── 리뷰 삭제 ───────────────────────────────────────────────────────────
  async deleteReview(reviewId: string) {
    const review = await this.prisma.review.findUnique({
      where: { id: reviewId },
      select: { proProfileId: true },
    });
    await this.prisma.review.delete({ where: { id: reviewId } });
    if (review?.proProfileId) await this.recalculateProReviewStats(review.proProfileId);
    return { success: true };
  }

  async updateQuotation(id: string, data: any) {
    const allowed: any = {};
    const fields = ['amount', 'title', 'description', 'eventLocation', 'validUntil', 'status'];
    for (const field of fields) {
      if (data[field] !== undefined) allowed[field] = data[field] === '' ? null : data[field];
    }
    if (allowed.amount !== undefined) allowed.amount = Number(allowed.amount) || 0;
    if (data.eventDate !== undefined) allowed.eventDate = data.eventDate ? new Date(data.eventDate) : null;
    if (data.eventTime !== undefined) allowed.eventTime = data.eventTime ? new Date(`1970-01-01T${data.eventTime}`) : null;
    return this.prisma.quotation.update({ where: { id }, data: allowed });
  }

  async deleteQuotation(id: string) {
    await this.prisma.quotation.delete({ where: { id } });
    return { success: true };
  }

  async updatePayment(id: string, data: any) {
    const allowed: any = {};
    const fields = ['amount', 'platformFee', 'netAmount', 'method', 'status', 'refundAmount', 'refundReason'];
    for (const field of fields) {
      if (data[field] !== undefined) allowed[field] = data[field] === '' ? null : data[field];
    }
    for (const field of ['amount', 'platformFee', 'netAmount', 'refundAmount']) {
      if (allowed[field] !== undefined && allowed[field] !== null) allowed[field] = Number(allowed[field]) || 0;
    }
    if (allowed.status === 'refunded' && !data.refundedAt) allowed.refundedAt = new Date();
    if (data.refundedAt !== undefined) allowed.refundedAt = data.refundedAt ? new Date(data.refundedAt) : null;
    if (data.escrowReleasedAt !== undefined) allowed.escrowReleasedAt = data.escrowReleasedAt ? new Date(data.escrowReleasedAt) : null;
    if (data.settledAt !== undefined) allowed.settledAt = data.settledAt ? new Date(data.settledAt) : null;
    return this.prisma.payment.update({ where: { id }, data: allowed });
  }

  async deletePayment(id: string) {
    await this.prisma.$transaction([
      this.prisma.quotation.updateMany({ where: { paymentId: id }, data: { paymentId: null } }),
      this.prisma.review.deleteMany({ where: { paymentId: id } }),
      this.prisma.payment.delete({ where: { id } }),
    ]);
    return { success: true };
  }

  async updateMatchDelivery(id: string, data: any) {
    const allowed: any = {};
    if (data.status !== undefined) allowed.status = data.status;
    if (data.viewedAt !== undefined) allowed.viewedAt = data.viewedAt ? new Date(data.viewedAt) : null;
    if (data.repliedAt !== undefined) allowed.repliedAt = data.repliedAt ? new Date(data.repliedAt) : null;
    return this.prisma.matchDelivery.update({ where: { id }, data: allowed });
  }

  async deleteMatchDelivery(id: string) {
    await this.prisma.matchDelivery.delete({ where: { id } });
    return { success: true };
  }

  async updateMatchRequest(id: string, data: any) {
    const allowed: any = {};
    if (data.status !== undefined) allowed.status = data.status;
    if (data.eventLocation !== undefined) allowed.eventLocation = data.eventLocation || null;
    if (data.eventDate !== undefined) allowed.eventDate = data.eventDate ? new Date(data.eventDate) : null;
    if (data.budgetMin !== undefined) allowed.budgetMin = data.budgetMin === '' ? null : Number(data.budgetMin);
    if (data.budgetMax !== undefined) allowed.budgetMax = data.budgetMax === '' ? null : Number(data.budgetMax);
    return this.prisma.matchRequest.update({ where: { id }, data: allowed });
  }

  async deleteMatchRequest(id: string) {
    await this.prisma.matchRequest.delete({ where: { id } });
    return { success: true };
  }

  async deleteNotification(id: string) {
    await this.prisma.notification.delete({ where: { id } });
    return { success: true };
  }

  async updateNotification(id: string, data: any) {
    const isRead = Boolean(data.isRead);
    return this.prisma.notification.update({
      where: { id },
      data: {
        ...(data.title !== undefined ? { title: data.title || null } : {}),
        ...(data.body !== undefined ? { body: data.body || null } : {}),
        ...(data.isRead !== undefined ? { isRead, readAt: isRead ? new Date() : null } : {}),
      },
    });
  }

  async deleteChatRoom(id: string) {
    const now = new Date();
    return this.prisma.chatRoom.update({
      where: { id },
      data: { userDeletedAt: now, proDeletedAt: now },
    });
  }

  async deleteMessage(id: string) {
    return this.prisma.message.update({
      where: { id },
      data: { isDeleted: true, deletedAt: new Date(), content: null },
    });
  }

  // ─── 행사일 리마인더 크론 (한국시간 매일 오전 9시 — 당일 + D-3) ────────
  @Cron('0 9 * * *', { timeZone: 'Asia/Seoul' })
  async sendEventReminders() {
    const todayStr = new Date().toISOString().split('T')[0];
    const threeDaysLater = new Date();
    threeDaysLater.setDate(threeDaysLater.getDate() + 3);
    const threeDaysStr = threeDaysLater.toISOString().split('T')[0];

    const quotations = await this.prisma.quotation.findMany({
      where: {
        status: 'paid',
        eventDate: { in: [new Date(todayStr), new Date(threeDaysStr)] },
      },
      include: {
        proProfile: { include: { user: { select: { id: true, name: true } } } },
      },
    });

    for (const q of quotations) {
      const eventDate = q.eventDate ? new Date(q.eventDate).toISOString().split('T')[0] : '';
      const isToday = eventDate === todayStr;
      const title = isToday ? '오늘 행사가 있습니다! 🎉' : '3일 뒤 행사가 예정되어 있습니다 📅';
      const body = isToday
        ? `오늘 ${q.proProfile.user.name} 사회자와 행사가 예정되어 있습니다.`
        : `3일 뒤 ${q.proProfile.user.name} 사회자와 행사가 예정되어 있습니다. 준비하세요!`;

      this.notificationService.createNotification(q.userId, 'system' as any, title, body, {
        quotationId: q.id,
      }).catch(() => {});

      this.notificationService.createNotification(q.proProfile.userId, 'system' as any, title, body, {
        quotationId: q.id,
      }).catch(() => {});
    }

    this.logger.log(`Event reminders sent for ${quotations.length} quotations (today + D-3)`);
  }

  // ─── 후기 요청 크론 (한국시간 매일 오전 10시 — 행사 1일 후, 리뷰 없는 건) ──
  @Cron('0 10 * * *', { timeZone: 'Asia/Seoul' })
  async sendReviewRequestReminders() {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    const quotations = await this.prisma.quotation.findMany({
      where: {
        status: 'paid',
        eventDate: new Date(yesterdayStr),
        paymentId: { not: null },
      },
      include: {
        proProfile: { include: { user: { select: { name: true } } } },
        payment: { include: { review: { select: { id: true } } } },
      },
    });

    const pending = quotations.filter((q) => q.payment && !q.payment.review);
    for (const q of pending) {
      const proName = q.proProfile.user.name;
      this.notificationService
        .createNotification(
          q.userId,
          'review' as any,
          '행사는 어떠셨나요? ⭐',
          `${proName} 사회자와의 행사 후기를 남겨주세요.`,
          { quotationId: q.id, proProfileId: q.proProfileId },
        )
        .catch(() => {});
    }

    this.logger.log(`Review request reminders sent for ${pending.length} quotations`);
  }

  // ─── 사회자 미확인 요청 리마인더 (한국시간 매일 오전 9시) ─────────────────────
  // 기존엔 새 요청 유무와 무관하게 전 사회자에게 발송 → "알림 들어가면 새 문의 없음" 유령 푸시였음.
  // 최근 7일 내 도착했고 아직 확인(viewed)하지 않은 pending 요청이 있는 사회자에게만, 정확한 건수로 발송.
  @Cron('0 9 * * *', { timeZone: 'Asia/Seoul' })
  async sendProDailyAttendanceReminder() {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const grouped = await this.prisma.matchDelivery.groupBy({
      by: ['proProfileId'],
      where: { status: 'pending', deliveredAt: { gte: sevenDaysAgo } },
      _count: { _all: true },
    });
    if (grouped.length === 0) {
      this.logger.log('Pro daily reminder: 미확인 요청 없음 → 발송 안 함');
      return;
    }
    const countByProfile = new Map(grouped.map((g) => [g.proProfileId, g._count._all]));
    const pros = await this.prisma.proProfile.findMany({
      where: { id: { in: grouped.map((g) => g.proProfileId) }, status: 'approved' },
      select: { id: true, userId: true },
    });

    for (const p of pros) {
      const n = countByProfile.get(p.id) ?? 0;
      if (n <= 0) continue;
      this.notificationService
        .createNotification(
          p.userId,
          'system' as any,
          '확인하지 않은 새 요청이 있어요',
          `아직 확인하지 않은 요청 ${n}건이 있어요. 지금 확인해 보세요.`,
          { type: 'match_request' },
        )
        .catch(() => {});
    }

    this.logger.log(`Pro daily reminder sent to ${pros.length} pros (미확인 요청 보유)`);
  }

  // 채팅 매칭 현황 — 어떤 사회자(pro)와 어떤 유저(user)가 연결되어 채팅했는지 + 매칭률
  async getChatConnections(params: {
    page?: number; limit?: number; search?: string; status?: string; startDate?: string; endDate?: string;
  }) {
    const page = params.page || 1;
    const limit = params.limit || 20;

    const where: any = {};
    this.applyCreatedAtRange(where, params);
    if (params.search) {
      where.OR = [
        { user: { name: { contains: params.search, mode: 'insensitive' } } },
        { user: { phone: { contains: params.search } } },
        { proProfile: { user: { name: { contains: params.search, mode: 'insensitive' } } } },
      ];
    }
    // 필터: chatted=대화 오감 / quoted=견적발송 / paid=결제완료
    if (params.status === 'chatted') where.lastMessageAt = { not: null };
    else if (params.status === 'quoted') where.quotations = { some: {} };
    else if (params.status === 'paid') where.quotations = { some: { status: 'paid' } };

    const [rooms, total] = await Promise.all([
      this.prisma.chatRoom.findMany({
        where,
        select: {
          id: true,
          createdAt: true,
          lastMessageAt: true,
          matchRequestId: true,
          // 견적문의(매칭요청) 원본: 1:1(single)/모두에게(multi) 구분 + 고객이 입력한 행사 정보 그대로
          matchRequest: {
            select: {
              type: true,
              eventDate: true,
              eventTime: true,
              eventLocation: true,
              createdAt: true,
              rawUserInput: true,
              category: { select: { name: true } },
              eventCategory: { select: { name: true } },
            },
          },
          user: { select: { id: true, name: true, phone: true, email: true } },
          proProfile: { select: { id: true, user: { select: { id: true, name: true } } } },
          _count: { select: { messages: true } },
          quotations: { select: { status: true, amount: true }, orderBy: { createdAt: 'desc' } },
        },
        // 고객이 견적문의한 최신 순(연결 생성 시각 내림차순)
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.chatRoom.count({ where }),
    ]);

    // 이 페이지 방들의 메시지 — 양방향 여부 + 응답시간(고객 첫 요청 → 사회자 첫 답장) 계산
    const roomIds = rooms.map((r) => r.id);
    const roomMeta = new Map(
      rooms.map((r) => [r.id, { customerId: r.user?.id, proUserId: r.proProfile?.user?.id }]),
    );
    const msgs = roomIds.length
      ? await this.prisma.message.findMany({
          where: { roomId: { in: roomIds }, isDeleted: false },
          select: { roomId: true, senderId: true, createdAt: true },
          orderBy: { createdAt: 'asc' },
        })
      : [];
    const agg = new Map<string, { senders: Set<string>; firstCustomerAt: Date | null; firstProReplyAt: Date | null }>();
    for (const m of msgs) {
      let a = agg.get(m.roomId);
      if (!a) { a = { senders: new Set(), firstCustomerAt: null, firstProReplyAt: null }; agg.set(m.roomId, a); }
      a.senders.add(m.senderId);
      const meta = roomMeta.get(m.roomId);
      if (meta?.customerId && m.senderId === meta.customerId && !a.firstCustomerAt) a.firstCustomerAt = m.createdAt;
      if (meta?.proUserId && m.senderId === meta.proUserId && !a.firstProReplyAt) a.firstProReplyAt = m.createdAt;
    }
    const senderSet = new Map<string, Set<string>>();
    for (const [rid, a] of agg) senderSet.set(rid, a.senders);

    // 매칭의뢰 배달 시각 — 방이 매칭 기반이면 배달(deliveredAt) → 답장(repliedAt) 기준으로 요청/응답시간 계산
    const matchRooms = rooms.filter((r) => r.matchRequestId && r.proProfile?.id);
    const deliveries = matchRooms.length
      ? await this.prisma.matchDelivery.findMany({
          where: {
            matchRequestId: { in: [...new Set(matchRooms.map((r) => r.matchRequestId as string))] },
            proProfileId: { in: [...new Set(matchRooms.map((r) => r.proProfile!.id))] },
          },
          select: { matchRequestId: true, proProfileId: true, deliveredAt: true, repliedAt: true, status: true },
        })
      : [];
    const deliveryMap = new Map<string, { deliveredAt: Date; repliedAt: Date | null; status: string }>();
    for (const d of deliveries) deliveryMap.set(`${d.matchRequestId}::${d.proProfileId}`, { deliveredAt: d.deliveredAt, repliedAt: d.repliedAt, status: d.status });

    // 전체 매칭률 (검색/필터 무관, 기간만 반영)
    const baseWhere: any = {};
    this.applyCreatedAtRange(baseWhere, params);
    const [totalAll, chattedAll, quotedAll, paidAll] = await Promise.all([
      this.prisma.chatRoom.count({ where: baseWhere }),
      this.prisma.chatRoom.count({ where: { ...baseWhere, lastMessageAt: { not: null } } }),
      this.prisma.chatRoom.count({ where: { ...baseWhere, quotations: { some: {} } } }),
      this.prisma.chatRoom.count({ where: { ...baseWhere, quotations: { some: { status: 'paid' } } } }),
    ]);

    return {
      data: rooms.map((r) => {
        const a = agg.get(r.id);
        const set = a?.senders || new Set<string>();
        const userSent = !!r.user?.id && set.has(r.user.id);
        const proSent = !!r.proProfile?.user?.id && set.has(r.proProfile.user.id);
        // 요청/답장 시각: 매칭 배달이 있으면 배달(deliveredAt→repliedAt) 기준, 없으면 고객 첫 메시지 → 사회자 첫 메시지.
        const delivery = r.matchRequestId && r.proProfile?.id ? deliveryMap.get(`${r.matchRequestId}::${r.proProfile.id}`) : undefined;
        const requestAt = delivery?.deliveredAt || a?.firstCustomerAt || r.createdAt;
        const replyAt = delivery?.repliedAt || a?.firstProReplyAt || null;
        const responseMs = replyAt && new Date(replyAt) >= new Date(requestAt)
          ? new Date(replyAt).getTime() - new Date(requestAt).getTime()
          : null;
        const latestQuote = r.quotations[0];
        const mr = r.matchRequest;
        // 매칭요청 타입: multi=모두에게, single=1:1문의. 매칭요청 없는 방(순수 직접채팅)은 1:1문의로 취급.
        const matchType = mr?.type === 'multi' ? 'multi' : 'single';
        // 고객이 입력한 행사 정보 그대로 — rawUserInput(원본 폼) 우선, 없으면 구조화 필드.
        const raw: any = (mr?.rawUserInput && typeof mr.rawUserInput === 'object') ? mr.rawUserInput : {};
        const rawStr = (v: any) => (typeof v === 'string' && v.trim() ? v.trim() : '');
        const rawCat = rawStr(raw.resolvedCategoryName) || rawStr(raw.categoryName) || mr?.eventCategory?.name || mr?.category?.name || '';
        const eventName = rawStr(raw.eventName);
        const eventPart = rawStr(raw.eventPart);
        // "무슨 행사": 행사명(있으면) / 카테고리 + 예식부(1부예식 등)
        const eventLabel = [eventName || rawCat, eventPart && eventPart !== eventName ? eventPart : ''].filter(Boolean).join(' · ') || null;
        const eventLocation = rawStr(raw.location) || rawStr(raw.addressDetail) || mr?.eventLocation || null;
        // 행사일: 구조화 eventDate 우선, 없으면 rawUserInput.date/eventDateTime
        const eventDateVal = mr?.eventDate || (rawStr(raw.date) ? new Date(rawStr(raw.date)) : (rawStr(raw.eventDateTime) ? new Date(rawStr(raw.eventDateTime)) : null));
        return {
          id: r.id,
          userId: r.user?.id || null,
          userName: r.user?.name || '-',
          userContact: r.user?.phone || r.user?.email || '',
          proProfileId: r.proProfile?.id || null,
          proName: r.proProfile?.user?.name || '-',
          fromMatch: !!r.matchRequestId,
          matchType,                                     // multi=모두에게 / single=1:1문의
          eventLabel,                                    // 무슨 행사(행사명/카테고리+예식부)
          eventDate: eventDateVal,                       // 행사일(고객 입력 DB값)
          eventTime: mr?.eventTime || null,              // 행사 시간(고객 입력 DB값)
          eventLocation,                                 // 행사 장소(고객 입력 DB값)
          messageCount: r._count.messages,
          twoWay: userSent && proSent,
          quotationStatus: latestQuote?.status || null,
          quotationAmount: latestQuote?.amount ?? null,
          paid: r.quotations.some((q) => q.status === 'paid'),
          createdAt: r.createdAt,
          lastMessageAt: r.lastMessageAt,
          firstCustomerAt: requestAt,                    // 요청 도착 시각(매칭 배달 우선)
          firstProReplyAt: replyAt,                      // 사회자 답장 시각
          matchStatus: delivery?.status || null,         // 매칭 배달 상태(declined=거절 등)
          responseMs,                                    // 응답까지 걸린 시간(ms)
        };
      }),
      total,
      page,
      limit,
      stats: {
        totalConnections: totalAll,
        chatted: chattedAll,
        chatRate: totalAll ? Math.round((chattedAll / totalAll) * 1000) / 10 : 0,
        quoted: quotedAll,
        quoteRate: totalAll ? Math.round((quotedAll / totalAll) * 1000) / 10 : 0,
        paid: paidAll,
        paidRate: totalAll ? Math.round((paidAll / totalAll) * 1000) / 10 : 0,
      },
    };
  }

  // 사회자별 응답 통계 — 매칭의뢰(요청) 대비 응답/거절/미응답 + 평균·중앙 응답시간(요청 도착 → 답장).
  // 데이터 원천: match_deliveries (deliveredAt=요청 도착, repliedAt=답장, status=declined 거절). 상단 분석 그래프용.
  // 사회자별 응답 현황 — 승인된 모든 사회자 포함(요청 이력 없어도 표시),
  // 최근 1주일(7일) 매칭의뢰 기준 평균 응답시간 5분(300초) 2분류: good(잘하고 있음) / attention(단도리).
  async getChatResponseStats(_limit = 60) {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT pp.id AS pro_id, u.name AS pro_name,
        COUNT(md.id) AS total,
        COUNT(md.id) FILTER (WHERE md."repliedAt" IS NOT NULL) AS replied,
        COUNT(md.id) FILTER (WHERE md.status = 'declined') AS declined,
        AVG(EXTRACT(EPOCH FROM (md."repliedAt" - md."deliveredAt"))) FILTER (WHERE md."repliedAt" IS NOT NULL AND md."repliedAt" >= md."deliveredAt") AS avg_sec,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (md."repliedAt" - md."deliveredAt"))) FILTER (WHERE md."repliedAt" IS NOT NULL AND md."repliedAt" >= md."deliveredAt") AS median_sec
      FROM pro_profiles pp
      JOIN users u ON u.id = pp."userId"
      LEFT JOIN match_deliveries md ON md."proProfileId" = pp.id
        AND md."deliveredAt" IS NOT NULL
        AND md."deliveredAt" >= NOW() - INTERVAL '7 days'
      WHERE pp.status = 'approved'
      GROUP BY pp.id, u.name
      ORDER BY avg_sec ASC NULLS LAST, replied DESC
    `);
    const GOOD_THRESHOLD_SEC = 300; // 평균 5분
    return {
      thresholdSec: GOOD_THRESHOLD_SEC,
      windowDays: 7,
      data: rows.map((r) => {
        const total = Number(r.total) || 0;
        const responded = Number(r.replied) || 0;
        const declined = Number(r.declined) || 0;
        const avgSec = r.avg_sec != null ? Math.round(Number(r.avg_sec)) : null;
        // good: 평균 5분 이내 답장 이력. 그 외(느림·무응답·요청없음) = attention(단도리).
        const category: 'good' | 'attention' = avgSec != null && avgSec <= GOOD_THRESHOLD_SEC ? 'good' : 'attention';
        return {
          proProfileId: r.pro_id,
          proName: r.pro_name || '-',
          totalRooms: total,
          responded,
          declined,
          notResponded: Math.max(0, total - responded),
          repliedCount: responded,
          avgSec,
          medianSec: r.median_sec != null ? Math.round(Number(r.median_sec)) : null,
          category,
          hasData: responded > 0,
        };
      }),
    };
  }

  // ─── 사회자 랭킹 (드래그앤드롭 수동 정렬) ───
  async getProRanking() {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT pp.id, u.name, pp."avgRating" AS rating, pp."reviewCount" AS reviews,
        pp."rankOrder" AS rank_order, pp."isFeatured" AS featured,
        u."profileImageUrl" AS image
      FROM pro_profiles pp
      JOIN users u ON u.id = pp."userId"
      WHERE pp.status = 'approved'
      ORDER BY pp."rankOrder" ASC NULLS LAST, pp."avgRating" DESC, pp."reviewCount" DESC, pp.id ASC
    `);
    return {
      data: rows.map((r) => ({
        proProfileId: r.id,
        name: r.name || '-',
        rating: r.rating != null ? Number(r.rating) : 0,
        reviewCount: Number(r.reviews) || 0,
        rankOrder: r.rank_order != null ? Number(r.rank_order) : null,
        isFeatured: !!r.featured,
        image: r.image || null,
      })),
    };
  }

  // orderedIds 순서대로 rankOrder = 1,2,3… 부여. 목록에 없는 사회자는 rankOrder=null 로 초기화(자동정렬).
  async saveProRanking(orderedIds: string[]) {
    if (!Array.isArray(orderedIds)) return { ok: false };
    await this.prisma.$transaction(async (tx) => {
      // 전체 승인 사회자 rankOrder 초기화 후, 전달된 순서만 매김
      await tx.$executeRawUnsafe(`UPDATE pro_profiles SET "rankOrder" = NULL WHERE status = 'approved'`);
      for (let i = 0; i < orderedIds.length; i++) {
        await tx.$executeRawUnsafe(`UPDATE pro_profiles SET "rankOrder" = $1 WHERE id = $2`, i + 1, orderedIds[i]);
      }
    });
    return { ok: true, count: orderedIds.length };
  }

  // 특정 연결(방)의 대화 내역 — 셀 클릭 시 채팅 히스토리 모달
  async getChatRoomMessages(roomId: string) {
    const room = await this.prisma.chatRoom.findUnique({
      where: { id: roomId },
      select: {
        userId: true,
        user: { select: { name: true } },
        proProfile: { select: { userId: true, user: { select: { name: true } } } },
      },
    });
    if (!room) return { messages: [], customerName: null, proName: null, proUserId: null, customerId: null };
    const proUserId = room.proProfile?.userId || null;
    const messages = await this.prisma.message.findMany({
      where: { roomId, isDeleted: false },
      select: { id: true, senderId: true, type: true, content: true, metadata: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
      take: 500,
    });
    return {
      customerId: room.userId,
      customerName: room.user?.name || '고객',
      proUserId,
      proName: room.proProfile?.user?.name || '사회자',
      messages: messages.map((m) => ({
        id: m.id,
        fromPro: m.senderId === proUserId,
        type: m.type,
        content: m.content,
        fileName: (m.metadata as any)?.fileName || null,
        createdAt: m.createdAt,
      })),
    };
  }
}

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';
import { ProService } from '../pro/pro.service';
import { DiscoveryService } from '../discovery/discovery.service';
import { ImageService } from '../image/image.service';
import { UsersService } from '../users/users.service';
import { randomUUID } from 'crypto';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);
  constructor(
    private prisma: PrismaService,
    private notificationService: NotificationService,
    private proService: ProService,
    private discoveryService: DiscoveryService,
    private imageService: ImageService,
    private usersService: UsersService,
  ) {}

  /** 어드민이 특정 유저(또는 다수 유저)에게 쿠폰 발급 — UsersService 헬퍼 위임 */
  async grantCoupon(userIds: string[], couponId: string) {
    const results = await Promise.allSettled(
      userIds.map((uid) => this.usersService.awardCoupon(uid, couponId)),
    );
    const succeeded = results.filter((r) => r.status === 'fulfilled').length;
    return { requested: userIds.length, succeeded, failed: userIds.length - succeeded };
  }

  // ─── 웨딩 파트너 업체 (BusinessProfile) CRUD ────────────────────────────
  // 어드민이 직접 업체를 등록/수정/삭제. 소유 유저가 없으면 placeholder User 자동 생성.
  async getBusinesses(params: { page?: number; limit?: number; search?: string }) {
    const page = params.page || 1;
    const limit = params.limit || 20;
    const where: any = {};
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
        images: { orderBy: { displayOrder: 'asc' } },
        categories: { include: { category: true } },
      },
    });
    if (!business) throw new NotFoundException('업체를 찾을 수 없습니다');
    return business;
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
    categoryNames?: string[];
    status?: string;
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
        descriptionHtml: data.descriptionHtml || null,
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
    return profile;
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
      categoryNames?: string[];
      status?: string;
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
    if (data.descriptionHtml !== undefined) allowed.descriptionHtml = data.descriptionHtml || null;
    if (data.instagramUrl !== undefined) allowed.instagramUrl = data.instagramUrl || null;
    if (data.websiteUrl !== undefined) allowed.websiteUrl = data.websiteUrl || null;
    if (data.videoUrl !== undefined) allowed.videoUrl = data.videoUrl || null;
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
    return profile;
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
  async getPros(params: { page?: number; limit?: number; status?: string; search?: string }) {
    const page = params.page || 1;
    const limit = params.limit || 20;
    const where: any = {};
    if (params.status) where.status = params.status;
    if (params.search) {
      where.user = { name: { contains: params.search, mode: 'insensitive' } };
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
        puddingCount: p.puddingCount,
        isFeatured: p.isFeatured,
        showPartnersLogo: p.showPartnersLogo,
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
            schedules: true,
            matchDeliveries: true,
            puddingTransactions: true,
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
      favorites,
      chatRooms,
      quotations,
      payments,
      schedules,
      reviews,
      matchDeliveries,
      puddingTransactions,
      settlementLogs,
    ] = await Promise.all([
      this.prisma.favorite.findMany({
        where: { targetType: 'pro', targetId: proProfileId },
        include: { user: { select: { id: true, name: true, email: true, phone: true } } },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
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
      this.prisma.proSchedule.findMany({
        where: { proProfileId },
        include: { payment: { select: { id: true, amount: true, status: true } } },
        orderBy: { date: 'desc' },
        take: 80,
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
      this.prisma.puddingTransaction.findMany({
        where: { proProfileId },
        orderBy: { createdAt: 'desc' },
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
      favorites,
      chatRooms,
      quotations: quotations.map((q) => ({ ...q, user: userMap.get(q.userId) || null })),
      payments: payments.map((p) => ({ ...p, user: userMap.get(p.userId) || null })),
      schedules,
      reviews,
      matchDeliveries,
      puddingTransactions,
      settlementLogs,
    };
  }

  // ─── Pro 프로필 업데이트 (어드민이 직접 수정) ────────────────────────────────
  async updatePro(proProfileId: string, data: any) {
    const allowed: any = {};
    const editableFields = [
      'shortIntro', 'mainExperience', 'careerYears', 'awards',
      'youtubeUrl', 'detailHtml', 'gender',
      'isFeatured', 'showPartnersLogo', 'status',
    ];
    for (const k of editableFields) if (data[k] !== undefined) allowed[k] = data[k];

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
          ...(data.name !== undefined ? { name: data.name } : {}),
          ...(data.phone !== undefined ? { phone: data.phone } : {}),
        },
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

    // 어드민은 User.name 을 직접 바꿀 수 있음 (일반 pro-edit 에서는 불가)
    if (data.name !== undefined) {
      await this.prisma.user.update({
        where: { id: profile.userId },
        data: { name: data.name },
      });
    }

    // 어드민만 수정 가능한 flag 필드
    const adminOnly: any = {};
    if (data.isFeatured !== undefined) adminOnly.isFeatured = data.isFeatured;
    if (data.showPartnersLogo !== undefined) adminOnly.showPartnersLogo = data.showPartnersLogo;
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

    return { success: true, proProfileId };
  }

  // ─── 파트너스 로고 토글 ──────────────────────────────────────────────────
  async togglePartnersLogo(proProfileId: string) {
    const profile = await this.prisma.proProfile.findUnique({ where: { id: proProfileId } });
    if (!profile) throw new Error('Pro not found');
    return this.prisma.proProfile.update({
      where: { id: proProfileId },
      data: { showPartnersLogo: !profile.showPartnersLogo },
    });
  }

  // ─── Featured 토글 ───────────────────────────────────────────────────────
  async toggleFeatured(proProfileId: string) {
    const profile = await this.prisma.proProfile.findUnique({ where: { id: proProfileId } });
    if (!profile) throw new Error('Pro not found');
    return this.prisma.proProfile.update({
      where: { id: proProfileId },
      data: { isFeatured: !profile.isFeatured },
    });
  }

  /** 어드민 수동 푸딩 지급 (양수=적립, 음수=차감) + 트랜잭션 로그 */
  async awardPudding(proProfileId: string, amount: number, note?: string) {
    if (!Number.isFinite(amount) || amount === 0) {
      throw new Error('amount는 0이 아닌 숫자여야 합니다.');
    }
    const profile = await this.prisma.proProfile.findUnique({
      where: { id: proProfileId },
      select: { id: true, puddingCount: true },
    });
    if (!profile) throw new Error('Pro not found');
    const nextCount = Math.max(0, profile.puddingCount + amount);
    await this.prisma.$transaction([
      this.prisma.proProfile.update({
        where: { id: proProfileId },
        data: { puddingCount: nextCount },
      }),
      this.prisma.puddingTransaction.create({
        data: {
          proProfileId,
          type: amount > 0 ? 'admin_grant' : 'admin_deduct',
          amount,
          balanceAfter: nextCount,
          note: note ?? '어드민 수동 지급',
        },
      }),
    ]);
    return { proProfileId, previousBalance: profile.puddingCount, amount, newBalance: nextCount };
  }

  // ─── 통계 ────────────────────────────────────────────────────────────────
  async getStats() {
    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [totalUsers, totalPros, pendingPros, totalReviews, thisMonthRevenue, totalRevenue] = await Promise.all([
      this.prisma.user.count({ where: { role: 'general' } }),
      this.prisma.proProfile.count({ where: { status: 'approved' } }),
      this.prisma.proProfile.count({ where: { status: 'pending' } }),
      this.prisma.review.count(),
      this.prisma.payment.aggregate({ where: { status: 'completed', createdAt: { gte: thisMonthStart } }, _sum: { amount: true } }),
      this.prisma.payment.aggregate({ where: { status: 'completed' }, _sum: { amount: true } }),
    ]);

    return {
      totalUsers,
      totalPros,
      pendingPros,
      totalReviews,
      thisMonthRevenue: thisMonthRevenue._sum.amount || 0,
      totalRevenue: totalRevenue._sum.amount || 0,
    };
  }

  // ─── 유저 목록 ───────────────────────────────────────────────────────────
  async getUsers(params: { page?: number; limit?: number; search?: string; role?: string }) {
    const page = params.page || 1;
    const limit = params.limit || 20;
    const where: any = {};
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
          ? {
              id: u.proProfile.id,
              status: u.proProfile.status,
              hasIntro: !!u.proProfile.shortIntro,
              imageCount: u.proProfile._count.images,
              serviceCount: u.proProfile._count.services,
              isEmpty:
                !u.proProfile.shortIntro &&
                u.proProfile._count.images === 0 &&
                u.proProfile._count.services === 0,
            }
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
                schedules: true,
                matchDeliveries: true,
                puddingTransactions: true,
              },
            },
          },
        },
        _count: {
          select: {
            favorites: true,
            chatRooms: true,
            sentMessages: true,
            notifications: true,
            reviews: true,
            matchRequests: true,
            pointTransactions: true,
            userCoupons: true,
          },
        },
      },
    });
    if (!user) throw new NotFoundException('유저를 찾을 수 없습니다');

    const [
      favorites,
      chatRooms,
      matchRequests,
      quotations,
      payments,
      reviews,
      notifications,
      pointTransactions,
      userCoupons,
    ] = await Promise.all([
      this.prisma.favorite.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 80,
      }),
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
          schedules: true,
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
      this.prisma.pointTransaction.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      this.prisma.userCoupon.findMany({
        where: { userId },
        include: { coupon: true },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
    ]);

    const favoriteProIds = favorites.filter((f) => f.targetType === 'pro').map((f) => f.targetId);
    const favoriteBusinessIds = favorites.filter((f) => f.targetType === 'business').map((f) => f.targetId);
    const [favoritePros, favoriteBusinesses, paymentPros] = await Promise.all([
      favoriteProIds.length
        ? this.prisma.proProfile.findMany({
            where: { id: { in: favoriteProIds } },
            include: {
              user: { select: { id: true, name: true, email: true, profileImageUrl: true } },
              images: { orderBy: { displayOrder: 'asc' }, take: 1 },
            },
          })
        : Promise.resolve([]),
      favoriteBusinessIds.length
        ? this.prisma.businessProfile.findMany({
            where: { id: { in: favoriteBusinessIds } },
            include: { images: { orderBy: { displayOrder: 'asc' }, take: 1 } },
          })
        : Promise.resolve([]),
      payments.length
        ? this.prisma.proProfile.findMany({
            where: { id: { in: Array.from(new Set(payments.map((p) => p.proProfileId))) } },
            include: { user: { select: { id: true, name: true, email: true } } },
          })
        : Promise.resolve([]),
    ]);
    const favoriteProMap = new Map(favoritePros.map((p) => [p.id, p]));
    const favoriteBusinessMap = new Map(favoriteBusinesses.map((b) => [b.id, b]));
    const paymentProMap = new Map(paymentPros.map((p) => [p.id, p]));

    return {
      user,
      relations: {
        favorites: favorites.map((f) => ({
          ...f,
          target:
            f.targetType === 'pro'
              ? favoriteProMap.get(f.targetId) || null
              : favoriteBusinessMap.get(f.targetId) || null,
        })),
        chatRooms,
        matchRequests,
        quotations,
        payments: payments.map((p) => ({ ...p, proProfile: paymentProMap.get(p.proProfileId) || null })),
        reviews,
        notifications,
        pointTransactions,
        userCoupons,
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
      'pointBalance',
      'referralCode',
    ];
    for (const field of editableFields) {
      if (data[field] !== undefined) allowed[field] = data[field] === '' ? null : data[field];
    }
    if (allowed.pointBalance !== undefined) allowed.pointBalance = Number(allowed.pointBalance) || 0;

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: allowed,
    });

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

  // ─── 유저 권한 변경 ──────────────────────────────────────────────────────
  async updateUserRole(userId: string, role: string) {
    return this.prisma.user.update({ where: { id: userId }, data: { role: role as any } });
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
    return { success: true, userId, archivedEmail: newEmail };
  }

  // ─── 유저 삭제 ───────────────────────────────────────────────────────────
  async deleteUser(userId: string) {
    await this.prisma.user.delete({ where: { id: userId } });
    return { success: true };
  }

  // ─── 의뢰/예약 목록 ─────────────────────────────────────────────────────
  async getBookings(params: { page?: number; limit?: number; status?: string }) {
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
  async getPayments(params: { page?: number; limit?: number; status?: string }) {
    const page = params.page || 1;
    const limit = params.limit || 20;
    const where: any = {};
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
  async getReviews(params: { page?: number; limit?: number }) {
    const page = params.page || 1;
    const limit = params.limit || 20;

    const [data, total] = await Promise.all([
      this.prisma.review.findMany({
        include: {
          reviewer: { select: { name: true } },
          proProfile: { include: { user: { select: { name: true } } } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.review.count(),
    ]);

    return {
      data: data.map((r) => ({
        id: r.id,
        reviewerName: r.reviewer?.name,
        proName: r.proProfile?.user?.name,
        avgRating: r.avgRating,
        comment: r.comment,
        createdAt: r.createdAt,
        isAnonymous: r.isAnonymous,
      })),
      total,
      page,
      limit,
    };
  }

  // ─── 리뷰 삭제 ───────────────────────────────────────────────────────────
  async deleteReview(reviewId: string) {
    await this.prisma.review.delete({ where: { id: reviewId } });
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
      this.prisma.proSchedule.updateMany({ where: { paymentId: id }, data: { paymentId: null } }),
      this.prisma.review.deleteMany({ where: { paymentId: id } }),
      this.prisma.payment.delete({ where: { id } }),
    ]);
    return { success: true };
  }

  async updateSchedule(id: string, data: any) {
    const allowed: any = {};
    if (data.date !== undefined) allowed.date = data.date ? new Date(data.date) : undefined;
    if (data.status !== undefined) allowed.status = data.status;
    if (data.note !== undefined) allowed.note = data.note || null;
    if (data.source !== undefined) allowed.source = data.source || 'admin';
    if (data.paymentId !== undefined) allowed.paymentId = data.paymentId || null;
    return this.prisma.proSchedule.update({ where: { id }, data: allowed });
  }

  async deleteSchedule(id: string) {
    await this.prisma.proSchedule.delete({ where: { id } });
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

  async deleteFavorite(id: string) {
    await this.prisma.favorite.delete({ where: { id } });
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

  // ─── 사회자 출석체크 크론 (한국시간 매일 오전 9시) ─────────────────────
  @Cron('0 9 * * *', { timeZone: 'Asia/Seoul' })
  async sendProDailyAttendanceReminder() {
    const pros = await this.prisma.proProfile.findMany({
      where: { status: 'approved' },
      select: { userId: true },
    });

    for (const p of pros) {
      this.notificationService
        .createNotification(
          p.userId,
          'system' as any,
          '오늘도 출석체크 하셨나요? 🍮',
          '프리티풀에 접속해 푸딩을 받아보세요!',
          { type: 'pro_attendance' },
        )
        .catch(() => {});
    }

    this.logger.log(`Pro daily attendance reminders sent to ${pros.length} pros`);
  }
}

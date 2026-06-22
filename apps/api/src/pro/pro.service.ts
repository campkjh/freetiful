import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  OnModuleInit,
  Logger,
} from '@nestjs/common';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type { Multer } from 'multer';
import { PrismaService } from '../prisma/prisma.service';
import { ImageService, ImageProcessOptions } from '../image/image.service';
import { DiscoveryService } from '../discovery/discovery.service';
import { ChatRealtimeService } from '../chat/chat-realtime.service';

const LEGACY_HANDOVER_PROFILES = [
  {
    virtualId: 'legacy-jungmj',
    aliases: ['정미정', '정미정 사회자', 'jungmj'],
    name: '정미정',
    email: 'jungmj@freetiful.com',
    profileImageUrl: '/images/pro-33/0533d0a3d5f361ad511e32dafb775319b26ce7541772100346528.avif',
    images: [
      '/images/pro-33/0533d0a3d5f361ad511e32dafb775319b26ce7541772100346528.avif',
      '/images/pro-33/0cbe948eaed4fdb569f7e202960cc01a2dc22ff91772100447466.avif',
    ],
    shortIntro: '경력 13년차 아나운서',
    mainExperience: 'MBC충북 아나운서 / SPOTV 스포츠 아나운서',
    careerYears: 13,
    gender: 'female',
    basePrice: 0,
    category: '사회자',
  },
] as const;

type LegacyHandoverProfile = (typeof LEGACY_HANDOVER_PROFILES)[number];

function normalizeHandoverSearch(value?: string) {
  return (value || '').trim().toLowerCase();
}

function handoverSearchMatches(profile: LegacyHandoverProfile, search?: string) {
  const keyword = normalizeHandoverSearch(search);
  if (!keyword) return true;
  const haystack = [
    profile.name,
    profile.email,
    profile.shortIntro,
    profile.mainExperience,
    profile.category,
    ...profile.aliases,
  ].join(' ').toLowerCase();
  return keyword
    .split(/\s+/)
    .filter(Boolean)
    .every((token) => haystack.includes(token));
}

@Injectable()
export class ProService implements OnModuleInit {
  private readonly logger = new Logger(ProService.name);
  private readonly priceResetAuditAction = 'maintenance:force_reset_all_pro_service_prices_to_zero_20260503_v2';
  private profileIdentityCache = new Map<string, { id: string; profileViews: number; ts: number }>();
  private readonly PROFILE_IDENTITY_CACHE_TTL = 10 * 60_000;

  constructor(
    private prisma: PrismaService,
    private imageService: ImageService,
    private discovery: DiscoveryService,
    private chatRealtime: ChatRealtimeService,
  ) {}

  // 서버 시작 시 기존 프로 유저들의 User.profileImageUrl 이 비어있으면
  // 대표 ProProfileImage 의 URL 로 채워줌 (일회성 마이그레이션).
  async onModuleInit() {
    this.ensurePerformanceIndexes().catch(() => undefined);
    await this.resetExistingProServicePricesToInquiryOnce();

    try {
      const usersNeedingSync = await this.prisma.user.findMany({
        where: {
          profileImageUrl: null,
          proProfile: { isNot: null },
        },
        select: { id: true, proProfile: { select: { id: true } } },
        take: 200,
      });
      if (usersNeedingSync.length === 0) return;
      let synced = 0;
      for (const u of usersNeedingSync) {
        if (!u.proProfile) continue;
        const primary = await this.prisma.proProfileImage.findFirst({
          where: { proProfileId: u.proProfile.id, isPrimary: true },
          select: { imageUrl: true },
        });
        const fallback = !primary
          ? await this.prisma.proProfileImage.findFirst({
              where: { proProfileId: u.proProfile.id },
              orderBy: { displayOrder: 'asc' },
              select: { imageUrl: true },
            })
          : null;
        const url = primary?.imageUrl || fallback?.imageUrl;
        if (url) {
          await this.prisma.user.update({ where: { id: u.id }, data: { profileImageUrl: url } });
          synced++;
        }
      }
      if (synced > 0) this.logger.log(`Synced ${synced} User.profileImageUrl from primary ProProfileImage`);
    } catch (e: any) {
      this.logger.warn(`profile image sync skipped: ${e?.message || e}`);
    }
  }

  private async ensurePerformanceIndexes() {
    await Promise.allSettled([
      this.prisma.$executeRawUnsafe(
        'CREATE INDEX CONCURRENTLY IF NOT EXISTS "match_deliveries_proProfileId_status_deliveredAt_idx" ON "match_deliveries" ("proProfileId", "status", "deliveredAt")',
      ),
      this.prisma.$executeRawUnsafe(
        'CREATE INDEX CONCURRENTLY IF NOT EXISTS "reviews_proProfileId_isVisible_createdAt_idx" ON "reviews" ("proProfileId", "isVisible", "createdAt")',
      ),
    ]);
  }

  private async resetExistingProServicePricesToInquiryOnce() {
    try {
      const alreadyApplied = await this.prisma.adminAuditLog.findFirst({
        where: { action: this.priceResetAuditAction },
        select: { id: true },
      });
      if (alreadyApplied) return;

      const result = await this.prisma.proService.updateMany({
        data: { basePrice: 0 },
      });

      await this.prisma.adminAuditLog.create({
        data: {
          adminId: 'system',
          action: this.priceResetAuditAction,
          targetType: 'pro_services',
          afterState: { updatedCount: result.count },
        },
      });

      if (result.count > 0) {
        this.logger.log(`Reset ${result.count} pro service prices to inquiry-only`);
      }
    } catch (e: any) {
      this.logger.warn(`pro service price reset skipped: ${e?.message || e}`);
    }
  }

  // ─── Profile (My) ────────────────────────────────────────────────────────

  async getProfile(userId: string) {
    const include = {
      user: { select: { id: true, name: true, phone: true, email: true, profileImageUrl: true } },
      images: { orderBy: { displayOrder: 'asc' as const } },
      services: { orderBy: { displayOrder: 'asc' as const } },
      faqs: { orderBy: { displayOrder: 'asc' as const } },
      categories: { include: { category: true } },
      regions: { include: { region: true } },
      languages: true,
    };
    let profile = await this.prisma.proProfile.findUnique({ where: { userId }, include });

    if (!profile) {
      await this.prisma.proProfile.create({
        data: { userId, status: 'draft' },
      });
      profile = await this.prisma.proProfile.findUnique({ where: { userId }, include });
    }

    return profile;
  }

  async createProfile(userId: string) {
    const existing = await this.prisma.proProfile.findUnique({ where: { userId } });
    if (existing) return existing;
    return this.prisma.proProfile.create({
      data: { userId, status: 'draft' },
    });
  }

  private getLegacyHandoverProfile(id: string) {
    const normalized = normalizeHandoverSearch(id);
    return LEGACY_HANDOVER_PROFILES.find(
      (profile) =>
        profile.virtualId === id ||
        profile.email === id ||
        normalizeHandoverSearch(profile.name) === normalized ||
        profile.aliases.some((alias) => normalizeHandoverSearch(alias) === normalized),
    );
  }

  private legacyHandoverCandidates(search: string | undefined, existingProfiles: any[]) {
    const existingNames = new Set(existingProfiles.map((profile) => profile.user?.name).filter(Boolean));
    const existingEmails = new Set(existingProfiles.map((profile) => profile.user?.email).filter(Boolean));

    return LEGACY_HANDOVER_PROFILES
      .filter((profile) => !existingNames.has(profile.name) && !existingEmails.has(profile.email))
      .filter((profile) => handoverSearchMatches(profile, search))
      .map((profile) => ({
        id: profile.virtualId,
        ownerUserId: profile.virtualId,
        isMine: false,
        name: profile.name,
        profileImageUrl: profile.profileImageUrl,
        shortIntro: profile.shortIntro,
        mainExperience: profile.mainExperience,
        careerYears: profile.careerYears,
        avgRating: 5,
        reviewCount: 0,
        basePrice: profile.basePrice,
        categories: [profile.category],
      }));
  }

  private async generateUniqueReferralCode() {
    for (let i = 0; i < 8; i++) {
      const code = `LH${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
      const existing = await this.prisma.user.findUnique({
        where: { referralCode: code },
        select: { id: true },
      });
      if (!existing) return code;
    }
    return `LH${Date.now().toString(36).toUpperCase()}`;
  }

  private async ensureLegacyHandoverProfile(fixture: LegacyHandoverProfile) {
    const referralCode = await this.generateUniqueReferralCode();
    return this.prisma.$transaction(async (tx) => {
      const existingUser = await tx.user.findUnique({
        where: { email: fixture.email },
        select: { id: true },
      });

      const seedUser = existingUser
        ? await tx.user.update({
            where: { id: existingUser.id },
            data: {
              name: fixture.name,
              role: 'pro',
              profileImageUrl: fixture.profileImageUrl,
              isActive: true,
              isBanned: false,
            },
            select: { id: true },
          })
        : await tx.user.create({
            data: {
              name: fixture.name,
              email: fixture.email,
              role: 'pro',
              referralCode,
              profileImageUrl: fixture.profileImageUrl,
              notificationSettings: { create: {} },
            },
            select: { id: true },
          });

      const existingProfile = await tx.proProfile.findUnique({
        where: { userId: seedUser.id },
        select: { id: true },
      });

      const profile = existingProfile
        ? await tx.proProfile.update({
            where: { id: existingProfile.id },
            data: {
              status: 'approved',
              gender: fixture.gender,
              shortIntro: fixture.shortIntro,
              mainExperience: fixture.mainExperience,
              careerYears: fixture.careerYears,
              // 시드 fixture 도 fanout 에 노출되도록 false (false 로 둬도 transfer 시 다시 false)
              isProfileHidden: false,
              rejectionReason: null,
              approvedAt: new Date(),
            },
          })
        : await tx.proProfile.create({
            data: {
              userId: seedUser.id,
              status: 'approved',
              gender: fixture.gender,
              shortIntro: fixture.shortIntro,
              mainExperience: fixture.mainExperience,
              careerYears: fixture.careerYears,
              avgRating: 5,
              reviewCount: 0,
              // 시드 fixture 도 fanout 에 노출되도록 false (false 로 둬도 transfer 시 다시 false)
              isProfileHidden: false,
              approvedAt: new Date(),
            },
          });

      const imageCount = await tx.proProfileImage.count({ where: { proProfileId: profile.id } });
      if (imageCount === 0) {
        await tx.proProfileImage.createMany({
          data: fixture.images.map((imageUrl, index) => ({
            proProfileId: profile.id,
            imageUrl,
            displayOrder: index,
            isPrimary: index === 0,
            hasFace: true,
          })),
        });
      }

      const serviceCount = await tx.proService.count({ where: { proProfileId: profile.id } });
      if (serviceCount === 0) {
        await tx.proService.create({
          data: {
            proProfileId: profile.id,
            title: '결혼식 사회 진행',
            description: fixture.shortIntro,
            basePrice: fixture.basePrice,
            priceUnit: 'per_event',
            displayOrder: 0,
            isActive: true,
          },
        });
      }

      const category = await tx.category.findFirst({
        where: { type: 'pro', name: fixture.category },
        select: { id: true },
      });
      if (category) {
        await tx.proCategory.createMany({
          data: [{ proProfileId: profile.id, categoryId: category.id }],
          skipDuplicates: true,
        });
      }

      return profile.id;
    });
  }

  private async resolveProfileHandoverTargetId(proProfileId: string) {
    const legacyProfile = this.getLegacyHandoverProfile(proProfileId);
    if (!legacyProfile) return proProfileId;
    return this.ensureLegacyHandoverProfile(legacyProfile);
  }

  async getProfileHandoverCandidates(userId: string, search?: string, limit = 30) {
    const normalizedLimit = Math.min(Math.max(Number(limit) || 30, 1), 50);
    const keyword = search?.trim();
    const seedOwnerWhere = {
      OR: [
        { email: { endsWith: '@freetiful.com' } },
        { email: { endsWith: '@freetiful.internal' } },
      ],
    };

    const candidates = await this.prisma.proProfile.findMany({
      where: {
        status: 'approved',
        user: { isActive: true, ...seedOwnerWhere },
        ...(keyword
          ? {
              AND: [
                {
                  OR: [
                    { user: { name: { contains: keyword, mode: 'insensitive' } } },
                    { shortIntro: { contains: keyword, mode: 'insensitive' } },
                    { mainExperience: { contains: keyword, mode: 'insensitive' } },
                    { categories: { some: { category: { name: { contains: keyword, mode: 'insensitive' } } } } },
                  ],
                },
              ],
            }
          : {}),
      },
      include: {
        user: { select: { id: true, name: true, email: true, profileImageUrl: true } },
        images: { orderBy: { displayOrder: 'asc' }, take: 1 },
        categories: { include: { category: { select: { name: true } } } },
        services: { where: { isActive: true }, orderBy: { displayOrder: 'asc' }, take: 1 },
      },
      orderBy: [{ reviewCount: 'desc' }, { createdAt: 'asc' }],
      take: normalizedLimit,
    });

    const rows = candidates.map((profile) => ({
      id: profile.id,
      ownerUserId: profile.userId,
      isMine: profile.userId === userId,
      name: profile.user?.name || '이름 없음',
      profileImageUrl: profile.images[0]?.imageUrl || profile.user?.profileImageUrl || null,
      shortIntro: profile.shortIntro,
      mainExperience: profile.mainExperience,
      careerYears: profile.careerYears,
      avgRating: Number(profile.avgRating),
      reviewCount: profile.reviewCount,
      basePrice: profile.services[0]?.basePrice ?? null,
      categories: profile.categories.map((item) => item.category.name),
    }));

    return [
      ...rows,
      ...this.legacyHandoverCandidates(search, candidates),
    ];
  }

  async claimProfileHandover(userId: string, proProfileId: string) {
    const resolvedProProfileId = await this.resolveProfileHandoverTargetId(proProfileId);
    let target = await this.prisma.proProfile.findUnique({
      where: { id: resolvedProProfileId },
      include: {
        user: { select: { id: true, name: true, email: true, profileImageUrl: true } },
        images: { orderBy: [{ isPrimary: 'desc' }, { displayOrder: 'asc' }], take: 1 },
      },
    });

    if (!target) {
      const legacyProfile = this.getLegacyHandoverProfile(proProfileId);
      if (legacyProfile) {
        const restoredProfileId = await this.ensureLegacyHandoverProfile(legacyProfile);
        target = await this.prisma.proProfile.findUnique({
          where: { id: restoredProfileId },
          include: {
            user: { select: { id: true, name: true, email: true, profileImageUrl: true } },
            images: { orderBy: [{ isPrimary: 'desc' }, { displayOrder: 'asc' }], take: 1 },
          },
        });
      }
    }

    if (!target) {
      throw new NotFoundException('인수할 프로필을 찾을 수 없습니다.');
    }

    const ownerEmail = target.user?.email || '';
    const canClaim =
      target.userId === userId ||
      ownerEmail.endsWith('@freetiful.com') ||
      ownerEmail.endsWith('@freetiful.internal');
    if (!canClaim) {
      throw new ConflictException('이미 실제 계정에 연결된 프로필입니다.');
    }

    const currentProfile = await this.prisma.proProfile.findUnique({
      where: { userId },
      select: { id: true, status: true },
    });

    if (currentProfile && currentProfile.id !== target.id && currentProfile.status === 'approved') {
      throw new ConflictException('이미 승인된 프로필이 연결되어 있습니다.');
    }

    const oldUserId = target.userId;
    const profileImageUrl = target.images[0]?.imageUrl || target.user?.profileImageUrl || null;

    const result = await this.prisma.$transaction(async (tx) => {
      if (currentProfile && currentProfile.id !== target.id) {
        await tx.proProfile.delete({ where: { id: currentProfile.id } });
      }

      const userUpdate = await tx.user.update({
        where: { id: userId },
        data: {
          role: 'pro',
          ...(target.user?.name ? { name: target.user.name } : {}),
          ...(profileImageUrl ? { profileImageUrl } : {}),
        },
        select: {
          id: true,
          role: true,
          name: true,
          phone: true,
          email: true,
          profileImageUrl: true,
          referralCode: true,
          isActive: true,
          createdAt: true,
        },
      });

      const profile = await tx.proProfile.update({
        where: { id: target.id },
        data: {
          userId,
          status: 'approved',
          isProfileHidden: false,
          rejectionReason: null,
          approvedAt: target.approvedAt || new Date(),
        },
      });

      await tx.matchDelivery.deleteMany({
        where: { proProfileId: target.id },
      });
      const legacyReviews = await tx.review.findMany({
        where: { proProfileId: target.id },
        select: { id: true },
      });
      const legacyReviewIds = legacyReviews.map((review) => review.id);
      if (legacyReviewIds.length > 0) {
        await tx.reviewImage.deleteMany({
          where: { reviewId: { in: legacyReviewIds } },
        });
        await tx.reviewReport.deleteMany({
          where: { reviewId: { in: legacyReviewIds } },
        });
      }
      await tx.review.deleteMany({
        where: { proProfileId: target.id },
      });
      await tx.proProfile.update({
        where: { id: target.id },
        data: { avgRating: 0, reviewCount: 0 },
      });

      if (oldUserId !== userId) {
        const rooms = await tx.chatRoom.findMany({
          where: { proProfileId: target.id },
          select: { id: true },
        });
        const roomIds = rooms.map((room) => room.id);
        if (roomIds.length > 0) {
          await tx.chatRoomMember.deleteMany({
            where: { userId, roomId: { in: roomIds } },
          });
          await tx.chatRoomMember.updateMany({
            where: { userId: oldUserId, roomId: { in: roomIds } },
            data: { userId },
          });
          await tx.message.updateMany({
            where: { senderId: oldUserId, roomId: { in: roomIds } },
            data: { senderId: userId },
          });
        }

        await tx.user.update({
          where: { id: oldUserId },
          data: { role: 'general' },
        }).catch(() => null);
      }

      return { user: userUpdate, profile };
    });

    this.discovery.invalidateCache(target.id);
    this.discovery.invalidateCache();

    return {
      user: result.user,
      profile: await this.getProfile(userId),
    };
  }

  async updateProfile(
    userId: string,
    data: {
      shortIntro?: string;
      mainExperience?: string;
      careerYears?: number;
      awards?: string;
      detailHtml?: string;
      youtubeUrl?: string;
      gender?: string;
      isNationwide?: boolean;
      isProfileHidden?: boolean;
      profileHidden?: boolean;
      profilehidden?: boolean;
    },
  ) {
    const existing = await this.prisma.proProfile.findUnique({ where: { userId } });
    const nextProfileHidden =
      data.isProfileHidden ?? data.profileHidden ?? data.profilehidden;

    const fields = {
      ...(data.shortIntro !== undefined ? { shortIntro: data.shortIntro } : {}),
      ...(data.mainExperience !== undefined ? { mainExperience: data.mainExperience } : {}),
      ...(data.careerYears !== undefined ? { careerYears: data.careerYears } : {}),
      ...(data.awards !== undefined ? { awards: data.awards } : {}),
      ...(data.detailHtml !== undefined ? { detailHtml: data.detailHtml } : {}),
      ...(data.youtubeUrl !== undefined ? { youtubeUrl: data.youtubeUrl } : {}),
      ...(data.gender !== undefined ? { gender: data.gender } : {}),
      ...(data.isNationwide !== undefined ? { isNationwide: data.isNationwide } : {}),
      ...(nextProfileHidden !== undefined ? { isProfileHidden: nextProfileHidden } : {}),
    };

    if (!existing) {
      const created = await this.prisma.proProfile.create({
        data: { userId, status: 'draft', ...fields },
      });
      this.discovery.invalidateCache(created.id);
      return created;
    }

    const updated = await this.prisma.proProfile.update({
      where: { userId },
      data: fields,
    });
    this.discovery.invalidateCache(updated.id);
    // 저장 즉시 상세 캐시 재워밍 → 사회자가 바로 조회해도 신선+빠르게(0.5s) 반영 (콜드 미스 2.2s 회피)
    this.discovery.getProDetail(updated.id, false).catch(() => {});
    return updated;
  }

  async updateProfileVisibility(
    userId: string,
    data: {
      isProfileHidden?: boolean;
      profileHidden?: boolean;
      profilehidden?: boolean;
    },
  ) {
    const nextProfileHidden =
      data.isProfileHidden ?? data.profileHidden ?? data.profilehidden;
    if (nextProfileHidden === undefined) {
      return this.getProfile(userId);
    }
    return this.updateProfile(userId, { isProfileHidden: nextProfileHidden });
  }

  // ─── Profile Images ──────────────────────────────────────────────────────

  async uploadImage(
    userId: string,
    file: Express.Multer.File,
    options: ImageProcessOptions = {},
  ) {
    const profile = await this.getProfileByUserId(userId);

    // Check image count (max 10)
    const count = await this.prisma.proProfileImage.count({
      where: { proProfileId: profile.id },
    });
    if (count >= 10) {
      throw new BadRequestException('이미지는 최대 10장까지 등록할 수 있습니다.');
    }

    // Minimum 4 images for profile completion — checked at submission, not upload.
    // 얼굴 인식 결과는 저장하되, 여러 장 업로드 중 한 장 때문에 전체 저장이 막히지 않게 한다.
    const processed = await this.imageService.processImage(file, {
      ...options,
      requireFace: false,
      maxWidth: 1200,
      maxHeight: 1200,
      quality: 85,
    });

    const image = await this.prisma.proProfileImage.create({
      data: {
        proProfileId: profile.id,
        imageUrl: processed.webpPath || processed.path,
        originalUrl: processed.path,
        displayOrder: count,
        hasFace: processed.hasFace,
        isPrimary: count === 0, // first image is primary
      },
    });

    // 첫 업로드일 때 대표 사진을 User.profileImageUrl 에 반영
    if (count === 0) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { profileImageUrl: image.imageUrl },
      });
      this.chatRealtime.emitProfileUpdatedForUser(userId, { profileImageUrl: image.imageUrl }).catch(() => undefined);
    }

    this.discovery.invalidateCache(profile.id);
    return image;
  }

  async getImages(userId: string) {
    const profile = await this.getProfileByUserId(userId);
    return this.prisma.proProfileImage.findMany({
      where: { proProfileId: profile.id },
      orderBy: { displayOrder: 'asc' },
    });
  }

  async deleteImage(userId: string, imageId: string) {
    const profile = await this.getProfileByUserId(userId);
    const image = await this.prisma.proProfileImage.findFirst({
      where: { id: imageId, proProfileId: profile.id },
    });
    if (!image) throw new NotFoundException('이미지를 찾을 수 없습니다.');

    // Delete files from disk
    const filename = image.imageUrl.split('/').pop();
    if (filename) await this.imageService.deleteFile(filename);
    if (image.originalUrl) {
      const origFilename = image.originalUrl.split('/').pop();
      if (origFilename) await this.imageService.deleteFile(origFilename);
    }

    await this.prisma.proProfileImage.delete({ where: { id: imageId } });

    // Re-assign primary if needed
    if (image.isPrimary) {
      const first = await this.prisma.proProfileImage.findFirst({
        where: { proProfileId: profile.id },
        orderBy: { displayOrder: 'asc' },
      });
      if (first) {
        await this.prisma.proProfileImage.update({
          where: { id: first.id },
          data: { isPrimary: true },
        });
        await this.prisma.user.update({
          where: { id: userId },
          data: { profileImageUrl: first.imageUrl },
        });
        this.chatRealtime.emitProfileUpdatedForUser(userId, { profileImageUrl: first.imageUrl }).catch(() => undefined);
      } else {
        await this.prisma.user.update({
          where: { id: userId },
          data: { profileImageUrl: null },
        });
        this.chatRealtime.emitProfileUpdatedForUser(userId, { profileImageUrl: null }).catch(() => undefined);
      }
    }
    this.discovery.invalidateCache(profile.id);
  }

  async reorderImages(userId: string, imageIds: string[], primaryId?: string) {
    const profile = await this.getProfileByUserId(userId);
    const normalizedPrimaryId = primaryId && imageIds.includes(primaryId) ? primaryId : imageIds[0];

    await this.prisma.$transaction(
      imageIds.map((id, index) =>
        this.prisma.proProfileImage.updateMany({
          where: { id, proProfileId: profile.id },
          data: {
            displayOrder: index,
            isPrimary: id === normalizedPrimaryId,
          },
        }),
      ),
    );

    // 재정렬로 새 대표 사진이 바뀐 경우 User.profileImageUrl 동기화
    const firstImageId = normalizedPrimaryId;
    if (firstImageId) {
      const firstImg = await this.prisma.proProfileImage.findFirst({
        where: { id: firstImageId, proProfileId: profile.id },
        select: { imageUrl: true },
      });
      if (firstImg?.imageUrl) {
        await this.prisma.user.update({
          where: { id: userId },
          data: { profileImageUrl: firstImg.imageUrl },
        });
        this.chatRealtime.emitProfileUpdatedForUser(userId, { profileImageUrl: firstImg.imageUrl }).catch(() => undefined);
      }
    }

    this.discovery.invalidateCache(profile.id);
    return this.getImages(userId);
  }

  async adjustImage(
    userId: string,
    imageId: string,
    options: Pick<ImageProcessOptions, 'brightness' | 'contrast' | 'saturation' | 'sharpen' | 'cropX' | 'cropY' | 'cropWidth' | 'cropHeight'>,
  ) {
    const profile = await this.getProfileByUserId(userId);
    const image = await this.prisma.proProfileImage.findFirst({
      where: { id: imageId, proProfileId: profile.id },
    });
    if (!image) throw new NotFoundException('이미지를 찾을 수 없습니다.');

    // Get original file for re-processing
    const origFilename = image.originalUrl?.split('/').pop();
    if (!origFilename) throw new BadRequestException('원본 이미지를 찾을 수 없습니다.');

    const processed = await this.imageService.adjustImage(origFilename, options);

    // Delete old webp
    const oldFilename = image.imageUrl.split('/').pop();
    if (oldFilename && oldFilename !== processed.filename) {
      await this.imageService.deleteFile(oldFilename);
    }

    this.discovery.invalidateCache(profile.id);
    return this.prisma.proProfileImage.update({
      where: { id: imageId },
      data: {
        imageUrl: processed.path,
        hasFace: processed.hasFace,
      },
    });
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  // ─── Registration Submission ─────────────────────────────────────────────

  async submitRegistration(
    userId: string,
    data: {
      name?: string;
      phone?: string;
      gender?: string;
      shortIntro?: string;
      mainExperience?: string;
      careerYears?: number;
      awards?: string;
      youtubeUrl?: string;
      detailHtml?: string;
      photos?: string[]; // base64 data URLs
      mainPhotoIndex?: number;
      services?: { title: string; description?: string; basePrice?: number }[];
      faqs?: { question: string; answer: string }[];
      languages?: string[];
      /** 전문가 타입 (사회자 / 쇼호스트 / 축가·연주) */
      category?: string;
      /** 활동 지역 배열 */
      regions?: string[];
      /** 자유 태그 (즉시출근, 풀타임 가능, 출장 가능 등) */
      tags?: string[];
      /** 프로필 노출 숨김 여부 */
      isProfileHidden?: boolean;
    },
  ) {
    // 전화번호만 업데이트 가능. 이름은 User.name (가입 시 설정) 을 그대로 사용 —
    // 프로 등록/수정 과정에서 User.name 을 덮어쓰면 일반 모드로 돌아와도 이름이 바뀌는 버그 발생
    if (data.phone !== undefined) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { phone: data.phone == null ? null : data.phone.trim() || null },
      });
    }

    const fields = {
      ...(data.gender !== undefined ? { gender: data.gender } : {}),
      ...(data.shortIntro !== undefined ? { shortIntro: data.shortIntro } : {}),
      ...(data.mainExperience !== undefined ? { mainExperience: data.mainExperience } : {}),
      ...(data.careerYears !== undefined ? { careerYears: data.careerYears } : {}),
      ...(data.awards !== undefined ? { awards: data.awards } : {}),
      ...(data.youtubeUrl !== undefined ? { youtubeUrl: data.youtubeUrl } : {}),
      ...(data.detailHtml !== undefined ? { detailHtml: data.detailHtml } : {}),
      ...(data.isProfileHidden !== undefined ? { isProfileHidden: data.isProfileHidden } : {}),
      ...(Array.isArray(data.tags) ? { tags: Array.from(new Set(data.tags.filter(Boolean))) } : {}),
    };

    // 기존 프로필 존재 여부 체크: approved 이면 status 유지, 아니면 pending
    const existing = await this.prisma.proProfile.findUnique({
      where: { userId },
      select: { status: true },
    });
    const keepStatus = existing?.status === 'approved' ? { status: 'approved' as const } : { status: 'pending' as const };

    const profile = await this.prisma.proProfile.upsert({
      where: { userId },
      create: { userId, status: 'pending', ...fields },
      update: { ...keepStatus, ...fields },
    });

    // Photos: base64 data URL → webp on disk → ProProfileImage 재생성
    if (Array.isArray(data.photos)) {
      if (data.photos.length === 0) {
        await this.prisma.proProfileImage.deleteMany({ where: { proProfileId: profile.id } });
        await this.prisma.user.update({
          where: { id: userId },
          data: { profileImageUrl: null },
        });
      } else {
        const mainIdx = Math.max(0, Math.min(data.mainPhotoIndex ?? 0, data.photos.length - 1));
        const processedPhotos = await Promise.all(
          data.photos.map(async (photo, index) => {
            try {
              const processed = await this.savePhotoFromDataUrl(photo);
              if (!processed) return { index, error: 'invalid data URL' };
              return { ...processed, index };
            } catch (e: any) {
              return { index, error: e?.message || String(e) };
            }
          }),
        );
        const savedImages = processedPhotos.filter(
          (photo): photo is { path: string; originalPath: string; index: number } => 'path' in photo,
        );
        const failures = processedPhotos.filter(
          (photo): photo is { index: number; error: string } => 'error' in photo,
        );

        // 모든 사진 실패 시 에러로 터뜨려 프론트가 알림 표시
        if (savedImages.length === 0) {
          throw new BadRequestException(
            `사진 업로드 실패 (${failures.length}장): ${failures.map((f) => f.error).join('; ')}`,
          );
        }

        // 성공한 사진만 있을 때 기존 이미지 교체
        const primarySource = savedImages.find((img) => img.index === mainIdx) || savedImages[0];
        await this.prisma.proProfileImage.deleteMany({ where: { proProfileId: profile.id } });
        for (const [displayOrder, img] of savedImages.entries()) {
          await this.prisma.proProfileImage.create({
            data: {
              proProfileId: profile.id,
              imageUrl: img.path,
              originalUrl: img.originalPath,
              displayOrder,
              isPrimary: img.index === primarySource.index,
              hasFace: true,
            },
          });
        }

        // 대표 사진을 User.profileImageUrl 로 동기화 — 프로필 아바타(마이페이지/채팅/견적카드)에 반영됨
        if (primarySource) {
          await this.prisma.user.update({
            where: { id: userId },
            data: { profileImageUrl: primarySource.path },
          });
          this.chatRealtime.emitProfileUpdatedForUser(userId, { profileImageUrl: primarySource.path }).catch(() => undefined);
        }
      }
    }

    // 관계 데이터(서비스/FAQ/언어/카테고리/지역)는 서로 독립 테이블 → createMany + 병렬 처리로 저장 속도 개선.
    // 각 블록은 자체 트랜잭션(delete+createMany)이라 동시 재제출 race 도 안전.
    const relationOps: Promise<unknown>[] = [];

    if (Array.isArray(data.services)) {
      // 중복 타이틀 제거 (같은 title 은 마지막 것만 유지)
      const seen = new Set<string>();
      const unique = [...data.services].reverse().filter((s) => {
        if (!s?.title || seen.has(s.title)) return false;
        seen.add(s.title);
        return true;
      }).reverse();
      relationOps.push(this.prisma.$transaction([
        this.prisma.proService.deleteMany({ where: { proProfileId: profile.id } }),
        this.prisma.proService.createMany({
          data: unique.map((s, i) => ({
            proProfileId: profile.id,
            title: s.title,
            description: s.description ?? null,
            basePrice: s.basePrice ?? null,
            displayOrder: i,
            isActive: true,
          })),
        }),
      ]));
    }

    if (Array.isArray(data.faqs)) {
      // 중복 question 제거
      const seen = new Set<string>();
      const unique = data.faqs.filter((f) => {
        if (!f?.question || !f?.answer || seen.has(f.question)) return false;
        seen.add(f.question);
        return true;
      });
      relationOps.push(this.prisma.$transaction([
        this.prisma.proFaq.deleteMany({ where: { proProfileId: profile.id } }),
        this.prisma.proFaq.createMany({
          data: unique.map((f, i) => ({
            proProfileId: profile.id,
            question: f.question,
            answer: f.answer,
            displayOrder: i,
          })),
        }),
      ]));
    }

    if (Array.isArray(data.languages)) {
      const unique = Array.from(new Set(data.languages.filter(Boolean)));
      relationOps.push(this.prisma.$transaction([
        this.prisma.proLanguage.deleteMany({ where: { proProfileId: profile.id } }),
        this.prisma.proLanguage.createMany({
          data: unique.map((code) => ({ proProfileId: profile.id, languageCode: code })),
        }),
      ]));
    }

    // 카테고리: 프로가 선택한 타입(사회자/쇼호스트/축가·연주)을 ProCategory 에 저장
    if (typeof data.category === 'string' && data.category.trim()) {
      const categoryName = data.category.trim();
      relationOps.push((async () => {
        // 'pro' 타입의 Category 를 이름으로 찾거나 생성
        let category = await this.prisma.category.findFirst({
          where: { type: 'pro', name: categoryName },
          select: { id: true },
        });
        if (!category) {
          category = await this.prisma.category.create({
            data: { type: 'pro', name: categoryName, isActive: true },
            select: { id: true },
          });
        }
        await this.prisma.$transaction([
          this.prisma.proCategory.deleteMany({ where: { proProfileId: profile.id } }),
          this.prisma.proCategory.create({
            data: { proProfileId: profile.id, categoryId: category.id },
          }),
        ]);
      })());
    }

    // 지역: 이름 일괄 조회(findMany)로 N+1 제거 → 없는 것만 생성 → createMany 로 관계 재작성
    if (Array.isArray(data.regions)) {
      const uniqueRegions = Array.from(new Set(data.regions.filter(Boolean).map((r) => r.trim())));
      const isNationwideRegion = (name: string) => name === '전국' || name === '전국가능' || name.startsWith('전국');
      const isNationwide = uniqueRegions.length === 0 || uniqueRegions.some(isNationwideRegion);
      relationOps.push((async () => {
        const canonicalNames = Array.from(new Set(uniqueRegions.map((n) => (isNationwideRegion(n) ? '전국' : n))));
        const wantsNationwide = uniqueRegions.some(isNationwideRegion);
        const existing = await this.prisma.region.findMany({
          where: wantsNationwide
            ? { OR: [{ name: { in: canonicalNames } }, { isNationwide: true }, { name: { startsWith: '전국' } }] }
            : { name: { in: canonicalNames } },
          select: { id: true, name: true, isNationwide: true },
        });
        const byName = new Map(existing.map((r) => [r.name, r]));
        const nationwideRow = existing.find((r) => r.isNationwide || r.name.startsWith('전국'));
        const regionIds: string[] = [];
        for (const canonical of canonicalNames) {
          const row = canonical === '전국' ? (nationwideRow || byName.get('전국')) : byName.get(canonical);
          if (row) { regionIds.push(row.id); continue; }
          const created = await this.prisma.region.create({
            data: { name: canonical, isNationwide: canonical === '전국' },
            select: { id: true },
          });
          regionIds.push(created.id);
        }
        const uniqueRegionIds = Array.from(new Set(regionIds));
        await this.prisma.$transaction([
          this.prisma.proRegion.deleteMany({ where: { proProfileId: profile.id } }),
          this.prisma.proRegion.createMany({
            data: uniqueRegionIds.map((regionId) => ({ proProfileId: profile.id, regionId })),
          }),
          this.prisma.proProfile.update({
            where: { id: profile.id },
            data: { isNationwide },
          }),
        ]);
      })());
    }

    await Promise.all(relationOps);

    // 프로필 저장 직후 — User.profileImageUrl 을 최신 대표 ProProfileImage 로 강제 동기화
    // (카카오 가입자가 프로로 전환하면 Kakao 기본 프로필 → 프로 대표 사진으로 바뀜)
    const primaryImage = await this.prisma.proProfileImage.findFirst({
      where: { proProfileId: profile.id, isPrimary: true },
      select: { imageUrl: true },
    });
    const fallbackImage = primaryImage
      ? null
      : await this.prisma.proProfileImage.findFirst({
          where: { proProfileId: profile.id },
          orderBy: { displayOrder: 'asc' },
          select: { imageUrl: true },
        });
    const effectiveImage = primaryImage?.imageUrl ?? fallbackImage?.imageUrl;
    let updatedUser = null as null | { id: string; name: string | null; email: string | null; phone: string | null; profileImageUrl: string | null };
    if (effectiveImage) {
      updatedUser = await this.prisma.user.update({
        where: { id: userId },
        data: { profileImageUrl: effectiveImage },
        select: { id: true, name: true, email: true, phone: true, profileImageUrl: true },
      });
    } else {
      updatedUser = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, name: true, email: true, phone: true, profileImageUrl: true },
      });
    }
    if (updatedUser) {
      this.chatRealtime.emitProfileUpdatedForUser(userId, {
        name: updatedUser.name,
        profileImageUrl: updatedUser.profileImageUrl,
      }).catch(() => undefined);
    }

    // 저장 직후 디스커버리 캐시 (리스트 + 상세) 전부 무효화 — 변경사항 즉시 반영
    this.discovery.invalidateCache(profile.id);
    this.discovery.invalidateCache();

    // 프로필 이미지가 변경되었음을 프론트가 즉시 반영할 수 있게 user 포함 리턴
    return { ...profile, user: updatedUser };
  }

  private async savePhotoFromDataUrl(dataUrl: string): Promise<{ path: string; originalPath: string } | null> {
    const match = dataUrl.match(/^data:(image\/(jpeg|jpg|png|webp|heic|heif));base64,(.+)$/i);
    if (!match) {
      // 이미 URL이면 그대로 보존
      if (/^https?:\/\//.test(dataUrl) || dataUrl.startsWith('/')) {
        return { path: dataUrl, originalPath: dataUrl };
      }
      return null;
    }
    const mime = match[1].toLowerCase() === 'image/jpg' ? 'image/jpeg' : match[1].toLowerCase();
    const buffer = Buffer.from(match[3], 'base64');
    const fakeFile: Express.Multer.File = {
      fieldname: 'file',
      originalname: `upload.${match[2]}`,
      encoding: '7bit',
      mimetype: mime,
      size: buffer.length,
      buffer,
      destination: '',
      filename: '',
      path: '',
      stream: null as any,
    };
    const processed = await this.imageService.processImage(fakeFile, {
      requireFace: false,
      maxWidth: 1200,
      maxHeight: 1200,
      quality: 85,
    });
    return { path: processed.webpPath || processed.path, originalPath: processed.path };
  }

  private async getProfileByUserId(userId: string) {
    const profile = await this.prisma.proProfile.findUnique({
      where: { userId },
    });
    if (!profile) {
      // Auto-create draft profile
      return this.prisma.proProfile.create({
        data: { userId },
      });
    }
    return profile;
  }

  private async getProfileIdentityByUserId(userId: string) {
    const cached = this.profileIdentityCache.get(userId);
    if (cached && Date.now() - cached.ts < this.PROFILE_IDENTITY_CACHE_TTL) {
      return { id: cached.id, profileViews: cached.profileViews };
    }
    const profile = await this.prisma.proProfile.findUnique({
      where: { userId },
      select: { id: true, profileViews: true },
    });
    if (profile) {
      this.profileIdentityCache.set(userId, { ...profile, ts: Date.now() });
      return profile;
    }
    const created = await this.prisma.proProfile.create({
      data: { userId },
      select: { id: true, profileViews: true },
    });
    this.profileIdentityCache.set(userId, { ...created, ts: Date.now() });
    return created;
  }

  // ─── Revenue ──────────────────────────────────────────────────────────────

  async getRevenue(userId: string) {
    const profile = await this.getProfileByUserId(userId);
    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const [thisMonthPayments, lastMonthPayments, profileData] = await Promise.all([
      this.prisma.payment.findMany({
        where: {
          proProfileId: profile.id,
          status: 'completed',
          createdAt: { gte: thisMonthStart },
        },
        select: { amount: true },
      }),
      this.prisma.payment.findMany({
        where: {
          proProfileId: profile.id,
          status: 'completed',
          createdAt: { gte: lastMonthStart, lt: thisMonthStart },
        },
        select: { amount: true },
      }),
      this.prisma.proProfile.findUnique({
        where: { id: profile.id },
        select: { profileViews: true, avgRating: true, reviewCount: true },
      }),
    ]);

    const thisMonth = thisMonthPayments.reduce((s, p) => s + (p.amount || 0), 0);
    const lastMonth = lastMonthPayments.reduce((s, p) => s + (p.amount || 0), 0);

    return {
      thisMonth,
      lastMonth,
      profileViews: profileData?.profileViews || 0,
      avgRating: profileData?.avgRating || 0,
      reviewCount: profileData?.reviewCount || 0,
    };
  }

  async incrementProfileView(proProfileId: string) {
    await this.prisma.proProfile.update({
      where: { id: proProfileId },
      data: { profileViews: { increment: 1 } },
      select: { profileViews: true },
    });
    return { ok: true };
  }

  // ─── Settlements ───────────────────────────────────────────────────────────

  /**
   * 월별 정산 집계 — 행사일 기준으로 묶어서 반환
   * - status=completed 이면서 환불되지 않은 결제만 집계
   * - 행사일이 오늘 이전이면 '정산완료', 아직 미래면 '정산예정'
   */
  async getSettlements(userId: string) {
    const profile = await this.getProfileByUserId(userId);
    const payments = await this.prisma.payment.findMany({
      where: {
        proProfileId: profile.id,
        status: 'completed',
      },
      include: {
        quotations: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
      orderBy: { createdAt: 'desc' },
    });

    const now = new Date();
    const bucket = new Map<string, { amount: number; settled: boolean; latestEventDate: Date }>();
    payments.forEach((p) => {
      const q = (p as any).quotations?.[0];
      const eventDate = q?.eventDate ? new Date(q.eventDate) : new Date(p.createdAt);
      const key = `${eventDate.getFullYear()}-${String(eventDate.getMonth() + 1).padStart(2, '0')}`;
      const existing = bucket.get(key) ?? { amount: 0, settled: true, latestEventDate: eventDate };
      existing.amount += Number(p.amount || 0);
      // 이 달 행사가 하나라도 미래면 '정산예정'
      if (eventDate > now) existing.settled = false;
      if (eventDate > existing.latestEventDate) existing.latestEventDate = eventDate;
      bucket.set(key, existing);
    });

    const settlements = Array.from(bucket.entries())
      .map(([key, v]) => {
        const [y, m] = key.split('-');
        // 정산 지급 예정일 = 행사월 + 1개월 10일
        const payDate = new Date(Number(y), Number(m), 10);
        return {
          id: key,
          month: `${y}년 ${Number(m)}월`,
          amount: v.amount,
          status: v.settled ? '정산완료' : '정산예정',
          date: payDate.toISOString().slice(0, 10),
        };
      })
      .sort((a, b) => (a.id < b.id ? 1 : -1));

    return settlements;
  }

  // ─── Analytics ────────────────────────────────────────────────────────────

  async getAnalytics(userId: string) {
    const profile = await this.getProfileIdentityByUserId(userId);
    const now = new Date();
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const twoWeeksAgo = new Date(now);
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

    // 이번주/지난주 문의(채팅방) 수
    const [weeklyInquiries, prevWeekInquiries] = await Promise.all([
      this.prisma.chatRoom.count({
        where: {
          proProfileId: profile.id,
          createdAt: { gte: weekAgo },
        },
      }),
      this.prisma.chatRoom.count({
        where: {
          proProfileId: profile.id,
          createdAt: { gte: twoWeeksAgo, lt: weekAgo },
        },
      }),
    ]);

    // 프로필 조회수는 누적값만 DB에 있음 → 주간 값 근사치로 제공
    const weeklyViews = Math.max(profile.profileViews || 0, 0);
    const conversionRate = weeklyViews > 0
      ? `${((weeklyInquiries / weeklyViews) * 100).toFixed(1)}%`
      : '0%';

    const daily = ['월', '화', '수', '목', '금', '토', '일'].map((day) => ({
      day,
      views: 0,
    }));

    return {
      weeklyViews,
      weeklyInquiries,
      weeklyBookings: 0,
      prevWeekInquiries,
      conversionRate,
      daily,
    };
  }

}

import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
  forwardRef,
  OnModuleInit,
  Logger,
} from '@nestjs/common';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type { Multer } from 'multer';
import { PrismaService } from '../prisma/prisma.service';
import { ImageService, ImageProcessOptions } from '../image/image.service';
import { DiscoveryService } from '../discovery/discovery.service';
import { NotificationService } from '../notification/notification.service';
import { PaymentService } from '../payment/payment.service';
import { PuddingService } from '../pudding/pudding.service';

@Injectable()
export class ProService implements OnModuleInit {
  private readonly logger = new Logger(ProService.name);
  constructor(
    private prisma: PrismaService,
    private imageService: ImageService,
    private discovery: DiscoveryService,
    private notification: NotificationService,
    @Inject(forwardRef(() => PaymentService))
    private paymentService: PaymentService,
    private pudding: PuddingService,
  ) {}

  // 서버 시작 시 기존 프로 유저들의 User.profileImageUrl 이 비어있으면
  // 대표 ProProfileImage 의 URL 로 채워줌 (일회성 마이그레이션).
  async onModuleInit() {
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
    },
  ) {
    const existing = await this.prisma.proProfile.findUnique({ where: { userId } });

    const fields = {
      ...(data.shortIntro !== undefined ? { shortIntro: data.shortIntro } : {}),
      ...(data.mainExperience !== undefined ? { mainExperience: data.mainExperience } : {}),
      ...(data.careerYears !== undefined ? { careerYears: data.careerYears } : {}),
      ...(data.awards !== undefined ? { awards: data.awards } : {}),
      ...(data.detailHtml !== undefined ? { detailHtml: data.detailHtml } : {}),
      ...(data.youtubeUrl !== undefined ? { youtubeUrl: data.youtubeUrl } : {}),
      ...(data.gender !== undefined ? { gender: data.gender } : {}),
      ...(data.isNationwide !== undefined ? { isNationwide: data.isNationwide } : {}),
    };

    if (!existing) {
      return this.prisma.proProfile.create({
        data: { userId, status: 'draft', ...fields },
      });
    }

    return this.prisma.proProfile.update({
      where: { userId },
      data: fields,
    });
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

    // Minimum 4 images for profile completion — checked at submission, not upload
    // requireFace = true for profile images
    const processed = await this.imageService.processImage(file, {
      ...options,
      requireFace: true,
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
    }

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
      }
    }
  }

  async reorderImages(userId: string, imageIds: string[]) {
    const profile = await this.getProfileByUserId(userId);

    await this.prisma.$transaction(
      imageIds.map((id, index) =>
        this.prisma.proProfileImage.updateMany({
          where: { id, proProfileId: profile.id },
          data: {
            displayOrder: index,
            isPrimary: index === 0,
          },
        }),
      ),
    );

    // 재정렬로 새 대표 사진이 바뀐 경우 User.profileImageUrl 동기화
    const firstImageId = imageIds[0];
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
      }
    }

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

    return this.prisma.proProfileImage.update({
      where: { id: imageId },
      data: {
        imageUrl: processed.path,
        hasFace: processed.hasFace,
      },
    });
  }

  // ─── Schedule ────────────────────────────────────────────────────────────

  async getSchedule(userId: string, month: string) {
    const profile = await this.getProfileByUserId(userId);

    const [year, mon] = month.split('-').map(Number);
    const startDate = new Date(year, mon - 1, 1);
    const endDate = new Date(year, mon, 0);

    const schedules = await this.prisma.proSchedule.findMany({
      where: {
        proProfileId: profile.id,
        date: { gte: startDate, lte: endDate },
      },
      include: {
        payment: {
          include: {
            quotations: { orderBy: { createdAt: 'desc' }, take: 1 },
          },
        },
      },
      orderBy: { date: 'asc' },
    });

    // Payment.userId → User 조회 (Payment에 user relation이 없어서 수동 lookup)
    const userIds = Array.from(new Set(schedules.map((s) => (s as any).payment?.userId).filter(Boolean))) as string[];
    const users = userIds.length > 0
      ? await this.prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, name: true, profileImageUrl: true },
        })
      : [];
    const userMap = new Map(users.map((u) => [u.id, u]));

    return schedules.map((s) => {
      let eventTitle: string | null = null;
      let eventLocation: string | null = null;
      if (s.note) {
        try {
          const parsed = JSON.parse(s.note);
          eventTitle = parsed.eventTitle ?? null;
          eventLocation = parsed.eventLocation ?? null;
        } catch {
          eventTitle = s.note;
        }
      }
      const payment = (s as any).payment;
      const q = payment?.quotations?.[0];
      const client = payment?.userId ? userMap.get(payment.userId) : null;
      return {
        id: s.id,
        date: s.date.toISOString().split('T')[0],
        status: s.status,
        eventTitle: eventTitle ?? q?.title ?? null,
        eventLocation: eventLocation ?? q?.eventLocation ?? null,
        eventTime: q?.eventTime ?? null,
        clientName: client?.name ?? null,
        clientImage: client?.profileImageUrl ?? null,
        amount: payment?.amount ? Number(payment.amount) : null,
        paymentStatus: payment?.status ?? null,
        paymentId: payment?.id ?? null,
      };
    });
  }

  async updateScheduleDate(
    userId: string,
    date: string,
    data: { status: 'available' | 'unavailable' | 'booked'; eventTitle?: string; eventLocation?: string },
  ) {
    const profile = await this.getProfileByUserId(userId);
    const dateObj = new Date(date + 'T00:00:00Z');

    const note =
      data.eventTitle || data.eventLocation
        ? JSON.stringify({ eventTitle: data.eventTitle ?? null, eventLocation: data.eventLocation ?? null })
        : null;

    const schedule = await this.prisma.proSchedule.upsert({
      where: {
        proProfileId_date: {
          proProfileId: profile.id,
          date: dateObj,
        },
      },
      update: {
        status: data.status,
        note,
      },
      create: {
        proProfileId: profile.id,
        date: dateObj,
        status: data.status,
        note,
        source: 'manual',
      },
    });

    return schedule;
  }

  async getBookedDates(proProfileId: string) {
    const schedules = await this.prisma.proSchedule.findMany({
      where: {
        proProfileId,
        status: 'booked',
      },
      orderBy: { date: 'asc' },
    });

    return schedules.map((s) => s.date.toISOString().split('T')[0]);
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
    },
  ) {
    // 전화번호만 업데이트 가능. 이름은 User.name (가입 시 설정) 을 그대로 사용 —
    // 프로 등록/수정 과정에서 User.name 을 덮어쓰면 일반 모드로 돌아와도 이름이 바뀌는 버그 발생
    if (data.phone) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { phone: data.phone },
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
    if (Array.isArray(data.photos) && data.photos.length > 0) {
      const mainIdx = Math.max(0, Math.min(data.mainPhotoIndex ?? 0, data.photos.length - 1));
      const savedImages: { path: string; originalPath: string; index: number }[] = [];
      const failures: { index: number; error: string }[] = [];

      for (let i = 0; i < data.photos.length; i++) {
        try {
          const processed = await this.savePhotoFromDataUrl(data.photos[i]);
          if (processed) savedImages.push({ ...processed, index: i });
          else failures.push({ index: i, error: 'invalid data URL' });
        } catch (e: any) {
          failures.push({ index: i, error: e?.message || String(e) });
        }
      }

      // 모든 사진 실패 시 에러로 터뜨려 프론트가 알림 표시
      if (savedImages.length === 0) {
        throw new BadRequestException(
          `사진 업로드 실패 (${failures.length}장): ${failures.map((f) => f.error).join('; ')}`,
        );
      }

      // 성공한 사진만 있을 때 기존 이미지 교체
      await this.prisma.proProfileImage.deleteMany({ where: { proProfileId: profile.id } });
      for (const img of savedImages) {
        await this.prisma.proProfileImage.create({
          data: {
            proProfileId: profile.id,
            imageUrl: img.path,
            originalUrl: img.originalPath,
            displayOrder: img.index,
            isPrimary: img.index === mainIdx,
            hasFace: true,
          },
        });
      }

      // 대표 사진을 User.profileImageUrl 로 동기화 — 프로필 아바타(마이페이지/채팅/견적카드)에 반영됨
      const primary = savedImages.find((img) => img.index === mainIdx) || savedImages[0];
      if (primary) {
        await this.prisma.user.update({
          where: { id: userId },
          data: { profileImageUrl: primary.path },
        });
      }
    }

    // Services / FAQs / Languages 는 각각 하나의 트랜잭션으로 delete+create 처리 (동시 재제출 race condition 방지)
    if (Array.isArray(data.services)) {
      // 중복 타이틀 제거 (같은 title 은 마지막 것만 유지)
      const seen = new Set<string>();
      const unique = [...data.services].reverse().filter((s) => {
        if (!s?.title || seen.has(s.title)) return false;
        seen.add(s.title);
        return true;
      }).reverse();
      await this.prisma.$transaction([
        this.prisma.proService.deleteMany({ where: { proProfileId: profile.id } }),
        ...unique.map((s, i) =>
          this.prisma.proService.create({
            data: {
              proProfileId: profile.id,
              title: s.title,
              description: s.description ?? null,
              basePrice: s.basePrice ?? null,
              displayOrder: i,
              isActive: true,
            },
          }),
        ),
      ]);
    }

    if (Array.isArray(data.faqs)) {
      // 중복 question 제거
      const seen = new Set<string>();
      const unique = data.faqs.filter((f) => {
        if (!f?.question || !f?.answer || seen.has(f.question)) return false;
        seen.add(f.question);
        return true;
      });
      await this.prisma.$transaction([
        this.prisma.proFaq.deleteMany({ where: { proProfileId: profile.id } }),
        ...unique.map((f, i) =>
          this.prisma.proFaq.create({
            data: {
              proProfileId: profile.id,
              question: f.question,
              answer: f.answer,
              displayOrder: i,
            },
          }),
        ),
      ]);
    }

    if (Array.isArray(data.languages)) {
      const unique = Array.from(new Set(data.languages.filter(Boolean)));
      await this.prisma.$transaction([
        this.prisma.proLanguage.deleteMany({ where: { proProfileId: profile.id } }),
        ...unique.map((code) =>
          this.prisma.proLanguage.create({
            data: { proProfileId: profile.id, languageCode: code },
          }),
        ),
      ]);
    }

    // 카테고리: 프로가 선택한 타입(사회자/쇼호스트/축가·연주)을 ProCategory 에 저장
    if (typeof data.category === 'string' && data.category.trim()) {
      const categoryName = data.category.trim();
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
    }

    // 지역: 프로가 선택한 활동 지역 배열을 ProRegion 에 저장
    if (Array.isArray(data.regions)) {
      const uniqueRegions = Array.from(new Set(data.regions.filter(Boolean).map((r) => r.trim())));
      const isNationwide = uniqueRegions.length === 0 || uniqueRegions.includes('전국');
      const regionRecords: { id: string }[] = [];
      for (const name of uniqueRegions) {
        let region = await this.prisma.region.findFirst({
          where: { name },
          select: { id: true },
        });
        if (!region) {
          region = await this.prisma.region.create({
            data: { name, isNationwide: name === '전국' },
            select: { id: true },
          });
        }
        regionRecords.push(region);
      }
      await this.prisma.$transaction([
        this.prisma.proRegion.deleteMany({ where: { proProfileId: profile.id } }),
        ...regionRecords.map((r) =>
          this.prisma.proRegion.create({
            data: { proProfileId: profile.id, regionId: r.id },
          }),
        ),
        this.prisma.proProfile.update({
          where: { id: profile.id },
          data: { isNationwide },
        }),
      ]);
    }

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
      if (/^https?:\/\//.test(dataUrl) || dataUrl.startsWith('/uploads/')) {
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
    const before = await this.prisma.proProfile.findUnique({
      where: { id: proProfileId },
      select: { profileViews: true },
    });
    const beforeCount = before?.profileViews || 0;
    const updated = await this.prisma.proProfile.update({
      where: { id: proProfileId },
      data: { profileViews: { increment: 1 } },
      select: { profileViews: true },
    });
    // 100회 경계 넘을 때마다 푸딩 +100 지급 (fire-and-forget)
    this.pudding.awardProfileViewsIfCrossed100(proProfileId, beforeCount, updated.profileViews)
      .catch(() => {});
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
    const profile = await this.getProfileByUserId(userId);
    const now = new Date();
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const twoWeeksAgo = new Date(now);
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

    // 이번주/지난주 문의(채팅방) 수
    const [weeklyInquiries, prevWeekInquiries, weeklyBookings] = await Promise.all([
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
      this.prisma.proSchedule.count({
        where: {
          proProfileId: profile.id,
          status: { in: ['booked', 'completed'] },
          date: { gte: weekAgo },
        },
      }),
    ]);

    // 프로필 조회수는 누적값만 DB에 있음 → 주간 값 근사치로 제공
    const weeklyViews = Math.max(profile.profileViews || 0, 0);
    const conversionRate = weeklyViews > 0
      ? `${((weeklyInquiries / weeklyViews) * 100).toFixed(1)}%`
      : '0%';

    // 요일별 예약(booked/completed) 수 집계 — 지난 7일
    const schedules = await this.prisma.proSchedule.findMany({
      where: {
        proProfileId: profile.id,
        status: { in: ['booked', 'completed'] },
        date: { gte: weekAgo },
      },
      select: { date: true },
    });
    const daysKo = ['일', '월', '화', '수', '목', '금', '토'];
    const dailyMap = new Map<string, number>(daysKo.map((d) => [d, 0]));
    schedules.forEach((s) => {
      const label = daysKo[new Date(s.date).getDay()];
      dailyMap.set(label, (dailyMap.get(label) || 0) + 1);
    });
    const daily = ['월', '화', '수', '목', '금', '토', '일'].map((day) => ({
      day,
      views: dailyMap.get(day) || 0,
    }));

    return {
      weeklyViews,
      weeklyInquiries,
      weeklyBookings,
      prevWeekInquiries,
      conversionRate,
      daily,
    };
  }

  // ─── Schedule Requests (고객이 구매해서 들어온 대기 요청) ────────────────

  async getScheduleRequests(userId: string) {
    const profile = await this.getProfileByUserId(userId);
    const rows = await this.prisma.proSchedule.findMany({
      where: { proProfileId: profile.id, status: 'pending' },
      include: {
        payment: {
          include: {
            quotations: { orderBy: { createdAt: 'desc' }, take: 1 },
          },
        },
      },
      orderBy: { date: 'asc' },
    });
    const userIds = rows.map((r) => r.payment?.userId).filter(Boolean) as string[];
    const users = userIds.length > 0
      ? await this.prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, name: true, profileImageUrl: true },
        })
      : [];
    const userMap = new Map(users.map((u) => [u.id, u]));
    return rows.map((r) => {
      const user = r.payment ? userMap.get(r.payment.userId) : null;
      const quotation = r.payment?.quotations?.[0];
      return {
        id: r.id,
        date: r.date,
        status: r.status,
        amount: r.payment?.amount || 0,
        paymentId: r.paymentId,
        clientId: r.payment?.userId,
        clientName: user?.name || '고객',
        clientImage: user?.profileImageUrl || null,
        title: quotation?.title || '스케줄 요청',
        eventLocation: quotation?.eventLocation || null,
        eventTime: quotation?.eventTime || null,
      };
    });
  }

  async acceptScheduleRequest(userId: string, scheduleId: string) {
    const profile = await this.getProfileByUserId(userId);
    const schedule = await this.prisma.proSchedule.findUnique({
      where: { id: scheduleId },
      include: { payment: true },
    });
    if (!schedule || schedule.proProfileId !== profile.id) {
      throw new NotFoundException('스케줄 요청을 찾을 수 없습니다.');
    }
    if (schedule.status !== 'pending') {
      throw new BadRequestException('이미 처리된 요청입니다.');
    }
    const updated = await this.prisma.proSchedule.update({
      where: { id: scheduleId },
      data: { status: 'booked', note: null },
    });

    // 채팅방 존재 보장 + 수락 시스템 메시지 전송
    if (schedule.payment) {
      const room = await this.prisma.chatRoom.findFirst({
        where: {
          userId: schedule.payment.userId,
          proProfileId: profile.id,
          userDeletedAt: null,
        },
      });
      if (room) {
        await this.prisma.message.create({
          data: {
            roomId: room.id,
            senderId: userId,
            type: 'system',
            content: '✅ 스케줄 요청을 수락했습니다. 예약이 확정되었습니다.',
          },
        });
        await this.prisma.chatRoom.update({
          where: { id: room.id },
          data: { lastMessageAt: new Date() },
        });
      }

      // 알림 → 고객에게
      this.notification.createNotification(
        schedule.payment.userId,
        'booking' as any,
        '예약이 확정되었습니다! 🎉',
        `${schedule.payment.amount.toLocaleString()}원 스케줄 요청이 수락되어 예약이 확정되었습니다.`,
        { scheduleId, paymentId: schedule.paymentId },
      ).catch(() => {});
    }

    return updated;
  }

  async rejectScheduleRequest(userId: string, scheduleId: string, reason?: string) {
    const profile = await this.getProfileByUserId(userId);
    const schedule = await this.prisma.proSchedule.findUnique({
      where: { id: scheduleId },
      include: { payment: true },
    });
    if (!schedule || schedule.proProfileId !== profile.id) {
      throw new NotFoundException('스케줄 요청을 찾을 수 없습니다.');
    }
    if (schedule.status !== 'pending') {
      throw new BadRequestException('이미 처리된 요청입니다.');
    }
    if (!reason || !reason.trim()) {
      throw new BadRequestException('거절 사유를 입력해주세요. 사유는 고객에게 그대로 전달됩니다.');
    }
    const updated = await this.prisma.proSchedule.update({
      where: { id: scheduleId },
      data: {
        status: 'unavailable',
        note: reason,
      },
    });

    // 결제가 존재하면 자동 전액 환불
    let refundedAmount = 0;
    if (schedule.payment && schedule.payment.status === 'completed') {
      try {
        const refunded = await this.paymentService.refundAsSystem(
          schedule.payment.id,
          `사회자 거절: ${reason}`,
        );
        refundedAmount = Number((refunded as any)?.refundAmount || schedule.payment.amount || 0);
      } catch (e) {
        // 환불 실패해도 거절 처리는 진행 — 운영팀이 수동 환불
      }
    }

    // 채팅방에 거절 시스템 메시지 + 알림
    if (schedule.payment) {
      const room = await this.prisma.chatRoom.findFirst({
        where: {
          userId: schedule.payment.userId,
          proProfileId: profile.id,
          userDeletedAt: null,
        },
      });
      if (room) {
        await this.prisma.message.create({
          data: {
            roomId: room.id,
            senderId: userId,
            type: 'system',
            content: `❌ 행사 예약이 거절되었습니다.\n사유: ${reason}${refundedAmount > 0 ? `\n\n${refundedAmount.toLocaleString()}원 전액 환불 처리됐습니다.` : ''}`,
          },
        });
        await this.prisma.chatRoom.update({
          where: { id: room.id },
          data: { lastMessageAt: new Date() },
        });
      }

      this.notification.createNotification(
        schedule.payment.userId,
        'booking' as any,
        '행사 예약이 거절되었습니다',
        `${reason}${refundedAmount > 0 ? `\n${refundedAmount.toLocaleString()}원 환불 처리 완료` : ''}`,
        { scheduleId, paymentId: schedule.paymentId },
      ).catch(() => {});
    }

    return updated;
  }
}

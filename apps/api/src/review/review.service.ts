import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';
import { ImageService } from '../image/image.service';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class ReviewService {
  constructor(
    private prisma: PrismaService,
    private notificationService: NotificationService,
    private imageService: ImageService,
  ) {}

  /** 리뷰 작성 */
  async createReview(
    reviewerId: string,
    data: {
      paymentId?: string | null;
      proProfileId: string;
      ratingSatisfaction: number;
      ratingComposition: number;
      ratingExperience: number;
      ratingAppearance: number;
      ratingVoice: number;
      ratingWit: number;
      comment?: string;
      photos?: string[];
      isAnonymous?: boolean;
    },
  ) {
    const proProfile = await this.prisma.proProfile.findUnique({
      where: { id: data.proProfileId },
    });
    if (!proProfile) {
      throw new NotFoundException('전문가 프로필을 찾을 수 없습니다.');
    }

    const paymentId = data.paymentId?.trim() || null;
    let payment: any = null;

    if (paymentId) {
      payment = await this.prisma.payment.findUnique({
        where: { id: paymentId },
      });
      if (!payment) {
        throw new NotFoundException('결제 정보를 찾을 수 없습니다.');
      }
      // 본인 결제만, 완료 상태, 대상 프로와 일치해야 함
      if (payment.userId !== reviewerId) {
        throw new BadRequestException('본인 결제 건에 대해서만 리뷰 작성이 가능합니다.');
      }
      if (payment.status !== 'completed') {
        throw new BadRequestException('완료된 결제 건에 대해서만 리뷰 작성이 가능합니다.');
      }
      if (payment.proProfileId !== data.proProfileId) {
        throw new BadRequestException('이 결제는 해당 사회자와의 거래가 아닙니다.');
      }

      const existingReview = await this.prisma.review.findUnique({
        where: { paymentId },
      });
      if (existingReview) {
        throw new BadRequestException('이미 리뷰가 작성된 결제입니다.');
      }
    } else {
      if (proProfile.userId !== reviewerId) {
        throw new BadRequestException('결제 완료 건이 없으면 본인 프로필에만 리뷰를 작성할 수 있습니다.');
      }
      const selfReviewCount = await this.prisma.review.count({
        where: {
          reviewerId,
          proProfileId: data.proProfileId,
          paymentId: null,
          adminCreated: false,
        },
      });
      if (selfReviewCount >= 3) {
        throw new BadRequestException('본인 리뷰는 최대 3개까지 작성할 수 있습니다.');
      }
    }

    const avgRating =
      (data.ratingSatisfaction +
        data.ratingComposition +
        data.ratingExperience +
        data.ratingAppearance +
        data.ratingVoice +
        data.ratingWit) /
      6;
    const reviewImages = await this.prepareReviewImages(data.photos);

    const review = await this.prisma.review.create({
      data: {
        ...(paymentId ? { paymentId } : {}),
        reviewerId,
        proProfileId: data.proProfileId,
        ratingSatisfaction: data.ratingSatisfaction,
        ratingComposition: data.ratingComposition,
        ratingExperience: data.ratingExperience,
        ratingAppearance: data.ratingAppearance,
        ratingVoice: data.ratingVoice,
        ratingWit: data.ratingWit,
        avgRating: new Decimal(avgRating.toFixed(2)),
        comment: data.comment,
        isAnonymous: paymentId ? (data.isAnonymous ?? false) : false,
        images: reviewImages.length > 0 ? {
          create: reviewImages.map((img, index) => ({
            imageUrl: img.path,
            originalUrl: img.originalPath,
            displayOrder: index,
          })),
        } : undefined,
      },
      include: {
        images: { orderBy: { displayOrder: 'asc' } },
        reviewer: {
          select: { id: true, name: true, profileImageUrl: true },
        },
      },
    });

    await this.recalculateProReviewStats(data.proProfileId);

    // 리뷰 등록 알림 → 전문가에게
    if (proProfile.userId !== reviewerId) {
      const reviewerName = review.isAnonymous ? '익명' : (review.reviewer.name || '고객');
      this.notificationService.createNotification(
        proProfile.userId,
        'system' as any,
        '새 리뷰가 등록되었습니다 ⭐',
        `${reviewerName}님이 평점 ${avgRating.toFixed(1)}점으로 리뷰를 작성했습니다.`,
        { reviewId: review.id, proProfileId: data.proProfileId },
      ).catch(() => {});
    }

    return review;
  }

  private async prepareReviewImages(photos?: string[]) {
    if (!Array.isArray(photos) || photos.length === 0) return [];
    const candidates = photos.filter((photo) => typeof photo === 'string' && photo.trim()).slice(0, 5);
    const savedImages: { path: string; originalPath: string }[] = [];
    const failures: string[] = [];

    for (const [index, photo] of candidates.entries()) {
      try {
        const saved = await this.saveReviewPhoto(photo, index);
        if (saved) savedImages.push(saved);
      } catch (e: any) {
        failures.push(e?.message || String(e));
      }
    }

    if (candidates.length > 0 && savedImages.length === 0) {
      throw new BadRequestException(`리뷰 사진 업로드에 실패했습니다. ${failures.join('; ')}`);
    }

    return savedImages;
  }

  private async saveReviewPhoto(dataUrl: string, index: number) {
    if (/^https?:\/\//.test(dataUrl) || dataUrl.startsWith('/uploads/')) {
      return { path: dataUrl, originalPath: dataUrl };
    }

    const match = dataUrl.match(/^data:(image\/(jpeg|jpg|png|webp|heic|heif));base64,(.+)$/i);
    if (!match) return null;

    const mime = match[1].toLowerCase() === 'image/jpg' ? 'image/jpeg' : match[1].toLowerCase();
    const buffer = Buffer.from(match[3], 'base64');
    const fakeFile: Express.Multer.File = {
      fieldname: 'file',
      originalname: `review-${index + 1}.${match[2]}`,
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
      quality: 82,
    });
    return { path: processed.webpPath || processed.path, originalPath: processed.path };
  }

  private async recalculateProReviewStats(proProfileId: string) {
    const allReviews = await this.prisma.review.findMany({
      where: { proProfileId, isVisible: true },
      select: { avgRating: true },
    });

    const proAvgRating = allReviews.length > 0
      ? allReviews.reduce((sum, r) => sum + Number(r.avgRating), 0) / allReviews.length
      : 0;

    await this.prisma.proProfile.update({
      where: { id: proProfileId },
      data: {
        avgRating: new Decimal(proAvgRating.toFixed(2)),
        reviewCount: allReviews.length,
      },
    });
  }

  /** 전문가의 리뷰 목록 (공개) */
  async getReviewsByPro(proProfileId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const proProfile = await this.prisma.proProfile.findFirst({
      where: {
        OR: [
          { id: proProfileId },
          { userId: proProfileId },
        ],
      },
      select: { id: true },
    });
    const targetProfileIds = Array.from(new Set([proProfileId, proProfile?.id].filter(Boolean) as string[]));
    const where: any = {
      proProfileId: targetProfileIds.length > 1 ? { in: targetProfileIds } : targetProfileIds[0],
      isVisible: true,
    };

    const [reviews, total] = await Promise.all([
      this.prisma.review.findMany({
        where,
        include: {
          images: { orderBy: { displayOrder: 'asc' } },
          reviewer: {
            select: { id: true, name: true, profileImageUrl: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.review.count({
        where,
      }),
    ]);

    const masked = reviews.map((r) => ({
      ...r,
      reviewer: r.isAnonymous
        ? { id: r.reviewer.id, name: '익명', profileImageUrl: null }
        : r.reviewer,
    }));

    return {
      data: masked,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /** 전문가가 리뷰에 답글 작성 */
  async replyToReview(proProfileId: string, reviewId: string, reply: string) {
    const review = await this.prisma.review.findUnique({
      where: { id: reviewId },
      include: {
        proProfile: {
          include: { user: { select: { id: true, name: true } } },
        },
      },
    });

    if (!review) {
      throw new NotFoundException('리뷰를 찾을 수 없습니다.');
    }

    if (review.proProfileId !== proProfileId) {
      throw new ForbiddenException('본인의 리뷰에만 답글을 작성할 수 있습니다.');
    }

    const updated = await this.prisma.review.update({
      where: { id: reviewId },
      data: {
        proReply: reply,
        proRepliedAt: new Date(),
      },
    });

    // 답글 알림 → 리뷰 작성자에게
    const proName = review.proProfile?.user?.name || '사회자';
    this.notificationService.createNotification(
      review.reviewerId,
      'system' as any,
      '전문가 답글이 달렸습니다',
      `${proName} 사회자가 회원님의 리뷰에 답글을 달았습니다.`,
      { reviewId, proProfileId },
    ).catch(() => {});

    return updated;
  }

  /** 내가 작성한 리뷰 목록 */
  async getMyReviews(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    // 사용자가 pro 이면 "받은 리뷰" 를 반환, 아니면 "작성한 리뷰" 반환
    const proProfile = await this.prisma.proProfile.findUnique({
      where: { userId },
      select: { id: true, avgRating: true, reviewCount: true },
    });

    if (proProfile) {
      const [reviews, total] = await Promise.all([
        this.prisma.review.findMany({
          where: { proProfileId: proProfile.id },
          include: {
            images: { orderBy: { displayOrder: 'asc' } },
            reviewer: { select: { id: true, name: true, profileImageUrl: true } },
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
        }),
        this.prisma.review.count({ where: { proProfileId: proProfile.id } }),
      ]);
      return {
        data: reviews,
        total,
        avgRating: Number(proProfile.avgRating),
        meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
      };
    }

    const [reviews, total] = await Promise.all([
      this.prisma.review.findMany({
        where: { reviewerId: userId },
        include: {
          images: { orderBy: { displayOrder: 'asc' } },
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
      this.prisma.review.count({ where: { reviewerId: userId } }),
    ]);

    return {
      data: reviews,
      total,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }
}

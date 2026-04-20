import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class ReviewService {
  constructor(
    private prisma: PrismaService,
    private notificationService: NotificationService,
  ) {}

  /** 리뷰 작성 */
  async createReview(
    reviewerId: string,
    data: {
      paymentId: string;
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
    const payment = await this.prisma.payment.findUnique({
      where: { id: data.paymentId },
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
      where: { paymentId: data.paymentId },
    });
    if (existingReview) {
      throw new BadRequestException('이미 리뷰가 작성된 결제입니다.');
    }

    const proProfile = await this.prisma.proProfile.findUnique({
      where: { id: data.proProfileId },
    });
    if (!proProfile) {
      throw new NotFoundException('전문가 프로필을 찾을 수 없습니다.');
    }

    const avgRating =
      (data.ratingSatisfaction +
        data.ratingComposition +
        data.ratingExperience +
        data.ratingAppearance +
        data.ratingVoice +
        data.ratingWit) /
      6;

    const review = await this.prisma.review.create({
      data: {
        paymentId: data.paymentId,
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
        isAnonymous: data.isAnonymous ?? false,
      },
      include: {
        reviewer: {
          select: { id: true, name: true, profileImageUrl: true },
        },
      },
    });

    const allReviews = await this.prisma.review.findMany({
      where: { proProfileId: data.proProfileId, isVisible: true },
      select: { avgRating: true },
    });

    const proAvgRating =
      allReviews.reduce((sum, r) => sum + Number(r.avgRating), 0) /
      allReviews.length;

    await this.prisma.proProfile.update({
      where: { id: data.proProfileId },
      data: {
        avgRating: new Decimal(proAvgRating.toFixed(2)),
        reviewCount: allReviews.length,
      },
    });

    // 리뷰 등록 알림 → 전문가에게
    const reviewerName = data.isAnonymous ? '익명' : (review.reviewer.name || '고객');
    this.notificationService.createNotification(
      proProfile.userId,
      'system' as any,
      '새 리뷰가 등록되었습니다 ⭐',
      `${reviewerName}님이 평점 ${avgRating.toFixed(1)}점으로 리뷰를 작성했습니다.`,
      { reviewId: review.id, proProfileId: data.proProfileId },
    ).catch(() => {});

    return review;
  }

  /** 전문가의 리뷰 목록 (공개) */
  async getReviewsByPro(proProfileId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [reviews, total] = await Promise.all([
      this.prisma.review.findMany({
        where: { proProfileId, isVisible: true },
        include: {
          reviewer: {
            select: { id: true, name: true, profileImageUrl: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.review.count({
        where: { proProfileId, isVisible: true },
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

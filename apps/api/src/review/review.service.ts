import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class ReviewService {
  constructor(private prisma: PrismaService) {}

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
    // 결제 존재 여부 확인
    const payment = await this.prisma.payment.findUnique({
      where: { id: data.paymentId },
    });
    if (!payment) {
      throw new NotFoundException('결제 정보를 찾을 수 없습니다.');
    }

    // 이미 리뷰가 작성된 결제인지 확인
    const existingReview = await this.prisma.review.findUnique({
      where: { paymentId: data.paymentId },
    });
    if (existingReview) {
      throw new BadRequestException('이미 리뷰가 작성된 결제입니다.');
    }

    // 전문가 프로필 존재 여부 확인
    const proProfile = await this.prisma.proProfile.findUnique({
      where: { id: data.proProfileId },
    });
    if (!proProfile) {
      throw new NotFoundException('전문가 프로필을 찾을 수 없습니다.');
    }

    // 평균 평점 계산
    const avgRating =
      (data.ratingSatisfaction +
        data.ratingComposition +
        data.ratingExperience +
        data.ratingAppearance +
        data.ratingVoice +
        data.ratingWit) /
      6;

    // 리뷰 생성
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

    // 전문가 프로필의 avgRating, reviewCount 업데이트
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

    // 익명 리뷰의 경우 리뷰어 정보 마스킹
    const masked = reviews.map((r) => ({
      ...r,
      reviewer: r.isAnonymous
        ? { id: r.reviewer.id, name: '익명', profileImageUrl: null }
        : r.reviewer,
    }));

    const hasMore = skip + reviews.length < total;

    return {
      data: masked,
      total,
      hasMore,
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
    });

    if (!review) {
      throw new NotFoundException('리뷰를 찾을 수 없습니다.');
    }

    if (review.proProfileId !== proProfileId) {
      throw new ForbiddenException('본인의 리뷰에만 답글을 작성할 수 있습니다.');
    }

    return this.prisma.review.update({
      where: { id: reviewId },
      data: {
        proReply: reply,
        proRepliedAt: new Date(),
      },
    });
  }

  /** 내가 작성한 리뷰 목록 */
  async getMyReviews(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

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
      this.prisma.review.count({
        where: { reviewerId: userId },
      }),
    ]);

    return {
      data: reviews,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}

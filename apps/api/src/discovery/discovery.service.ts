import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DiscoveryService {
  constructor(private prisma: PrismaService) {}

  /** 오늘의 추천 전문가 — 날짜 기반 매일 로테이션 */
  async getDailyRecommendation() {
    const pros = await this.prisma.proProfile.findMany({
      where: { status: 'approved' },
      include: {
        user: { select: { id: true, name: true, profileImageUrl: true } },
        images: { where: { isPrimary: true }, take: 1 },
        services: { where: { isActive: true }, take: 1 },
      },
      orderBy: { avgRating: 'desc' },
    });

    if (pros.length === 0) return null;

    const dayIndex = Math.floor(Date.now() / 86400000) % pros.length;
    const selected = pros[dayIndex];

    return {
      id: selected.id,
      userId: selected.userId,
      name: selected.user.name,
      image: selected.images[0]?.imageUrl || selected.user.profileImageUrl,
      shortIntro: selected.shortIntro,
      avgRating: Number(selected.avgRating),
      reviewCount: selected.reviewCount,
      careerYears: selected.careerYears,
      basePrice: selected.services[0]?.basePrice,
    };
  }

  /** 전문가 목록 (홈, 검색, 카테고리) */
  async getProList(params: {
    page?: number;
    limit?: number;
    search?: string;
    sort?: 'rating' | 'reviews' | 'price' | 'experience' | 'pudding';
    gender?: string;
    minPrice?: number;
    maxPrice?: number;
    featured?: boolean;
  }) {
    const page = Number(params.page) || 1;
    const limit = Number(params.limit) || 20;
    const { search, sort = 'rating', gender, minPrice, maxPrice, featured } = params;

    const where: any = { status: 'approved' };
    if (search) {
      where.OR = [
        { user: { name: { contains: search, mode: 'insensitive' } } },
        { shortIntro: { contains: search, mode: 'insensitive' } },
        { mainExperience: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (gender) where.gender = gender;
    if (featured) where.isFeatured = true;
    if (minPrice || maxPrice) {
      where.services = {
        some: {
          isActive: true,
          ...(minPrice ? { basePrice: { gte: minPrice } } : {}),
          ...(maxPrice ? { basePrice: { lte: maxPrice } } : {}),
        },
      };
    }

    const orderBy: any =
      sort === 'reviews' ? { reviewCount: 'desc' as const }
      : sort === 'experience' ? { careerYears: 'desc' as const }
      : sort === 'pudding' ? { puddingCount: 'desc' as const }
      : { avgRating: 'desc' as const };

    const [data, total] = await Promise.all([
      this.prisma.proProfile.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, profileImageUrl: true } },
          images: { orderBy: { displayOrder: 'asc' }, take: 4 },
          services: { where: { isActive: true }, orderBy: { displayOrder: 'asc' }, take: 1 },
        },
        orderBy,
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
        profileImageUrl: p.user.profileImageUrl,
        images: p.images.map((i) => i.imageUrl),
        shortIntro: p.shortIntro,
        mainExperience: p.mainExperience,
        avgRating: Number(p.avgRating),
        reviewCount: p.reviewCount,
        careerYears: p.careerYears,
        basePrice: p.services[0]?.basePrice,
        isFeatured: p.isFeatured,
        puddingCount: p.puddingCount,
        gender: p.gender,
        youtubeUrl: p.youtubeUrl,
      })),
      total,
      page,
      limit,
      hasMore: page * limit < total,
    };
  }

  /** 전문가 상세 */
  async getProDetail(proProfileId: string) {
    const pro = await this.prisma.proProfile.findUnique({
      where: { id: proProfileId },
      include: {
        user: { select: { id: true, name: true, profileImageUrl: true, email: true } },
        images: { orderBy: { displayOrder: 'asc' } },
        services: { where: { isActive: true }, orderBy: { displayOrder: 'asc' } },
        faqs: { orderBy: { displayOrder: 'asc' } },
        reviews: {
          include: { reviewer: { select: { id: true, name: true, profileImageUrl: true } } },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!pro) return null;

    // Increment views
    await this.prisma.proProfile.update({
      where: { id: proProfileId },
      data: { profileViews: { increment: 1 } },
    });

    return {
      ...pro,
      avgRating: Number(pro.avgRating),
    };
  }
}

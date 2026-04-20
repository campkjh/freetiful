import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DiscoveryService implements OnModuleInit {
  private readonly logger = new Logger(DiscoveryService.name);
  constructor(private prisma: PrismaService) {}

  async onModuleInit() {
    // 서버 시작 시 캐시 워밍업
    try {
      await this.getProList({ limit: 50, sort: 'rating' });
      this.logger.log('Pro list cache warmed up');
    } catch (e) {
      this.logger.warn('Cache warmup failed', e);
    }
  }

  private cache = new Map<string, { data: any; expires: number }>();
  private CACHE_TTL = 60_000; // 1분 (실시간 카운트 반영 위해 짧게)

  private getCached<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry || entry.expires < Date.now()) return null;
    return entry.data as T;
  }

  private setCached(key: string, data: any) {
    this.cache.set(key, { data, expires: Date.now() + this.CACHE_TTL });
    if (this.cache.size > 200) {
      const oldest = this.cache.keys().next().value;
      if (oldest !== undefined) this.cache.delete(oldest);
    }
  }

  /** 프로 상세/리스트 캐시 무효화 */
  invalidateCache(proProfileId?: string) {
    if (proProfileId) {
      this.cache.delete(`proDetail:${proProfileId}`);
    }
    // 리스트 캐시는 모두 삭제
    const keys = Array.from(this.cache.keys());
    keys.forEach((k) => {
      if (k.startsWith('{"fn":"getProList"')) this.cache.delete(k);
    });
  }

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

    const cacheKey = JSON.stringify({ fn: 'getProList', page, limit, search, sort, gender, minPrice, maxPrice, featured });
    const cached = this.getCached<any>(cacheKey);
    if (cached) return cached;

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

    const result = {
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
    this.setCached(cacheKey, result);
    return result;
  }

  /** 전문가 상세 */
  async getProDetail(proProfileId: string) {
    const detailCacheKey = `proDetail:${proProfileId}`;
    const detailCached = this.getCached<any>(detailCacheKey);
    if (detailCached) return detailCached;
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

    // 찜 갯수 동적 계산
    const favoriteCount = await this.prisma.favorite.count({
      where: { targetType: 'pro', targetId: proProfileId },
    });

    this.prisma.proProfile.update({
      where: { id: proProfileId },
      data: { profileViews: { increment: 1 } },
    }).catch(() => {});

    const detailResult = {
      ...pro,
      avgRating: Number(pro.avgRating),
      favoriteCount,
    };
    this.setCached(detailCacheKey, detailResult);
    return detailResult;
  }
}

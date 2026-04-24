import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DiscoveryService implements OnModuleInit {
  private readonly logger = new Logger(DiscoveryService.name);
  constructor(private prisma: PrismaService) {}

  async onModuleInit() {
    // 서버 시작 시 캐시 워밍업
    try {
      await Promise.all([
        this.getProList({ limit: 50, sort: 'pudding', withTotal: false }),
        this.getProList({ limit: 12, sort: 'rating', withTotal: false }),
      ]);
      this.logger.log('Pro list cache warmed up');
    } catch (e) {
      this.logger.warn('Cache warmup failed', e);
    }
  }

  private cache = new Map<string, { data: any; expires: number }>();
  private CACHE_TTL = 5 * 60_000; // 공개 탐색 데이터는 짧은 실시간성보다 빠른 재진입이 중요

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
      where: {
        status: 'approved',
        user: { isActive: true },
      },
      select: {
        id: true,
        userId: true,
        shortIntro: true,
        avgRating: true,
        reviewCount: true,
        careerYears: true,
        user: { select: { id: true, name: true, profileImageUrl: true } },
        images: { where: { isPrimary: true }, take: 1, select: { imageUrl: true } },
        services: { where: { isActive: true }, take: 1, select: { basePrice: true } },
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
    region?: string;
    withTotal?: boolean;
  }) {
    const page = Number(params.page) || 1;
    const limit = Math.min(Number(params.limit) || 20, 100);
    const { search, sort = 'rating', gender, minPrice, maxPrice, featured, region } = params;
    const withTotal = params.withTotal !== false;

    const cacheKey = JSON.stringify({ fn: 'getProList', page, limit, search, sort, gender, minPrice, maxPrice, featured, region, withTotal });
    const cached = this.getCached<any>(cacheKey);
    if (cached) return cached;

    // 공개 목록 조건:
    // 1) 프로필 status = approved
    // 2) User.isActive (archived 제외)
    // 사진 체크는 제거 — 기존 프로들의 ProProfileImage 저장이 누락돼 있을 수 있어
    // 필터로 한꺼번에 숨기면 박테스터/김사회자 처럼 데이터 가진 프로도 사라짐.
    // 대신 프론트에서 이미지 없으면 default-profile 폴백으로 표시.
    const where: any = {
      status: 'approved',
      user: { isActive: true },
    };
    if (search) {
      where.OR = [
        { user: { name: { contains: search, mode: 'insensitive' } } },
        { shortIntro: { contains: search, mode: 'insensitive' } },
        { mainExperience: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (gender) where.gender = gender;
    if (featured) where.isFeatured = true;
    if (region && region !== '전국') {
      const aliases =
        region === '서울/경기' ? ['서울/경기', '서울', '경기', '인천', '수도권']
        : region === '충청' ? ['충청', '충북', '충남', '대전', '세종']
        : region === '경상' ? ['경상', '경북', '경남', '부산', '대구', '울산']
        : region === '전라' ? ['전라', '전북', '전남', '광주']
        : [region];
      where.AND = [
        ...(where.AND || []),
        {
          OR: [
            { isNationwide: true },
            { regions: { some: { region: { OR: [{ name: { in: aliases } }, { isNationwide: true }] } } } },
          ],
        },
      ];
    }
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

    const [data, totalCount] = await Promise.all([
      this.prisma.proProfile.findMany({
        where,
        select: {
          id: true,
          userId: true,
          shortIntro: true,
          mainExperience: true,
          avgRating: true,
          reviewCount: true,
          careerYears: true,
          isFeatured: true,
          showPartnersLogo: true,
          puddingCount: true,
          gender: true,
          youtubeUrl: true,
          isNationwide: true,
          tags: true,
          user: { select: { id: true, name: true, profileImageUrl: true } },
          // isPrimary=true 가 있으면 그것을, 없으면 displayOrder=0 을 [0] 번째로 배치
          images: {
            orderBy: [{ isPrimary: 'desc' }, { displayOrder: 'asc' }],
            take: 4,
            select: { imageUrl: true },
          },
          services: {
            where: { isActive: true },
            orderBy: { displayOrder: 'asc' },
            take: 1,
            select: { basePrice: true },
          },
          categories: { select: { category: { select: { name: true } } } },
          regions: { select: { region: { select: { name: true, isNationwide: true } } } },
          languages: { select: { languageCode: true } },
        },
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
      withTotal ? this.prisma.proProfile.count({ where }) : Promise.resolve(0),
    ]);
    const total = withTotal ? totalCount : data.length;

    const result = {
      data: data.map((p) => ({
        id: p.id,
        userId: p.userId,
        name: p.user.name,
        // 전문가가 파트너 신청 시 올린 대표사진(primary) 우선, 없으면 User.profileImageUrl(카카오 기본) 폴백
        profileImageUrl: p.images[0]?.imageUrl || p.user.profileImageUrl,
        images: p.images.map((i) => i.imageUrl),
        shortIntro: p.shortIntro,
        mainExperience: p.mainExperience,
        avgRating: Number(p.avgRating),
        reviewCount: p.reviewCount,
        careerYears: p.careerYears,
        basePrice: p.services[0]?.basePrice,
        isFeatured: p.isFeatured,
        showPartnersLogo: p.showPartnersLogo,
        puddingCount: p.puddingCount,
        gender: p.gender,
        youtubeUrl: p.youtubeUrl,
        isNationwide: p.isNationwide,
        categories: p.categories.map((c) => c.category.name),
        regions: p.regions.map((r) => r.region.name),
        languages: p.languages.map((l) => l.languageCode),
        tags: p.tags || [],
      })),
      total,
      page,
      limit,
      hasMore: withTotal ? page * limit < total : data.length === limit,
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
      select: {
        id: true,
        userId: true,
        gender: true,
        careerYears: true,
        shortIntro: true,
        mainExperience: true,
        detailHtml: true,
        youtubeUrl: true,
        isFeatured: true,
        showPartnersLogo: true,
        avgRating: true,
        reviewCount: true,
        responseRate: true,
        tags: true,
        isNationwide: true,
        profileViews: true,
        user: { select: { id: true, name: true, profileImageUrl: true, email: true } },
        // 대표(primary) 이미지가 images[0] 에 오도록 정렬
        images: {
          orderBy: [{ isPrimary: 'desc' }, { displayOrder: 'asc' }],
          take: 12,
          select: { id: true, imageUrl: true, displayOrder: true, isPrimary: true },
        },
        services: {
          where: { isActive: true },
          orderBy: { displayOrder: 'asc' },
          select: { id: true, title: true, description: true, basePrice: true, priceUnit: true, displayOrder: true, isActive: true },
        },
        categories: { select: { category: { select: { name: true } } } },
        regions: { select: { region: { select: { name: true } } } },
        languages: { select: { languageCode: true } },
        reviews: {
          select: {
            id: true,
            avgRating: true,
            ratingExperience: true,
            ratingSatisfaction: true,
            ratingComposition: true,
            ratingWit: true,
            ratingVoice: true,
            ratingAppearance: true,
            comment: true,
            isAnonymous: true,
            proReply: true,
            proRepliedAt: true,
            createdAt: true,
            reviewer: { select: { id: true, name: true, profileImageUrl: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!pro) return null;

    this.prisma.proProfile.update({
      where: { id: proProfileId },
      data: { profileViews: { increment: 1 } },
    }).catch(() => {});

    const detailResult = {
      ...pro,
      avgRating: Number(pro.avgRating),
      categoryNames: pro.categories.map((c) => c.category.name),
      regionNames: pro.regions.map((r) => r.region.name),
      languageCodes: pro.languages.map((l) => l.languageCode),
      tagList: pro.tags || [],
    };
    this.setCached(detailCacheKey, detailResult);
    return detailResult;
  }
}

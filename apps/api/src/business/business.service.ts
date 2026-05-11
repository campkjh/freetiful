import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { resolveBusinessTags, stripBusinessTagMarker } from './business-tags';
import { isBusinessRelevantToAnyCategory, isBusinessRelevantToCategory } from './business-quality';

// quality 필터를 통과할 비율을 보수적으로 80%로 가정해 배수 샘플링
const QUALITY_FILTER_BATCH_FACTOR = 4;

@Injectable()
export class BusinessService {
  constructor(private prisma: PrismaService) {}

  async getBusinesses(page: number, limit: number, search?: string, category?: string) {
    const normalizedPage = Math.max(1, Number.isFinite(page) ? page : 1);
    const normalizedLimit = Math.min(Math.max(1, Number.isFinite(limit) ? limit : 20), 100);

    const where: any = { status: 'approved' };
    const andFilters: any[] = [];

    if (search) {
      andFilters.push({
        OR: [
          { businessName: { contains: search, mode: 'insensitive' } },
          { address: { contains: search, mode: 'insensitive' } },
        ],
      });
    }

    if (category && category !== '전체') {
      andFilters.push({
        categories: { some: { category: { name: category } } },
      });
    }

    if (andFilters.length > 0) where.AND = andFilters;

    const select = {
      id: true, businessName: true, businessType: true, address: true,
      descriptionHtml: true, createdAt: true, approvedAt: true,
      categories: { select: { category: { select: { name: true } } } },
      images: { orderBy: { displayOrder: 'asc' as const }, take: 1, select: { imageUrl: true } },
    };

    // 페이지별로 필요한 최소 배수만 DB에서 fetch — 1000건 풀 스캔 제거
    const batchSize = normalizedLimit * QUALITY_FILTER_BATCH_FACTOR;
    const dbSkip = (normalizedPage - 1) * batchSize;

    const [candidates, dbTotal] = await Promise.all([
      this.prisma.businessProfile.findMany({ where, take: batchSize, skip: dbSkip, orderBy: { createdAt: 'asc' }, select }),
      this.prisma.businessProfile.count({ where }),
    ]);

    const filtered = candidates.filter((item) =>
      category && category !== '전체'
        ? isBusinessRelevantToCategory(item, category)
        : isBusinessRelevantToAnyCategory(item),
    );

    return {
      items: filtered.slice(0, normalizedLimit).map((item) => ({
        id: item.id,
        businessName: item.businessName,
        businessType: item.businessType,
        address: item.address,
        createdAt: item.createdAt,
        approvedAt: item.approvedAt,
        categories: item.categories,
        images: item.images,
        tags: resolveBusinessTags(item),
      })),
      total: dbTotal,
      page: normalizedPage,
      limit: normalizedLimit,
      totalPages: Math.ceil(dbTotal / normalizedLimit),
    };
  }

  async getBusinessDetail(id: string) {
    const business = await this.prisma.businessProfile.findUnique({
      where: { id },
      include: {
        categories: { include: { category: true } },
        images: { orderBy: { displayOrder: 'asc' } },
        user: {
          select: { id: true, name: true, profileImageUrl: true },
        },
      },
    });

    if (!business) {
      throw new NotFoundException('업체를 찾을 수 없습니다.');
    }

    // Increment profile views
    await this.prisma.businessProfile.update({
      where: { id },
      data: { profileViews: { increment: 1 } },
    });

    return {
      ...business,
      descriptionHtml: stripBusinessTagMarker(business.descriptionHtml),
      tags: resolveBusinessTags(business),
    };
  }
}

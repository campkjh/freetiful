import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { resolveBusinessTags, stripBusinessTagMarker } from './business-tags';

@Injectable()
export class BusinessService {
  constructor(private prisma: PrismaService) {}

  async getBusinesses(page: number, limit: number, search?: string, category?: string) {
    const normalizedPage = Math.max(1, Number.isFinite(page) ? page : 1);
    const normalizedLimit = Math.min(Math.max(1, Number.isFinite(limit) ? limit : 20), 100);
    const skip = (normalizedPage - 1) * normalizedLimit;

    const where: any = {
      status: 'approved',
    };
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
        categories: {
          some: {
            category: { name: category },
          },
        },
      });
    }

    if (andFilters.length > 0) {
      where.AND = andFilters;
    }

    const [items, total] = await Promise.all([
      this.prisma.businessProfile.findMany({
        where,
        skip,
        take: normalizedLimit,
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          businessName: true,
          businessType: true,
          address: true,
          descriptionHtml: true,
          createdAt: true,
          approvedAt: true,
          categories: {
            select: {
              category: {
                select: { name: true },
              },
            },
          },
          images: {
            orderBy: { displayOrder: 'asc' },
            take: 1,
            select: { imageUrl: true },
          },
        },
      }),
      this.prisma.businessProfile.count({ where }),
    ]);

    return {
      items: items.map((item) => {
        const tags = resolveBusinessTags(item);
        return {
          id: item.id,
          businessName: item.businessName,
          businessType: item.businessType,
          address: item.address,
          createdAt: item.createdAt,
          approvedAt: item.approvedAt,
          categories: item.categories,
          images: item.images,
          tags,
        };
      }),
      total,
      page: normalizedPage,
      limit: normalizedLimit,
      totalPages: Math.ceil(total / normalizedLimit),
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

import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  extractBusinessVisibilityFromHtml,
  resolveBusinessTags,
  stripBusinessTagMarker,
} from './business-tags';
import { isBusinessRelevantToAnyCategory, isBusinessRelevantToCategory } from './business-quality';

const BUSINESS_LIST_MAX_CANDIDATES = 1000;

// 리스트 상단 고정 — 빌라드지디 제휴 지점을 이 순서대로 최상단에 노출한다.
// (나머지 업체들은 기존 createdAt asc 순서 유지 — Array#sort 는 stable)
const PINNED_BUSINESS_ORDER = [
  '빌라드지디 안산',
  '빌라드지디 안양',
  '빌라드지디 수서',
  '빌라드지디 논현',
  '빌라드지디 청담',
];
const pinnedRank = (name?: string | null) => {
  const i = PINNED_BUSINESS_ORDER.indexOf(String(name || '').trim());
  return i === -1 ? Number.MAX_SAFE_INTEGER : i;
};

@Injectable()
export class BusinessService {
  constructor(private prisma: PrismaService) {}

  private isKakaoSeededBusinessEmail(email?: string | null) {
    return !!email && email.startsWith('kakao-') && email.endsWith('@freetiful.local');
  }

  private isBusinessVisible(input: { descriptionHtml?: string | null; user?: { email?: string | null } | null }) {
    const explicitVisibility = extractBusinessVisibilityFromHtml(input.descriptionHtml);
    if (typeof explicitVisibility === 'boolean') return explicitVisibility;
    return !this.isKakaoSeededBusinessEmail(input.user?.email);
  }

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

    const candidates = await this.prisma.businessProfile.findMany({
      where,
      take: BUSINESS_LIST_MAX_CANDIDATES,
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
        user: {
          select: { email: true },
        },
      },
    });

    const filteredItems = candidates.filter((item) => {
      if (!this.isBusinessVisible(item)) return false;
      return category && category !== '전체'
        ? isBusinessRelevantToCategory(item, category)
        : isBusinessRelevantToAnyCategory(item);
    });
    // 고정 지점을 요청 순서대로 최상단에 (stable sort — 나머지는 createdAt asc 유지)
    filteredItems.sort((a, b) => pinnedRank(a.businessName) - pinnedRank(b.businessName));
    const items = filteredItems.slice(skip, skip + normalizedLimit);
    const total = filteredItems.length;

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
          select: { id: true, name: true, profileImageUrl: true, email: true },
        },
      },
    });

    if (!business) {
      throw new NotFoundException('업체를 찾을 수 없습니다.');
    }

    if (
      business.status !== 'approved' ||
      !this.isBusinessVisible(business) ||
      !isBusinessRelevantToAnyCategory(business)
    ) {
      throw new NotFoundException('업체를 찾을 수 없습니다.');
    }

    // Increment profile views
    await this.prisma.businessProfile.update({
      where: { id },
      data: { profileViews: { increment: 1 } },
    });

    const { email: _ownerEmail, ...publicUser } = business.user || {};

    return {
      ...business,
      user: publicUser,
      descriptionHtml: stripBusinessTagMarker(business.descriptionHtml),
      tags: resolveBusinessTags(business),
    };
  }
}

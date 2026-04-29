import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import axios from 'axios';
import { lookup } from 'dns/promises';
import type { Response } from 'express';
import { isIP } from 'net';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BusinessService {
  private readonly logger = new Logger(BusinessService.name);
  private readonly imageProxyValidationCache = new Map<string, number>();
  private readonly imageProxyValidationTtlMs = 10 * 60 * 1000;

  constructor(private prisma: PrismaService) {}

  private readonly businessInclude = {
    categories: { include: { category: true } },
    images: { orderBy: { displayOrder: 'asc' as const }, take: 1 },
  };

  private readonly kakaoSeedWhere = {
    OR: [
      { descriptionHtml: { contains: 'business-tags' } },
      { user: { email: { startsWith: 'kakao-' } } },
    ],
  };

  private isPrivateIpv4(address: string) {
    const parts = address.split('.').map((part) => Number(part));
    if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return true;
    const [a, b] = parts;
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224
    );
  }

  private isPrivateIpv6(address: string) {
    const normalized = address.toLowerCase();
    return (
      normalized === '::' ||
      normalized === '::1' ||
      normalized.startsWith('fc') ||
      normalized.startsWith('fd') ||
      normalized.startsWith('fe80') ||
      normalized.startsWith('::ffff:10.') ||
      normalized.startsWith('::ffff:127.') ||
      normalized.startsWith('::ffff:169.254.') ||
      normalized.startsWith('::ffff:192.168.')
    );
  }

  private isPrivateIp(address: string) {
    const family = isIP(address);
    if (family === 4) return this.isPrivateIpv4(address);
    if (family === 6) return this.isPrivateIpv6(address);
    return true;
  }

  private async assertPublicImageTarget(url: URL) {
    const hostname = url.hostname.toLowerCase();
    if (!hostname || hostname === 'localhost' || hostname.endsWith('.local')) {
      throw new BadRequestException('지원하지 않는 이미지 주소입니다.');
    }

    if (isIP(hostname)) {
      if (this.isPrivateIp(hostname)) throw new BadRequestException('지원하지 않는 이미지 주소입니다.');
      return;
    }

    const addresses = await lookup(hostname, { all: true });
    if (addresses.length === 0 || addresses.some((entry) => this.isPrivateIp(entry.address))) {
      throw new BadRequestException('지원하지 않는 이미지 주소입니다.');
    }
  }

  private async assertRegisteredBusinessImage(imageUrl: string) {
    const cachedAt = this.imageProxyValidationCache.get(imageUrl);
    if (cachedAt && Date.now() - cachedAt < this.imageProxyValidationTtlMs) return;

    const image = await this.prisma.businessImage.findFirst({
      where: { imageUrl },
      select: { id: true },
    });

    if (!image) throw new BadRequestException('등록되지 않은 업체 이미지입니다.');
    this.imageProxyValidationCache.set(imageUrl, Date.now());
  }

  async proxyBusinessImage(rawUrl: string, res: Response) {
    const imageUrl = String(rawUrl || '').trim();
    if (!imageUrl) throw new BadRequestException('이미지 주소가 필요합니다.');

    let target: URL;
    try {
      target = new URL(imageUrl);
    } catch {
      throw new BadRequestException('잘못된 이미지 주소입니다.');
    }

    if (!['http:', 'https:'].includes(target.protocol)) {
      throw new BadRequestException('지원하지 않는 이미지 주소입니다.');
    }

    await this.assertRegisteredBusinessImage(imageUrl);
    await this.assertPublicImageTarget(target);

    try {
      const response = await axios.get<ArrayBuffer>(imageUrl, {
        responseType: 'arraybuffer',
        timeout: 12_000,
        maxRedirects: 3,
        validateStatus: (status) => status >= 200 && status < 300,
        headers: {
          Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
          Referer: `${target.protocol}//${target.hostname}/`,
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
        },
      });

      const contentTypeHeader = String(response.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
      const contentType = contentTypeHeader.startsWith('image/') ? contentTypeHeader : 'image/jpeg';
      const buffer = Buffer.from(response.data);

      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Length', String(buffer.length));
      res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      return res.send(buffer);
    } catch (error) {
      const status = axios.isAxiosError(error) ? error.response?.status : undefined;
      this.logger.warn(`업체 이미지 프록시 실패: ${imageUrl} (${status || 'unknown'})`);
      throw new NotFoundException('이미지를 불러올 수 없습니다.');
    }
  }

  private buildTextSearchCondition(value: string) {
    return {
      OR: [
        { businessName: { contains: value, mode: 'insensitive' } },
        { address: { contains: value, mode: 'insensitive' } },
        { businessType: { contains: value, mode: 'insensitive' } },
        { categories: { some: { category: { name: { contains: value, mode: 'insensitive' } } } } },
      ],
    };
  }

  async getBusinesses(
    page: number,
    limit: number,
    search?: string,
    category?: string,
    region?: string,
    filters?: string,
    mode?: string,
  ) {
    const safePage = Math.max(1, Number.isFinite(page) ? Math.floor(page) : 1);
    const safeLimit = Math.min(100, Math.max(1, Number.isFinite(limit) ? Math.floor(limit) : 20));
    const skip = (safePage - 1) * safeLimit;
    const selectedCategory = String(category || '').trim();
    const selectedRegion = String(region || '').trim();
    const filterValues = String(filters || '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
    const andConditions: any[] = [];

    const where: any = {
      status: 'approved',
    };

    if (search) {
      andConditions.push(this.buildTextSearchCondition(search.trim()));
    }

    if (selectedCategory && selectedCategory !== '전체' && selectedCategory !== '인기') {
      andConditions.push({
        OR: [
          { businessType: { contains: selectedCategory, mode: 'insensitive' } },
          { categories: { some: { category: { name: selectedCategory } } } },
        ],
      });
    }

    if (selectedRegion && selectedRegion !== '전국' && selectedRegion !== '내 위치') {
      const regionKeywords = selectedRegion.split(/[\/,\s]+/).map((value) => value.trim()).filter(Boolean);
      if (regionKeywords.length > 0) {
        andConditions.push({
          OR: regionKeywords.flatMap((keyword) => [
            { address: { contains: keyword, mode: 'insensitive' } },
            { businessName: { contains: keyword, mode: 'insensitive' } },
          ]),
        });
      }
    }

    if (filterValues.length > 0) {
      andConditions.push({
        OR: filterValues.flatMap((value) => this.buildTextSearchCondition(value).OR),
      });
    }

    if (andConditions.length > 0) where.AND = andConditions;

    const useCuratedFirst = mode !== 'list' && andConditions.length === 0 && safePage === 1;

    if (useCuratedFirst) {
      const [items, total] = await Promise.all([
        this.getCuratedFirstBusinesses(where, safeLimit),
        this.prisma.businessProfile.count({ where }),
      ]);

      return {
        items,
        total,
        page: safePage,
        limit: safeLimit,
        totalPages: Math.ceil(total / safeLimit),
      };
    }

    const [items, total] = await Promise.all([
      this.prisma.businessProfile.findMany({
        where,
        skip,
        take: safeLimit,
        orderBy: [{ profileViews: 'desc' }, { createdAt: 'desc' }],
        include: this.businessInclude,
      }),
      this.prisma.businessProfile.count({ where }),
    ]);

    return {
      items,
      total,
      page: safePage,
      limit: safeLimit,
      totalPages: Math.ceil(total / safeLimit),
    };
  }

  private async getCuratedFirstBusinesses(where: any, limit: number) {
    const curated = await this.prisma.businessProfile.findMany({
      where: { ...where, NOT: this.kakaoSeedWhere },
      take: limit,
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
      include: this.businessInclude,
    });

    const items = [...curated];
    const seenIds = new Set(items.map((item) => item.id));

    if (items.length >= limit) return items;

    const remaining = limit - items.length;
    const categoryCount = await this.prisma.category.count({ where: { type: 'business', isActive: true } });
    const perCategory = Math.max(1, Math.ceil(remaining / Math.max(categoryCount, 1)));
    const balancedKakaoIds = await this.getBalancedKakaoBusinessIds(perCategory, remaining * 3);
    const balancedKakao = await this.findBusinessesByIds(balancedKakaoIds);

    balancedKakao.forEach((item) => {
      if (items.length < limit && !seenIds.has(item.id)) {
        seenIds.add(item.id);
        items.push(item);
      }
    });

    if (items.length >= limit) return items;

    const fallback = await this.prisma.businessProfile.findMany({
      where: {
        ...where,
        ...this.kakaoSeedWhere,
        id: { notIn: Array.from(seenIds) },
      },
      take: limit - items.length,
      orderBy: [{ profileViews: 'desc' }, { createdAt: 'desc' }],
      include: this.businessInclude,
    });

    return [...items, ...fallback];
  }

  private async getBalancedKakaoBusinessIds(perCategory: number, take: number) {
    const rows = await this.prisma.$queryRaw<{ id: string }[]>`
      WITH ranked_seeded AS (
        SELECT
          bp.id,
          c."displayOrder",
          c.name,
          ROW_NUMBER() OVER (
            PARTITION BY c.id
            ORDER BY bp."profileViews" DESC, bp."createdAt" DESC
          ) AS rn
        FROM business_profiles bp
        INNER JOIN users u ON u.id = bp."userId"
        INNER JOIN business_categories bc ON bc."businessProfileId" = bp.id
        INNER JOIN categories c ON c.id = bc."categoryId"
        WHERE bp.status = 'approved'
          AND c.type = 'business'
          AND c."isActive" = true
          AND (
            bp."descriptionHtml" LIKE '%business-tags%'
            OR u.email LIKE 'kakao-%'
          )
      )
      SELECT id
      FROM ranked_seeded
      WHERE rn <= ${perCategory}
      ORDER BY "displayOrder" ASC, name ASC, rn ASC
      LIMIT ${take}
    `;

    return rows.map((row) => row.id);
  }

  private async findBusinessesByIds(ids: string[]) {
    if (ids.length === 0) return [];

    const uniqueIds = Array.from(new Set(ids));
    const businesses = await this.prisma.businessProfile.findMany({
      where: { id: { in: uniqueIds } },
      include: this.businessInclude,
    });
    const byId = new Map(businesses.map((business) => [business.id, business]));
    const ordered = uniqueIds.map((id) => byId.get(id));

    return ordered.filter((business): business is (typeof businesses)[number] => Boolean(business));
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

    return business;
  }
}

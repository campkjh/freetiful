import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BusinessService {
  constructor(private prisma: PrismaService) {}

  async getBusinesses(page: number, limit: number, search?: string) {
    const skip = (page - 1) * limit;

    const where: any = {
      status: 'approved',
    };

    if (search) {
      where.OR = [
        { businessName: { contains: search, mode: 'insensitive' } },
        { address: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.businessProfile.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          categories: { include: { category: true } },
          images: { orderBy: { displayOrder: 'asc' }, take: 1 },
        },
      }),
      this.prisma.businessProfile.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
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

    return business;
  }
}

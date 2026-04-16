import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class FavoriteService {
  constructor(private prisma: PrismaService) {}

  async toggleFavorite(
    userId: string,
    proProfileId: string,
  ): Promise<{ isFavorited: boolean; puddingCount: number }> {
    const existing = await this.prisma.favorite.findUnique({
      where: {
        userId_targetType_targetId: {
          userId,
          targetType: 'pro',
          targetId: proProfileId,
        },
      },
    });

    if (existing) {
      const [, updated] = await this.prisma.$transaction([
        this.prisma.favorite.delete({ where: { id: existing.id } }),
        this.prisma.proProfile.update({
          where: { id: proProfileId },
          data: { puddingCount: { decrement: 1 } },
          select: { puddingCount: true },
        }),
      ]);
      return { isFavorited: false, puddingCount: Math.max(0, updated.puddingCount) };
    }

    const [, updated] = await this.prisma.$transaction([
      this.prisma.favorite.create({
        data: {
          userId,
          targetType: 'pro',
          targetId: proProfileId,
        },
      }),
      this.prisma.proProfile.update({
        where: { id: proProfileId },
        data: { puddingCount: { increment: 1 } },
        select: { puddingCount: true },
      }),
    ]);
    return { isFavorited: true, puddingCount: updated.puddingCount };
  }

  async getFavorites(userId: string, page: number, limit: number) {
    const skip = (page - 1) * limit;

    const [favorites, total] = await Promise.all([
      this.prisma.favorite.findMany({
        where: { userId, targetType: 'pro' },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.favorite.count({
        where: { userId, targetType: 'pro' },
      }),
    ]);

    const proProfileIds = favorites.map((f) => f.targetId);

    const proProfiles = await this.prisma.proProfile.findMany({
      where: { id: { in: proProfileIds } },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            profileImageUrl: true,
          },
        },
        images: {
          where: { isPrimary: true },
          take: 1,
        },
        categories: {
          include: { category: true },
        },
      },
    });

    const profileMap = new Map(proProfiles.map((p) => [p.id, p]));

    const items = favorites.map((fav) => ({
      id: fav.id,
      createdAt: fav.createdAt,
      proProfile: profileMap.get(fav.targetId) ?? null,
    }));

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async isFavorited(
    userId: string,
    proProfileId: string,
  ): Promise<{ isFavorited: boolean }> {
    const count = await this.prisma.favorite.count({
      where: {
        userId,
        targetType: 'pro',
        targetId: proProfileId,
      },
    });

    return { isFavorited: count > 0 };
  }
}

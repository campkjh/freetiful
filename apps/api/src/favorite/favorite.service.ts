import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';

@Injectable()
export class FavoriteService {
  constructor(
    private prisma: PrismaService,
    private notificationService: NotificationService,
  ) {}

  async toggleFavorite(
    userId: string,
    proProfileId: string,
  ): Promise<{ isFavorited: boolean }> {
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
      await this.prisma.favorite.delete({ where: { id: existing.id } });
      return { isFavorited: false };
    }

    await this.prisma.favorite.create({
      data: {
        userId,
        targetType: 'pro',
        targetId: proProfileId,
      },
    });

    // 찜 알림 → 전문가에게
    try {
      const [user, proProfile] = await Promise.all([
        this.prisma.user.findUnique({ where: { id: userId }, select: { name: true } }),
        this.prisma.proProfile.findUnique({ where: { id: proProfileId }, select: { userId: true } }),
      ]);
      if (proProfile) {
        this.notificationService.createNotification(
          proProfile.userId,
          'system' as any,
          '찜 목록에 추가되었습니다! 💖',
          `${user?.name || '누군가'}님이 회원님을 찜 목록에 추가했습니다.`,
          { proProfileId },
        ).catch(() => {});
      }
    } catch {}

    return { isFavorited: true };
  }

  async removeFavorite(
    userId: string,
    proProfileId: string,
  ): Promise<{ isFavorited: boolean }> {
    await this.prisma.favorite.deleteMany({
      where: {
        userId,
        targetType: 'pro',
        targetId: proProfileId,
      },
    });

    return { isFavorited: false };
  }

  async getFavorites(userId: string, page: number, limit: number, withTotal = true) {
    const skip = (page - 1) * limit;

    // 첫 화면에서는 total count를 생략할 수 있게 해서 찜목록 응답을 가볍게 유지.
    const favoritesPromise = this.prisma.favorite.findMany({
      where: { userId, targetType: 'pro' },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      select: {
        id: true,
        targetId: true,
        createdAt: true,
      },
    });
    const totalPromise = withTotal
      ? this.prisma.favorite.count({ where: { userId, targetType: 'pro' } })
      : Promise.resolve(0);
    const [favorites, totalCount] = await Promise.all([favoritesPromise, totalPromise]);
    const total = withTotal ? totalCount : favorites.length;

    if (favorites.length === 0) {
      return {
        items: [],
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    }

    const proProfileIds = favorites.map((f) => f.targetId);

    const proProfiles = await this.prisma.proProfile.findMany({
      where: { id: { in: proProfileIds } },
      select: {
        id: true,
        shortIntro: true,
        avgRating: true,
        reviewCount: true,
        user: {
          select: {
            id: true,
            name: true,
            profileImageUrl: true,
          },
        },
        images: {
          orderBy: { displayOrder: 'asc' },
          take: 1,
          select: { imageUrl: true },
        },
        services: {
          where: { isActive: true },
          orderBy: { displayOrder: 'asc' },
          take: 1,
          select: { basePrice: true },
        },
        categories: {
          take: 1,
          select: {
            category: {
              select: { name: true },
            },
          },
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

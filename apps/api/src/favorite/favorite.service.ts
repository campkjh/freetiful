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

  async getFavorites(userId: string, page: number, limit: number) {
    const skip = (page - 1) * limit;

    // favorites + count 먼저 가져옴 (proProfileIds 필요)
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
      include: {
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
        },
        services: {
          where: { isActive: true },
          orderBy: { displayOrder: 'asc' },
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

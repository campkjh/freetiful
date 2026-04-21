import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BannerService {
  constructor(private prisma: PrismaService) {}

  async listActive() {
    return this.prisma.banner.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async listAll() {
    return this.prisma.banner.findMany({
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async create(data: {
    title?: string;
    subtitle?: string;
    imageUrl: string;
    linkUrl?: string | null;
    bgColor?: string | null;
    sortOrder?: number;
    isActive?: boolean;
  }) {
    if (!data.imageUrl) throw new NotFoundException('imageUrl 은 필수입니다');
    return this.prisma.banner.create({
      data: {
        title: data.title ?? '',
        subtitle: data.subtitle ?? '',
        imageUrl: data.imageUrl,
        linkUrl: data.linkUrl ?? null,
        bgColor: data.bgColor ?? null,
        sortOrder: data.sortOrder ?? 0,
        isActive: data.isActive ?? true,
      },
    });
  }

  async update(id: string, data: any) {
    const existing = await this.prisma.banner.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('배너를 찾을 수 없습니다');

    const allowed: any = {};
    if (data.title !== undefined) allowed.title = String(data.title ?? '');
    if (data.subtitle !== undefined) allowed.subtitle = String(data.subtitle ?? '');
    if (data.imageUrl !== undefined) allowed.imageUrl = String(data.imageUrl);
    if (data.linkUrl !== undefined) allowed.linkUrl = data.linkUrl || null;
    if (data.bgColor !== undefined) allowed.bgColor = data.bgColor || null;
    if (data.sortOrder !== undefined) allowed.sortOrder = Number(data.sortOrder);
    if (data.isActive !== undefined) allowed.isActive = !!data.isActive;

    return this.prisma.banner.update({ where: { id }, data: allowed });
  }

  async remove(id: string) {
    const existing = await this.prisma.banner.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('배너를 찾을 수 없습니다');
    await this.prisma.banner.delete({ where: { id } });
    return { success: true };
  }
}

import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BannerService {
  constructor(private prisma: PrismaService) {}

  private normalizePlacement(placement?: string | null) {
    // home(홈 캐러셀) / businesses(웨딩파트너 리스트) / popup(홈 진입 모달)
    return placement === 'businesses' || placement === 'popup' ? placement : 'home';
  }

  async listActive(placement?: string) {
    return this.prisma.banner.findMany({
      where: { isActive: true, placement: this.normalizePlacement(placement) },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async listAll(placement?: string) {
    return this.prisma.banner.findMany({
      where: placement ? { placement: this.normalizePlacement(placement) } : undefined,
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async create(data: {
    placement?: string;
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
        placement: this.normalizePlacement(data.placement),
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
    if (data.placement !== undefined) allowed.placement = this.normalizePlacement(data.placement);
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

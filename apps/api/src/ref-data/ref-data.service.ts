import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RefDataService {
  constructor(private prisma: PrismaService) {}

  async getMatchOptions() {
    await this.ensureDefaultMatchData();

    const [categories, personalities] = await Promise.all([
      this.prisma.category.findMany({
        where: { type: 'pro', isActive: true },
        orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
        include: {
          eventCategories: {
            where: { isActive: true },
            orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
          },
          styleOptions: {
            where: { isActive: true },
            orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
          },
        },
      }),
      this.prisma.personalityOption.findMany({
        where: { isActive: true },
        orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
      }),
    ]);

    return { categories, personalities };
  }

  private async ensureDefaultMatchData() {
    const categoryCount = await this.prisma.category.count({
      where: { type: 'pro' },
    });
    if (categoryCount > 0) return;

    const defaults = [
      {
        id: 'mc',
        name: 'MC',
        nameEn: 'MC',
        events: ['결혼식', '생신잔치 (환갑/칠순)', '돌잔치', '기업행사', '강의/클래스'],
        styles: ['격식있는', '유머있는', '감동적인', '경쾌한', '차분한', '프로페셔널한'],
      },
      { id: 'singer', name: '가수', nameEn: 'Singer', events: ['결혼식', '기업행사'], styles: ['감동적인', '경쾌한'] },
      { id: 'host', name: '쇼호스트', nameEn: 'Show Host', events: ['기업행사', '강의/클래스'], styles: ['프로페셔널한', '유머있는'] },
    ];

    for (const [index, item] of defaults.entries()) {
      await this.prisma.category.create({
        data: {
          id: item.id,
          type: 'pro',
          name: item.name,
          nameEn: item.nameEn,
          displayOrder: index,
          eventCategories: {
            create: item.events.map((name, displayOrder) => ({ name, displayOrder })),
          },
          styleOptions: {
            create: item.styles.map((name, displayOrder) => ({ name, displayOrder })),
          },
        },
      });
    }

    await this.prisma.personalityOption.createMany({
      data: ['친근한', '활발한', '신중한', '창의적인', '배려심있는', '카리스마있는'].map((name, displayOrder) => ({
        name,
        displayOrder,
      })),
      skipDuplicates: true,
    });

    const approvedPros = await this.prisma.proProfile.findMany({
      where: { status: 'approved' },
      select: { id: true },
    });
    if (approvedPros.length > 0) {
      await this.prisma.proCategory.createMany({
        data: approvedPros.map((pro) => ({ proProfileId: pro.id, categoryId: 'mc' })),
        skipDuplicates: true,
      });
    }
  }
}

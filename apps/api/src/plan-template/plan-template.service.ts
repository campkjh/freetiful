import { Injectable, OnModuleInit, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const DEFAULT_TEMPLATES = [
  {
    planKey: 'premium',
    label: 'Premium',
    description: '행사 1시간 진행',
    defaultPrice: 450000,
    includedItems: ['사회 진행', '사전 미팅'],
    displayOrder: 0,
  },
  {
    planKey: 'superior',
    label: 'Superior',
    description: '행사 2시간 진행',
    defaultPrice: 800000,
    includedItems: ['사회 진행', '사전 미팅', '대본 작성', '리허설 참석', '포토타임 진행', '영상 큐시트 관리'],
    displayOrder: 1,
  },
  {
    planKey: 'enterprise',
    label: 'Enterprise',
    description: '6시간 풀타임',
    defaultPrice: 1700000,
    includedItems: ['사회 진행', '사전 미팅', '대본 작성', '리허설 참석', '축사/건배사 코디', '포토타임 진행', '하객 응대 안내', '2차 진행', '영상 큐시트 관리', '전담 코디네이터'],
    displayOrder: 2,
  },
  {
    planKey: 'test',
    label: 'Test',
    description: '테스트용 (결제 플로우 확인)',
    defaultPrice: 100,
    includedItems: ['테스트 서비스'],
    displayOrder: 99,
  },
];

@Injectable()
export class PlanTemplateService implements OnModuleInit {
  private readonly logger = new Logger(PlanTemplateService.name);
  constructor(private prisma: PrismaService) {}

  // 서버 시작 시 기본 템플릿 자동 시드 (이미 있으면 skip)
  async onModuleInit() {
    try {
      for (const tpl of DEFAULT_TEMPLATES) {
        await this.prisma.planTemplate.upsert({
          where: { planKey: tpl.planKey },
          create: tpl as any,
          update: {}, // 존재하면 건드리지 않음 (어드민이 수정한 값 유지)
        });
      }
      this.logger.log('Plan template defaults seeded');
    } catch (e: any) {
      this.logger.warn(`Plan template seed skipped: ${e?.message || e}`);
    }
  }

  async listActive() {
    return this.prisma.planTemplate.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: 'asc' },
    });
  }

  async listAll() {
    return this.prisma.planTemplate.findMany({
      orderBy: { displayOrder: 'asc' },
    });
  }

  async create(data: { planKey: string; label: string; description?: string; defaultPrice: number; includedItems?: string[]; displayOrder?: number; isActive?: boolean }) {
    return this.prisma.planTemplate.create({
      data: {
        planKey: data.planKey,
        label: data.label,
        description: data.description ?? null,
        defaultPrice: data.defaultPrice,
        includedItems: (data.includedItems ?? []) as any,
        displayOrder: data.displayOrder ?? 0,
        isActive: data.isActive ?? true,
      },
    });
  }

  async update(id: string, data: any) {
    const allowed: any = {};
    if (data.label !== undefined) allowed.label = data.label;
    if (data.description !== undefined) allowed.description = data.description;
    if (data.defaultPrice !== undefined) allowed.defaultPrice = Number(data.defaultPrice);
    if (data.includedItems !== undefined) allowed.includedItems = data.includedItems;
    if (data.displayOrder !== undefined) allowed.displayOrder = Number(data.displayOrder);
    if (data.isActive !== undefined) allowed.isActive = !!data.isActive;
    if (data.planKey !== undefined) allowed.planKey = data.planKey;

    const existing = await this.prisma.planTemplate.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('플랜 템플릿을 찾을 수 없습니다');

    return this.prisma.planTemplate.update({ where: { id }, data: allowed });
  }

  async remove(id: string) {
    const existing = await this.prisma.planTemplate.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('플랜 템플릿을 찾을 수 없습니다');
    await this.prisma.planTemplate.delete({ where: { id } });
    return { success: true };
  }
}

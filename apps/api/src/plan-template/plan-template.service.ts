import { Injectable, OnModuleInit, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DiscoveryService } from '../discovery/discovery.service';

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
  constructor(
    private prisma: PrismaService,
    private discovery: DiscoveryService,
  ) {}

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

    const updated = await this.prisma.planTemplate.update({ where: { id }, data: allowed });

    // 이전 label → 새 label 로 바뀌었을 수도 있으니 양쪽 타이틀로 매칭
    const matchTitles = [existing.label, updated.label].filter(Boolean);
    const cascadeData: any = {};
    if (data.defaultPrice !== undefined) cascadeData.basePrice = Number(data.defaultPrice);
    if (data.label !== undefined) cascadeData.title = updated.label;
    if (data.description !== undefined) cascadeData.description = updated.description;

    if (Object.keys(cascadeData).length > 0) {
      // 기존 ProService 에서 title 이 일치하는 것들을 모두 업데이트 (모든 프로에 전파)
      const affected = await this.prisma.proService.findMany({
        where: { title: { in: matchTitles } },
        select: { id: true, proProfileId: true },
      });

      if (affected.length > 0) {
        await this.prisma.proService.updateMany({
          where: { title: { in: matchTitles } },
          data: cascadeData,
        });
        this.logger.log(`Plan template cascade: ${affected.length} ProService rows updated for "${existing.label}"`);

        // 영향 받은 모든 프로의 discovery 캐시 무효화
        const uniqueProfileIds = Array.from(new Set(affected.map((a) => a.proProfileId)));
        for (const pid of uniqueProfileIds) {
          this.discovery.invalidateCache(pid);
        }
        // 리스트 캐시도 전부 비움
        this.discovery.invalidateCache();
      }
    }

    return updated;
  }

  async remove(id: string) {
    const existing = await this.prisma.planTemplate.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('플랜 템플릿을 찾을 수 없습니다');
    await this.prisma.planTemplate.delete({ where: { id } });
    return { success: true };
  }
}

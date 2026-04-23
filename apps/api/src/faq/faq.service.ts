import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class FaqService {
  constructor(private prisma: PrismaService) {}

  // 공개: 게시 중인 FAQ — 카테고리 그룹핑은 프론트에서 처리, 여기서는 정렬만
  async listPublished() {
    return this.prisma.faq.findMany({
      where: { isPublished: true, isActive: true },
      orderBy: [{ category: 'asc' }, { displayOrder: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async listAll() {
    return this.prisma.faq.findMany({
      orderBy: [{ category: 'asc' }, { displayOrder: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async getById(id: string) {
    const item = await this.prisma.faq.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('FAQ를 찾을 수 없습니다');
    return item;
  }

  async getPublishedById(id: string) {
    const item = await this.prisma.faq.findFirst({
      where: { id, isPublished: true, isActive: true },
    });
    if (!item) throw new NotFoundException('FAQ를 찾을 수 없습니다');
    return item;
  }

  async create(data: {
    category: string;
    question: string;
    answer: string;
    displayOrder?: number;
    isPublished?: boolean;
  }) {
    if (!data.question) throw new NotFoundException('question은 필수입니다');
    return this.prisma.faq.create({
      data: {
        category: data.category ?? '기타',
        question: data.question,
        answer: data.answer ?? '',
        displayOrder: data.displayOrder ?? 0,
        isPublished: data.isPublished ?? true,
        isActive: data.isPublished ?? true,
      },
    });
  }

  async update(id: string, data: any) {
    const existing = await this.prisma.faq.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('FAQ를 찾을 수 없습니다');

    const allowed: any = {};
    if (data.category !== undefined) allowed.category = String(data.category ?? '기타');
    if (data.question !== undefined) allowed.question = String(data.question ?? '');
    if (data.answer !== undefined) allowed.answer = String(data.answer ?? '');
    if (data.displayOrder !== undefined) allowed.displayOrder = Number(data.displayOrder);
    if (data.isPublished !== undefined) {
      allowed.isPublished = !!data.isPublished;
      allowed.isActive = !!data.isPublished;
    }
    if (data.isActive !== undefined) allowed.isActive = !!data.isActive;

    return this.prisma.faq.update({ where: { id }, data: allowed });
  }

  async remove(id: string) {
    const existing = await this.prisma.faq.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('FAQ를 찾을 수 없습니다');
    await this.prisma.faq.delete({ where: { id } });
    return { success: true };
  }
}

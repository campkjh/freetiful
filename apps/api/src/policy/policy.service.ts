import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DEFAULT_POLICIES } from './policy-defaults';

function cleanString(value: unknown, maxLength?: number) {
  const text = String(value ?? '').trim();
  return maxLength ? text.slice(0, maxLength) : text;
}

function sanitizeHtml(value: unknown) {
  return String(value ?? '')
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/\son[a-z]+\s*=\s*(['"]).*?\1/gi, '')
    .replace(/\sjavascript:/gi, '');
}

function parseDate(value: unknown) {
  const text = cleanString(value, 40);
  if (!text) return null;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(text)
    ? new Date(`${text}T00:00:00.000+09:00`)
    : new Date(text);
  return Number.isNaN(date.getTime()) ? null : date;
}

@Injectable()
export class PolicyService {
  constructor(private prisma: PrismaService) {}

  private async ensureDefaults() {
    const count = await this.prisma.policyDocument.count();
    if (count > 0) return;

    await this.prisma.policyDocument.createMany({
      data: DEFAULT_POLICIES.map((policy) => ({
        slug: policy.slug,
        title: policy.title,
        summary: policy.summary,
        contentHtml: sanitizeHtml(policy.contentHtml),
        version: policy.version,
        effectiveDate: parseDate(policy.effectiveDate),
        displayOrder: policy.displayOrder,
        isPublished: true,
      })),
      skipDuplicates: true,
    });
  }

  async listPublished() {
    await this.ensureDefaults();
    return this.prisma.policyDocument.findMany({
      where: { isPublished: true },
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async getPublished(slug: string) {
    await this.ensureDefaults();
    const item = await this.prisma.policyDocument.findFirst({
      where: { slug, isPublished: true },
    });
    if (!item) throw new NotFoundException('약관 문서를 찾을 수 없습니다.');
    return item;
  }

  async listAll() {
    await this.ensureDefaults();
    return this.prisma.policyDocument.findMany({
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async create(data: any) {
    const slug = cleanString(data.slug, 80).toLowerCase();
    const title = cleanString(data.title, 160);
    const contentHtml = sanitizeHtml(data.contentHtml);
    if (!slug || !/^[a-z0-9-]+$/.test(slug)) throw new BadRequestException('slug는 영문, 숫자, 하이픈만 사용할 수 있습니다.');
    if (!title) throw new BadRequestException('문서 제목은 필수입니다.');
    if (!contentHtml.trim()) throw new BadRequestException('HTML 내용은 필수입니다.');

    return this.prisma.policyDocument.create({
      data: {
        slug,
        title,
        summary: cleanString(data.summary, 300) || null,
        contentHtml,
        version: cleanString(data.version, 40) || '1.0',
        effectiveDate: parseDate(data.effectiveDate),
        displayOrder: Number.isFinite(Number(data.displayOrder)) ? Number(data.displayOrder) : 0,
        isPublished: data.isPublished !== undefined ? !!data.isPublished : true,
      },
    });
  }

  async update(id: string, data: any) {
    const existing = await this.prisma.policyDocument.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('약관 문서를 찾을 수 없습니다.');

    const updateData: any = {};
    if (data.slug !== undefined) {
      const slug = cleanString(data.slug, 80).toLowerCase();
      if (!slug || !/^[a-z0-9-]+$/.test(slug)) throw new BadRequestException('slug는 영문, 숫자, 하이픈만 사용할 수 있습니다.');
      updateData.slug = slug;
    }
    if (data.title !== undefined) {
      const title = cleanString(data.title, 160);
      if (!title) throw new BadRequestException('문서 제목은 필수입니다.');
      updateData.title = title;
    }
    if (data.summary !== undefined) updateData.summary = cleanString(data.summary, 300) || null;
    if (data.contentHtml !== undefined) {
      const contentHtml = sanitizeHtml(data.contentHtml);
      if (!contentHtml.trim()) throw new BadRequestException('HTML 내용은 필수입니다.');
      updateData.contentHtml = contentHtml;
    }
    if (data.version !== undefined) updateData.version = cleanString(data.version, 40) || '1.0';
    if (data.effectiveDate !== undefined) updateData.effectiveDate = parseDate(data.effectiveDate);
    if (data.displayOrder !== undefined) updateData.displayOrder = Number(data.displayOrder) || 0;
    if (data.isPublished !== undefined) updateData.isPublished = !!data.isPublished;

    return this.prisma.policyDocument.update({ where: { id }, data: updateData });
  }

  async remove(id: string) {
    const existing = await this.prisma.policyDocument.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('약관 문서를 찾을 수 없습니다.');
    await this.prisma.policyDocument.delete({ where: { id } });
    return { success: true };
  }
}

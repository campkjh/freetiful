import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const VALID_STATUSES = ['new', 'contacted', 'done', 'archived'];

function cleanString(value: unknown, maxLength?: number) {
  const text = String(value ?? '').trim();
  return maxLength ? text.slice(0, maxLength) : text;
}

@Injectable()
export class BusinessInquiryService {
  constructor(private prisma: PrismaService) {}

  async create(data: any) {
    const name = cleanString(data.name, 80);
    const phone = cleanString(data.phone, 60);
    const message = cleanString(data.message, 4000);
    if (!name || !phone || !message) {
      throw new BadRequestException('담당자명, 연락처, 문의 내용은 필수입니다.');
    }

    return this.prisma.businessInquiry.create({
      data: {
        company: cleanString(data.company, 120) || null,
        name,
        phone,
        email: cleanString(data.email, 120) || null,
        type: cleanString(data.type, 80) || null,
        message,
        fileName: cleanString(data.fileName, 240) || null,
        fileSize: Number.isFinite(Number(data.fileSize)) ? Number(data.fileSize) : null,
        fileType: cleanString(data.fileType, 120) || null,
        source: cleanString(data.source, 80) || 'biz_page',
        metadata: data.metadata && typeof data.metadata === 'object' ? data.metadata : undefined,
      },
    });
  }

  async list(params: {
    page?: number;
    limit?: number;
    status?: string;
    search?: string;
    startDate?: string;
    endDate?: string;
  }) {
    const page = Math.max(1, Number(params.page || 1));
    const limit = Math.min(Math.max(1, Number(params.limit || 20)), 100);
    const where: any = {};

    if (params.status && params.status !== 'all' && VALID_STATUSES.includes(params.status)) {
      where.status = params.status;
    }
    if (params.search) {
      const search = params.search.trim();
      where.OR = [
        { company: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { message: { contains: search, mode: 'insensitive' } },
      ];
    }
    const createdAt: any = {};
    if (params.startDate) {
      const start = /^\d{4}-\d{2}-\d{2}$/.test(params.startDate)
        ? new Date(`${params.startDate}T00:00:00.000+09:00`)
        : new Date(params.startDate);
      if (!Number.isNaN(start.getTime())) createdAt.gte = start;
    }
    if (params.endDate) {
      const end = /^\d{4}-\d{2}-\d{2}$/.test(params.endDate)
        ? new Date(`${params.endDate}T23:59:59.999+09:00`)
        : new Date(params.endDate);
      if (!Number.isNaN(end.getTime())) createdAt.lte = end;
    }
    if (Object.keys(createdAt).length) where.createdAt = createdAt;

    const [data, total] = await Promise.all([
      this.prisma.businessInquiry.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.businessInquiry.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      limit,
      hasMore: page * limit < total,
    };
  }

  async update(id: string, data: any) {
    const existing = await this.prisma.businessInquiry.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('문의 내역을 찾을 수 없습니다.');

    const updateData: any = {};
    if (data.status !== undefined) {
      const status = cleanString(data.status, 40);
      if (!VALID_STATUSES.includes(status)) {
        throw new BadRequestException('올바르지 않은 문의 상태입니다.');
      }
      updateData.status = status;
    }
    if (data.adminNote !== undefined) updateData.adminNote = cleanString(data.adminNote, 3000) || null;

    return this.prisma.businessInquiry.update({
      where: { id },
      data: updateData,
    });
  }

  async remove(id: string) {
    const existing = await this.prisma.businessInquiry.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('문의 내역을 찾을 수 없습니다.');
    await this.prisma.businessInquiry.delete({ where: { id } });
    return { success: true };
  }
}

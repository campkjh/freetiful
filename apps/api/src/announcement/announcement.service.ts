import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/** 공지 카드 그림 — 사이트 안 경로('/…') 또는 https 주소만, 나머지는 없음 */
function cleanImageUrl(v: unknown): string | null {
  const s = typeof v === 'string' ? v.trim() : '';
  return /^(\/[^\s]*|https:\/\/[^\s]+)$/.test(s) ? s : null;
}

@Injectable()
export class AnnouncementService {
  constructor(private prisma: PrismaService) {}

  // 공개: 게시된(isPublished=true) 공지만, 고정 → 최신순
  async listPublished() {
    return this.prisma.announcement.findMany({
      where: { isPublished: true },
      orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
    });
  }

  // 어드민: 전체
  async listAll() {
    return this.prisma.announcement.findMany({
      orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async getById(id: string) {
    const item = await this.prisma.announcement.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('공지사항을 찾을 수 없습니다');
    return item;
  }

  // 공개 상세 — 미게시는 숨김
  async getPublishedById(id: string) {
    const item = await this.prisma.announcement.findFirst({
      where: { id, isPublished: true },
    });
    if (!item) throw new NotFoundException('공지사항을 찾을 수 없습니다');
    return item;
  }

  async create(data: {
    title: string;
    content: string;
    tag?: string | null;
    isPinned?: boolean;
    isPublished?: boolean;
    /** 지난 업데이트 공지를 그 날짜로 올릴 때(관리자 전용 경로) — 목록 순서(createdAt)와 표시 날짜(publishedAt) 둘 다 이 날짜 */
    publishedAt?: string | null;
    /** 카드 그림 경로('/…' 또는 https) */
    imageUrl?: string | null;
  }) {
    if (!data.title) throw new NotFoundException('title은 필수입니다');
    const at = data.publishedAt ? new Date(data.publishedAt) : null;
    const backdated = at && !Number.isNaN(at.getTime()) && at.getTime() <= Date.now() ? at : null;
    return this.prisma.announcement.create({
      data: {
        title: data.title,
        content: data.content ?? '',
        tag: data.tag ?? null,
        imageUrl: cleanImageUrl(data.imageUrl),
        isPinned: data.isPinned ?? false,
        isPublished: data.isPublished ?? true,
        publishedAt: data.isPublished === false ? null : backdated || new Date(),
        ...(backdated ? { createdAt: backdated } : {}),
      },
    });
  }

  async update(id: string, data: any) {
    const existing = await this.prisma.announcement.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('공지사항을 찾을 수 없습니다');

    const allowed: any = {};
    if (data.title !== undefined) allowed.title = String(data.title ?? '');
    if (data.content !== undefined) allowed.content = String(data.content ?? '');
    if (data.tag !== undefined) allowed.tag = data.tag || null;
    if (data.imageUrl !== undefined) allowed.imageUrl = cleanImageUrl(data.imageUrl);
    if (data.isPinned !== undefined) allowed.isPinned = !!data.isPinned;
    if (data.isPublished !== undefined) {
      allowed.isPublished = !!data.isPublished;
      if (data.isPublished && !existing.publishedAt) {
        allowed.publishedAt = new Date();
      }
    }

    return this.prisma.announcement.update({ where: { id }, data: allowed });
  }

  async remove(id: string) {
    const existing = await this.prisma.announcement.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('공지사항을 찾을 수 없습니다');
    await this.prisma.announcement.delete({ where: { id } });
    return { success: true };
  }
}

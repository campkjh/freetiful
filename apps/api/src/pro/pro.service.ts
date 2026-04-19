import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type { Multer } from 'multer';
import { PrismaService } from '../prisma/prisma.service';
import { ImageService, ImageProcessOptions } from '../image/image.service';

@Injectable()
export class ProService {
  constructor(
    private prisma: PrismaService,
    private imageService: ImageService,
  ) {}

  // ─── Profile Images ──────────────────────────────────────────────────────

  async uploadImage(
    userId: string,
    file: Express.Multer.File,
    options: ImageProcessOptions = {},
  ) {
    const profile = await this.getProfileByUserId(userId);

    // Check image count (max 10)
    const count = await this.prisma.proProfileImage.count({
      where: { proProfileId: profile.id },
    });
    if (count >= 10) {
      throw new BadRequestException('이미지는 최대 10장까지 등록할 수 있습니다.');
    }

    // Minimum 4 images for profile completion — checked at submission, not upload
    // requireFace = true for profile images
    const processed = await this.imageService.processImage(file, {
      ...options,
      requireFace: true,
      maxWidth: 1200,
      maxHeight: 1200,
      quality: 85,
    });

    const image = await this.prisma.proProfileImage.create({
      data: {
        proProfileId: profile.id,
        imageUrl: processed.path,
        originalUrl: `/uploads/${processed.originalFilename}`,
        displayOrder: count,
        hasFace: processed.hasFace,
        isPrimary: count === 0, // first image is primary
      },
    });

    return image;
  }

  async getImages(userId: string) {
    const profile = await this.getProfileByUserId(userId);
    return this.prisma.proProfileImage.findMany({
      where: { proProfileId: profile.id },
      orderBy: { displayOrder: 'asc' },
    });
  }

  async deleteImage(userId: string, imageId: string) {
    const profile = await this.getProfileByUserId(userId);
    const image = await this.prisma.proProfileImage.findFirst({
      where: { id: imageId, proProfileId: profile.id },
    });
    if (!image) throw new NotFoundException('이미지를 찾을 수 없습니다.');

    // Delete files from disk
    const filename = image.imageUrl.split('/').pop();
    if (filename) await this.imageService.deleteFile(filename);
    if (image.originalUrl) {
      const origFilename = image.originalUrl.split('/').pop();
      if (origFilename) await this.imageService.deleteFile(origFilename);
    }

    await this.prisma.proProfileImage.delete({ where: { id: imageId } });

    // Re-assign primary if needed
    if (image.isPrimary) {
      const first = await this.prisma.proProfileImage.findFirst({
        where: { proProfileId: profile.id },
        orderBy: { displayOrder: 'asc' },
      });
      if (first) {
        await this.prisma.proProfileImage.update({
          where: { id: first.id },
          data: { isPrimary: true },
        });
      }
    }
  }

  async reorderImages(userId: string, imageIds: string[]) {
    const profile = await this.getProfileByUserId(userId);

    await this.prisma.$transaction(
      imageIds.map((id, index) =>
        this.prisma.proProfileImage.updateMany({
          where: { id, proProfileId: profile.id },
          data: {
            displayOrder: index,
            isPrimary: index === 0,
          },
        }),
      ),
    );

    return this.getImages(userId);
  }

  async adjustImage(
    userId: string,
    imageId: string,
    options: Pick<ImageProcessOptions, 'brightness' | 'contrast' | 'saturation' | 'sharpen' | 'cropX' | 'cropY' | 'cropWidth' | 'cropHeight'>,
  ) {
    const profile = await this.getProfileByUserId(userId);
    const image = await this.prisma.proProfileImage.findFirst({
      where: { id: imageId, proProfileId: profile.id },
    });
    if (!image) throw new NotFoundException('이미지를 찾을 수 없습니다.');

    // Get original file for re-processing
    const origFilename = image.originalUrl?.split('/').pop();
    if (!origFilename) throw new BadRequestException('원본 이미지를 찾을 수 없습니다.');

    const processed = await this.imageService.adjustImage(origFilename, options);

    // Delete old webp
    const oldFilename = image.imageUrl.split('/').pop();
    if (oldFilename && oldFilename !== processed.filename) {
      await this.imageService.deleteFile(oldFilename);
    }

    return this.prisma.proProfileImage.update({
      where: { id: imageId },
      data: {
        imageUrl: processed.path,
        hasFace: processed.hasFace,
      },
    });
  }

  // ─── Schedule ────────────────────────────────────────────────────────────

  async getSchedule(userId: string, month: string) {
    const profile = await this.getProfileByUserId(userId);

    // Parse YYYY-MM to date range
    const [year, mon] = month.split('-').map(Number);
    const startDate = new Date(year, mon - 1, 1);
    const endDate = new Date(year, mon, 0); // last day of month

    const schedules = await this.prisma.proSchedule.findMany({
      where: {
        proProfileId: profile.id,
        date: { gte: startDate, lte: endDate },
      },
      orderBy: { date: 'asc' },
    });

    return schedules.map((s) => {
      let eventTitle: string | null = null;
      let eventLocation: string | null = null;
      if (s.note) {
        try {
          const parsed = JSON.parse(s.note);
          eventTitle = parsed.eventTitle ?? null;
          eventLocation = parsed.eventLocation ?? null;
        } catch {
          // note is plain text, treat as eventTitle
          eventTitle = s.note;
        }
      }
      return {
        date: s.date.toISOString().split('T')[0],
        status: s.status,
        eventTitle,
        eventLocation,
      };
    });
  }

  async updateScheduleDate(
    userId: string,
    date: string,
    data: { status: 'available' | 'unavailable' | 'booked'; eventTitle?: string; eventLocation?: string },
  ) {
    const profile = await this.getProfileByUserId(userId);
    const dateObj = new Date(date + 'T00:00:00Z');

    const note =
      data.eventTitle || data.eventLocation
        ? JSON.stringify({ eventTitle: data.eventTitle ?? null, eventLocation: data.eventLocation ?? null })
        : null;

    const schedule = await this.prisma.proSchedule.upsert({
      where: {
        proProfileId_date: {
          proProfileId: profile.id,
          date: dateObj,
        },
      },
      update: {
        status: data.status,
        note,
      },
      create: {
        proProfileId: profile.id,
        date: dateObj,
        status: data.status,
        note,
        source: 'manual',
      },
    });

    return schedule;
  }

  async getBookedDates(proProfileId: string) {
    const schedules = await this.prisma.proSchedule.findMany({
      where: {
        proProfileId,
        status: 'booked',
      },
      orderBy: { date: 'asc' },
    });

    return schedules.map((s) => s.date.toISOString().split('T')[0]);
  }

  // ─── Revenue ──────────────────────────────────────────────────────────────

  async getRevenue(userId: string) {
    const profile = await this.getProfileByUserId(userId);
    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const [thisMonthPayments, lastMonthPayments, profileData] = await Promise.all([
      this.prisma.payment.findMany({
        where: {
          proProfileId: profile.id,
          status: 'completed',
          createdAt: { gte: thisMonthStart },
        },
        select: { amount: true },
      }),
      this.prisma.payment.findMany({
        where: {
          proProfileId: profile.id,
          status: 'completed',
          createdAt: { gte: lastMonthStart, lt: thisMonthStart },
        },
        select: { amount: true },
      }),
      this.prisma.proProfile.findUnique({
        where: { id: profile.id },
        select: { profileViews: true, avgRating: true, reviewCount: true },
      }),
    ]);

    const thisMonth = thisMonthPayments.reduce((s, p) => s + (p.amount || 0), 0);
    const lastMonth = lastMonthPayments.reduce((s, p) => s + (p.amount || 0), 0);

    return {
      thisMonth,
      lastMonth,
      profileViews: profileData?.profileViews || 0,
      avgRating: profileData?.avgRating || 0,
      reviewCount: profileData?.reviewCount || 0,
    };
  }

  async incrementProfileView(proProfileId: string) {
    await this.prisma.proProfile.update({
      where: { id: proProfileId },
      data: { profileViews: { increment: 1 } },
    });
    return { ok: true };
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  private async getProfileByUserId(userId: string) {
    const profile = await this.prisma.proProfile.findUnique({
      where: { userId },
    });
    if (!profile) {
      // Auto-create draft profile
      return this.prisma.proProfile.create({
        data: { userId },
      });
    }
    return profile;
  }
}

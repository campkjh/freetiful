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

  // ─── Profile (My) ────────────────────────────────────────────────────────

  async getProfile(userId: string) {
    let profile = await this.prisma.proProfile.findUnique({
      where: { userId },
      include: {
        images: { orderBy: { displayOrder: 'asc' } },
        services: { orderBy: { displayOrder: 'asc' } },
        faqs: { orderBy: { displayOrder: 'asc' } },
        categories: { include: { category: true } },
      },
    });

    if (!profile) {
      await this.prisma.proProfile.create({
        data: { userId, status: 'draft' },
      });
      profile = await this.prisma.proProfile.findUnique({
        where: { userId },
        include: {
          images: { orderBy: { displayOrder: 'asc' } },
          services: { orderBy: { displayOrder: 'asc' } },
          faqs: { orderBy: { displayOrder: 'asc' } },
          categories: { include: { category: true } },
        },
      });
    }

    return profile;
  }

  async createProfile(userId: string) {
    const existing = await this.prisma.proProfile.findUnique({ where: { userId } });
    if (existing) return existing;
    return this.prisma.proProfile.create({
      data: { userId, status: 'draft' },
    });
  }

  async updateProfile(
    userId: string,
    data: {
      shortIntro?: string;
      mainExperience?: string;
      careerYears?: number;
      awards?: string;
      detailHtml?: string;
      youtubeUrl?: string;
      gender?: string;
      isNationwide?: boolean;
    },
  ) {
    const existing = await this.prisma.proProfile.findUnique({ where: { userId } });

    const fields = {
      ...(data.shortIntro !== undefined ? { shortIntro: data.shortIntro } : {}),
      ...(data.mainExperience !== undefined ? { mainExperience: data.mainExperience } : {}),
      ...(data.careerYears !== undefined ? { careerYears: data.careerYears } : {}),
      ...(data.awards !== undefined ? { awards: data.awards } : {}),
      ...(data.detailHtml !== undefined ? { detailHtml: data.detailHtml } : {}),
      ...(data.youtubeUrl !== undefined ? { youtubeUrl: data.youtubeUrl } : {}),
      ...(data.gender !== undefined ? { gender: data.gender } : {}),
      ...(data.isNationwide !== undefined ? { isNationwide: data.isNationwide } : {}),
    };

    if (!existing) {
      return this.prisma.proProfile.create({
        data: { userId, status: 'draft', ...fields },
      });
    }

    return this.prisma.proProfile.update({
      where: { userId },
      data: fields,
    });
  }

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

  // ─── Helpers ─────────────────────────────────────────────────────────────

  // ─── Registration Submission ─────────────────────────────────────────────

  async submitRegistration(
    userId: string,
    data: {
      name?: string;
      phone?: string;
      gender?: string;
      shortIntro?: string;
      mainExperience?: string;
      careerYears?: number;
      awards?: string;
      youtubeUrl?: string;
      detailHtml?: string;
      photos?: string[]; // base64 data URLs
      mainPhotoIndex?: number;
      services?: { title: string; description?: string; basePrice?: number }[];
      faqs?: { question: string; answer: string }[];
      languages?: string[];
    },
  ) {
    if (data.name || data.phone) {
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          ...(data.name ? { name: data.name } : {}),
          ...(data.phone ? { phone: data.phone } : {}),
        },
      });
    }

    const fields = {
      ...(data.gender !== undefined ? { gender: data.gender } : {}),
      ...(data.shortIntro !== undefined ? { shortIntro: data.shortIntro } : {}),
      ...(data.mainExperience !== undefined ? { mainExperience: data.mainExperience } : {}),
      ...(data.careerYears !== undefined ? { careerYears: data.careerYears } : {}),
      ...(data.awards !== undefined ? { awards: data.awards } : {}),
      ...(data.youtubeUrl !== undefined ? { youtubeUrl: data.youtubeUrl } : {}),
      ...(data.detailHtml !== undefined ? { detailHtml: data.detailHtml } : {}),
    };

    const profile = await this.prisma.proProfile.upsert({
      where: { userId },
      create: { userId, status: 'pending', ...fields },
      update: { status: 'pending', ...fields },
    });

    // Photos: base64 data URL → webp on disk → ProProfileImage 재생성
    if (Array.isArray(data.photos) && data.photos.length > 0) {
      const mainIdx = Math.max(0, Math.min(data.mainPhotoIndex ?? 0, data.photos.length - 1));
      const savedImages: { path: string; originalPath: string; index: number }[] = [];
      const failures: { index: number; error: string }[] = [];

      for (let i = 0; i < data.photos.length; i++) {
        try {
          const processed = await this.savePhotoFromDataUrl(data.photos[i]);
          if (processed) savedImages.push({ ...processed, index: i });
          else failures.push({ index: i, error: 'invalid data URL' });
        } catch (e: any) {
          failures.push({ index: i, error: e?.message || String(e) });
        }
      }

      // 모든 사진 실패 시 에러로 터뜨려 프론트가 알림 표시
      if (savedImages.length === 0) {
        throw new BadRequestException(
          `사진 업로드 실패 (${failures.length}장): ${failures.map((f) => f.error).join('; ')}`,
        );
      }

      // 성공한 사진만 있을 때 기존 이미지 교체
      await this.prisma.proProfileImage.deleteMany({ where: { proProfileId: profile.id } });
      for (const img of savedImages) {
        await this.prisma.proProfileImage.create({
          data: {
            proProfileId: profile.id,
            imageUrl: img.path,
            originalUrl: img.originalPath,
            displayOrder: img.index,
            isPrimary: img.index === mainIdx,
            hasFace: true,
          },
        });
      }
    }

    // Services: replace all
    if (Array.isArray(data.services)) {
      await this.prisma.proService.deleteMany({ where: { proProfileId: profile.id } });
      for (let i = 0; i < data.services.length; i++) {
        const s = data.services[i];
        if (!s?.title) continue;
        await this.prisma.proService.create({
          data: {
            proProfileId: profile.id,
            title: s.title,
            description: s.description ?? null,
            basePrice: s.basePrice ?? null,
            displayOrder: i,
            isActive: true,
          },
        });
      }
    }

    // FAQs: replace all
    if (Array.isArray(data.faqs)) {
      await this.prisma.proFaq.deleteMany({ where: { proProfileId: profile.id } });
      for (let i = 0; i < data.faqs.length; i++) {
        const f = data.faqs[i];
        if (!f?.question || !f?.answer) continue;
        await this.prisma.proFaq.create({
          data: {
            proProfileId: profile.id,
            question: f.question,
            answer: f.answer,
            displayOrder: i,
          },
        });
      }
    }

    // Languages: replace all
    if (Array.isArray(data.languages)) {
      await this.prisma.proLanguage.deleteMany({ where: { proProfileId: profile.id } });
      for (const code of data.languages) {
        if (!code) continue;
        try {
          await this.prisma.proLanguage.create({
            data: { proProfileId: profile.id, languageCode: code },
          });
        } catch {
          // unique conflict skip
        }
      }
    }

    return profile;
  }

  private async savePhotoFromDataUrl(dataUrl: string): Promise<{ path: string; originalPath: string } | null> {
    const match = dataUrl.match(/^data:(image\/(jpeg|jpg|png|webp|heic|heif));base64,(.+)$/i);
    if (!match) {
      // 이미 URL이면 그대로 보존
      if (/^https?:\/\//.test(dataUrl) || dataUrl.startsWith('/uploads/')) {
        return { path: dataUrl, originalPath: dataUrl };
      }
      return null;
    }
    const mime = match[1].toLowerCase() === 'image/jpg' ? 'image/jpeg' : match[1].toLowerCase();
    const buffer = Buffer.from(match[3], 'base64');
    const fakeFile: Express.Multer.File = {
      fieldname: 'file',
      originalname: `upload.${match[2]}`,
      encoding: '7bit',
      mimetype: mime,
      size: buffer.length,
      buffer,
      destination: '',
      filename: '',
      path: '',
      stream: null as any,
    };
    const processed = await this.imageService.processImage(fakeFile, {
      requireFace: false,
      maxWidth: 1200,
      maxHeight: 1200,
      quality: 85,
    });
    return { path: processed.path, originalPath: `/uploads/${processed.originalFilename}` };
  }

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

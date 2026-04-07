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

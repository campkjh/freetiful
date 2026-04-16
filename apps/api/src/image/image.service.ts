import { Injectable, BadRequestException } from '@nestjs/common';
import * as sharp from 'sharp';
import * as path from 'path';
import * as fs from 'fs/promises';
import { randomUUID } from 'crypto';
import { put as blobPut, del as blobDel } from '@vercel/blob';

export interface ProcessedImage {
  filename: string;
  originalFilename: string;
  path: string;
  originalPath: string;
  webpPath: string;
  width: number;
  height: number;
  size: number;
  hasFace: boolean;
  mimeType: string;
}

export interface ImageProcessOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  requireFace?: boolean;
  brightness?: number;    // -1 to 1
  contrast?: number;      // -1 to 1
  saturation?: number;    // -1 to 1
  sharpen?: boolean;
  cropX?: number;
  cropY?: number;
  cropWidth?: number;
  cropHeight?: number;
}

@Injectable()
export class ImageService {
  private readonly uploadDir = path.join(process.cwd(), 'uploads');
  private readonly publicPath = '/uploads';

  // Vercel Blob (영구 저장소) — BLOB_READ_WRITE_TOKEN 있으면 Blob 사용, 없으면 로컬 디스크 (개발용)
  private readonly blobToken = process.env.BLOB_READ_WRITE_TOKEN || '';
  private readonly useBlob = !!this.blobToken;

  // 업로드한 URL 을 filename → fullUrl 로 매핑 (삭제 시 사용)
  private readonly urlByKey = new Map<string, string>();

  async onModuleInit() {
    if (!this.useBlob) {
      await fs.mkdir(this.uploadDir, { recursive: true });
    }
  }

  private async uploadFile(key: string, buffer: Buffer, contentType: string): Promise<string> {
    if (this.useBlob) {
      const result = await blobPut(key, buffer, {
        access: 'public',
        token: this.blobToken,
        contentType,
        addRandomSuffix: false,
        allowOverwrite: true,
      });
      this.urlByKey.set(key, result.url);
      return result.url;
    }
    await fs.writeFile(path.join(this.uploadDir, key), buffer);
    return `${this.publicPath}/${key}`;
  }

  private async deleteFileByKey(key: string): Promise<void> {
    if (this.useBlob) {
      const url = this.urlByKey.get(key);
      if (!url) return; // URL 을 모르면 삭제 스킵
      try {
        await blobDel(url, { token: this.blobToken });
        this.urlByKey.delete(key);
      } catch {
        // ignore
      }
    } else {
      try {
        await fs.unlink(path.join(this.uploadDir, key));
      } catch {
        // ignore
      }
    }
  }

  /**
   * Process, validate, and convert an uploaded image
   * - WebP conversion
   * - Face detection (basic skin/face region heuristic)
   * - Brightness/contrast/saturation adjustment
   * - Cropping
   * - Resizing
   */
  async processImage(
    file: Express.Multer.File,
    options: ImageProcessOptions = {},
  ): Promise<ProcessedImage> {
    const {
      maxWidth = 1200,
      maxHeight = 1200,
      quality = 85,
      requireFace = false,
      brightness = 0,
      contrast = 0,
      saturation = 0,
      sharpen = false,
      cropX,
      cropY,
      cropWidth,
      cropHeight,
    } = options;

    // Validate file type
    const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
    if (!allowedMimes.includes(file.mimetype)) {
      throw new BadRequestException('지원하지 않는 이미지 형식입니다. (JPG, PNG, WebP, HEIC만 가능)');
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      throw new BadRequestException('파일 크기는 10MB를 초과할 수 없습니다.');
    }

    let pipeline = sharp(file.buffer);
    const metadata = await pipeline.metadata();

    // ─── Crop ──────────────────────────────────────────────────────────
    if (cropX !== undefined && cropY !== undefined && cropWidth && cropHeight) {
      pipeline = pipeline.extract({
        left: Math.round(cropX),
        top: Math.round(cropY),
        width: Math.round(cropWidth),
        height: Math.round(cropHeight),
      });
    }

    // ─── Resize ────────────────────────────────────────────────────────
    pipeline = pipeline.resize(maxWidth, maxHeight, {
      fit: 'inside',
      withoutEnlargement: true,
    });

    // ─── Color adjustments ─────────────────────────────────────────────
    if (brightness !== 0 || contrast !== 0 || saturation !== 0) {
      // Sharp uses linear for brightness/contrast: a*pixel + b
      // brightness: positive = brighter, contrast: positive = more contrast
      const a = 1 + contrast;                    // multiplier
      const b = Math.round(brightness * 128);    // offset
      pipeline = pipeline.linear(a, b);

      if (saturation !== 0) {
        pipeline = pipeline.modulate({
          saturation: 1 + saturation,
        });
      }
    }

    // ─── Sharpen ───────────────────────────────────────────────────────
    if (sharpen) {
      pipeline = pipeline.sharpen({ sigma: 1.2 });
    }

    // ─── Face Detection (heuristic-based using edge & region analysis) ─
    const hasFace = await this.detectFace(file.buffer);

    if (requireFace && !hasFace) {
      throw new BadRequestException(
        '얼굴이 인식되지 않습니다. 얼굴이 잘 보이는 사진을 올려주세요.',
      );
    }

    // ─── Convert to WebP ───────────────────────────────────────────────
    const id = randomUUID();
    const webpFilename = `${id}.webp`;
    const originalFilename = `${id}_original${path.extname(file.originalname)}`;

    const webpBuffer = await pipeline
      .webp({ quality, effort: 4 })
      .toBuffer();

    // Vercel Blob 또는 로컬 디스크에 저장 — URL 반환
    const publicUrl = await this.uploadFile(webpFilename, webpBuffer, 'image/webp');
    const originalUrl = await this.uploadFile(originalFilename, file.buffer, file.mimetype);

    const webpMeta = await sharp(webpBuffer).metadata();

    return {
      filename: webpFilename,
      originalFilename,
      path: publicUrl,
      originalPath: originalUrl,
      webpPath: publicUrl,
      width: webpMeta.width || 0,
      height: webpMeta.height || 0,
      size: webpBuffer.length,
      hasFace,
      mimeType: 'image/webp',
    };
  }

  /**
   * Face detection using Sharp's built-in image analysis
   * Uses skin color detection + edge density in center region
   * This is a lightweight heuristic — for production, integrate
   * a proper face API (e.g., AWS Rekognition, Google Vision, face-api.js)
   */
  private async detectFace(buffer: Buffer): Promise<boolean> {
    try {
      const image = sharp(buffer);
      const metadata = await image.metadata();
      const w = metadata.width || 0;
      const h = metadata.height || 0;

      if (w === 0 || h === 0) return false;

      // Extract center region (where faces usually are)
      const regionW = Math.round(w * 0.6);
      const regionH = Math.round(h * 0.6);
      const regionX = Math.round((w - regionW) / 2);
      const regionY = Math.round((h - regionH) * 0.3); // bias toward top

      const centerRegion = await sharp(buffer)
        .extract({
          left: regionX,
          top: regionY,
          width: regionW,
          height: regionH,
        })
        .resize(100, 100, { fit: 'cover' })
        .raw()
        .toBuffer();

      // Analyze skin-tone pixels in the center region
      // Skin color heuristic: R > 60, G > 40, B > 20, R > G, R > B
      let skinPixels = 0;
      const totalPixels = 100 * 100;

      for (let i = 0; i < centerRegion.length; i += 3) {
        const r = centerRegion[i];
        const g = centerRegion[i + 1];
        const b = centerRegion[i + 2];

        if (
          r > 60 && g > 40 && b > 20 &&
          r > g && r > b &&
          Math.abs(r - g) > 15 &&
          r - b > 15
        ) {
          skinPixels++;
        }
      }

      const skinRatio = skinPixels / totalPixels;

      // Also check edge density (faces have specific edge patterns)
      const edgeBuffer = await sharp(buffer)
        .extract({ left: regionX, top: regionY, width: regionW, height: regionH })
        .resize(50, 50, { fit: 'cover' })
        .greyscale()
        .convolve({
          width: 3,
          height: 3,
          kernel: [-1, -1, -1, -1, 8, -1, -1, -1, -1],
        })
        .raw()
        .toBuffer();

      let edgeCount = 0;
      for (let i = 0; i < edgeBuffer.length; i++) {
        if (edgeBuffer[i] > 30) edgeCount++;
      }
      const edgeRatio = edgeCount / edgeBuffer.length;

      // Face = decent skin ratio + moderate edges (not too smooth, not too busy)
      return skinRatio > 0.08 && edgeRatio > 0.05 && edgeRatio < 0.7;
    } catch {
      // If detection fails, be permissive
      return true;
    }
  }

  /**
   * Delete an image file from disk
   */
  async deleteFile(filename: string): Promise<void> {
    await this.deleteFileByKey(filename);
  }

  /**
   * Reprocess an existing image with new adjustments
   */
  async adjustImage(
    filename: string,
    options: Pick<ImageProcessOptions, 'brightness' | 'contrast' | 'saturation' | 'sharpen' | 'cropX' | 'cropY' | 'cropWidth' | 'cropHeight'>,
  ): Promise<ProcessedImage> {
    const originalPath = path.join(this.uploadDir, filename);
    const buffer = await fs.readFile(originalPath);

    const fakeFile: Express.Multer.File = {
      buffer,
      originalname: filename,
      mimetype: 'image/webp',
      size: buffer.length,
    } as any;

    // Delete old webp
    await this.deleteFile(filename);

    return this.processImage(fakeFile, { ...options, requireFace: false });
  }
}

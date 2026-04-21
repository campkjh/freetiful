import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import * as sharp from 'sharp';
import * as path from 'path';
import * as fs from 'fs/promises';
import { randomUUID } from 'crypto';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { PrismaService } from '../prisma/prisma.service';

export interface ProcessedImage {
  filename: string;
  originalFilename: string;
  path: string;
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
  private readonly logger = new Logger(ImageService.name);
  private readonly uploadDir = path.join(process.cwd(), 'uploads');
  private readonly publicPath = '/uploads';
  // Supabase Storage 설정 — env 있으면 파일시스템 대신 클라우드 스토리지 사용
  private readonly supabase: SupabaseClient | null;
  private readonly bucket = process.env.SUPABASE_STORAGE_BUCKET || 'uploads';

  constructor(private prisma: PrismaService) {
    const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (url && key) {
      this.supabase = createClient(url, key, { auth: { persistSession: false } });
      this.logger.log(`Supabase Storage enabled — bucket "${this.bucket}"`);
    } else {
      this.supabase = null;
      this.logger.log('Using DB-backed storage (uploaded_files table) for persistent uploads');
    }
  }

  /** DB (Postgres bytea) 에 파일 저장 후 공개 URL 경로 반환 */
  private async saveToDb(buffer: Buffer, mimeType: string): Promise<string> {
    const record = await this.prisma.uploadedFile.create({
      data: {
        mimeType,
        data: buffer,
        size: buffer.length,
      },
      select: { id: true },
    });
    return `/uploads/${record.id}`;
  }

  async onModuleInit() {
    // 로컬 폴백용 폴더는 항상 준비 (Supabase 연결 실패 시)
    await fs.mkdir(this.uploadDir, { recursive: true }).catch(() => {});

    // Supabase 연결돼 있으면 버킷 자동 생성 시도 (없으면 만들고, 있으면 스킵)
    if (this.supabase) {
      try {
        const { data: list } = await this.supabase.storage.listBuckets();
        const exists = (list || []).some((b: any) => b.name === this.bucket);
        if (!exists) {
          const { error } = await this.supabase.storage.createBucket(this.bucket, {
            public: true,
            fileSizeLimit: 10 * 1024 * 1024,
          });
          if (error) {
            this.logger.warn(`Bucket "${this.bucket}" 생성 실패: ${error.message}`);
          } else {
            this.logger.log(`Bucket "${this.bucket}" 자동 생성됨 (public)`);
          }
        } else {
          this.logger.log(`Bucket "${this.bucket}" 사용 가능`);
        }
      } catch (e: any) {
        this.logger.warn(`Supabase bucket init 실패: ${e?.message || e}`);
      }
    }
  }

  /** 버퍼를 Supabase Storage 에 업로드하고 공개 URL 반환. 실패 시 null. */
  private async uploadToSupabase(filename: string, buffer: Buffer, contentType: string): Promise<string | null> {
    if (!this.supabase) return null;
    try {
      const { error } = await this.supabase.storage.from(this.bucket).upload(filename, buffer, {
        contentType,
        upsert: true,
        cacheControl: '31536000',
      });
      if (error) {
        this.logger.warn(`Supabase upload failed: ${error.message}`);
        return null;
      }
      const { data } = this.supabase.storage.from(this.bucket).getPublicUrl(filename);
      return data.publicUrl;
    } catch (e: any) {
      this.logger.warn(`Supabase upload exception: ${e?.message || e}`);
      return null;
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

    // .rotate() 를 먼저 호출해 EXIF Orientation 을 읽어 픽셀 데이터를 실제로 회전시키고
    // EXIF 방향 태그를 제거한다. 이게 없으면 iPhone 세로 사진이 가로로 눕힌 상태로
    // WebP 변환돼 브라우저에서 회전된 것처럼 보임.
    let pipeline = sharp(file.buffer).rotate();
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

    // 우선순위: Supabase Storage → DB (bytea, 항상 동작) → 로컬 디스크(레거시)
    let publicWebpUrl: string | null = null;
    let publicOrigUrl: string | null = null;

    if (this.supabase) {
      publicWebpUrl = await this.uploadToSupabase(webpFilename, webpBuffer, 'image/webp');
      publicOrigUrl = await this.uploadToSupabase(originalFilename, file.buffer, file.mimetype);
    }

    if (!publicWebpUrl) {
      // DB 저장 — Railway Postgres 는 영구이므로 파일 유실 없음
      try {
        publicWebpUrl = await this.saveToDb(webpBuffer, 'image/webp');
        publicOrigUrl = publicOrigUrl || (await this.saveToDb(file.buffer, file.mimetype).catch(() => null));
      } catch (e: any) {
        this.logger.warn(`DB save failed, falling back to filesystem: ${e?.message || e}`);
      }
    }

    if (!publicWebpUrl) {
      // 마지막 폴백: 로컬 디스크 (개발환경용 — 프로덕션에선 Railway 재배포 시 유실됨)
      const webpPath = path.join(this.uploadDir, webpFilename);
      const origPath = path.join(this.uploadDir, originalFilename);
      await fs.writeFile(webpPath, webpBuffer).catch(() => {});
      await fs.writeFile(origPath, file.buffer).catch(() => {});
      publicWebpUrl = `${this.publicPath}/${webpFilename}`;
      publicOrigUrl = publicOrigUrl || `${this.publicPath}/${originalFilename}`;
    }

    const webpMeta = await sharp(webpBuffer).metadata();

    return {
      filename: webpFilename,
      originalFilename,
      path: publicWebpUrl,
      webpPath: publicWebpUrl,
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
    // Supabase 쪽 먼저 삭제 시도
    if (this.supabase) {
      try {
        await this.supabase.storage.from(this.bucket).remove([filename]);
      } catch {
        // ignore
      }
    }
    // 로컬 폴백 파일도 삭제
    const filePath = path.join(this.uploadDir, filename);
    try {
      await fs.unlink(filePath);
    } catch {
      // File might not exist, ignore
    }
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

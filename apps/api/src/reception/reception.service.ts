import { BadRequestException, ConflictException, ForbiddenException, HttpException, HttpStatus, Injectable, Logger, NotFoundException } from '@nestjs/common';
import * as sharp from 'sharp';
import { PrismaService } from '../prisma/prisma.service';
import { ImageService } from '../image/image.service';
import {
  PHOTO_MAX_BYTES,
  PHOTO_MIMES,
  ReceptionEventKey,
  ReceptionVoteKind,
  UPLOAD_PER_HOUR,
  VOTE_LIMIT,
  cleanName,
  compareRank,
  parseSurvey,
} from './reception.rules';

export interface ReceptionPhotoView {
  id: string;
  name: string;
  imageUrl: string;
  thumbUrl: string;
  width: number;
  height: number;
  likes: number;
  empathies: number;
  createdAt: string;
  /** 1부터 — 공감 순위 */
  rank: number;
  mine: boolean;
  liked: boolean;
  empathized: boolean;
}

export interface ReceptionFeed {
  photos: ReceptionPhotoView[];
  me: { likesLeft: number; empathiesLeft: number; myPhotoId: string | null; limit: number };
}

interface FeedRow {
  id: string;
  deviceId: string;
  name: string;
  imageUrl: string;
  thumbUrl: string;
  width: number;
  height: number;
  createdAt: Date;
  likes: number;
  empathies: number;
  rank: number;
}

/** 목록 공용 부분(사진+수) 묶어 두는 시간 — 행사장 손님 수십~백여 명이 몇 초마다 새로 받아도 DB 를 덜 두드리게 */
const FEED_CACHE_MS = 2500;

/**
 * 송년회 이벤트 사진·좋아요/공감·설문(261108) — 규칙은 reception.rules.ts.
 * 좋아요·공감 상한과 '한 기기 사진 1장'은 기기별 트랜잭션 잠금(advisory xact lock) 안에서 세고 넣는다(동시에 눌러도 넘치지 않게).
 */
@Injectable()
export class ReceptionService {
  private readonly logger = new Logger(ReceptionService.name);
  private readonly feedCache = new Map<string, { at: number; rows: FeedRow[] }>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly images: ImageService,
  ) {}

  private async feedRows(eventKey: ReceptionEventKey): Promise<FeedRow[]> {
    const hit = this.feedCache.get(eventKey);
    if (hit && Date.now() - hit.at < FEED_CACHE_MS) return hit.rows;
    const [photos, counts] = await Promise.all([
      this.prisma.receptionPhoto.findMany({
        where: { eventKey, deletedAt: null },
        orderBy: { createdAt: 'desc' },
        select: { id: true, deviceId: true, name: true, imageUrl: true, thumbUrl: true, width: true, height: true, createdAt: true },
      }),
      this.prisma.receptionVote.groupBy({ by: ['photoId', 'kind'], where: { eventKey }, _count: { _all: true } }),
    ]);
    const tally = new Map<string, { likes: number; empathies: number }>();
    for (const c of counts) {
      const t = tally.get(c.photoId) || { likes: 0, empathies: 0 };
      if (c.kind === 'like') t.likes = c._count._all;
      else if (c.kind === 'empathy') t.empathies = c._count._all;
      tally.set(c.photoId, t);
    }
    const rows = photos.map((p) => ({ ...p, likes: tally.get(p.id)?.likes || 0, empathies: tally.get(p.id)?.empathies || 0, rank: 0 }));
    [...rows].sort(compareRank).forEach((r, i) => { r.rank = i + 1; });
    this.feedCache.set(eventKey, { at: Date.now(), rows });
    return rows;
  }

  private dropCache(eventKey: string) {
    this.feedCache.delete(eventKey);
  }

  async feed(eventKey: ReceptionEventKey, deviceId: string | null): Promise<ReceptionFeed> {
    const [rows, myVotes] = await Promise.all([
      this.feedRows(eventKey),
      deviceId
        ? this.prisma.receptionVote.findMany({ where: { eventKey, voterDeviceId: deviceId }, select: { photoId: true, kind: true } })
        : Promise.resolve([] as Array<{ photoId: string; kind: string }>),
    ]);
    const liked = new Set(myVotes.filter((v) => v.kind === 'like').map((v) => v.photoId));
    const empathized = new Set(myVotes.filter((v) => v.kind === 'empathy').map((v) => v.photoId));
    const mine = deviceId ? rows.find((r) => r.deviceId === deviceId) : undefined;
    return {
      photos: rows.map((r) => ({
        id: r.id,
        name: r.name,
        imageUrl: r.imageUrl,
        thumbUrl: r.thumbUrl,
        width: r.width,
        height: r.height,
        likes: r.likes,
        empathies: r.empathies,
        createdAt: r.createdAt.toISOString(),
        rank: r.rank,
        mine: !!deviceId && r.deviceId === deviceId,
        liked: liked.has(r.id),
        empathized: empathized.has(r.id),
      })),
      me: {
        likesLeft: Math.max(0, VOTE_LIMIT - liked.size),
        empathiesLeft: Math.max(0, VOTE_LIMIT - empathized.size),
        myPhotoId: mine?.id ?? null,
        limit: VOTE_LIMIT,
      },
    };
  }

  async upload(eventKey: ReceptionEventKey, deviceId: string, rawName: unknown, file?: Express.Multer.File): Promise<ReceptionFeed> {
    const name = cleanName(rawName);
    if (!name) throw new BadRequestException('이름을 먼저 입력해 주세요.');
    if (!file?.buffer?.length) throw new BadRequestException('사진을 골라 주세요.');
    if (!PHOTO_MIMES.includes(file.mimetype)) throw new BadRequestException('JPG · PNG · WebP · HEIC 사진만 올릴 수 있어요.');
    if (file.size > PHOTO_MAX_BYTES) throw new BadRequestException('사진이 너무 커요(15MB까지).');

    const recent = await this.prisma.receptionPhoto.count({ where: { eventKey, deviceId, createdAt: { gt: new Date(Date.now() - 60 * 60 * 1000) } } });
    if (recent >= UPLOAD_PER_HOUR) throw new HttpException('사진을 너무 자주 바꾸고 있어요. 잠시 뒤에 다시 올려 주세요.', HttpStatus.TOO_MANY_REQUESTS);
    // 이미 올린 사진이 있으면 그림 변환 전에 막는다(최종 판정은 아래 잠금 안에서 한 번 더)
    if (await this.prisma.receptionPhoto.count({ where: { eventKey, deviceId, deletedAt: null } })) {
      throw new ConflictException('이미 올린 사진이 있어요. 지우고 다시 올려 주세요.');
    }

    let full: { data: Buffer; info: sharp.OutputInfo };
    let thumb: Buffer;
    try {
      // rotate() = EXIF 방향대로 픽셀을 돌려 둔다(아이폰 세로 사진이 눕지 않게)
      full = await sharp(file.buffer).rotate().resize(1440, 1440, { fit: 'inside', withoutEnlargement: true }).webp({ quality: 80 }).toBuffer({ resolveWithObject: true });
      // 목록 칸(3:4)에 맞춘 작은 그림 — 얼굴·눈에 띄는 쪽을 남기고 자른다
      thumb = await sharp(file.buffer).rotate().resize(480, 640, { fit: 'cover', position: sharp.strategy.attention }).webp({ quality: 72 }).toBuffer();
    } catch (e: any) {
      this.logger.warn(`reception photo decode failed: ${e?.message || e}`);
      throw new BadRequestException('이 사진은 열 수 없어요. 다른 사진으로 올려 주세요.');
    }
    const [imageUrl, thumbUrl] = await Promise.all([
      this.images.saveRawMedia(full.data, 'image/webp', 'reception.webp'),
      this.images.saveRawMedia(thumb, 'image/webp', 'reception-thumb.webp'),
    ]);

    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`rc-photo:${eventKey}:${deviceId}`}))`;
      const exists = await tx.receptionPhoto.count({ where: { eventKey, deviceId, deletedAt: null } });
      if (exists) throw new ConflictException('이미 올린 사진이 있어요. 지우고 다시 올려 주세요.');
      await tx.receptionPhoto.create({
        data: { eventKey, deviceId, name, imageUrl, thumbUrl, width: full.info.width, height: full.info.height },
      });
    });
    this.dropCache(eventKey);
    return this.feed(eventKey, deviceId);
  }

  /** 내 사진 지우기 — 받은 좋아요·공감도 같이 지워 누른 사람에게 돌려준다 */
  async remove(eventKey: ReceptionEventKey, deviceId: string, photoId: string): Promise<ReceptionFeed> {
    const photo = await this.prisma.receptionPhoto.findFirst({ where: { id: photoId, eventKey, deletedAt: null }, select: { deviceId: true } });
    if (!photo) throw new NotFoundException('사진을 찾을 수 없어요.');
    if (photo.deviceId !== deviceId) throw new ForbiddenException('내가 올린 사진만 지울 수 있어요.');
    await this.prisma.$transaction([
      this.prisma.receptionVote.deleteMany({ where: { photoId } }),
      this.prisma.receptionPhoto.update({ where: { id: photoId }, data: { deletedAt: new Date() } }),
    ]);
    this.dropCache(eventKey);
    return this.feed(eventKey, deviceId);
  }

  /** 좋아요·공감 누르기/거두기 — 종류별 한 사람 VOTE_LIMIT 개까지 */
  async vote(eventKey: ReceptionEventKey, deviceId: string, photoId: string, kind: ReceptionVoteKind, on: boolean): Promise<ReceptionFeed> {
    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`rc-vote:${eventKey}:${deviceId}`}))`;
      const photo = await tx.receptionPhoto.findFirst({ where: { id: photoId, eventKey, deletedAt: null }, select: { deviceId: true } });
      if (!photo) throw new NotFoundException('사진을 찾을 수 없어요.');
      if (!on) {
        await tx.receptionVote.deleteMany({ where: { photoId, voterDeviceId: deviceId, kind } });
        return;
      }
      if (photo.deviceId === deviceId) throw new BadRequestException('내 사진에는 누를 수 없어요.');
      const already = await tx.receptionVote.count({ where: { photoId, voterDeviceId: deviceId, kind } });
      if (already) return;
      const used = await tx.receptionVote.count({ where: { eventKey, voterDeviceId: deviceId, kind } });
      if (used >= VOTE_LIMIT) {
        throw new BadRequestException(`${kind === 'like' ? '좋아요' : '공감'}는 ${VOTE_LIMIT}개까지 누를 수 있어요. 다른 사진에서 거두면 다시 쓸 수 있어요.`);
      }
      await tx.receptionVote.create({ data: { eventKey, photoId, voterDeviceId: deviceId, kind } });
    });
    this.dropCache(eventKey);
    return this.feed(eventKey, deviceId);
  }

  async getSurvey(eventKey: ReceptionEventKey, deviceId: string) {
    const row = await this.prisma.receptionSurvey.findUnique({
      where: { eventKey_deviceId: { eventKey, deviceId } },
      select: { name: true, answers: true, updatedAt: true },
    });
    return { survey: row ? { name: row.name, answers: row.answers, updatedAt: row.updatedAt.toISOString() } : null };
  }

  async saveSurvey(eventKey: ReceptionEventKey, deviceId: string, rawName: unknown, rawAnswers: unknown) {
    const name = cleanName(rawName);
    if (!name) throw new BadRequestException('이름을 먼저 입력해 주세요.');
    const answers = parseSurvey(rawAnswers);
    if (typeof answers === 'string') throw new BadRequestException(answers);
    await this.prisma.receptionSurvey.upsert({
      where: { eventKey_deviceId: { eventKey, deviceId } },
      create: { eventKey, deviceId, name, answers: answers as any },
      update: { name, answers: answers as any },
    });
    return this.getSurvey(eventKey, deviceId);
  }
}

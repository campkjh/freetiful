import { BadRequestException, ConflictException, ForbiddenException, HttpException, HttpStatus, Injectable, Logger, NotFoundException } from '@nestjs/common';
import * as sharp from 'sharp';
import { PrismaService } from '../prisma/prisma.service';
import { ImageService } from '../image/image.service';
import {
  AFTER_PARTY_PICK_MSG,
  PHOTO_MAX_BYTES,
  PHOTO_MIMES,
  ReceptionEventKey,
  ReceptionVoteKind,
  UPLOAD_PER_HOUR,
  VOTE_LIMIT,
  cleanName,
  compareRank,
  isAfterParty,
  nameKey,
  parseSurvey,
  type AfterPartyAnswer,
  type SurveyAnswers,
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

  /**
   * 내 설문 + 2차 회식 참여(261122). afterParty 는 손님 표가 진실(설문 첫 질문에서 누르는 순간 저장 — 설문을 안 내도 있음),
   * 손님 표에 없으면 낸 설문 답의 것. 옛 손님 화면은 survey 만 읽는다(칸 추가만).
   */
  async getSurvey(eventKey: ReceptionEventKey, deviceId: string) {
    const [row, guest] = await Promise.all([
      this.prisma.receptionSurvey.findUnique({
        where: { eventKey_deviceId: { eventKey, deviceId } },
        select: { name: true, answers: true, updatedAt: true },
      }),
      this.guestAfterParty(eventKey, deviceId),
    ]);
    const fromGuest = guest?.afterParty;
    const fromSurvey = (row?.answers as Partial<SurveyAnswers> | null | undefined)?.afterParty;
    const afterParty: AfterPartyAnswer | null = isAfterParty(fromGuest) ? fromGuest : isAfterParty(fromSurvey) ? fromSurvey : null;
    return {
      survey: row ? { name: row.name, answers: row.answers, updatedAt: row.updatedAt.toISOString() } : null,
      afterParty,
      afterPartyAt: isAfterParty(fromGuest) && guest?.afterPartyAt ? guest.afterPartyAt.toISOString() : null,
    };
  }

  /**
   * 설문 내기 — 답에 2차 회식 참여가 있으면 손님 표 afterParty 도 같이 맞춘다(둘이 어긋나지 않게).
   * 옛 손님 화면(2차 칸 없음)으로 내면 먼저 눌러 둔 손님 표의 2차 답을 설문에도 넣어 둔다(설문에서 빠지지 않게).
   */
  async saveSurvey(eventKey: ReceptionEventKey, deviceId: string, rawName: unknown, rawAnswers: unknown) {
    const name = cleanName(rawName);
    if (!name) throw new BadRequestException('이름을 먼저 입력해 주세요.');
    const answers = parseSurvey(rawAnswers);
    if (typeof answers === 'string') throw new BadRequestException(answers);
    const guest = await this.guestAfterParty(eventKey, deviceId);
    const prev = guest?.afterParty;
    const stored: SurveyAnswers = !answers.afterParty && isAfterParty(prev) ? { afterParty: prev, ...answers } : answers;
    await this.prisma.receptionSurvey.upsert({
      where: { eventKey_deviceId: { eventKey, deviceId } },
      create: { eventKey, deviceId, name, answers: stored as any },
      update: { name, answers: stored as any },
    });
    if (answers.afterParty) await this.writeAfterParty(eventKey, deviceId, name, answers.afterParty, guest);
    return this.getSurvey(eventKey, deviceId);
  }

  /**
   * 2차 회식 참여(261122 사장 '예 버튼을 누르면 어드민 참여자 명단에 2차 참여 태그') — 설문 첫 질문에서 누르는 순간(설문 제출과 따로).
   * 손님 표에 남긴다(touchGuest 와 같은 규칙 — 기기 줄이 없으면 만들고 이름은 마지막 것으로). 이미 낸 설문이 있으면 그 답의 afterParty 도 고친다.
   */
  async setAfterParty(eventKey: ReceptionEventKey, deviceId: string, rawName: unknown, rawGoing: unknown) {
    const name = cleanName(rawName);
    if (!name) throw new BadRequestException('이름을 먼저 입력해 주세요.');
    if (!isAfterParty(rawGoing)) throw new BadRequestException(AFTER_PARTY_PICK_MSG);
    const saved = await this.writeAfterParty(eventKey, deviceId, name, rawGoing);
    await this.syncSurveyAfterParty(eventKey, deviceId, rawGoing);
    return saved;
  }

  /** 내 2차 회식 참여(안 골랐으면 null) */
  async getAfterParty(eventKey: ReceptionEventKey, deviceId: string) {
    const { afterParty, afterPartyAt } = await this.getSurvey(eventKey, deviceId);
    return { afterParty, afterPartyAt };
  }

  private guestAfterParty(eventKey: ReceptionEventKey, deviceId: string) {
    return this.prisma.receptionGuest.findUnique({
      where: { eventKey_deviceId: { eventKey, deviceId } },
      select: { afterParty: true, afterPartyAt: true },
    });
  }

  /**
   * 손님 표에 2차 참여 쓰기. afterPartyAt 은 답이 바뀔 때만 새 시각 — 같은 답을 다시 눌러도(설문 다시 내기 포함) 어드민 판 순서가 튀지 않게.
   * 계정(userId)은 건드리지 않는다. before = 미리 읽은 손님 표(undefined 면 여기서 읽음)
   */
  private async writeAfterParty(
    eventKey: ReceptionEventKey,
    deviceId: string,
    name: string,
    going: AfterPartyAnswer,
    before?: { afterParty: string | null; afterPartyAt: Date | null } | null,
  ) {
    const prev = before !== undefined ? before : await this.guestAfterParty(eventKey, deviceId);
    const now = new Date();
    const changed = prev?.afterParty !== going || !prev?.afterPartyAt;
    await this.prisma.receptionGuest.upsert({
      where: { eventKey_deviceId: { eventKey, deviceId } },
      create: { eventKey, deviceId, name, afterParty: going, afterPartyAt: now },
      update: { name, lastSeenAt: now, ...(changed ? { afterParty: going, afterPartyAt: now } : {}) },
    });
    const at = changed ? now : (prev!.afterPartyAt as Date);
    return { afterParty: going, afterPartyAt: at.toISOString() };
  }

  /**
   * 이미 낸 설문 답의 afterParty 를 손님 표와 같게 — 원시 SQL 이라 설문 updatedAt 은 그대로(참여자 판 '설문 완료' 시각이 2차 누름에 밀리지 않게).
   * 실패해도 손님 표가 진실이라 요청은 그대로 성공(읽을 때 손님 표 값을 먼저 쓴다)
   */
  private async syncSurveyAfterParty(eventKey: ReceptionEventKey, deviceId: string, going: AfterPartyAnswer) {
    try {
      await this.prisma.$executeRaw`
        UPDATE "reception_surveys" SET "answers" = jsonb_set("answers", '{afterParty}', to_jsonb(${going}::text), true)
        WHERE "eventKey" = ${eventKey}::text AND "deviceId" = ${deviceId}::text
          AND jsonb_typeof("answers") = 'object' AND "answers"->>'afterParty' IS DISTINCT FROM ${going}::text`;
    } catch (e: any) {
      this.logger.warn(`reception after-party survey sync failed: ${e?.message || e}`);
    }
  }
  /**
   * 손님 남기기 — 자리 탭에서 이름을 넣거나, 이름 있는 손님이 송년회 화면을 열 때(웹 ReceptionShell). 이름은 마지막 것으로.
   * userId = 로그인한 프리티풀 계정(261122 당첨 푸시용). 없으면(null) 있던 계정을 지우지 않는다 — 토큰이 빠진 요청 한 번에 연결이 끊기지 않게
   */
  async touchGuest(eventKey: ReceptionEventKey, deviceId: string, rawName: unknown, userId: string | null = null) {
    const name = cleanName(rawName);
    if (!name) throw new BadRequestException('이름을 먼저 입력해 주세요.');
    await this.prisma.receptionGuest.upsert({
      where: { eventKey_deviceId: { eventKey, deviceId } },
      create: { eventKey, deviceId, name, userId },
      update: { name, lastSeenAt: new Date(), ...(userId ? { userId } : {}) },
    });
    return { ok: true };
  }

  /**
   * 어드민 — 참여자 · 설문(261108 사장 '누가 참여했는지 누가 설문조사에 응답했는지').
   * 참여자 = 이름을 넣은 기기 ∪ 사진 올린 기기 ∪ 누른 기기 ∪ 설문 낸 기기(손님 표가 생기기 전에 참여한 사람도 빠지지 않게).
   * 이름 = 손님 표 > 설문 > 사진 순. 같은 이름이 기기 둘이면 두 줄(기기가 곧 사람).
   */
  async adminOverview(eventKey: ReceptionEventKey) {
    const [guests, rows, votes, surveys] = await Promise.all([
      this.prisma.receptionGuest.findMany({ where: { eventKey }, select: { deviceId: true, name: true, createdAt: true, lastSeenAt: true, afterParty: true, afterPartyAt: true } }),
      this.feedRows(eventKey),
      this.prisma.receptionVote.groupBy({ by: ['voterDeviceId', 'kind'], where: { eventKey }, _count: { _all: true }, _min: { createdAt: true } }),
      this.prisma.receptionSurvey.findMany({ where: { eventKey }, orderBy: { updatedAt: 'desc' }, select: { deviceId: true, name: true, answers: true, createdAt: true, updatedAt: true } }),
    ]);

    type P = {
      deviceId: string;
      name: string | null;
      firstAt: Date;
      lastAt: Date;
      photo: { thumbUrl: string; imageUrl: string; likes: number; empathies: number; rank: number; createdAt: string } | null;
      likesUsed: number;
      empathiesUsed: number;
      surveyAt: string | null;
      /** 2차 회식 참여(261122) — 손님 표가 진실, 없으면 낸 설문 답 */
      afterParty: AfterPartyAnswer | null;
      afterPartyAt: string | null;
    };
    const people = new Map<string, P>();
    const get = (deviceId: string, at: Date) => {
      let p = people.get(deviceId);
      if (!p) {
        p = { deviceId, name: null, firstAt: at, lastAt: at, photo: null, likesUsed: 0, empathiesUsed: 0, surveyAt: null, afterParty: null, afterPartyAt: null };
        people.set(deviceId, p);
      }
      if (at < p.firstAt) p.firstAt = at;
      if (at > p.lastAt) p.lastAt = at;
      return p;
    };
    for (const v of votes) {
      const p = get(v.voterDeviceId, v._min.createdAt || new Date());
      if (v.kind === 'like') p.likesUsed = v._count._all;
      else if (v.kind === 'empathy') p.empathiesUsed = v._count._all;
    }
    for (const r of rows) {
      const p = get(r.deviceId, r.createdAt);
      p.name = r.name;
      p.photo = { thumbUrl: r.thumbUrl, imageUrl: r.imageUrl, likes: r.likes, empathies: r.empathies, rank: r.rank, createdAt: r.createdAt.toISOString() };
    }
    for (const s of surveys) {
      const p = get(s.deviceId, s.createdAt);
      if (s.updatedAt > p.lastAt) p.lastAt = s.updatedAt;
      p.name = s.name;
      p.surveyAt = s.updatedAt.toISOString();
      const ap = (s.answers as Partial<SurveyAnswers> | null)?.afterParty;
      if (isAfterParty(ap)) {
        p.afterParty = ap;
        p.afterPartyAt = s.updatedAt.toISOString();
      }
    }
    for (const g of guests) {
      const p = get(g.deviceId, g.createdAt);
      if (g.lastSeenAt > p.lastAt) p.lastAt = g.lastSeenAt;
      p.name = g.name;
      if (isAfterParty(g.afterParty)) {
        p.afterParty = g.afterParty;
        p.afterPartyAt = (g.afterPartyAt || g.lastSeenAt).toISOString();
      }
    }

    const participants = [...people.values()]
      .sort((a, b) => b.lastAt.getTime() - a.lastAt.getTime())
      .map((p) => ({ ...p, firstAt: p.firstAt.toISOString(), lastAt: p.lastAt.toISOString() }));

    // 설문 답의 2차 참여는 손님 표(진실)로 맞춰 보낸다 — 설문을 낸 뒤 2차만 바꾼 손님도 어드민엔 지금 답
    const afterPartyOf = (deviceId: string) => people.get(deviceId)?.afterParty ?? null;
    const surveyAnswers = (s: (typeof surveys)[number]) => {
      const a = (s.answers && typeof s.answers === 'object' ? s.answers : {}) as Record<string, unknown>;
      const ap = afterPartyOf(s.deviceId);
      return ap ? { ...a, afterParty: ap } : a;
    };
    // 2차 회식은 사람 단위 — 한 사람이 폰 · 브라우저 여럿에서 누르면 기기마다 줄이 생기므로 참여자 판(buildPeople)처럼
    // 이름 하나로 합치고 마지막으로 고른 답만 센다(설문 낸 기록은 그 이름의 어느 기기든). 이름 없는 기기는 기기 그대로(fix 261123)
    type ApPerson = { deviceId: string; name: string | null; afterParty: AfterPartyAnswer; afterPartyAt: string | null; surveyAt: string | null };
    const apPeople = new Map<string, ApPerson>();
    for (const p of participants) {
      if (!p.afterParty) continue;
      const k = (p.name && nameKey(p.name)) || `d:${p.deviceId}`;
      const cur = apPeople.get(k);
      const row: ApPerson = { deviceId: p.deviceId, name: p.name, afterParty: p.afterParty as AfterPartyAnswer, afterPartyAt: p.afterPartyAt, surveyAt: p.surveyAt };
      if (!cur) apPeople.set(k, row);
      else if ((p.afterPartyAt || '') > (cur.afterPartyAt || '')) apPeople.set(k, { ...row, surveyAt: row.surveyAt || cur.surveyAt });
      else if (!cur.surveyAt && p.surveyAt) cur.surveyAt = p.surveyAt;
    }
    const afterParty = { yes: 0, no: 0, noSurvey: 0 };
    for (const p of apPeople.values()) {
      afterParty[p.afterParty] += 1;
      if (p.afterParty === 'yes' && !p.surveyAt) afterParty.noSurvey += 1;
    }

    const answers = surveys.map((s) => s.answers as unknown as Partial<SurveyAnswers>);
    const ratings = answers.map((a) => Number(a.rating)).filter((n) => n >= 1 && n <= 5);
    const again = { yes: 0, maybe: 0, no: 0 };
    const best: Record<string, number> = {};
    for (const a of answers) {
      if (a.again === 'yes' || a.again === 'maybe' || a.again === 'no') again[a.again] += 1;
      if (a.best) best[a.best] = (best[a.best] || 0) + 1;
    }

    return {
      eventKey,
      summary: {
        participants: participants.length,
        named: participants.filter((p) => p.name).length,
        photos: rows.length,
        voters: participants.filter((p) => p.likesUsed + p.empathiesUsed > 0).length,
        surveys: surveys.length,
        avgRating: ratings.length ? Math.round((ratings.reduce((x, y) => x + y, 0) / ratings.length) * 10) / 10 : null,
        again,
        best: Object.entries(best).sort((a, b) => b[1] - a[1]).map(([title, count]) => ({ title, count })),
        /** 2차 회식 참여(261122) — yes · no = 답한 사람 수, noSurvey = 2차 참여인데 설문은 아직 안 낸 사람 */
        afterParty,
      },
      participants,
      surveys: surveys.map((s) => ({ deviceId: s.deviceId, name: s.name, answers: surveyAnswers(s), createdAt: s.createdAt.toISOString(), updatedAt: s.updatedAt.toISOString() })),
      /** 2차 회식에 답한 사람 전부(설문을 안 낸 사람 포함 · 같은 이름 기기는 한 사람) — 마지막으로 바꾼 순 */
      afterParty: [...apPeople.values()].sort((a, b) => (b.afterPartyAt || '').localeCompare(a.afterPartyAt || '')),
    };
  }
}

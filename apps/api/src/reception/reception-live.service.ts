import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import { NotificationType, Prisma, type ReceptionDraw } from '@prisma/client';
import { createHash, randomInt } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';
import { ReceptionService } from './reception.service';
import {
  DRAW_PRIZES,
  ReceptionEventKey,
  TABLE_COUNT,
  TicketBlock,
  TicketsMode,
  baseNameKey,
  cleanName,
  cleanPrize,
  isTicketsMode,
  nameKey,
  parseSeatRows,
  parseTableNo,
  parseTicketBlocks,
  ticketsOpen,
} from './reception.rules';
import {
  RenameNote,
  SeatEditOp,
  TicketMove,
  applySeatEdit,
  editBlockList,
  followRename,
  freshNamedRows,
  mergeRenames,
  mergeSeatMoves,
  newRowKeys,
  parseRenames,
  parseSeatEdit,
  parseSeatMoves,
  planTicketMoves,
  renameBlocks,
  renameNoteOf,
  sameNameArrivedBlock,
  resolveSameNameSeat,
  seatMovesOf,
} from './reception-seats-edit';

/** 손님 자리 탭 응답(PUT guest) — 예전 웹이 보던 ok 는 그대로 둔다 */
export interface ReceptionMe {
  ok: true;
  name: string;
  /** 자리 명단이 1줄이라도 있나 */
  seatListLoaded: boolean;
  /** 명단에서 찾은 자리(없으면 null). 동명이인이면 손님이 고른 자리(아직 안 골랐으면 null) */
  seat: { table: number; seat: number | null } | null;
  /** 동명이인 — 명단에 이 이름이 2줄 이상이면 그 자리들(테이블 순) + 같은 테이블 사람들(손님이 보고 고름). 아니면 null */
  sameName: ReceptionSameName[] | null;
  ticketsOpen: boolean;
  ticket: { number: number; name: string; issuedAt: string; win: { prize: string; at: string } | null } | null;
  /**
   * 어드민이 이름을 고쳐 폰이 보낸 이름(옛 이름)을 새 이름으로 이었을 때만 — 폰이 보낸 이름 그대로(261123). 이때 name = 새 이름.
   * 웹은 이걸 보면 기기에 남긴 이름을 name 으로 바꾼다(lib/reception/me.ts adoptRename). 옛 웹은 모르는 칸이라 그냥 둔다
   */
  renamedFrom?: string;
}

/** 손님 앱 바뀜 신호(GET pulse) — v = 자리 명단 지문. 바뀌면 손님 폰이 PUT guest 로 자기 자리 · 이름을 다시 받는다 */
export interface ReceptionPulse {
  v: string;
}

export interface ReceptionSameName {
  table: number;
  seat: number | null;
  /** 같은 테이블에 앉는 사람들(좌석 순) */
  mates: string[];
}

export interface LiveArrival {
  id: string;
  number: number;
  name: string;
  table: number | null;
  seat: number | null;
  /** 명단에 있는 사람인가 */
  listed: boolean;
  issuedAt: string;
  lastSeenAt: string;
  win: { prize: string; at: string } | null;
}

export interface LiveSeatRow {
  name: string;
  table: number;
  seat: number | null;
  arrived: boolean;
  ticketNumber: number | null;
  arrivedAt: string | null;
}

export interface ReceptionLive {
  ticketsMode: TicketsMode;
  ticketsOpen: boolean;
  now: string;
  /** 응모권 = 입장. 번호 순 */
  arrivals: LiveArrival[];
  /** 명단 전체(테이블 → 좌석 → 이름 순) */
  seats: LiveSeatRow[];
  /** 응모권을 지운 이름(최근 위) — 이 이름으로는 다시 안 나온다. '다시 받게 하기' = POST tickets/unblock */
  blocked: TicketBlock[];
  summary: {
    arrived: number;
    listed: number;
    listedArrived: number;
    walkIns: number;
    tables: { table: number; listed: number; arrived: number }[];
  };
}

export interface DrawPrize {
  name: string;
  total: number;
  drawn: number;
  /** 세는 말('개' · 정장은 '벌') — 어드민 경품 단추에 같이 */
  unit: string;
}

export interface DrawRow {
  id: string;
  number: number;
  name: string;
  table: number | null;
  prize: string;
  at: string;
  cancelled: boolean;
}

export interface DrawBoard {
  prizes: DrawPrize[];
  /** 최근 위 */
  draws: DrawRow[];
  /** 한 번도 뽑힌 적 없는 응모권 수(무효된 사람도 다시 안 뽑음) */
  eligible: number;
  tickets: number;
}

export interface SeatRow {
  /** DB 줄 id — 이름 고친 기록(renames)이 '그 줄'을 찾을 때. 계산으로 만든 명단(seatListOf(plan.rows) 등)엔 없을 수 있다 */
  id?: string;
  nameKey: string;
  name: string;
  tableNo: number;
  seatNo: number | null;
}

export interface SeatList {
  rows: SeatRow[];
  /** 명단 줄 열쇠(동명이인은 '이름열쇠 @테이블') → 줄. 응모권 열쇠와 같은 것 */
  byKey: Map<string, SeatRow>;
  /** 이름 열쇠 → 그 이름의 줄들(동명이인이면 2줄 이상, 테이블 순) */
  byName: Map<string, SeatRow[]>;
  /** DB 줄 id → 줄(id 있는 줄만) */
  byId: Map<string, SeatRow>;
}

/** 명단·발급 모드 묶어 두는 시간 — 손님 자리 탭이 15초마다 부르는 길(어드민이 바꾸면 바로 버림) */
const SEATS_CACHE_MS = 3000;
const MODE_CACHE_MS = 3000;
/** 같은 기기·같은 이름이면 손님 표(lastSeenAt)·응모권 lastSeenAt 은 1분에 한 번만 쓴다 — 15초 폴링이 매번 쓰기가 되지 않게 */
const SEEN_WRITE_MS = 60_000;
/** 응모권 번호 겹침(동시에 받기) 다시 시도 횟수 */
const TICKET_RETRY = 5;
const TICKETS_KEY = 'tickets';
/** 어드민이 지운 이름 목록 — 새로 줄 때만 읽으니 묶어 두지 않는다(지우자마자 바로 막히게) */
const BLOCKS_KEY = 'ticket-blocks';
/** 어드민이 테이블 배치 판에서 옮긴 응모권의 옛 테이블들(reception-seats-edit.ts SeatMove) — 동명이인 손님 폰의 옛 pick 가리기 */
const SEAT_MOVES_KEY = 'seat-moves';
/** 어드민이 테이블 배치 판에서 이름을 고친 기록(reception-seats-edit.ts RenameNote) — 옛 이름으로 부르는 손님 폰을 새 이름으로 잇기 */
const RENAMES_KEY = 'renames';

/** 자리 명단 지문(손님 앱 바뀜 신호) — 명단 묶음 하나에 한 번만 계산. DB 는 순서를 안 정해 주니 열쇠 순으로 줄 세워 잰다 */
const seatsVersions = new WeakMap<SeatList, string>();
function seatsVersion(seats: SeatList): string {
  let v = seatsVersions.get(seats);
  if (!v) {
    const lines = seats.rows.map((r) => `${r.nameKey}\t${r.name}\t${r.tableNo}\t${r.seatNo ?? ''}`).sort();
    v = createHash('sha1').update(lines.join('\n')).digest('base64url').slice(0, 16);
    seatsVersions.set(seats, v);
  }
  return v;
}
/** 당첨 푸시를 누를 때 열 곳 — 송년회 이벤트 탭 맨 위 응모권(261122) */
const DRAW_PUSH_URL = '/reception/event';
/** 무대 연출(최대 12초)과 응답 시간 여유를 두고 당첨 푸시를 보낸다. */
const DRAW_PUSH_DELAY_MS = 15500;
/**
 * 알림톡 템플릿으로 잘못 이어지는 말(biztalk.service.ts resolveTemplate 본문 검사) — 어드민이 경품 이름을 자유롭게 넣을 수 있어서
 * 경품 이름에 이런 말이 섞이면 본문에서 경품 이름을 뺀다(엉뚱한 '새 메시지' 알림톡이 카톡으로 가지 않게)
 */
const ALIMTALK_BODY_TRIGGERS = /채팅|견적을 요청|섭외 요청이 도착/;

/** 응모권의 당첨 = 무효 안 된 추첨 중 가장 최근 것 */
const winSelect = Prisma.validator<Prisma.ReceptionTicket$drawsArgs>()({
  where: { cancelledAt: null },
  orderBy: { createdAt: 'desc' },
  take: 1,
  select: { prize: true, createdAt: true },
});

/**
 * 응모권 → 명단 줄(한 줄엔 응모권 하나, 번호 순으로 먼저 온 것). 열쇠가 딱 맞는 것 먼저, 그다음 이름이 하나뿐인 줄 —
 * 명단을 고쳐 동명이인 열쇠('이름 @테이블')가 어긋난 응모권도 제 줄에 붙는다(손님 폰이 다시 부르면 열쇠도 옮겨 감, ticketFor).
 */
export function matchTickets(seats: SeatList, tickets: ReadonlyArray<{ id: string; nameKey: string }>): Map<string, SeatRow> {
  const out = new Map<string, SeatRow>();
  const taken = new Set<SeatRow>();
  for (const t of tickets) {
    const row = seats.byKey.get(t.nameKey);
    if (row && !taken.has(row)) { out.set(t.id, row); taken.add(row); }
  }
  for (const t of tickets) {
    if (out.has(t.id)) continue;
    const same = seats.byName.get(baseNameKey(t.nameKey));
    if (same?.length === 1 && !taken.has(same[0])) { out.set(t.id, same[0]); taken.add(same[0]); }
  }
  return out;
}

export const byTableSeatName = (a: SeatRow, b: SeatRow) =>
  a.tableNo - b.tableNo || (a.seatNo ?? 99) - (b.seatNo ?? 99) || a.name.localeCompare(b.name, 'ko');

/** 명단 줄 → SeatList(테이블 → 좌석 → 이름 순으로 정렬해 둔다 · 열쇠 / 이름 열쇠로 찾기) */
export function seatListOf(list: SeatRow[]): SeatList {
  const rows = [...list].sort(byTableSeatName);
  const byName = new Map<string, SeatRow[]>();
  for (const r of rows) {
    const k = baseNameKey(r.nameKey);
    byName.set(k, [...(byName.get(k) || []), r]);
  }
  const byId = new Map<string, SeatRow>();
  for (const r of rows) if (r.id) byId.set(r.id, r);
  return { rows, byKey: new Map(rows.map((r) => [r.nameKey, r])), byName, byId };
}

/** 명단 한 건 고치기 응답(POST seats/edit) — 웹은 이 뒤 참여자 판을 fresh 로 다시 받는다 */
export interface SeatEditResponse {
  ok: true;
  /** 실제로 바뀐 줄이 있었나(같은 자리로 옮기기 등은 false) */
  changed: boolean;
  /** 이 명령의 그 사람 — 고친 뒤 줄 열쇠(빼기면 null) */
  key: string | null;
  /** 고친 뒤 명단 전체(테이블 → 좌석 → 이름 순) */
  rows: Array<{ nameKey: string; name: string; table: number; seat: number | null }>;
  /** 열쇠 · 이름을 옮긴 응모권 수 · 오래된 열쇠에 막혀 건너뛴 수 */
  ticketsMoved: number;
  ticketsSkipped: number;
}

/** 고치는 동안 잠깐 쓰는 열쇠 — 띄어쓰기가 든 열쇠는 이름에서 안 나오고(nameKey 는 띄어쓰기를 다 뺌) ' @' 도 없어서 어떤 진짜 열쇠와도 안 겹친다 */
const tempKey = (id: string) => `#tmp ${id}`;
/** 고치는 사이 다른 쪽(명단 통째로 바꾸기 · 손님 응모권)이 같은 줄을 바꿈 — 트랜잭션은 통째로 되돌려진다 */
const SEAT_EDIT_RACE = '명단이 방금 다른 곳에서 바뀌었어요. 화면을 새로 고친 뒤 다시 해 주세요.';

/**
 * 송년회 자리 명단 · 럭키드로우 응모권(=입장) · 추첨(261122 사장 '이름을 입력하면 자동으로 자리를 알려주고 럭키드로우가 출력되게끔'
 * · '관리자 태블릿에서 누가누가 왔는지'). 규칙은 reception.rules.ts.
 * 응모권은 이름(nameKey) 하나에 한 장 — 기기가 달라도 같은 이름이면 같은 번호. 한 기기도 한 장(이름만 바꿔 더 받기 X). 추첨은 행사별 트랜잭션 잠금 안에서 뽑아 겹쳐 눌러도 같은 사람이 두 번 안 나온다.
 */
@Injectable()
export class ReceptionLiveService {
  private readonly logger = new Logger(ReceptionLiveService.name);
  private readonly seatCache = new Map<string, { at: number; p: Promise<SeatList> }>();
  private readonly modeCache = new Map<string, { at: number; p: Promise<TicketsMode> }>();
  private readonly renameCache = new Map<string, { at: number; p: Promise<RenameNote[]> }>();
  private readonly touched = new Map<string, { name: string; userId: string | null; at: number }>();
  private readonly drawPushDelayMs?: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly reception: ReceptionService,
    // @Optional — 모듈 imports 에서 NotificationModule 이 빠져도(병합 실수) API 부팅은 그대로, 당첨 푸시만 기록하고 건너뜀(행사 당일 안전)
    @Optional() private readonly notifications?: NotificationService,
  ) {}

  // ───────────── 묶어 두기 ─────────────

  /** 자리 명단(3초 묶음) — 참여자 판(ReceptionPeopleService)이 같은 명단·열쇠 규칙을 쓰게 */
  seatList(eventKey: string): Promise<SeatList> {
    return this.seats(eventKey);
  }

  private seats(eventKey: string, fresh = false): Promise<SeatList> {
    const hit = this.seatCache.get(eventKey);
    if (!fresh && hit && Date.now() - hit.at < SEATS_CACHE_MS) return hit.p;
    const entry = {
      at: Date.now(),
      p: this.prisma.receptionSeat
        .findMany({ where: { eventKey }, select: { id: true, nameKey: true, name: true, tableNo: true, seatNo: true } })
        .then(seatListOf),
    };
    this.seatCache.set(eventKey, entry);
    entry.p.catch(() => {
      if (this.seatCache.get(eventKey) === entry) this.seatCache.delete(eventKey);
    });
    return entry.p;
  }

  /** 이름 고친 기록(3초 묶음, 어드민이 고치면 바로 버림) — 폰이 보낸 이름이 명단에 없을 때만 읽는다 */
  private renames(eventKey: string): Promise<RenameNote[]> {
    const hit = this.renameCache.get(eventKey);
    if (hit && Date.now() - hit.at < SEATS_CACHE_MS) return hit.p;
    const entry = {
      at: Date.now(),
      p: this.prisma.receptionState
        .findUnique({ where: { eventKey_key: { eventKey, key: RENAMES_KEY } }, select: { value: true } })
        .then((row) => parseRenames(row?.value)),
    };
    this.renameCache.set(eventKey, entry);
    entry.p.catch(() => {
      if (this.renameCache.get(eventKey) === entry) this.renameCache.delete(eventKey);
    });
    return entry.p;
  }

  private ticketsMode(eventKey: string, fresh = false): Promise<TicketsMode> {
    const hit = this.modeCache.get(eventKey);
    if (!fresh && hit && Date.now() - hit.at < MODE_CACHE_MS) return hit.p;
    const entry = {
      at: Date.now(),
      p: this.prisma.receptionState
        .findUnique({ where: { eventKey_key: { eventKey, key: TICKETS_KEY } }, select: { value: true } })
        .then((row): TicketsMode => {
          const mode = (row?.value as { mode?: unknown } | null)?.mode;
          return isTicketsMode(mode) ? mode : 'auto';
        }),
    };
    this.modeCache.set(eventKey, entry);
    entry.p.catch(() => {
      if (this.modeCache.get(eventKey) === entry) this.modeCache.delete(eventKey);
    });
    return entry.p;
  }

  // ───────────── 손님 ─────────────

  /**
   * 손님 표 남기기(기존 touchGuest) — 같은 기기가 같은 이름으로 1분 안에 다시 오면 건너뜀.
   * 계정(userId)이 처음 오거나 바뀐 요청은 건너뛰지 않는다(261122 당첨 푸시 — 로그인 직후 첫 요청이 1분 묶음에 묻히지 않게).
   * 계정 없는 요청(null)은 계정을 지우지 않으니 같은 이름이면 그대로 건너뜀
   */
  private async touchGuest(eventKey: ReceptionEventKey, deviceId: string, name: string, userId: string | null) {
    const k = `${eventKey}:${deviceId}`;
    const hit = this.touched.get(k);
    if (hit && hit.name === name && (!userId || hit.userId === userId) && Date.now() - hit.at < SEEN_WRITE_MS) return;
    await this.reception.touchGuest(eventKey, deviceId, name, userId);
    if (this.touched.size > 5000) {
      for (const [key, v] of this.touched) if (Date.now() - v.at >= SEEN_WRITE_MS) this.touched.delete(key);
    }
    this.touched.set(k, { name, userId, at: Date.now() });
  }

  /** 어드민이 지운 이름인가 — 새로 줄 때만 부른다(이미 받은 사람 폴링은 안 읽음) */
  private async isBlocked(eventKey: string, key: string): Promise<boolean> {
    const row = await this.prisma.receptionState.findUnique({ where: { eventKey_key: { eventKey, key: BLOCKS_KEY } }, select: { value: true } });
    return parseTicketBlocks(row?.value).some((b) => b.nameKey === key);
  }

  /** 지운 이름 목록 고치기 — 줄을 잠그고 읽고-고치고-쓴다(두 태블릿이 겹쳐 눌러도 하나씩) */
  private async editBlocks(tx: Prisma.TransactionClient, eventKey: string, edit: (list: TicketBlock[]) => TicketBlock[]) {
    await tx.$executeRaw`
      INSERT INTO "reception_state" ("eventKey", "key", "value")
      VALUES (${eventKey}::text, ${BLOCKS_KEY}::text, ${JSON.stringify({ list: [] })}::jsonb)
      ON CONFLICT ("eventKey", "key") DO NOTHING`;
    const rows = await tx.$queryRaw<Array<{ value: unknown }>>`
      SELECT "value" FROM "reception_state" WHERE "eventKey" = ${eventKey}::text AND "key" = ${BLOCKS_KEY}::text FOR UPDATE`;
    const list = edit(parseTicketBlocks(rows[0]?.value));
    await tx.receptionState.update({
      where: { eventKey_key: { eventKey, key: BLOCKS_KEY } },
      data: { value: { list } as unknown as Prisma.InputJsonValue },
    });
  }

  /**
   * 내 응모권 — 이름(nameKey)으로 찾고, 없으면 이 기기가 처음 받은 것(한 기기 한 장 — 이름만 바꿔 넣어 여러 장 받기 막기).
   * 둘 다 없고 발급 열림이면 새 번호(그 행사 최대+1, 겹치면 다시). 어드민이 지운 이름은 다시 주지 않는다.
   * 동명이인(열쇠 '이름 @테이블'): 이 기기가 같은 이름의 다른 줄로 받은 응모권이 있으면 그것이 내 것 — 그 줄 응모권이
   * 아직 없으면 지금 고른 줄로 옮긴다(잘못 골랐다 다시 고른 사람 · 명단이 바뀐 사람). 남의 기기 응모권을 대신 보여 주지 않는다.
   * deviceOnly = 동명이인인데 아직 안 고름 — 이 기기 응모권만 본다(이름만 같은 다른 사람 것 X).
   * userId(261122 당첨 푸시) = 새로 줄 때 같이 적고, 이미 있는 응모권은 비어 있으면 채운다. 받은 기기에서 같은 이름·다른 계정으로 들어오면 그 계정으로 바꾼다
   * (받은 기기가 주인 — 같은 이름을 넣은 다른 기기 · 같은 기기의 다른 이름은 빈 칸만 채움). null 로는 지우지 않는다.
   */
  private async ticketFor(
    eventKey: ReceptionEventKey,
    key: string,
    name: string,
    deviceId: string,
    userId: string | null,
    open: boolean,
    deviceOnly = false,
  ) {
    let blocked: boolean | undefined;
    const base = baseNameKey(key);
    for (let attempt = 0; attempt <= TICKET_RETRY; attempt++) {
      // 이름·기기를 한 번에 읽고 이름이 맞는 것을 먼저 — 같은 이름이면 기기가 달라도 같은 응모권
      const mine = await this.prisma.receptionTicket.findMany({
        where: { eventKey, OR: deviceOnly ? [{ deviceId }] : [{ nameKey: key }, { deviceId }] },
        orderBy: { number: 'asc' },
        include: { draws: winSelect },
      });
      const own = mine.find((t) => t.deviceId === deviceId && baseNameKey(t.nameKey) === base);
      const named = deviceOnly ? undefined : mine.find((t) => t.nameKey === key);
      let found = own ?? named ?? mine[0];
      if (own && !named && !deviceOnly && own.nameKey !== key) {
        try {
          const moved = await this.prisma.receptionTicket.updateMany({ where: { id: own.id, nameKey: own.nameKey }, data: { nameKey: key } });
          if (moved.count) found = { ...own, nameKey: key };
        } catch (e) {
          // 그 사이 그 줄 응모권을 누가 받음 — 옮기지 않고 내 것 그대로
          if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002')) throw e;
        }
      }
      if (found) {
        const stale = Date.now() - found.lastSeenAt.getTime() >= SEEN_WRITE_MS;
        // 바꾸기는 '받은 기기 + 같은 이름'일 때만 — 공용 폰에서 다른 이름(다른 사람)이 들어와 남의 응모권 계정을 가져가지 않게(빈 칸 채우기는 그대로)
        const ownDevice = found.deviceId === deviceId && baseNameKey(found.nameKey) === base;
        const link = !!userId && found.userId !== userId && (!found.userId || ownDevice);
        if (stale || link) {
          // 빈 칸 채우기는 '아직 비어 있으면'으로만(다른 기기 둘이 겹쳐 와도 먼저 붙은 계정을 덮지 않게)
          const where: Prisma.ReceptionTicketWhereInput = !link ? { id: found.id } : ownDevice ? { id: found.id, deviceId } : { id: found.id, userId: null };
          const r = await this.prisma.receptionTicket.updateMany({
            where,
            data: { ...(stale ? { lastSeenAt: new Date() } : {}), ...(link ? { userId } : {}) },
          });
          if (link && r.count) found = { ...found, userId };
        }
        return found;
      }
      if (!open) return null;
      if (blocked === undefined) blocked = await this.isBlocked(eventKey, key);
      if (blocked) return null;
      const max = await this.prisma.receptionTicket.aggregate({ where: { eventKey }, _max: { number: true } });
      try {
        return await this.prisma.receptionTicket.create({
          data: { eventKey, number: (max._max.number ?? 0) + 1, nameKey: key, name, deviceId, userId },
          include: { draws: winSelect },
        });
      } catch (e) {
        // 같은 번호(동시에 받음) 또는 같은 이름(다른 기기가 막 받음) — 다시 읽고 다시 시도
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') continue;
        throw e;
      }
    }
    // 끝까지 겹치면 이번엔 응모권 없이 자리만 보여 준다(다음 15초 폴링 때 다시 받음)
    this.logger.warn(`reception ticket retry exhausted: ${eventKey}`);
    return null;
  }

  /**
   * 손님 자리 탭 — 손님 표 남기기 + 명단 자리 + (발급 열림이면) 응모권.
   * 동명이인(명단에 이 이름이 2줄 이상)이면 rawPick(손님이 고른 테이블)으로 그 줄을 찾는다 — 못 찾으면 자리 없이 고를 목록만 주고
   * 응모권도 새로 주지 않는다(고른 뒤 그 줄 열쇠로 받게. 이미 받은 것은 그대로 보임).
   * userId = 로그인한 프리티풀 계정(없으면 null) — 손님 표·응모권에 붙여 당첨 푸시를 보낸다(261122).
   */
  async guest(eventKey: ReceptionEventKey, deviceId: string, rawName: unknown, rawPick?: unknown, userId: string | null = null): Promise<ReceptionMe> {
    const sent = cleanName(rawName);
    if (!sent) throw new BadRequestException('이름을 먼저 입력해 주세요.');
    let name = sent;
    let key = nameKey(name);
    let pick = parseTableNo(rawPick);
    const [seats, mode] = await Promise.all([this.seats(eventKey), this.ticketsMode(eventKey)]);
    const open = ticketsOpen(mode, Date.now());
    let same = seats.byName.get(key) ?? [];
    // 어드민이 이름을 고쳤나(261123) — 폰은 옛 이름으로 계속 부른다. 그 이름이 명단에 없거나, 동명이인 폰이 고른 테이블에 그 이름이 없을 때만 기록을 본다
    // (평소 폴링은 안 읽음). 이으면 이후 전부(손님 표 · 자리 · 응모권) 새 이름으로, 답에 renamedFrom 을 실어 폰이 저장한 이름을 바꾸게 한다
    let renamedFrom: string | null = null;
    if (seats.rows.length && (same.length === 0 || (pick != null && !same.some((r) => r.tableNo === pick)))) {
      const notes = await this.renames(eventKey);
      // 이 이름 기록이 있을 때만 이 기기 응모권을 본다(같은 옛 이름 기록이 여럿이면 — 동명이인 둘을 다 고침 — 내 응모권이 따라간 새 이름이 내 것)
      const deviceKeys = notes.some((x) => x.from === key)
        ? new Set(
            (await this.prisma.receptionTicket.findMany({ where: { eventKey, deviceId }, select: { nameKey: true } })).map((t) => baseNameKey(t.nameKey)),
          )
        : undefined;
      const to = followRename(notes, key, pick, (k) => seats.byName.get(k) ?? [], (id) => seats.byId.get(id), deviceKeys);
      if (to) {
        renamedFrom = sent;
        name = to.name;
        key = nameKey(name);
        same = seats.byName.get(key) ?? [];
        // 폰이 고른 테이블은 옛 이름 것 — 새 이름이 동명이인이면 그 줄의 지금 테이블을 고른 것으로(줄 id 로 찾은 그 줄이라 남의 줄이 아니다)
        pick = same.length > 1 ? to.table : null;
      }
    }
    await this.touchGuest(eventKey, deviceId, name, userId);
    const seat = same.length === 1 ? same[0] : same.length > 1 ? await this.sameNameSeat(eventKey, deviceId, key, same, pick) : undefined;
    const undecided = same.length > 1 && !seat;
    const ticket = await this.ticketFor(eventKey, seat ? seat.nameKey : key, name, deviceId, userId, open && !undecided, undecided);
    const win = ticket?.draws[0];
    return {
      ok: true,
      name,
      seatListLoaded: seats.rows.length > 0,
      seat: seat ? { table: seat.tableNo, seat: seat.seatNo } : null,
      sameName:
        same.length > 1
          ? same.map((r) => ({
              table: r.tableNo,
              seat: r.seatNo,
              mates: seats.rows.filter((m) => m.tableNo === r.tableNo && m !== r).map((m) => m.name),
            }))
          : null,
      ticketsOpen: open,
      ticket: ticket
        ? {
            number: ticket.number,
            name: ticket.name,
            issuedAt: ticket.createdAt.toISOString(),
            win: win ? { prize: win.prize, at: win.createdAt.toISOString() } : null,
          }
        : null,
      ...(renamedFrom ? { renamedFrom } : {}),
    };
  }

  /**
   * 손님 앱 바뀜 신호(261123 사장 '자리랑 이름 바뀌면 앱에서도 실시간으로 바로 바뀌어야함') — 자리 명단 지문만 준다.
   * 손님 폰이 화면이 보일 때 2초마다 부르고, 지문이 바뀌면 PUT guest 로 자기 자리 · 이름을 다시 받는다(웹 lib/reception/me.ts).
   * 명단 묶음(3초, 어드민이 고치면 바로 버림)만 쓰니 부를 때마다 DB 를 읽지 않는다. 이름 · 자리는 안 내보낸다(지문뿐)
   */
  async pulse(eventKey: ReceptionEventKey): Promise<ReceptionPulse> {
    return { v: seatsVersion(await this.seats(eventKey)) };
  }

  /**
   * 동명이인 손님의 줄 — 폰이 보낸 고른 테이블(pick)과 이 기기 응모권 줄 중 어느 것인지(규칙 = resolveSameNameSeat).
   * 어드민이 테이블 배치 판에서 그 사람을 옮기면 응모권 열쇠는 따라가지만 폰의 pick 은 옛 테이블 그대로다 — 그 pick 이 어드민이
   * 옮기기 전 테이블('seat-moves')이면 응모권 줄이 이긴다(다음 폴링에 응모권을 옛 줄로 도로 가져가지 않게). 손님이 다시 고른 테이블이면 고른 줄.
   * pick 이 없으면(안 고름 · '다시 고르기') 읽지 않고 바로 줄 없음.
   */
  private async sameNameSeat(eventKey: ReceptionEventKey, deviceId: string, key: string, same: SeatRow[], pick: number | null): Promise<SeatRow | undefined> {
    if (pick == null) return undefined;
    const mine = await this.prisma.receptionTicket.findMany({ where: { eventKey, deviceId }, orderBy: { number: 'asc' }, select: { id: true, nameKey: true } });
    // ticketFor 의 own 과 같은 규칙 — 이 기기 응모권 중 같은 이름의 첫 장
    const own = mine.find((t) => baseNameKey(t.nameKey) === key);
    const picked = same.find((r) => r.tableNo === pick);
    const ownRow = own ? same.find((r) => r.nameKey === own.nameKey) : undefined;
    let movedFrom: number[] = [];
    if (own && picked && ownRow && picked !== ownRow) {
      const row = await this.prisma.receptionState.findUnique({ where: { eventKey_key: { eventKey, key: SEAT_MOVES_KEY } }, select: { value: true } });
      movedFrom = parseSeatMoves(row?.value).find((m) => m.id === own.id)?.from ?? [];
    }
    return resolveSameNameSeat(same, pick, own?.nameKey ?? null, movedFrom);
  }

  // ───────────── 어드민 — 입장 현황 · 명단 · 응모권 ─────────────

  async live(eventKey: ReceptionEventKey): Promise<ReceptionLive> {
    const [mode, seats, tickets, blockRow] = await Promise.all([
      this.ticketsMode(eventKey, true),
      this.seats(eventKey, true),
      this.prisma.receptionTicket.findMany({ where: { eventKey }, orderBy: { number: 'asc' }, include: { draws: winSelect } }),
      this.prisma.receptionState.findUnique({ where: { eventKey_key: { eventKey, key: BLOCKS_KEY } }, select: { value: true } }),
    ]);
    const now = new Date();
    const rowOf = matchTickets(seats, tickets);
    const ticketByRow = new Map<SeatRow, (typeof tickets)[number]>();
    for (const t of tickets) {
      const row = rowOf.get(t.id);
      if (row) ticketByRow.set(row, t);
    }
    const arrivals: LiveArrival[] = tickets.map((t) => {
      const seat = rowOf.get(t.id);
      const win = t.draws[0];
      return {
        id: t.id,
        number: t.number,
        name: t.name,
        table: seat?.tableNo ?? null,
        seat: seat?.seatNo ?? null,
        listed: !!seat,
        issuedAt: t.createdAt.toISOString(),
        lastSeenAt: t.lastSeenAt.toISOString(),
        win: win ? { prize: win.prize, at: win.createdAt.toISOString() } : null,
      };
    });
    const seatRows: LiveSeatRow[] = seats.rows.map((s) => {
      const t = ticketByRow.get(s);
      return { name: s.name, table: s.tableNo, seat: s.seatNo, arrived: !!t, ticketNumber: t?.number ?? null, arrivedAt: t ? t.createdAt.toISOString() : null };
    });
    const tables = Array.from({ length: TABLE_COUNT }, (_, i) => ({ table: i + 1, listed: 0, arrived: 0 }));
    for (const s of seatRows) {
      const row = tables[s.table - 1];
      if (!row) continue;
      row.listed += 1;
      if (s.arrived) row.arrived += 1;
    }
    const listedArrived = seatRows.filter((s) => s.arrived).length;
    return {
      ticketsMode: mode,
      ticketsOpen: ticketsOpen(mode, now),
      now: now.toISOString(),
      arrivals,
      seats: seatRows,
      blocked: parseTicketBlocks(blockRow?.value).sort((a, b) => b.at.localeCompare(a.at)),
      summary: {
        arrived: tickets.length,
        listed: seatRows.length,
        listedArrived,
        walkIns: arrivals.filter((a) => !a.listed).length,
        tables,
      },
    };
  }

  /** 자리 명단 통째로 바꾸기(빈 배열 = 비우기) */
  async putSeats(eventKey: ReceptionEventKey, rawRows: unknown): Promise<ReceptionLive> {
    const rows = parseSeatRows(rawRows);
    if (typeof rows === 'string') throw new BadRequestException(rows);
    try {
      await this.prisma.$transaction([
        this.prisma.receptionSeat.deleteMany({ where: { eventKey } }),
        ...(rows.length
          ? [this.prisma.receptionSeat.createMany({ data: rows.map((r) => ({ eventKey, nameKey: r.nameKey, name: r.name, tableNo: r.table, seatNo: r.seat })) })]
          : []),
      ]);
    } finally {
      this.seatCache.delete(eventKey);
    }
    return this.live(eventKey);
  }

  /**
   * 자리 명단 한 건 고치기(261122 사장 '테이블배치 · 드래그엔 드롭으로 자리 위치 · 실시간으로 · 이름도 수정 · 인원도 추가') — POST seats/edit.
   * { op: move | swap | rename | add | remove, ... } 를 '지금 DB 명단'에 하나만 적용한다(규칙 = reception-seats-edit.ts).
   *  · 행사별 잠금(pg_advisory_xact_lock) 안에서 읽고-고치고-쓴다 — 태블릿 두 대가 동시에 끌어 놓아도 하나씩, 서로 덮지 않는다.
   *  · 적용 뒤 전체를 parseSeatRows 로 다시 검사(동명이인 열쇠 다시 계산) — 틀리면 400(이유 그대로), 맞으면 바뀐 줄만 쓴다.
   *  · 열쇠가 바뀐 줄의 응모권은 열쇠도 옮긴다(도착 기록 유지). 이름을 고치면 응모권 · 추첨 기록 이름도 새 이름으로.
   *    열쇠가 서로 엇갈려도 유일 열쇠가 안 겹치게 잠깐 쓰는 열쇠를 거쳐 두 번에 쓴다. 동명이인끼리 맞바꾸기는 거절(SAME_NAME_SWAP).
   *  · 이름을 고쳐 빈 옛 열쇠는 지운 이름 목록에 넣는다(같은 사람 다른 폰이 옛 이름으로 새 응모권을 받지 않게). 명단 줄에 새로 붙은 열쇠는 그 목록에서 푼다.
   *  · 테이블을 옮긴 사람 응모권의 옛 테이블을 남긴다('seat-moves') — 동명이인 폰에 남은 옛 pick 이 응모권을 옛 줄로 도로 가져가지 않게(sameNameSeat).
   *  · 이름을 고치면 그 기록을 남긴다('renames') — 손님 폰이 옛 이름으로 불러도 새 이름으로 잇고 폰이 저장한 이름도 바꾸게(guest followRename).
   *  · 손님 앱은 2초마다 명단 지문(pulse)을 보고 바뀌면 자리를 다시 받으니 명단 묶음(seatCache)만 버리면 손님 자리 · 이름도 바로 따라 바뀐다.
   */
  async editSeats(eventKey: ReceptionEventKey, body: unknown): Promise<SeatEditResponse> {
    const op = parseSeatEdit(body);
    if (typeof op === 'string') throw new BadRequestException(op);
    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`rc-seats:${eventKey}`}))`;
        return this.applySeatEditTx(tx, eventKey, op);
      });
    } catch (e) {
      // 그 사이 손님이 같은 열쇠로 응모권을 막 받음 등 — 유일 열쇠 겹침은 '다시 해 주세요'로
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw new BadRequestException(SEAT_EDIT_RACE);
      throw e;
    } finally {
      this.seatCache.delete(eventKey);
      this.renameCache.delete(eventKey);
    }
  }

  private async applySeatEditTx(tx: Prisma.TransactionClient, eventKey: ReceptionEventKey, op: SeatEditOp): Promise<SeatEditResponse> {
    const before = await tx.receptionSeat.findMany({ where: { eventKey }, select: { id: true, nameKey: true, name: true, tableNo: true, seatNo: true } });
    before.sort(byTableSeatName);
    const plan = applySeatEdit(before, op);
    if (typeof plan === 'string') throw new BadRequestException(plan);
    const tickets = await tx.receptionTicket.findMany({ where: { eventKey }, orderBy: { number: 'asc' }, select: { id: true, nameKey: true, name: true } });
    // 응모권 → 고치기 전 줄(입장 현황 · 참여자 판과 같은 규칙)
    const ticketRow = new Map<string, string>();
    for (const [id, row] of matchTickets(seatListOf(before), tickets)) ticketRow.set(id, row.nameKey);
    const arrivedSame = sameNameArrivedBlock(before, op, ticketRow);
    if (arrivedSame) throw new BadRequestException(arrivedSame);
    const tplan = planTicketMoves(plan, tickets, ticketRow, op.op === 'add' ? op.ticketId : null);
    if (typeof tplan === 'string') throw new BadRequestException(tplan);

    // 1) 명단 줄 — 지우기 → (열쇠 바뀌는 줄) 잠깐 열쇠 → 새 값 → 새 줄. 줄 수가 안 맞으면 그 사이 누가 바꾼 것 → 통째로 되돌림
    //    id 는 꼭 있어야 한다(where 에 undefined 가 들어가면 Prisma 는 그 조건을 빼 버려 행사 명단 전체를 고친다)
    const idOf = (r: { id?: string }): string => {
      if (!r.id) throw new BadRequestException(SEAT_EDIT_RACE);
      return r.id;
    };
    if (plan.removed.length) {
      const r = await tx.receptionSeat.deleteMany({ where: { eventKey, id: { in: plan.removed.map(idOf) } } });
      if (r.count !== plan.removed.length) throw new BadRequestException(SEAT_EDIT_RACE);
    }
    for (const u of plan.updated) {
      if (u.before.nameKey === u.after.nameKey) continue;
      const id = idOf(u.before);
      const r = await tx.receptionSeat.updateMany({ where: { id, eventKey, nameKey: u.before.nameKey }, data: { nameKey: tempKey(id) } });
      if (r.count !== 1) throw new BadRequestException(SEAT_EDIT_RACE);
    }
    for (const u of plan.updated) {
      const r = await tx.receptionSeat.updateMany({
        where: { id: idOf(u.before), eventKey },
        data: { nameKey: u.after.nameKey, name: u.after.name, tableNo: u.after.tableNo, seatNo: u.after.seatNo },
      });
      if (r.count !== 1) throw new BadRequestException(SEAT_EDIT_RACE);
    }
    if (plan.added.length) {
      await tx.receptionSeat.createMany({ data: plan.added.map((x) => ({ eventKey, nameKey: x.nameKey, name: x.name, tableNo: x.tableNo, seatNo: x.seatNo })) });
    }

    // 2) 응모권 — 열쇠가 바뀌는 것은 잠깐 열쇠를 거쳐서(맞바꾸기). 그 사이 손님 폰이 제 응모권 열쇠를 옮겼으면(count 0) 그 응모권은 건너뜀
    let skipped = tplan.skipped.length;
    const parked = new Set<string>();
    for (const m of tplan.moves) {
      if (m.from === m.to) continue;
      const r = await tx.receptionTicket.updateMany({ where: { id: m.id, eventKey, nameKey: m.from }, data: { nameKey: tempKey(m.id) } });
      if (r.count) parked.add(m.id);
      else skipped += 1;
    }
    const done: TicketMove[] = [];
    for (const m of tplan.moves) {
      const where = m.from === m.to ? { id: m.id, eventKey, nameKey: m.from } : parked.has(m.id) ? { id: m.id, eventKey, nameKey: tempKey(m.id) } : null;
      if (!where) continue;
      const r = await tx.receptionTicket.updateMany({ where, data: { nameKey: m.to, ...(m.name ? { name: m.name } : {}) } });
      if (!r.count) {
        skipped += 1;
        continue;
      }
      done.push(m);
      // 이름을 고쳤으면 그 응모권 추첨 기록 이름도(무대 · 당첨 목록에 고친 이름으로)
      if (m.name) await tx.receptionDraw.updateMany({ where: { eventKey, ticketId: m.id }, data: { name: m.name } });
    }
    if (skipped) this.logger.warn(`reception seats edit: ${skipped} ticket move(s) skipped — ${eventKey} op=${op.op}`);

    // 3) 상태 줄(reception_state)은 맨 끝 — 잠금 순서 명단 → 응모권 → 상태 줄(deleteTicket 도 응모권 → 지운 이름 순이라 서로 안 막힘)
    //    · 테이블을 옮긴 사람 응모권의 옛 테이블 — 동명이인 폰의 옛 pick 가리기(sameNameSeat). 이 줄은 여기(행사 잠금 안)서만 쓴다
    const fromTables = seatMovesOf(plan, ticketRow);
    if (fromTables.length) {
      const where = { eventKey_key: { eventKey, key: SEAT_MOVES_KEY } };
      const cur = await tx.receptionState.findUnique({ where, select: { value: true } });
      const value = { list: mergeSeatMoves(parseSeatMoves(cur?.value), fromTables) } as unknown as Prisma.InputJsonValue;
      await tx.receptionState.upsert({ where, create: { eventKey, key: SEAT_MOVES_KEY, value }, update: { value } });
    }
    //    · 이름 고친 기록 — 옛 이름으로 부르는 손님 폰을 새 이름으로 잇는다(guest followRename). 그 옛 이름을 단 줄이 새로 생기면 그 기록은 버림
    const note = renameNoteOf(before, op, new Date().toISOString());
    const fresh = freshNamedRows(plan);
    const gone = plan.removed.map((r) => r.id).filter((id): id is string => !!id);
    if (note || fresh.length || gone.length) {
      const where = { eventKey_key: { eventKey, key: RENAMES_KEY } };
      const cur = await tx.receptionState.findUnique({ where, select: { value: true } });
      const list = parseRenames(cur?.value);
      const next = mergeRenames(list, note, fresh, gone);
      if (note || next.length !== list.length) {
        const value = { list: next } as unknown as Prisma.InputJsonValue;
        await tx.receptionState.upsert({ where, create: { eventKey, key: RENAMES_KEY, value }, update: { value } });
      }
    }
    //    · 이름 고치기로 빈 옛 열쇠는 지운 이름으로(같은 사람 다른 폰이 옛 이름으로 새 응모권 X) · 명단 줄에 새로 붙은 열쇠는 풀기
    const blocks = renameBlocks(plan, done, ticketRow, tickets);
    const unblock = newRowKeys(plan);
    let blockEdit = blocks.length > 0;
    if (!blockEdit && unblock.length) {
      const cur = await tx.receptionState.findUnique({ where: { eventKey_key: { eventKey, key: BLOCKS_KEY } }, select: { value: true } });
      blockEdit = parseTicketBlocks(cur?.value).some((b) => unblock.includes(b.nameKey));
    }
    if (blockEdit) {
      const at = new Date().toISOString();
      await this.editBlocks(tx, eventKey, (list) => editBlockList(list, blocks, unblock, at));
    }

    return {
      ok: true,
      changed: plan.removed.length + plan.updated.length + plan.added.length > 0,
      key: plan.key,
      rows: seatListOf(plan.rows.map((x) => ({ nameKey: x.nameKey, name: x.name, tableNo: x.tableNo, seatNo: x.seatNo }))).rows.map((x) => ({
        nameKey: x.nameKey,
        name: x.name,
        table: x.tableNo,
        seat: x.seatNo,
      })),
      ticketsMoved: done.length,
      ticketsSkipped: skipped,
    };
  }

  /** 응모권 발급 모드 — auto(행사 시간대) · open · closed */
  async setTicketsMode(eventKey: ReceptionEventKey, mode: unknown): Promise<ReceptionLive> {
    if (!isTicketsMode(mode)) throw new BadRequestException('자동 · 열기 · 닫기 중에서 골라 주세요.');
    try {
      await this.prisma.receptionState.upsert({
        where: { eventKey_key: { eventKey, key: TICKETS_KEY } },
        create: { eventKey, key: TICKETS_KEY, value: { mode } },
        update: { value: { mode } },
      });
    } finally {
      this.modeCache.delete(eventKey);
    }
    return this.live(eventKey);
  }

  /**
   * 응모권 지우기(테스트·실수 정리) — 추첨 기록도 같이 지워진다(cascade).
   * 지운 이름은 막아 둔다: 손님 폰이 15초마다 다시 불러도 새 번호로 되살아나지 않게. 실수로 지웠으면 unblockTicket 으로 풀기
   */
  async deleteTicket(eventKey: ReceptionEventKey, id: string): Promise<ReceptionLive> {
    await this.prisma.$transaction(async (tx) => {
      const t = await tx.receptionTicket.findFirst({ where: { id, eventKey }, select: { nameKey: true, name: true } });
      if (!t) throw new NotFoundException('응모권을 찾을 수 없어요.');
      const r = await tx.receptionTicket.deleteMany({ where: { id, eventKey } });
      if (!r.count) throw new NotFoundException('응모권을 찾을 수 없어요.');
      const at = new Date().toISOString();
      await this.editBlocks(tx, eventKey, (list) => [...list.filter((b) => b.nameKey !== t.nameKey), { nameKey: t.nameKey, name: t.name, at }]);
    });
    return this.live(eventKey);
  }

  /** 지운 이름 풀기 — 그 이름으로 다시 응모권을 받을 수 있게(없는 이름이어도 그대로 성공) */
  async unblockTicket(eventKey: ReceptionEventKey, rawName: unknown): Promise<ReceptionLive> {
    const name = cleanName(rawName);
    if (!name) throw new BadRequestException('이름을 확인해 주세요.');
    const key = nameKey(name);
    // 동명이인 응모권은 '이름 @테이블' 열쇠로 막혀 있다 — 이름으로 풀면 그 이름의 막힘을 다 푼다
    await this.prisma.$transaction((tx) =>
      this.editBlocks(tx, eventKey, (list) => list.filter((b) => b.nameKey !== key && baseNameKey(b.nameKey) !== key)),
    );
    return this.live(eventKey);
  }

  // ───────────── 어드민 — 럭키드로우 ─────────────

  async drawBoard(eventKey: ReceptionEventKey): Promise<DrawBoard> {
    const [seats, draws, tickets, eligible] = await Promise.all([
      this.seats(eventKey, true),
      this.prisma.receptionDraw.findMany({ where: { eventKey }, orderBy: { createdAt: 'desc' } }),
      this.prisma.receptionTicket.findMany({ where: { eventKey }, orderBy: { number: 'asc' }, select: { id: true, nameKey: true } }),
      this.prisma.receptionTicket.count({ where: { eventKey, draws: { none: {} } } }),
    ]);
    // 당첨자 테이블 = 응모권이 붙은 명단 줄(동명이인도 그 사람 테이블 — 입장 현황과 같은 규칙)
    const rowOf = matchTickets(seats, tickets);
    const drawn = new Map<string, number>();
    for (const d of draws) if (!d.cancelledAt) drawn.set(d.prize, (drawn.get(d.prize) || 0) + 1);
    return {
      prizes: DRAW_PRIZES.map((p) => ({ name: p.name, total: p.total, unit: p.unit, drawn: drawn.get(p.name) || 0 })),
      draws: draws.map((d) => this.drawRow(d, rowOf.get(d.ticketId))),
      eligible,
      tickets: tickets.length,
    };
  }

  private drawRow(d: { id: string; number: number; name: string; prize: string; createdAt: Date; cancelledAt: Date | null }, row: SeatRow | undefined): DrawRow {
    return {
      id: d.id,
      number: d.number,
      name: d.name,
      table: row?.tableNo ?? null,
      prize: d.prize,
      at: d.createdAt.toISOString(),
      cancelled: !!d.cancelledAt,
    };
  }

  /**
   * 추첨 — 한 번도 안 뽑힌 응모권 중 무작위 1장. 행사별 잠금 안에서 후보 읽기 + 넣기(겹쳐 눌러도 같은 응모권 두 번 X).
   * 저장(커밋)된 뒤 당첨자에게 푸시 — 기다리지 않는다(푸시가 느리거나 실패해도 추첨 응답은 그대로, notifyWinner).
   * 푸시는 무대 발표 뒤에 닿게 늦춰 보낸다 — 그 사이 무효로 돌리면 안 보냄
   */
  async draw(eventKey: ReceptionEventKey, rawPrize: unknown, batch = false): Promise<{ draw: DrawRow; winners: DrawRow[]; board: DrawBoard; participants: { number: number; name: string }[] }> {
    const prize = cleanPrize(rawPrize);
    if (!prize) throw new BadRequestException('경품 이름을 확인해 주세요(1~40자).');
    const catalog = batch ? DRAW_PRIZES.find((p) => p.name === prize && /디퓨|세럼|한우|선글라스/.test(p.name)) : undefined;
    if (batch && !catalog) throw new BadRequestException('한 번에 추첨할 수 없는 경품이에요.');
    const { created, participants } = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`rc-draw:${eventKey}`}))`;
      const quantity = catalog
        ? catalog.total - await tx.receptionDraw.count({ where: { eventKey, prize, cancelledAt: null } })
        : 1;
      if (quantity < 1) throw new BadRequestException('남은 경품이 없어요.');
      const pool = await tx.receptionTicket.findMany({ where: { eventKey, draws: { none: {} } }, select: { id: true, number: true, name: true } });
      if (!pool.length) throw new BadRequestException('뽑을 응모권이 없어요.');
      if (pool.length < quantity) throw new BadRequestException('남은 경품 수보다 응모권이 적어요.');
      const participants = pool.map(({ number, name }) => ({ number, name }));
      const created: ReceptionDraw[] = [];
      for (let i = 0; i < quantity; i++) {
        const index = randomInt(pool.length);
        const t = pool[index];
        pool[index] = pool[pool.length - 1];
        pool.pop();
        created.push(await tx.receptionDraw.create({ data: { eventKey, ticketId: t.id, number: t.number, name: t.name, prize } }));
      }
      return { created, participants };
    });
    const timer = setTimeout(() => {
      for (const winner of created) void this.notifyWinner(eventKey, winner).catch(() => undefined);
    }, this.drawPushDelayMs ?? (batch ? 24_000 : DRAW_PUSH_DELAY_MS));
    timer.unref?.();
    const board = await this.drawBoard(eventKey);
    const winners = created.map((row) => board.draws.find((d) => d.id === row.id) ?? this.drawRow(row, undefined));
    return { draw: winners[0], winners, board, participants };
  }

  /**
   * 당첨 푸시(261122 사장 '당첨이 되면 푸시 알람이 가게끔 해줘 당사자에게') — 누르면 송년회 이벤트 탭(응모권 '당첨!')으로.
   * 알림 종류 system(알림 설정 '시스템' 따름), 제목·본문은 알림톡 템플릿에 걸리지 않는 말로(카톡 알림톡은 안 나감 — 앱 푸시 + 알림함만).
   * 여기서 나는 오류는 전부 기록만 하고 삼킨다(추첨은 이미 저장됨).
   */
  private async notifyWinner(eventKey: ReceptionEventKey, draw: { id: string; ticketId: string; prize: string }) {
    try {
      // 늦추는 사이 무효(자리에 없음)로 돌렸거나 응모권을 지웠으면 보내지 않는다
      const still = await this.prisma.receptionDraw.findFirst({ where: { id: draw.id, eventKey, cancelledAt: null }, select: { id: true } });
      if (!still) return;
      const userId = await this.winnerUserId(eventKey, draw.ticketId);
      if (!userId) {
        this.logger.warn(`reception draw push skipped — no account: ${eventKey} draw=${draw.id}`);
        return;
      }
      if (!this.notifications) {
        this.logger.warn(`reception draw push skipped — NotificationService missing: ${eventKey} draw=${draw.id}`);
        return;
      }
      const body = `축하해요! ${draw.prize}에 당첨됐어요. 송년회 이벤트 탭에서 응모권을 확인해 주세요.`;
      await this.notifications.createNotification(
        userId,
        NotificationType.system,
        '럭키드로우에 당첨됐어요! 🎉',
        ALIMTALK_BODY_TRIGGERS.test(body) ? '축하해요! 경품에 당첨됐어요. 송년회 이벤트 탭에서 응모권을 확인해 주세요.' : body,
        { url: DRAW_PUSH_URL, type: 'reception_draw', drawId: draw.id, eventKey },
      );
    } catch (e) {
      this.logger.warn(`reception draw push failed: ${eventKey} draw=${draw.id} ${String((e as Error)?.message ?? e).slice(0, 200)}`);
    }
  }

  /**
   * 당첨 푸시 받을 계정 — 응모권 계정 → 그 응모권을 받은 기기의 손님 표 계정 → 같은 이름 손님 표 계정(최근 위).
   * 이름으로 찾을 땐 계정이 하나로 모일 때만, 동명이인 응모권('이름 @테이블')은 이름으로 찾지 않는다(같은 이름 다른 사람에게 가지 않게).
   */
  private async winnerUserId(eventKey: ReceptionEventKey, ticketId: string): Promise<string | null> {
    const t = await this.prisma.receptionTicket.findFirst({ where: { id: ticketId, eventKey }, select: { userId: true, deviceId: true, nameKey: true } });
    if (!t) return null;
    if (t.userId) return t.userId;
    const byDevice = await this.prisma.receptionGuest.findFirst({
      where: { eventKey, deviceId: t.deviceId, userId: { not: null } },
      orderBy: { lastSeenAt: 'desc' },
      select: { userId: true },
    });
    if (byDevice?.userId) return byDevice.userId;
    const base = baseNameKey(t.nameKey);
    if (base !== t.nameKey) return null;
    const guests = await this.prisma.receptionGuest.findMany({
      where: { eventKey, userId: { not: null } },
      orderBy: { lastSeenAt: 'desc' },
      select: { name: true, userId: true },
    });
    const ids = new Set(guests.filter((g) => g.userId && nameKey(g.name) === base).map((g) => g.userId as string));
    return ids.size === 1 ? [...ids][0] : null;
  }

  /** 추첨 무효(자리에 없을 때) — 그 응모권은 다시 뽑지 않는다. 이미 무효면 그대로 */
  async cancelDraw(eventKey: ReceptionEventKey, id: string): Promise<DrawBoard> {
    const r = await this.prisma.receptionDraw.updateMany({ where: { id, eventKey, cancelledAt: null }, data: { cancelledAt: new Date() } });
    if (!r.count && !(await this.prisma.receptionDraw.count({ where: { id, eventKey } }))) {
      throw new NotFoundException('추첨 기록을 찾을 수 없어요.');
    }
    return this.drawBoard(eventKey);
  }

  async resetDraws(eventKey: ReceptionEventKey, expectedIds: unknown): Promise<DrawBoard> {
    if (!Array.isArray(expectedIds) || !expectedIds.length || !expectedIds.every(id => typeof id === 'string' && id.length > 0)) {
      throw new BadRequestException('삭제할 추첨 기록을 확인해 주세요.');
    }
    const expected = new Set(expectedIds);
    const deleted = await this.prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`rc-draw:${eventKey}`}))`;
      const rows = await tx.receptionDraw.findMany({ where: { eventKey }, select: { id: true } });
      if (rows.length !== expected.size || rows.some(row => !expected.has(row.id))) {
        throw new ConflictException('추첨 내역이 바뀌었어요. 새로고침하고 다시 확인해 주세요.');
      }
      return tx.receptionDraw.deleteMany({ where: { eventKey, id: { in: rows.map(row => row.id) } } });
    });
    this.logger.log(`reception draws reset: ${eventKey} count=${deleted.count}`);
    return this.drawBoard(eventKey);
  }
}

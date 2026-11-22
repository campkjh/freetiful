import { BadRequestException, Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import { NotificationType, Prisma } from '@prisma/client';
import { randomInt } from 'crypto';
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
  /** 값어치('각 27만원 상당') — 어드민 경품 단추에 같이 */
  worth: string;
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
/** 당첨 푸시를 누를 때 열 곳 — 송년회 이벤트 탭 맨 위 응모권(261122) */
const DRAW_PUSH_URL = '/reception/event';
/** 당첨 푸시 늦추기 — 어드민 추첨 화면이 번호를 굴리다 멈추기까지 약 2.4초(admin/reception/draw). 무대에 이름이 뜬 뒤에 폰이 울리게 */
const DRAW_PUSH_DELAY_MS = 2500;
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
  private readonly touched = new Map<string, { name: string; userId: string | null; at: number }>();
  private readonly drawPushDelayMs = DRAW_PUSH_DELAY_MS;

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
        .findMany({ where: { eventKey }, select: { nameKey: true, name: true, tableNo: true, seatNo: true } })
        .then((rows) => {
          rows.sort(byTableSeatName);
          const byName = new Map<string, SeatRow[]>();
          for (const r of rows) {
            const k = baseNameKey(r.nameKey);
            byName.set(k, [...(byName.get(k) || []), r]);
          }
          return { rows, byKey: new Map(rows.map((r) => [r.nameKey, r])), byName };
        }),
    };
    this.seatCache.set(eventKey, entry);
    entry.p.catch(() => {
      if (this.seatCache.get(eventKey) === entry) this.seatCache.delete(eventKey);
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
    const name = cleanName(rawName);
    if (!name) throw new BadRequestException('이름을 먼저 입력해 주세요.');
    const key = nameKey(name);
    const [, seats, mode] = await Promise.all([this.touchGuest(eventKey, deviceId, name, userId), this.seats(eventKey), this.ticketsMode(eventKey)]);
    const open = ticketsOpen(mode, Date.now());
    const same = seats.byName.get(key) ?? [];
    const pick = same.length > 1 ? parseTableNo(rawPick) : null;
    const seat = same.length === 1 ? same[0] : same.find((r) => r.tableNo === pick);
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
    };
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
      prizes: DRAW_PRIZES.map((p) => ({ name: p.name, total: p.total, worth: p.worth, drawn: drawn.get(p.name) || 0 })),
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
   * 푸시는 무대 발표(추첨 화면 굴림 ~2.4초) 뒤에 닿게 조금 늦춰 보낸다 — 그 사이 무효로 돌리면 안 보냄
   */
  async draw(eventKey: ReceptionEventKey, rawPrize: unknown): Promise<{ draw: DrawRow; board: DrawBoard }> {
    const prize = cleanPrize(rawPrize);
    if (!prize) throw new BadRequestException('경품 이름을 확인해 주세요(1~40자).');
    const created = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`rc-draw:${eventKey}`}))`;
      const pool = await tx.receptionTicket.findMany({ where: { eventKey, draws: { none: {} } }, select: { id: true, number: true, name: true } });
      if (!pool.length) throw new BadRequestException('뽑을 응모권이 없어요.');
      const t = pool[randomInt(pool.length)];
      return tx.receptionDraw.create({ data: { eventKey, ticketId: t.id, number: t.number, name: t.name, prize } });
    });
    const timer = setTimeout(() => {
      void this.notifyWinner(eventKey, created).catch(() => undefined);
    }, this.drawPushDelayMs ?? DRAW_PUSH_DELAY_MS);
    timer.unref?.();
    const board = await this.drawBoard(eventKey);
    return { draw: board.draws.find((d) => d.id === created.id) ?? this.drawRow(created, undefined), board };
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
}

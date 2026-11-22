/**
 * 송년회 자리 명단 한 건 고치기(261122 사장 '참여자 리스트에서 테이블배치로 보기로 해주고 드래그엔 드롭으로 자리 위치 바꿀 수 있게끔 ·
 * 실시간으로 자리가 바뀌게끔 · 이름도 수정할 수 있게' + '인원도 추가할 수 있게') — 어드민 테이블 배치 판(웹 reception/_parts/SeatBoard.tsx).
 *  · 명단 통째로 바꾸기(PUT seats)와 달리 '지금 DB 명단'에 명령 하나만 적용한다 — 태블릿 두 대가 동시에 고쳐도 서로 덮지 않게
 *    (서비스가 행사별 잠금 안에서 읽고 → 여기 순수 계산 → 바뀐 줄만 쓴다, reception-live.service.ts editSeats).
 *  · 적용 뒤 전체 명단을 parseSeatRows 로 다시 검사 — 동명이인 열쇠('이름 @테이블')도 다시 계산된다. 틀리면 그 이유 문구 그대로.
 *  · 열쇠가 바뀐 줄(이름 변경 · 동명이인이 다른 테이블로 · 동명이인이 생기거나 사라짐)은 그 줄 응모권 열쇠도 옮겨야 도착 기록이 따라간다(planTicketMoves).
 * 여기 함수는 전부 순수(Prisma 없음) — 단위 시험 reception-seats-edit.test.ts.
 */
import { NAME_MAX, SEATS_PER_TABLE, TABLE_COUNT, cleanName, nameKey as nameKeyOf, parseSeatRows, parseTableNo, type TicketBlock } from './reception.rules';

/** 명단 한 줄(DB 줄 모양) — id 는 DB 에 있는 줄만, 새로 넣을 줄은 없음 */
export interface EditSeatRow {
  id?: string;
  nameKey: string;
  name: string;
  tableNo: number;
  seatNo: number | null;
}

export type SeatEditOp =
  /** 그 사람을 그 테이블 · 좌석으로(좌석 null = 좌석 없이). 같은 좌석에 둘은 괜찮다 */
  | { op: 'move'; nameKey: string; table: number; seat: number | null }
  /** 두 사람 자리(테이블 · 좌석) 맞바꾸기 */
  | { op: 'swap'; nameKey: string; otherKey: string }
  /** 이름 고치기 — 그 줄 응모권 이름 · 열쇠도 따라간다 */
  | { op: 'rename'; nameKey: string; name: string }
  /** 사람 추가. ticketId = 명단 밖 손님(응모권 있음)을 끌어 넣을 때 — 그 응모권을 새 줄에 붙인다 */
  | { op: 'add'; name: string; table: number; seat: number | null; ticketId?: string }
  /** 명단에서 빼기 — 응모권은 그대로(명단 밖 손님이 된다) */
  | { op: 'remove'; nameKey: string };

export const SEAT_EDIT_OPS = ['move', 'swap', 'rename', 'add', 'remove'] as const;

/**
 * 동명이인끼리 맞바꾸기는 거절 — 이름 · 테이블 · 좌석이 그대로라 명단은 안 바뀌고 응모권만 섞인다.
 * 손님 폰은 기기에 남긴 '고른 테이블'로 자기 줄을 찾으니 섞인 응모권을 다음 폴링 때 도로 가져간다(어드민 판이 2초 뒤 되돌아감)
 */
export const SAME_NAME_SWAP = '같은 이름끼리는 바꿔도 명단이 그대로예요.';

/**
 * 동명이인 중 이미 도착한(응모권이 붙은) 줄은 이름 고치기 · 빼기 X(fix 261123 교차 검토).
 * 한 줄을 고치거나 빼면 남은 같은 이름 줄의 열쇠가 '김현우 @12' → '김현우' 로 꼬리가 떨어지는데, 고친 쪽 손님 폰은 옛 이름 '김현우'로
 * 계속 부른다 → 서버가 이름 한 줄뿐이라 보고 **남의 자리 · 남의 응모권**(로그인 계정까지 붙을 수 있음)을 준다. 자리 옮기기는 괜찮다.
 */
export const SAME_NAME_ARRIVED = '같은 이름이 둘 있는 분 중 이미 도착한 분은 이름을 바꾸거나 뺄 수 없어요 — 그분 폰이 같은 이름 다른 분의 자리 · 응모권을 보게 돼요. 자리 옮기기는 돼요.';

/** SAME_NAME_ARRIVED 검사(순수) — ticketRow = 응모권 id → 고치기 전 줄 열쇠(matchTickets) */
export function sameNameArrivedBlock(rows: ReadonlyArray<EditSeatRow>, op: SeatEditOp, ticketRow: ReadonlyMap<string, string>): string | null {
  if (op.op !== 'rename' && op.op !== 'remove') return null;
  const row = rows.find((r) => r.nameKey === op.nameKey);
  if (!row) return null;
  const base = nameKeyOf(row.name);
  if (rows.filter((r) => nameKeyOf(r.name) === base).length < 2) return null;
  if (op.op === 'rename' && nameKeyOf(op.name) === base) return null; // 띄어쓰기만 고침 — 열쇠가 안 바뀐다
  for (const k of ticketRow.values()) if (k === row.nameKey) return SAME_NAME_ARRIVED;
  return null;
}

/** 없는 사람 — 다른 태블릿이 먼저 고쳤거나 화면이 옛것. 404 대신 400 으로 낸다(어드민 adminFetch 가 404 면 같은 POST 를 다른 경로로 한 번 더 보낸다) */
export const SEAT_NOT_FOUND = '명단에서 찾을 수 없어요. 화면을 새로 고친 뒤 다시 해 주세요.';

/** 명단 줄 열쇠 — 문자열 1~80자(모양은 DB 에서 찾아보면 안다) */
function parseKey(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  return s && s.length <= 80 ? s : null;
}

/** 좌석 — null · '' = 좌석 없음, 1~SEATS_PER_TABLE(숫자 또는 숫자 글자). 틀리면 undefined */
function parseSeatNo(v: unknown): number | null | undefined {
  if (v == null || v === '') return null;
  const n = typeof v === 'string' && /^\s*\d{1,2}\s*$/.test(v) ? Number(v) : v;
  return typeof n === 'number' && Number.isInteger(n) && n >= 1 && n <= SEATS_PER_TABLE ? n : undefined;
}

/** 본문 검사 — { op, ... }. 틀리면 이유 문자열 */
export function parseSeatEdit(v: unknown): SeatEditOp | string {
  const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
  const op = o.op;
  if (typeof op !== 'string' || !(SEAT_EDIT_OPS as readonly string[]).includes(op)) return '무엇을 고칠지 알 수 없어요.';
  const tableErr = `테이블은 1~${TABLE_COUNT} 사이 숫자예요.`;
  const seatErr = `좌석은 1~${SEATS_PER_TABLE} 사이 숫자예요.`;
  const nameErr = `이름을 확인해 주세요(1~${NAME_MAX}자).`;
  if (op === 'add') {
    const name = cleanName(o.name);
    if (!name) return nameErr;
    const table = parseTableNo(o.table);
    if (table == null) return tableErr;
    const seat = parseSeatNo(o.seat);
    if (seat === undefined) return seatErr;
    if (o.ticketId != null && o.ticketId !== '') {
      const ticketId = parseKey(o.ticketId);
      if (!ticketId) return '응모권을 찾을 수 없어요.';
      return { op, name, table, seat, ticketId };
    }
    return { op, name, table, seat };
  }
  const nameKey = parseKey(o.nameKey);
  if (!nameKey) return SEAT_NOT_FOUND;
  if (op === 'move') {
    const table = parseTableNo(o.table);
    if (table == null) return tableErr;
    const seat = parseSeatNo(o.seat);
    if (seat === undefined) return seatErr;
    return { op, nameKey, table, seat };
  }
  if (op === 'swap') {
    const otherKey = parseKey(o.otherKey);
    if (!otherKey) return SEAT_NOT_FOUND;
    if (otherKey === nameKey) return '같은 사람끼리는 바꿀 수 없어요.';
    return { op, nameKey, otherKey };
  }
  if (op === 'rename') {
    const name = cleanName(o.name);
    if (!name) return nameErr;
    return { op, nameKey, name };
  }
  return { op: 'remove', nameKey };
}

export interface SeatEditPlan {
  /** 고친 뒤 명단 전체(열쇠 다시 계산) — 살아남은 옛 줄은 id 그대로, 새 줄은 id 없음. 순서 = 옛 순서 + 새 줄 끝 */
  rows: EditSeatRow[];
  /** 지울 옛 줄 */
  removed: EditSeatRow[];
  /** 바뀐 옛 줄(열쇠 · 이름 · 테이블 · 좌석 중 하나라도) — before = 옛 값, after = 새 값(id 같음) */
  updated: Array<{ before: EditSeatRow; after: EditSeatRow }>;
  /** 새로 넣을 줄 */
  added: EditSeatRow[];
  /** 옛 열쇠 → 새 열쇠(살아남은 줄 중 열쇠가 바뀐 것) */
  rekeys: Map<string, string>;
  /** 이 명령의 그 사람 — 고친 뒤 열쇠(빼기면 null) */
  key: string | null;
  /** 이름을 고친 줄 — 옛 열쇠 · 새 이름(rename 일 때만) */
  renamed: { fromKey: string; name: string } | null;
}

/**
 * 명령 하나 적용(순수) — 지금 명단(rows) + op → 고친 뒤 명단과 바뀐 줄들. 틀리면 이유 문자열.
 * 같은 좌석 번호에 두 사람은 그대로 허용(배정표에 실제로 있음). 같은 테이블 같은 이름은 parseSeatRows 가 막는다.
 */
export function applySeatEdit(rows: ReadonlyArray<EditSeatRow>, op: SeatEditOp): SeatEditPlan | string {
  const work = rows.map((r) => ({ src: r as EditSeatRow | null, name: r.name, table: r.tableNo, seat: r.seatNo }));
  const at = (key: string) => work.findIndex((w) => w.src?.nameKey === key);
  let target: (typeof work)[number] | null = null;
  let renamed: SeatEditPlan['renamed'] = null;
  switch (op.op) {
    case 'move': {
      const i = at(op.nameKey);
      if (i < 0) return SEAT_NOT_FOUND;
      work[i].table = op.table;
      work[i].seat = op.seat;
      target = work[i];
      break;
    }
    case 'swap': {
      const i = at(op.nameKey);
      const j = at(op.otherKey);
      if (i < 0 || j < 0) return SEAT_NOT_FOUND;
      if (i === j) return '같은 사람끼리는 바꿀 수 없어요.';
      const a = work[i];
      const b = work[j];
      if (nameKeyOf(a.name) === nameKeyOf(b.name)) return SAME_NAME_SWAP;
      [a.table, a.seat, b.table, b.seat] = [b.table, b.seat, a.table, a.seat];
      target = a;
      break;
    }
    case 'rename': {
      const i = at(op.nameKey);
      if (i < 0) return SEAT_NOT_FOUND;
      work[i].name = op.name;
      target = work[i];
      renamed = { fromKey: op.nameKey, name: op.name };
      break;
    }
    case 'add': {
      target = { src: null, name: op.name, table: op.table, seat: op.seat };
      work.push(target);
      break;
    }
    case 'remove': {
      const i = at(op.nameKey);
      if (i < 0) return SEAT_NOT_FOUND;
      work.splice(i, 1);
      break;
    }
  }

  // 전체 다시 검사 — 동명이인 열쇠도 여기서 다시 붙는다(parseSeatRows 는 순서를 그대로 둔다)
  const parsed = parseSeatRows(work.map((w) => ({ name: w.name, table: w.table, seat: w.seat })));
  if (typeof parsed === 'string') return parsed;

  const next: EditSeatRow[] = [];
  const updated: SeatEditPlan['updated'] = [];
  const added: EditSeatRow[] = [];
  const rekeys = new Map<string, string>();
  let key: string | null = null;
  for (let i = 0; i < parsed.length; i++) {
    const p = parsed[i];
    const w = work[i];
    const row: EditSeatRow = { ...(w.src?.id ? { id: w.src.id } : {}), nameKey: p.nameKey, name: p.name, tableNo: p.table, seatNo: p.seat };
    next.push(row);
    if (w === target) key = row.nameKey;
    const b = w.src;
    if (!b) {
      added.push(row);
      continue;
    }
    if (b.nameKey !== row.nameKey) rekeys.set(b.nameKey, row.nameKey);
    if (b.nameKey !== row.nameKey || b.name !== row.name || b.tableNo !== row.tableNo || (b.seatNo ?? null) !== row.seatNo) {
      updated.push({ before: b, after: row });
    }
  }
  const kept = new Set(work.map((w) => w.src).filter(Boolean));
  const removed = rows.filter((r) => !kept.has(r));
  return { rows: next, removed, updated, added, rekeys, key, renamed };
}

export interface TicketMove {
  id: string;
  /** 지금 열쇠 */
  from: string;
  /** 옮길 열쇠(이름만 고칠 땐 from 과 같음) */
  to: string;
  /** 이름도 바꿀 때 새 이름(아니면 null) */
  name: string | null;
}

/**
 * 응모권 열쇠 옮기기 계획(순수).
 *  · ticketRow = 응모권 id → 고치기 전 명단 줄 열쇠(서비스가 matchTickets 로 — 열쇠가 딱 맞는 것 먼저, 그다음 이름이 하나뿐인 줄).
 *  · 열쇠가 바뀐 줄(rekeys) · 이름을 고친 줄에 붙은 응모권만 옮긴다 — 나머지(열쇠가 어긋났어도 제 줄에 잘 붙어 있는 것)는 건드리지 않는다.
 *  · 뺀 줄의 응모권은 그대로(명단 밖 손님).
 *  · addTicketId(명단 밖 손님 끌어 넣기) = 그 응모권을 새 줄 열쇠로. 그 응모권이 이미 다른 줄에 붙어 있으면(다른 태블릿이 먼저 넣음) 거절.
 *  · 옮길 열쇠를 이 계획 밖의 응모권이 쥐고 있으면(오래된 열쇠) 그 옮김은 건너뛴다(skipped) — 응모권 열쇠는 행사 안에서 유일.
 */
export function planTicketMoves(
  plan: SeatEditPlan,
  tickets: ReadonlyArray<{ id: string; nameKey: string; name: string }>,
  ticketRow: ReadonlyMap<string, string>,
  addTicketId?: string | null,
): { moves: TicketMove[]; skipped: TicketMove[] } | string {
  const removedKeys = new Set(plan.removed.map((r) => r.nameKey));
  let wanted: TicketMove[] = [];
  for (const t of tickets) {
    const rk = ticketRow.get(t.id);
    if (!rk || removedKeys.has(rk)) continue;
    const rename = plan.renamed?.fromKey === rk;
    if (!plan.rekeys.has(rk) && !rename) continue;
    const to = plan.rekeys.get(rk) ?? rk;
    const name = rename && plan.renamed!.name !== t.name ? plan.renamed!.name : null;
    if (to === t.nameKey && !name) continue;
    wanted.push({ id: t.id, from: t.nameKey, to, name });
  }
  if (addTicketId) {
    const t = tickets.find((x) => x.id === addTicketId);
    if (!t) return '응모권을 찾을 수 없어요. 화면을 새로 고친 뒤 다시 해 주세요.';
    if (ticketRow.has(t.id)) return '이미 명단에 있는 손님이에요. 화면을 새로 고친 뒤 다시 해 주세요.';
    const row = plan.added[0];
    if (row) {
      const name = row.name !== t.name ? row.name : null;
      if (row.nameKey !== t.nameKey || name) wanted.push({ id: t.id, from: t.nameKey, to: row.nameKey, name });
    }
  }
  // 막힌 옮김 빼기 — 빠진 응모권은 제 열쇠를 그대로 쥐므로 그 열쇠로 가려던 다른 옮김도 막힌다(사슬이 끝날 때까지)
  const skipped: TicketMove[] = [];
  for (;;) {
    const moving = new Set(wanted.map((m) => m.id));
    const held = new Set(tickets.filter((t) => !moving.has(t.id)).map((t) => t.nameKey));
    const blocked = wanted.filter((m) => m.from !== m.to && held.has(m.to));
    if (!blocked.length) break;
    skipped.push(...blocked);
    wanted = wanted.filter((m) => !blocked.includes(m));
  }
  return { moves: wanted, skipped };
}

/* ─── 손님 폰과 맞추기 — 동명이인 고른 테이블(pick) · 이름 고치기로 비는 옛 열쇠 ─── */

/**
 * reception_state 'seat-moves' 한 줄 — 어드민이 테이블을 옮긴 사람의 응모권 id → 옮기기 전 테이블들.
 * 동명이인 손님 폰은 기기에 남긴 '고른 테이블'(pick)로 자기 줄을 찾는다(웹 lib/reception/me.ts readSamePick). 어드민이 옮겨도 폰의 pick 은
 * 옛 테이블 그대로라, 그 pick 이 '어드민이 옮기기 전 테이블'인지(=옛것) '손님이 다시 고른 테이블'인지 가를 때 쓴다(resolveSameNameSeat).
 */
export interface SeatMove {
  id: string;
  from: number[];
}

/** 'seat-moves' 읽기({ list }) — 모양이 틀린 줄은 버린다 */
export function parseSeatMoves(v: unknown): SeatMove[] {
  const list = (v && typeof v === 'object' ? (v as { list?: unknown }).list : null) as unknown;
  if (!Array.isArray(list)) return [];
  const out: SeatMove[] = [];
  for (const o of list) {
    const m = (o && typeof o === 'object' ? o : {}) as Record<string, unknown>;
    if (typeof m.id !== 'string' || !m.id || !Array.isArray(m.from) || out.some((x) => x.id === m.id)) continue;
    const from = m.from.filter((n): n is number => Number.isInteger(n) && (n as number) >= 1 && (n as number) <= TABLE_COUNT);
    if (from.length) out.push({ id: m.id, from: [...new Set(from)] });
  }
  return out;
}

/** 옛 테이블 더하기(순수) — 응모권마다 겹치지 않게 모은다(테이블 수가 상한이라 커지지 않음) */
export function mergeSeatMoves(list: ReadonlyArray<SeatMove>, add: ReadonlyArray<{ id: string; from: number }>): SeatMove[] {
  const out = list.map((m) => ({ id: m.id, from: [...m.from] }));
  for (const a of add) {
    const cur = out.find((m) => m.id === a.id);
    if (!cur) out.push({ id: a.id, from: [a.from] });
    else if (!cur.from.includes(a.from)) cur.from.push(a.from);
  }
  return out;
}

/**
 * 이번 고치기로 테이블이 바뀐 줄의 응모권 → 옛 테이블(순수). ticketRow = 응모권 id → 고치기 전 줄 열쇠(서비스 matchTickets).
 * 동명이인이 아닐 때 옮긴 것도 남긴다 — 나중에 같은 이름이 생기면 폰에 남은 옛 pick 이 다시 쓰일 수 있어서.
 */
export function seatMovesOf(plan: SeatEditPlan, ticketRow: ReadonlyMap<string, string>): Array<{ id: string; from: number }> {
  const out: Array<{ id: string; from: number }> = [];
  for (const u of plan.updated) {
    if (u.before.tableNo === u.after.tableNo) continue;
    for (const [id, rowKey] of ticketRow) if (rowKey === u.before.nameKey) out.push({ id, from: u.before.tableNo });
  }
  return out;
}

/**
 * 동명이인 손님의 줄 고르기(순수) — same = 그 이름의 명단 줄들(2줄 이상), pick = 폰이 보낸 고른 테이블,
 * ownKey = 이 기기가 받은 응모권 열쇠(같은 이름), movedFrom = 그 응모권을 어드민이 옮기기 전 테이블들('seat-moves').
 *  · pick 없음 = 아직 안 골랐거나 '다시 고르기'(웹 choose(null)) → 고를 목록을 보여 줘야 하니 줄 없음.
 *  · 응모권 줄이 없거나 고른 줄과 같으면 → 고른 줄(지금과 같음 — 응모권은 ticketFor 가 그 줄로 옮긴다).
 *  · 고른 테이블에 그 이름 줄이 없으면 → 응모권 줄(어드민이 다른 테이블로 옮김 — '테이블 고르기'로 떨어지지 않게).
 *  · 둘 다 있는데 다르면 → pick 이 어드민이 옮기기 전 테이블이면 응모권 줄(폰의 pick 이 옛것), 아니면 고른 줄(손님이 잘못 골랐다 다시 고름).
 */
export function resolveSameNameSeat<R extends { nameKey: string; tableNo: number }>(
  same: ReadonlyArray<R>,
  pick: number | null,
  ownKey: string | null,
  movedFrom: ReadonlyArray<number> = [],
): R | undefined {
  if (pick == null) return undefined;
  const picked = same.find((r) => r.tableNo === pick);
  const ownRow = ownKey ? same.find((r) => r.nameKey === ownKey) : undefined;
  if (!ownRow || ownRow === picked) return picked;
  if (!picked) return ownRow;
  return movedFrom.includes(pick) ? ownRow : picked;
}

/**
 * 이름 고치기로 비는 옛 열쇠(순수) — 지운 이름 목록(reception_state 'ticket-blocks')에 넣는다.
 * 같은 사람의 두 번째 폰 · 함께 쓰는 폰이 옛 이름으로 불러 응모권을 새로 받지 않게(한 사람 두 장 X).
 * 받은 기기는 기기로 먼저 찾으니 막히지 않는다. moved = 실제로 옮긴 것만, 이름 고친 그 줄 응모권만(짝 동명이인 꼬리 변화 등은 X).
 * 막는 열쇠 = 그 응모권의 옛 열쇠 + 그 줄의 옛 열쇠(명단을 고쳐 응모권 열쇠가 줄 열쇠와 어긋나 있었으면 둘이 다르다 — 손님 폰은 줄 열쇠로 부른다).
 */
export function renameBlocks(
  plan: SeatEditPlan,
  moved: ReadonlyArray<TicketMove>,
  ticketRow: ReadonlyMap<string, string>,
  tickets: ReadonlyArray<{ id: string; name: string }>,
): Array<{ nameKey: string; name: string; reason: 'rename' }> {
  if (!plan.renamed) return [];
  const out: Array<{ nameKey: string; name: string; reason: 'rename' }> = [];
  for (const m of moved) {
    if (m.from === m.to || ticketRow.get(m.id) !== plan.renamed.fromKey) continue;
    const name = tickets.find((t) => t.id === m.id)?.name ?? m.from;
    for (const k of [m.from, plan.renamed.fromKey]) if (!out.some((o) => o.nameKey === k)) out.push({ nameKey: k, name, reason: 'rename' });
  }
  return out;
}

/**
 * 이번 고치기로 명단 줄에 새로 붙은 열쇠(순수) — 새 줄 + 열쇠가 바뀐 줄의 새 열쇠. 지운 이름 목록에 있으면 푼다(editBlockList):
 * 어드민이 그 이름을 명단에 넣었으면 그 사람이 응모권을 받을 수 있어야 해서(예: 이름을 고쳐 비운 옛 이름을 다른 사람으로 다시 추가).
 */
export function newRowKeys(plan: SeatEditPlan): string[] {
  return [...new Set([...plan.added.map((r) => r.nameKey), ...plan.rekeys.values()])];
}

/** 지운 이름 목록 고치기(순수) — add 를 넣고(같은 열쇠는 새 시각으로), unblock 은 푼다(둘 다면 푼다) */
export function editBlockList(list: ReadonlyArray<TicketBlock>, add: ReadonlyArray<{ nameKey: string; name: string; reason?: 'rename' }>, unblock: ReadonlyArray<string>, at: string): TicketBlock[] {
  const free = new Set(unblock);
  const drop = new Set([...add.map((a) => a.nameKey), ...free]);
  return [
    ...list.filter((b) => !drop.has(b.nameKey)),
    ...add.filter((a) => !free.has(a.nameKey)).map((a) => ({ nameKey: a.nameKey, name: a.name, at, ...(a.reason ? { reason: a.reason } : {}) })),
  ];
}

'use client';

/* 송년회 테이블 배치(261122 사장 '이거 참여자 리스트에서 테이블배치로 보기로 해주고 이거 드래그엔 드롭으로 자리 위치 바꿀 수 있게끔 해줘
 * 그러면 실시간으로 자리가 바뀌게끔 또한 이름도 수정할 수 있게 해주고' + '인원도 추가할 수 있게 해줘').
 *  · 261123 사장 '좌석배치 그 도면있잖아 그거처럼 100%완전히 구현해줘' — 화면 = 사장이 만든 좌석 배정표 그림 그대로
 *    (제목 칸 · 무대 · 원탁 18개 · 원탁마다 이름 칸 8개, 좌표 = lib/reception/seat-chart.ts 그림 픽셀). 그림 전체가 폭에 맞고
 *    [크게]면 옆으로 밀어 본다(폰 · 좁은 화면은 최소 폭 1080px 로 옆 스크롤). 크기는 모두 그림 픽셀 × --u(= 그림 폭 / 2802).
 *    이름 칸 = 좌석(1 무대 쪽 위부터 시계 방향) · 빈 칸 = 흰 칸 그대로(누르면 그 자리에 사람 추가) · 한 좌석 둘이면 한 칸에 '1.이름 2.이름'.
 *    원탁(회색 원) = 그 테이블 '좌석 없이'(놓기) · 누르면 그 테이블에 사람 추가. 좌석 없는 사람은 그림의 '김정덕'처럼 칸 없이 글자만 —
 *    양 끝 원탁(5 · 12)은 바깥 아래, 나머지는 원 안 번호 밑.
 *    이름 형광펜 = 참여 단계 색(그림의 하늘색 형광펜 = 도착 · 퀴즈 노랑 · 미션 주황 · 베스트드레서 보라 · 설문 초록 · 당첨 분홍), 안 온 사람은 형광펜 없음.
 *  · 명단 밖 손님(응모권만 있음)은 그림 아래 '명단 밖' 줄 — 이름 칸으로 끌어 놓으면 명단에 추가(op add · 그 응모권이 새 줄에 붙음).
 *  · 끌어 놓기 = Pointer Events 직접(HTML5 drag 는 아이패드 사파리 터치에서 안 됨 — 터치 · 마우스 둘 다 이 길 하나).
 *    마우스 = 누르고 6px 넘게 움직이면 끌기. 터치 · 펜 = 280ms 동안 10px 안에서 꾹 누르면 들림 — 그 전에 움직이면 끌기는 접고 판 스크롤(칩도
 *    touch-action: manipulation, 들린 뒤에만 touchmove 를 막음). 그 전에 떼면 탭(이름 고치기 · 자리 옮기기 · 빼기 창), 꾹 눌렀다 제자리에서 떼도 창.
 *    손가락을 따라 떠다니는 복제 칸(body 포털), 놓을 곳 강조 + 무엇이 될지 한 줄, Esc · pointercancel 이면 취소.
 *    화면 위·아래(그림이 옆으로 넘치면 그림 왼쪽·오른쪽도) 가장자리 띠에서 자동 스크롤 — 띠 경계 0 부터 깊이의 제곱 · 지난 시간 기준 속도,
 *    띠 안에서 들었으면 더 가장자리로 가야 켜짐.
 *    동명이인끼리는 못 맞바꾼다(바꿔도 명단이 그대로 — 서버도 거절).
 *    다른 사람 이름 위 = 자리 맞바꾸기(swap) · 빈 이름 칸 = 그 좌석으로(move) · 원탁 = 그 테이블 좌석 없이(move).
 *  · 놓는 순간 화면에 먼저 반영(낙관) → refreshAfter(서버 POST seats/edit → 참여자 판 fresh) → 실패면 되돌리고 알림.
 *    저장 중엔 2초 폴링 값 위에 낙관 값을 덮어 그린다(덮개는 '그 사람을 그 자리로' 같은 절대값이라 서버가 이미 반영한 폴링에 또 덮어도 그대로).
 *    끄는 동안엔 판을 멈춰 둔다 — 폴링이 칩을 옮겨 손가락 밑이 바뀌지 않게.
 *  · 손님 앱은 15초마다 자기 자리를 다시 받는다(useReceptionMe) — 서버 명단만 바뀌면 손님 자리도 따라 바뀐다.
 *  · 같은 테이블에 같은 이름은 못 둔다(서버 parseSeatRows) — 놓기 전에 빨간 강조 + 이유, 놓으면 알림만(요청 안 보냄).
 *  · 글자 굵기 최대 700 · 그라데이션 · 글로우 없음 · 움직임 줄이기면 전환 없음. */
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { adminAlert, adminConfirm } from '../../_components/adminDialog';
import {
  adminErrorText,
  kstHm,
  personStage,
  receptionNameKey,
  stageTagText,
  ticketLabel,
  type PersonRow,
  type PersonStage,
} from '../../_components/receptionAdmin';
import { seatsEdit, type SeatEditOp } from '../../_components/receptionSeatsApi';
import { SEATS_PER_TABLE, TABLE_COUNT } from '@/lib/reception/event';
import {
  CHART_BOX,
  CHART_H,
  CHART_LOOSE_OUT,
  CHART_SEATS,
  CHART_STAGE,
  CHART_TABLE_R,
  CHART_TABLES,
  CHART_TITLE,
  CHART_LOOSE_IN_MAX,
  CHART_W,
  chartLooseSize,
  chartNameSize,
} from '@/lib/reception/seat-chart';
import './seat-board.css';

export interface SeatBoardProps {
  people: PersonRow[];
  nowMs: number;
  reduce: boolean;
  /** 서버를 고친 뒤 참여자 판을 fresh 로 다시 받아 화면에 넣는 함수. 실패하면 throw */
  refreshAfter: (fn: () => Promise<unknown>) => Promise<unknown>;
  /** 화면 다른 곳에서 고치는 중 — 끌기 · 추가 · 창 단추를 잠근다 */
  busy?: boolean;
}

/** 마우스 끌기 시작 거리 — 이보다 덜 움직이고 떼면 클릭 */
const DRAG_START_PX = 6;
/**
 * 터치 · 펜은 꾹 눌러야 들린다(판을 쓸어 스크롤하려던 손짓이 칩에서 시작해도 끌기가 되지 않게 — dnd-kit TouchSensor 의 delay + tolerance).
 * 이 시간 동안 TOUCH_SLOP_PX 안에 머물면 들고, 그 전에 더 움직이면 끌기는 접고 스크롤을 브라우저에 맡긴다. 탭 허용 거리도 같은 값(iOS 약 10px)
 */
const LONG_PRESS_MS = 280;
const TOUCH_SLOP_PX = 10;
/** 자동 스크롤이 도는 가장자리 폭 */
const EDGE_PX = 72;
/** 끌기를 띠 안에서 시작했으면 띠 밖으로 나갔다 오거나 그 가장자리 쪽으로 이만큼 더 가야 자동 스크롤을 켠다 */
const EDGE_REARM_PX = 16;
/** 자동 스크롤 최고 속도(px/ms) — 띠 경계 0 에서 가장자리까지 깊이의 제곱으로 오른다. 프레임 수가 아니라 지난 시간으로 계산(120Hz 화면도 같은 속도) */
const EDGE_MAX_SPEED = 1.4;
/** 서버 NAME_MAX 와 같게 */
const NAME_MAX = 20;
const TABLES = Array.from({ length: TABLE_COUNT }, (_, i) => i + 1);
const SEATS = Array.from({ length: SEATS_PER_TABLE }, (_, i) => i + 1);
/** 배정표 크기 — 맞춤(폭에 맞게) · 크게(옆으로 밀기) */
const ZOOMS = [
  { z: 1, label: '전체' },
  { z: 1.5, label: '크게' },
  { z: 2, label: '더 크게' },
] as const;
const ZOOM_KEY = 'rcp-board-zoom';
/** 그림 픽셀 n → CSS 길이(--u = 그림 폭 / 2802) */
const U = (n: number) => `calc(var(--u) * ${Math.round(n * 10) / 10})`;

interface Line {
  p: PersonRow;
  stage: PersonStage;
  tag: string | null;
}

type Target =
  | { kind: 'chip'; key: string }
  | { kind: 'seat'; table: number; seat: number }
  | { kind: 'noseat'; table: number }
  | { kind: 'table'; table: number };

/** 낙관 덮개 — 전부 절대값(같은 덮개를 두 번 덮어도 같은 결과) */
type Patch =
  | { t: 'place'; key: string; table: number; seat: number | null }
  | { t: 'name'; key: string; name: string }
  | { t: 'drop'; key: string }
  | { t: 'add'; tempKey: string; fromKey: string | null; name: string; table: number; seat: number | null };

interface Plan {
  op: SeatEditOp;
  patches: Patch[];
  /** 끄는 동안 복제 칩 밑에 보이는 한 줄 */
  hint: string;
  /** 못 놓는 까닭(같은 테이블 같은 이름 · 같은 이름끼리 맞바꾸기) — 있으면 요청을 안 보낸다 */
  bad?: string;
  /** 놓았을 때 알림 둘째 줄(없으면 같은 테이블 같은 이름 안내) */
  why?: string;
  failText: string;
}

interface Pending {
  id: number;
  patches: Patch[];
  /** 서버엔 들어갔는데 판을 못 다시 받음 — 다음 폴링 값이 오면 걷는다 */
  landed: boolean;
}

interface DragState {
  pointerId: number;
  key: string;
  el: HTMLElement;
  sx: number;
  sy: number;
  x: number;
  y: number;
  ox: number;
  oy: number;
  w: number;
  active: boolean;
  plan: Plan | null;
  /** 터치 · 펜 — 꾹 눌러야 들림 */
  touch: boolean;
  /** 꾹 누르기 타이머 */
  timer: number;
  /** 들린 곳(자동 스크롤 띠 판단) · 띠별 켜짐 · 지난 프레임 시각 · 1px 안 되는 스크롤 모아 두기 */
  ly: number;
  armTop: boolean;
  armBottom: boolean;
  last: number;
  acc: number;
  /** 배정표가 옆으로 넘칠 때 — 왼쪽 · 오른쪽 띠 */
  lx: number;
  armLeft: boolean;
  armRight: boolean;
  accX: number;
  /** 배정표 이름 칸에서 들었음(복제 칸을 그림 모양으로) · 그때 그림 1px 의 화면 px · 원래 이름 글자 크기(px) */
  chart: boolean;
  u: number;
  fs: number;
}

/** add.seat — undefined = 첫 빈 좌석을 골라 둠 · loose = 원탁 안에 다 못 그린 좌석 없는 사람 목록 */
type Sheet = { kind: 'person'; key: string } | { kind: 'add'; table: number; seat?: number | null } | { kind: 'loose'; table: number };

/** 서버 cleanName 과 같게 — 제어 문자 제거 · 겹친 띄어쓰기 하나로 · 1~20자 */
function cleanName(v: string): string | null {
  const s = v.replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim();
  if (!s || [...s].length > NAME_MAX) return null;
  return s;
}

const targetId = (t: Target) =>
  t.kind === 'chip' ? `chip:${t.key}` : t.kind === 'seat' ? `seat:${t.table}:${t.seat}` : t.kind === 'noseat' ? `noseat:${t.table}` : `table:${t.table}`;

const seatText = (table: number, seat: number | null) => `${table}번 테이블${seat != null ? ` ${seat}번` : ' 좌석 없음'}`;
const sameNameText = (table: number, name: string) => `${table}번 테이블에 이미 ${name} 님이 있어요`;

/** 새로 넣는 사람(서버 응답 전 낙관 칩) — 참여자 판 줄 모양에 빈 값 */
function blankPerson(key: string, name: string, table: number, seat: number | null): PersonRow {
  return {
    key, name, listed: true, table, seat,
    arrivedAt: null, ticket: null, quizAt: null, quizCount: 0, photo: null, votedAt: null,
    likesUsed: 0, empathiesUsed: 0, surveyAt: null, win: null, challenges: [], devices: 0, lastSeenAt: null,
  } as PersonRow;
}

function applyPatches(rows: PersonRow[], patches: Patch[]): PersonRow[] {
  let out = rows;
  for (const p of patches) {
    switch (p.t) {
      case 'place':
        out = out.map((r) => (r.key === p.key && r.listed ? { ...r, table: p.table, seat: p.seat } : r));
        break;
      case 'name':
        out = out.map((r) => (r.key === p.key ? { ...r, name: p.name } : r));
        break;
      case 'drop':
        // 명단에서 빼도 응모권이 있으면 명단 밖 손님으로 남는다(서버와 같게)
        out = out.flatMap((r) => (r.key !== p.key || !r.listed ? [r] : r.ticket ? [{ ...r, key: `x:${r.key}`, listed: false, table: null, seat: null }] : []));
        break;
      case 'add': {
        const k = receptionNameKey(p.name);
        // 서버가 이미 넣은 폴링 값이면 또 넣지 않는다
        if (out.some((r) => r.listed && r.table === p.table && receptionNameKey(r.name) === k)) break;
        const from = p.fromKey ? out.find((r) => r.key === p.fromKey && !r.listed) : undefined;
        const row = from ? { ...from, key: p.tempKey, listed: true, table: p.table, seat: p.seat } : blankPerson(p.tempKey, p.name, p.table, p.seat);
        out = [...out.filter((r) => r !== from), row];
        break;
      }
    }
  }
  return out;
}

/**
 * 놓을 곳 → 무엇을 할지(순수). null = 할 것 없음(제자리 등).
 * 다른 사람 칩 = 맞바꾸기 · 좌석 칸 = 그 좌석으로 · 좌석 없음 칸 / 카드 빈 곳 = 좌석 없이. 명단 밖 손님은 어디든 '명단에 넣기'.
 */
function planDrop(rows: PersonRow[], from: PersonRow, target: Target, tempKey: string): Plan | null {
  const clash = (name: string, table: number, skip: string[]) =>
    rows.some((r) => r.listed && r.table === table && !skip.includes(r.key) && receptionNameKey(r.name) === receptionNameKey(name));
  let table: number;
  let seat: number | null;
  if (target.kind === 'chip') {
    const o = rows.find((r) => r.key === target.key);
    if (!o || !o.listed || o.key === from.key || o.table == null) return null;
    if (from.listed && from.table != null) {
      if (o.table === from.table && o.seat === from.seat) return null; // 한 좌석 두 사람끼리 = 그대로
      if (receptionNameKey(o.name) === receptionNameKey(from.name)) {
        // 동명이인끼리 — 이름 · 테이블 · 좌석이 그대로라 바꿔도 명단이 안 바뀐다(서버도 거절, SAME_NAME_SWAP)
        return {
          op: { op: 'swap', nameKey: from.key, otherKey: o.key },
          patches: [],
          hint: '',
          bad: '같은 이름끼리는 바꿀 수 없어요',
          why: '바꿔도 명단이 그대로예요. 다른 자리로 옮겨 주세요.',
          failText: '자리를 바꾸지 못했어요',
        };
      }
      const bad = clash(from.name, o.table, [from.key, o.key])
        ? sameNameText(o.table, from.name)
        : clash(o.name, from.table, [from.key, o.key])
          ? sameNameText(from.table, o.name)
          : undefined;
      return {
        op: { op: 'swap', nameKey: from.key, otherKey: o.key },
        patches: [
          { t: 'place', key: from.key, table: o.table, seat: o.seat },
          { t: 'place', key: o.key, table: from.table, seat: from.seat },
        ],
        hint: `${o.name} 님과 자리 바꾸기`,
        bad,
        failText: '자리를 바꾸지 못했어요',
      };
    }
    table = o.table; // 명단 밖 손님을 사람 위에 = 그 좌석에 같이
    seat = o.seat;
  } else if (target.kind === 'seat') {
    table = target.table;
    seat = target.seat;
  } else if (target.kind === 'noseat') {
    table = target.table;
    seat = null;
  } else {
    if (from.listed && from.table === target.table) return null; // 같은 카드 빈 곳에 떨어뜨림 — 좌석을 지우지 않는다
    table = target.table;
    seat = null;
  }
  if (from.listed && from.table === table && from.seat === seat) return null;
  const bad = clash(from.name, table, [from.key]) ? sameNameText(table, from.name) : undefined;
  if (!from.listed) {
    return {
      op: { op: 'add', name: from.name, table, seat, ...(from.ticket ? { ticketId: from.ticket.id } : {}) },
      patches: [{ t: 'add', tempKey, fromKey: from.key, name: from.name, table, seat }],
      hint: `${seatText(table, seat)} · 명단에 넣기`,
      bad,
      failText: '명단에 넣지 못했어요',
    };
  }
  return {
    op: { op: 'move', nameKey: from.key, table, seat },
    patches: [{ t: 'place', key: from.key, table, seat }],
    hint: seat != null ? `${table}번 테이블 ${seat}번 자리로` : `${table}번 테이블로(좌석 없이)`,
    bad,
    failText: '자리를 옮기지 못했어요',
  };
}

/** 띠 깊이(0 = 경계 · 1 = 가장자리) → 속도(px/ms). 경계에서 0 부터 */
const edgeSpeed = (f: number) => EDGE_MAX_SPEED * Math.min(Math.max(f, 0), 1) ** 2;

/** 끌기 중 스크롤할 칸 — 가까운 조상 중 세로로 스크롤되는 것(어드민 = .adm-main). 없으면 창 */
function findScroller(el: HTMLElement | null): HTMLElement | null {
  for (let n = el?.parentElement ?? null; n; n = n.parentElement) {
    const oy = getComputedStyle(n).overflowY;
    if ((oy === 'auto' || oy === 'scroll') && n.scrollHeight > n.clientHeight + 1) return n;
  }
  return null;
}

export function SeatBoard({ people, nowMs, reduce, refreshAfter, busy = false }: SeatBoardProps) {
  const [pending, setPending] = useState<Pending | null>(null);
  const [frozen, setFrozen] = useState<PersonRow[] | null>(null);
  const [dragKey, setDragKey] = useState<string | null>(null);
  const [over, setOver] = useState<{ id: string; hint: string; bad: boolean } | null>(null);
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [zoom, setZoomState] = useState<number>(1);

  const seq = useRef(0);
  const drag = useRef<DragState | null>(null);
  const ghostRef = useRef<HTMLDivElement | null>(null);
  const boardRef = useRef<HTMLDivElement | null>(null);
  const scroller = useRef<HTMLElement | null>(null);
  /** 배정표 옆 스크롤 칸 · 그림 */
  const chartScroll = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const raf = useRef(0);
  /** 끌기 · 접은 누르기 뒤 같은 칩에 따라오는 click 은 창을 열지 않는다(다음 pointerdown 에서 풂) */
  const swallowClick = useRef(false);
  /** 확인창을 기다리는 중 — 한글 입력 Enter 두 번 등으로 같은 창이 두 번 뜨지 않게 */
  const asking = useRef(false);

  const live = useMemo(() => (pending ? applyPatches(people, pending.patches) : people), [people, pending]);
  const rows = frozen ?? live;
  const saving = !!pending && !pending.landed;
  const locked = saving || busy;

  // 서버엔 들어갔는데 판을 못 다시 받은 덮개 — 다음 폴링 값이 오면 걷는다
  useEffect(() => {
    setPending((cur) => (cur?.landed ? null : cur));
  }, [people]);

  // 배정표 크기 — 이 기기에 기억(그리기는 서버와 같게 1 로 시작, 붙은 뒤 읽음)
  useEffect(() => {
    try {
      const v = Number(window.localStorage.getItem(ZOOM_KEY));
      if (ZOOMS.some((o) => o.z === v)) setZoomState(v);
    } catch {
      /* 저장소를 못 쓰면 전체 */
    }
  }, []);
  const setZoom = (z: number) => {
    const el = chartScroll.current;
    // 보던 가운데를 그대로 두고 키운다
    const mid = el && el.scrollWidth > 0 ? (el.scrollLeft + el.clientWidth / 2) / el.scrollWidth : 0.5;
    setZoomState(z);
    try {
      window.localStorage.setItem(ZOOM_KEY, String(z));
    } catch {
      /* 저장소를 못 쓰면 이번만 */
    }
    requestAnimationFrame(() => {
      const e2 = chartScroll.current;
      if (e2) e2.scrollLeft = Math.max(0, mid * e2.scrollWidth - e2.clientWidth / 2);
    });
  };

  const board = useMemo(() => {
    const tables = TABLES.map((table) => ({ table, seats: SEATS.map(() => [] as Line[]), loose: [] as Line[], total: 0, arrived: 0 }));
    const out: Line[] = [];
    const byKey = new Map<string, Line>();
    let listed = 0;
    let arrived = 0;
    for (const p of rows) {
      const stage = personStage(p).stage;
      const line: Line = { p, stage, tag: stageTagText(p, stage, nowMs) };
      byKey.set(p.key, line);
      const t = p.listed && p.table != null ? tables[p.table - 1] : undefined;
      if (!t) {
        out.push(line);
        continue;
      }
      listed += 1;
      t.total += 1;
      if (stage !== 'none') {
        t.arrived += 1;
        arrived += 1;
      }
      if (p.seat != null && p.seat >= 1 && p.seat <= SEATS_PER_TABLE) t.seats[p.seat - 1].push(line);
      else t.loose.push(line);
    }
    const byName = (a: Line, b: Line) => a.p.name.localeCompare(b.p.name, 'ko') || (a.p.key < b.p.key ? -1 : a.p.key > b.p.key ? 1 : 0);
    // 한 좌석 둘(그림 '1.이연주 2.문혜정') — 먼저 온 사람이 1번, 둘 다 안 왔으면 이름 순
    const byArrival = (a: Line, b: Line) => {
      const x = a.p.arrivedAt ? Date.parse(a.p.arrivedAt) : Infinity;
      const y = b.p.arrivedAt ? Date.parse(b.p.arrivedAt) : Infinity;
      return x !== y ? (x < y ? -1 : 1) : byName(a, b);
    };
    for (const t of tables) {
      t.seats.forEach((s) => s.sort(byArrival));
      t.loose.sort(byArrival);
    }
    out.sort((a, b) => (a.p.ticket?.number ?? Infinity) - (b.p.ticket?.number ?? Infinity) || byName(a, b));
    return { tables, out, byKey, listed, arrived };
  }, [rows, nowMs]);

  /** 서버에 한 건 — 먼저 화면에 덮고(낙관) → 고치고 판 다시 받기 → 실패면 덮개를 걷고 알림 */
  const commit = useCallback(
    async (plan: Plan): Promise<boolean> => {
      if (plan.bad) {
        await adminAlert(`${plan.bad}\n${plan.why ?? '같은 테이블엔 같은 이름을 둘 수 없어요.'}`);
        return false;
      }
      const id = ++seq.current;
      setPending((cur) => ({ id, patches: cur?.landed ? [...cur.patches, ...plan.patches] : plan.patches, landed: false }));
      let saved = false;
      try {
        await refreshAfter(async () => {
          const r = await seatsEdit(plan.op);
          saved = true;
          return r;
        });
        setPending((cur) => (cur?.id === id ? null : cur));
        return true;
      } catch (e) {
        if (saved) {
          // 서버엔 들어감 — 판만 못 받음. 덮개를 남겨 두었다가 다음 폴링이 오면 걷는다(되돌아갔다 돌아오는 깜빡임 없게)
          setPending((cur) => (cur?.id === id ? { ...cur, landed: true } : cur));
          return true;
        }
        setPending((cur) => (cur?.id === id ? null : cur));
        await adminAlert(`${plan.failText}\n${adminErrorText(e)}`);
        return false;
      }
    },
    [refreshAfter],
  );

  // 창 이벤트 처리기(한 번만 붙임)가 늘 최신 값을 보게
  const latest = useRef({ rows, board, locked, commit });
  latest.current = { rows, board, locked, commit };

  // ───── 끌어 놓기(Pointer Events) ─────

  const hitTest = (d: DragState): Target | null => {
    const el = document.elementFromPoint(d.x, d.y) as HTMLElement | null;
    const root = boardRef.current;
    if (!el || !root || !root.contains(el)) return null;
    const chip = el.closest<HTMLElement>('[data-sb-chip]');
    const chipKey = chip?.dataset.sbChip;
    if (chip && chipKey && chipKey !== d.key && chip.dataset.sbListed === '1') return { kind: 'chip', key: chipKey };
    const zone = el.closest<HTMLElement>('[data-sb-drop]');
    const table = Number(zone?.dataset.table);
    if (!zone || !Number.isInteger(table) || table < 1) return null;
    if (zone.dataset.sbDrop === 'seat') {
      const seat = Number(zone.dataset.seat);
      return Number.isInteger(seat) ? { kind: 'seat', table, seat } : null;
    }
    if (zone.dataset.sbDrop === 'noseat') return { kind: 'noseat', table };
    return { kind: 'table', table };
  };

  const updateOver = (d: DragState) => {
    const target = hitTest(d);
    const from = latest.current.board.byKey.get(d.key)?.p;
    const plan = target && from ? planDrop(latest.current.rows, from, target, `tmp:${seq.current + 1}`) : null;
    d.plan = plan;
    const next = plan && target ? { id: targetId(target), hint: plan.bad || plan.hint, bad: !!plan.bad } : null;
    setOver((prev) => (prev?.id === next?.id && prev?.hint === next?.hint && prev?.bad === next?.bad ? prev : next));
  };

  const placeGhost = (d: DragState) => {
    const g = ghostRef.current;
    if (g) g.style.transform = `translate3d(${Math.round(d.x - d.ox)}px, ${Math.round(d.y - d.oy)}px, 0)`;
  };

  /** 스크롤 칸의 보이는 위 · 아래(화면 안으로 자름) */
  const edges = () => {
    const r = scroller.current?.getBoundingClientRect();
    return { top: Math.max(r ? r.top : 0, 0), bottom: Math.min(r ? r.bottom : window.innerHeight, window.innerHeight) };
  };

  const tick = (now: number) => {
    const d = drag.current;
    if (!d?.active) return;
    const dt = Math.min(Math.max(now - d.last, 0), 50); // 탭이 숨었다 돌아오면 한 번에 튀지 않게
    d.last = now;
    const sc = scroller.current;
    const { top, bottom } = edges();
    // 띠 안에서 들었으면 손가락을 그 가장자리 쪽으로 더 가져가거나 띠 밖에 나갔다 와야 켠다(들자마자 판이 달아나지 않게)
    if (!d.armTop && (d.y >= top + EDGE_PX || d.y <= d.ly - EDGE_REARM_PX)) d.armTop = true;
    if (!d.armBottom && (d.y <= bottom - EDGE_PX || d.y >= d.ly + EDGE_REARM_PX)) d.armBottom = true;
    let v = 0;
    if (d.armTop && d.y < top + EDGE_PX) v = -edgeSpeed((top + EDGE_PX - d.y) / EDGE_PX);
    else if (d.armBottom && d.y > bottom - EDGE_PX) v = edgeSpeed((d.y - (bottom - EDGE_PX)) / EDGE_PX);
    let moved = false;
    if (v) {
      d.acc += v * dt;
      const step = Math.trunc(d.acc);
      if (step) {
        d.acc -= step;
        const before = sc ? sc.scrollTop : window.scrollY;
        if (sc) sc.scrollTop += step;
        else window.scrollBy(0, step);
        if ((sc ? sc.scrollTop : window.scrollY) !== before) moved = true;
        else d.acc = 0; // 끝까지 감
      }
    } else d.acc = 0;
    // 배정표가 옆으로 넘칠 때(크게 · 좁은 화면) — 그림 왼쪽 · 오른쪽 띠, 손가락이 그림 높이 안일 때만
    const hs = chartScroll.current;
    let vx = 0;
    if (hs && hs.scrollWidth > hs.clientWidth + 1) {
      const r = hs.getBoundingClientRect();
      const left = Math.max(r.left, 0);
      const right = Math.min(r.right, window.innerWidth);
      if (!d.armLeft && (d.x >= left + EDGE_PX || d.x <= d.lx - EDGE_REARM_PX)) d.armLeft = true;
      if (!d.armRight && (d.x <= right - EDGE_PX || d.x >= d.lx + EDGE_REARM_PX)) d.armRight = true;
      if (d.y >= r.top && d.y <= r.bottom) {
        if (d.armLeft && d.x < left + EDGE_PX) vx = -edgeSpeed((left + EDGE_PX - d.x) / EDGE_PX);
        else if (d.armRight && d.x > right - EDGE_PX) vx = edgeSpeed((d.x - (right - EDGE_PX)) / EDGE_PX);
      }
    }
    if (hs && vx) {
      d.accX += vx * dt;
      const step = Math.trunc(d.accX);
      if (step) {
        d.accX -= step;
        const before = hs.scrollLeft;
        hs.scrollLeft += step;
        if (hs.scrollLeft !== before) moved = true;
        else d.accX = 0;
      }
    } else d.accX = 0;
    if (moved) updateOver(d);
    raf.current = requestAnimationFrame(tick);
  };

  const startDrag = (d: DragState) => {
    d.active = true;
    scroller.current = findScroller(boardRef.current);
    const { top, bottom } = edges();
    d.ly = d.y;
    d.armTop = d.y >= top + EDGE_PX;
    d.armBottom = d.y <= bottom - EDGE_PX;
    d.last = performance.now();
    d.acc = 0;
    const hr = chartScroll.current?.getBoundingClientRect();
    d.lx = d.x;
    d.armLeft = !hr || d.x >= Math.max(hr.left, 0) + EDGE_PX;
    d.armRight = !hr || d.x <= Math.min(hr.right, window.innerWidth) - EDGE_PX;
    d.accX = 0;
    setFrozen(latest.current.rows);
    setDragKey(d.key);
    document.body.classList.add('sb-dragging');
    cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(tick);
  };

  /** 들기 전 누르기를 접는다(터치가 먼저 움직임 = 스크롤 · 저장 중) — 따라오는 click 도 창을 열지 않게 */
  const dropPress = (d: DragState) => {
    window.clearTimeout(d.timer);
    if (drag.current === d) drag.current = null;
    swallowClick.current = true;
    try {
      if (d.el.hasPointerCapture?.(d.pointerId)) d.el.releasePointerCapture(d.pointerId);
    } catch {
      /* 칩이 이미 빠졌으면 그대로 */
    }
  };

  const finishDrag = (mode: 'drop' | 'cancel') => {
    const d = drag.current;
    drag.current = null;
    cancelAnimationFrame(raf.current);
    if (!d) return;
    window.clearTimeout(d.timer);
    try {
      if (d.el.hasPointerCapture?.(d.pointerId)) d.el.releasePointerCapture(d.pointerId);
    } catch {
      /* 칩이 이미 빠졌으면 그대로 */
    }
    if (!d.active) return;
    // 끈 뒤 같은 칩에 따라오는 click(마우스 · 포인터 캡처)은 탭으로 치지 않는다
    swallowClick.current = true;
    document.body.classList.remove('sb-dragging');
    setDragKey(null);
    setOver(null);
    setFrozen(null);
    if (mode !== 'drop') return;
    if (d.plan) void latest.current.commit(d.plan);
    // 꾹 눌러 들었다가 제자리에서 뗌 — 탭처럼 창을 연다(뒤따르는 click 은 위에서 막음)
    else if (d.touch && Math.hypot(d.x - d.sx, d.y - d.sy) < TOUCH_SLOP_PX) setSheet({ kind: 'person', key: d.key });
  };

  /** 꾹 누르기가 찼다 — 들기(터치 · 펜) */
  const lift = (d: DragState) => {
    if (drag.current !== d || d.active) return;
    if (latest.current.locked) {
      dropPress(d);
      return;
    }
    startDrag(d);
    updateOver(d);
    try {
      navigator.vibrate?.(8);
    } catch {
      /* 진동이 없는 기기(아이패드)는 그대로 */
    }
  };

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const d = drag.current;
      if (!d || e.pointerId !== d.pointerId) return;
      d.x = e.clientX;
      d.y = e.clientY;
      if (!d.active) {
        const dist = Math.hypot(d.x - d.sx, d.y - d.sy);
        if (d.touch) {
          // 들리기 전에 움직임 = 판을 쓸어 스크롤하려는 손짓 — 끌기는 접고 브라우저에 맡긴다(이어지는 pointercancel 도 그대로)
          if (dist > TOUCH_SLOP_PX) dropPress(d);
          return;
        }
        if (dist < DRAG_START_PX) return;
        if (latest.current.locked) {
          // 저장 중엔 끌기 없음 — 떼면 따라오는 click 도 창을 열지 않게
          dropPress(d);
          return;
        }
        startDrag(d);
      }
      if (e.cancelable) e.preventDefault();
      placeGhost(d);
      updateOver(d);
    };
    const onUp = (e: PointerEvent) => {
      const d = drag.current;
      if (!d || e.pointerId !== d.pointerId) return;
      if (d.active) {
        d.x = e.clientX;
        d.y = e.clientY;
        updateOver(d);
      }
      finishDrag('drop');
    };
    const onCancel = (e: PointerEvent) => {
      const d = drag.current;
      if (d && e.pointerId === d.pointerId) finishDrag('cancel');
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && drag.current?.active) {
        e.preventDefault();
        finishDrag('cancel');
      }
    };
    // 칩은 touch-action: manipulation(판 스크롤이 칩에서 시작해도 됨) — 들린 뒤에만 여기서 스크롤을 막는다(non-passive)
    const onTouchMove = (e: TouchEvent) => {
      if (drag.current?.active && e.cancelable) e.preventDefault();
    };
    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
    window.addEventListener('keydown', onKey);
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('touchmove', onTouchMove);
      if (drag.current) window.clearTimeout(drag.current.timer);
      drag.current = null;
      cancelAnimationFrame(raf.current);
      document.body.classList.remove('sb-dragging');
    };
    // 처리기는 ref(latest · drag)만 읽는다 — 한 번만 붙인다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onChipDown = (e: ReactPointerEvent<HTMLElement>, key: string) => {
    if (!drag.current) swallowClick.current = false; // 새 누르기 — 지난 끌기의 click 막기는 끝
    if (latest.current.locked || key.startsWith('tmp:') || drag.current) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const el = e.currentTarget;
    const chartHost = el.closest<HTMLElement>('.sc-box, .sc-loose');
    // 배정표 이름 칸에서 들면 복제 칸은 칸 크기로(한 칸 둘이면 그 줄만) — 재기만 칸으로 하고, 포인터 캡처는 이름 단추 자신에
    // (칸 div 가 캡처하면 마우스 click 이 칸으로 가서 이름 단추 onClick = 사람 창이 안 열린다, fix 261123 검토)
    const measure = chartHost && chartHost.classList.contains('sc-box') && chartHost.querySelectorAll('[data-sb-chip]').length === 1 ? chartHost : el;
    const r = measure.getBoundingClientRect();
    const touch = e.pointerType !== 'mouse';
    const cw = canvasRef.current?.getBoundingClientRect().width ?? 0;
    const d: DragState = {
      pointerId: e.pointerId, key, el,
      sx: e.clientX, sy: e.clientY, x: e.clientX, y: e.clientY,
      ox: e.clientX - r.left, oy: e.clientY - r.top, w: r.width,
      active: false, plan: null,
      touch, timer: 0, ly: e.clientY, armTop: false, armBottom: false, last: 0, acc: 0,
      lx: e.clientX, armLeft: false, armRight: false, accX: 0,
      chart: !!chartHost, u: cw > 0 ? cw / CHART_W : 0.4, fs: parseFloat(getComputedStyle(el).fontSize) || 14,
    };
    drag.current = d;
    if (touch) {
      // 터치 · 펜 — 꾹 눌러야 들림(손가락은 이미 칩에 묶여 있다 — 암묵 캡처)
      d.timer = window.setTimeout(() => lift(d), LONG_PRESS_MS);
      return;
    }
    try {
      el.setPointerCapture(e.pointerId);
    } catch {
      /* 캡처를 못 해도 창 처리기가 받는다 */
    }
  };

  const onChipClick = (e: { detail: number }, key: string) => {
    // detail 0 = 키보드로 누름(Enter · Space) — 끌기와 상관없으니 늘 연다
    if ((e.detail !== 0 && swallowClick.current) || key.startsWith('tmp:')) return;
    setSheet({ kind: 'person', key });
  };

  // ───── 창(이름 고치기 · 자리 옮기기 · 빼기 · 추가) ─────

  const closeSheet = useCallback(() => setSheet(null), []);

  /** 확인창 하나씩 — 기다리는 동안 다시 불리면(한글 입력 Enter 두 번 · 겹쳐 누름) 무시 */
  const ask = async (opts: Parameters<typeof adminConfirm>[0]): Promise<boolean | null> => {
    if (asking.current) return null;
    asking.current = true;
    try {
      return await adminConfirm(opts);
    } finally {
      asking.current = false;
    }
  };

  const doRename = async (p: PersonRow, name: string) => {
    if (asking.current) return;
    const ok = await ask({
      title: `'${p.name}' → '${name}'(으)로 바꿀까요?`,
      description:
        p.ticket
          ? `응모권(${ticketLabel(p.ticket.number)}) · 도착 · 퀴즈 · 설문 기록은 새 이름으로 따라가요. 손님 폰에는 옛 이름이 남아 있어서, 자리 안내를 보려면 앱에 새 이름을 다시 넣어야 해요.`
          : `아직 도착 전이에요. 손님이 앱에 새 이름을 넣으면 자리가 보여요.`,
      confirmText: '바꾸기',
    });
    if (!ok) return;
    setSheet(null);
    void commit({ op: { op: 'rename', nameKey: p.key, name }, patches: [{ t: 'name', key: p.key, name }], hint: '', failText: '이름을 바꾸지 못했어요' });
  };

  const doPlace = (p: PersonRow, table: number, seat: number | null) => {
    const plan = planDrop(latest.current.rows, p, seat != null ? { kind: 'seat', table, seat } : { kind: 'noseat', table }, `tmp:${seq.current + 1}`);
    setSheet(null);
    if (plan) void commit(plan);
  };

  const doRemove = async (p: PersonRow) => {
    if (asking.current) return;
    const where = p.table != null ? seatText(p.table, p.seat) : '';
    const first = await ask({
      title: `${p.name} 님을 명단에서 뺄까요?`,
      description: `테이블 배치와 손님 앱 자리 안내에서 빠져요.${p.ticket ? ` 응모권(${ticketLabel(p.ticket.number)})은 그대로라 명단 밖 손님으로 남아요.` : ''}`,
      confirmText: '뺄게요',
    });
    if (!first) return;
    const second = await ask({
      title: '정말 뺄까요?',
      description: `${p.name} 님${where ? ` · ${where}` : ''} — 다시 넣으려면 [+ 추가]로 새로 넣어야 해요.`,
      confirmText: '빼기',
    });
    if (!second) return;
    setSheet(null);
    void commit({ op: { op: 'remove', nameKey: p.key }, patches: [{ t: 'drop', key: p.key }], hint: '', failText: '명단에서 빼지 못했어요' });
  };

  const doAdd = (table: number, name: string, seat: number | null) => {
    setSheet(null);
    void commit({
      op: { op: 'add', name, table, seat },
      patches: [{ t: 'add', tempKey: `tmp:${seq.current + 1}`, fromKey: null, name, table, seat }],
      hint: '',
      bad: rows.some((r) => r.listed && r.table === table && receptionNameKey(r.name) === receptionNameKey(name)) ? sameNameText(table, name) : undefined,
      failText: '추가하지 못했어요',
    });
  };

  // ───── 그리기 ─────

  const zone = (id: string) => (over?.id === id ? (over.bad ? ' is-bad' : ' is-over') : '');

  /** 그 테이블에 사람 추가 창(seat undefined = 첫 빈 좌석) */
  const openAdd = (table: number, seat?: number | null) => {
    if (latest.current.locked) return;
    setSheet({ kind: 'add', table, seat });
  };

  const chipLabel = (line: Line) => {
    const { p } = line;
    const place = p.listed && p.table != null ? ` · ${seatText(p.table, p.seat)}` : ' · 명단 밖';
    return `${p.name}${line.tag ? ` · ${line.tag}` : ''}${place} — 눌러서 고치기, 끌어서 자리 옮기기`;
  };

  /** 명단 밖 줄 칩(기존 모양) */
  const chip = (line: Line) => {
    const { p } = line;
    const temp = p.key.startsWith('tmp:');
    return (
      <button
        key={p.key}
        type="button"
        className={`sb-chip s-${line.stage}${dragKey === p.key ? ' is-lifted' : ''}${zone(`chip:${p.key}`)}${temp ? ' is-temp' : ''}`}
        data-sb-chip={p.key}
        data-sb-listed={p.listed ? '1' : '0'}
        onPointerDown={(e) => onChipDown(e, p.key)}
        onClick={(e) => onChipClick(e, p.key)}
        onContextMenu={(e) => e.preventDefault()}
        aria-label={chipLabel(line)}
      >
        <span className="sb-chip-name">{p.name}</span>
        {line.tag && <span className="sb-chip-tag">{line.tag}</span>}
      </button>
    );
  };

  /** 배정표 이름 — 칸 안(no = 한 칸 둘일 때 1 · 2) 또는 칸 없는 글자(좌석 없음). fs = 글자 크기(그림 px) */
  const chartChip = (line: Line, no: number, fs: number) => {
    const { p } = line;
    const temp = p.key.startsWith('tmp:');
    return (
      <button
        key={p.key}
        type="button"
        className={`sc-chip s-${line.stage}${dragKey === p.key ? ' is-lifted' : ''}${zone(`chip:${p.key}`)}${temp ? ' is-temp' : ''}`}
        style={{ fontSize: U(fs) }}
        data-sb-chip={p.key}
        data-sb-listed={p.listed ? '1' : '0'}
        onPointerDown={(e) => onChipDown(e, p.key)}
        onClick={(e) => {
          e.stopPropagation(); // 원탁(누르면 추가) 위 글자
          onChipClick(e, p.key);
        }}
        onContextMenu={(e) => e.preventDefault()}
        title={line.tag ? `${p.name} · ${line.tag}` : p.name}
        aria-label={chipLabel(line)}
      >
        <span className="sc-hl">
          {no > 0 && <span className="sc-no-mark">{no}.</span>}
          {p.name}
        </span>
      </button>
    );
  };

  /** 이름 칸 강조 — 칸 자체(빈 칸 = 그 좌석으로) 또는 칸 안 사람(맞바꾸기) */
  const boxZone = (table: number, seat: number, list: Line[]) => {
    const hit = list.find((l) => over?.id === `chip:${l.p.key}`);
    if (hit && over) return over.bad ? ' is-bad' : ' is-over';
    return zone(`seat:${table}:${seat}`);
  };

  const dragLine = dragKey ? board.byKey.get(dragKey) : undefined;
  const d = drag.current;
  const sheetLine = sheet?.kind === 'person' ? board.byKey.get(sheet.key) : undefined;

  return (
    <div ref={boardRef} className={`sb${reduce ? ' sb-reduce' : ''}${dragKey ? ' is-dragging' : ''}`}>
      <div className="sb-head">
        <div className="sb-head-text">
          <p className="sb-title">
            테이블 배치
            {saving && <span className="adm-badge blue">저장 중</span>}
          </p>
          <p className="sb-sub">
            이름을 꾹 눌러 다른 칸에 끌어 놓으면 바로 자리가 바뀌어요(마우스는 바로 끌기) · 사람 위에 놓으면 서로 바꿔요 · 원탁에 놓으면 좌석 없이 ·
            이름을 누르면 고치기 · 빈 칸이나 원탁을 누르면 사람 추가 · 손님 화면엔 15초 안에 반영돼요
          </p>
        </div>
        <div className="sb-head-side">
          <span className="adm-count">
            명단 <b>{board.listed}</b>명 · 도착 <b>{board.arrived}</b>명
          </span>
          <div className="adm-seg sb-zoom" role="radiogroup" aria-label="배정표 크기">
            {ZOOMS.map((o) => (
              <button key={o.z} type="button" role="radio" aria-checked={zoom === o.z} className={zoom === o.z ? 'on' : ''} onClick={() => setZoom(o.z)}>
                {o.label}
              </button>
            ))}
          </div>
        </div>
        <div className="sc-legend" aria-label="이름 형광펜 색">
          <span className="sc-legend-item"><span className="sc-hl s-none">이름</span>아직 안 옴</span>
          <span className="sc-legend-item"><span className="sc-hl s-arrived">이름</span>도착</span>
          <span className="sc-legend-item"><span className="sc-hl s-quiz">이름</span>퀴즈</span>
          <span className="sc-legend-item"><span className="sc-hl s-mission">이름</span>미션</span>
          <span className="sc-legend-item"><span className="sc-hl s-dresser">이름</span>베스트드레서</span>
          <span className="sc-legend-item"><span className="sc-hl s-survey">이름</span>설문</span>
          <span className="sc-legend-item"><span className="sc-hl s-win">이름</span>당첨</span>
        </div>
      </div>

      <div className="sc-wrap">
        <div className="sc-scroll" ref={chartScroll}>
          <div
            ref={canvasRef}
            className="sc-canvas"
            style={{ width: `${zoom * 100}%`, minWidth: `${Math.round(1080 * zoom)}px`, aspectRatio: `${CHART_W} / ${CHART_H}` }}
            role="group"
            aria-label={`좌석 배정표 — 원탁 ${TABLE_COUNT}개 · 명단 ${board.listed}명`}
          >
            <div className="sc-title" style={{ left: U(CHART_TITLE.x), top: U(CHART_TITLE.y), width: U(CHART_TITLE.w), height: U(CHART_TITLE.h) }} aria-hidden>
              <span>{CHART_TITLE.text}</span>
              <span>{CHART_TITLE.en}</span>
            </div>
            <div className="sc-stage" style={{ left: U(CHART_STAGE.x), top: U(CHART_STAGE.y), width: U(CHART_STAGE.w), height: U(CHART_STAGE.h) }} aria-hidden>
              무대
            </div>

            {CHART_TABLES.map((ct) => {
              const t = board.tables[ct.n - 1];
              if (!t) return null;
              const out = CHART_LOOSE_OUT[ct.n];
              return (
                <div key={ct.n} className="sc-table" role="group" aria-label={`${ct.n}번 테이블 ${t.arrived}/${t.total}명 도착`}>
                  {/* 원탁 = 좌석 없이 놓는 곳 · 누르면 사람 추가 */}
                  <div
                    className={`sc-round${zone(`noseat:${ct.n}`)}`}
                    data-sb-drop="noseat"
                    data-table={ct.n}
                    style={{ left: U(ct.x - CHART_TABLE_R), top: U(ct.y - CHART_TABLE_R), width: U(CHART_TABLE_R * 2), height: U(CHART_TABLE_R * 2) }}
                    onClick={() => openAdd(ct.n)}
                  >
                    <button
                      type="button"
                      className="sc-num"
                      onClick={(e) => {
                        e.stopPropagation();
                        openAdd(ct.n);
                      }}
                      aria-label={`${ct.n}번 테이블 — ${t.arrived}/${t.total}명 도착 · 눌러서 사람 추가`}
                    >
                      {ct.n}
                    </button>
                    {!out && t.loose.length > 0 && (
                      // 원 안은 번호 밑 두 줄까지 — 그 아래는 아래 칸 자리(가려져 못 누름). 넘치면 한 명 + '외 N명'(누르면 목록 창)
                      <div className="sc-loose sc-loose-in">
                        {(t.loose.length > CHART_LOOSE_IN_MAX ? t.loose.slice(0, CHART_LOOSE_IN_MAX - 1) : t.loose).map((l) => chartChip(l, 0, chartLooseSize(l.p.name)))}
                        {t.loose.length > CHART_LOOSE_IN_MAX && (
                          <button
                            type="button"
                            className="sc-more"
                            style={{ fontSize: U(20) }}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSheet({ kind: 'loose', table: ct.n });
                            }}
                          >
                            외 {t.loose.length - (CHART_LOOSE_IN_MAX - 1)}명
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  {out && t.loose.length > 0 && (
                    <div
                      className={`sc-loose sc-loose-out ${out.align}${zone(`noseat:${ct.n}`)}`}
                      data-sb-drop="noseat"
                      data-table={ct.n}
                      style={out.align === 'left' ? { left: U(ct.x + out.dx), top: U(ct.y + out.dy) } : { right: U(CHART_W - (ct.x + out.dx)), top: U(ct.y + out.dy) }}
                    >
                      {t.loose.map((l) => chartChip(l, 0, chartNameSize(l.p.name, 1, 200)))}
                    </div>
                  )}
                  {SEATS.map((s) => {
                    const g = CHART_SEATS[s];
                    const list = t.seats[s - 1];
                    const cx = ct.x + g.dx;
                    const left = g.side === 'c' ? cx : g.side === 'l' ? cx - CHART_BOX.w / 2 : cx + CHART_BOX.w / 2;
                    // 한 칸 둘이면 옆 칸에 안 닿는 쪽으로 늘어난다(seat-chart.ts grow) · 폭은 옆 원탁 칸에 안 닿게 maxW 까지
                    const grow = g.grow ? ` grow-${g.grow}` : '';
                    const cls = `sc-box side-${g.side}${grow}${list.length ? '' : ' empty'}${list.length > 1 ? ' multi' : ''}${boxZone(ct.n, s, list)}`;
                    const style = { left: U(left), top: U(ct.y + g.dy), maxWidth: U(g.maxW) };
                    if (!list.length) {
                      return (
                        <button
                          key={s}
                          type="button"
                          className={cls}
                          style={style}
                          data-sb-drop="seat"
                          data-table={ct.n}
                          data-seat={s}
                          onClick={() => openAdd(ct.n, s)}
                          aria-label={`${ct.n}번 테이블 ${s}번 자리 비어 있음 — 눌러서 사람 추가`}
                        />
                      );
                    }
                    return (
                      <div key={s} className={cls} style={style} data-sb-drop="seat" data-table={ct.n} data-seat={s}>
                        {list.map((l, i) => chartChip(l, list.length > 1 ? i + 1 : 0, chartNameSize(l.p.name, list.length, g.maxW, list.length > 1)))}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {board.out.length > 0 && (
        <section className="sb-out" aria-label="명단 밖 손님">
          <p className="sb-out-title">
            명단 밖 <b>{board.out.length}</b>명
            <span>배정표 이름 칸으로 끌어 놓으면 명단에 들어가요</span>
          </p>
          <div className="sb-out-chips">{board.out.map(chip)}</div>
        </section>
      )}

      {dragLine && d && typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={ghostRef}
            className={`admin-shell sb-ghost${reduce ? ' sb-reduce' : ''}`}
            style={{ width: d.w, transform: `translate3d(${Math.round(d.x - d.ox)}px, ${Math.round(d.y - d.oy)}px, 0)`, '--u': `${d.u}px` } as CSSProperties}
            aria-hidden
          >
            {d.chart ? (
              // 원래 이름과 같은 글자 크기 · 글자가 길면 칸이 따라 넓어짐(min = 든 칸 폭)
              <div className={`sc-ghost-box sc-chip s-${dragLine.stage}`} style={{ fontSize: `${d.fs}px` }}>
                <span className="sc-hl">{dragLine.p.name}</span>
              </div>
            ) : (
              <div className={`sb-chip s-${dragLine.stage}`}>
                <span className="sb-chip-name">{dragLine.p.name}</span>
                {dragLine.tag && <span className="sb-chip-tag">{dragLine.tag}</span>}
              </div>
            )}
            {over && <span className={`sb-ghost-hint${over.bad ? ' bad' : ''}`}>{over.hint}</span>}
          </div>,
          document.body,
        )}

      {sheet?.kind === 'person' && (
        <PersonSheet
          key={sheet.key}
          line={sheetLine}
          rows={rows}
          nowMs={nowMs}
          locked={locked}
          onClose={closeSheet}
          onRename={doRename}
          onPlace={doPlace}
          onRemove={doRemove}
        />
      )}
      {sheet?.kind === 'loose' && (
        <LooseSheet
          table={sheet.table}
          lines={board.tables[sheet.table - 1]?.loose ?? []}
          nowMs={nowMs}
          onClose={closeSheet}
          onPick={(key) => setSheet({ kind: 'person', key })}
        />
      )}
      {sheet?.kind === 'add' && (
        <AddSheet key={`add:${sheet.table}:${sheet.seat ?? ''}`} table={sheet.table} seat={sheet.seat} rows={rows} locked={locked} onClose={closeSheet} onAdd={doAdd} />
      )}
    </div>
  );
}

/* ─── 창 ─────────────────────────────────────────────────────────── */

function SheetFrame({ label, title, onClose, children }: { label: string; title: ReactNode; onClose: () => void; children: ReactNode }) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const r = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(r);
  }, []);
  useEffect(() => {
    // 위에 확인창(adminDialog)이 떠 있으면 그쪽이 먼저 Esc 를 받는다(defaultPrevented)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented) {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  if (typeof document === 'undefined') return null;
  return createPortal(
    <div className={`admin-shell adm-modal-root sb-sheet-root${shown ? ' on' : ''}`} role="dialog" aria-modal="true" aria-label={label}>
      <button type="button" className="adm-modal-dim" aria-label="닫기" onClick={onClose} />
      <div className="adm-modal sb-sheet">
        <p className="adm-modal-title">{title}</p>
        {children}
      </div>
    </div>,
    document.body,
  );
}

/** 좌석 고르기 — 좌석 없음 + 1~8(앉은 사람 이름 같이) */
function SeatSelect({ rows, table, value, skipKey, onChange, id }: { rows: PersonRow[]; table: number; value: number | null; skipKey?: string; onChange: (v: number | null) => void; id: string }) {
  return (
    <select id={id} className="adm-input sb-select" value={value ?? ''} onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}>
      <option value="">좌석 없음</option>
      {SEATS.map((n) => {
        const names = rows.filter((r) => r.listed && r.table === table && r.seat === n && r.key !== skipKey).map((r) => r.name);
        return (
          <option key={n} value={n}>
            {n}번{names.length ? ` · ${names.join(', ')}` : ''}
          </option>
        );
      })}
    </select>
  );
}

function PersonSheet({
  line,
  rows,
  nowMs,
  locked,
  onClose,
  onRename,
  onPlace,
  onRemove,
}: {
  line: Line | undefined;
  rows: PersonRow[];
  nowMs: number;
  locked: boolean;
  onClose: () => void;
  onRename: (p: PersonRow, name: string) => void;
  onPlace: (p: PersonRow, table: number, seat: number | null) => void;
  onRemove: (p: PersonRow) => void;
}) {
  const p = line?.p;
  const [name, setName] = useState(p?.name ?? '');
  const [table, setTable] = useState<number>(p?.table ?? 1);
  const [seat, setSeat] = useState<number | null>(p?.listed ? p.seat : null);

  if (!p || !line) {
    return (
      <SheetFrame label="사람" title="이 사람을 찾을 수 없어요" onClose={onClose}>
        <p className="adm-modal-note">방금 다른 곳에서 명단이 바뀌었어요. 닫고 다시 눌러 주세요.</p>
        <div className="adm-modal-actions">
          <span className="grow" />
          <button type="button" className="adm-btn" onClick={onClose}>닫기</button>
        </div>
      </SheetFrame>
    );
  }

  const tag = stageTagText(p, line.stage, nowMs);
  const clean = cleanName(name);
  const key = clean ? receptionNameKey(clean) : '';
  const nameClash = !!(p.listed && clean && rows.some((r) => r.listed && r.key !== p.key && r.table === p.table && receptionNameKey(r.name) === key));
  const nameErr = !name.trim() ? '이름을 넣어 주세요.' : !clean ? `이름은 ${NAME_MAX}자까지예요.` : nameClash ? '같은 테이블에 같은 이름이 있어요.' : null;
  // 같은 이름이 둘 이상인데 이 사람은 이미 도착(응모권) — 이름 고치기 · 빼기 X(서버도 400). 남은 짝 열쇠의 꼬리가 떨어져
  // 이 사람 폰이 옛 이름으로 짝의 자리 · 응모권을 받게 된다(fix 261123 교차 검토). 자리 옮기기는 괜찮다
  const twinArrived = p.listed && !!p.ticket && rows.filter((r) => r.listed && receptionNameKey(r.name) === receptionNameKey(p.name)).length > 1;
  const canRename = p.listed && !!clean && clean !== p.name && !nameErr && !locked && !twinArrived;

  const placeSame = p.listed && table === p.table && seat === p.seat;
  const placeClash = rows.some((r) => r.listed && r.key !== p.key && r.table === table && receptionNameKey(r.name) === receptionNameKey(p.name));
  const canPlace = !placeSame && !placeClash && !locked;

  return (
    <SheetFrame label={`${p.name} 고치기`} title={p.name} onClose={onClose}>
      <div className="sb-sheet-who">
        <span className={`sb-tag s-${line.stage}`}>{tag || '아직 안 왔어요'}</span>
        <span className="sb-sheet-meta">
          {p.listed && p.table != null ? seatText(p.table, p.seat) : '명단 밖 손님'}
          {p.ticket ? ` · ${ticketLabel(p.ticket.number)}${kstHm(p.arrivedAt) ? ` · ${kstHm(p.arrivedAt)} 도착` : ''}` : ''}
        </span>
      </div>

      {p.listed && (
        <div className="sb-sheet-sec">
          <label className="adm-label" htmlFor="sb-rename">이름</label>
          <div className="sb-sheet-row">
            <input
              id="sb-rename"
              className="adm-input sb-input"
              value={name}
              maxLength={40}
              autoComplete="off"
              enterKeyHint="done"
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                // 한글 조합 중 Enter — 크롬은 keydown 을 두 번 보낸다(조합 끝 + Enter). 조합 쪽은 버려야 확인창이 저절로 닫히지 않는다
                if (e.nativeEvent.isComposing || e.keyCode === 229) return;
                if (e.key === 'Enter' && canRename && clean) {
                  e.preventDefault();
                  onRename(p, clean);
                }
              }}
            />
            <button type="button" className="adm-btn primary" disabled={!canRename} onClick={() => clean && onRename(p, clean)}>
              이름 바꾸기
            </button>
          </div>
          {nameErr && name !== p.name && <p className="sb-sheet-err">{nameErr}</p>}
          {twinArrived && (
            <p className="adm-modal-note">
              같은 이름이 둘 있는 분 중 이미 도착한 분이라 이름을 바꾸거나 뺄 수 없어요 — 손님 폰이 같은 이름 다른 분의 자리 · 응모권을 보게 돼요. 자리 옮기기는 돼요.
            </p>
          )}
        </div>
      )}

      <div className="sb-sheet-sec">
        <label className="adm-label" htmlFor="sb-table">{p.listed ? '자리 옮기기' : '명단에 넣기'}</label>
        <div className="sb-sheet-row">
          <select
            id="sb-table"
            className="adm-input sb-select"
            value={table}
            onChange={(e) => {
              setTable(Number(e.target.value));
              setSeat(null);
            }}
          >
            {TABLES.map((n) => (
              <option key={n} value={n}>{n}번 테이블</option>
            ))}
          </select>
          <SeatSelect id="sb-seat" rows={rows} table={table} value={seat} skipKey={p.key} onChange={setSeat} />
        </div>
        {placeClash && <p className="sb-sheet-err">{sameNameText(table, p.name)}</p>}
        <div className="adm-modal-actions">
          <span className="grow" />
          <button type="button" className="adm-btn primary" disabled={!canPlace} onClick={() => onPlace(p, table, seat)}>
            {p.listed ? '여기로 옮기기' : '명단에 넣기'}
          </button>
        </div>
      </div>

      <div className="adm-modal-actions sb-sheet-foot">
        {p.listed && (
          <button type="button" className="adm-btn danger" disabled={locked || twinArrived} onClick={() => onRemove(p)}>
            명단에서 빼기
          </button>
        )}
        <span className="grow" />
        <button type="button" className="adm-btn" onClick={onClose}>닫기</button>
      </div>
    </SheetFrame>
  );
}

/** 원탁 안에 다 못 그린 좌석 없는 사람 목록 — 누르면 그 사람 창 */
function LooseSheet({ table, lines, nowMs, onClose, onPick }: { table: number; lines: Line[]; nowMs: number; onClose: () => void; onPick: (key: string) => void }) {
  return (
    <SheetFrame label={`${table}번 테이블 좌석 없는 사람`} title={`${table}번 테이블 · 좌석 없음 ${lines.length}명`} onClose={onClose}>
      <div className="sb-sheet-sec sb-loose-list">
        {lines.length === 0 && <p className="adm-modal-note">지금은 좌석 없는 사람이 없어요.</p>}
        {lines.map((l) => {
          const tag = stageTagText(l.p, l.stage, nowMs);
          return (
            <button key={l.p.key} type="button" className="sb-loose-row" onClick={() => onPick(l.p.key)}>
              <b>{l.p.name}</b>
              <span className={`sb-tag s-${l.stage}`}>{tag || '아직 안 왔어요'}</span>
            </button>
          );
        })}
      </div>
      <p className="adm-modal-note">이름을 누르면 이름 고치기 · 자리 옮기기 창이 열려요.</p>
      <div className="adm-modal-actions">
        <span className="grow" />
        <button type="button" className="adm-btn" onClick={onClose}>닫기</button>
      </div>
    </SheetFrame>
  );
}

function AddSheet({
  table,
  seat: seatIn,
  rows,
  locked,
  onClose,
  onAdd,
}: {
  table: number;
  /** 누른 빈 칸 좌석(undefined = 첫 빈 좌석) */
  seat?: number | null;
  rows: PersonRow[];
  locked: boolean;
  onClose: () => void;
  onAdd: (table: number, name: string, seat: number | null) => void;
}) {
  const [name, setName] = useState('');
  // 누른 빈 칸 좌석 · 아니면 첫 빈 좌석을 미리 골라 둔다(다 찼으면 좌석 없음)
  const [seat, setSeat] = useState<number | null>(() =>
    seatIn !== undefined ? seatIn : (SEATS.find((n) => !rows.some((r) => r.listed && r.table === table && r.seat === n)) ?? null),
  );
  const clean = cleanName(name);
  const key = clean ? receptionNameKey(clean) : '';
  const sameHere = !!key && rows.some((r) => r.listed && r.table === table && receptionNameKey(r.name) === key);
  const sameElsewhere = !!key && !sameHere && rows.some((r) => r.listed && r.table !== table && receptionNameKey(r.name) === key);
  const err = name.trim() && !clean ? `이름은 ${NAME_MAX}자까지예요.` : sameHere ? sameNameText(table, clean || name) : null;
  const can = !!clean && !sameHere && !locked;
  // 누른 빈 칸이 그 사이 다른 화면에서 찼을 수 있다(2초 폴링) — 같이 앉게 된다고 알린다
  const seatTaken = seat != null ? rows.filter((r) => r.listed && r.table === table && r.seat === seat).map((r) => r.name) : [];
  const submit = () => {
    if (can && clean) onAdd(table, clean, seat);
  };

  return (
    <SheetFrame label={`${table}번 테이블에 사람 추가`} title={`${table}번 테이블${seat != null ? ` ${seat}번 자리` : ''}에 사람 추가`} onClose={onClose}>
      <div className="sb-sheet-sec">
        <label className="adm-label" htmlFor="sb-add-name">이름</label>
        <input
          id="sb-add-name"
          className="adm-input sb-input"
          value={name}
          maxLength={40}
          autoFocus
          autoComplete="off"
          enterKeyHint="done"
          placeholder="예: 김솔"
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.nativeEvent.isComposing || e.keyCode === 229) return; // 한글 조합 중 Enter(위 이름 칸과 같은 까닭)
            if (e.key === 'Enter') {
              e.preventDefault();
              submit();
            }
          }}
        />
        {err && <p className="sb-sheet-err">{err}</p>}
        {sameElsewhere && <p className="adm-modal-note">다른 테이블에도 같은 이름이 있어요 — 동명이인으로 들어가요(손님은 함께 앉는 분을 보고 자리를 골라요).</p>}
      </div>
      <div className="sb-sheet-sec">
        <label className="adm-label" htmlFor="sb-add-seat">좌석</label>
        <SeatSelect id="sb-add-seat" rows={rows} table={table} value={seat} onChange={setSeat} />
        {seatTaken.length > 0 && (
          <p className="adm-modal-note">
            {seat}번 자리에 이미 {seatTaken.join(', ')} 님이 있어요 — 넣으면 같은 자리에 같이 앉아요.
          </p>
        )}
      </div>
      <p className="adm-modal-note">넣으면 바로 손님 앱에서 이 이름으로 자리를 찾을 수 있어요.</p>
      <div className="adm-modal-actions">
        <span className="grow" />
        <button type="button" className="adm-btn" onClick={onClose}>취소</button>
        <button type="button" className="adm-btn primary" disabled={!can} onClick={submit}>추가하기</button>
      </div>
    </SheetFrame>
  );
}

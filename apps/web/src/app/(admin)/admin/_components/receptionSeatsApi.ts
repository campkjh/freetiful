'use client';

// 송년회 테이블 배치(261122 사장 '테이블배치로 보기 · 드래그엔 드롭으로 자리 위치 · 이름도 수정 · 인원도 추가') — 자리 명단 한 건 고치기.
// API POST /api/v1/admin/reception/:eventKey/seats/edit(apps/api reception-admin.controller.ts · 규칙 reception-seats-edit.ts).
//  · 서버가 '지금 DB 명단'에 명령 하나만 적용한다(행사별 잠금) — 태블릿 두 대가 동시에 고쳐도 서로 덮지 않는다.
//  · 동명이인 열쇠('이름열쇠 @테이블')는 서버가 다시 계산하고, 열쇠가 바뀐 줄의 응모권(도착 기록)도 따라 옮긴다.
//  · 틀리면 400 + 이유 문구(adminErrorText 로 그대로 보여 주기). 없는 사람도 400(404 면 adminFetch 가 같은 POST 를 한 번 더 보냄).
import { adminFetch } from './adminFetch';
import { RECEPTION_EVENT_KEY } from '@/lib/reception/event';

export type SeatEditOp =
  /** 그 사람(명단 줄 열쇠 = PersonRow.key)을 그 테이블 · 좌석으로. seat null = 좌석 없이. 같은 좌석에 둘은 괜찮다 */
  | { op: 'move'; nameKey: string; table: number; seat: number | null }
  /** 두 사람 자리(테이블 · 좌석) 맞바꾸기 */
  | { op: 'swap'; nameKey: string; otherKey: string }
  /** 이름 고치기 — 그 줄 응모권 이름 · 열쇠도 따라간다(손님 폰에 남은 옛 이름은 손님이 다시 넣어야 함) */
  | { op: 'rename'; nameKey: string; name: string }
  /** 사람 추가. ticketId = 명단 밖 손님(응모권 있음)을 테이블로 끌어 넣을 때 — 그 응모권이 새 줄에 붙는다 */
  | { op: 'add'; name: string; table: number; seat: number | null; ticketId?: string }
  /** 명단에서 빼기 — 응모권은 그대로(명단 밖 손님이 된다) */
  | { op: 'remove'; nameKey: string };

export interface SeatEditRow {
  nameKey: string;
  name: string;
  table: number;
  seat: number | null;
}

export interface SeatEditResult {
  ok: true;
  /** 실제로 바뀐 줄이 있었나(같은 자리로 옮기기 등은 false) */
  changed: boolean;
  /** 이 명령의 그 사람 — 고친 뒤 줄 열쇠(빼기면 null) */
  key: string | null;
  /** 고친 뒤 명단 전체(테이블 → 좌석 → 이름 순) */
  rows: SeatEditRow[];
  ticketsMoved: number;
  ticketsSkipped: number;
}

const BASE = `/api/v1/admin/reception/${RECEPTION_EVENT_KEY}`;

/** 자리 명단 한 건 고치기 — 응답 뒤 참여자 판은 fresh 로 다시 받는다(SeatBoard 의 refreshAfter) */
export const seatsEdit = (op: SeatEditOp) => adminFetch('POST', `${BASE}/seats/edit`, op) as Promise<SeatEditResult>;

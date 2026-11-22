'use client';

// 송년회 퀴즈(퀴즈고 3라운드) 손님 화면 도우미 — 우리 테이블 기억 · 답 모양 · 점수판 순위 · 시각.
// 정답 · 채점은 서버(apps/api/src/reception/reception-quiz.ts)가 유일한 출처 — 여기선 화면에 그리는 일만.
import { useCallback, useEffect, useState } from 'react';
import type { QuizBoardRow, QuizQuestionPublic } from './api';
import { RECEPTION_EVENT_KEY, TABLE_COUNT } from './event';
import { receptionNameKey, type ResolvedSeat } from './me';

/** 한 문제 시간(표시만 — 마감은 운영팀이 누른다) */
export const QUIZ_SECONDS = 60;
export const CIRCLED = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧'] as const;
/** match 칸에서 아직 안 고른 자리 */
export const MATCH_EMPTY = '_';

export const optionLetter = (i: number) => String.fromCharCode(65 + i);

const kst = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hour12: false });
/** 'HH:mm'(KST) — 못 읽으면 빈 글 */
export function kstTime(iso: string | null | undefined) {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : kst.format(d);
}

/** 서버에 낼 모양이 다 찼나 — text 1~40자 · ox O/X · choice 1..n · match 칸 전부 */
export function answerReady(q: QuizQuestionPublic, draft: string) {
  switch (q.kind) {
    case 'text': {
      const v = draft.trim();
      return v.length >= 1 && v.length <= 40;
    }
    case 'ox':
      return draft === 'O' || draft === 'X';
    case 'choice': {
      const n = Number(draft);
      return Number.isInteger(n) && n >= 1 && n <= (q.options?.length ?? 0);
    }
    case 'match':
      return !!q.slots && draft.length === q.slots.length && !draft.includes(MATCH_EMPTY);
    default:
      return false;
  }
}

/** 같은 점수는 같은 등수(1, 1, 3 …) — board 는 서버가 이미 점수 내림차순 → 테이블 번호 오름차순 */
export function rankBoard(board: QuizBoardRow[]) {
  let rank = 0;
  return board.map((row, i) => {
    if (i === 0 || row.score !== board[i - 1].score) rank = i + 1;
    return { ...row, rank };
  });
}

/* ─── 우리 테이블 ─────────────────────────────────────
 * 명단에 자리가 있으면 그 테이블. 명단이 없으면(임시 자리) 한 번 '맞나요?'로 확인받는다 —
 * 같은 테이블 답은 마지막에 낸 것 하나라, 틀린 테이블로 내면 남의 테이블 답을 덮어쓴다.
 * 직접 고른 테이블(manual)은 명단보다 앞선다. 이름이 바뀌면 고른 것은 안 쓴다. */
const PICK_KEY = `freetiful-reception-${RECEPTION_EVENT_KEY}-quiz-table`;

interface TablePick {
  key: string;
  table: number;
  manual: boolean;
}

const validTable = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n) && n >= 1 && n <= TABLE_COUNT;

function readPick(name: string): TablePick | null {
  if (!name) return null;
  try {
    const v = JSON.parse(localStorage.getItem(PICK_KEY) || 'null');
    if (v && v.key === receptionNameKey(name) && validTable(v.table)) return { key: v.key, table: v.table, manual: v.manual === true };
  } catch {}
  return null;
}

export type QuizTable =
  | { status: 'ready'; table: number; from: 'manual' | 'listed' | 'confirmed' }
  /** 임시 자리 — '우리 테이블이 n번 맞나요?' */
  | { status: 'confirm'; suggest: number }
  /** 명단에 없음 · 자리를 못 받음 — 직접 고르기 */
  | { status: 'choose' }
  | { status: 'wait' };

export function useQuizTable(name: string, seat: ResolvedSeat | null, seatFailed: boolean) {
  const [pick, setPickState] = useState<TablePick | null>(null);
  useEffect(() => { setPickState(readPick(name)); }, [name]);

  const setPick = useCallback((table: number, manual: boolean) => {
    if (!name || !validTable(table)) return;
    const next = { key: receptionNameKey(name), table, manual };
    try { localStorage.setItem(PICK_KEY, JSON.stringify(next)); } catch {}
    setPickState(next);
  }, [name]);

  let result: QuizTable;
  if (pick?.manual) result = { status: 'ready', table: pick.table, from: 'manual' };
  else if (seat?.kind === 'listed') result = { status: 'ready', table: seat.table, from: 'listed' };
  else if (pick) result = { status: 'ready', table: pick.table, from: 'confirmed' };
  else if (seat?.kind === 'temp') result = { status: 'confirm', suggest: seat.table };
  else if (seat?.kind === 'missing' || seatFailed) result = { status: 'choose' };
  else result = { status: 'wait' };

  return { quizTable: result, setPick };
}

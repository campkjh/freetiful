'use client';

// 송년회 퀴즈 탭 조각들 — 문제 머리 · 답 고르기(종류별) · 남은 시간 · 테이블별 답 목록 · 점수판 · 테이블 고르기 창.
// 전부 단색(그라데이션 · 글로우 X, 261108 사장 규칙). 정답 · 채점은 서버가 준 값만 그린다.
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { QuizBoardRow, QuizQuestionPublic, QuizTableResult } from '@/lib/reception/api';
import { TABLE_COUNT } from '@/lib/reception/event';
import { CIRCLED, MATCH_EMPTY, QUIZ_SECONDS, optionLetter, quizClock, rankBoard } from '@/lib/reception/quiz';
import RankCrown from './RankCrown';
import { CheckIcon, CloseIcon, TrophyIcon } from './ReceptionIcons';

/** 'ROUND 1 · 워밍업 · Q2 · 100점' + 문제 + 그림 */
export function QuizQuestionHead({ q, compact }: { q: QuizQuestionPublic; compact?: boolean }) {
  return (
    <div className={`rc-qz-head ${compact ? 'compact' : ''}`}>
      <p className="rc-qz-meta">
        <span className="rc-qz-round">ROUND {q.round}</span>
        <span>{q.roundTitle}</span>
        <span className="rc-qz-dot" aria-hidden="true" />
        <span>{q.kind === 'mission' ? '스페셜 미션' : `${q.no}번 문제`}</span>
        <span className="rc-qz-points">{q.points}점</span>
      </p>
      <h2 className="rc-qz-prompt">{q.prompt}</h2>
      {!compact && q.image && (
        <div className="rc-qz-figure">
          <img src={q.image} alt="문제 그림" loading="eager" />
        </div>
      )}
    </div>
  );
}

type InputProps = { q: QuizQuestionPublic; value: string; onChange: (v: string) => void; onSubmit: () => void; disabled?: boolean };

/** 종류별 답 고르기 — text 입력칸 · ox 두 버튼 · choice 보기 버튼 · match 칸마다 A~D */
export function QuizAnswerInput({ q, value, onChange, onSubmit, disabled }: InputProps) {
  if (q.kind === 'text') {
    return (
      <form className="rc-qz-text" onSubmit={(e) => { e.preventDefault(); onSubmit(); }}>
        <input
          className="rc-input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={q.placeholder || '답을 적어 주세요'}
          maxLength={40}
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="send"
          disabled={disabled}
          aria-label="답"
        />
      </form>
    );
  }
  if (q.kind === 'ox') {
    return (
      <div className="rc-qz-ox" role="radiogroup" aria-label="O 또는 X">
        {(['O', 'X'] as const).map((v) => (
          <button key={v} type="button" role="radio" aria-checked={value === v} className={`rc-qz-ox-btn ${value === v ? 'on' : ''}`} onClick={() => onChange(v)} disabled={disabled}>
            {v}
          </button>
        ))}
      </div>
    );
  }
  if (q.kind === 'choice') {
    return (
      <div className="rc-qz-choices" role="radiogroup" aria-label="보기">
        {(q.options ?? []).map((opt, i) => {
          const v = String(i + 1);
          return (
            <button key={v} type="button" role="radio" aria-checked={value === v} className={`rc-qz-choice ${value === v ? 'on' : ''}`} onClick={() => onChange(v)} disabled={disabled}>
              <span className="rc-qz-choice-no">{CIRCLED[i] ?? `${i + 1}.`}</span>
              <span className="rc-qz-choice-text">{opt}</span>
            </button>
          );
        })}
      </div>
    );
  }
  if (q.kind === 'match') {
    const slots = q.slots ?? [];
    const options = q.options ?? [];
    const cur = value.padEnd(slots.length, MATCH_EMPTY).slice(0, slots.length);
    const set = (i: number, letter: string) => onChange(cur.slice(0, i) + letter + cur.slice(i + 1));
    return (
      <div className="rc-qz-match">
        <ul className="rc-qz-match-options">
          {options.map((o) => <li key={o}>{o}</li>)}
        </ul>
        {slots.map((slot, i) => (
          <div key={slot} className="rc-qz-match-row">
            <div className="rc-qz-match-slot">
              {q.slotImages?.[i] && <img src={q.slotImages[i]} alt={`${slot} 그림`} />}
              <span>{slot}</span>
            </div>
            <div className="rc-qz-letters" role="radiogroup" aria-label={`${slot} 짝`}>
              {options.map((_, k) => {
                const letter = optionLetter(k);
                const on = cur[i] === letter;
                return (
                  <button key={letter} type="button" role="radio" aria-checked={on} className={`rc-qz-letter ${on ? 'on' : ''}`} onClick={() => set(i, letter)} disabled={disabled}>
                    {letter}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    );
  }
  // mission — 손님은 답을 내지 않는다(성공 · 실패는 운영팀이 표시)
  return (
    <div className="rc-qz-mission">
      <ul>
        {(q.notes ?? []).map((n) => <li key={n}>{n}</li>)}
      </ul>
      <p>도전 결과는 운영팀이 표시해요.</p>
    </div>
  );
}

/** 열린 뒤 5분(+사회자가 더한 초) 막대(표시만) — 0 이 돼도 마감 전까진 바꿀 수 있다 */
export function QuizCountdown({ openedAt, extraSec }: { openedAt: string | null; extraSec?: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, []);
  const start = openedAt ? Date.parse(openedAt) : NaN;
  if (Number.isNaN(start)) return null;
  const total = QUIZ_SECONDS + (extraSec && extraSec > 0 ? extraSec : 0);
  const left = Math.max(0, Math.min(total, total - (now - start) / 1000));
  const sec = Math.ceil(left);
  return (
    <div className={`rc-qz-timer ${sec <= 10 ? 'low' : ''} ${sec === 0 ? 'done' : ''}`} role="timer" aria-live="off">
      <div className="rc-qz-timer-bar" aria-hidden="true"><i style={{ transform: `scaleX(${left / total})` }} /></div>
      <p>{sec > 0 ? <><b>{quizClock(sec)}</b> 남았어요</> : '시간이 다 됐어요 — 마감 전까진 바꿀 수 있어요'}</p>
    </div>
  );
}

const resultText = (q: QuizQuestionPublic, r: QuizTableResult | undefined) => {
  if (q.kind === 'mission') return r?.correct ? '성공' : '—';
  return r?.display || '—';
};

/** 정답 공개 — 1~18 테이블이 각각 뭘 냈는지 + O/X(우리 테이블 줄 강조, 안 낸 테이블 '—') */
export function QuizTableAnswers({ q, tables, myTable }: { q: QuizQuestionPublic; tables: QuizTableResult[]; myTable: number | null }) {
  const byTable = new Map(tables.map((t) => [t.table, t]));
  const rows = Array.from({ length: Math.max(TABLE_COUNT, tables.length) }, (_, i) => i + 1);
  const correct = tables.filter((t) => t.correct).length;
  return (
    <div className="rc-qz-tables">
      <p className="rc-qz-tables-sum">
        {q.kind === 'mission' ? <>성공한 테이블 <b>{correct}</b>곳</> : <>{rows.length}개 테이블 중 <b>{correct}</b>곳이 맞혔어요</>}
      </p>
      <ol className="rc-qz-table-list">
        {rows.map((n) => {
          const r = byTable.get(n);
          const answered = q.kind === 'mission' ? !!r?.correct : !!r?.display;
          return (
            <li key={n} className={`rc-qz-trow ${n === myTable ? 'mine' : ''} ${r?.correct ? 'ok' : ''} ${answered ? '' : 'none'}`} style={{ '--i': n - 1 } as React.CSSProperties}>
              <span className="rc-qz-tno">{n}</span>
              <span className="rc-qz-tans">{resultText(q, r)}{n === myTable && <em>우리</em>}</span>
              {/* role=img — 그냥 span 의 aria-label 은 화면 읽기가 건너뛰어 정오답이 안 읽힌다 */}
              <span
                className={`rc-qz-mark ${r?.correct ? 'o' : 'x'}`}
                role="img"
                aria-label={q.kind === 'mission' ? (r?.correct ? '성공' : '300점 못 받음') : r?.correct ? '정답' : answered ? '오답' : '답 안 냄'}
              >
                {r?.correct ? <CheckIcon size={16} /> : <CloseIcon size={14} />}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/** 점수판(공개된 문제만) — big = '순위 발표'(1·2·3등 왕관, 전체). 아니면 5위까지 + 우리 테이블, 펼치면 전체 */
export function QuizBoard({ board, myTable, big }: { board: QuizBoardRow[]; myTable: number | null; big?: boolean }) {
  const [all, setAll] = useState(false);
  const ranked = rankBoard(board);
  const shown = big || all ? ranked : ranked.filter((r, i) => i < 5 || r.table === myTable);
  return (
    <section className={`rc-qz-board ${big ? 'big' : ''}`} aria-label={big ? '순위 발표' : '점수판'}>
      <h3 className="rc-qz-board-title">
        <TrophyIcon size={big ? 22 : 18} />
        {big ? '순위 발표' : '점수판'}
      </h3>
      <ol className="rc-qz-board-list">
        {shown.map((r, i) => (
          <li key={r.table} className={`rc-qz-brow ${r.table === myTable ? 'mine' : ''} ${big && r.rank <= 3 && r.score > 0 ? 'top' : ''}`} style={{ '--i': i } as React.CSSProperties}>
            <span className="rc-qz-brank">
              {r.rank <= 3 && r.score > 0 ? <RankCrown rank={r.rank as 1 | 2 | 3} size={big ? 24 : 18} /> : `${r.rank}위`}
            </span>
            <span className="rc-qz-bname">TABLE {r.table}{r.table === myTable && <em>우리</em>}</span>
            <span className="rc-qz-bcount">{r.correct}문제</span>
            <span className="rc-qz-bscore"><b>{r.score.toLocaleString('ko-KR')}</b>점</span>
          </li>
        ))}
      </ol>
      {!big && ranked.length > shown.length && (
        <button type="button" className="rc-text-btn rc-qz-more" onClick={() => setAll(true)}>전체 순위 보기</button>
      )}
      {!big && all && ranked.length > 5 && (
        <button type="button" className="rc-text-btn rc-qz-more" onClick={() => setAll(false)}>접기</button>
      )}
    </section>
  );
}

/** 테이블 고르기 — 1~18 버튼 창 */
export function TablePicker({ open, current, onPick, onClose }: { open: boolean; current: number | null; onPick: (n: number) => void; onClose: () => void }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!mounted || !open) return null;
  return createPortal(
    <div className="rc-theme rc-modal" role="dialog" aria-modal="true" aria-label="우리 테이블 고르기" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}>
        <div className="rc-glass rc-sheet rc-qz-picker">
          <button type="button" className="rc-icon-btn rc-name-close" onClick={onClose} aria-label="닫기"><CloseIcon size={20} /></button>
          <h2 className="rc-sheet-title">우리 테이블을 골라 주세요</h2>
          <p className="rc-sheet-desc">테이블 가운데 번호판을 봐 주세요. 고른 테이블 이름으로 답이 나가요.</p>
          <div className="rc-qz-picker-grid">
            {Array.from({ length: TABLE_COUNT }, (_, i) => i + 1).map((n) => (
              <button key={n} type="button" className={`rc-qz-pick ${n === current ? 'on' : ''}`} onClick={() => onPick(n)} aria-pressed={n === current}>
                {n}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

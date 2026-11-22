'use client';

/* 퀴즈 '답 입력' — 종이 답안을 받은 테이블(폰이 없거나 늦은 테이블) 답을 운영자가 대신 넣는다.
 *  · 저장 모양 = 손님과 같게(서버가 같은 검사·정규화): text 그대로 · ox 'O'/'X' · choice '1'..'n' · match 칸 수만큼 'A'..
 *  · mission 은 답이 없다(성공/실패 토글만) — 이 칸을 안 쓴다. */
import { useState } from 'react';
import { CIRCLED, type QuizQuestionAdmin } from '../../_components/receptionAdmin';

const LETTERS = 'ABCDEFGHI';

export function QuizAnswerEditor({
  question,
  initial,
  busy,
  onSave,
  onClear,
  onCancel,
}: {
  question: QuizQuestionAdmin;
  initial: string | null;
  busy: boolean;
  onSave: (answer: string) => void;
  onClear: (() => void) | null;
  onCancel: () => void;
}) {
  const q = question;
  const slots = q.slots?.length || 0;
  const letters = LETTERS.slice(0, Math.max(1, q.options?.length || 0)).split('');
  const [text, setText] = useState(initial || '');
  const [match, setMatch] = useState<string[]>(() => {
    const init = (initial || '').toUpperCase().split('');
    return Array.from({ length: slots }, (_, i) => (init[i] && letters.includes(init[i]) ? init[i] : ''));
  });

  const value =
    q.kind === 'match' ? (match.every(Boolean) ? match.join('') : '') : q.kind === 'text' ? text.trim().slice(0, 40) : text;

  return (
    <div className="rcq-edit">
      {q.kind === 'text' && (
        <input
          className="adm-input rcq-edit-input"
          autoFocus
          value={text}
          maxLength={40}
          placeholder={q.placeholder || '테이블이 쓴 답'}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && value) onSave(value); }}
        />
      )}
      {q.kind === 'ox' && (
        <div className="rcq-edit-pick">
          {['O', 'X'].map((v) => (
            <button key={v} type="button" className={`rcq-pick big ${text === v ? 'on' : ''}`} onClick={() => setText(v)}>{v}</button>
          ))}
        </div>
      )}
      {q.kind === 'choice' && (
        <div className="rcq-edit-pick">
          {(q.options || []).map((o, i) => {
            const v = String(i + 1);
            return (
              <button key={v} type="button" className={`rcq-pick ${text === v ? 'on' : ''}`} onClick={() => setText(v)}>
                {CIRCLED[i] || `${i + 1}.`} {o}
              </button>
            );
          })}
        </div>
      )}
      {q.kind === 'match' && (
        <div className="rcq-edit-match">
          {Array.from({ length: slots }, (_, i) => (
            <div key={i} className="rcq-edit-slot">
              <span className="rcq-edit-slot-name">{q.slots?.[i]}</span>
              <div className="adm-seg">
                {letters.map((L) => (
                  <button
                    key={L}
                    type="button"
                    className={match[i] === L ? 'on' : ''}
                    onClick={() => setMatch((m) => m.map((x, k) => (k === i ? L : x)))}
                  >
                    {L}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <p className="rcq-edit-hint">{(q.options || []).join(' · ')}</p>
        </div>
      )}
      <div className="rcq-edit-act">
        <button type="button" className="adm-btn primary" disabled={busy || !value} onClick={() => onSave(value)}>저장</button>
        {onClear && <button type="button" className="adm-btn danger" disabled={busy} onClick={onClear}>답 지우기</button>}
        <button type="button" className="adm-btn ghost" disabled={busy} onClick={onCancel}>취소</button>
      </div>
    </div>
  );
}

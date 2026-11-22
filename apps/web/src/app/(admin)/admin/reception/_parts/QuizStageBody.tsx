'use client';

/* 퀴즈 '크게 보기' 판 안쪽 — 프로젝터로 손님에게 보여 주는 화면(진한 남색 단색).
 *  · 정답 공개 = 정답 크게 + 테이블 답 카드 19개(맞힘 파랑 · 틀림 회색), 문제가 바뀔 때마다 촤라락.
 *  · 진행 중 · 마감 = 문제 + 남은 시간 + 낸 테이블 칸(답은 안 보임).
 *  · 대기 · 순위 발표 켬 = 점수판(공개된 문제만 채점 — 손님 화면과 같은 점수). */
import type { CSSProperties } from 'react';
import RankCrown from '@/components/reception/RankCrown';
import { CIRCLED, QUIZ_SECONDS, type QuizAdmin, type QuizScore } from '../../_components/receptionAdmin';

export function rankBoard(board: QuizScore[]) {
  let prev: number | null = null;
  let rank = 0;
  return board.map((b, i) => {
    if (prev === null || b.score !== prev) {
      rank = i + 1;
      prev = b.score;
    }
    return { ...b, rank };
  });
}

export function secondsLeft(openedAt: string | null, now: number) {
  if (!openedAt) return QUIZ_SECONDS;
  const t = new Date(openedAt).getTime();
  if (Number.isNaN(t)) return QUIZ_SECONDS;
  return Math.max(0, Math.ceil(QUIZ_SECONDS - (now - t) / 1000));
}

export function QuizStageBody({ data, now }: { data: QuizAdmin; now: number }) {
  const st = data.state;
  const cur = data.questions.find((q) => q.id === st.currentId) || null;
  const mode = st.showBoard || !cur || st.phase === 'idle' ? 'board' : st.phase === 'revealed' ? 'reveal' : 'live';

  if (mode === 'board' || !cur) {
    const rows = rankBoard(data.board);
    const anyScore = rows.some((r) => r.score > 0);
    return (
      <div className="rcs-board" key="board">
        <p className="rcs-eyebrow">{st.showBoard ? '순위 발표' : '점수판'}</p>
        <h2 className="rcs-title">{anyScore ? '지금 순위예요' : '곧 퀴즈가 시작돼요'}</h2>
        {anyScore && (
          <ol className="rcs-board-list">
            {rows.map((r, i) => (
              <li key={r.table} className={`rcs-board-row ${r.rank <= 3 && r.score > 0 ? 'top' : ''}`} style={{ '--i': i } as CSSProperties}>
                <span className="rcs-board-rank">
                  {r.rank <= 3 && r.score > 0 ? <RankCrown rank={r.rank as 1 | 2 | 3} size={30} label={`${r.rank}등`} /> : `${r.rank}`}
                </span>
                <span className="rcs-board-table">{r.table}번 테이블</span>
                <span className="rcs-board-score">{r.score.toLocaleString('ko-KR')}<small>점</small></span>
              </li>
            ))}
          </ol>
        )}
      </div>
    );
  }

  const head = (
    <p className="rcs-eyebrow">
      {cur.round}라운드 · {cur.roundTitle} · {cur.no}번{cur.points !== 100 ? ` · ${cur.points}점` : ''}
    </p>
  );
  const res = data.results[cur.id];
  const tables = [...(res?.tables || [])].sort((a, b) => a.table - b.table);

  if (mode === 'reveal') {
    return (
      <div className="rcs-reveal" key={`r:${cur.id}`}>
        {head}
        <p className="rcs-prompt sm">{cur.prompt}</p>
        <p className="rcs-answer"><span>정답</span>{cur.answerLabel}</p>
        {cur.explanation && <p className="rcs-expl">{cur.explanation}</p>}
        <div className="rcs-cards">
          {tables.map((t, i) => {
            const shown = cur.kind === 'mission' ? (t.correct ? '성공' : t.override === false ? '실패' : '—') : t.display || '—';
            return (
              <div key={t.table} className={`rcs-card ${t.correct ? 'ok' : 'no'} ${!t.answer && cur.kind !== 'mission' ? 'empty' : ''}`} style={{ '--i': i } as CSSProperties}>
                <span className="rcs-card-table">{t.table}번</span>
                <span className="rcs-card-ans">{shown}</span>
                <span className="rcs-card-mark" aria-label={t.correct ? '맞힘' : '틀림'}>{t.correct ? 'O' : 'X'}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // 진행 중 · 마감
  const left = secondsLeft(st.openedAt, now);
  const submitted = new Set(tables.filter((t) => t.answer).map((t) => t.table));
  return (
    <div className="rcs-live" key={`l:${cur.id}`}>
      {head}
      <p className="rcs-prompt">{cur.prompt}</p>
      {cur.image && <img className="rcs-img" src={cur.image} alt="" />}
      {cur.kind === 'choice' && (
        <ol className="rcs-opts">
          {(cur.options || []).map((o, i) => (
            <li key={i}><b>{CIRCLED[i]}</b>{o}</li>
          ))}
        </ol>
      )}
      {cur.kind === 'ox' && (
        <div className="rcs-ox"><span>O</span><span>X</span></div>
      )}
      {cur.kind === 'match' && (
        <div className="rcs-match">
          <div className="rcs-match-slots">
            {(cur.slots || []).map((s, i) => (
              <figure key={i}>
                {cur.slotImages?.[i] && <img src={cur.slotImages[i]} alt="" />}
                <figcaption>{s}</figcaption>
              </figure>
            ))}
          </div>
          <p className="rcs-match-opts">{(cur.options || []).join('   ')}</p>
        </div>
      )}
      {cur.kind === 'mission' && cur.notes && (
        <ul className="rcs-notes">{cur.notes.map((n, i) => <li key={i}>{n}</li>)}</ul>
      )}
      {cur.kind !== 'mission' && (
        <div className="rcs-live-foot">
          <p className={`rcs-timer ${st.phase === 'locked' ? 'locked' : left <= 10 ? 'warn' : ''}`}>
            {st.phase === 'locked' ? '답안 마감' : left > 0 ? `${left}초` : '시간 종료'}
          </p>
          <div className="rcs-sub-grid" aria-label={`답을 낸 테이블 ${submitted.size}곳`}>
            {Array.from({ length: data.tableCount || 19 }, (_, i) => i + 1).map((n) => (
              <span key={n} className={submitted.has(n) ? 'on' : ''}>{n}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

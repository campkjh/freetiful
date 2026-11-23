'use client';

/* 퀴즈 '크게 보기' 판 안쪽 — 프로젝터로 손님에게 보여 주는 화면(진한 남색 단색).
 *  · 정답 공개 = 정답 크게 + 테이블 답 카드 18개(맞힘 파랑 · 틀림 회색), 문제가 바뀔 때마다 촤라락.
 *  · 진행 중 · 마감 = 문제 + 남은 시간 + 낸 테이블 칸(답은 안 보임).
 *  · 대기 · 순위 발표 켬 = 점수판(공개된 문제만 채점 — 손님 화면과 같은 점수).
 *  · 261122 사장 '사진이 엄청 크게 3초 정도 전체화면으로 … 이 웨딩홀은 어디일까요? 하고 3초 뒤에 이미지가 작아지면서 문제화면으로'
 *    = 판을 띄운 채 문제를 열면(또는 연 지 15초 안에 판을 띄우면) 손님 화면과 같은 등장 연출(QuizIntro, rcsi-* = quiz-stage-intro.css).
 *    사진 문제 = 판 가득 사진 3초 + 아래 딤 + 문제 → 판의 그림 자리로 / 짝 맞추기 = 그림 4장 → 칸마다 / 글 문제 = 'n번 문제' 판 → 문제 글로.
 *    닫기 단추는 연출 위에 그대로(z 2) · 누르면 바로 끝 · 정답은 절대 안 그린다. */
import { useCallback, useRef, type CSSProperties } from 'react';
import RankCrown from '@/components/reception/RankCrown';
import { QuizIntro, useQuizImagePreload, useQuizIntro, type IntroTargets } from '@/components/reception/QuizIntro';
import { TABLE_COUNT } from '@/lib/reception/event';
import { CIRCLED, QUIZ_SECONDS, type QuizAdmin, type QuizScore } from '../../_components/receptionAdmin';
import './quiz-stage-intro.css';

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

/** 이 문제의 제한시간(초) = 60 + [+60초]로 더한 초 */
export const quizTotalSec = (extraSec?: number) => QUIZ_SECONDS + (extraSec && extraSec > 0 ? extraSec : 0);

export function secondsLeft(openedAt: string | null, now: number, extraSec?: number) {
  const total = quizTotalSec(extraSec);
  if (!openedAt) return total;
  const t = new Date(openedAt).getTime();
  if (Number.isNaN(t)) return total;
  return Math.max(0, Math.ceil(total - (now - t) / 1000));
}

export function QuizStageBody({ data, now }: { data: QuizAdmin; now: number }) {
  const st = data.state;
  const cur = data.questions.find((q) => q.id === st.currentId) || null;
  const mode = st.showBoard || !cur || st.phase === 'idle' ? 'board' : st.phase === 'revealed' ? 'reveal' : 'live';

  // 등장 연출 — 진행 중(open) 화면일 때만, 열림 하나(문제 + 연 시각)마다 한 번
  useQuizImagePreload(data.questions);
  const liveRef = useRef<HTMLDivElement>(null);
  const introKey = mode === 'live' && cur && st.phase === 'open' ? `${cur.id}@${st.openedAt ?? ''}` : null;
  const intro = useQuizIntro(introKey, st.openedAt, 'stage');
  const introTargets = useCallback((): IntroTargets => {
    const el = liveRef.current;
    return {
      photo: el?.querySelector<HTMLElement>('.rcs-img') ?? null,
      head: el?.querySelector<HTMLElement>('.rcs-prompt') ?? null,
      slots: el ? Array.from(el.querySelectorAll<HTMLElement>('.rcs-match-slots img')) : [],
    };
  }, []);

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
  const left = secondsLeft(st.openedAt, now, st.extraSec);
  const submitted = new Set(tables.filter((t) => t.answer).map((t) => t.table));
  return (
    <>
      <div ref={liveRef} className={`rcs-live ${intro.stage ? `rcsi-${intro.stage}` : ''}`} key={`l:${cur.id}`}>
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
        {/* 261122 미션 도전 — 손님이 [도전하기]를 누른 테이블이 실시간으로(테이블 · 대표 이름 · 성공 금색 / 실패 흐림) */}
        {cur.kind === 'mission' && (() => {
          const ch = tables.filter((t) => t.answer);
          return (
            <div className="rcs-challengers" aria-label={`도전한 테이블 ${ch.length}곳`}>
              {ch.length ? ch.map((t) => (
                <span key={t.table} className={`rcs-ch ${t.override === true ? 'ok' : t.override === false ? 'no' : ''}`}>
                  <b>{t.table}번</b>{t.name}{t.override === true ? ` +${cur.points}` : ''}
                </span>
              )) : <span className="rcs-ch-wait">테이블 대표가 앱에서 [도전하기]를 누르면 여기에 떠요</span>}
            </div>
          );
        })()}
        {cur.kind !== 'mission' && (
          <div className="rcs-live-foot">
            <p className={`rcs-timer ${st.phase === 'locked' ? 'locked' : left <= 10 ? 'warn' : ''}`}>
              {st.phase === 'locked' ? '답안 마감' : left > 0 ? `${left}초` : '시간 종료'}
            </p>
            <div className="rcs-sub-grid" aria-label={`답을 낸 테이블 ${submitted.size}곳`}>
              {Array.from({ length: data.tableCount || TABLE_COUNT }, (_, i) => i + 1).map((n) => (
                <span key={n} className={submitted.has(n) ? 'on' : ''}>{n}</span>
              ))}
            </div>
          </div>
        )}
      </div>
      {/* 연출 판은 .rcs-live 밖 — 안에 두면 착지 때 카드 속 차례 등장(transform)이 fixed 판까지 끌고 간다 */}
      {intro.overlay && intro.key && st.phase === 'open' && (
        <QuizIntro key={intro.key} q={cur} prefix="rcsi" targets={introTargets} onStage={intro.onStage} onDone={intro.onDone} />
      )}
    </>
  );
}

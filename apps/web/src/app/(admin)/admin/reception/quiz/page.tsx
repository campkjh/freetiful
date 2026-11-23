'use client';

/* 송년회 퀴즈 진행(261122 사장 '문제이고 정답이 공개될때 각 테이블마다 어떤 정답을 썼는지도 확인이 가능하게끔')
 *  · 퀴즈고 PPT 3라운드 11문제 — 정답·채점은 서버가 유일한 출처(apps/api reception-quiz.ts). 여기선 진행 버튼과 판정 고치기만.
 *  · 흐름 = [문제 열기] → 손님 화면에 문제(테이블별로 한 답) → [마감] → [정답 공개](손님 화면에 모든 테이블 답) → 다음 문제.
 *  · 테이블 답 표: 최종 O/X 칸을 누르면 자동 → O → X → 자동 으로 돈다(오타 정답 인정 등). 종이 답안은 [답 입력].
 *  · [크게 보기] = 프로젝터용 전체 화면(진한 남색) — 정답 공개면 테이블 답 카드 18개, 대기면 점수판.
 *    판 안에 [다음 문제 열기]까지 둔다 — 판을 닫으면 태블릿 미러링 화면에 본문 카드가 그대로 비친다.
 *  · 본문 카드의 정답 상자는 공개 전엔 가려 둔다([정답 보기]로 잠깐 펼침) — 문제 고르는 순간 프로젝터에 정답이 뜨지 않게.
 *  · (261122 사장 '퀴즈 초기화버튼도 만들어줘 처음부터 시작할 수 있게끔') 맨 위 상태 줄에 [처음부터 다시] — 두 번 묻고 모든 답 · 미션 도전 ·
 *    공개 기록 · 점수판을 지운 뒤 손님 화면을 대기('곧 퀴즈가 시작돼요')로, 왼쪽 목록은 1번 문제로. (아래 초기화 칸의 [전체 초기화]와 같은 동작)
 *  · 미션 표 = 손님이 [도전하기]를 누른 테이블은 '도전한 사람' 칸에 이름(참여자 명단에서도 성공 · 실패를 찍을 수 있다). */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RollingNumber } from '../../_components/AdminNumber';
import { AdminTableScroll } from '../../_components/AdminListCard';
import { adminAlert, adminConfirm } from '../../_components/adminDialog';
import {
  adminErrorText,
  CIRCLED,
  kstHm,
  QUIZ_KIND_LABEL,
  quizClock,
  receptionAdminApi,
  useReceptionQuiz,
  type QuizAdminTable,
  type QuizQuestionAdmin,
  type QuizStateAction,
} from '../../_components/receptionAdmin';
import { ReceptionStage } from '../_parts/ReceptionStage';
import { useStageFromQuery } from '../_parts/StageNav';
import { QuizStageBody, quizTotalSec, rankBoard, secondsLeft } from '../_parts/QuizStageBody';
import { QuizAnswerEditor } from '../_parts/QuizAnswerEditor';
import RankCrown from '@/components/reception/RankCrown';
import '../reception-admin.css';

const PHASE_LABEL = { idle: '대기', open: '진행 중', locked: '마감', revealed: '정답 공개' } as const;
/** 오프닝 주관식은 정답이 없어 '답 공개' */
const phaseLabel = (phase: keyof typeof PHASE_LABEL, q: QuizQuestionAdmin | null) => (phase === 'revealed' && q?.open ? '답 공개' : PHASE_LABEL[phase]);
const qName = (q: QuizQuestionAdmin) => (q.open ? `오프닝 ${q.no}번` : `${q.round}라운드 ${q.no}번`);
/** 짧은 번호(목록 배지 · 크게 보기 다음 문제 단추) — 오프닝은 'OP-1'(0라운드 '0-1' 으로 안 보이게) */
const qShort = (q: QuizQuestionAdmin) => (q.open ? `OP-${q.no}` : `${q.round}-${q.no}`);

/** 객관식 정답 보기 번호(0부터) — 원값이 오면 그걸로, 아니면 정답 글 앞 원문자('④ 2,011건')나 같은 글로 */
function correctOption(q: QuizQuestionAdmin): number {
  const raw = (q as { answer?: unknown }).answer;
  if (typeof raw === 'string' && /^\d+$/.test(raw)) return Number(raw) - 1;
  const first = [...q.answerLabel.trim()][0];
  const byCircle = (CIRCLED as readonly string[]).indexOf(first);
  if (byCircle >= 0) return byCircle;
  return (q.options || []).findIndex((o) => o === q.answerLabel.trim());
}

/** 1초 안쪽으로 도는 시계 — 문제가 열려 있을 때만 */
function useNow(active: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const t = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(t);
  }, [active]);
  return now;
}

export default function ReceptionQuizPage() {
  const { data, loading, error, mutate } = useReceptionQuiz(2000);
  const [selId, setSelId] = useState<string | null>(null);
  const [stage, setStage] = useState(false);
  // ☰ 로 옮겨 오면(?stage=1) 크게 보기 판을 바로 연다
  useStageFromQuery(() => setStage(true));
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState<number | null>(null);
  const [boardAll, setBoardAll] = useState(false);
  const [peek, setPeek] = useState(false);

  // 고른 문제 — 처음엔 지금 문제(없으면 첫 문제), 그 뒤 지금 문제가 바뀌면(다른 기기에서 열어도) 따라간다
  const lastCur = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (!data) return;
    const cur = data.state.currentId;
    if (lastCur.current === undefined) setSelId(cur || data.questions[0]?.id || null);
    else if (cur && cur !== lastCur.current) setSelId(cur);
    lastCur.current = cur;
  }, [data]);
  useEffect(() => { setEditing(null); setPeek(false); }, [selId]);

  const st = data?.state;
  const q = data?.questions.find((x) => x.id === selId) || null;
  const cur = data?.questions.find((x) => x.id === st?.currentId) || null;
  const res = q ? data?.results[q.id] : undefined;
  const tables = useMemo(() => [...(res?.tables || [])].sort((a, b) => a.table - b.table), [res]);
  const isCurrent = !!q && st?.currentId === q.id;
  const selRevealed = !!q && !!st?.revealed.includes(q.id);
  const selPhase = isCurrent ? st!.phase : selRevealed ? 'revealed' : 'idle';
  const now = useNow(st?.phase === 'open');
  const left = secondsLeft(st?.openedAt ?? null, now, st?.extraSec);

  const rounds = useMemo(() => {
    const m = new Map<number, { title: string; items: QuizQuestionAdmin[] }>();
    for (const x of data?.questions || []) {
      const r = m.get(x.round) || { title: x.roundTitle, items: [] };
      r.items.push(x);
      m.set(x.round, r);
    }
    return [...m.entries()].sort((a, b) => a[0] - b[0]);
  }, [data]);

  const act = useCallback(async (action: QuizStateAction, extra: { questionId?: string; on?: boolean } = {}) => {
    setBusy(`state:${action}`);
    try {
      await mutate(() => receptionAdminApi.quizState({ action, ...extra }));
    } catch (e) {
      await adminAlert(`처리하지 못했어요\n${adminErrorText(e)}`);
    } finally {
      setBusy(null);
    }
  }, [mutate]);

  const openSel = async () => {
    if (!q || !st) return;
    // 넘길 때는 묻지 않고 바로(261123 사장 '알럿 안 뜨고 바로 넘어가게') — 공개한 문제를 다시 여는 것(점수판에서 빠짐)만 묻는다
    if (selRevealed && !(await adminConfirm({ title: `${qName(q)}을 다시 열까요?`, description: q.open ? '답 공개가 취소돼요. 손님이 답을 다시 낼 수 있어요.' : '정답 공개가 취소되고 점수판에서도 빠져요. 손님이 답을 다시 낼 수 있어요.', confirmText: '다시 열기' }))) return;
    act('open', { questionId: q.id });
  };
  const lock = () => act('lock');
  const reveal = async () => {
    if (!st) return;
    act('reveal');
  };
  const unreveal = async () => {
    if (!q) return;
    if (!(await adminConfirm(q.open
      ? { title: `${qName(q)} 답 공개를 취소할까요?`, description: '손님 화면 · 크게 보기에서 테이블 답이 사라져요.', confirmText: '공개 취소' }
      : { title: `${qName(q)} 정답 공개를 취소할까요?`, description: '손님 화면에서 정답과 테이블 답이 사라지고 점수판에서도 빠져요.', confirmText: '공개 취소' }))) return;
    act('unreveal', { questionId: q.id });
  };
  const toIdle = async () => {
    act('idle');
  };
  const toggleBoard = () => act('board', { on: !st?.showBoard });
  /** 받는 중인 문제 시계에 60초 더하기(손님 폰 · 큰 화면 시계가 같이 늘어난다) */
  const extend = () => act('extend');

  /** 판 안 [다음 문제 열기] — 지금 문제(대기면 마지막으로 공개한 문제) 다음이면서 아직 공개 안 한 첫 문제 */
  // 점수판에 든 공개 문제 수 — 오프닝 주관식은 점수판 밖이라 안 센다
  const scoredShown = (st?.revealed ?? []).filter((id) => { const x = data?.questions.find((y) => y.id === id); return !!x && !x.open; }).length;
  const nextQ = useMemo(() => {
    const qs = data?.questions || [];
    const s = data?.state;
    if (!s) return null;
    const curIdx = s.currentId ? qs.findIndex((x) => x.id === s.currentId) : -1;
    const base = curIdx >= 0 ? curIdx : qs.reduce((m, x, i) => (s.revealed.includes(x.id) ? i : m), -1);
    const notDone = (x: QuizQuestionAdmin) => !s.revealed.includes(x.id) && x.id !== s.currentId;
    return qs.slice(base + 1).find(notDone) || qs.find(notDone) || null;
  }, [data]);
  const openNext = async () => {
    if (!nextQ || !st) return;
    act('open', { questionId: nextQ.id });
  };

  const resetOne = async () => {
    if (!q) return;
    if (!(await adminConfirm({ title: `${qName(q)} 답을 모두 지울까요?`, description: `테이블 ${res?.submitted || 0}곳이 낸 답과 O/X 고친 것이 지워져요.`, confirmText: '지울게요' }))) return;
    if (!(await adminConfirm({ title: '정말 지울까요?', description: '지우면 되돌릴 수 없어요.', confirmText: '지우기' }))) return;
    act('reset', { questionId: q.id });
  };
  const resetAll = async () => {
    const qs = data?.questions || [];
    if (!(await adminConfirm({ title: '퀴즈를 처음부터 다시 할까요?', description: `${qs.length}문제의 모든 답 · 미션 도전 · O/X 고친 것 · 공개 기록이 지워지고 손님 화면은 대기('곧 퀴즈가 시작돼요')로 돌아가요.`, confirmText: '처음부터 다시' }))) return;
    if (!(await adminConfirm({ title: '정말 전체를 지울까요?', description: '점수판도 모두 0점이 돼요. 되돌릴 수 없어요.', confirmText: '지우기' }))) return;
    await act('reset');
    if (qs[0]) setSelId(qs[0].id);
  };

  /** 최종 O/X — 자동 → O → X → 자동 */
  const cycleOx = async (t: QuizAdminTable, next?: boolean | null) => {
    if (!q) return;
    const to = next !== undefined ? next : t.override === null ? true : t.override === true ? false : null;
    setBusy(`ox:${t.table}`);
    try {
      await mutate(() => receptionAdminApi.quizAnswer({ questionId: q.id, table: t.table, correct: to }));
    } catch (e) {
      await adminAlert(`바꾸지 못했어요\n${adminErrorText(e)}`);
    } finally {
      setBusy(null);
    }
  };
  const saveAnswer = async (table: number, answer: string | null) => {
    if (!q) return;
    setBusy(`ans:${table}`);
    try {
      await mutate(() => receptionAdminApi.quizAnswer({ questionId: q.id, table, answer }));
      setEditing(null);
    } catch (e) {
      await adminAlert(`저장하지 못했어요\n${adminErrorText(e)}`);
    } finally {
      setBusy(null);
    }
  };

  const stateBusy = !!busy?.startsWith('state:');
  const board = rankBoard((boardAll ? data?.boardAll : data?.board) || []);
  const showAns = selRevealed || peek;
  const choiceOk = showAns && q?.kind === 'choice' ? correctOption(q) : -1;

  if (loading && !data) return <div className="rca"><p className="adm-empty">불러오는 중…</p></div>;
  if (!data || !st) return <div className="rca"><p className="adm-empty">{error || '불러오지 못했어요'}</p></div>;

  return (
    <div className="rca space-y-5">
      {/* 지금 상태 줄 — 어느 문제가 손님 화면에 떠 있나 */}
      <div className="rcq-now">
        <div className="rcq-now-text">
          <span className={`rcq-phase ${st.phase}`}>{phaseLabel(st.phase, cur)}</span>
          <b>{cur ? `${qName(cur)} · ${QUIZ_KIND_LABEL[cur.kind]}` : '손님 화면 = 대기'}</b>
          {st.phase === 'open' && <span className={`rcq-left ${left <= 10 ? 'warn' : ''}`}>{left > 0 ? `${quizClock(left)} 남음` : '시간이 다 됐어요'}</span>}
          {st.phase === 'open' && <button type="button" className="adm-btn" disabled={stateBusy} onClick={extend}>+60초</button>}
          {st.showBoard && <span className="adm-badge orange">순위 발표 중</span>}
        </div>
        <div className="rcq-now-act">
          <button type="button" className="adm-btn danger" disabled={stateBusy} onClick={resetAll}>처음부터 다시</button>
          <button type="button" className={`adm-btn ${st.showBoard ? 'weak' : ''}`} disabled={stateBusy} onClick={toggleBoard}>
            {st.showBoard ? '순위 발표 끄기' : '순위 발표 켜기'}
          </button>
          <button type="button" className="adm-btn primary" onClick={() => setStage(true)}>크게 보기</button>
        </div>
      </div>
      {error && <p className="adm-note">연결이 잠깐 끊겼어요 — 마지막으로 받은 화면이에요. ({error})</p>}

      <div className="rcq">
        {/* 문제 목록 — 태블릿 가로면 왼쪽, 세로면 위 */}
        <nav className="rcq-list" aria-label="문제 목록">
          {rounds.map(([round, r]) => (
            <div key={round} className="rcq-round">
              <p className="rcq-round-title">{round === 0 ? `${r.title} · 점수 없는 주관식` : `${round}라운드 · ${r.title}`}</p>
              <div className="rcq-items">
                {r.items.map((x) => {
                  const live = st.currentId === x.id && (st.phase === 'open' || st.phase === 'locked');
                  const done = st.revealed.includes(x.id);
                  const sub = data.results[x.id]?.submitted || 0;
                  return (
                    <button key={x.id} type="button" className={`rcq-q ${selId === x.id ? 'on' : ''}`} onClick={() => setSelId(x.id)} aria-current={selId === x.id ? 'true' : undefined}>
                      <span className="rcq-q-no">{qShort(x)}</span>
                      <span className="rcq-q-text">
                        <span className="rcq-q-prompt">{x.prompt}</span>
                        <span className="rcq-q-meta">{QUIZ_KIND_LABEL[x.kind]} · {x.open ? '점수 없음' : `${x.points}점`}{x.kind !== 'mission' ? ` · ${sub}/${data.tableCount}` : ''}</span>
                      </span>
                      {(live || done) && <span className={`rcq-dot ${live ? 'live' : 'done'}`} aria-label={live ? '진행 중' : '공개됨'} />}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {q && (
          <div className="rcq-main">
            <section className="adm-card rcq-card">
              <div className="rcq-card-head">
                <p className="rcq-eyebrow">{q.open ? `${q.roundTitle} · ${q.no}번 · ${QUIZ_KIND_LABEL[q.kind]} · 점수 없음` : `${q.round}라운드 · ${q.roundTitle} · ${q.no}번 · ${QUIZ_KIND_LABEL[q.kind]} · ${q.points}점`}</p>
                <span className={`rcq-phase ${selPhase}`}>{phaseLabel(selPhase, q)}</span>
              </div>
              <p className="rcq-prompt">{q.prompt}</p>
              {q.image && <img className="rcq-img" src={q.image} alt="" />}
              {q.kind === 'choice' && (
                <ol className="rcq-opts">
                  {(q.options || []).map((o, i) => (
                    <li key={i} className={i === choiceOk ? 'ok' : ''}>{CIRCLED[i]} {o}</li>
                  ))}
                </ol>
              )}
              {q.kind === 'match' && (
                <div className="rcq-match">
                  {(q.slots || []).map((s, i) => (
                    <figure key={i}>
                      {q.slotImages?.[i] && <img src={q.slotImages[i]} alt="" />}
                      <figcaption>{s}</figcaption>
                    </figure>
                  ))}
                  <p className="rcq-match-opts">{(q.options || []).join(' · ')}</p>
                </div>
              )}
              {q.kind === 'mission' && q.notes && (
                <ul className="rcq-notes">{q.notes.map((n, i) => <li key={i}>{n}</li>)}</ul>
              )}
              {q.open ? (
                // 오프닝 주관식 — 가릴 정답이 없다
                <div className="rcq-answer">
                  <span>정답 없음</span>
                  <b>맞고 틀림 없는 주관식</b>
                  <p>공개하면 손님 화면 · 크게 보기에 테이블 답만 떠요. 점수판에는 안 들어가요.</p>
                </div>
              ) : showAns ? (
                <div className={`rcq-answer ${selRevealed ? '' : 'peeking'}`}>
                  <span>정답</span>
                  <b>{q.answerLabel}</b>
                  {q.explanation && <p>{q.explanation}</p>}
                  {!selRevealed && <button type="button" className="adm-btn ghost sm rcq-answer-hide" onClick={() => setPeek(false)}>가리기</button>}
                </div>
              ) : (
                <button type="button" className="rcq-answer peek" onClick={() => setPeek(true)}>
                  <span>정답</span>
                  <b>눌러서 정답 보기</b>
                  <p>프로젝터에 비칠 수 있어 공개 전엔 가려 뒀어요</p>
                </button>
              )}

              {isCurrent && st.phase === 'open' && (
                <div className={`rcq-timer ${left <= 10 ? 'warn' : ''}`} role="timer" aria-live="off">
                  <div className="rcq-timer-bar"><span style={{ transform: `scaleX(${left / quizTotalSec(st.extraSec)})` }} /></div>
                  <span>{left > 0 ? `남은 시간 ${quizClock(left)}` : '시간이 다 됐어요 — 마감을 눌러 주세요'}</span>
                  <button type="button" className="adm-btn" disabled={stateBusy} onClick={extend}>+60초</button>
                </div>
              )}

              <div className="rcq-actions">
                <button type="button" className="adm-btn primary" disabled={stateBusy || (isCurrent && st.phase === 'open')} onClick={openSel}>
                  {selRevealed || (isCurrent && st.phase === 'locked') ? '다시 열기' : '문제 열기'}
                </button>
                <button type="button" className="adm-btn" disabled={stateBusy || !(isCurrent && st.phase === 'open')} onClick={lock}>마감</button>
                <button type="button" className="adm-btn weak" disabled={stateBusy || !(isCurrent && (st.phase === 'open' || st.phase === 'locked'))} onClick={reveal}>{q.open ? '답 공개' : '정답 공개'}</button>
                <button type="button" className="adm-btn" disabled={stateBusy || !selRevealed} onClick={unreveal}>공개 취소</button>
                <button type="button" className="adm-btn" disabled={stateBusy || st.phase === 'idle'} onClick={toIdle}>대기 화면</button>
              </div>
            </section>

            {/* 테이블 답 — 1~18 */}
            <section className="adm-listcard">
              <div className="rcq-sec-head">
                <div>
                  <p className="rcq-sec-title">테이블 답</p>
                  <p className="rcq-sec-sub">
                    {q.kind === 'mission'
                      ? '손님이 [도전하기]를 누르면 도전한 사람이 떠요 · 성공한 테이블만 눌러 주세요 — 다시 누르면 풀려요'
                      : q.open ? <>낸 테이블 <b><RollingNumber value={res?.submitted || 0} /></b>/{data.tableCount} · 맞고 틀림 없는 주관식이에요</>
                      : <>낸 테이블 <b><RollingNumber value={res?.submitted || 0} /></b>/{data.tableCount} · 맞힘 <b><RollingNumber value={res?.correctCount || 0} /></b> · O/X 칸을 누르면 자동 → O → X 로 바뀌어요</>}
                  </p>
                </div>
              </div>
              <AdminTableScroll>
                <table className="adm-table rca-table rcq-table">
                  <thead>
                    {q.kind === 'mission' ? (
                      <tr><th>테이블</th><th>도전한 사람</th><th>결과</th><th className="r">점수</th></tr>
                    ) : (
                      <tr><th>테이블</th><th>답</th><th>낸 사람</th>{!q.open && <><th>자동</th><th>최종</th></>}<th aria-label="답 입력" /></tr>
                    )}
                  </thead>
                  <tbody key={q.id}>
                    {tables.map((t, i) => {
                      const delay = { animationDelay: `${Math.min(i * 30, 900)}ms` };
                      if (q.kind === 'mission') {
                        return (
                          <tr key={t.table} style={delay}>
                            <td className="rcq-tno">{t.table}번</td>
                            <td>
                              {t.answer && t.name ? (
                                <>
                                  <span className="adm-cell-main rcq-who">{t.name}</span>
                                  {t.updatedAt && <span className="adm-cell-sub adm-num">{kstHm(t.updatedAt)}</span>}
                                </>
                              ) : <span className="adm-cell-sub">—</span>}
                            </td>
                            <td>
                              <div className="rcq-mission">
                                <button type="button" className={`rcq-pick ${t.override === true ? 'on ok' : ''}`} disabled={busy === `ox:${t.table}`} onClick={() => cycleOx(t, t.override === true ? null : true)}>성공</button>
                                <button type="button" className={`rcq-pick ${t.override === false ? 'on' : ''}`} disabled={busy === `ox:${t.table}`} onClick={() => cycleOx(t, t.override === false ? null : false)}>실패</button>
                              </div>
                            </td>
                            <td className="r adm-num">{t.correct ? `${q.points}점` : '—'}</td>
                          </tr>
                        );
                      }
                      const rows = [
                        <tr key={t.table} style={delay} className={editing === t.table ? 'rcq-editing' : ''}>
                          <td className="rcq-tno">{t.table}번</td>
                          <td className="rcq-ans">{t.display || <span className="adm-cell-sub">—</span>}</td>
                          <td>
                            {t.name ? <span className="adm-cell-main rcq-who">{t.name}</span> : <span className="adm-cell-sub">—</span>}
                            {t.updatedAt && <span className="adm-cell-sub adm-num">{kstHm(t.updatedAt)}</span>}
                          </td>
                          {!q.open && <td>{t.answer ? <span className={`adm-badge ${t.auto ? 'blue' : ''}`}>{t.auto ? 'O' : 'X'}</span> : <span className="adm-cell-sub">—</span>}</td>}
                          {!q.open && <td>
                            <button
                              type="button"
                              className={`rcq-ox ${t.correct ? 'ok' : 'no'} ${t.override !== null ? 'fixed' : ''}`}
                              disabled={busy === `ox:${t.table}`}
                              onClick={() => cycleOx(t)}
                              aria-label={`${t.table}번 테이블 최종 ${t.correct ? 'O' : 'X'}${t.override !== null ? ' 고정' : ' 자동'} — 눌러서 바꾸기`}
                            >
                              <b>{t.correct ? 'O' : 'X'}</b>
                              <small>{t.override !== null ? '고정' : '자동'}</small>
                            </button>
                          </td>}
                          <td className="r">
                            <button type="button" className="adm-btn ghost sm" onClick={() => setEditing(editing === t.table ? null : t.table)}>
                              {t.answer ? '답 고치기' : '답 입력'}
                            </button>
                          </td>
                        </tr>,
                      ];
                      if (editing === t.table) {
                        rows.push(
                          <tr key={`e${t.table}`} className="rcq-edit-row">
                            <td colSpan={q.open ? 4 : 6}>
                              <QuizAnswerEditor
                                question={q}
                                initial={t.answer}
                                busy={busy === `ans:${t.table}`}
                                onSave={(v) => saveAnswer(t.table, v)}
                                onClear={t.answer ? async () => {
                                  if (await adminConfirm(`${t.table}번 테이블 답을 지울까요?\n손님이 낸 답이라도 지워져요.`)) saveAnswer(t.table, null);
                                } : null}
                                onCancel={() => setEditing(null)}
                              />
                            </td>
                          </tr>,
                        );
                      }
                      return rows;
                    })}
                  </tbody>
                </table>
              </AdminTableScroll>
            </section>

            {/* 점수판 */}
            <section className="adm-card">
              <div className="adm-card-head">
                <div>
                  <p className="adm-card-title">점수판</p>
                  <p className="adm-card-sub">{boardAll ? '아직 공개 안 한 문제까지 채점한 참고용이에요' : `공개한 ${scoredShown}문제만 — 손님 화면과 같은 점수예요`}</p>
                </div>
                <div className="adm-seg" role="tablist" aria-label="점수판">
                  <button type="button" role="tab" aria-selected={!boardAll} className={!boardAll ? 'on' : ''} onClick={() => setBoardAll(false)}>공개분</button>
                  <button type="button" role="tab" aria-selected={boardAll} className={boardAll ? 'on' : ''} onClick={() => setBoardAll(true)}>전체 채점</button>
                </div>
              </div>
              <ol className="rcq-board">
                {board.map((b) => (
                  <li key={b.table} className={b.rank <= 3 && b.score > 0 ? 'top' : ''}>
                    <span className="rcq-board-rank">{b.rank <= 3 && b.score > 0 ? <RankCrown rank={b.rank as 1 | 2 | 3} size={22} label={`${b.rank}등`} /> : b.rank}</span>
                    <span className="rcq-board-table">{b.table}번 테이블</span>
                    <span className="rcq-board-score"><RollingNumber value={b.score} /><small>점 · {b.correct}문제</small></span>
                  </li>
                ))}
              </ol>
            </section>

            <section className="rcq-danger">
              <p>초기화 — 리허설 뒤 정리용이에요. 두 번 물어봐요.</p>
              <div className="rcq-actions">
                <button type="button" className="adm-btn danger" disabled={stateBusy || !(res?.submitted) && !tables.some((t) => t.override !== null)} onClick={resetOne}>이 문제 답 지우기</button>
                <button type="button" className="adm-btn danger" disabled={stateBusy} onClick={resetAll}>전체 초기화</button>
              </div>
            </section>
          </div>
        )}
      </div>

      <ReceptionStage
        open={stage}
        onClose={() => setStage(false)}
        label="퀴즈 크게 보기"
        nav="quiz"
        foot={
          <>
            <button type="button" className={`rca-stage-btn ${st.phase === 'idle' || st.phase === 'revealed' ? 'go' : ''}`} disabled={stateBusy || !nextQ} onClick={openNext}>
              {nextQ ? `다음 문제 열기 · ${qShort(nextQ)}` : '모든 문제를 공개했어요'}
            </button>
            <button type="button" className="rca-stage-btn" disabled={stateBusy || st.phase !== 'open'} onClick={extend}>+60초</button>
            <button type="button" className="rca-stage-btn" disabled={stateBusy || st.phase !== 'open'} onClick={lock}>마감</button>
            <button type="button" className="rca-stage-btn" disabled={stateBusy || !(st.phase === 'open' || st.phase === 'locked')} onClick={reveal}>{cur?.open ? '답 공개' : '정답 공개'}</button>
            <button type="button" className={`rca-stage-btn ${st.showBoard ? 'on' : ''}`} disabled={stateBusy} onClick={toggleBoard}>{st.showBoard ? '순위 발표 끄기' : '순위 발표'}</button>
            <button type="button" className="rca-stage-btn" disabled={stateBusy || st.phase === 'idle'} onClick={toIdle}>대기</button>
          </>
        }
      >
        <QuizStageBody data={data} now={now} />
      </ReceptionStage>
    </div>
  );
}

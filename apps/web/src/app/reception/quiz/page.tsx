'use client';

// 퀴즈(261122 사장 '퀴즈고 문제 — 정답이 공개될 때 각 테이블마다 어떤 정답을 썼는지도 확인 가능하게끔').
// 테이블별로 상의해서 한 답(같은 테이블은 마지막에 낸 답 하나). 진행(열기 · 마감 · 정답 공개 · 순위 발표)은 운영팀 어드민이 누르고,
// 손님 화면은 3초마다 상태를 받아 따라간다(화면이 숨으면 멈춤, 실패하면 이전 화면 그대로). 정답 · 채점은 서버만 안다.
//  · 대기 → 규칙 + 점수판 · 열림 → 문제 + 답 고르기 + 5분 막대 · 마감 → 우리 답 · 공개 → 정답 + 모든 테이블 답 + 점수판
//  · 운영팀이 '순위 발표'를 켜면 맨 위에 큰 점수판. 지난 공개 문제는 아래 '지난 문제'에 접어 둔다.
//  · 261122 사장 '이 웨딩홀은 어디일까요? 하고 3초 뒤에 이미지가 작아지면서 문제화면으로 그리고 각각 페이지별로 인터렉션 추가해줘'
//    = 문제가 막 열리면 등장 판(QuizIntro — 사진 전체 화면 3초 → 카드 그림 자리로 / 글 문제는 남색 판 2초 → 카드 머리로) 한 번,
//      마감 = '답안 마감' 도장, 정답 공개 = 정답 → 판정 → 테이블 답 줄이 차례로(reception.css 퀴즈 등장 연출 칸).
//      판은 폴링 · 남은 시간(서버 시각) · 고르던 답을 건드리지 않고, 끝나면 반드시 걷힌다(누르면 바로 끝 · 안전핀 6초).
//  · 261122 사장 '퀴즈에 도전 버튼 → 참여자 명단에 실패 성공 버튼 → 성공이면 몇점' + '테이블당 1명이라 2명이상 누를 수 없게끔'
//    = 스페셜 미션은 답 대신 [도전하기](QuizMission). 테이블당 대표 1명(서버가 먼저 온 한 명만 받음), 성공 · 실패는 운영팀이 찍고 3초 폴링으로 따라온다.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { NameGateInline } from '@/components/reception/NameGate';
import {
  QuizAnswerInput, QuizBoard, QuizCountdown, QuizQuestionHead, QuizTableAnswers, TablePicker,
} from '@/components/reception/QuizParts';
import { QuizIntro, useQuizImagePreload, useQuizIntro, type IntroTargets } from '@/components/reception/QuizIntro';
import { QuizMission } from '@/components/reception/QuizMission';
import { CheckIcon, CloseIcon, QuizIcon } from '@/components/reception/ReceptionIcons';
import { haptic } from '@/lib/haptics';
import { receptionApi, type QuizPublic, type QuizQuestionPublic } from '@/lib/reception/api';
import { readGuest, useReceptionGuest } from '@/lib/reception/guest';
import { resolveSeat, useReceptionMe } from '@/lib/reception/me';
import { MATCH_EMPTY, answerReady, kstTime, useQuizTable } from '@/lib/reception/quiz';

const POLL_MS = 3000;

const RULES = [
  '3라운드, 문제마다 100점이에요(스페셜 미션 300점).',
  '테이블별로 상의해서 한 답만 내요. 나중에 낸 답이 우리 테이블 답이 돼요.',
  '한 문제에 5분이에요. 마감 전까진 답을 바꿀 수 있어요.',
  '정답을 공개할 때 모든 테이블의 답이 함께 보여요.',
];

/** 서버가 준 '우리 답'을 고르기 칸 모양으로(match 는 칸 수만큼) */
const toDraft = (q: QuizQuestionPublic, answer: string) => (q.kind === 'match' ? answer.padEnd(q.slots?.length ?? 0, MATCH_EMPTY) : answer);

export default function ReceptionQuizPage() {
  const guest = useReceptionGuest();
  const name = guest?.name || '';
  const { me, status: meStatus } = useReceptionMe(guest);
  const seat = resolveSeat(me, name);
  const { quizTable, setPick } = useQuizTable(name, seat, meStatus === 'error');
  const table = quizTable.status === 'ready' ? quizTable.table : null;

  const [res, setRes] = useState<{ data: QuizPublic; table: number | null } | null>(null);
  const [failed, setFailed] = useState(false);
  const [picker, setPicker] = useState(false);
  const [sending, setSending] = useState(false);
  // 문제별 고르는 중인 답 — dirty 면 서버의 우리 답이 바뀌어도 덮지 않는다
  const [draft, setDraft] = useState<{ qid: string; value: string; dirty: boolean } | null>(null);

  // 늦게 온 응답이 새 응답을 덮지 않게 — 나중에 보낸 요청의 답만 쓴다
  const seq = useRef(0);
  const applied = useRef(0);
  const inflight = useRef(false);
  const again = useRef(false);
  const tableRef = useRef<number | null>(table);
  tableRef.current = table;

  const apply = useCallback((id: number, data: QuizPublic, forTable: number | null) => {
    if (id <= applied.current) return;
    applied.current = id;
    setRes({ data, table: forTable });
  }, []);

  const load = useCallback(async () => {
    if (inflight.current) { again.current = true; return; }
    inflight.current = true;
    const id = ++seq.current;
    const forTable = tableRef.current;
    try {
      const data = await receptionApi.quiz(readGuest().deviceId, forTable);
      apply(id, data, forTable);
      setFailed(false);
    } catch {
      setFailed(true);
    } finally {
      inflight.current = false;
      if (again.current) { again.current = false; load(); }
    }
  }, [apply]);

  useEffect(() => {
    if (!name) return;
    load();
    const t = setInterval(() => { if (document.visibilityState !== 'hidden') load(); }, POLL_MS);
    const onVis = () => { if (document.visibilityState !== 'hidden') load(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', onVis); };
  }, [name, load]);

  // 테이블이 정해지거나 바뀌면 바로 우리 답을 다시 받는다
  useEffect(() => { if (name && table) load(); }, [name, table, load]);

  const data = res?.data ?? null;
  const qById = useMemo(() => new Map((data?.questions ?? []).map((q) => [q.id, q])), [data]);
  const st = data?.state;
  const current = st?.currentId ? qById.get(st.currentId) ?? null : null;
  const phase = current && st ? st.phase : 'idle';
  const mine = res && res.table === table && data?.mine && current && data.mine.questionId === current.id ? data.mine : null;

  // 등장 연출 — 열림 하나(문제 + 연 시각)마다 한 번. 그림은 문제 목록이 오자마자 미리 받아 둔다
  useQuizImagePreload(data?.questions);
  const cardRef = useRef<HTMLElement>(null);
  const introKey = phase === 'open' && current ? `${current.id}@${st?.openedAt ?? ''}` : null;
  const intro = useQuizIntro(introKey, st?.openedAt ?? null, 'guest');
  const introTargets = useCallback((): IntroTargets => {
    const card = cardRef.current;
    return {
      photo: card?.querySelector<HTMLElement>('.rc-qz-figure img') ?? null,
      head: card?.querySelector<HTMLElement>('.rc-qz-head') ?? null,
      slots: card ? Array.from(card.querySelectorAll<HTMLElement>('.rc-qz-match-slot')) : [],
      scrollBox: card,
    };
  }, []);

  // 서버의 우리 답을 고르기 칸에 채운다 — 손님이 고치는 중(dirty)이면 그대로
  useEffect(() => {
    if (!current || phase !== 'open') return;
    setDraft((d) => {
      if (d && d.qid === current.id && d.dirty) return d;
      const value = mine ? toDraft(current, mine.answer) : d?.qid === current.id ? d.value : '';
      return d && d.qid === current.id && d.value === value ? d : { qid: current.id, value, dirty: false };
    });
  }, [current, phase, mine]);

  if (!guest) return <div className="rc-page" />;

  if (!name) {
    return (
      <div className="rc-page rc-quiz-page">
        <NameGateInline
          cta="퀴즈 참여하기"
          hint="테이블별로 답을 내요. 낸 사람 이름이 우리 테이블 답 옆에 보여요."
          onDone={() => {}}
        />
      </div>
    );
  }

  const revealed = st?.revealed ?? [];
  const results = data?.results ?? {};
  const board = data?.board ?? [];
  // 점수판은 점수 있는 문제가 하나라도 공개된 뒤부터(오프닝 주관식만 공개됐으면 0점 판이라 숨김)
  const scoredRevealed = revealed.some((id) => { const q = qById.get(id); return !!q && !q.open; });
  const pastIds = [...revealed].reverse().filter((id) => !(phase === 'revealed' && id === current?.id) && qById.has(id));
  const value = current && draft?.qid === current.id ? draft.value : '';
  const ready = !!current && answerReady(current, value);
  const same = !!mine && !!current && (current.kind === 'text' ? mine.answer === value.trim() : mine.answer === value);

  const send = async () => {
    if (!current || !table || !ready || same || sending) return;
    const g = readGuest();
    setSending(true);
    try {
      const answer = current.kind === 'text' ? value.trim() : value;
      const next = await receptionApi.answer(g.deviceId, { questionId: current.id, table, answer, name: g.name || name });
      // 번호는 받은 순간에 — 쓰기 뒤 최신 상태라, 보내는 사이 시작된 폴링(쓰기 전 스냅샷일 수 있음)이 덮지 못하게
      apply(++seq.current, next, table);
      setDraft({ qid: current.id, value: toDraft(current, answer), dirty: false });
      haptic('light');
      toast.success(mine ? '우리 테이블 답을 바꿨어요' : '우리 테이블 답을 냈어요');
    } catch (e: any) {
      toast.error(e?.message || '잠시 후 다시 시도해 주세요.');
      load();
    } finally {
      setSending(false);
    }
  };

  /** 스페셜 미션 도전 — 테이블당 1명. 이미 다른 사람이 했으면 서버가 이유를 알려 주고, 바로 다시 받아 그 사람 이름을 보여 준다 */
  const challenge = async () => {
    if (!current || current.kind !== 'mission' || !table || sending) return;
    const g = readGuest();
    setSending(true);
    try {
      const next = await receptionApi.challenge(g.deviceId, { questionId: current.id, table, name: g.name || name });
      apply(++seq.current, next, table);
      haptic('success');
      toast.success('우리 테이블 대표로 도전했어요!');
    } catch (e: any) {
      toast.error(e?.message || '잠시 후 다시 시도해 주세요.');
      load();
    } finally {
      setSending(false);
    }
  };

  const tableBar = (
    <div className="rc-qz-tablebar">
      {quizTable.status === 'ready' ? (
        <>
          <span className="rc-qz-tablebar-label">우리 테이블</span>
          <b className="rc-qz-tablebar-no">TABLE {quizTable.table}</b>
          <button type="button" className="rc-text-btn" onClick={() => setPicker(true)}>테이블 바꾸기</button>
        </>
      ) : quizTable.status === 'wait' ? (
        <span className="rc-qz-tablebar-label">우리 테이블을 찾고 있어요</span>
      ) : (
        <>
          <span className="rc-qz-tablebar-label">우리 테이블을 아직 안 골랐어요</span>
          <button type="button" className="rc-text-btn" onClick={() => setPicker(true)}>테이블 고르기</button>
        </>
      )}
    </div>
  );

  // 임시 자리(명단 없음)는 한 번 확인 — 틀린 테이블로 내면 남의 테이블 답을 덮어쓴다
  const confirmCard = quizTable.status === 'confirm' && (
    <section className="rc-glass rc-qz-confirm rc-rise">
      <p className="rc-qz-confirm-q">우리 테이블이 <b>{quizTable.suggest}번</b> 맞나요?</p>
      <p className="rc-qz-confirm-desc">테이블 가운데 번호판을 확인해 주세요. 이 테이블 이름으로 답이 나가요.</p>
      <div className="rc-sheet-actions">
        <button type="button" className="rc-btn-line sm" onClick={() => setPicker(true)}>다른 테이블이에요</button>
        <button type="button" className="rc-btn-gold sm" onClick={() => setPick(quizTable.suggest, false)}>맞아요</button>
      </div>
    </section>
  );

  const myResult = current ? results[current.id]?.tables.find((t) => t.table === table) : undefined;

  let main: React.ReactNode;
  if (!data) {
    main = failed ? (
      <div className="rc-empty rc-rise">
        <p>퀴즈를 불러오지 못했어요.<br />잠시 후 다시 불러올게요.</p>
        <button type="button" className="rc-btn-line sm" onClick={() => load()}>다시 불러오기</button>
      </div>
    ) : (
      <div className="rc-qz-skel" aria-busy="true" />
    );
  } else if (!current || phase === 'idle') {
    main = (
      <section className="rc-qz-idle rc-rise">
        <span className="rc-empty-ic"><QuizIcon size={30} /></span>
        <h1 className="rc-qz-idle-title">{revealed.length ? '다음 문제를 기다려 주세요' : '곧 퀴즈가 시작돼요'}</h1>
        <ul className="rc-qz-rules">
          {RULES.map((r) => <li key={r}>{r}</li>)}
        </ul>
      </section>
    );
  } else if (phase === 'open') {
    main = (
      <section ref={cardRef} className={`rc-glass rc-qz-card rc-rise ${intro.stage ? `qzi-${intro.stage}` : ''}`} key={current.id}>
        <QuizQuestionHead q={current} />
        {current.kind !== 'mission' && <QuizCountdown openedAt={st!.openedAt} extraSec={st!.extraSec} />}
        {current.kind === 'mission' ? (
          <QuizMission q={current} table={table} mine={mine} myName={name} phase="open" sending={sending} onChallenge={challenge} />
        ) : table ? (
          <>
            <QuizAnswerInput
              q={current}
              value={value}
              onChange={(v) => setDraft({ qid: current.id, value: v, dirty: true })}
              onSubmit={send}
              disabled={sending}
            />
            <button type="button" className="rc-btn-gold rc-qz-send" onClick={send} disabled={!ready || same || sending}>
              {sending ? '보내는 중…' : same ? '이 답으로 냈어요' : mine ? '답 바꾸기' : '답 내기'}
            </button>
            <p className={`rc-qz-mine ${mine ? '' : 'none'}`}>
              {mine ? (
                <>우리 테이블 답: <b>{mine.display}</b> <span>({mine.name} 님{kstTime(mine.updatedAt) ? ` · ${kstTime(mine.updatedAt)}` : ''})</span></>
              ) : '아직 우리 테이블 답이 없어요'}
            </p>
          </>
        ) : (
          <p className="rc-qz-need-table">우리 테이블을 정하면 답을 낼 수 있어요.</p>
        )}
      </section>
    );
  } else if (phase === 'locked') {
    main = (
      <section className="rc-glass rc-qz-card rc-rise" key={`${current.id}-locked`}>
        <QuizQuestionHead q={current} compact />
        <p className="rc-qz-locked">{current.kind === 'mission' ? '도전 마감 — 결과 공개를 기다려 주세요' : current.open ? '답안 마감 — 테이블 답 공개를 기다려 주세요' : '답안 마감 — 정답 공개를 기다려 주세요'}</p>
        {current.kind === 'mission' && (mine || !table) && (
          <QuizMission q={current} table={table} mine={mine} myName={name} phase="locked" sending={false} onChallenge={() => {}} />
        )}
        {current.kind !== 'mission' && (
          <p className={`rc-qz-mine ${mine ? '' : 'none'}`}>
            {mine ? (
              <>우리 테이블 답: <b>{mine.display}</b> <span>({mine.name} 님)</span></>
            ) : table ? '우리 테이블은 답을 내지 않았어요' : ''}
          </p>
        )}
      </section>
    );
  } else {
    const r = results[current.id];
    main = (
      <section className="rc-qz-reveal rc-rise" key={`${current.id}-revealed`}>
        <div className="rc-glass rc-qz-card">
          <QuizQuestionHead q={current} compact />
          {/* 오프닝 주관식 — 정답 · 맞고 틀림 없이 우리 답만(모든 테이블 답은 아래 목록) */}
          {current.open ? (
            table && (
              <p className={`rc-qz-mine ${myResult?.display ? '' : 'none'}`}>
                {myResult?.display ? <>우리 테이블 답: <b>{myResult.display}</b></> : '우리 테이블은 답을 내지 않았어요'}
              </p>
            )
          ) : <>
          <p className="rc-qz-answer-eyebrow">정답</p>
          <p className="rc-qz-answer">{r?.answerLabel || current.answerLabel || ''}</p>
          {(r?.explanation || current.explanation) && <p className="rc-qz-explain">{r?.explanation || current.explanation}</p>}
          {table && (
            <p className={`rc-qz-verdict ${myResult?.correct ? 'ok' : 'no'}`}>
              {myResult?.correct ? <CheckIcon size={18} /> : <CloseIcon size={16} />}
              {myResult?.correct
                ? current.kind === 'mission' ? '우리 테이블 성공!' : '우리 테이블 정답!'
                : current.kind === 'mission' ? '아쉬워요 — 이번엔 300점을 못 받았어요'
                : myResult?.display ? `아쉬워요 — 우리 답: ${myResult.display}` : '우리 테이블은 답을 내지 않았어요'}
            </p>
          )}
          </>}
        </div>
        {r && <QuizTableAnswers q={current} tables={r.tables} myTable={table} />}
      </section>
    );
  }

  return (
    <div className="rc-page rc-quiz-page">
      {st?.showBoard && <QuizBoard board={board} myTable={table} big />}

      <header className="rc-qz-top">
        <p className="rc-eyebrow">Quiz Go</p>
        {tableBar}
      </header>

      {confirmCard}
      {main}

      {!st?.showBoard && scoredRevealed && <QuizBoard board={board} myTable={table} />}

      {pastIds.length > 0 && (
        <section className="rc-qz-past" aria-label="지난 문제">
          <h3 className="rc-qz-past-title">지난 문제</h3>
          {pastIds.map((id) => {
            const q = qById.get(id)!;
            const r = results[id];
            const mineRow = r?.tables.find((t) => t.table === table);
            return (
              <details key={id} className={`rc-qz-past-item ${q.open ? 'open-q' : ''}`}>
                <summary>
                  <span className="rc-qz-past-no">{q.open ? 'OPENING' : `R${q.round} · ${q.kind === 'mission' ? '미션' : `Q${q.no}`}`}</span>
                  <span className="rc-qz-past-label">{q.open ? q.prompt : r?.answerLabel || q.answerLabel || ''}</span>
                  {table && !q.open && <span className={`rc-qz-mark ${mineRow?.correct ? 'o' : 'x'}`} role="img" aria-label={mineRow?.correct ? '우리 테이블 정답' : '우리 테이블 오답'}>{mineRow?.correct ? <CheckIcon size={14} /> : <CloseIcon size={12} />}</span>}
                </summary>
                <div className="rc-qz-past-body">
                  {!q.open && <p className="rc-qz-past-prompt">{q.prompt}</p>}
                  {r?.explanation && <p className="rc-qz-explain">{r.explanation}</p>}
                  {r && <QuizTableAnswers q={q} tables={r.tables} myTable={table} />}
                </div>
              </details>
            );
          })}
        </section>
      )}

      {data && failed && <p className="rc-hint rc-qz-offline">연결이 잠시 끊겼어요. 다시 이어지면 바로 바뀌어요.</p>}

      {intro.overlay && intro.key && current && phase === 'open' && (
        <QuizIntro
          key={intro.key}
          q={current}
          prefix="rc-qzi"
          rootClassName="rc-theme"
          portal
          scroll
          targets={introTargets}
          onStage={intro.onStage}
          onDone={intro.onDone}
        />
      )}

      <TablePicker
        open={picker}
        current={table}
        onClose={() => setPicker(false)}
        onPick={(n) => { setPick(n, true); setPicker(false); }}
      />
    </div>
  );
}

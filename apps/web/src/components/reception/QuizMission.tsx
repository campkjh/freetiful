'use client';

// 스페셜 미션 도전(261122 사장 '퀴즈에 도전 버튼이 있어서 그거 누르면 참여자 명단에 실패 성공 버튼이 생겨서 성공이면 몇점 올라가게 테이블에'
//  + '참여형 퀴즈는 테이블당 1명이라 2명이상 누를 수 없게끔').
//  · 열림: 규칙 줄 + [도전하기] → 한 번 더 묻기(누르면 우리 테이블 다른 사람은 못 누름) → 서버(PUT quiz/challenge)가 테이블당 1명만 받는다.
//  · 우리 테이블에 이미 도전한 사람이 있으면 단추 대신 '○○ 님이 우리 테이블 대표로 도전 중' — 같은 테이블 두 번째 사람은 누를 수 없다
//    (화면은 3초 폴링 mine 으로 따라가고, 동시에 눌러도 서버가 먼저 온 한 명만 넣고 나머지엔 '이미 ○○ 님이 도전했어요').
//  · 운영팀이 참여자 명단에서 성공 · 실패를 찍으면 다음 폴링에 '성공! +300점' / '아쉬워요' — 성공으로 바뀌는 순간 한 번 진동 · 튀어 오름.
//  · 마감(locked): 단추 없이 상태만.
import { useEffect, useRef, useState } from 'react';
import { haptic } from '@/lib/haptics';
import type { QuizMine, QuizQuestionPublic } from '@/lib/reception/api';
import { CheckIcon } from './ReceptionIcons';
import './quiz-mission.css';

interface Props {
  q: QuizQuestionPublic;
  /** 우리 테이블(없으면 고르라고만) */
  table: number | null;
  /** 우리 테이블의 지금 미션 줄(도전한 사람 · 결과) */
  mine: QuizMine | null;
  /** 이 기기 손님 이름 — 내가 대표인지 */
  myName: string;
  phase: 'open' | 'locked';
  sending: boolean;
  onChallenge: () => void;
}

const same = (a: string, b: string) => a.normalize('NFKC').replace(/\s+/g, '') === b.normalize('NFKC').replace(/\s+/g, '');

export function QuizMission({ q, table, mine, myName, phase, sending, onChallenge }: Props) {
  const [asking, setAsking] = useState(false);
  const result = mine?.result ?? null;
  const challenger = mine?.name || '';
  const isMe = !!challenger && !!myName && same(challenger, myName);

  // 성공으로 바뀌는 순간만 진동(처음 그릴 때 이미 성공이면 조용히 — 다시 들어온 사람에게 매번 울리지 않게)
  const prev = useRef(result);
  const [cheer, setCheer] = useState(false);
  useEffect(() => {
    const was = prev.current;
    prev.current = result;
    if (was !== null && was !== 'success' && result === 'success') {
      haptic('success');
      setCheer(true);
      const t = window.setTimeout(() => setCheer(false), 900);
      return () => window.clearTimeout(t);
    }
  }, [result]);
  // 다른 사람이 먼저 도전했으면 묻기 창은 닫는다
  useEffect(() => { if (mine) setAsking(false); }, [mine]);

  const notes = (
    <ul className="rc-qm-notes">
      {(q.notes ?? []).map((n) => <li key={n}>{n}</li>)}
    </ul>
  );

  let body: React.ReactNode;
  if (!table) {
    // 마감 뒤엔 테이블을 골라도 도전할 수 없다 — '정하면 도전할 수 있어요'를 띄우지 않는다(fix 261123)
    body = phase === 'locked'
      ? <p className="rc-qm-closed">도전이 마감됐어요</p>
      : <p className="rc-qz-need-table">우리 테이블을 정하면 도전할 수 있어요.</p>;
  } else if (mine && result) {
    if (result === 'success') {
      body = (
        <div className={`rc-qm-state ok ${cheer ? 'cheer' : ''}`} role="status">
          <span className="rc-qm-badge"><CheckIcon size={16} />성공</span>
          <p className="rc-qm-points">+{q.points}점</p>
          <p className="rc-qm-sub">{challenger ? `${isMe ? '내가' : `${challenger} 님이`} 우리 테이블에 ${q.points}점을 가져왔어요` : `우리 테이블 ${q.points}점!`}</p>
        </div>
      );
    } else if (result === 'fail') {
      body = (
        <div className="rc-qm-state no" role="status">
          <span className="rc-qm-badge">아쉬워요</span>
          <p className="rc-qm-sub">{challenger ? `${isMe ? '내' : `${challenger} 님`} 도전은 이번엔 실패했어요` : '이번엔 점수를 못 받았어요'}</p>
        </div>
      );
    } else {
      body = (
        <div className="rc-qm-state wait" role="status">
          <span className="rc-qm-badge">도전 중</span>
          <p className="rc-qm-who">{isMe ? '내가 우리 테이블 대표예요' : `${challenger} 님`}</p>
          <p className="rc-qm-sub">{isMe ? `성공하면 우리 테이블 +${q.points}점! 결과는 운영팀이 표시해요` : `우리 테이블 대표로 도전했어요 · 테이블당 한 명만 도전할 수 있어요`}</p>
        </div>
      );
    }
  } else if (phase === 'locked') {
    body = <p className="rc-qm-closed">도전이 마감됐어요</p>;
  } else if (asking) {
    body = (
      <div className="rc-qm-ask" role="dialog" aria-label="도전 확인">
        <p className="rc-qm-ask-q">우리 테이블 대표로 도전할까요?</p>
        <p className="rc-qm-ask-desc">누르면 우리 테이블 다른 분은 도전할 수 없어요. 기회는 단 한 번!</p>
        <div className="rc-qm-ask-btns">
          <button type="button" className="rc-btn-line sm" onClick={() => { haptic('light'); setAsking(false); }} disabled={sending}>다음에요</button>
          <button type="button" className="rc-btn-gold sm" onClick={onChallenge} disabled={sending}>{sending ? '보내는 중…' : '도전!'}</button>
        </div>
      </div>
    );
  } else {
    body = (
      <div className="rc-qm-go-wrap">
        <button type="button" className="rc-btn-gold rc-qm-go" onClick={() => { haptic('light'); setAsking(true); }}>
          도전하기
        </button>
        <p className="rc-qm-go-hint">테이블당 대표 1명 · 성공하면 {q.points}점</p>
      </div>
    );
  }

  return (
    <div className="rc-qm">
      {notes}
      {body}
    </div>
  );
}

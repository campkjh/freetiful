"use client";

// 토스식 투표 — 피드 카드와 상세가 같이 쓴다.
//  · 누르면 바로(낙관적) 반영: 고른 줄이 톡 눌렸다 튀고, 체크가 그려지고, 막대가 줄마다 시차를 두고 차오르며
//    퍼센트가 0부터 세어 올라간다. 1등은 파랑, 내 선택은 파란 테두리 + 막대에 한 번 반짝.
//  · 서버 응답이 오면 그 값으로 맞추고, 실패(비로그인 등)하면 원래대로 되돌린다.
//  · 다른 항목을 누르면 표를 옮길 수 있다(서버가 upsert).
import { useEffect, useRef, useState } from "react";

export interface TossPollData {
  options: { id: string; text: string; votes: number; percent?: number }[];
  totalVotes: number;
  myOptionId: string | null;
}

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

// 숫자를 부드럽게 세어 올린다(중간에 목표가 바뀌면 지금 보이는 값에서 이어 간다).
function useCountUp(target: number, duration = 700, delay = 0) {
  const [shown, setShown] = useState(target);
  const currentRef = useRef(target);
  useEffect(() => {
    const from = currentRef.current;
    if (from === target) return;
    let raf = 0;
    let start = 0;
    const timer = window.setTimeout(() => {
      const step = (ts: number) => {
        if (!start) start = ts;
        const p = Math.min(1, (ts - start) / duration);
        const v = Math.round(from + (target - from) * easeOutCubic(p));
        currentRef.current = v;
        setShown(v);
        if (p < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    }, delay);
    return () => {
      window.clearTimeout(timer);
      cancelAnimationFrame(raf);
    };
  }, [target, duration, delay]);
  return shown;
}

export default function TossPoll({
  poll,
  onVote,
}: {
  poll: TossPollData;
  /** 서버에 투표하고 최신 poll 을 돌려준다. 실패하면 throw — 화면을 되돌린다. */
  onVote: (optionId: string) => Promise<TossPollData | null | undefined>;
}) {
  const [view, setView] = useState<TossPollData>(poll);
  const [pending, setPending] = useState(false);
  const [popId, setPopId] = useState<string | null>(null);
  // 이미 투표한 글은 화면에 나타날 때 막대가 0에서 차오르게 한 프레임 늦게 연다.
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const r = requestAnimationFrame(() => setRevealed(true));
    return () => cancelAnimationFrame(r);
  }, []);

  useEffect(() => {
    if (!pending) setView(poll);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [poll]);

  const voted = !!view.myOptionId;
  const total = view.totalVotes;
  const top = Math.max(0, ...view.options.map((o) => o.votes));
  const totalShown = useCountUp(total, 600);

  async function choose(id: string) {
    if (pending || view.myOptionId === id) return;
    const before = view;
    const prev = view.myOptionId;
    setView({
      ...view,
      myOptionId: id,
      totalVotes: view.totalVotes + (prev ? 0 : 1),
      options: view.options.map((o) => ({
        ...o,
        votes: o.votes + (o.id === id ? 1 : 0) - (o.id === prev ? 1 : 0),
      })),
    });
    setPopId(id);
    window.setTimeout(() => setPopId((p) => (p === id ? null : p)), 1100);
    setPending(true);
    try {
      const fresh = await onVote(id);
      if (fresh) setView(fresh);
    } catch {
      setView(before);
      setPopId(null);
    } finally {
      setPending(false);
    }
  }

  return (
    <div
      className={`tpoll${voted ? " is-voted" : ""}`}
      role="group"
      aria-label="투표"
      // 카드 클릭(상세 이동)으로 번지지 않게 — 여기선 투표만.
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      {view.options.map((o, i) => (
        <PollRow
          key={o.id}
          text={o.text}
          votes={o.votes}
          index={i}
          total={total}
          voted={voted}
          revealed={revealed}
          mine={view.myOptionId === o.id}
          lead={voted && top > 0 && o.votes === top}
          pop={popId === o.id}
          onChoose={() => choose(o.id)}
        />
      ))}
      <div className="tpoll-foot">
        <span>{totalShown.toLocaleString("ko-KR")}명 참여</span>
        {voted && <span className="tpoll-foot-note">· 다른 항목을 누르면 바꿀 수 있어요</span>}
      </div>
    </div>
  );
}

function PollRow({
  text,
  votes,
  index,
  total,
  voted,
  revealed,
  mine,
  lead,
  pop,
  onChoose,
}: {
  text: string;
  votes: number;
  index: number;
  total: number;
  voted: boolean;
  revealed: boolean;
  mine: boolean;
  lead: boolean;
  pop: boolean;
  onChoose: () => void;
}) {
  const pct = total > 0 ? Math.round((votes / total) * 100) : 0;
  const shown = useCountUp(voted && revealed ? pct : 0, 760, voted ? 90 + index * 70 : 0);
  return (
    <button
      type="button"
      className={`tpoll-opt${mine ? " is-mine" : ""}${lead ? " is-lead" : ""}${pop ? " is-pop" : ""}`}
      aria-pressed={mine}
      onClick={(event) => {
        event.stopPropagation();
        onChoose();
      }}
    >
      <span
        className="tpoll-bar"
        aria-hidden="true"
        style={{ width: `${voted && revealed ? pct : 0}%`, transitionDelay: voted ? `${index * 70}ms` : "0ms" }}
      />
      <span className="tpoll-label">
        <span className="tpoll-check" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="18" height="18">
            <path d="M5 12.5l4.3 4.3L19 7.2" />
          </svg>
        </span>
        <span className="tpoll-text">{text}</span>
      </span>
      <span className="tpoll-pct" aria-hidden={!voted}>
        {shown}%
      </span>
    </button>
  );
}

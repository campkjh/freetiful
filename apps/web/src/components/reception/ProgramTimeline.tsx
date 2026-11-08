'use client';

// 식순 줄 + 행사 날 '지금 순서' 짚기(261108 사장 '23일 18:20 이후에 그 시간에 맞게 식순부분이 포커스, 고급스럽게').
//  · 기준 = 기기 시계의 KST. 행사 날(RECEPTION_DAY) 17:00 ~ 21:00 만 — 다른 날은 줄만 그린다.
//  · 시각이 적힌 순서가 한 묶음의 머리: 시각 없는 순서는 앞 머리에 이어서 진행(표대로) → 지금 묶음 전체를 밝히고 머리에 'Now'.
//    지난 묶음은 옅게, 다음 머리엔 'Next'. 18:20 전엔 첫 순서에 'Next'(곧 시작).
//  · 위 띠(rc-live) = 지금 순서 한 줄 요약, 누르면 그 줄로. 처음 한 번은 지금 줄이 화면 아래쪽이면 가운데로 굴려 준다.
//  · 확인용: 주소 뒤 ?now=19:05 → 오늘을 행사 날로 치고 그 시각으로 그린다.
//  · 서버 그림엔 표시 없음(하이드레이션 뒤 시각을 읽는다), 30초마다 다시 계산.
import { useEffect, useRef, useState } from 'react';
import { RECEPTION_DAY, RECEPTION_PROGRAM } from '@/lib/reception/event';

const PART_LABEL = { 1: 'Part I', 2: 'Part II' } as const;
const OPEN = 17 * 60;
const CLOSE = 21 * 60;

const toMin = (t?: string) => {
  const m = t?.match(/(\d{1,2}):(\d{2})/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};
const fmt = (m: number) => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;

// 순서마다 속한 묶음 머리(시각 있는 순서)의 번호
const HEADS = RECEPTION_PROGRAM.map((p, i) => (toMin(p.time) != null ? i : -1)).filter((i) => i >= 0);
const HEAD_OF = RECEPTION_PROGRAM.map((_, i) => HEADS.filter((h) => h <= i).pop() ?? 0);

/** 지금 KST 분(행사 날이 아니면 null) */
function nowOnEventDay(): number | null {
  try {
    const q = new URLSearchParams(window.location.search).get('now');
    const fake = toMin(q || undefined);
    if (fake != null) return fake;
  } catch {}
  const k = new Date(Date.now() + 9 * 3600_000);
  if (k.toISOString().slice(0, 10) !== RECEPTION_DAY) return null;
  return k.getUTCHours() * 60 + k.getUTCMinutes();
}

type Live = { cur: number | null; next: number | null };

function liveAt(now: number | null): Live | null {
  if (now == null || now < OPEN || now >= CLOSE) return null;
  let cur: number | null = null;
  for (const h of HEADS) if ((toMin(RECEPTION_PROGRAM[h].time) as number) <= now) cur = h;
  const next = HEADS.find((h) => cur == null || h > cur) ?? null;
  return { cur, next };
}

export default function ProgramTimeline({ startIndex = 2 }: { startIndex?: number }) {
  const [live, setLive] = useState<Live | null>(null);
  const scrolled = useRef(false);

  useEffect(() => {
    const tick = () => setLive(liveAt(nowOnEventDay()));
    tick();
    const id = window.setInterval(tick, 30_000);
    const vis = () => document.visibilityState === 'visible' && tick();
    document.addEventListener('visibilitychange', vis);
    return () => { window.clearInterval(id); document.removeEventListener('visibilitychange', vis); };
  }, []);

  const focusRow = (smooth = true) => {
    const el = document.querySelector<HTMLElement>('[data-rc-focus]');
    el?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'center' });
  };

  // 처음 한 번 — 줄들이 떠오른 뒤, 지금 줄이 화면 아래쪽에 있으면 가운데로
  useEffect(() => {
    if (!live || scrolled.current) return;
    scrolled.current = true;
    const t = window.setTimeout(() => {
      const el = document.querySelector<HTMLElement>('[data-rc-focus]');
      if (el && el.getBoundingClientRect().top > window.innerHeight * 0.62) focusRow();
    }, 1100);
    return () => window.clearTimeout(t);
  }, [live]);

  const focusIdx = live ? (live.cur ?? live.next) : null;
  const cur = live?.cur != null ? RECEPTION_PROGRAM[live.cur] : null;
  const next = live?.next != null ? RECEPTION_PROGRAM[live.next] : null;
  const curEnd = live?.next != null ? toMin(RECEPTION_PROGRAM[live.next].time) : null;
  const curMore = live?.cur != null ? HEAD_OF.filter((h) => h === live.cur).length - 1 : 0;

  let i = startIndex;
  return (
    <>
      {live && (
        <button type="button" className="rc-live" onClick={() => focusRow()} aria-label="지금 순서로 이동">
          <span className="rc-live-eyebrow">
            <i aria-hidden="true" />
            {cur ? 'Now' : 'Coming up'}
          </span>
          <span className="rc-live-body">
            <span className="rc-live-title">
              {cur ? cur.title : '곧 시작해요'}
              {cur && curMore > 0 && <small> 외 {curMore}개 순서</small>}
            </span>
            <span className="rc-live-sub">
              {cur
                ? `${cur.time?.replace(/~$/, '')}${curEnd != null ? ` – ${fmt(curEnd)}` : ''}${next ? ` · 다음 ${next.time} ${next.title}` : ''}`
                : next ? `${next.time} ${next.title}부터` : ''}
            </span>
          </span>
        </button>
      )}

      <section aria-label="식순" className="rc-program-list">
        {([1, 2] as const).map((part) => (
          <div key={part} className="rc-program-part">
            <h2 className="rc-part-head rc-rise" style={{ '--i': i++ } as React.CSSProperties}>
              <span className="rc-part-eyebrow">{PART_LABEL[part]}</span>
              <span className="rc-part-title">{part}부</span>
              <img src="/reception/divider.webp" alt="" aria-hidden="true" className="rc-divider" width={830} height={99} />
            </h2>
            <ol className="rc-program-rows">
              {RECEPTION_PROGRAM.map((item, k) => {
                if (item.part !== part) return null;
                const head = HEAD_OF[k];
                const state = !live
                  ? ''
                  : live.cur != null && head === live.cur
                    ? 'is-now'
                    : live.cur != null && head < live.cur
                      ? 'is-past'
                      : head === live.next
                        ? 'is-next'
                        : '';
                const isHead = head === k;
                return (
                  <li
                    key={k}
                    className={`rc-prow rc-rise ${state} ${state && isHead ? 'is-head' : ''}`}
                    style={{ '--i': i++ } as React.CSSProperties}
                    aria-current={state === 'is-now' && isHead ? 'step' : undefined}
                    data-rc-focus={focusIdx === k ? '' : undefined}
                  >
                    <span className="rc-tl-time">
                      {isHead && (state === 'is-now' || state === 'is-next') && (
                        <span className="rc-tl-flag">
                          {state === 'is-now' && <i aria-hidden="true" />}
                          {state === 'is-now' ? 'Now' : 'Next'}
                        </span>
                      )}
                      {item.time && <time>{item.time}</time>}
                    </span>
                    <div className="rc-tl-body">
                      <p className="rc-tl-title">
                        {item.title}
                        {item.tag && <span className="rc-tl-tag">{item.tag}</span>}
                      </p>
                      {item.note && <p className="rc-tl-note">{item.note}</p>}
                      {item.sub && (
                        <ul className="rc-tl-sub">
                          {item.sub.map((s) => <li key={s}>{s}</li>)}
                        </ul>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        ))}
      </section>
    </>
  );
}

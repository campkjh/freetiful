'use client';

// 출석 오버레이 — 사장 녹화(토스 출석) 프레임 분석 그대로.
//  in(0~0.8s): 바탕이 아래부터 씻기듯 덮이고 'N일째'가 22pt, 7칸이 70pt 아래에서 올라온다(오늘 칸만 회색 동그라미, 나머지는 점).
//  roll(0.8s~): 옛 숫자 작아지며 사라지고 새 숫자 통통 등장 · '일째' 초록 · 오늘 칸 링 → 초록으로 차며 후광 · 점들이 동그라미로 차례로 커짐
//              · 묶음 28pt 위로 · [확인했어요] 26pt 아래에서.
//  out: 0.2s 사라지고 onDone → 본문 차례 등장.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useBodyScrollLock } from '@/lib/hooks/useBodyScrollLock';
import { IcCheck } from './icons';

const DOW = '일월화수목금토';
const dayNum = (d: string) => {
  const [y, m, dd] = d.split('-').map(Number);
  return Date.UTC(y, m - 1, dd) / 86400000;
};
const fromNum = (n: number) => new Date(n * 86400000);

export default function CheckinOverlay({ prevCount, count, days, today, onDone }: {
  prevCount: number;
  count: number;
  /** 출석한 날들(KST YYYY-MM-DD, 오늘 포함) */
  days: string[];
  today: string;
  onDone: () => void;
}) {
  const [phase, setPhase] = useState<'in' | 'roll' | 'out'>('in');
  const doneRef = useRef(false);
  useBodyScrollLock(true);

  useEffect(() => {
    const t = setTimeout(() => setPhase('roll'), 800);
    return () => clearTimeout(t);
  }, []);

  // 첫 출석일부터 7칸(오늘이 그 주를 넘으면 오늘이 든 7일 묶음)
  const week = useMemo(() => {
    const t = dayNum(today);
    const first = days.length ? Math.min(...days.map(dayNum)) : t;
    const start = first + Math.floor(Math.max(0, t - first) / 7) * 7;
    const set = new Set(days.map(dayNum));
    return Array.from({ length: 7 }, (_, i) => {
      const n = start + i;
      return { n, label: DOW[fromNum(n).getUTCDay()], today: n === t, done: n !== t && set.has(n) };
    });
  }, [days, today]);

  const close = () => {
    if (phase !== 'roll' || doneRef.current) return;
    doneRef.current = true;
    setPhase('out');
    setTimeout(onDone, 220);
  };

  let grow = 0; // 점 → 동그라미 차례(오늘 다음 칸부터 40ms씩)
  return (
    <div className="ms-ov" data-phase={phase} role="dialog" aria-modal="true" aria-label={`출석 체크 ${count}일째`}>
      <div className="ms-ov-wash" />
      <div className="ms-ov-col">
        <div className="ms-ov-stack">
          <div className="ms-ov-count">
            <div className="ms-ov-num">
              <span className="ms-ov-digits" aria-hidden="true">
                <span className="old">{prevCount}</span>
                <span className="new">{count}</span>
              </span>
              <span className="ms-ov-unit">일째</span>
            </div>
            <p className="ms-ov-sub">출석 체크 완료</p>
          </div>
          <div className="ms-ov-week">
            {week.map((d) => {
              const delay = !d.today && !d.done ? 0.06 + grow++ * 0.04 : 0;
              return (
                <div key={d.n} className={`ms-day${d.today ? ' is-today' : ''}${d.done ? ' is-done' : ''}`}>
                  <span className="ms-day-slot">
                    <span className="ms-day-dot" style={{ ['--d' as string]: `${delay}s` }} />
                    {d.today && (
                      <>
                        <svg className="ms-day-ring" viewBox="0 0 42 42" aria-hidden="true"><circle cx="21" cy="21" r="18" /></svg>
                        <span className="ms-day-fill" />
                      </>
                    )}
                    {(d.today || d.done) && <IcCheck className="ms-day-ic" />}
                  </span>
                  <span className="ms-day-label">{d.label}</span>
                </div>
              );
            })}
          </div>
        </div>
        <button type="button" className="ms-ov-btn" onClick={close}>확인했어요</button>
      </div>
    </div>
  );
}

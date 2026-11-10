'use client';

// 출석 오버레이 — 사장 녹화(토스 출석) 프레임 분석 그대로.
//  in(0~0.8s): 바탕이 아래부터 씻기듯 덮이고 'N일째'가 22pt, 칸 줄이 70pt 아래에서 올라온다(오늘 칸만 회색 동그라미, 나머지는 점).
//  칸 = 미션 단계 4개(출석 1일차 · 2일차 · 글쓰기 · 견적) — 녹화의 요일 7칸 대신(261110 사장 '2일 출석체크 그리고 미션 2개, 지금 1주일치가 나옴').
//  roll(0.8s~): 옛 숫자 작아지며 사라지고 새 숫자 통통 등장 · '일째' 초록 · 오늘 칸 링 → 초록으로 차며 후광 · 점들이 동그라미로 차례로 커짐
//              · 묶음 28pt 위로 · [확인했어요] 26pt 아래에서.
//  out: 0.2s 사라지고 onDone → 본문 차례 등장.
import './mission.css';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useBodyScrollLock } from '@/lib/hooks/useBodyScrollLock';
import { IcCheck, IcDoc, IcPencil } from './icons';

export default function CheckinOverlay({ prevCount, count, required = 2, postDone, quoteDone, onDone, variant = 'page', sub, cta = '확인했어요' }: {
  prevCount: number;
  /** 오늘까지 출석한 날 수(오늘 포함) */
  count: number;
  /** 출석 미션 날 수(2) */
  required?: number;
  postDone: boolean;
  quoteDone: boolean;
  onDone: () => void;
  /** page = 미션 화면(바탕 통째로) · home = 홈 위(녹화 그대로 그라데이션으로 씻기고 아래에 붙음) */
  variant?: 'page' | 'home';
  /** 숫자 아래 글(없으면 판에 맞춘 기본) · 버튼 글 */
  sub?: string;
  cta?: string;
}) {
  const [phase, setPhase] = useState<'in' | 'roll' | 'out'>('in');
  const doneRef = useRef(false);
  useBodyScrollLock(true);

  useEffect(() => {
    const t = setTimeout(() => setPhase('roll'), 800);
    return () => clearTimeout(t);
  }, []);

  // 출석 N일차 칸들(오늘 출석한 칸이 '오늘') + 글쓰기 + 견적
  const week = useMemo(() => {
    const att = Array.from({ length: required }, (_, i) => ({
      n: `att${i}`, label: `${i + 1}일차`, kind: 'att' as const,
      today: i === count - 1, done: i < count - 1,
    }));
    return [
      ...att,
      { n: 'post', label: '글쓰기', kind: 'post' as const, today: false, done: postDone },
      { n: 'quote', label: '견적', kind: 'quote' as const, today: false, done: quoteDone },
    ];
  }, [count, required, postDone, quoteDone]);

  const close = () => {
    if (phase !== 'roll' || doneRef.current) return;
    doneRef.current = true;
    setPhase('out');
    setTimeout(onDone, 220);
  };

  let grow = 0; // 점 → 동그라미 차례(오늘 다음 칸부터 40ms씩)
  return (
    <div className={`ms-ov${variant === 'home' ? ' is-home' : ''}`} data-phase={phase} role="dialog" aria-modal="true" aria-label={`출석 체크 ${count}일째`}>
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
            <p className="ms-ov-sub">{sub ?? (variant === 'home' ? '5,000원 미션 출석 완료' : '출석 체크 완료')}</p>
          </div>
          <div className="ms-ov-week">
            {week.map((d) => {
              const delay = !d.today && !d.done ? 0.06 + grow++ * 0.04 : 0;
              return (
                <div key={d.n} className={`ms-day${d.today ? ' is-today' : ''}${d.done ? ' is-done' : ''}${d.kind !== 'att' ? ' is-task' : ''}`} style={{ ['--d' as string]: `${delay}s` }}>
                  <span className="ms-day-slot">
                    <span className="ms-day-dot" />
                    {d.today && (
                      <>
                        <svg className="ms-day-ring" viewBox="0 0 42 42" aria-hidden="true"><circle cx="21" cy="21" r="18" /></svg>
                        <span className="ms-day-fill" />
                      </>
                    )}
                    {d.kind === 'att' ? (d.today || d.done) && <IcCheck className="ms-day-ic" />
                      : d.kind === 'post' ? <IcPencil className="ms-day-ic" /> : <IcDoc className="ms-day-ic" />}
                  </span>
                  <span className="ms-day-label">{d.label}</span>
                </div>
              );
            })}
          </div>
        </div>
        <button type="button" className="ms-ov-btn" onClick={close}>{cta}</button>
      </div>
    </div>
  );
}

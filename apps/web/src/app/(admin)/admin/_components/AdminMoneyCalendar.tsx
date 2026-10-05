'use client';

import { useMemo, useState } from 'react';
import { AdminCollapse } from './AdminCollapse';

/* ─────────────────────────────────────────────────────────────
 * 날마다 수입 달력 — 홈 '지출 · 수입' 줄의 이번 주(일~토) + ⌄ 로 이번 달(261004~05).
 *  결제 조회도 위에 같은 달력을 쓴다(261005 사장 '결제 조회도 상단에 달력 — 홈처럼').
 *  onPick 을 주면 날짜 칸을 누를 수 있다(결제 조회: 그날 결제만 보기) — 고른 날 = 연한 파랑. 홈은 안 줘서 예전 그대로.
 *  데이터 = 서버 money-summary(지난달 1일 ~ 오늘 KST, 날마다 수입·지출). 칸에는 수입(결제 완료)만.
 * ──────────────────────────────────────────────────────────── */
export type MoneyDay = { date: string; income: number; expense: number };
export type MoneySummary = { today: string; thisMonth: string; lastMonth: string; daily: MoneyDay[] };

const WEEK_KO = ['일', '월', '화', '수', '목', '금', '토'];
const won = (n: number) => `${Math.round(Math.abs(n)).toLocaleString('ko-KR')}`;
const signed = (n: number) => (n > 0 ? `+${won(n)}` : n < 0 ? `-${won(n)}` : '0');
const ymdUTC = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;

export function AdminMoneyCalendar({ data, selected, onPick }: {
  data: MoneySummary;
  /** 고른 날(YYYY-MM-DD) — onPick 과 같이 */
  selected?: string | null;
  /** 날짜 칸 누름(오늘 뒤 날짜는 못 누름) */
  onPick?: (date: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const byDate = useMemo(() => new Map(data.daily.map((d) => [d.date, d])), [data]);
  const [ty, tm, td] = data.today.split('-').map(Number);

  // 이번 주(일~토) — 오늘이 든 주
  const todayUTC = Date.UTC(ty, tm - 1, td);
  const weekStart = todayUTC - new Date(todayUTC).getUTCDay() * 86400000;
  const week = Array.from({ length: 7 }, (_, i) => new Date(weekStart + i * 86400000));
  // 이번 달 달력(⌄ 펼치면)
  const firstDow = new Date(Date.UTC(ty, tm - 1, 1)).getUTCDay();
  const daysIn = new Date(Date.UTC(ty, tm, 0)).getUTCDate();
  const monthCells = Array.from({ length: Math.ceil((firstDow + daysIn) / 7) * 7 }, (_, k) => {
    const day = k - firstDow + 1;
    return day >= 1 && day <= daysIn ? new Date(Date.UTC(ty, tm - 1, day)) : null;
  });

  const Cell = ({ d, showLabel }: { d: Date | null; showLabel?: boolean }) => {
    if (!d) return <span className="adm-money-cell" />;
    const key = ymdUTC(d);
    const row = byDate.get(key);
    const isToday = key === data.today;
    const future = key > data.today;
    // 날마다 수입(결제 완료)만 — 지출은 이 줄에서 뺐다(261005)
    const inc = row ? row.income : 0;
    const cls = `adm-money-cell ${isToday ? 'today' : ''} ${future ? 'future' : ''} ${selected === key ? 'pick' : ''}`;
    const inner = (
      <>
        <span className="adm-money-day">
          {showLabel && <span className="adm-money-wd">{WEEK_KO[d.getUTCDay()]}</span>}
          <span className="adm-money-date">{d.getUTCDate()}</span>
        </span>
        <span className={`adm-money-net ${inc > 0 ? 'plus' : ''}`}>
          {!future && inc > 0 && (
            <>
              <span className="adm-money-net-long">{signed(inc)}</span>
              {/* 폰 — 칸이 좁아 만원 단위로(+166만) */}
              <span className="adm-money-net-short">{inc >= 10000 ? `+${Math.round(inc / 10000).toLocaleString('ko-KR')}만` : signed(inc)}</span>
            </>
          )}
        </span>
      </>
    );
    if (!onPick) return <span className={cls}>{inner}</span>;
    return (
      <button
        type="button"
        className={`${cls} btn`}
        disabled={future}
        aria-pressed={selected === key}
        aria-label={`${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일 ${WEEK_KO[d.getUTCDay()]}요일 결제 ${won(inc)}원`}
        onClick={() => onPick(key)}
      >
        {inner}
      </button>
    );
  };

  return (
    <>
      <AdminCollapse open={!open}>
        <div className="adm-money-week rise" key="week">
          {week.map((d, i) => (
            <span key={ymdUTC(d)} className="adm-money-rise" style={{ animationDelay: `${0.12 + i * 0.07}s` }}>
              <Cell d={d} showLabel />
            </span>
          ))}
        </div>
      </AdminCollapse>
      <AdminCollapse open={open}>
        <div className="adm-money-month" key="month">
          <div className="adm-money-week head">
            {WEEK_KO.map((w) => <span key={w} className="adm-money-cell"><span className="adm-money-wd">{w}</span></span>)}
          </div>
          {Array.from({ length: monthCells.length / 7 }, (_, r) => (
            <div key={r} className="adm-money-week row" style={{ animationDelay: `${r * 0.05}s` }}>
              {monthCells.slice(r * 7, r * 7 + 7).map((d, i) => <Cell key={d ? ymdUTC(d) : `e${r}-${i}`} d={d} />)}
            </div>
          ))}
        </div>
      </AdminCollapse>
      <button type="button" className={`adm-money-more ${open ? 'on' : ''}`} onClick={() => setOpen((v) => !v)} aria-label={open ? '이번 주만 보기' : '이번 달 달력 보기'} aria-expanded={open}>
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M6 9l6 6 6-6" stroke="#6B7684" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </>
  );
}

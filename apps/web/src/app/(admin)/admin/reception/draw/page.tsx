'use client';

/* 송년회 럭키드로우(261122 사장 '럭키드로우도 이벤트로 해줘') — 손님이 입장할 때 자동으로 받은 응모권에서 뽑는다.
 *  · 뽑기는 서버가 한다(crypto.randomInt, 겹쳐 눌러도 같은 사람 두 번 안 나옴). 여기선 연출만 —
 *    누르자마자 번호가 빠르게 굴러가다(약 2.4초, 감속) 서버가 뽑은 번호에 멈추며 이름 · 테이블을 크게 + 진동.
 *  · 굴러가는 번호 · 이름 = 아직 안 뽑힌 실제 응모권(입장 현황에서 받음) — 없으면 숫자만.
 *  · 자리에 없으면 [무효] → 그 응모권은 다시 안 뽑고(서버 규칙), 같은 경품으로 한 번 더 추첨.
 *  · [크게 보기] = 대표님이 직접 누르는 전체 화면(판 안에도 경품 고르기 · 추첨 버튼).
 *  · 굴리는 동안 표 · 숫자 · 경품 남은 수는 누르기 직전 값으로 묶어 둔다 — 서버 응답·폴링이 먼저 와도 당첨자가 미리 안 드러나게.
 *  · 화면 읽기: 굴리는 번호는 숨기고(실명이 줄줄이 읽힘), 멈춘 뒤 당첨 한 줄만 알린다. */
import { useEffect, useMemo, useRef, useState } from 'react';
import { RollingNumber } from '../../_components/AdminNumber';
import { AdminListCard, AdminTableScroll } from '../../_components/AdminListCard';
import { adminAlert, adminConfirm } from '../../_components/adminDialog';
import {
  adminErrorText,
  kstHm,
  receptionAdminApi,
  ticketLabel,
  useReceptionDraws,
  useReceptionLive,
  useReducedMotion,
  type DrawBoard,
  type DrawRow,
} from '../../_components/receptionAdmin';
import { ReceptionStage } from '../_parts/ReceptionStage';
import { haptic } from '@/lib/haptics';
import '../reception-admin.css';

type Shown = { number: number | null; name: string; table: number | null };
type Roll = { phase: 'idle' | 'rolling' | 'done'; prize: string; shown: Shown | null; win: DrawRow | null };

const sleep = (ms: number) => new Promise<void>((r) => window.setTimeout(r, ms));
const PRIZE_MAX = 40;
/** 경품 이름 뒤 은/는 — 한글 받침으로 고른다(한글이 아니면 '은(는)') */
const eunNeun = (w: string) => {
  const c = w.trim().charCodeAt(w.trim().length - 1);
  if (!(c >= 0xac00 && c <= 0xd7a3)) return `${w}은(는)`;
  return `${w}${(c - 0xac00) % 28 ? '은' : '는'}`;
};

/** announce = 지금 보이는 판 하나만 알림 칸을 둔다(본문 판 · 크게 보기 판이 같이 읽히지 않게) */
function DrawScreen({ roll, prize, big = false, announce = false }: { roll: Roll; prize: string; big?: boolean; announce?: boolean }) {
  const s = roll.phase === 'done' && roll.win ? { number: roll.win.number, name: roll.win.name, table: roll.win.table } : roll.shown;
  const said = roll.phase === 'done' && roll.win
    ? `${roll.prize} 당첨, ${ticketLabel(roll.win.number)} ${roll.win.name} 님${roll.win.table != null ? `, ${roll.win.table}번 테이블` : ''}`
    : '';
  return (
    <div className={`rcd-screen ${big ? 'big' : ''} ${roll.phase}`}>
      {announce && <p className="sr-only" aria-live="polite" aria-atomic="true">{said}</p>}
      <p className="rcd-prize-label">{roll.phase === 'done' ? `${roll.prize} 당첨!` : roll.phase === 'rolling' ? `${roll.prize} 추첨 중…` : prize || '경품을 골라 주세요'}</p>
      {s ? (
        <div className="rcd-result" key={roll.phase === 'done' ? `w:${roll.win?.id}` : 'roll'} aria-hidden={roll.phase === 'rolling' || undefined}>
          <p className="rcd-num">{s.number != null ? ticketLabel(s.number) : 'No. ···'}</p>
          <p className="rcd-name">{s.name || ' '}</p>
          <p className="rcd-table">{roll.phase === 'done' ? (s.table != null ? `${s.table}번 테이블` : '테이블 정보 없음') : ' '}</p>
        </div>
      ) : (
        <div className="rcd-result idle">
          <p className="rcd-num dim">No. ···</p>
          <p className="rcd-name dim">추첨을 기다리고 있어요</p>
        </div>
      )}
    </div>
  );
}

export default function ReceptionDrawPage() {
  const { data, loading, error, mutate } = useReceptionDraws(5000);
  const live = useReceptionLive(10000);
  const reduce = useReducedMotion();
  const [prize, setPrize] = useState('');
  const [custom, setCustom] = useState('');
  const [customOn, setCustomOn] = useState(false);
  const [roll, setRoll] = useState<Roll>({ phase: 'idle', prize: '', shown: null, win: null });
  // 굴리는 동안 화면에 그릴 값 — 누르기 직전 board(멈출 때 null 로 풀면 실제 data 로 바뀐다)
  const [frozen, setFrozen] = useState<DrawBoard | null>(null);
  const [stage, setStage] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const alive = useRef(true);
  // 개발 모드 StrictMode 는 마운트를 두 번 하므로 들어올 때 다시 true 로
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  // 처음엔 남은 게 있는 첫 경품
  useEffect(() => {
    if (!data || prize) return;
    const first = data.prizes.find((p) => p.drawn < p.total) || data.prizes[0];
    if (first) setPrize(first.name);
  }, [data, prize]);

  const prizeName = (customOn ? custom : prize).trim();

  /** 굴릴 후보 — 아직 한 번도 안 뽑힌 응모권(무효 포함해 뽑힌 번호는 뺀다) */
  const pool = useMemo<Shown[]>(() => {
    const drawn = new Set((data?.draws || []).map((d) => d.number));
    return (live.data?.arrivals || []).filter((a) => !drawn.has(a.number)).map((a) => ({ number: a.number, name: a.name, table: a.table }));
  }, [data, live.data]);
  const maxNo = useMemo(() => Math.max(data?.tickets || 0, ...(live.data?.arrivals || []).map((a) => a.number), 1), [data, live.data]);

  const runDraw = async () => {
    if (roll.phase === 'rolling') return;
    const name = prizeName;
    if (!name) return adminAlert('경품을 골라 주세요\n직접 입력이면 경품 이름을 적어 주세요.');
    if ([...name].length > PRIZE_MAX) return adminAlert(`경품 이름이 너무 길어요\n${PRIZE_MAX}자까지 적을 수 있어요.`);
    if (data && data.eligible <= 0) return adminAlert('뽑을 응모권이 없어요\n입장한 손님이 아직 없거나 모두 뽑혔어요.');
    const p = data?.prizes.find((x) => x.name === name);
    if (p && p.drawn >= p.total && !(await adminConfirm({ title: `${eunNeun(name)} ${p.total}개 다 뽑았어요`, description: '그래도 한 번 더 뽑을까요?', confirmText: '더 뽑기' }))) return;

    setFrozen(data);
    setRoll({ phase: 'rolling', prize: name, shown: null, win: null });
    // 결과는 상자에 — 굴리는 동안 비동기로 채워진다
    const box: { win: DrawRow | null; fail: unknown; settled: boolean } = { win: null, fail: null, settled: false };
    const req = mutate(() => receptionAdminApi.draw(name), (r): DrawBoard => r.board)
      .then((r) => { box.win = r.draw; })
      .catch((e) => { box.fail = e || new Error('추첨하지 못했어요'); })
      .finally(() => { box.settled = true; });

    if (reduce) {
      await req;
    } else {
      // 빠르게(45ms) 굴리다 0.9초가 지나고 결과가 오면 점점 느리게 — 다 해서 약 2.4초
      let delay = 45;
      let elapsed = 0;
      let last = -1;
      for (;;) {
        let pick: Shown;
        if (pool.length) {
          let i = Math.floor(Math.random() * pool.length);
          if (pool.length > 1 && i === last) i = (i + 1) % pool.length;
          last = i;
          pick = pool[i];
        } else {
          pick = { number: 1 + Math.floor(Math.random() * maxNo), name: '', table: null };
        }
        if (!alive.current) return;
        setRoll((r) => ({ ...r, shown: pick }));
        await sleep(delay);
        elapsed += delay;
        if (box.settled && box.fail) break;
        if (box.settled && elapsed >= 900) delay *= 1.2;
        if (delay > 330) break;
      }
      await req;
    }
    if (!alive.current) return;
    setFrozen(null);
    if (box.fail || !box.win) {
      setRoll({ phase: 'idle', prize: name, shown: null, win: null });
      await adminAlert(`추첨하지 못했어요\n${adminErrorText(box.fail, '다시 눌러 주세요')}`);
      return;
    }
    setRoll({ phase: 'done', prize: name, shown: null, win: box.win });
    haptic('success');
  };

  const cancel = async (d: DrawRow) => {
    if (!(await adminConfirm({ title: `${ticketLabel(d.number)} ${d.name} 님 당첨을 무효로 할까요?`, description: `자리에 없을 때만 무효로 해 주세요. 이 응모권은 다시 뽑히지 않아요. ${eunNeun(d.prize)} 한 번 더 추첨하면 돼요.`, confirmText: '무효' }))) return;
    setBusy(d.id);
    try {
      await mutate(() => receptionAdminApi.cancelDraw(d.id));
      if (roll.win?.id === d.id) setRoll((r) => ({ ...r, phase: 'idle', win: null, shown: null }));
    } catch (e) {
      await adminAlert(`무효로 하지 못했어요\n${adminErrorText(e)}`);
    } finally {
      setBusy(null);
    }
  };

  const rolling = roll.phase === 'rolling';
  /** 화면에 그리는 board — 굴리는 동안은 묶어 둔 값(폴링 · 추첨 응답이 먼저 와도 표 · 숫자가 안 바뀜) */
  const view = (rolling && frozen) || data;
  const draws = useMemo(() => [...(view?.draws || [])].sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0)), [view]);
  const won = draws.filter((d) => !d.cancelled).length;
  const voided = draws.length - won;

  const prizePicker = (onDark = false) => (
    <div className={`rcd-prizes ${onDark ? 'dark' : ''}`} role="radiogroup" aria-label="경품">
      {(view?.prizes || []).map((p) => {
        const left = Math.max(0, p.total - p.drawn);
        const on = !customOn && prize === p.name;
        return (
          <button key={p.name} type="button" role="radio" aria-checked={on} className={`rcd-prize ${on ? 'on' : ''} ${left === 0 ? 'out' : ''}`} disabled={rolling} onClick={() => { setCustomOn(false); setPrize(p.name); }}>
            <b>{p.name}</b>
            <small>{left > 0 ? `남은 ${left} / ${p.total}` : `${p.total}개 다 뽑았어요`}</small>
          </button>
        );
      })}
      <button type="button" role="radio" aria-checked={customOn} className={`rcd-prize ${customOn ? 'on' : ''}`} disabled={rolling} onClick={() => setCustomOn(true)}>
        <b>직접 입력</b>
        <small>목록에 없는 경품</small>
      </button>
    </div>
  );
  const customInput = customOn && (
    <input className="adm-input rcd-custom" value={custom} maxLength={PRIZE_MAX} placeholder="경품 이름(40자까지)" disabled={rolling} onChange={(e) => setCustom(e.target.value)} />
  );

  if (loading && !view) return <div className="rca"><p className="adm-empty">불러오는 중…</p></div>;
  if (!view) return <div className="rca"><p className="adm-empty">{error || '불러오지 못했어요'}</p></div>;

  return (
    <div className="rca space-y-5">
      <div className="adm-grid grid-cols-2 lg:grid-cols-4">
        <div className="adm-stat">
          <p className="adm-stat-label">응모권</p>
          <p className="adm-stat-value"><RollingNumber value={view.tickets} /><small>장</small></p>
          <p className="adm-stat-sub">입장한 사람 한 명에 한 장</p>
        </div>
        <div className="adm-stat">
          <p className="adm-stat-label">뽑을 수 있는 응모권</p>
          <p className="adm-stat-value" style={{ color: 'var(--admin-blue)' }}><RollingNumber value={view.eligible} /><small>장</small></p>
          <p className="adm-stat-sub">한 번 뽑힌 응모권은 빠져요</p>
        </div>
        <div className="adm-stat">
          <p className="adm-stat-label">당첨</p>
          <p className="adm-stat-value"><RollingNumber value={won} /><small>명</small></p>
          <p className="adm-stat-sub">{view.prizes.map((p) => `${p.name} ${p.drawn}/${p.total}`).join(' · ')}</p>
        </div>
        <div className="adm-stat">
          <p className="adm-stat-label">무효</p>
          <p className="adm-stat-value"><RollingNumber value={voided} /><small>건</small></p>
          <p className="adm-stat-sub">자리에 없어서 다시 뽑은 것</p>
        </div>
      </div>
      {error && <p className="adm-note">연결이 잠깐 끊겼어요 — 마지막으로 받은 화면이에요. ({error})</p>}

      <section className="adm-card rcd-panel">
        <div className="adm-card-head">
          <div>
            <p className="adm-card-title">경품 고르기</p>
            <p className="adm-card-sub">고른 경품으로 응모권 한 장을 뽑아요</p>
          </div>
          <button type="button" className="adm-btn" onClick={() => setStage(true)}>크게 보기</button>
        </div>
        {prizePicker()}
        {customInput}
        <DrawScreen roll={roll} prize={prizeName} announce={!stage} />
        <button type="button" className="rcd-go" disabled={rolling || view.eligible <= 0} onClick={runDraw}>
          {rolling ? '추첨 중…' : view.eligible <= 0 ? '뽑을 응모권이 없어요' : '추첨하기'}
        </button>
      </section>

      <AdminListCard
        filter={
          <div className="adm-toolbar">
            <p className="rcd-list-title">당첨 목록</p>
            <span className="adm-count grow" style={{ textAlign: 'right' }}>총 <b><RollingNumber value={draws.length} /></b>건</span>
          </div>
        }
      >
        {draws.length === 0 ? (
          <p className="adm-empty">아직 추첨하지 않았어요</p>
        ) : (
          <AdminTableScroll>
            <table className="adm-table rca-table">
              <thead>
                <tr>
                  <th>No.</th>
                  <th>이름</th>
                  <th>테이블</th>
                  <th>경품</th>
                  <th>시각</th>
                  <th aria-label="무효" />
                </tr>
              </thead>
              <tbody>
                {draws.map((d, i) => (
                  <tr key={d.id} className={d.cancelled ? 'rca-void' : ''} style={{ animationDelay: `${Math.min(i * 30, 900)}ms` }}>
                    <td className="rca-no">{ticketLabel(d.number)}</td>
                    <td><b className="rca-name">{d.name}</b></td>
                    <td className="adm-num">{d.table != null ? `${d.table}번` : '—'}</td>
                    <td>{d.prize}</td>
                    <td className="adm-num">{kstHm(d.at)}</td>
                    <td className="r">
                      {d.cancelled ? (
                        <span className="adm-badge">무효</span>
                      ) : (
                        <button type="button" className="adm-btn ghost sm rca-del" disabled={busy === d.id || rolling} onClick={() => cancel(d)}>무효</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </AdminTableScroll>
        )}
      </AdminListCard>

      <ReceptionStage open={stage} onClose={() => setStage(false)} label="럭키드로우 크게 보기">
        <div className="rcd-stage">
          <p className="rcs-eyebrow">LUCKY DRAW</p>
          <DrawScreen roll={roll} prize={prizeName} big announce />
          {prizePicker(true)}
          {customInput}
          <button type="button" className="rcd-go big" disabled={rolling || view.eligible <= 0} onClick={runDraw}>
            {rolling ? '추첨 중…' : view.eligible <= 0 ? '뽑을 응모권이 없어요' : '추첨하기'}
          </button>
          <p className="rcd-stage-sub">뽑을 수 있는 응모권 {view.eligible}장</p>
        </div>
      </ReceptionStage>
    </div>
  );
}

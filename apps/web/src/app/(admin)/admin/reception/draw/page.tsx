'use client';

/* 송년회 럭키드로우(261122 사장 '럭키드로우도 이벤트로 해줘') — 손님이 입장할 때 자동으로 받은 응모권에서 뽑는다.
 *  · 뽑기는 서버가 한다(crypto.randomInt, 겹쳐 눌러도 같은 사람 두 번 안 나옴). 여기선 연출만 —
 *    서버 결과를 받은 뒤 경품별 연출을 재생하고 이름 · 번호 · 테이블을 발표한다.
 *  · 자리에 없으면 [무효] → 그 응모권은 다시 안 뽑고(서버 규칙), 같은 경품으로 한 번 더 추첨.
 *  · [크게 보기] = 현재 경품만 보여 주는 무대 전체 화면.
 *  · 굴리는 동안 표 · 숫자 · 경품 남은 수는 누르기 직전 값으로 묶어 둔다 — 서버 응답·폴링이 먼저 와도 당첨자가 미리 안 드러나게.
 *  · 화면 읽기: 굴리는 번호는 숨기고(실명이 줄줄이 읽힘), 멈춘 뒤 당첨 한 줄만 알린다. */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { Maximize, Play, Trash2 } from 'lucide-react';
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
import { DrawReveal } from '../_parts/DrawReveal';
import { buildReveal, isBatchReveal, revealTheme, type RevealPlan } from '../_parts/draw-reveal';
import { haptic } from '@/lib/haptics';
import '../reception-admin.css';

type Roll = { phase: 'idle' | 'rolling' | 'done'; prize: string; win: DrawRow | null; wins?: DrawRow[]; preview?: boolean; openedCards?: number[]; scene?: { plan: RevealPlan; startedAt: number } };
const NO_CARDS: readonly number[] = [];

const PRIZE_MAX = 40;
/** 경품 이름 뒤 은/는 — 한글 받침으로 고른다(한글이 아니면 '은(는)') */
const eunNeun = (w: string) => {
  const c = w.trim().charCodeAt(w.trim().length - 1);
  if (!(c >= 0xac00 && c <= 0xd7a3)) return `${w}은(는)`;
  return `${w}${(c - 0xac00) % 28 ? '은' : '는'}`;
};

/** announce = 지금 보이는 판 하나만 알림 칸을 둔다(본문 판 · 크게 보기 판이 같이 읽히지 않게) */
function DrawScreen({ roll, prize, big = false, announce = false, onFinish, onOpenCard, reduce }: { roll: Roll; prize: string; big?: boolean; announce?: boolean; onFinish: () => void; onOpenCard: (index: number) => void; reduce: boolean }) {
  const s = roll.phase === 'done' ? roll.win : null;
  const winners = s ? roll.wins ?? [s] : [];
  const cardPlan = roll.scene?.plan.kind === 'cards' ? roll.scene.plan : null;
  const winnerOpen = cardPlan && roll.openedCards?.includes(cardPlan.winnerIndex);
  const said = s
    ? `${roll.prize} 당첨, ${winners.map(w => `${ticketLabel(w.number)} ${w.name} 님${w.table != null ? `, ${w.table}번 테이블` : ''}`).join(', ')}`
    : '';
  return (
    <div className={`rcd-screen ${big ? 'big' : ''} ${roll.phase}`}>
      {announce && <p className="sr-only" aria-live="polite" aria-atomic="true">{said}</p>}
      <p className="rcd-prize-label">{roll.phase === 'done' ? `${roll.prize} 당첨!` : roll.phase === 'rolling' ? `${roll.prize} 추첨 중…` : prize || '경품을 골라 주세요'}</p>
      {roll.phase === 'rolling' ? (
        roll.scene ? <>
          <DrawReveal key={roll.win?.id} {...roll.scene} openedCards={roll.openedCards ?? NO_CARDS} onOpenCard={onOpenCard} reduce={reduce} />
          <div className="rdv-controls">
            <span>{roll.scene.plan.label}</span>
            {(!cardPlan || winnerOpen) && <button type="button" onClick={onFinish}>{cardPlan ? '당첨 결과 보기' : '결과 바로 보기'}</button>}
          </div>
        </> : <span className="rdv-wait" aria-hidden="true" />
      ) : winners.length > 1 ? (
        <ol className="rdv-winners" aria-label="당첨자">
          {winners.map((win, i) => <li className="rcd-result" key={win.id} style={{ animationDelay: `${i * 90}ms` }}>
            <span className="rdv-place">{String(i + 1).padStart(2, '0')}</span>
            <p className="rcd-num">{ticketLabel(win.number)}</p>
            <p className="rcd-name">{win.name}</p>
            <p className="rcd-table">{win.table != null ? `${win.table}번 테이블` : '테이블 정보 없음'}</p>
          </li>)}
        </ol>
      ) : s ? (
        <div className="rcd-result" key={`w:${s.id}`}>
          <p className="rcd-num">{ticketLabel(s.number)}</p>
          <p className="rcd-name">{s.name}</p>
          <p className="rcd-table">{s.table != null ? `${s.table}번 테이블` : '테이블 정보 없음'}</p>
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
  const [roll, setRoll] = useState<Roll>({ phase: 'idle', prize: '', win: null });
  // 굴리는 동안 화면에 그릴 값 — 누르기 직전 board(멈출 때 null 로 풀면 실제 data 로 바뀐다)
  const [frozen, setFrozen] = useState<DrawBoard | null>(null);
  const [stage, setStage] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);
  const alive = useRef(true);
  const drawing = useRef(false);
  const resettingRef = useRef(false);
  const stageSurface = useRef<HTMLDivElement>(null);
  const wasFullscreen = useRef(false);

  const closeStage = useCallback(() => {
    if (stageSurface.current && document.fullscreenElement === stageSurface.current) void document.exitFullscreen().catch(() => {});
    setStage(false);
  }, []);

  const stageClosed = useCallback(() => {
    if (roll.preview) {
      drawing.current = false;
      setRoll({ phase: 'idle', prize: '', win: null });
    }
  }, [roll.preview]);

  useEffect(() => { if (!stage) stageClosed(); }, [stage, stageClosed]);

  const openStage = () => {
    flushSync(() => {
      if (roll.phase === 'done' && roll.prize !== prizeName) setRoll({ phase: 'idle', prize: '', win: null });
      setStage(true);
    });
    void stageSurface.current?.requestFullscreen?.().catch(() => {});
  };

  const previewDraw = () => {
    if (!prizeName || drawing.current || resettingRef.current || busy) return;
    const count = currentTheme === 'pinball' ? 4 : currentTheme === 'boss' ? 3 : currentTheme === 'race' ? 2 : 1;
    const samples = Array.from({ length: 156 }, (_, i) => ({ number: i + 1, name: `참가자 ${i + 1}` }));
    const at = new Date().toISOString();
    const wins: DrawRow[] = [21, 89, 133, 57].slice(0, count).map((n, i) => ({
      ...samples[n - 1], id: `preview:${n}:${at}`, prize: prizeName, at, table: i + 1, cancelled: false,
    }));
    const plan = buildReveal(prizeName, wins[0].id, wins[0], samples, wins);
    drawing.current = true;
    flushSync(() => {
      setStage(true);
      setRoll({ phase: 'rolling', prize: prizeName, win: wins[0], wins, preview: true, scene: { plan, startedAt: performance.now() } });
    });
    void stageSurface.current?.requestFullscreen?.().catch(() => {});
  };

  useEffect(() => {
    const sync = () => {
      if (stageSurface.current && document.fullscreenElement === stageSurface.current) wasFullscreen.current = true;
      else if (wasFullscreen.current) {
        wasFullscreen.current = false;
        setStage(false);
      }
    };
    document.addEventListener('fullscreenchange', sync);
    return () => document.removeEventListener('fullscreenchange', sync);
  }, []);
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
  const currentTheme = useMemo(() => revealTheme(prizeName).kind, [prizeName]);

  useEffect(() => {
    if (!prizeName) return;
    const file = new Image();
    file.src = `/reception/draw/${currentTheme}.webp`;
    const extra = currentTheme === 'fight' ? Array.from({ length: 15 }, (_, i) => `fighter-${i + 1}`)
      : currentTheme === 'cards' ? ['card', 'pudding-host-1']
      : currentTheme === 'capsule' ? ['lottery-machine', 'lottery-ball']
      : currentTheme === 'boss' ? ['boss-1', 'boss-2', 'boss-3', 'hero-1', 'hero-2', 'loot']
      : currentTheme === 'vault' ? ['pudding-oven', 'pudding-dough', 'pudding-sky', 'pudding-palace', 'pudding-host-1', 'pudding-host-2'] : [];
    for (const name of extra) {
      const image = new Image();
      image.src = `/reception/draw/${name}.webp`;
    }
    if (currentTheme === 'vault') {
      for (const n of [1, 2, 3, 9, 12]) {
        const image = new Image();
        image.src = `/images/chat-stickers/freeti/freeti-${n}.png`;
      }
    }
    if (currentTheme === 'race') void import('../_parts/animal-run-engine').catch(() => {});
  }, [prizeName, currentTheme]);

  /** 무대 연출에 쓸 실제 응모권. 추첨 대상자는 서버가 결정한다. */
  const pool = useMemo(() => {
    const drawn = new Set((data?.draws || []).map((d) => d.number));
    return (live.data?.arrivals || []).filter((a) => !drawn.has(a.number)).map((a) => ({ number: a.number, name: a.name, table: a.table }));
  }, [data, live.data]);
  const finish = useCallback(() => {
    if (roll.phase !== 'rolling' || !roll.scene || !roll.win || !drawing.current) return;
    if (roll.scene.plan.kind === 'cards' && !roll.openedCards?.includes(roll.scene.plan.winnerIndex)) return;
    drawing.current = false;
    setFrozen(null);
    setRoll({ phase: 'done', prize: roll.prize, win: roll.win, wins: roll.wins, preview: roll.preview });
    if (!roll.preview) haptic('success');
  }, [roll]);

  const openCard = useCallback((index: number) => {
    setRoll(current => current.phase === 'rolling' && current.scene?.plan.kind === 'cards' &&
      current.scene.plan.lineup[index] && !current.openedCards?.includes(index)
      ? { ...current, openedCards: [...(current.openedCards ?? []), index] } : current);
  }, []);

  useEffect(() => {
    if (!roll.scene || roll.scene.plan.kind === 'cards') return;
    const remaining = roll.scene.startedAt + roll.scene.plan.duration - performance.now();
    const timer = window.setTimeout(finish, reduce ? 0 : Math.max(0, remaining));
    return () => window.clearTimeout(timer);
  }, [roll.scene, finish, reduce]);

  const runDraw = async () => {
    if (resettingRef.current || busy || drawing.current || roll.phase === 'rolling') return;
    const name = prizeName;
    if (!name) return adminAlert('경품을 골라 주세요\n직접 입력이면 경품 이름을 적어 주세요.');
    if ([...name].length > PRIZE_MAX) return adminAlert(`경품 이름이 너무 길어요\n${PRIZE_MAX}자까지 적을 수 있어요.`);
    if (data && data.eligible <= 0) return adminAlert('뽑을 응모권이 없어요\n입장한 손님이 아직 없거나 모두 뽑혔어요.');
    const p = data?.prizes.find((x) => x.name === name);
    const batch = !!p && isBatchReveal(currentTheme);
    if (batch && p.drawn >= p.total) return adminAlert('남은 경품이 없어요.');
    if (batch && data && data.eligible < p.total - p.drawn) return adminAlert('남은 경품 수보다 응모권이 적어요.');
    drawing.current = true;
    try {
      if (p && p.drawn >= p.total && !(await adminConfirm({ title: `${eunNeun(name)} ${p.total}${p.unit || '개'} 다 뽑았어요`, description: '그래도 한 번 더 뽑을까요?', confirmText: '더 뽑기' }))) {
        drawing.current = false;
        return;
      }
      if (!alive.current) return;
      setFrozen(data);
      setRoll({ phase: 'rolling', prize: name, win: null });
      const { draw, winners, board, participants } = await mutate(() => receptionAdminApi.draw(name, batch), (r): DrawBoard => r.board);
      if (!alive.current) return;
      if (reduce && currentTheme !== 'cards') {
        drawing.current = false;
        setFrozen(null);
        setRoll({ phase: 'done', prize: name, win: draw, wins: winners });
        haptic('success');
        return;
      }
      const prior = new Set(board.draws.filter((row) => row.id !== draw.id).map(row => row.number));
      const plan = buildReveal(name, draw.id, draw, participants ?? pool.filter((ticket) => !prior.has(ticket.number)), winners);
      setRoll({ phase: 'rolling', prize: name, win: draw, wins: winners, scene: { plan, startedAt: performance.now() } });
    } catch (error) {
      drawing.current = false;
      if (!alive.current) return;
      setFrozen(null);
      setRoll({ phase: 'idle', prize: name, win: null });
      if (stage) closeStage();
      await adminAlert(`추첨하지 못했어요\n${adminErrorText(error, '다시 눌러 주세요')}`);
    }
  };

  const cancel = async (d: DrawRow) => {
    if (resettingRef.current || drawing.current) return;
    if (!(await adminConfirm({ title: `${ticketLabel(d.number)} ${d.name} 님 당첨을 무효로 할까요?`, description: `자리에 없을 때만 무효로 해 주세요. 이 응모권은 다시 뽑히지 않아요. ${eunNeun(d.prize)} 한 번 더 추첨하면 돼요.`, confirmText: '무효' }))) return;
    setBusy(d.id);
    try {
      await mutate(() => receptionAdminApi.cancelDraw(d.id));
      if (roll.win?.id === d.id || roll.wins?.some(w => w.id === d.id)) setRoll({ phase: 'idle', win: null, prize: d.prize });
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
  const selected = view?.prizes.find(p => p.name === prizeName);
  const outOfStock = !!selected && selected.drawn >= selected.total;
  const shortOfTickets = !!selected && isBatchReveal(currentTheme) && (view?.eligible ?? 0) < selected.total - selected.drawn;

  const clearHistory = async () => {
    if (resettingRef.current || drawing.current || busy || !draws.length) return;
    const expectedIds = draws.map(d => d.id);
    resettingRef.current = true;
    setResetting(true);
    try {
      if (!await adminConfirm({ title: `추첨 내역 ${expectedIds.length}건을 모두 삭제할까요?`, description: '확정·무효 기록을 모두 지워요. 응모권과 자리 명단은 유지되며, 기존 응모권은 다시 추첨 대상이 됩니다. 이미 발송된 알림은 회수되지 않아요. 이 작업은 되돌릴 수 없어요.', confirmText: '모두 삭제' })) return;
      await mutate(() => receptionAdminApi.resetDraws(expectedIds));
      setRoll({ phase: 'idle', prize: '', win: null });
    } catch (e) {
      await adminAlert(`삭제하지 못했어요\n${adminErrorText(e)}`);
    } finally {
      resettingRef.current = false;
      setResetting(false);
    }
  };

  const prizePicker = (
    <div className="rcd-prizes" role="radiogroup" aria-label="경품">
      {(view?.prizes || []).map((p) => {
        const left = Math.max(0, p.total - p.drawn);
        const on = !customOn && prize === p.name;
        return (
          <button key={p.name} type="button" role="radio" aria-checked={on} className={`rcd-prize ${on ? 'on' : ''} ${left === 0 ? 'out' : ''}`} disabled={rolling} onClick={() => { setCustomOn(false); setPrize(p.name); }}>
            <b>{p.name}</b>
            <small>{left > 0 ? `남은 ${left} / ${p.total}${p.unit || '개'}` : `${p.total}${p.unit || '개'} 다 뽑았어요`}</small>
            <small>{revealTheme(p.name).label}</small>
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
          <p className="adm-stat-sub">{`경품 ${view.prizes.length}종 · ${view.prizes.reduce((n, p) => n + p.drawn, 0)} / ${view.prizes.reduce((n, p) => n + p.total, 0)}개 뽑음`}</p>
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
            <p className="adm-card-sub">{selected && isBatchReveal(currentTheme) ? `남은 ${Math.max(0, selected.total - selected.drawn)}명을 한 번에 뽑아요` : '고른 경품으로 응모권 한 장을 뽑아요'}</p>
          </div>
          <div className="rdv-actions">
          <button type="button" className="adm-btn" onClick={previewDraw} disabled={!prizeName || rolling || resetting || !!busy}>
            <Play size={16} aria-hidden="true" /> 추첨 미리보기
          </button>
          <button type="button" className="adm-btn" onClick={openStage} disabled={!prizeName || resetting}>
            <Maximize size={16} aria-hidden="true" /> 크게 보기
          </button>
          </div>
        </div>
        {prizePicker}
        {customInput}
        {!stage && <DrawScreen roll={roll} prize={prizeName} announce onFinish={finish} onOpenCard={openCard} reduce={reduce} />}
        <button type="button" className="rcd-go" disabled={rolling || resetting || !!busy || view.eligible <= 0 || shortOfTickets || (!!selected && isBatchReveal(currentTheme) && outOfStock)} onClick={runDraw}>
          {rolling ? '추첨 중…' : view.eligible <= 0 ? '뽑을 응모권이 없어요' : '추첨하기'}
        </button>
      </section>

      <AdminListCard
        filter={
          <div className="adm-toolbar">
            <p className="rcd-list-title">당첨 목록</p>
            <span className="adm-count grow" style={{ textAlign: 'right' }}>총 <b><RollingNumber value={draws.length} /></b>건</span>
            <button type="button" className="adm-btn danger sm" disabled={!draws.length || rolling || resetting || !!busy} onClick={clearHistory}>
              <Trash2 size={16} aria-hidden="true" /> {resetting ? '확인 중…' : '전체 삭제'}
            </button>
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
                        <button type="button" className="adm-btn ghost sm rca-del" disabled={!!busy || rolling || resetting} onClick={() => cancel(d)}>무효</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </AdminTableScroll>
        )}
      </AdminListCard>

      <ReceptionStage open={stage} onClose={closeStage} label="럭키드로우 전체 화면" presentation surfaceRef={stageSurface}>
        <div className={`rcd-presentation rdv-${roll.phase === 'idle' ? currentTheme : revealTheme(roll.prize).kind}`}>
          {roll.preview && <p className="rdv-preview-badge">미리보기</p>}
          <DrawScreen roll={roll} prize={prizeName} big announce onFinish={finish} onOpenCard={openCard} reduce={reduce} />
          {!rolling && roll.preview && <button type="button" className="rcd-presentation-action" onClick={previewDraw}>다시 재생</button>}
          {!rolling && !roll.preview && <button type="button" className="rcd-presentation-action" disabled={view.eligible <= 0 || shortOfTickets || outOfStock || resetting || !!busy} onClick={runDraw}>
            {outOfStock ? '추첨 완료' : view.eligible <= 0 ? '남은 응모권 없음' : shortOfTickets ? '응모권 부족' : '추첨하기'}
          </button>}
        </div>
      </ReceptionStage>
    </div>
  );
}

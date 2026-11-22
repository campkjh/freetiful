'use client';

/* 송년회 입장 현황(261122 사장 '관리자 테블릿버전에서는 누가누가왔는지 확인이 가능하게끔 데이터 테이블이 촤라락 나올 수 있게끔')
 *  · 입장 = 응모권 발급(손님이 자리 탭에서 이름을 넣으면 자동으로 한 장). 한 사람 한 장이라 응모권 수 = 입장 인원.
 *  · 처음 그릴 때 줄이 위에서부터 차례로(30ms 간격, 최대 900ms) — 3초 폴링으로 새 입장자가 생기면 그 줄만 맨 위로 미끄러져 들어오며 잠깐 옅은 파랑.
 *  · 보기 = 입장 순(최신 위) · 테이블별(1~18 묶음 머리 + n/m명) · 명단 전체(미입장은 회색 '아직').
 *  · 테이블 · 좌석 = 지금 자리 명단에서 이름으로 찾은 것(서버가 맞춰 줌). 명단에 없으면 '명단 밖'.
 *  · 동작 줄이기면 줄 지연을 안 넣는다(등장 자체는 reception-admin.css 가 끈다). */
import { useEffect, useMemo, useRef, useState } from 'react';
import { RollingNumber } from '../../_components/AdminNumber';
import { AdminListCard, AdminTableScroll } from '../../_components/AdminListCard';
import { AdminSearchField } from '../../_components/AdminSearchField';
import { adminAlert, adminConfirm } from '../../_components/adminDialog';
import {
  adminErrorText,
  kstHm,
  receptionAdminApi,
  receptionNameKey,
  ticketLabel,
  useReceptionLive,
  useReducedMotion,
  type LiveArrival,
  type ReceptionWin,
  type TicketBlock,
  type TicketsMode,
} from '../../_components/receptionAdmin';
import { useFlipRows } from '../_parts/useFlipRows';
import { TABLE_COUNT } from '@/lib/reception/event';
import '../reception-admin.css';

type View = 'arrivals' | 'tables' | 'list';
const VIEWS: { key: View; label: string }[] = [
  { key: 'arrivals', label: '입장 순' },
  { key: 'tables', label: '테이블별' },
  { key: 'list', label: '명단 전체' },
];
const MODES: { key: TicketsMode; label: string }[] = [
  { key: 'auto', label: '자동' },
  { key: 'open', label: '열기' },
  { key: 'closed', label: '닫기' },
];

interface Row {
  k: string;
  ticketId: string | null;
  number: number | null;
  name: string;
  table: number | null;
  seat: number | null;
  listed: boolean;
  arrivedAt: string | null;
  lastSeenAt: string | null;
  win: ReceptionWin | null;
}
type Line = { kind: 'row'; row: Row } | { kind: 'group'; k: string; label: string; arrived: number; listed: number | null };

const fromArrival = (a: LiveArrival): Row => ({
  k: `t:${a.id}`,
  ticketId: a.id,
  number: a.number,
  name: a.name,
  table: a.table,
  seat: a.seat,
  listed: a.listed,
  arrivedAt: a.issuedAt,
  lastSeenAt: a.lastSeenAt,
  win: a.win,
});

/** 이름 · 응모권 번호('7', '007', 'No.7')로 찾기 */
function matches(r: Row, q: string) {
  const k = receptionNameKey(q);
  if (!k) return true;
  if (receptionNameKey(r.name).includes(k)) return true;
  const digits = k.replace(/^no\.?/, '');
  return /^\d+$/.test(digits) && r.number != null && (String(r.number) === String(Number(digits)) || String(r.number).padStart(3, '0').includes(digits));
}

export default function ReceptionLivePage() {
  const { data, loading, error, mutate } = useReceptionLive(3000);
  const reduce = useReducedMotion();
  const [view, setView] = useState<View>('arrivals');
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  // 새 입장자 — 처음 받은 목록은 '본 것'으로 치고, 그 뒤 폴링에서 처음 보이는 응모권만 반짝인다(3초 뒤 꺼짐)
  const seen = useRef<Set<string> | null>(null);
  const [fresh, setFresh] = useState<Record<string, number>>({});
  useEffect(() => {
    if (!data) return;
    const ids = data.arrivals.map((a) => a.id);
    if (!seen.current) {
      seen.current = new Set(ids);
      return;
    }
    const added = ids.filter((id) => !seen.current!.has(id));
    ids.forEach((id) => seen.current!.add(id));
    if (!added.length) return;
    const at = Date.now();
    setFresh((f) => {
      const n = { ...f };
      added.forEach((id) => { n[id] = at; });
      return n;
    });
  }, [data]);
  useEffect(() => {
    if (!Object.keys(fresh).length) return;
    const t = window.setTimeout(() => {
      setFresh((f) => {
        const now = Date.now();
        const n: Record<string, number> = {};
        for (const [k, v] of Object.entries(f)) if (now - v < 2800) n[k] = v;
        return n;
      });
    }, 3000);
    return () => window.clearTimeout(t);
  }, [fresh]);

  const seatsLoaded = (data?.seats.length || 0) > 0;

  const lines = useMemo<Line[]>(() => {
    if (!data) return [];
    const arrivals = [...data.arrivals].sort((a, b) => b.number - a.number);
    if (view === 'arrivals') {
      return arrivals.map(fromArrival).filter((r) => matches(r, q)).map((row) => ({ kind: 'row', row }));
    }
    if (view === 'tables') {
      const out: Line[] = [];
      const byTable = new Map<number, Row[]>();
      const walkIns: Row[] = [];
      for (const a of [...data.arrivals].sort((x, y) => (x.seat ?? 99) - (y.seat ?? 99) || x.number - y.number)) {
        const r = fromArrival(a);
        if (!matches(r, q)) continue;
        if (a.table == null) walkIns.push(r);
        else byTable.set(a.table, [...(byTable.get(a.table) || []), r]);
      }
      const sum = new Map(data.summary.tables.map((t) => [t.table, t]));
      for (let t = 1; t <= TABLE_COUNT; t += 1) {
        const rows = byTable.get(t) || [];
        const s = sum.get(t);
        if (!rows.length && (q || !s?.listed)) continue; // 명단에도 없고 온 사람도 없는 테이블은 머리도 안 그린다
        out.push({ kind: 'group', k: `g:${t}`, label: `${t}번 테이블`, arrived: s?.arrived ?? rows.length, listed: s?.listed ?? null });
        rows.forEach((row) => out.push({ kind: 'row', row }));
      }
      if (walkIns.length) {
        out.push({ kind: 'group', k: 'g:walk', label: seatsLoaded ? '명단 밖' : '자리 명단 없음', arrived: walkIns.length, listed: null });
        walkIns.forEach((row) => out.push({ kind: 'row', row }));
      }
      return out;
    }
    // 명단 전체 — 온 사람은 응모권과 이어서(번호 · 당첨 · 지우기), 안 온 사람은 회색 '아직'.
    // 응모권은 번호로 잇는다(동명이인 두 줄이 이름으로 같은 응모권에 붙지 않게), 줄 열쇠에도 테이블을 넣는다
    const byNo = new Map(data.arrivals.map((a) => [a.number, a]));
    return data.seats
      .map((s): Row => {
        const a = s.ticketNumber != null ? byNo.get(s.ticketNumber) : undefined;
        return {
          k: `s:${s.table}:${receptionNameKey(s.name)}`,
          ticketId: a?.id ?? null,
          number: a?.number ?? s.ticketNumber,
          name: s.name,
          table: s.table,
          seat: s.seat,
          listed: true,
          arrivedAt: s.arrived ? s.arrivedAt ?? a?.issuedAt ?? null : null,
          lastSeenAt: a?.lastSeenAt ?? null,
          win: a?.win ?? null,
        };
      })
      .filter((r) => matches(r, q))
      .map((row) => ({ kind: 'row', row }));
  }, [data, view, q, seatsLoaded]);

  const rowCount = lines.filter((l) => l.kind === 'row').length;
  const tbodyRef = useRef<HTMLTableSectionElement>(null);
  useFlipRows(tbodyRef, [lines], reduce);

  const s = data?.summary;
  const pct = s && s.listed ? Math.round((s.listedArrived / s.listed) * 100) : 0;
  const lastAt = data?.arrivals.reduce<string | null>((m, a) => (!m || a.issuedAt > m ? a.issuedAt : m), null) ?? null;

  const setMode = async (mode: TicketsMode) => {
    if (!data || data.ticketsMode === mode) return;
    if (mode === 'closed' && !(await adminConfirm('응모권 발급을 닫을까요?\n지금부터 들어오는 손님은 응모권을 못 받아요. 이미 받은 응모권은 그대로예요.'))) return;
    setBusy('mode');
    try {
      await mutate(() => receptionAdminApi.ticketsMode(mode));
    } catch (e) {
      await adminAlert(`바꾸지 못했어요\n${adminErrorText(e)}`);
    } finally {
      setBusy(null);
    }
  };

  const remove = async (r: Row) => {
    if (!r.ticketId) return;
    const label = r.number != null ? ticketLabel(r.number) : '응모권';
    if (!(await adminConfirm({ title: `${r.name} 님 응모권(${label})을 지울까요?`, description: '입장 기록과 이 응모권의 추첨 기록이 같이 지워져요. 테스트나 실수로 생긴 것만 지워 주세요.', confirmText: '지울게요' }))) return;
    if (!(await adminConfirm({ title: '정말 지울까요?', description: `${r.name} 님 ${label} — 지우면 되돌릴 수 없어요. 이 이름으로는 응모권이 다시 안 나와요(아래 '지운 이름'에서 다시 받게 할 수 있어요).`, confirmText: '지우기' }))) return;
    setBusy(r.ticketId);
    try {
      await mutate(() => receptionAdminApi.deleteTicket(r.ticketId!));
    } catch (e) {
      await adminAlert(`지우지 못했어요\n${adminErrorText(e)}`);
    } finally {
      setBusy(null);
    }
  };

  // 지운 이름 풀기 — 서버는 지운 이름을 막아 둔다(손님 폰 폴링에 새 번호로 되살아나지 않게). 실수로 지웠을 때만
  const unblock = async (b: TicketBlock) => {
    if (!(await adminConfirm({ title: `${b.name} 님이 다시 응모권을 받게 할까요?`, description: '손님 화면이 다음에 새로 불러올 때 새 번호로 한 장 나와요. 예전 번호는 돌아오지 않아요.', confirmText: '다시 받게 하기' }))) return;
    setBusy(`unblock:${b.nameKey}`);
    try {
      await mutate(() => receptionAdminApi.unblockTicket(b.name));
    } catch (e) {
      await adminAlert(`풀지 못했어요\n${adminErrorText(e)}`);
    } finally {
      setBusy(null);
    }
  };
  const blocked = data?.blocked || [];

  let rowIndex = -1;
  return (
    <div className="rca space-y-5">
      <div className="adm-grid grid-cols-2 lg:grid-cols-4">
        <div className="adm-stat">
          <p className="adm-stat-label">입장</p>
          <p className="adm-stat-value" style={{ color: 'var(--admin-blue)' }}><RollingNumber value={s?.arrived || 0} /><small>명</small></p>
          <p className="adm-stat-sub">{lastAt ? `마지막 입장 ${kstHm(lastAt)}` : '응모권 한 장 = 한 사람'}</p>
        </div>
        <div className="adm-stat">
          <p className="adm-stat-label">명단 중 입장</p>
          <p className="adm-stat-value"><RollingNumber value={s?.listedArrived || 0} /><small>/ {s?.listed || 0}명</small></p>
          <p className="adm-stat-sub">{s?.listed ? `${pct}% 왔어요` : '자리 명단이 아직 없어요'}</p>
        </div>
        <div className="adm-stat">
          <p className="adm-stat-label">명단 밖 입장</p>
          <p className="adm-stat-value"><RollingNumber value={s?.walkIns || 0} /><small>명</small></p>
          <p className="adm-stat-sub">{seatsLoaded ? '명단에서 이름을 못 찾았어요' : '명단을 넣으면 나눠서 보여요'}</p>
        </div>
        <div className="adm-stat">
          <p className="adm-stat-label">응모권 발급</p>
          <p className="adm-stat-value" style={{ color: data?.ticketsOpen ? 'var(--admin-green)' : 'var(--admin-ph)' }}>{data ? (data.ticketsOpen ? '받는 중' : '닫힘') : '—'}</p>
          <div className="adm-seg rca-mode" role="radiogroup" aria-label="응모권 발급">
            {MODES.map((m) => (
              <button key={m.key} type="button" role="radio" aria-checked={data?.ticketsMode === m.key} className={data?.ticketsMode === m.key ? 'on' : ''} disabled={!data || busy === 'mode'} onClick={() => setMode(m.key)}>
                {m.label}
              </button>
            ))}
          </div>
          <p className="adm-stat-sub">{data?.ticketsMode === 'auto' ? '자동 = 11.23 15:00 ~ 11.24 03:00' : data?.ticketsMode === 'open' ? '지금 시간과 상관없이 열어 뒀어요' : data ? '지금 시간과 상관없이 닫아 뒀어요' : ''}</p>
        </div>
      </div>

      {error && data && <p className="adm-note">연결이 잠깐 끊겼어요 — 마지막으로 받은 화면이에요. ({error})</p>}

      <AdminListCard
        filter={
          <div className="adm-toolbar">
            <div className="adm-seg" role="tablist" aria-label="보기">
              {VIEWS.map((v) => (
                <button key={v.key} type="button" role="tab" aria-selected={view === v.key} className={view === v.key ? 'on' : ''} onClick={() => setView(v.key)}>
                  {v.label}
                </button>
              ))}
            </div>
            <AdminSearchField className="grow" value={q} onChange={setQ} onSubmit={setQ} placeholder="이름 · 응모권 번호" />
            <span className="adm-count">
              {view === 'list' ? '명단 ' : ''}<b><RollingNumber value={rowCount} /></b>명
            </span>
          </div>
        }
      >
        {loading && !data ? (
          <p className="adm-empty">불러오는 중…</p>
        ) : !data ? (
          <p className="adm-empty">{error || '불러오지 못했어요'}</p>
        ) : rowCount === 0 ? (
          <p className="adm-empty">
            {q ? '찾는 사람이 없어요' : view === 'list' ? '자리 명단이 아직 없어요 — 자리 명단 탭에서 붙여 넣어 주세요' : '아직 입장한 사람이 없어요'}
          </p>
        ) : (
          <AdminTableScroll>
            <table className="adm-table rca-table">
              <thead>
                <tr>
                  <th>No.</th>
                  <th>이름</th>
                  <th>테이블</th>
                  <th>좌석</th>
                  <th>입장</th>
                  <th>당첨</th>
                  <th aria-label="지우기" />
                </tr>
              </thead>
              <tbody key={view} ref={tbodyRef}>
                {lines.map((line) => {
                  if (line.kind === 'group') {
                    rowIndex += 1;
                    return (
                      <tr key={line.k} data-k={line.k} className="rca-group" style={reduce ? undefined : { animationDelay: `${Math.min(rowIndex * 30, 900)}ms` }}>
                        <td colSpan={7}>
                          <span className="rca-group-name">{line.label}</span>
                          <span className="rca-group-count">
                            <RollingNumber value={line.arrived} />
                            {line.listed != null && <> / {line.listed}</>}명
                          </span>
                        </td>
                      </tr>
                    );
                  }
                  const r = line.row;
                  rowIndex += 1;
                  const isFresh = !!(r.ticketId && fresh[r.ticketId]);
                  const waiting = !r.arrivedAt;
                  return (
                    <tr
                      key={r.k}
                      data-k={r.k}
                      className={`${isFresh ? 'rca-fresh' : ''} ${waiting ? 'rca-wait' : ''}`}
                      style={reduce ? undefined : { animationDelay: isFresh ? '0ms' : `${Math.min(rowIndex * 30, 900)}ms` }}
                    >
                      <td className="rca-no">{r.number != null && !waiting ? ticketLabel(r.number) : '—'}</td>
                      <td>
                        <b className="rca-name">{r.name}</b>
                        {!r.listed && seatsLoaded && <span className="adm-cell-sub">명단 밖</span>}
                      </td>
                      <td className="adm-num">{r.table != null ? `${r.table}번` : '—'}</td>
                      <td className="adm-num">{r.seat != null ? `${r.seat}번` : '—'}</td>
                      <td className="adm-num">
                        {waiting ? (
                          <span className="adm-badge">아직</span>
                        ) : (
                          <>
                            {kstHm(r.arrivedAt)}
                            {r.lastSeenAt && kstHm(r.lastSeenAt) !== kstHm(r.arrivedAt) && <span className="adm-cell-sub">확인 {kstHm(r.lastSeenAt)}</span>}
                          </>
                        )}
                      </td>
                      <td>{r.win ? <span className="adm-badge green">당첨 · {r.win.prize}</span> : <span className="adm-cell-sub">—</span>}</td>
                      <td className="r">
                        {r.ticketId && (
                          <button type="button" className="adm-btn ghost sm rca-del" disabled={busy === r.ticketId} onClick={() => remove(r)}>
                            지우기
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </AdminTableScroll>
        )}
      </AdminListCard>

      {blocked.length > 0 && (
        <section className="adm-card">
          <div className="adm-card-head">
            <div>
              <p className="adm-card-title">지운 이름 {blocked.length}명</p>
              <p className="adm-card-sub">응모권을 지운 이름이에요. 이 이름으로는 응모권이 다시 안 나와요 — 실수로 지웠다면 다시 받게 해 주세요.</p>
            </div>
          </div>
          <ul className="rca-blocked">
            {blocked.map((b) => (
              <li key={b.nameKey}>
                <b className="rca-name">{b.name}</b>
                <span className="adm-cell-sub">{kstHm(b.at) ? `${kstHm(b.at)} 지움` : '지움'}</span>
                <button type="button" className="adm-btn sm" disabled={busy === `unblock:${b.nameKey}`} onClick={() => unblock(b)}>
                  다시 받게 하기
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

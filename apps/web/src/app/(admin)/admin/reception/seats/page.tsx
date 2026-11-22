'use client';

/* 송년회 자리 명단(261122) — 사장 배정표(엑셀)를 복사해 붙여 넣으면 손님 자리 탭이 그 자리를 알려 준다.
 *  · 한 줄 = 이름, 테이블, 좌석(선택) — 탭(엑셀 복사) 또는 쉼표로 나눈다. 둘 다 없으면 띄어쓰기 뒤 숫자 칸을 테이블·좌석으로 본다.
 *  · '3번' · 'T3' · '3테이블' 은 숫자만 뽑는다. 첫 줄의 테이블 칸이 숫자가 아니면 머리줄로 보고 건너뛴다.
 *  · [미리 보기]에서 오류 줄(이유)을 먼저 보여 주고, 오류가 없을 때만 [명단 바꾸기] — 명단은 통째로 바뀐다(서버 PUT seats).
 *  · 명단이 비어 있으면 손님 화면은 예전처럼 이름으로 정한 임시 자리를 보여 준다.
 *  · 같은 이름이 다른 테이블에 또 있으면 동명이인 — 손님이 함께 앉는 분 이름을 보고 고른다(서버 sameNameKey). 같은 테이블에 두 번은 오류. */
import { useMemo, useState } from 'react';
import { RollingNumber } from '../../_components/AdminNumber';
import { AdminListCard, AdminTableScroll } from '../../_components/AdminListCard';
import { adminAlert, adminConfirm } from '../../_components/adminDialog';
import {
  adminErrorText,
  kstHm,
  receptionAdminApi,
  receptionNameKey,
  ticketLabel,
  useReceptionLive,
  type LiveSeatRow,
} from '../../_components/receptionAdmin';
import { SEATS_PER_TABLE, TABLE_COUNT } from '@/lib/reception/event';
import '../reception-admin.css';

const MAX_ROWS = 400;
const NAME_MAX = 20;
const HEADER_WORDS = /^(이름|성함|성명|name|참석자|손님)$/i;

interface Parsed {
  line: number;
  raw: string;
  name: string;
  table: number | null;
  seat: number | null;
  header: boolean;
  error: string | null;
  /** 동명이인(같은 이름이 다른 테이블에도) */
  same: boolean;
}

/** 서버 cleanName 과 같게 — 제어 문자 제거 · 겹친 띄어쓰기 하나로 · 1~20자 */
function cleanName(v: string): string | null {
  const s = v.replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim();
  if (!s || [...s].length > NAME_MAX) return null;
  return s;
}
const firstInt = (v: string) => {
  const m = /\d+/.exec(v.normalize('NFKC'));
  return m ? Number(m[0]) : null;
};

/** 한 줄 → [이름, 테이블, 좌석] 칸 */
function splitCols(raw: string): string[] {
  if (raw.includes('\t')) return raw.split('\t').map((c) => c.trim());
  if (/[,，]/.test(raw)) return raw.split(/[,，]/).map((c) => c.trim());
  // 띄어쓰기만 — 끝에서부터 숫자 든 칸(최대 2개)을 테이블 · 좌석으로
  const tokens = raw.trim().split(/\s+/);
  const tail: string[] = [];
  while (tokens.length > 1 && tail.length < 2 && /\d/.test(tokens[tokens.length - 1])) tail.unshift(tokens.pop()!);
  return [tokens.join(' '), ...tail];
}

function parseSeats(text: string): Parsed[] {
  const out: Parsed[] = [];
  const keys = new Map<string, { line: number; table: number }[]>();
  let first = true;
  text.split(/\r?\n/).forEach((rawLine, idx) => {
    const raw = rawLine.replace(/ /g, ' ');
    if (!raw.trim()) return;
    const line = idx + 1;
    const cols = splitCols(raw);
    const nameRaw = cols[0] || '';
    const tRaw = cols[1] || '';
    const sRaw = cols[2] || '';
    const table = firstInt(tRaw);
    const base = { line, raw, name: nameRaw.trim(), table, seat: null as number | null, header: false, error: null as string | null, same: false };
    if (table == null && (first || HEADER_WORDS.test(nameRaw.trim()))) {
      first = false;
      out.push({ ...base, header: true });
      return;
    }
    first = false;
    const name = cleanName(nameRaw);
    const seat = sRaw ? firstInt(sRaw) : null;
    let error: string | null = null;
    if (!name) error = nameRaw.trim() ? `이름이 ${NAME_MAX}자를 넘어요` : '이름이 비었어요';
    else if (table == null) error = '테이블 번호가 없어요';
    else if (table < 1 || table > TABLE_COUNT) error = `테이블은 1~${TABLE_COUNT}번이에요`;
    else if (sRaw && seat == null) error = '좌석 번호를 못 읽었어요';
    else if (seat != null && (seat < 1 || seat > SEATS_PER_TABLE)) error = `좌석은 1~${SEATS_PER_TABLE}번이에요`;
    if (!error && name && table != null) {
      const k = receptionNameKey(name);
      const prev = keys.get(k) || [];
      const clash = prev.find((x) => x.table === table);
      if (clash) error = `${clash.line}번째 줄과 같은 테이블에 이름이 같아요`;
      else keys.set(k, [...prev, { line, table }]);
    }
    out.push({ ...base, name: name || nameRaw.trim(), seat, error });
  });
  // 동명이인 표시 — 다른 테이블에 같은 이름이 또 있는 줄
  for (const p of out) {
    if (p.header || p.error || !p.name) continue;
    p.same = (keys.get(receptionNameKey(p.name))?.length ?? 0) > 1;
  }
  return out;
}

export default function ReceptionSeatsPage() {
  const { data, loading, error, mutate } = useReceptionLive(10000);
  const [text, setText] = useState('');
  const [preview, setPreview] = useState<Parsed[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  const rows = useMemo(() => (preview || []).filter((p) => !p.header && !p.error), [preview]);
  const errors = useMemo(() => (preview || []).filter((p) => p.error), [preview]);
  const headers = useMemo(() => (preview || []).filter((p) => p.header), [preview]);
  const sameNames = useMemo(() => rows.filter((p) => p.same), [rows]);
  const tooMany = rows.length + errors.length > MAX_ROWS;
  const perTable = useMemo(() => {
    const m = new Map<number, number>();
    rows.forEach((r) => m.set(r.table!, (m.get(r.table!) || 0) + 1));
    return [...m.entries()].sort((a, b) => a[0] - b[0]);
  }, [rows]);

  const seats = data?.seats || [];
  const groups = useMemo(() => {
    const m = new Map<number, LiveSeatRow[]>();
    seats.forEach((s) => m.set(s.table, [...(m.get(s.table) || []), s]));
    return [...m.entries()].sort((a, b) => a[0] - b[0]);
  }, [seats]);
  const arrived = seats.filter((s) => s.arrived).length;

  const runPreview = () => {
    setDone(null);
    setPreview(parseSeats(text));
  };

  const apply = async () => {
    if (!preview || errors.length || !rows.length || tooMany) return;
    const ok = await adminConfirm({
      title: '명단을 바꿀까요?',
      description: `${rows.length}명으로 바꿔요. 지금 명단${seats.length ? `(${seats.length}명)` : ''}은 지워져요. 손님 자리 탭에 바로 반영돼요.`,
      confirmText: '명단 바꾸기',
    });
    if (!ok) return;
    setBusy(true);
    try {
      await mutate(() => receptionAdminApi.putSeats(rows.map((r) => ({ name: r.name, table: r.table!, seat: r.seat }))));
      setDone(`명단을 ${rows.length}명으로 바꿨어요`);
      setPreview(null);
    } catch (e) {
      await adminAlert(`바꾸지 못했어요\n${adminErrorText(e)}`);
    } finally {
      setBusy(false);
    }
  };

  const clearAll = async () => {
    if (!(await adminConfirm({ title: '자리 명단을 비울까요?', description: `${seats.length}명이 지워지고 손님 화면은 이름으로 정한 임시 자리로 돌아가요.`, confirmText: '비울게요' }))) return;
    if (!(await adminConfirm({ title: '정말 비울까요?', description: '되돌리려면 명단을 다시 붙여 넣어야 해요.', confirmText: '비우기' }))) return;
    setBusy(true);
    try {
      await mutate(() => receptionAdminApi.putSeats([]));
      setDone('명단을 비웠어요');
    } catch (e) {
      await adminAlert(`비우지 못했어요\n${adminErrorText(e)}`);
    } finally {
      setBusy(false);
    }
  };

  const fillFromCurrent = async () => {
    if (!seats.length) return;
    if (text.trim() && !(await adminConfirm('칸에 적힌 글을 지금 명단으로 바꿀까요?\n적어 둔 글은 지워져요.'))) return;
    setText(seats.map((s) => [s.name, s.table, s.seat ?? ''].join('\t')).join('\n'));
    setPreview(null);
    setDone(null);
  };

  return (
    <div className="rca space-y-5">
      <div className="adm-grid grid-cols-2 lg:grid-cols-4">
        <div className="adm-stat">
          <p className="adm-stat-label">지금 명단</p>
          <p className="adm-stat-value"><RollingNumber value={seats.length} /><small>명</small></p>
          <p className="adm-stat-sub">{seats.length ? `${groups.length}개 테이블` : '비어 있어요 — 임시 자리로 보여요'}</p>
        </div>
        <div className="adm-stat">
          <p className="adm-stat-label">명단 중 입장</p>
          <p className="adm-stat-value"><RollingNumber value={arrived} /><small>명</small></p>
          <p className="adm-stat-sub">{seats.length ? `${Math.round((arrived / seats.length) * 100)}% 왔어요` : '—'}</p>
        </div>
      </div>

      <section className="adm-card rcl-paste">
        <div className="adm-card-head">
          <div>
            <p className="adm-card-title">명단 붙여 넣기</p>
            <p className="adm-card-sub">엑셀에서 이름 · 테이블 · 좌석 칸을 복사해 붙여 넣어 주세요. 좌석은 없어도 돼요.</p>
          </div>
          {seats.length > 0 && <button type="button" className="adm-btn" disabled={busy} onClick={fillFromCurrent}>지금 명단 불러오기</button>}
        </div>
        <textarea
          className="adm-input adm-textarea rcl-textarea"
          value={text}
          onChange={(e) => { setText(e.target.value); setPreview(null); setDone(null); }}
          placeholder={'이름\t테이블\t좌석\n김솔\t3\t1\n이하늘\t3번\t2\n박지민, T12'}
          spellCheck={false}
          autoCapitalize="off"
          autoComplete="off"
        />
        <div className="rcq-actions">
          <button type="button" className="adm-btn primary" disabled={!text.trim() || busy} onClick={runPreview}>미리 보기</button>
          {preview && (
            <button type="button" className="adm-btn weak" disabled={busy || !!errors.length || !rows.length || tooMany} onClick={apply}>
              {rows.length}명으로 명단 바꾸기
            </button>
          )}
          {done && <span className="rcl-done">{done}</span>}
        </div>

        {preview && (
          <div className="rcl-preview">
            <p className="rcl-preview-sum">
              읽은 줄 <b>{rows.length}</b>명
              {errors.length > 0 && <> · <span className="err">오류 {errors.length}줄</span></>}
              {headers.length > 0 && <> · 머리줄 {headers.length}줄 건너뜀</>}
              {sameNames.length > 0 && <> · 동명이인 {sameNames.length}줄(손님이 함께 앉는 분을 보고 골라요)</>}
              {tooMany && <> · <span className="err">{MAX_ROWS}줄까지만 넣을 수 있어요</span></>}
            </p>
            {errors.length > 0 && <p className="adm-note">오류 줄을 고친 뒤 다시 [미리 보기]를 눌러 주세요.</p>}
            {perTable.length > 0 && (
              <div className="rcl-chips">
                {perTable.map(([t, n]) => (
                  <span key={t} className={`adm-badge ${n > SEATS_PER_TABLE ? 'orange' : 'blue'}`}>{t}번 {n}명{n > SEATS_PER_TABLE ? ' · 8석 넘음' : ''}</span>
                ))}
              </div>
            )}
            <AdminTableScroll edge={false}>
              <table className="adm-table rca-table">
                <thead>
                  <tr><th>줄</th><th>이름</th><th>테이블</th><th>좌석</th><th>상태</th></tr>
                </thead>
                <tbody>
                  {[...errors, ...preview.filter((p) => !p.error)].map((p, i) => (
                    <tr key={p.line} className={p.header ? 'rca-wait' : ''} style={{ animationDelay: `${Math.min(i * 30, 900)}ms` }}>
                      <td className="adm-num">{p.line}</td>
                      <td><b className="rca-name">{p.name || '—'}</b></td>
                      <td className="adm-num">{p.header ? '—' : p.table != null ? `${p.table}번` : '—'}</td>
                      <td className="adm-num">{p.header ? '—' : p.seat != null ? `${p.seat}번` : '—'}</td>
                      <td>
                        {p.header ? (
                          <span className="adm-badge">머리줄 · 건너뜀</span>
                        ) : p.error ? (
                          <span className="adm-badge red">{p.error}</span>
                        ) : p.same ? (
                          <span className="adm-badge orange">동명이인 · 손님이 고름</span>
                        ) : (
                          <span className="adm-badge green">좋아요</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </AdminTableScroll>
          </div>
        )}
      </section>

      <AdminListCard
        filter={
          <div className="adm-toolbar">
            <p className="rcd-list-title">지금 명단</p>
            <span className="adm-count grow" style={{ textAlign: 'right' }}>총 <b><RollingNumber value={seats.length} /></b>명</span>
            {seats.length > 0 && <button type="button" className="adm-btn danger" disabled={busy} onClick={clearAll}>명단 비우기</button>}
          </div>
        }
      >
        {loading && !data ? (
          <p className="adm-empty">불러오는 중…</p>
        ) : !data ? (
          <p className="adm-empty">{error || '불러오지 못했어요'}</p>
        ) : seats.length === 0 ? (
          <p className="adm-empty">자리 명단이 아직 없어요</p>
        ) : (
          <AdminTableScroll>
            <table className="adm-table rca-table">
              <thead>
                <tr><th>좌석</th><th>이름</th><th>입장</th><th>응모권</th></tr>
              </thead>
              <tbody>
                {(() => {
                  let i = -1;
                  return groups.flatMap(([t, list]) => {
                    i += 1;
                    const head = (
                      <tr key={`g${t}`} className="rca-group" style={{ animationDelay: `${Math.min(i * 30, 900)}ms` }}>
                        <td colSpan={4}>
                          <span className="rca-group-name">{t}번 테이블</span>
                          <span className="rca-group-count">{list.filter((s) => s.arrived).length} / {list.length}명</span>
                        </td>
                      </tr>
                    );
                    return [
                      head,
                      ...list.map((s) => {
                        i += 1;
                        return (
                          <tr key={`s${s.table}:${receptionNameKey(s.name)}`} className={s.arrived ? '' : 'rca-wait'} style={{ animationDelay: `${Math.min(i * 30, 900)}ms` }}>
                            <td className="adm-num">{s.seat != null ? `${s.seat}번` : '—'}</td>
                            <td><b className="rca-name">{s.name}</b></td>
                            <td className="adm-num">{s.arrived ? kstHm(s.arrivedAt) || '왔어요' : <span className="adm-badge">아직</span>}</td>
                            <td className="rca-no">{s.ticketNumber != null ? ticketLabel(s.ticketNumber) : '—'}</td>
                          </tr>
                        );
                      }),
                    ];
                  });
                })()}
              </tbody>
            </table>
          </AdminTableScroll>
        )}
      </AdminListCard>
    </div>
  );
}

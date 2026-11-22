'use client';

/* 송년회 참여자 판(261122 사장 '참여자는 내가 자리를 전부 줬잖아 거기에 모든 리스트가 다 뜨는거야 · 앱에 이름을 입력하면 어드민에 실시간으로
 * 해당 테이블이 최상단으로 · 테이블 색상이 은은한 하늘색 · 이름 옆에 도착 태그 · 럭키드로우·이벤트 참여하면 1부 참여중 2부 참여중 같은 걸로 바뀌고
 * 참여할 때마다 색(노란색 · 보라색 등)이 바뀌고 상단으로')
 *  · 한 줄 = 자리 명단 한 사람(어드민 '자리 명단' 탭에 붙여 넣은 전원) + 명단 밖에서 온 손님. 안 온 사람도 다 보인다(태그 없음 · 회색 '아직').
 *  · 도착 = 손님이 앱 자리 탭에 이름을 넣어 응모권이 나온 때 — 2초 안에 그 줄이 맨 위로 미끄러져 올라가며 하늘색 + '도착'
 *    (행사 날 1부 시작 18:20 뒤엔 '1부 참여중', 2부 시작 19:40 뒤엔 '2부 참여중').
 *  · 그 뒤 퀴즈(노랑) · 베스트드레서 사진/좋아요·공감(보라) · 설문(초록) · 당첨(분홍)을 할 때마다 태그·줄 색이 바뀌고 다시 맨 위로.
 *    단계·순서 규칙 = receptionAdmin.ts personStage · comparePeople 한 곳(도착보다 이른 기록 = 행사 전 시험 데이터는 안 셈).
 *  · (261122 사장 '입장 현황 부분은 필요없는 것 같아') 입장 현황 탭은 없앴다 — 응모권 발급 모드 · 응모권 지우기 · 지운 이름 풀기는 여기로 옮김.
 *  · 실패한 폴링 · 갑자기 빈 응답은 표를 지우지 않는다(마지막 화면 + 작은 안내). 동작 줄이기면 미끄러짐 · 반짝임 없음. */
import { useEffect, useMemo, useRef, useState } from 'react';
import { RollingNumber } from '../_components/AdminNumber';
import { AdminListCard, AdminTableScroll } from '../_components/AdminListCard';
import { AdminSearchField } from '../_components/AdminSearchField';
import { adminAlert, adminConfirm } from '../_components/adminDialog';
import {
  adminErrorText,
  comparePeople,
  kstHm,
  personStage,
  receptionAdminApi,
  receptionNameKey,
  stageTagText,
  ticketLabel,
  useReceptionPeople,
  useReducedMotion,
  type PersonRow,
  type PersonStage,
  type PersonStageInfo,
  type TicketBlock,
  type TicketsMode,
} from '../_components/receptionAdmin';
import { useFlipRows } from './_parts/useFlipRows';
import './reception-admin.css';

type Filter = 'all' | 'arrived' | 'waiting';
const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: '전체' },
  { key: 'arrived', label: '도착' },
  { key: 'waiting', label: '미도착' },
];
const MODES: { key: TicketsMode; label: string }[] = [
  { key: 'auto', label: '자동' },
  { key: 'open', label: '열기' },
  { key: 'closed', label: '닫기' },
];
/** 태그 색 보기(줄 색과 같은 순서) */
const LEGEND: { stage: Exclude<PersonStage, 'none'>; label: string }[] = [
  { stage: 'arrived', label: '도착 · 1부/2부 참여중' },
  { stage: 'quiz', label: '퀴즈 참여' },
  { stage: 'dresser', label: '베스트드레서' },
  { stage: 'survey', label: '설문 완료' },
  { stage: 'win', label: '당첨' },
];
/** 좋아요 · 공감 한 사람 상한(서버 VOTE_LIMIT) — 표시만 */
const VOTE_LIMIT = 10;

interface Line {
  p: PersonRow;
  s: PersonStageInfo;
}

/** 이름 · 응모권 번호('7', '007', 'No.7')로 찾기 */
function matches(p: PersonRow, q: string) {
  const k = receptionNameKey(q);
  if (!k) return true;
  if (receptionNameKey(p.name).includes(k)) return true;
  const digits = k.replace(/^no\.?/, '');
  const n = p.ticket?.number;
  return /^\d+$/.test(digits) && n != null && (String(n) === String(Number(digits)) || String(n).padStart(3, '0').includes(digits));
}

export default function ReceptionParticipantsPage() {
  const { data, loading, error, mutate } = useReceptionPeople(2000);
  const reduce = useReducedMotion();
  const [filter, setFilter] = useState<Filter>('all');
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  // 1부/2부 태그는 서버 시계로(태블릿 시계가 틀려도 맞게) — 받은 순간의 차이를 더해 쓴다
  const skew = useMemo(() => {
    const t = data ? Date.parse(data.serverTime) : NaN;
    return Number.isFinite(t) ? t - Date.now() : 0;
  }, [data]);
  const nowMs = Date.now() + skew;

  const all = useMemo<Line[]>(() => (data?.people || []).map((p) => ({ p, s: personStage(p) })).sort(comparePeople), [data]);

  const stats = useMemo(() => {
    const arrived = all.filter((x) => x.s.stage !== 'none');
    const listed = all.filter((x) => x.p.listed);
    return {
      listed: listed.length,
      tables: new Set(listed.map((x) => x.p.table)).size,
      arrived: arrived.length,
      listedArrived: arrived.filter((x) => x.p.listed).length,
      walkIns: arrived.filter((x) => !x.p.listed).length,
      quiz: arrived.filter((x) => x.s.quiz).length,
      dresser: arrived.filter((x) => x.s.dresser).length,
      win: arrived.filter((x) => x.s.win).length,
      survey: arrived.filter((x) => x.s.survey).length,
    };
  }, [all]);

  const rows = useMemo(
    () => all.filter((x) => (filter === 'all' || (filter === 'arrived') === (x.s.stage !== 'none')) && matches(x.p, q)),
    [all, filter, q],
  );

  // 방금 뭔가 한 줄(도착 · 퀴즈 · 사진 …) — 처음 받은 목록은 '본 것'으로 치고, 그 뒤 새 활동이 생긴 줄만 잠깐 반짝인다(약 2.5초).
  //  · 앞으로 간 것만 반짝(새로 도착 · 단계 시각이 늘어남). 활동이 빠져 시각이 뒤로 가면(사진 삭제 · 테이블 친구가 퀴즈 답을 덮음 · 응모권 지움) 조용히 자리만 옮긴다.
  //  · fix 261122 — 꺼짐은 0.5초마다 도는 한 타이머가 맡는다(새 반짝임이 올 때마다 타이머를 다시 걸면 2초 폴링마다 밀려 영영 안 꺼지고,
  //    그 줄이 또 바뀌어도 애니메이션이 다시 안 돌았다). 같은 줄이 아직 반짝이는 중에 또 바뀌면 a/b 클래스를 번갈아 써서 처음부터 다시 돈다.
  const sigs = useRef<Map<string, { stage: PersonStage; at: number }> | null>(null);
  const [pulse, setPulse] = useState<Record<string, { at: number; n: number }>>({});
  useEffect(() => {
    if (!data) return;
    const next = new Map(all.map((x) => [x.p.key, { stage: x.s.stage, at: x.s.at }]));
    const prev = sigs.current;
    sigs.current = next;
    if (!prev) return;
    const changed = all
      .filter((x) => {
        if (x.s.stage === 'none') return false;
        const o = prev.get(x.p.key);
        return !o || o.stage === 'none' || x.s.at > o.at;
      })
      .map((x) => x.p.key);
    if (!changed.length) return;
    const at = Date.now();
    setPulse((f) => {
      const n = { ...f };
      // n = 그 줄의 반짝임 횟수(아직 반짝이는 중이면 +1 → a/b 가 바뀌어 다시 돎, 꺼진 뒤면 1부터)
      changed.forEach((k) => { n[k] = { at, n: (f[k]?.n ?? 0) + 1 }; });
      return n;
    });
  }, [all, data]);
  const pulsing = Object.keys(pulse).length > 0;
  useEffect(() => {
    if (!pulsing) return;
    const t = window.setInterval(() => {
      setPulse((f) => {
        const now = Date.now();
        let dropped = false;
        const n: Record<string, { at: number; n: number }> = {};
        for (const [k, v] of Object.entries(f)) {
          if (now - v.at < 2500) n[k] = v;
          else dropped = true;
        }
        return dropped ? n : f;
      });
    }, 500);
    return () => window.clearInterval(t);
  }, [pulsing]);

  // 처음 촤라락(어드민 전역 줄 등장)이 끝나면 끈다 — 줄 순서가 바뀔 때 React 가 줄을 옮겨 끼우면 등장이 다시 돌아 깜빡이지 않게
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    if (!data || settled) return;
    const t = window.setTimeout(() => setSettled(true), 1200);
    return () => window.clearTimeout(t);
  }, [data, settled]);

  const tbodyRef = useRef<HTMLTableSectionElement>(null);
  useFlipRows(tbodyRef, [rows], reduce);

  /** 서버를 고친 뒤 참여자 판을 묶음 없이 다시 받아 바로 넣는다 */
  const refreshAfter = (fn: () => Promise<unknown>) =>
    mutate(async () => {
      await fn();
      return receptionAdminApi.people(true);
    });

  const setMode = async (mode: TicketsMode) => {
    if (!data || data.ticketsMode === mode) return;
    if (mode === 'closed' && !(await adminConfirm('응모권 발급을 닫을까요?\n지금부터 들어오는 손님은 응모권을 못 받아요. 이미 받은 응모권은 그대로예요.'))) return;
    setBusy('mode');
    try {
      await refreshAfter(() => receptionAdminApi.ticketsMode(mode));
    } catch (e) {
      await adminAlert(`바꾸지 못했어요\n${adminErrorText(e)}`);
    } finally {
      setBusy(null);
    }
  };

  const remove = async (p: PersonRow) => {
    const t = p.ticket;
    if (!t) return;
    const label = ticketLabel(t.number);
    if (!(await adminConfirm({ title: `${p.name} 님 응모권(${label})을 지울까요?`, description: '도착 기록과 이 응모권의 추첨 기록이 같이 지워져요. 테스트나 실수로 생긴 것만 지워 주세요.', confirmText: '지울게요' }))) return;
    if (!(await adminConfirm({ title: '정말 지울까요?', description: `${p.name} 님 ${label} — 지우면 되돌릴 수 없어요. 이 이름으로는 응모권이 다시 안 나와요(아래 '지운 이름'에서 다시 받게 할 수 있어요).`, confirmText: '지우기' }))) return;
    setBusy(t.id);
    try {
      await refreshAfter(() => receptionAdminApi.deleteTicket(t.id));
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
      await refreshAfter(() => receptionAdminApi.unblockTicket(b.name));
    } catch (e) {
      await adminAlert(`풀지 못했어요\n${adminErrorText(e)}`);
    } finally {
      setBusy(null);
    }
  };
  const blocked = data?.blocked || [];

  return (
    <div className="rca space-y-5">
      <div className="adm-grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
        <div className="adm-stat">
          <p className="adm-stat-label">명단</p>
          <p className="adm-stat-value"><RollingNumber value={stats.listed} /><small>명</small></p>
          <p className="adm-stat-sub">{stats.listed ? `테이블 ${stats.tables}개` : '자리 명단이 아직 없어요'}</p>
        </div>
        <div className="adm-stat">
          <p className="adm-stat-label">도착</p>
          <p className="adm-stat-value" style={{ color: 'var(--admin-blue)' }}><RollingNumber value={stats.arrived} /><small>명</small></p>
          <p className="adm-stat-sub">{stats.walkIns ? `명단 ${stats.listedArrived}명 · 명단 밖 ${stats.walkIns}명` : stats.listed ? `${Math.round((stats.listedArrived / stats.listed) * 100)}% 왔어요` : '응모권 한 장 = 한 사람'}</p>
        </div>
        <div className="adm-stat">
          <p className="adm-stat-label">퀴즈 참여</p>
          <p className="adm-stat-value"><RollingNumber value={stats.quiz} /><small>명</small></p>
          <p className="adm-stat-sub">도착 뒤 답을 낸 사람</p>
        </div>
        <div className="adm-stat">
          <p className="adm-stat-label">베스트드레서</p>
          <p className="adm-stat-value"><RollingNumber value={stats.dresser} /><small>명</small></p>
          <p className="adm-stat-sub">사진 올림 · 좋아요/공감</p>
        </div>
        <div className="adm-stat">
          <p className="adm-stat-label">당첨</p>
          <p className="adm-stat-value"><RollingNumber value={stats.win} /><small>명</small></p>
          <p className="adm-stat-sub">럭키드로우(무효 빼고)</p>
        </div>
        <div className="adm-stat">
          <p className="adm-stat-label">설문</p>
          <p className="adm-stat-value"><RollingNumber value={stats.survey} /><small>명</small></p>
          <p className="adm-stat-sub">도착 뒤 응답한 사람</p>
        </div>
      </div>

      <section className="rcp-bar">
        <div className="rcp-bar-text">
          <p className="rcp-bar-title">
            응모권 발급
            <span className={`adm-badge ${data?.ticketsOpen ? 'green' : ''}`}>{data ? (data.ticketsOpen ? '받는 중' : '닫힘') : '—'}</span>
          </p>
          <p className="rcp-bar-sub">
            {data?.ticketsMode === 'auto' ? '자동 = 11.23 15:00 ~ 11.24 03:00 · 앱 자리 탭에 이름을 넣으면 한 장 = 도착' : data?.ticketsMode === 'open' ? '지금 시간과 상관없이 열어 뒀어요' : data ? '지금 시간과 상관없이 닫아 뒀어요' : ''}
          </p>
        </div>
        <div className="adm-seg rcp-mode" role="radiogroup" aria-label="응모권 발급">
          {MODES.map((m) => (
            <button key={m.key} type="button" role="radio" aria-checked={data?.ticketsMode === m.key} className={data?.ticketsMode === m.key ? 'on' : ''} disabled={!data || busy === 'mode'} onClick={() => setMode(m.key)}>
              {m.label}
            </button>
          ))}
        </div>
      </section>

      {error && data && <p className="adm-note">연결이 잠깐 끊겼어요 — 마지막으로 받은 화면이에요. ({error})</p>}

      <AdminListCard
        filter={
          <>
            <div className="adm-toolbar">
              <div className="adm-seg" role="tablist" aria-label="보기">
                {FILTERS.map((f) => (
                  <button key={f.key} type="button" role="tab" aria-selected={filter === f.key} className={filter === f.key ? 'on' : ''} onClick={() => setFilter(f.key)}>
                    {f.label}
                  </button>
                ))}
              </div>
              <AdminSearchField className="grow" value={q} onChange={setQ} onSubmit={setQ} placeholder="이름 · 응모권 번호" />
              <span className="adm-count">총 <b><RollingNumber value={rows.length} /></b>명</span>
            </div>
            <div className="rcp-legend" aria-label="태그 색">
              {LEGEND.map((l) => (
                <span key={l.stage} className={`rcp-tag s-${l.stage}`}>{l.label}</span>
              ))}
            </div>
          </>
        }
      >
        {loading && !data ? (
          <p className="adm-empty">불러오는 중…</p>
        ) : !data ? (
          <p className="adm-empty">{error || '불러오지 못했어요'}</p>
        ) : rows.length === 0 ? (
          <p className="adm-empty">
            {q ? '찾는 사람이 없어요' : filter === 'arrived' ? '아직 도착한 사람이 없어요' : filter === 'waiting' ? '모두 도착했어요' : '자리 명단이 아직 없어요 — 자리 명단 탭에서 붙여 넣어 주세요'}
          </p>
        ) : (
          <AdminTableScroll>
            <table className={`adm-table rca-table rcp-table ${settled ? 'settled' : ''}`}>
              <thead>
                <tr>
                  <th>이름</th>
                  <th>자리</th>
                  <th>도착</th>
                  <th>퀴즈</th>
                  <th>베스트드레서</th>
                  <th>설문</th>
                  <th aria-label="동작" />
                </tr>
              </thead>
              <tbody key={`${filter}|${q}`} ref={tbodyRef}>
                {rows.map(({ p, s }) => {
                  const tag = stageTagText(p, s.stage, nowMs);
                  const tinted = s.stage !== 'none';
                  const pl = pulse[p.key];
                  return (
                    <tr key={p.key} data-k={p.key} className={`rcp-row s-${s.stage} ${tinted ? 'tint' : ''} ${pl ? `rcp-pulse ${pl.n % 2 ? 'pa' : 'pb'}` : ''}`}>
                      <td>
                        <div className="rcp-name">
                          <b className="rca-name">{p.name}</b>
                          {tag && <span className={`rcp-tag s-${s.stage}`}>{tag}</span>}
                          {!p.listed && <span className="rcp-chip">명단 밖</span>}
                        </div>
                        {p.win && s.stage !== 'win' && <span className="adm-cell-sub rcp-win">당첨 · {p.win.prize}</span>}
                      </td>
                      <td className="adm-num">{p.table != null ? `${p.table}번 테이블${p.seat != null ? ` ${p.seat}번` : ''}` : '—'}</td>
                      <td className="adm-num">
                        {tinted ? (
                          <>
                            {kstHm(p.arrivedAt)}
                            {p.ticket && <span className="adm-cell-sub rcp-ticket">{ticketLabel(p.ticket.number)}</span>}
                          </>
                        ) : (
                          <span className="adm-badge">아직</span>
                        )}
                      </td>
                      <td className="adm-num">
                        {p.quizCount > 0 ? (
                          <>
                            {p.quizCount}문제
                            <span className="adm-cell-sub">{kstHm(p.quizAt)}</span>
                          </>
                        ) : <span className="adm-cell-sub">—</span>}
                      </td>
                      <td>
                        <div className="rcp-dress">
                          {p.photo && (
                            <a href={p.photo.imageUrl} target="_blank" rel="noreferrer" className="rcp-thumb" aria-label={`${p.name} 님 사진 크게 보기`}>
                              <img src={p.photo.thumbUrl} alt="" width={40} height={40} loading="lazy" />
                            </a>
                          )}
                          <span className="rcp-dress-text">
                            {p.photo ? (
                              <>
                                {p.photo.rank}위
                                <span className="adm-cell-sub adm-num">공감 {p.photo.empathies} · 좋아요 {p.photo.likes}</span>
                              </>
                            ) : <span className="adm-cell-sub">사진 안 올림</span>}
                            {(p.likesUsed > 0 || p.empathiesUsed > 0) && (
                              <span className="adm-cell-sub adm-num">누름 좋아요 {p.likesUsed}/{VOTE_LIMIT} · 공감 {p.empathiesUsed}/{VOTE_LIMIT}</span>
                            )}
                          </span>
                        </div>
                      </td>
                      <td>
                        {p.surveyAt ? (
                          <>
                            <span className="adm-badge green">응답함</span>
                            <span className="adm-cell-sub adm-num">{kstHm(p.surveyAt)}</span>
                          </>
                        ) : <span className="adm-cell-sub">—</span>}
                      </td>
                      <td className="r">
                        {p.ticket && (
                          <button type="button" className="adm-btn ghost sm rca-del" disabled={busy === p.ticket.id} onClick={() => remove(p)}>
                            응모권 지우기
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

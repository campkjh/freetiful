'use client';

/* 시크릿 미션 응모(261118) — 5,000원 미션을 마친 사람이 인스타 스토리(@freetiful_ 태그) 캡처 + 아이디로 응모. 경품 = 4만원 상당 화장품 세트(추첨).
 *  · 캡처를 눌러 크게 보고 인스타 아이디로 스토리를 확인 → 추첨 뒤 [당첨] → 사용자에게 당첨 알림. 태그가 없으면 [반려](사유) → 사용자가 다시 응모.
 *  · API: GET/PATCH /api/v1/admin/mission/welcome/secret(apps/api/src/mission). */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { RollingNumber } from '../../_components/AdminNumber';
import { AdminListCard, AdminTableScroll } from '../../_components/AdminListCard';
import { AdminSearchField } from '../../_components/AdminSearchField';
import { formatKstDateTime } from '../../_components/adminEvent';
import { adminFetch } from '../../_components/adminFetch';
import { useAdminRefresh } from '../../_components/adminRefresh';
import { adminAlert, adminConfirm } from '../../_components/adminDialog';

type Status = 'entered' | 'won' | 'rejected';
interface Entry {
  id: string;
  userId: string;
  user: { id: string; name: string | null; email: string | null; phone: string | null; role: string } | null;
  instagramId: string;
  imageUrl: string;
  thumbUrl: string;
  status: Status;
  adminNote: string | null;
  wonAt: string | null;
  createdAt: string;
}
interface Overview { summary: { total: number; entered: number; won: number; rejected: number }; entries: Entry[] }

const STATUS: Record<Status, { label: string; tone: string }> = {
  entered: { label: '응모', tone: 'orange' },
  won: { label: '당첨', tone: 'green' },
  rejected: { label: '반려', tone: 'red' },
};
const FILTERS: { key: '' | Status; label: string }[] = [
  { key: '', label: '전체' },
  { key: 'entered', label: '응모' },
  { key: 'won', label: '당첨' },
  { key: 'rejected', label: '반려' },
];
const phoneView = (d?: string | null) => {
  const n = (d || '').replace(/\D/g, '');
  return n.length === 11 ? `${n.slice(0, 3)}-${n.slice(3, 7)}-${n.slice(7)}` : n || '-';
};

export default function SecretMissionAdminPage() {
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'' | Status>('');
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<{ id: string; note: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await adminFetch('GET', '/api/v1/admin/mission/welcome/secret', undefined, { cache: false }));
      setError(null);
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || '불러오지 못했어요');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);
  useAdminRefresh(load);

  const rows = useMemo(() => {
    const list = (data?.entries || []).filter((c) => !filter || c.status === filter);
    const k = q.replace(/[\s@-]+/g, '').toLowerCase();
    if (!k) return list;
    return list.filter((c) => [c.instagramId, c.user?.name, c.user?.email, c.user?.phone].some((v) => (v || '').replace(/[\s-]+/g, '').toLowerCase().includes(k)));
  }, [data, filter, q]);
  const s = data?.summary;

  const update = async (c: Entry, status: Status, adminNote?: string) => {
    setBusy(c.id);
    try {
      await adminFetch('PATCH', `/api/v1/admin/mission/welcome/secret/${c.id}`, { status, ...(adminNote !== undefined ? { adminNote } : {}) });
      setRejecting(null);
      await load();
    } catch (e: any) {
      await adminAlert(`바꾸지 못했어요\n${e?.response?.data?.message || e?.message || ''}`);
    } finally {
      setBusy(null);
    }
  };

  const markWon = async (c: Entry) => {
    const ok = await adminConfirm({
      title: `@${c.instagramId} 님을 당첨으로 할까요?`,
      description: '당첨으로 바꾸면 사용자에게 당첨 알림이 가요.',
      confirmText: '당첨',
    });
    if (ok) update(c, 'won');
  };

  return (
    <div className="space-y-5">
      <div className="adm-grid grid-cols-2 lg:grid-cols-4">
        <div className="adm-stat">
          <p className="adm-stat-label">응모</p>
          <p className="adm-stat-value"><RollingNumber value={s?.total || 0} /><small>명</small></p>
          <p className="adm-stat-sub">반려 포함 전체</p>
        </div>
        <div className="adm-stat">
          <p className="adm-stat-label">추첨 대상</p>
          <p className="adm-stat-value"><RollingNumber value={s?.entered || 0} /><small>명</small></p>
          <p className="adm-stat-sub">응모 상태</p>
        </div>
        <div className="adm-stat">
          <p className="adm-stat-label">당첨</p>
          <p className="adm-stat-value" style={s?.won ? { color: 'var(--admin-green, #12b886)' } : undefined}><RollingNumber value={s?.won || 0} /><small>명</small></p>
          <p className="adm-stat-sub">4만원 상당 화장품 세트</p>
        </div>
        <div className="adm-stat">
          <p className="adm-stat-label">반려</p>
          <p className="adm-stat-value"><RollingNumber value={s?.rejected || 0} /><small>명</small></p>
          <p className="adm-stat-sub">다시 응모할 수 있어요</p>
        </div>
      </div>

      <AdminListCard
        filter={
          <div className="adm-toolbar">
            <div className="adm-seg" role="tablist" aria-label="상태">
              {FILTERS.map((f) => (
                <button key={f.key || 'all'} type="button" role="tab" aria-selected={filter === f.key} className={filter === f.key ? 'on' : ''} onClick={() => setFilter(f.key)}>
                  {f.label}
                </button>
              ))}
            </div>
            <AdminSearchField className="grow" value={q} onChange={setQ} onSubmit={setQ} placeholder="인스타 아이디 · 이름 · 이메일 · 연락처" />
            <span className="adm-count">총 <b><RollingNumber value={rows.length} /></b>건</span>
          </div>
        }
      >
        {loading && !data ? (
          <p className="adm-empty">불러오는 중…</p>
        ) : error ? (
          <p className="adm-empty">{error}</p>
        ) : rows.length === 0 ? (
          <p className="adm-empty">{q ? '찾는 응모가 없어요' : '아직 응모가 없어요'}</p>
        ) : (
          <AdminTableScroll>
            <table className="adm-table">
              <thead>
                <tr>
                  <th>캡처</th>
                  <th>인스타그램</th>
                  <th>회원</th>
                  <th>연락처</th>
                  <th>응모</th>
                  <th>상태</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <a href={c.imageUrl} target="_blank" rel="noreferrer" title="크게 보기">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={c.thumbUrl} alt="" width={36} height={64} style={{ borderRadius: 6, objectFit: 'cover', background: '#f2f4f6' }} />
                      </a>
                    </td>
                    <td className="whitespace-nowrap">
                      <a href={`https://instagram.com/${encodeURIComponent(c.instagramId)}`} target="_blank" rel="noreferrer" className="font-semibold underline decoration-dotted">@{c.instagramId}</a>
                    </td>
                    <td>
                      <b>{c.user?.name || '(이름 없음)'}</b>
                      <div className="text-[12px] text-[var(--admin-muted)]">{c.user?.email || c.userId.slice(0, 8)}{c.user?.role === 'pro' ? ' · 사회자' : ''}</div>
                    </td>
                    <td className="whitespace-nowrap">{phoneView(c.user?.phone)}</td>
                    <td className="whitespace-nowrap">{formatKstDateTime(c.createdAt)}</td>
                    <td>
                      <span className={`adm-badge ${STATUS[c.status].tone}`}>{STATUS[c.status].label}</span>
                      {c.status === 'won' && c.wonAt && <div className="text-[12px] text-[var(--admin-muted)]">{formatKstDateTime(c.wonAt)}</div>}
                      {c.status === 'rejected' && c.adminNote && <div className="max-w-[220px] text-[12px] text-[var(--admin-muted)]">{c.adminNote}</div>}
                    </td>
                    <td className="whitespace-nowrap text-right">
                      {rejecting?.id === c.id ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <input
                            className="adm-input h-8 w-[220px] text-[13px]"
                            autoFocus
                            placeholder="반려 사유(사용자에게 보여요)"
                            value={rejecting.note}
                            maxLength={300}
                            onChange={(e) => setRejecting({ id: c.id, note: e.target.value })}
                          />
                          <button type="button" className="adm-btn danger sm" disabled={busy === c.id || !rejecting.note.trim()} onClick={() => update(c, 'rejected', rejecting.note)}>반려</button>
                          <button type="button" className="adm-btn ghost sm" onClick={() => setRejecting(null)}>취소</button>
                        </div>
                      ) : c.status === 'entered' ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <button type="button" className="adm-btn adm-btn-ok sm" disabled={busy === c.id} onClick={() => markWon(c)}>당첨</button>
                          <button type="button" className="adm-btn danger sm" disabled={busy === c.id} onClick={() => setRejecting({ id: c.id, note: '' })}>반려</button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          className="adm-btn ghost sm"
                          disabled={busy === c.id}
                          onClick={async () => {
                            if (await adminConfirm(`'응모'로 되돌릴까요?\n사용자에게 알림은 가지 않아요.`)) update(c, 'entered');
                          }}
                        >
                          되돌리기
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </AdminTableScroll>
        )}
      </AdminListCard>
    </div>
  );
}

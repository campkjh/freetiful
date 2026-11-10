'use client';

/* 신규 가입 5,000원 미션 신청(261110) — 미션(출석 2번 · 웨딩숲 글 · 견적)을 마치고 계좌를 낸 사람.
 *  · 돈은 운영팀이 직접 보낸 뒤 [보냈어요] → 사용자에게 알림. [반려]는 사유를 적어 보내면 사용자가 미션 화면에서 다시 신청할 수 있다.
 *  · 같은 연락처·계좌로 두 계정이 받는 건 서버가 신청 때 막는다(반려된 신청은 제외).
 *  · API: GET/PATCH /api/v1/admin/mission/welcome/claims(apps/api/src/mission). */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { RollingNumber } from '../_components/AdminNumber';
import { AdminListCard, AdminTableScroll } from '../_components/AdminListCard';
import { AdminSearchField } from '../_components/AdminSearchField';
import { formatKstDateTime } from '../_components/adminEvent';
import { adminFetch } from '../_components/adminFetch';
import { useAdminRefresh } from '../_components/adminRefresh';
import { adminAlert, adminConfirm } from '../_components/adminDialog';

type Status = 'pending' | 'paid' | 'rejected';
interface Claim {
  id: string;
  userId: string;
  user: { id: string; name: string | null; email: string | null; role: string; createdAt: string } | null;
  rewardAmount: number;
  phone: string;
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  status: Status;
  adminNote: string | null;
  paidAt: string | null;
  createdAt: string;
}
interface Overview { summary: { participants: number; pending: number; paid: number; rejected: number }; claims: Claim[] }

const STATUS: Record<Status, { label: string; tone: string }> = {
  pending: { label: '보낼 차례', tone: 'orange' },
  paid: { label: '보냄', tone: 'green' },
  rejected: { label: '반려', tone: 'red' },
};
const FILTERS: { key: '' | Status; label: string }[] = [
  { key: 'pending', label: '보낼 차례' },
  { key: 'paid', label: '보냄' },
  { key: 'rejected', label: '반려' },
  { key: '', label: '전체' },
];
const phoneView = (d: string) => (d.length === 11 ? `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}` : d.length === 10 ? `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}` : d);

export default function WelcomeMissionAdminPage() {
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'' | Status>('pending');
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<{ id: string; note: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await adminFetch('GET', '/api/v1/admin/mission/welcome/claims', undefined, { cache: false }));
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
    const list = (data?.claims || []).filter((c) => !filter || c.status === filter);
    const k = q.replace(/[\s-]+/g, '').toLowerCase();
    if (!k) return list;
    return list.filter((c) => [c.user?.name, c.user?.email, c.accountHolder, c.phone, c.accountNumber].some((v) => (v || '').replace(/[\s-]+/g, '').toLowerCase().includes(k)));
  }, [data, filter, q]);
  const s = data?.summary;

  const update = async (c: Claim, status: Status, adminNote?: string) => {
    setBusy(c.id);
    try {
      await adminFetch('PATCH', `/api/v1/admin/mission/welcome/claims/${c.id}`, { status, ...(adminNote !== undefined ? { adminNote } : {}) });
      setRejecting(null);
      await load();
    } catch (e: any) {
      await adminAlert(`바꾸지 못했어요\n${e?.response?.data?.message || e?.message || ''}`);
    } finally {
      setBusy(null);
    }
  };

  const markPaid = async (c: Claim) => {
    const ok = await adminConfirm({
      title: `${c.accountHolder}님께 ${c.rewardAmount.toLocaleString('ko-KR')}원 보냈어요?`,
      description: `${c.bankName} ${c.accountNumber}\n보냄으로 바꾸면 사용자에게 입금 알림이 가요.`,
      confirmText: '보냈어요',
    });
    if (ok) update(c, 'paid');
  };

  const copy = (text: string) => {
    navigator.clipboard?.writeText(text).catch(() => {});
  };

  return (
    <div className="space-y-5">
      <div className="adm-grid grid-cols-2 lg:grid-cols-4">
        <div className="adm-stat">
          <p className="adm-stat-label">출석한 신규 가입자</p>
          <p className="adm-stat-value"><RollingNumber value={s?.participants || 0} /><small>명</small></p>
          <p className="adm-stat-sub">미션 화면에 한 번 이상 들어온 사람</p>
        </div>
        <div className="adm-stat">
          <p className="adm-stat-label">보낼 차례</p>
          <p className="adm-stat-value" style={s?.pending ? { color: 'var(--admin-orange)' } : undefined}><RollingNumber value={s?.pending || 0} /><small>건</small></p>
          <p className="adm-stat-sub">{((s?.pending || 0) * 5000).toLocaleString('ko-KR')}원</p>
        </div>
        <div className="adm-stat">
          <p className="adm-stat-label">보냄</p>
          <p className="adm-stat-value"><RollingNumber value={s?.paid || 0} /><small>건</small></p>
          <p className="adm-stat-sub">{((s?.paid || 0) * 5000).toLocaleString('ko-KR')}원</p>
        </div>
        <div className="adm-stat">
          <p className="adm-stat-label">반려</p>
          <p className="adm-stat-value"><RollingNumber value={s?.rejected || 0} /><small>건</small></p>
          <p className="adm-stat-sub">다시 신청할 수 있어요</p>
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
            <AdminSearchField className="grow" value={q} onChange={setQ} onSubmit={setQ} placeholder="이름 · 이메일 · 연락처 · 계좌" />
            <span className="adm-count">총 <b><RollingNumber value={rows.length} /></b>건</span>
          </div>
        }
      >
        {loading && !data ? (
          <p className="adm-empty">불러오는 중…</p>
        ) : error ? (
          <p className="adm-empty">{error}</p>
        ) : rows.length === 0 ? (
          <p className="adm-empty">{q ? '찾는 신청이 없어요' : filter === 'pending' ? '보낼 신청이 없어요' : '아직 신청이 없어요'}</p>
        ) : (
          <AdminTableScroll>
            <table className="adm-table">
              <thead>
                <tr>
                  <th>회원</th>
                  <th>가입일</th>
                  <th>연락처</th>
                  <th>계좌</th>
                  <th>예금주</th>
                  <th>신청</th>
                  <th>상태</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <b>{c.user?.name || '(이름 없음)'}</b>
                      <div className="text-[12px] text-[var(--admin-muted)]">{c.user?.email || c.userId.slice(0, 8)}{c.user?.role === 'pro' ? ' · 사회자' : ''}</div>
                    </td>
                    <td className="whitespace-nowrap">{c.user ? formatKstDateTime(c.user.createdAt) : '-'}</td>
                    <td className="whitespace-nowrap">{phoneView(c.phone)}</td>
                    <td className="whitespace-nowrap">
                      {c.bankName} <button type="button" className="font-mono underline decoration-dotted" title="눌러서 복사" onClick={() => copy(c.accountNumber)}>{c.accountNumber}</button>
                    </td>
                    <td className="whitespace-nowrap">{c.accountHolder}</td>
                    <td className="whitespace-nowrap">{formatKstDateTime(c.createdAt)}</td>
                    <td>
                      <span className={`adm-badge ${STATUS[c.status].tone}`}>{STATUS[c.status].label}</span>
                      {c.status === 'paid' && c.paidAt && <div className="text-[12px] text-[var(--admin-muted)]">{formatKstDateTime(c.paidAt)}</div>}
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
                      ) : c.status === 'pending' ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <button type="button" className="adm-btn adm-btn-ok sm" disabled={busy === c.id} onClick={() => markPaid(c)}>보냈어요</button>
                          <button type="button" className="adm-btn danger sm" disabled={busy === c.id} onClick={() => setRejecting({ id: c.id, note: '' })}>반려</button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          className="adm-btn ghost sm"
                          disabled={busy === c.id}
                          onClick={async () => {
                            if (await adminConfirm(`'보낼 차례'로 되돌릴까요?\n${c.status === 'paid' ? '입금 기록이 지워져요. 사용자에게 알림은 가지 않아요.' : '사용자 화면에서 다시 확인 중으로 보여요.'}`)) update(c, 'pending');
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

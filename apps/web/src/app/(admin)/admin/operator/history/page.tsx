'use client';

import { useEffect, useState } from 'react';
import { Search } from '@/app/(admin)/admin/_components/admin-icons';
import { AdminErrorPanel, extractAdminError, type AdminErrorInfo } from '../../_components/ErrorPanel';
import { AdminInfiniteScroll, appendUniqueById } from '../../_components/AdminInfiniteScroll';
import { adminFetch } from '../../_components/adminFetch';
import { useAdminRefresh } from '../../_components/adminRefresh';
import { formatKstDateTime } from '../../_components/adminEvent';
import { ACTION_LABEL, FIELD_LABEL, STATUS_LABEL } from '../../_components/operatorAdmin';

interface AuditRow {
  id: string;
  adminId: string;
  adminName: string | null;
  adminEmail: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  before: Record<string, any> | null;
  after: Record<string, any> | null;
  reason: string | null;
  createdAt: string;
}

const GROUPS: [string, string][] = [
  ['', '전체'],
  ['operator', '운영 프로필·글'],
  ['metric', '조회수 보정'],
  ['test', '테스트 수치'],
  ['community', '커뮤니티 관리'],
];

/** 값 한 줄로 */
function show(key: string, v: any): string {
  if (v === null || v === undefined || v === '') return '없음';
  if (key === 'status' && typeof v === 'string') return STATUS_LABEL[v] || v;
  if (key === 'isActive' || typeof v === 'boolean') return v ? '켜짐' : '꺼짐';
  if ((key === 'publishAt' || key === 'publishedAt' || key === 'createdAt') && typeof v === 'string') return formatKstDateTime(v);
  if (Array.isArray(v)) return key === 'imageUrls' ? `사진 ${v.length}장` : v.join(', ');
  if (typeof v === 'object') return JSON.stringify(v);
  const s = String(v);
  return s.length > 80 ? `${s.slice(0, 80)}…` : s;
}

/** 변경 전 → 후 (바뀐 칸만) */
function Diff({ before, after }: { before: Record<string, any> | null; after: Record<string, any> | null }) {
  const keys = Array.from(new Set([...Object.keys(before || {}), ...Object.keys(after || {})])).filter((k) => !['source'].includes(k));
  if (!keys.length) return <span className="text-[#B0B8C1]">—</span>;
  return (
    <span className="adm-op-diff">
      {keys.slice(0, 6).map((k) => {
        const inB = !!before && k in before;
        const inA = !!after && k in after;
        return (
          <span key={k} className="adm-op-diff-row">
            <span className="adm-op-diff-key">{FIELD_LABEL[k] || k}</span>
            {inB && inA ? (
              <>
                <span className="adm-op-diff-before">{show(k, before![k])}</span>
                <span className="adm-op-diff-arrow">→</span>
                <span className="adm-op-diff-after">{show(k, after![k])}</span>
              </>
            ) : inA ? (
              <span className="adm-op-diff-after">{show(k, after![k])}</span>
            ) : (
              // 바뀐 값이 아니라 그때 상태(참고용)
              <span className="adm-op-diff-ctx">{show(k, before![k])}</span>
            )}
          </span>
        );
      })}
    </span>
  );
}

/** 운영 콘텐츠 · 변경 이력 — 관리자 · 대상 · 변경 전후 · 사유 · 시각 */
export default function AdminOperatorHistoryPage() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [group, setGroup] = useState('');
  const [q, setQ] = useState('');
  const [lastError, setLastError] = useState<AdminErrorInfo | null>(null);
  const LIMIT = 30;

  const fetchRows = async (p = 1, opts = { group, q }, append = false) => {
    if (append) setLoadingMore(true);
    else setLoading(true);
    setLastError(null);
    try {
      const params = new URLSearchParams({ page: String(p), limit: String(LIMIT) });
      if (opts.group) params.set('group', opts.group);
      if (opts.q.trim()) params.set('q', opts.q.trim());
      const data = await adminFetch('GET', `/api/v1/admin/audit-logs?${params.toString()}`, undefined, { cache: false });
      const next: AuditRow[] = data.data || [];
      setRows((prev) => (append ? appendUniqueById(prev, next) : next));
      setTotal(data.total || 0);
      setPage(p);
    } catch (e: any) {
      setLastError(extractAdminError(e));
    } finally {
      if (append) setLoadingMore(false);
      else setLoading(false);
    }
  };

  useEffect(() => {
    fetchRows(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useAdminRefresh(() => fetchRows(1));

  const hasMore = rows.length < total;

  return (
    <div className="space-y-5">
      <div className="adm-filter">
        <div className="adm-toolbar">
          <div className="adm-chips">
            {GROUPS.map(([k, label]) => (
              <button key={k || 'all'} type="button" className={`adm-chip ${group === k ? 'on' : ''}`} onClick={() => { setGroup(k); fetchRows(1, { group: k, q }); }}>
                {label}
              </button>
            ))}
          </div>
          <label className="adm-search grow">
            <Search size={17} />
            <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') fetchRows(1, { group, q }); }} placeholder="사유·대상 ID·관리자 이메일 (Enter)" className="adm-input" />
          </label>
          <span className="adm-count">총 <b>{total.toLocaleString()}</b>건</span>
        </div>
      </div>

      <AdminErrorPanel error={lastError} label="변경 이력" />

      <div className="adm-card flush">
        <div className="overflow-x-auto">
          <table className="adm-table">
            <thead>
              <tr>
                <th>시각</th>
                <th>관리자</th>
                <th>동작</th>
                <th>변경 전 → 후</th>
                <th>사유</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => <tr key={i}><td colSpan={5}><div className="adm-skel h-[40px]" /></td></tr>)
              ) : rows.length === 0 ? (
                <tr><td colSpan={5} className="adm-empty">기록이 없어요</td></tr>
              ) : rows.map((r) => (
                <tr key={r.id}>
                  <td className="whitespace-nowrap"><span className="adm-cell-main adm-num">{formatKstDateTime(r.createdAt)}</span></td>
                  <td className="whitespace-nowrap">
                    <span className="adm-cell-main">{r.adminName || r.adminEmail || r.adminId}</span>
                    <span className="adm-cell-sub" title={r.adminId}>{r.adminEmail && r.adminName ? r.adminEmail : r.adminId.slice(0, 18)}</span>
                  </td>
                  <td>
                    <span className="adm-cell-main">{ACTION_LABEL[r.action] || r.action}</span>
                    <span className="adm-cell-sub" title={r.targetId || ''}>{r.targetType || ''}{r.targetId ? ` · ${r.targetId.slice(0, 8)}` : ''}</span>
                  </td>
                  <td className="adm-op-diff-cell"><Diff before={r.before} after={r.after} /></td>
                  <td className="adm-reason">{r.reason ? <span className="adm-cell-sub adm-wrap">{r.reason}</span> : <span className="text-[#D1D6DB]">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <AdminInfiniteScroll
        hasMore={hasMore}
        loading={loadingMore}
        loaded={rows.length}
        total={total}
        onLoadMore={() => {
          if (!hasMore || loading || loadingMore) return;
          fetchRows(page + 1, { group, q }, true);
        }}
      />
    </div>
  );
}

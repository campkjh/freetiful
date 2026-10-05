'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { AdminErrorPanel, extractAdminError, type AdminErrorInfo } from '../../_components/ErrorPanel';
import { AdminInfiniteScroll, appendUniqueById } from '../../_components/AdminInfiniteScroll';
import { adminFetch } from '../../_components/adminFetch';
import { useAdminRefresh } from '../../_components/adminRefresh';
import { formatKstDateTime } from '../../_components/adminEvent';
import { ENV_LABEL, REACTION_LABEL, STATUS_LABEL, useOperatorEnv, type RealStats } from '../../_components/operatorAdmin';
import { adminConfirm } from '../../_components/adminDialog';
import { AdminCollapse } from '../../_components/AdminCollapse';
import { AdminListCard, AdminTableScroll } from '../../_components/AdminListCard';
import { RollingNumber } from '../../_components/AdminNumber';
import { AdminRadioGroup } from '../../_components/AdminRadioGroup';
import { AdminSearchField } from '../../_components/AdminSearchField';

interface MetricRow {
  id: string;
  title: string;
  status: string;
  isActive: boolean;
  createdAt: string;
  groupName: string | null;
  isOperator: boolean;
  authorName: string | null;
  stats: RealStats;
  test: { likes: number; views: number } | null;
  lastCorrection: { at: string; reason: string | null } | null;
}

/** 운영 콘텐츠 · 반응 수치 — 글별 실제 반응 · 조회수 보정(줄이기만, 사유 필수) · 테스트 수치(개발·스테이징 서버만) */
export default function AdminOperatorMetricsPage() {
  const env = useOperatorEnv();
  const [rows, setRows] = useState<MetricRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [kind, setKind] = useState<'operator' | 'all'>('operator');
  const [q, setQ] = useState('');
  const [lastError, setLastError] = useState<AdminErrorInfo | null>(null);
  /** 열린 줄: 조회수 보정 / 테스트 수치 */
  const [open, setOpen] = useState<{ id: string; kind: 'fix' | 'test' } | null>(null);
  const [fix, setFix] = useState({ value: '', reason: '' });
  const [test, setTest] = useState({ likes: '', views: '' });
  const [busy, setBusy] = useState(false);
  const testOn = !!env?.testMetricsEnabled;
  const LIMIT = 20;

  const fetchRows = async (p = 1, opts = { kind, q }, append = false) => {
    if (append) setLoadingMore(true);
    else setLoading(true);
    setLastError(null);
    try {
      const params = new URLSearchParams({ page: String(p), limit: String(LIMIT), kind: opts.kind });
      if (opts.q.trim()) params.set('q', opts.q.trim());
      const data = await adminFetch('GET', `/api/v1/admin/operator/metrics?${params.toString()}`, undefined, { cache: false });
      const next: MetricRow[] = data.data || [];
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

  const openFix = (r: MetricRow) => {
    setOpen(open?.id === r.id && open.kind === 'fix' ? null : { id: r.id, kind: 'fix' });
    setFix({ value: String(r.stats.views), reason: '' });
  };
  const openTest = (r: MetricRow) => {
    setOpen(open?.id === r.id && open.kind === 'test' ? null : { id: r.id, kind: 'test' });
    setTest({ likes: String(r.test?.likes ?? 0), views: String(r.test?.views ?? 0) });
  };

  const submitFix = async (r: MetricRow) => {
    const value = Number(fix.value);
    if (!Number.isInteger(value) || value < 0) { toast.error('0 이상 정수로 넣어 주세요'); return; }
    if (value >= r.stats.views) { toast.error('줄이는 보정만 할 수 있어요'); return; }
    if (fix.reason.trim().length < 5) { toast.error('사유를 5자 이상 적어 주세요'); return; }
    if (!(await adminConfirm(`조회수를 ${r.stats.views.toLocaleString()} → ${value.toLocaleString()} 로 보정할까요?\n변경 이력에 사유와 함께 남아요.`))) return;
    setBusy(true);
    try {
      await adminFetch('PATCH', `/api/v1/admin/operator/metrics/${r.id}/views`, { value, reason: fix.reason.trim() });
      toast.success('보정했어요');
      setOpen(null);
      fetchRows(1);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || '보정하지 못했어요', { duration: 6000 });
    } finally {
      setBusy(false);
    }
  };

  const submitTest = async (r: MetricRow, reset = false) => {
    setBusy(true);
    try {
      if (reset) await adminFetch('DELETE', `/api/v1/admin/test-metrics/${r.id}`);
      else await adminFetch('PUT', `/api/v1/admin/test-metrics/${r.id}`, { likes: Number(test.likes || 0), views: Number(test.views || 0) });
      toast.success(reset ? '테스트 수치를 지웠어요' : '테스트 수치를 넣었어요');
      setOpen(null);
      fetchRows(1);
    } catch (e: any) {
      toast.error(e?.response?.status === 404 ? '이 서버에서는 테스트 수치를 쓸 수 없어요' : e?.response?.data?.message || '저장하지 못했어요', { duration: 6000 });
    } finally {
      setBusy(false);
    }
  };

  const resetAll = async () => {
    if (!(await adminConfirm('이 서버의 테스트 수치를 전부 지울까요?'))) return;
    try {
      const r = await adminFetch('POST', '/api/v1/admin/test-metrics/reset-all');
      toast.success(`${r.deleted}개 글의 테스트 수치를 지웠어요`);
      fetchRows(1);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || '지우지 못했어요');
    }
  };

  const hasMore = rows.length < total;
  const cols = testOn ? 6 : 5;

  return (
    <div className="space-y-5">
      {/* 서버 환경 — 테스트 수치 가능 여부 */}
      <div className={`adm-op-env ${testOn ? 'test' : ''}`}>
        <span className="adm-op-env-dot" />
        <div className="min-w-0 flex-1">
          <p className="adm-op-env-title">이 서버: {env ? ENV_LABEL[env.appEnv] || env.appEnv : '확인 중'}</p>
          <p className="adm-op-env-sub">
            {testOn
              ? '테스트 좋아요·조회수를 넣을 수 있어요. 실제 수치와 따로 저장되고, 이 서버의 앱 화면 숫자에만 더해져요(인기순 정렬·통계엔 안 들어가요).'
              : '테스트 수치는 개발·스테이징 서버(APP_ENV)에서만 쓸 수 있어요. 운영 서버는 그 API 자체가 막혀 있어요. 여기서는 실제 수치만 보고, 집계 오류만 보정할 수 있어요.'}
          </p>
        </div>
        {testOn && <button type="button" className="adm-btn sm" onClick={resetAll}>테스트 수치 전체 초기화</button>}
      </div>

      <AdminErrorPanel error={lastError} label="반응 수치" />

      <AdminListCard
        filter={<>
          <div className="adm-toolbar">
            <AdminRadioGroup
              value={kind}
              options={[{ value: 'operator', label: '운영 글' }, { value: 'all', label: '게시된 전체 글' }]}
              ariaLabel="글 범위"
              onChange={(k) => { setKind(k); fetchRows(1, { kind: k, q }); }}
            />
            <AdminSearchField className="grow" value={q} onChange={setQ} onSubmit={(q) => { fetchRows(1, { kind, q }); }} placeholder="제목·본문 검색" />
            <span className="adm-count">총 <b><RollingNumber value={total} /></b>개</span>
          </div>
        </>}
      >
        <AdminTableScroll>
          <table className="adm-table">
            <thead>
              <tr>
                <th>글</th>
                <th>좋아요(실제)</th>
                <th>댓글</th>
                <th>조회(실제)</th>
                {testOn && <th>테스트 수치</th>}
                <th className="c" aria-label="동작" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => <tr key={i}><td colSpan={cols}><div className="adm-skel h-[44px]" /></td></tr>)
              ) : rows.length === 0 ? (
                <tr><td colSpan={cols} className="adm-empty">글이 없어요</td></tr>
              ) : rows.flatMap((r) => {
                const types = Object.entries(r.stats.likesByType).filter(([, n]) => n > 0);
                const main = (
                  <tr key={r.id} className={r.status === 'published' && r.isActive ? '' : 'adm-row-off'}>
                    <td className="adm-post">
                      <span className="adm-ev-head">
                        {r.isOperator && <span className="adm-badge">운영</span>}
                        {r.groupName && <span className="adm-badge blue">{r.groupName}</span>}
                        <span className="adm-ev-title">{r.title}</span>
                      </span>
                      <span className="adm-cell-sub">
                        {r.authorName ? `${r.authorName} · ` : ''}{STATUS_LABEL[r.status] || r.status} · {formatKstDateTime(r.createdAt)}
                      </span>
                    </td>
                    <td className="whitespace-nowrap">
                      <span className="adm-cell-main adm-num">{r.stats.likes.toLocaleString()}</span>
                      {types.length > 1 && <span className="adm-cell-sub">{types.map(([t, n]) => `${REACTION_LABEL[t] || t} ${n}`).join(' · ')}</span>}
                    </td>
                    <td className="whitespace-nowrap">
                      <span className="adm-cell-main adm-num">{r.stats.comments.toLocaleString()}</span>
                      {r.stats.replies > 0 && <span className="adm-cell-sub">답글 {r.stats.replies}</span>}
                    </td>
                    <td className="whitespace-nowrap">
                      <span className="adm-cell-main adm-num">{r.stats.views.toLocaleString()}</span>
                      {r.lastCorrection && <span className="adm-cell-sub" title={r.lastCorrection.reason || ''}>보정됨 {formatKstDateTime(r.lastCorrection.at).split(' ').slice(0, 2).join(' ')}</span>}
                    </td>
                    {testOn && (
                      <td className="whitespace-nowrap">
                        {r.test ? <span className="adm-badge orange">♥{r.test.likes.toLocaleString()} · 조회 {r.test.views.toLocaleString()}</span> : <span className="text-[#D1D6DB]">—</span>}
                      </td>
                    )}
                    <td className="c whitespace-nowrap">
                      <span className="inline-flex gap-1.5">
                        <button type="button" className="adm-btn sm" disabled={r.stats.views === 0} onClick={() => openFix(r)} title={r.stats.views === 0 ? '조회수가 0이라 줄일 게 없어요' : undefined}>조회수 보정</button>
                        {testOn && <button type="button" className="adm-btn weak sm" onClick={() => openTest(r)}>테스트 수치</button>}
                      </span>
                    </td>
                  </tr>
                );
                // 패널 줄은 늘 둔다 — 여닫을 때 높이가 부드럽게 늘고 줄도록(접히는 동안엔 마지막 내용이 남는다)
                const isOpen = open?.id === r.id;
                const panel = (
                  <tr key={`${r.id}-panel`} className="adm-op-panel-row">
                    <td colSpan={cols} className="adm-op-panel-cell">
                      <AdminCollapse open={isOpen}>
                        {open?.kind === 'test' ? (
                        <div className="adm-op-panel test">
                          <p className="adm-op-panel-title">테스트 수치 — {ENV_LABEL[env?.appEnv || ''] || ''} 서버 전용</p>
                          <p className="adm-op-hint">실제 수치(좋아요 {r.stats.likes} · 조회 {r.stats.views})는 그대로 두고, 이 서버의 앱 화면 숫자에만 더해져요. 인기순 정렬·추천·통계엔 안 들어가요.</p>
                          <div className="adm-op-panel-fields">
                            <label>
                              <span className="adm-label">테스트 좋아요</span>
                              <input type="number" min={0} value={test.likes} onChange={(e) => setTest({ ...test, likes: e.target.value })} className="adm-input" />
                            </label>
                            <label>
                              <span className="adm-label">테스트 조회수</span>
                              <input type="number" min={0} value={test.views} onChange={(e) => setTest({ ...test, views: e.target.value })} className="adm-input" />
                            </label>
                            <button type="button" className="adm-btn primary" disabled={busy} onClick={() => submitTest(r)}>넣기</button>
                            {r.test && <button type="button" className="adm-btn danger" disabled={busy} onClick={() => submitTest(r, true)}>초기화</button>}
                            <button type="button" className="adm-btn" onClick={() => setOpen(null)}>닫기</button>
                          </div>
                        </div>
                        ) : (
                        <div className="adm-op-panel">
                          <p className="adm-op-panel-title">조회수 보정 — 지금 {r.stats.views.toLocaleString()}</p>
                          <p className="adm-op-hint">중복·봇 집계처럼 잘못 더해진 조회를 빼는 용도예요. 늘리는 보정은 안 돼요(근거가 되는 조회 기록이 없어서). 변경 전후·사유가 변경 이력에 남아요.</p>
                          <div className="adm-op-panel-fields">
                            <label>
                              <span className="adm-label">바꿀 조회수</span>
                              <input type="number" min={0} max={Math.max(0, r.stats.views - 1)} value={fix.value} onChange={(e) => setFix({ ...fix, value: e.target.value })} className="adm-input" />
                            </label>
                            <label className="flex-1">
                              <span className="adm-label">사유(필수, 5자 이상)</span>
                              <input value={fix.reason} maxLength={200} onChange={(e) => setFix({ ...fix, reason: e.target.value })} placeholder="예: 10/3 새로고침 중복 집계 12건 정정" className="adm-input" />
                            </label>
                            <button type="button" className="adm-btn primary" disabled={busy} onClick={() => submitFix(r)}>보정</button>
                            <button type="button" className="adm-btn" onClick={() => setOpen(null)}>닫기</button>
                          </div>
                        </div>
                        )}
                      </AdminCollapse>
                    </td>
                  </tr>
                );
                return [main, panel];
              })}
            </tbody>
          </table>
        </AdminTableScroll>

        <AdminInfiniteScroll
          hasMore={hasMore}
          loading={loadingMore}
          loaded={rows.length}
          total={total}
          onLoadMore={() => {
            if (!hasMore || loading || loadingMore) return;
            fetchRows(page + 1, { kind, q }, true);
          }}
        />
      </AdminListCard>
    </div>
  );
}

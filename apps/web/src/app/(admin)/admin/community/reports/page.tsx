'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { AdminErrorPanel, extractAdminError, type AdminErrorInfo } from '../../_components/ErrorPanel';
import { AdminInfiniteScroll, appendUniqueById } from '../../_components/AdminInfiniteScroll';
import { adminFetch } from '../../_components/adminFetch';
import { useAdminRefresh } from '../../_components/adminRefresh';
import { formatKstDateTime } from '../../_components/adminEvent';
import { AuthorCell, CommunityStats, PostDrawer, ago, notifyCommunityChanged, renameAuthorIn, useNicknameChanged, useNicknameEditor, type CAuthor } from '../../_components/communityAdmin';
import { AdminListCard, AdminTableScroll } from '../../_components/AdminListCard';
import { RollingNumber } from '../../_components/AdminNumber';
import { AdminRadioGroup } from '../../_components/AdminRadioGroup';

interface ReportRow {
  id: string;
  targetType: 'post' | 'comment';
  reason: string;
  detail: string | null;
  status: string;
  createdAt: string;
  reporter: string;
  postId: string | null;
  post: { id: string; title: string; isActive: boolean } | null;
  comment: { id: string; content: string; isActive: boolean } | null;
  targetAuthor: CAuthor | null;
  targetActive: boolean | null;
  sameTargetPending: number;
}

/** 신고 상태 — 서버 값(접수·처리·기각) */
const STATUS: [string, string][] = [
  ['접수', '처리 대기'],
  ['처리', '숨김 처리'],
  ['기각', '그대로 둠'],
  ['all', '전체'],
];
const STATUS_LABEL: Record<string, string> = { 접수: '처리 대기', 처리: '숨김 처리', 기각: '그대로 둠' };

/** 커뮤니티 관리 · 신고 — 숨기기(대상 숨김 + 같은 대상 신고 일괄 처리) / 그대로 두기 */
export default function AdminCommunityReportsPage() {
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [status, setStatus] = useState('접수');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [lastError, setLastError] = useState<AdminErrorInfo | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const LIMIT = 30;
  // 닉네임 바꾸기(작성자 ✎) — 바뀌면 목록에서 이름만 제자리 갱신
  const nick = useNicknameEditor();
  useNicknameChanged((uid, nickname) => setRows((prev) => renameAuthorIn(prev, uid, nickname)));

  const fetchRows = async (p = 1, st = status, append = false) => {
    if (append) setLoadingMore(true);
    else setLoading(true);
    setLastError(null);
    try {
      const params = new URLSearchParams({ page: String(p), limit: String(LIMIT), status: st });
      const data = await adminFetch('GET', `/api/v1/admin/community/reports?${params.toString()}`, undefined, { cache: false });
      const next: ReportRow[] = data.data || [];
      setRows((prev) => (append ? appendUniqueById(prev, next) : next));
      setTotal(data.total || 0);
      setPage(p);
    } catch (e: any) {
      const err = extractAdminError(e);
      setLastError(err);
      toast.error(`신고 목록 로드 실패${err.status ? ` (${err.status})` : ''}: ${err.message}`, { duration: 6000 });
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

  const resolve = async (row: ReportRow, action: 'hide' | 'dismiss') => {
    setBusyId(row.id);
    try {
      await adminFetch('PATCH', `/api/v1/admin/community/reports/${row.id}`, { action });
      toast.success(action === 'hide' ? `${row.targetType === 'comment' ? '댓글' : '글'}을 숨기고 신고를 처리했어요` : '그대로 두고 신고를 닫았어요');
      notifyCommunityChanged();
      // 같은 대상 신고가 함께 처리되니 목록을 새로 받는다
      fetchRows(1);
    } catch {
      toast.error('처리하지 못했어요');
    } finally {
      setBusyId(null);
    }
  };

  const hasMore = rows.length < total;

  return (
    <div className="space-y-5">
      <CommunityStats />

      <AdminErrorPanel error={lastError} label="커뮤니티 신고" />

      <AdminListCard
        filter={<>
          <div className="adm-toolbar">
            <AdminRadioGroup
              value={status}
              options={STATUS.map(([k, label]) => ({ value: k, label }))}
              ariaLabel="신고 상태"
              onChange={(k) => { setStatus(k); fetchRows(1, k); }}
            />
            <span className="grow" />
            <span className="adm-count">총 <b><RollingNumber value={total} /></b>건</span>
          </div>
        </>}
      >
        <AdminTableScroll>
          <table className="adm-table">
            <thead>
              <tr>
                <th>신고된 것</th>
                <th>사유</th>
                <th>작성자</th>
                <th>신고</th>
                <th className="c">처리</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => <tr key={i}><td colSpan={5}><div className="adm-skel h-[44px]" /></td></tr>)
              ) : rows.length === 0 ? (
                <tr><td colSpan={5} className="adm-empty">{status === '접수' ? '처리할 신고가 없어요' : '신고가 없어요'}</td></tr>
              ) : rows.map((r) => {
                const gone = r.targetAuthor == null;
                return (
                  <tr key={r.id}>
                    <td className="adm-cmt">
                      <span className="adm-ev-head">
                        <span className={`adm-badge ${r.targetType === 'comment' ? '' : 'blue'}`}>{r.targetType === 'comment' ? '댓글' : '글'}</span>
                        {r.targetActive === false && <span className="adm-badge">숨김</span>}
                        {gone && <span className="adm-badge">지워짐</span>}
                      </span>
                      {r.targetType === 'comment' ? (
                        <>
                          <span className="adm-cmt-text">{r.comment?.content || '지워진 댓글'}</span>
                          {r.post && <button type="button" className="adm-link-btn sub" onClick={() => setOpenId(r.post!.id)}>{r.post.title}</button>}
                        </>
                      ) : r.post ? (
                        <button type="button" className="adm-link-btn" onClick={() => setOpenId(r.post!.id)}>{r.post.title}</button>
                      ) : (
                        <span className="adm-cmt-text">지워진 글</span>
                      )}
                    </td>
                    <td className="adm-reason">
                      <span className={`adm-badge ${r.status === '접수' ? 'red' : ''}`}>{r.reason}</span>
                      {r.detail && <span className="adm-cell-sub adm-wrap">{r.detail}</span>}
                      {r.sameTargetPending > 1 && <span className="adm-cell-sub">같은 {r.targetType === 'comment' ? '댓글' : '글'} 신고 {r.sameTargetPending}건</span>}
                    </td>
                    <td>{r.targetAuthor ? <AuthorCell a={r.targetAuthor} onRename={nick.open} /> : <span className="text-[#D1D6DB]">—</span>}</td>
                    <td className="whitespace-nowrap">
                      <span className="adm-cell-main">{r.reporter}</span>
                      <span className="adm-cell-sub" title={formatKstDateTime(r.createdAt)}>{ago(r.createdAt)}</span>
                    </td>
                    <td className="c whitespace-nowrap">
                      {r.status === '접수' ? (
                        <span className="inline-flex gap-1.5">
                          <button type="button" className="adm-btn danger sm" disabled={busyId === r.id || gone || r.targetActive === false} onClick={() => resolve(r, 'hide')}>숨기기</button>
                          <button type="button" className="adm-btn sm" disabled={busyId === r.id} onClick={() => resolve(r, 'dismiss')}>그대로 두기</button>
                        </span>
                      ) : (
                        <span className="adm-badge">{STATUS_LABEL[r.status] || r.status}</span>
                      )}
                    </td>
                  </tr>
                );
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
            fetchRows(page + 1, status, true);
          }}
        />
      </AdminListCard>

      {nick.modal}
      {openId && <PostDrawer id={openId} onClose={() => setOpenId(null)} onPostChange={() => fetchRows(1)} />}
    </div>
  );
}

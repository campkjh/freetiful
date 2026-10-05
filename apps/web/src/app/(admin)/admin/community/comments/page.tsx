'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Search } from '@/app/(admin)/admin/_components/admin-icons';
import { AdminErrorPanel, extractAdminError, type AdminErrorInfo } from '../../_components/ErrorPanel';
import { AdminDateFilter, type AdminDateRange } from '../../_components/AdminDateFilter';
import { AdminInfiniteScroll, appendUniqueById } from '../../_components/AdminInfiniteScroll';
import { AdminSwitch } from '../../_components/AdminSwitch';
import { adminFetch } from '../../_components/adminFetch';
import { useAdminRefresh } from '../../_components/adminRefresh';
import { formatKstDateTime } from '../../_components/adminEvent';
import { AuthorCell, CommunityStats, PostDrawer, ago, notifyCommunityChanged, renameAuthorIn, useNicknameChanged, useNicknameEditor, type CAuthor } from '../../_components/communityAdmin';
import { AdminListCard, AdminTableScroll } from '../../_components/AdminListCard';
import { RollingNumber } from '../../_components/AdminNumber';
import { AdminRadioGroup } from '../../_components/AdminRadioGroup';

interface CommentRow {
  id: string;
  content: string;
  isReply: boolean;
  isActive: boolean;
  createdAt: string;
  post: { id: string; title: string; isActive: boolean };
  author: CAuthor;
  likeCount: number;
  reportCount: number;
}

const STATUS: [string, string][] = [
  ['all', '전체'],
  ['visible', '보이는 댓글'],
  ['hidden', '숨긴 댓글'],
  ['reported', '신고된 댓글'],
];

/** 커뮤니티 관리 · 댓글 — 최근 댓글부터, 숨기기 · 원글 열기 */
export default function AdminCommunityCommentsPage() {
  const [rows, setRows] = useState<CommentRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('all');
  const [dateRange, setDateRange] = useState<AdminDateRange>({ startDate: '', endDate: '' });
  const [lastError, setLastError] = useState<AdminErrorInfo | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const LIMIT = 30;
  // 닉네임 바꾸기(작성자 ✎) — 바뀌면 목록에서 이름만 제자리 갱신
  const nick = useNicknameEditor();
  useNicknameChanged((uid, nickname) => setRows((prev) => renameAuthorIn(prev, uid, nickname)));

  const fetchRows = async (p = 1, opts = { q, status, range: dateRange }, append = false) => {
    if (append) setLoadingMore(true);
    else setLoading(true);
    setLastError(null);
    try {
      const params = new URLSearchParams({ page: String(p), limit: String(LIMIT) });
      if (opts.q.trim()) params.set('q', opts.q.trim());
      if (opts.status !== 'all') params.set('status', opts.status);
      if (opts.range.startDate) params.set('startDate', opts.range.startDate);
      if (opts.range.endDate) params.set('endDate', opts.range.endDate);
      const data = await adminFetch('GET', `/api/v1/admin/community/comments?${params.toString()}`, undefined, { cache: false });
      const next: CommentRow[] = data.data || [];
      setRows((prev) => (append ? appendUniqueById(prev, next) : next));
      setTotal(data.total || 0);
      setPage(p);
    } catch (e: any) {
      const err = extractAdminError(e);
      setLastError(err);
      toast.error(`댓글 목록 로드 실패${err.status ? ` (${err.status})` : ''}: ${err.message}`, { duration: 6000 });
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

  const toggle = async (row: CommentRow, isActive: boolean) => {
    setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, isActive, reportCount: isActive ? r.reportCount : 0 } : r)));
    try {
      await adminFetch('PATCH', `/api/v1/admin/community/comments/${row.id}`, { isActive });
      toast.success(isActive ? '다시 보이게 했어요' : '댓글을 숨겼어요');
      notifyCommunityChanged();
    } catch {
      setRows((prev) => prev.map((r) => (r.id === row.id ? row : r)));
      toast.error('바꾸지 못했어요');
    }
  };

  const hasMore = rows.length < total;

  return (
    <div className="space-y-5">
      <CommunityStats />

      <AdminErrorPanel error={lastError} label="커뮤니티 댓글" />

      <AdminListCard
        filter={<>
          <div className="adm-toolbar">
            <label className="adm-search grow">
              <Search size={17} />
              <input
                type="text"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') fetchRows(1, { q, status, range: dateRange }); }}
                placeholder="댓글 내용 검색 (Enter)"
                className="adm-input"
              />
            </label>
            <AdminRadioGroup
              value={status}
              options={STATUS.map(([k, label]) => ({ value: k, label }))}
              ariaLabel="댓글 상태"
              onChange={(k) => { setStatus(k); fetchRows(1, { q, status: k, range: dateRange }); }}
            />
            <span className="adm-count">총 <b><RollingNumber value={total} /></b>개</span>
          </div>
          <AdminDateFilter value={dateRange} onApply={(range) => { setDateRange(range); fetchRows(1, { q, status, range }); }} />
        </>}
      >
        <AdminTableScroll>
          <table className="adm-table">
            <thead>
              <tr>
                <th>댓글</th>
                <th>글</th>
                <th>작성자</th>
                <th>작성일</th>
                <th className="c">노출</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => <tr key={i}><td colSpan={5}><div className="adm-skel h-[44px]" /></td></tr>)
              ) : rows.length === 0 ? (
                <tr><td colSpan={5} className="adm-empty">댓글이 없어요</td></tr>
              ) : rows.map((r) => (
                <tr key={r.id} className={r.isActive ? '' : 'adm-row-off'}>
                  <td className="adm-cmt">
                    <span className="adm-ev-head">
                      {r.isReply && <span className="adm-badge">답글</span>}
                      {r.reportCount > 0 && <span className="adm-badge red">신고 {r.reportCount}</span>}
                    </span>
                    <span className="adm-cmt-text">{r.content}</span>
                    <span className="adm-cell-sub">좋아요 {r.likeCount.toLocaleString()}</span>
                  </td>
                  <td className="adm-cmt-post">
                    <button type="button" className="adm-link-btn" onClick={() => setOpenId(r.post.id)} title="글 열기">
                      {r.post.title}
                    </button>
                    {!r.post.isActive && <span className="adm-cell-sub">숨긴 글</span>}
                  </td>
                  <td><AuthorCell a={r.author} onRename={nick.open} /></td>
                  <td className="whitespace-nowrap">
                    <span className="adm-cell-main adm-num">{formatKstDateTime(r.createdAt)}</span>
                    <span className="adm-cell-sub">{ago(r.createdAt)}</span>
                  </td>
                  <td className="c">
                    <AdminSwitch checked={r.isActive} onChange={(v) => toggle(r, v)} ariaLabel="댓글 노출" />
                  </td>
                </tr>
              ))}
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
            fetchRows(page + 1, { q, status, range: dateRange }, true);
          }}
        />
      </AdminListCard>

      {nick.modal}
      {openId && <PostDrawer id={openId} onClose={() => setOpenId(null)} onPostChange={() => fetchRows(1)} />}
    </div>
  );
}

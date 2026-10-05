'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { AdminErrorPanel, extractAdminError, type AdminErrorInfo } from '../_components/ErrorPanel';
import { AdminDateFilter, type AdminDateRange } from '../_components/AdminDateFilter';
import { AdminInfiniteScroll, appendUniqueById } from '../_components/AdminInfiniteScroll';
import { AdminSwitch } from '../_components/AdminSwitch';
import { adminFetch } from '../_components/adminFetch';
import { useAdminRefresh } from '../_components/adminRefresh';
import { formatKstDateTime } from '../_components/adminEvent';
import { AuthorCell, CommunityStats, POST_TYPE_LABEL, PostDrawer, ago, notifyCommunityChanged, renameAuthorIn, useNicknameChanged, useNicknameEditor, type CAuthor, type CGroup } from '../_components/communityAdmin';
import { AdminListCard, AdminTableScroll } from '../_components/AdminListCard';
import { RollingNumber } from '../_components/AdminNumber';
import { AdminRadioGroup } from '../_components/AdminRadioGroup';
import { AdminSearchField } from '../_components/AdminSearchField';

interface PostRow {
  id: string;
  title: string;
  excerpt: string;
  type: string;
  isActive: boolean;
  createdAt: string;
  group: { id: string | null; name: string | null; parentName: string | null };
  author: CAuthor;
  images: string[];
  imageCount: number;
  likeCount: number;
  commentCount: number;
  viewCount: number;
  reportCount: number;
}

const STATUS: [string, string][] = [
  ['all', '전체'],
  ['visible', '보이는 글'],
  ['hidden', '숨긴 글'],
  ['reported', '신고된 글'],
];

/** 커뮤니티 관리 · 글 — 웨딩숲 글을 찾아 보고 숨기거나 지운다(261004) */
export default function AdminCommunityPostsPage() {
  const [rows, setRows] = useState<PostRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('all');
  const [groupId, setGroupId] = useState('');
  /** 작성 주체 — 회원 글 / 운영 글(운영 프로필) */
  const [kind, setKind] = useState('');
  const [groups, setGroups] = useState<CGroup[]>([]);
  const [dateRange, setDateRange] = useState<AdminDateRange>({ startDate: '', endDate: '' });
  const [lastError, setLastError] = useState<AdminErrorInfo | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const LIMIT = 20;
  // 닉네임 바꾸기(작성자 ✎) — 바뀌면 목록에서 이름만 제자리 갱신
  const nick = useNicknameEditor();
  useNicknameChanged((uid, nickname) => setRows((prev) => renameAuthorIn(prev, uid, nickname)));

  const fetchRows = async (p = 1, opts = { q, status, groupId, range: dateRange, kind }, append = false) => {
    if (append) setLoadingMore(true);
    else setLoading(true);
    setLastError(null);
    try {
      const params = new URLSearchParams({ page: String(p), limit: String(LIMIT) });
      if (opts.q.trim()) params.set('q', opts.q.trim());
      if (opts.status !== 'all') params.set('status', opts.status);
      if (opts.groupId) params.set('groupId', opts.groupId);
      if (opts.kind) params.set('kind', opts.kind);
      if (opts.range.startDate) params.set('startDate', opts.range.startDate);
      if (opts.range.endDate) params.set('endDate', opts.range.endDate);
      const data = await adminFetch('GET', `/api/v1/admin/community/posts?${params.toString()}`, undefined, { cache: false });
      const next: PostRow[] = data.data || [];
      setRows((prev) => (append ? appendUniqueById(prev, next) : next));
      setTotal(data.total || 0);
      setPage(p);
    } catch (e: any) {
      const err = extractAdminError(e);
      setLastError(err);
      toast.error(`글 목록 로드 실패${err.status ? ` (${err.status})` : ''}: ${err.message}`, { duration: 6000 });
    } finally {
      if (append) setLoadingMore(false);
      else setLoading(false);
    }
  };

  useEffect(() => {
    fetchRows(1);
    adminFetch('GET', '/api/v1/admin/community/groups')
      .then((d: { data: CGroup[] }) => setGroups(d.data || []))
      .catch(() => setGroups([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useAdminRefresh(() => fetchRows(1));

  const toggle = async (row: PostRow, isActive: boolean) => {
    setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, isActive } : r)));
    try {
      await adminFetch('PATCH', `/api/v1/admin/community/posts/${row.id}`, { isActive });
      toast.success(isActive ? '다시 보이게 했어요' : '글을 숨겼어요 — 앱에서 안 보여요');
      if (!isActive) setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, reportCount: 0 } : r)));
      notifyCommunityChanged();
    } catch {
      setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, isActive: !isActive } : r)));
      toast.error('바꾸지 못했어요');
    }
  };

  const hasMore = rows.length < total;

  return (
    <div className="space-y-5">
      <CommunityStats />

      <AdminErrorPanel error={lastError} label="커뮤니티 글" />

      <AdminListCard
        filter={<>
          <div className="adm-toolbar">
            <AdminSearchField className="grow" value={q} onChange={setQ} onSubmit={(q) => { fetchRows(1, { q, status, groupId, range: dateRange, kind }); }} placeholder="제목·내용 검색" />
            <AdminRadioGroup
              value={status}
              options={STATUS.map(([k, label]) => ({ value: k, label }))}
              ariaLabel="글 상태"
              onChange={(k) => { setStatus(k); fetchRows(1, { q, status: k, groupId, range: dateRange, kind }); }}
            />
            <select
              value={groupId}
              onChange={(e) => { setGroupId(e.target.value); fetchRows(1, { q, status, groupId: e.target.value, range: dateRange, kind }); }}
              className="adm-input sm adm-select-sm"
              aria-label="카테고리"
            >
              <option value="">모든 카테고리</option>
              {groups.map((g) => (
                <optgroup key={g.id} label={g.name}>
                  <option value={g.id}>{g.name} 전체</option>
                  {g.children.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </optgroup>
              ))}
            </select>
            <select
              value={kind}
              onChange={(e) => { setKind(e.target.value); fetchRows(1, { q, status, groupId, range: dateRange, kind: e.target.value }); }}
              className="adm-input sm adm-select-sm"
              aria-label="작성 주체"
            >
              <option value="">회원 글 + 운영 글</option>
              <option value="member">회원 글만</option>
              <option value="operator">운영 글만</option>
            </select>
            <span className="adm-count">총 <b><RollingNumber value={total} /></b>개</span>
          </div>
          <AdminDateFilter value={dateRange} onApply={(range) => { setDateRange(range); fetchRows(1, { q, status, groupId, range, kind }); }} />
        </>}
      >
        <AdminTableScroll>
          <table className="adm-table">
            <thead>
              <tr>
                <th>글</th>
                <th>작성자</th>
                <th>반응</th>
                <th>작성일</th>
                <th className="c">노출</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => <tr key={i}><td colSpan={5}><div className="adm-skel h-[44px]" /></td></tr>)
              ) : rows.length === 0 ? (
                <tr><td colSpan={5} className="adm-empty">글이 없어요</td></tr>
              ) : rows.map((r) => (
                <tr key={r.id} className={r.isActive ? '' : 'adm-row-off'}>
                  <td className="adm-post">
                    <button type="button" className="adm-post-btn" onClick={() => setOpenId(r.id)}>
                      <span className="adm-post-text">
                        <span className="adm-ev-head">
                          {r.group.name && <span className="adm-badge blue">{r.group.name}</span>}
                          {POST_TYPE_LABEL[r.type] && <span className="adm-badge">{POST_TYPE_LABEL[r.type]}</span>}
                          {r.author.isOperator && <span className="adm-badge orange">운영 글</span>}
                          <span className="adm-ev-title">{r.title}</span>
                          {r.reportCount > 0 && <span className="adm-badge red">신고 {r.reportCount}</span>}
                        </span>
                        {r.excerpt && <span className="adm-post-excerpt">{r.excerpt}</span>}
                      </span>
                      {r.images.length > 0 && (
                        <span className="adm-thumbs">
                          {r.images.map((src) => (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img key={src} src={src} alt="" loading="lazy" />
                          ))}
                          {r.imageCount > r.images.length && <span className="adm-thumbs-more">+{r.imageCount - r.images.length}</span>}
                        </span>
                      )}
                    </button>
                  </td>
                  <td><AuthorCell a={r.author} onRename={nick.open} /></td>
                  <td className="whitespace-nowrap">
                    <span className="adm-cell-main adm-num">댓글 {r.commentCount.toLocaleString()} · 좋아요 {r.likeCount.toLocaleString()}</span>
                    <span className="adm-cell-sub">조회 {r.viewCount.toLocaleString()}</span>
                  </td>
                  <td className="whitespace-nowrap">
                    <span className="adm-cell-main adm-num">{formatKstDateTime(r.createdAt)}</span>
                    <span className="adm-cell-sub">{ago(r.createdAt)}</span>
                  </td>
                  <td className="c">
                    <AdminSwitch checked={r.isActive} onChange={(v) => toggle(r, v)} ariaLabel={`${r.title} 노출`} />
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
            fetchRows(page + 1, { q, status, groupId, range: dateRange, kind }, true);
          }}
        />
      </AdminListCard>

      {nick.modal}
      {openId && (
        <PostDrawer
          id={openId}
          onClose={() => setOpenId(null)}
          onPostChange={(id, patch) => {
            if (!patch) { setRows((prev) => prev.filter((r) => r.id !== id)); setTotal((t) => Math.max(0, t - 1)); }
            else setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
          }}
        />
      )}
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { Search } from '@/app/(admin)/admin/_components/admin-icons';
import { AdminErrorPanel, extractAdminError, type AdminErrorInfo } from '../_components/ErrorPanel';
import { AdminInfiniteScroll, appendUniqueById } from '../_components/AdminInfiniteScroll';
import { adminFetch } from '../_components/adminFetch';
import { useAdminRefresh } from '../_components/adminRefresh';
import { formatKstDateTime } from '../_components/adminEvent';
import { OpAvatar, STATUS_LABEL, STATUS_TONE, type OperatorProfile, type PostStatus, type RealStats } from '../_components/operatorAdmin';
import { adminConfirm } from '../_components/adminDialog';
import { AdminListCard, AdminTableScroll } from '../_components/AdminListCard';
import { RollingNumber } from '../_components/AdminNumber';
import { AdminRadioGroup } from '../_components/AdminRadioGroup';

interface OpPostRow {
  id: string;
  title: string;
  excerpt: string;
  status: PostStatus;
  isActive: boolean;
  publishAt: string | null;
  createdAt: string;
  updatedAt: string;
  group: { id: string | null; name: string | null; parentName: string | null };
  profile: { id: string; nickname: string; avatarUrl: string | null } | null;
  image: string | null;
  imageCount: number;
  stats: RealStats;
  test: { likes: number; views: number } | null;
}

const STATUS_CHIPS: [string, string][] = [
  ['all', '전체'],
  ['published', '게시됨'],
  ['scheduled', '예약'],
  ['draft', '임시저장'],
  ['private', '비공개'],
];

/** 운영 콘텐츠 · 운영 글 — 운영 프로필로 쓴 웨딩숲 글(임시저장·예약·비공개 포함) */
export default function AdminOperatorPostsPage() {
  const [rows, setRows] = useState<OpPostRow[]>([]);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [testOn, setTestOn] = useState(false);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [status, setStatus] = useState('all');
  const [profileId, setProfileId] = useState('');
  const [q, setQ] = useState('');
  const [profiles, setProfiles] = useState<OperatorProfile[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [lastError, setLastError] = useState<AdminErrorInfo | null>(null);
  const LIMIT = 20;

  const fetchRows = async (p = 1, opts = { status, profileId, q }, append = false) => {
    if (append) setLoadingMore(true);
    else setLoading(true);
    setLastError(null);
    try {
      const params = new URLSearchParams({ page: String(p), limit: String(LIMIT) });
      if (opts.status !== 'all') params.set('status', opts.status);
      if (opts.profileId) params.set('profileId', opts.profileId);
      if (opts.q.trim()) params.set('q', opts.q.trim());
      const data = await adminFetch('GET', `/api/v1/admin/operator/posts?${params.toString()}`, undefined, { cache: false });
      const next: OpPostRow[] = data.data || [];
      setRows((prev) => (append ? appendUniqueById(prev, next) : next));
      setTotal(data.total || 0);
      setCounts(data.counts || {});
      setTestOn(!!data.testMetricsEnabled);
      setPage(p);
    } catch (e: any) {
      const err = extractAdminError(e);
      setLastError(err);
      toast.error(`운영 글 로드 실패${err.status ? ` (${err.status})` : ''}: ${err.message}`, { duration: 6000 });
    } finally {
      if (append) setLoadingMore(false);
      else setLoading(false);
    }
  };

  useEffect(() => {
    fetchRows(1);
    adminFetch('GET', '/api/v1/admin/operator/profiles', undefined, { cache: false })
      .then((d) => setProfiles(d.data || []))
      .catch(() => setProfiles([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useAdminRefresh(() => fetchRows(1));

  /** 빠른 동작 — 게시/비공개/예약 취소 */
  const quick = async (row: OpPostRow, action: 'publish' | 'private' | 'unschedule') => {
    const msg = action === 'publish' ? (row.status === 'private' ? '다시 공개할까요?' : '지금 바로 게시할까요? 앱 피드에 바로 올라가요.') : action === 'private' ? '비공개로 바꿀까요? 앱에서 바로 빠져요.' : '예약을 취소하고 임시저장으로 돌릴까요?';
    if (!(await adminConfirm(msg))) return;
    setBusyId(row.id);
    try {
      await adminFetch('PATCH', `/api/v1/admin/operator/posts/${row.id}`, { action });
      toast.success(action === 'publish' ? '게시했어요' : action === 'private' ? '비공개로 바꿨어요' : '예약을 취소했어요');
      fetchRows(1);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || '바꾸지 못했어요');
    } finally {
      setBusyId(null);
    }
  };

  const hasMore = rows.length < total;
  const allCount = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-5">
      <div className="adm-grid grid-cols-2 lg:grid-cols-4">
        <div className="adm-stat">
          <p className="adm-stat-label">게시된 운영 글</p>
          <p className="adm-stat-value"><RollingNumber value={counts.published || 0} /><small>개</small></p>
          <p className="adm-stat-sub">앱에 보이는 중 · 늘 &apos;운영팀&apos; 표시</p>
        </div>
        <div className="adm-stat">
          <p className="adm-stat-label">예약</p>
          <p className="adm-stat-value" style={counts.scheduled ? { color: 'var(--admin-blue)' } : undefined}><RollingNumber value={counts.scheduled || 0} /><small>개</small></p>
          <p className="adm-stat-sub">정한 시각에 1분 안으로 자동 게시</p>
        </div>
        <div className="adm-stat">
          <p className="adm-stat-label">임시저장</p>
          <p className="adm-stat-value"><RollingNumber value={counts.draft || 0} /><small>개</small></p>
          <p className="adm-stat-sub">앱에 안 보여요</p>
        </div>
        <div className="adm-stat">
          <p className="adm-stat-label">운영 프로필</p>
          <p className="adm-stat-value"><RollingNumber value={profiles.filter((p) => p.isActive).length} /><small>개</small></p>
          <p className="adm-stat-sub"><Link href="/admin/operator/profiles" className="adm-inline-link">프로필 관리 ›</Link></p>
        </div>
      </div>

      <AdminErrorPanel error={lastError} label="운영 글" />

      <AdminListCard
        filter={<>
          <div className="adm-toolbar">
            <Link href="/admin/operator/posts/new" className="adm-btn primary">+ 운영 글 쓰기</Link>
            <label className="adm-search grow">
              <Search size={17} />
              <input
                type="text"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') fetchRows(1, { status, profileId, q }); }}
                placeholder="제목·본문 검색 (Enter)"
                className="adm-input"
              />
            </label>
            <select
              value={profileId}
              onChange={(e) => { setProfileId(e.target.value); fetchRows(1, { status, profileId: e.target.value, q }); }}
              className="adm-input sm adm-select-sm"
              aria-label="운영 프로필"
            >
              <option value="">모든 운영 프로필</option>
              {profiles.map((p) => <option key={p.id} value={p.id}>{p.nickname}{p.isActive ? '' : ' (쉬는 중)'}</option>)}
            </select>
          </div>
          <div className="adm-toolbar adm-toolbar-sub">
            <AdminRadioGroup
              value={status}
              options={STATUS_CHIPS.map(([k, label]) => ({ value: k, label, count: <RollingNumber value={k === 'all' ? allCount : counts[k] || 0} /> }))}
              ariaLabel="글 상태"
              onChange={(k) => { setStatus(k); fetchRows(1, { status: k, profileId, q }); }}
            />
            <span className="grow" />
            <span className="adm-count">총 <b><RollingNumber value={total} /></b>개</span>
          </div>
        </>}
      >
        <AdminTableScroll>
          <table className="adm-table">
            <thead>
              <tr>
                <th>글</th>
                <th>운영 프로필</th>
                <th>상태</th>
                <th>실제 반응</th>
                {testOn && <th>테스트 수치</th>}
                <th className="c" aria-label="동작" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => <tr key={i}><td colSpan={testOn ? 6 : 5}><div className="adm-skel h-[44px]" /></td></tr>)
              ) : rows.length === 0 ? (
                <tr><td colSpan={testOn ? 6 : 5} className="adm-empty">{status === 'all' ? '아직 운영 글이 없어요 — 위에서 첫 글을 써 보세요' : '해당 상태의 글이 없어요'}</td></tr>
              ) : rows.map((r) => (
                <tr key={r.id} className={r.status === 'published' && r.isActive ? '' : 'adm-row-off'}>
                  <td className="adm-post">
                    <Link href={`/admin/operator/posts/${r.id}`} className="adm-post-btn">
                      {r.image && (
                        <span className="adm-thumbs">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={r.image} alt="" loading="lazy" />
                        </span>
                      )}
                      <span className="adm-post-text">
                        <span className="adm-ev-head">
                          {r.group.name && <span className="adm-badge blue">{r.group.name}</span>}
                          <span className="adm-ev-title">{r.title}</span>
                        </span>
                        {r.excerpt && <span className="adm-post-excerpt">{r.excerpt}</span>}
                      </span>
                    </Link>
                  </td>
                  <td>
                    {r.profile ? (
                      <span className="adm-author">
                        <OpAvatar src={r.profile.avatarUrl} name={r.profile.nickname} size={30} />
                        <span className="min-w-0">
                          <span className="adm-cell-main">{r.profile.nickname}</span>
                          <span className="adm-cell-sub">운영팀</span>
                        </span>
                      </span>
                    ) : '—'}
                  </td>
                  <td className="whitespace-nowrap">
                    <span className={`adm-badge ${STATUS_TONE[r.status] || ''}`}>{r.status === 'published' && !r.isActive ? '관리자 숨김' : STATUS_LABEL[r.status]}</span>
                    <span className="adm-cell-sub adm-num">
                      {r.status === 'scheduled' ? `${formatKstDateTime(r.publishAt)} 게시` : r.status === 'draft' ? `${formatKstDateTime(r.updatedAt)} 저장` : formatKstDateTime(r.createdAt)}
                    </span>
                  </td>
                  <td className="whitespace-nowrap">
                    {r.status === 'published' || r.status === 'private' ? (
                      <>
                        <span className="adm-cell-main adm-num">좋아요 {r.stats.likes.toLocaleString()} · 댓글 {r.stats.comments.toLocaleString()}</span>
                        <span className="adm-cell-sub">조회 {r.stats.views.toLocaleString()}</span>
                      </>
                    ) : <span className="text-[#D1D6DB]">—</span>}
                  </td>
                  {testOn && (
                    <td className="whitespace-nowrap">
                      {r.test ? <span className="adm-badge orange">테스트 ♥{r.test.likes.toLocaleString()} · 조회 {r.test.views.toLocaleString()}</span> : <span className="text-[#D1D6DB]">—</span>}
                    </td>
                  )}
                  <td className="c whitespace-nowrap">
                    <span className="inline-flex gap-1.5">
                      {(r.status === 'draft' || r.status === 'scheduled' || r.status === 'private') && (
                        <button type="button" className="adm-btn weak sm" disabled={busyId === r.id} onClick={() => quick(r, 'publish')}>{r.status === 'private' ? '다시 공개' : '지금 게시'}</button>
                      )}
                      {r.status === 'published' && <button type="button" className="adm-btn sm" disabled={busyId === r.id} onClick={() => quick(r, 'private')}>비공개</button>}
                      {r.status === 'scheduled' && <button type="button" className="adm-btn sm" disabled={busyId === r.id} onClick={() => quick(r, 'unschedule')}>예약 취소</button>}
                      <Link href={`/admin/operator/posts/${r.id}`} className="adm-btn sm">수정</Link>
                    </span>
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
            fetchRows(page + 1, { status, profileId, q }, true);
          }}
        />
      </AdminListCard>
    </div>
  );
}

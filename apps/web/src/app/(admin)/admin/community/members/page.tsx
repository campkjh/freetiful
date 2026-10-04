'use client';

import { useEffect, useState } from 'react';
import { Search } from '@/app/(admin)/admin/_components/admin-icons';
import { AdminErrorPanel, extractAdminError, type AdminErrorInfo } from '../../_components/ErrorPanel';
import { AdminInfiniteScroll } from '../../_components/AdminInfiniteScroll';
import { adminFetch } from '../../_components/adminFetch';
import { useAdminRefresh } from '../../_components/adminRefresh';
import { formatKstDateTime } from '../../_components/adminEvent';
import { CommunityStats, NICK_SOURCE_LABEL, ago, useNicknameChanged, useNicknameEditor } from '../../_components/communityAdmin';

interface MemberRow {
  userId: string;
  nickname: string;
  autoNickname: string;
  source: 'auto' | 'custom' | 'admin' | 'name';
  realName: string | null;
  role: string;
  avatar: string | null;
  posts: number;
  comments: number;
  lastActiveAt: string | null;
  changedAt: string | null;
}

const ROLE_LABEL: Record<string, string> = { general: '회원', pro: '사회자', business: '업체', admin: '운영자' };
const SOURCES: [string, string][] = [
  ['', '전체'],
  ['custom', '직접 정함'],
  ['admin', '관리자가 바꿈'],
  ['auto', '자동 닉네임'],
  ['name', '실명 표시'],
];

/** 커뮤니티 관리 · 닉네임 — 웨딩숲에 보이는 이름을 훑어보고, 부적절하면 관리자가 바꾼다(261004) */
export default function AdminCommunityMembersPage() {
  const [rows, setRows] = useState<MemberRow[]>([]);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [q, setQ] = useState('');
  const [source, setSource] = useState('');
  const [lastError, setLastError] = useState<AdminErrorInfo | null>(null);
  const LIMIT = 30;

  const fetchRows = async (p = 1, opts = { q, source }, append = false) => {
    if (append) setLoadingMore(true);
    else setLoading(true);
    setLastError(null);
    try {
      const params = new URLSearchParams({ page: String(p), limit: String(LIMIT) });
      if (opts.q.trim()) params.set('q', opts.q.trim());
      if (opts.source) params.set('source', opts.source);
      const data = await adminFetch('GET', `/api/v1/admin/community/members?${params.toString()}`, undefined, { cache: false });
      const next: MemberRow[] = data.data || [];
      setRows((prev) => (append ? [...prev, ...next.filter((n) => !prev.some((x) => x.userId === n.userId))] : next));
      setTotal(data.total || 0);
      setCounts(data.counts || {});
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

  const nick = useNicknameEditor();
  // 바꾸면 출처·이름이 바뀌니 다시 받는다
  useNicknameChanged(() => fetchRows(1));

  const hasMore = rows.length < total;
  const all = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-5">
      <CommunityStats />

      <div className="adm-filter">
        <div className="adm-toolbar">
          <label className="adm-search grow">
            <Search size={17} />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') fetchRows(1, { q, source }); }}
              placeholder="닉네임·실제 이름 검색 (Enter)"
              className="adm-input"
            />
          </label>
          <span className="adm-count">웨딩숲에 글·댓글을 쓴 <b>{all.toLocaleString()}</b>명</span>
        </div>
        <div className="adm-toolbar adm-toolbar-sub">
          <div className="adm-chips">
            {SOURCES.map(([k, label]) => (
              <button key={k || 'all'} type="button" className={`adm-chip ${source === k ? 'on' : ''}`} onClick={() => { setSource(k); fetchRows(1, { q, source: k }); }}>
                {label} <span className="adm-chip-num">{(k ? counts[k] || 0 : all).toLocaleString()}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <p className="adm-note adm-op-rule">
        회원은 원래 &apos;꾸밈말 동물&apos; 닉네임이 자동으로 붙고, 허용된 계정만 직접 정할 수 있어요. 부적절한 닉네임은 <b>✎ 바꾸기</b>로 고치면 예전 글·댓글까지 새 이름으로 보여요. 바꾼 기록은 변경 이력에 남아요.
      </p>

      <AdminErrorPanel error={lastError} label="닉네임" />

      <div className="adm-card flush">
        <div className="overflow-x-auto">
          <table className="adm-table">
            <thead>
              <tr>
                <th>웨딩숲 닉네임</th>
                <th>실제 계정</th>
                <th>활동</th>
                <th className="c" aria-label="동작" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => <tr key={i}><td colSpan={4}><div className="adm-skel h-[44px]" /></td></tr>)
              ) : rows.length === 0 ? (
                <tr><td colSpan={4} className="adm-empty">해당하는 회원이 없어요</td></tr>
              ) : rows.map((r) => (
                <tr key={r.userId}>
                  <td>
                    <span className="adm-author">
                      {r.avatar ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={r.avatar} alt="" className="adm-author-pic" loading="lazy" />
                      ) : (
                        <span className="adm-author-pic none">{r.nickname.slice(0, 1)}</span>
                      )}
                      <span className="min-w-0">
                        <span className="adm-cell-main">{r.nickname}</span>
                        <span className="adm-cell-sub" title={r.source === 'admin' && r.changedAt ? `관리자가 ${formatKstDateTime(r.changedAt)}에 바꿈` : undefined}>
                          <span className={`adm-badge ${r.source === 'admin' ? 'orange' : r.source === 'custom' ? 'blue' : ''}`}>{NICK_SOURCE_LABEL[r.source]}</span>
                          {(r.source === 'custom' || r.source === 'admin') && <> · 원래 {r.autoNickname}</>}
                        </span>
                      </span>
                    </span>
                  </td>
                  <td className="whitespace-nowrap">
                    <span className="adm-cell-main">{r.realName || '—'}</span>
                    <span className="adm-cell-sub">{ROLE_LABEL[r.role] || r.role}</span>
                  </td>
                  <td className="whitespace-nowrap">
                    <span className="adm-cell-main adm-num">글 {r.posts.toLocaleString()} · 댓글 {r.comments.toLocaleString()}</span>
                    <span className="adm-cell-sub">{r.lastActiveAt ? `최근 ${ago(r.lastActiveAt)}` : '활동 없음'}</span>
                  </td>
                  <td className="c">
                    <button type="button" className="adm-btn sm" onClick={() => nick.openId(r.userId)}>✎ 바꾸기</button>
                  </td>
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
          fetchRows(page + 1, { q, source }, true);
        }}
      />

      {nick.modal}
    </div>
  );
}

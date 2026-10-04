'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import toast from 'react-hot-toast';
import { adminFetch } from './adminFetch';
import { useAdminRefresh } from './adminRefresh';
import { AdminSwitch } from './AdminSwitch';
import { formatKstDateTime } from './adminEvent';

/* ────────────────────────────────────────────────────────────
 * 커뮤니티 관리(웨딩숲) 공용 — 요약 숫자 · 작성자 칸 · 글 상세 서랍(261004 사장 '커뮤니티 관리도 추가해줘')
 *  · 숨기기 = 앱 피드·상세·댓글에서 빠짐(되살릴 수 있음) · 글 삭제 = 댓글·반응까지 완전히 지움
 * ──────────────────────────────────────────────────────────── */

export interface CAuthor {
  id: string | null;
  /** 운영 프로필(운영팀) 글·댓글 */
  isOperator?: boolean;
  /** 웨딩숲에 보이는 이름(꾸밈말 동물 · 에디터 이름) */
  nickname: string;
  /** 실제 계정 이름(관리용) */
  realName: string | null;
  role: string | null;
  avatar: string | null;
}

export interface CSummary {
  posts: number;
  postsToday: number;
  hiddenPosts: number;
  comments: number;
  commentsToday: number;
  reportsPending: number;
}

export interface CGroup {
  id: string;
  name: string;
  children: { id: string; name: string }[];
}

interface CPostDetail {
  id: string;
  title: string;
  content: string;
  type: string;
  isActive: boolean;
  createdAt: string;
  group: { id: string | null; name: string | null; parentName: string | null };
  author: CAuthor;
  images: string[];
  likeCount: number;
  viewCount: number;
  poll: { id: string; text: string; votes: number }[];
  comments: { id: string; parentId: string | null; content: string; isActive: boolean; createdAt: string; author: CAuthor; likeCount: number; reportCount: number }[];
  reports: { id: string; targetType: string; commentId: string | null; reason: string; detail: string | null; status: string; createdAt: string; reporter: string }[];
}

const ROLE_LABEL: Record<string, string> = { general: '회원', pro: '사회자', business: '업체', admin: '운영자', operator: '운영팀' };
export const POST_TYPE_LABEL: Record<string, string> = { poll: '투표', quiz: '퀴즈' };

/** '방금 · N분 전 · N시간 전 · N일 전' (7일 넘으면 날짜) */
export function ago(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(diff)) return '';
  const m = Math.floor(diff / 60000);
  if (m < 1) return '방금';
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}일 전`;
  return formatKstDateTime(iso).split(' ').slice(0, 2).join(' ');
}

/** 작성자 — 프사 · 웨딩숲 이름 / 실제 이름 · 역할 */
export function AuthorCell({ a, small = false }: { a: CAuthor; small?: boolean }) {
  const sub = [a.realName && a.realName !== a.nickname ? a.realName : null, a.role ? ROLE_LABEL[a.role] || a.role : null].filter(Boolean).join(' · ');
  return (
    <span className={`adm-author ${small ? 'sm' : ''}`}>
      {a.avatar ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={a.avatar} alt="" className="adm-author-pic" loading="lazy" />
      ) : (
        <span className="adm-author-pic none">{(a.nickname || '?').slice(0, 1)}</span>
      )}
      <span className="min-w-0">
        <span className="adm-cell-main">{a.nickname}</span>
        {sub && <span className="adm-cell-sub">{sub}</span>}
      </span>
    </span>
  );
}

/** 맨 위 숫자 — 세 탭이 같이 쓴다 */
export function CommunityStats() {
  const [s, setS] = useState<CSummary | null>(null);
  const load = useCallback(() => {
    adminFetch('GET', '/api/v1/admin/community/summary', undefined, { cache: false })
      .then((d: CSummary) => setS(d))
      .catch(() => setS(null));
  }, []);
  useEffect(() => { load(); }, [load]);
  useAdminRefresh(load);
  useEffect(() => {
    // 숨기기·신고 처리 뒤 숫자 다시
    window.addEventListener('admin:community-changed', load);
    return () => window.removeEventListener('admin:community-changed', load);
  }, [load]);
  const n = (v?: number) => (s ? (v || 0).toLocaleString() : '—');
  return (
    <div className="adm-grid grid-cols-2 lg:grid-cols-4">
      <div className="adm-stat">
        <p className="adm-stat-label">보이는 글</p>
        <p className="adm-stat-value">{n(s?.posts)}<small>개</small></p>
        <p className="adm-stat-sub">숨긴 글 {n(s?.hiddenPosts)}개</p>
      </div>
      <div className="adm-stat">
        <p className="adm-stat-label">오늘 새 글</p>
        <p className="adm-stat-value">{n(s?.postsToday)}<small>개</small></p>
        <p className="adm-stat-sub">오늘 댓글 {n(s?.commentsToday)}개</p>
      </div>
      <div className="adm-stat">
        <p className="adm-stat-label">댓글</p>
        <p className="adm-stat-value">{n(s?.comments)}<small>개</small></p>
        <p className="adm-stat-sub">보이는 댓글</p>
      </div>
      <div className="adm-stat">
        <p className="adm-stat-label">처리 대기 신고</p>
        <p className="adm-stat-value" style={s?.reportsPending ? { color: 'var(--admin-red)' } : undefined}>{n(s?.reportsPending)}<small>건</small></p>
        <p className="adm-stat-sub">신고 탭에서 숨기거나 그대로 둬요</p>
      </div>
    </div>
  );
}

export const notifyCommunityChanged = () => window.dispatchEvent(new Event('admin:community-changed'));

/* ── 글 상세 서랍(오른쪽) — body 포털(.admin-shell 변수만 다시 깐다) ── */
export function PostDrawer({
  id,
  onClose,
  onPostChange,
}: {
  id: string;
  onClose: () => void;
  /** 노출 바뀜 · 삭제(null) — 목록 줄 갱신용 */
  onPostChange?: (id: string, patch: { isActive: boolean } | null) => void;
}) {
  const [post, setPost] = useState<CPostDetail | null>(null);
  const [error, setError] = useState('');
  const [shown, setShown] = useState(false);
  const [busy, setBusy] = useState(false);
  const closing = useRef(false);

  useEffect(() => {
    let alive = true;
    setPost(null);
    setError('');
    adminFetch('GET', `/api/v1/admin/community/posts/${id}`, undefined, { cache: false })
      .then((d: CPostDetail) => { if (alive) setPost(d); })
      .catch((e: any) => { if (alive) setError(e?.response?.data?.message || e?.message || '글을 불러오지 못했어요'); });
    return () => { alive = false; };
  }, [id]);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setShown(true));
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { cancelAnimationFrame(raf); window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const close = () => {
    if (closing.current) return;
    closing.current = true;
    setShown(false);
    window.setTimeout(onClose, 280);
  };

  const setActive = async (isActive: boolean) => {
    if (!post) return;
    setBusy(true);
    setPost({ ...post, isActive });
    try {
      await adminFetch('PATCH', `/api/v1/admin/community/posts/${post.id}`, { isActive });
      toast.success(isActive ? '다시 보이게 했어요' : '글을 숨겼어요');
      onPostChange?.(post.id, { isActive });
      notifyCommunityChanged();
    } catch {
      setPost((p) => (p ? { ...p, isActive: !isActive } : p));
      toast.error('바꾸지 못했어요 — 다시 시도해 주세요');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!post) return;
    if (!confirm('이 글을 완전히 지울까요?\n댓글·좋아요·투표까지 모두 사라지고 되돌릴 수 없어요.\n잠깐 안 보이게만 하려면 \'노출\'을 끄세요.')) return;
    setBusy(true);
    try {
      await adminFetch('DELETE', `/api/v1/admin/community/posts/${post.id}`);
      toast.success('글을 지웠어요');
      onPostChange?.(post.id, null);
      notifyCommunityChanged();
      close();
    } catch {
      toast.error('지우지 못했어요');
      setBusy(false);
    }
  };

  const setCommentActive = async (cid: string, isActive: boolean) => {
    setPost((p) => (p ? { ...p, comments: p.comments.map((c) => (c.id === cid ? { ...c, isActive } : c)) } : p));
    try {
      await adminFetch('PATCH', `/api/v1/admin/community/comments/${cid}`, { isActive });
      notifyCommunityChanged();
    } catch {
      setPost((p) => (p ? { ...p, comments: p.comments.map((c) => (c.id === cid ? { ...c, isActive: !isActive } : c)) } : p));
      toast.error('바꾸지 못했어요');
    }
  };

  const totalVotes = post?.poll.reduce((a, o) => a + o.votes, 0) || 0;
  const postReports = post?.reports.filter((r) => r.targetType !== 'comment') || [];

  const drawer = (
    <div className={`admin-shell adm-pd-root ${shown ? 'on' : ''}`} role="dialog" aria-modal="true" aria-label="글 상세">
      <button type="button" className="adm-pd-dim" aria-label="닫기" onClick={close} />
      <aside className="adm-pd">
        <header className="adm-pd-head">
          <button type="button" className="adm-pd-back" onClick={close} aria-label="닫기">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M15 5.5 8.5 12l6.5 6.5" stroke="#191F28" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
          <p className="adm-pd-title">글 상세</p>
          {post && (
            <div className="adm-pd-actions">
              <AdminSwitch checked={post.isActive} disabled={busy} onChange={setActive} label="노출" ariaLabel="노출" labelClassName="adm-pd-switch-label" />
              <button type="button" className="adm-btn danger sm" onClick={remove} disabled={busy}>삭제</button>
            </div>
          )}
        </header>

        <div className="adm-pd-body">
          {error ? (
            <p className="adm-empty">{error}</p>
          ) : !post ? (
            <div className="space-y-3 p-1">
              <div className="adm-skel h-[22px] w-2/3" />
              <div className="adm-skel h-[48px]" />
              <div className="adm-skel h-[120px]" />
            </div>
          ) : (
            <>
              {!post.isActive && <p className="adm-pd-note">숨긴 글이에요 — 앱에서는 보이지 않아요</p>}
              <div className="adm-pd-tags">
                {post.group.name && <span className="adm-badge blue">{post.group.parentName ? `${post.group.parentName} · ` : ''}{post.group.name}</span>}
                {POST_TYPE_LABEL[post.type] && <span className="adm-badge">{POST_TYPE_LABEL[post.type]}</span>}
              </div>
              <h3 className="adm-pd-h">{post.title}</h3>
              <div className="adm-pd-author">
                <AuthorCell a={post.author} />
                <span className="adm-pd-time">{formatKstDateTime(post.createdAt)}</span>
              </div>
              <p className="adm-pd-text">{post.content}</p>
              {post.images.length > 0 && (
                <div className="adm-pd-imgs">
                  {post.images.map((src) => (
                    <a key={src} href={src} target="_blank" rel="noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={src} alt="" loading="lazy" />
                    </a>
                  ))}
                </div>
              )}
              {post.poll.length > 0 && (
                <div className="adm-pd-poll">
                  {post.poll.map((o) => {
                    const pct = totalVotes ? Math.round((o.votes / totalVotes) * 100) : 0;
                    return (
                      <div key={o.id} className="adm-pd-poll-row">
                        <span className="adm-pd-poll-bar" style={{ width: `${pct}%` }} />
                        <span className="adm-pd-poll-text">{o.text}</span>
                        <span className="adm-pd-poll-num">{o.votes}표 · {pct}%</span>
                      </div>
                    );
                  })}
                </div>
              )}
              <p className="adm-pd-meta">좋아요 {post.likeCount.toLocaleString()} · 댓글 {post.comments.filter((c) => c.isActive).length.toLocaleString()} · 조회 {post.viewCount.toLocaleString()}</p>

              {postReports.length > 0 && (
                <section className="adm-pd-sec">
                  <p className="adm-pd-sec-title">이 글 신고 {postReports.length}건</p>
                  {postReports.map((r) => (
                    <div key={r.id} className="adm-pd-report">
                      <span className={`adm-badge ${r.status === '접수' ? 'red' : ''}`}>{r.reason}</span>
                      <span className="min-w-0 flex-1 truncate">{r.detail || '자세한 내용 없음'}</span>
                      <span className="adm-pd-time">{r.reporter} · {ago(r.createdAt)}</span>
                    </div>
                  ))}
                </section>
              )}

              <section className="adm-pd-sec">
                <p className="adm-pd-sec-title">댓글 {post.comments.length}개</p>
                {post.comments.length === 0 ? (
                  <p className="adm-pd-empty">아직 댓글이 없어요</p>
                ) : (
                  post.comments.map((c) => (
                    <div key={c.id} className={`adm-pd-cmt ${c.parentId ? 'reply' : ''} ${c.isActive ? '' : 'off'}`}>
                      <div className="adm-pd-cmt-top">
                        <AuthorCell a={c.author} small />
                        <span className="adm-pd-time">{ago(c.createdAt)}</span>
                        <AdminSwitch checked={c.isActive} onChange={(v) => setCommentActive(c.id, v)} ariaLabel="댓글 노출" />
                      </div>
                      <p className="adm-pd-cmt-text">{c.content}</p>
                      {c.reportCount > 0 && <span className="adm-badge red">신고 {c.reportCount}</span>}
                    </div>
                  ))
                )}
              </section>
            </>
          )}
        </div>
      </aside>
    </div>
  );

  return typeof document === 'undefined' ? null : createPortal(drawer, document.body);
}

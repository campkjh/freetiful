'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { AdminErrorPanel, extractAdminError, type AdminErrorInfo } from '../../_components/ErrorPanel';
import { AdminSwitch } from '../../_components/AdminSwitch';
import { adminFetch } from '../../_components/adminFetch';
import { useAdminRefresh } from '../../_components/adminRefresh';
import { formatKstDateTime } from '../../_components/adminEvent';
import { OpAvatar, uploadAdminImage, type OperatorProfile } from '../../_components/operatorAdmin';

type Draft = { nickname: string; avatarUrl: string | null; bio: string };
const EMPTY: Draft = { nickname: '', avatarUrl: null, bio: '' };

/** 이름·사진·소개 입력 칸(만들기·고치기 같이 씀) */
function ProfileFields({ draft, setDraft }: { draft: Draft; setDraft: (d: Draft) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const pick = async (files: FileList | null) => {
    const f = files?.[0];
    if (!f) return;
    setUploading(true);
    try {
      setDraft({ ...draft, avatarUrl: await uploadAdminImage(f) });
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || '사진을 올리지 못했어요');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };
  return (
    <div className="adm-op-pf">
      <button type="button" className="adm-op-pf-pic" onClick={() => fileRef.current?.click()} disabled={uploading} aria-label="프로필 사진 올리기">
        <OpAvatar src={draft.avatarUrl} name={draft.nickname || '운영팀'} size={64} />
        <span>{uploading ? '올리는 중' : draft.avatarUrl ? '사진 바꾸기' : '사진 올리기'}</span>
      </button>
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => pick(e.target.files)} />
      <div className="min-w-0 flex-1 space-y-3">
        <div>
          <label className="adm-label">이름 <span className="adm-op-count">2~16자 · 회원·예비부부·사회자처럼 보이는 말, &apos;꾸밈말 동물&apos; 모양은 안 돼요</span></label>
          <input value={draft.nickname} maxLength={16} onChange={(e) => setDraft({ ...draft, nickname: e.target.value })} placeholder="예: 웨딩숲 운영팀" className="adm-input" />
        </div>
        <div>
          <label className="adm-label">소개 <span className="adm-op-count">{draft.bio.length}/120 · 운영 글 상세에 보여요</span></label>
          <input value={draft.bio} maxLength={120} onChange={(e) => setDraft({ ...draft, bio: e.target.value })} placeholder="예: 결혼 준비에 필요한 정보를 모아 드려요" className="adm-input" />
        </div>
        {draft.avatarUrl && (
          <button type="button" className="adm-link-btn sub" onClick={() => setDraft({ ...draft, avatarUrl: null })}>사진 빼기</button>
        )}
      </div>
    </div>
  );
}

/** 운영 콘텐츠 · 운영 프로필 — 운영팀 이름(전용 계정) 만들기·고치기·쉬게 하기 */
export default function AdminOperatorProfilesPage() {
  const [rows, setRows] = useState<OperatorProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastError, setLastError] = useState<AdminErrorInfo | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [editId, setEditId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Draft>(EMPTY);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    setLastError(null);
    try {
      const d = await adminFetch('GET', '/api/v1/admin/operator/profiles', undefined, { cache: false });
      setRows(d.data || []);
    } catch (e: any) {
      setLastError(extractAdminError(e));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);
  useAdminRefresh(load);

  const create = async () => {
    if (!draft.nickname.trim()) { toast.error('이름을 넣어 주세요'); return; }
    setBusy(true);
    try {
      await adminFetch('POST', '/api/v1/admin/operator/profiles', { nickname: draft.nickname, avatarUrl: draft.avatarUrl, bio: draft.bio });
      toast.success('운영 프로필을 만들었어요');
      setDraft(EMPTY);
      setCreateOpen(false);
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || '만들지 못했어요', { duration: 6000 });
    } finally {
      setBusy(false);
    }
  };

  const saveEdit = async (row: OperatorProfile) => {
    setBusy(true);
    try {
      const res = await adminFetch('PATCH', `/api/v1/admin/operator/profiles/${row.id}`, { nickname: editDraft.nickname, avatarUrl: editDraft.avatarUrl, bio: editDraft.bio });
      toast.success(res.changed?.length ? '저장했어요' : '바뀐 내용이 없어요');
      setEditId(null);
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || '저장하지 못했어요', { duration: 6000 });
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async (row: OperatorProfile, isActive: boolean) => {
    if (!isActive && !confirm(`'${row.nickname}' 프로필을 쉬게 할까요?\n새 글을 쓸 수 없게 될 뿐, 이미 올린 글은 그대로 보여요.`)) return;
    setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, isActive } : r)));
    try {
      await adminFetch('PATCH', `/api/v1/admin/operator/profiles/${row.id}`, { isActive });
    } catch (e: any) {
      setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, isActive: !isActive } : r)));
      toast.error(e?.response?.data?.message || '바꾸지 못했어요');
    }
  };

  return (
    <div className="space-y-5">
      <div className="adm-filter">
        <div className="adm-toolbar">
          <button type="button" className={`adm-btn ${createOpen ? 'weak' : 'primary'}`} onClick={() => setCreateOpen((v) => !v)}>
            {createOpen ? '만들기 닫기' : '+ 운영 프로필 만들기'}
          </button>
          <span className="grow" />
          <span className="adm-count">총 <b>{rows.length}</b>개 · 사용 중 <b>{rows.filter((r) => r.isActive).length}</b></span>
        </div>
      </div>

      <p className="adm-note adm-op-rule">
        운영 프로필은 회원 계정을 빌리지 않는 운영팀 전용 이름이에요. 앱에서는 이 이름의 글·댓글에 늘 <b>&apos;운영팀&apos;</b> 표시가 붙고, 회원이 실제로 좋아요·댓글을 남길 수 있어요.
      </p>

      {createOpen && (
        <div className="adm-card adm-form">
          <div className="adm-card-head">
            <div>
              <h2 className="adm-card-title">새 운영 프로필</h2>
              <p className="adm-card-sub">만든 기록(관리자·시각·값)은 변경 이력에 남아요</p>
            </div>
            <button type="button" className="adm-btn primary" disabled={busy} onClick={create}>{busy ? '만드는 중' : '만들기'}</button>
          </div>
          <ProfileFields draft={draft} setDraft={setDraft} />
        </div>
      )}

      <AdminErrorPanel error={lastError} label="운영 프로필" />

      <div className="adm-card flush">
        <div className="overflow-x-auto">
          <table className="adm-table">
            <thead>
              <tr>
                <th>운영 프로필</th>
                <th>글</th>
                <th>마지막 게시</th>
                <th className="c">사용</th>
                <th className="c" aria-label="동작" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => <tr key={i}><td colSpan={5}><div className="adm-skel h-[44px]" /></td></tr>)
              ) : rows.length === 0 ? (
                <tr><td colSpan={5} className="adm-empty">아직 운영 프로필이 없어요</td></tr>
              ) : rows.map((r) => (
                editId === r.id ? (
                  <tr key={r.id}>
                    <td colSpan={5}>
                      <ProfileFields draft={editDraft} setDraft={setEditDraft} />
                      <p className="adm-op-hint mt-2">이름·사진을 바꿔도 이미 앱에 올라간 글·댓글은 그때 이름으로 남아요(임시저장·예약 글은 새 이름으로 올라가요).</p>
                      <div className="mt-3 flex gap-2">
                        <button type="button" className="adm-btn primary sm" disabled={busy} onClick={() => saveEdit(r)}>저장</button>
                        <button type="button" className="adm-btn sm" onClick={() => setEditId(null)}>취소</button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <tr key={r.id} className={r.isActive ? '' : 'adm-row-off'}>
                    <td>
                      <span className="adm-author adm-op-who">
                        <OpAvatar src={r.avatarUrl} name={r.nickname} size={40} />
                        <span className="min-w-0">
                          <span className="adm-cell-main">{r.nickname} <span className="adm-badge">운영팀</span></span>
                          <span className="adm-cell-sub">{r.bio || '소개 없음'}</span>
                        </span>
                      </span>
                    </td>
                    <td className="whitespace-nowrap">
                      <span className="adm-cell-main adm-num">게시 {r.posts.published.toLocaleString()}</span>
                      <span className="adm-cell-sub">예약 {r.posts.scheduled} · 임시 {r.posts.draft} · 비공개 {r.posts.private}</span>
                    </td>
                    <td className="whitespace-nowrap">
                      <span className="adm-cell-main adm-num">{r.lastPostAt ? formatKstDateTime(r.lastPostAt) : '—'}</span>
                      <span className="adm-cell-sub">만든 날 {formatKstDateTime(r.createdAt).split(' ').slice(0, 2).join(' ')}</span>
                    </td>
                    <td className="c"><AdminSwitch checked={r.isActive} onChange={(v) => toggleActive(r, v)} ariaLabel={`${r.nickname} 사용`} /></td>
                    <td className="c whitespace-nowrap">
                      <span className="inline-flex gap-1.5">
                        <Link href={`/admin/operator/posts/new`} className="adm-btn weak sm" onClick={(e) => { if (!r.isActive) { e.preventDefault(); toast.error('쉬는 프로필로는 글을 쓸 수 없어요'); } }}>글 쓰기</Link>
                        <button type="button" className="adm-btn sm" onClick={() => { setEditId(r.id); setEditDraft({ nickname: r.nickname, avatarUrl: r.avatarUrl, bio: r.bio || '' }); }}>수정</button>
                      </span>
                    </td>
                  </tr>
                )
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

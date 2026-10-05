'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { adminFetch } from '../../../_components/adminFetch';
import { formatKstDateTime } from '../../../_components/adminEvent';
import type { CGroup } from '../../../_components/communityAdmin';
import {
  OpAvatar,
  REACTION_LABEL,
  STATUS_LABEL,
  STATUS_TONE,
  isoToKstLocal,
  kstLocalToIso,
  uploadAdminImage,
  useOperatorEnv,
  type OperatorProfile,
  type PostStatus,
  type RealStats,
} from '../../../_components/operatorAdmin';
import { adminConfirm } from '../../../_components/adminDialog';

interface LoadedPost {
  id: string;
  profileId: string;
  groupId: string;
  title: string;
  content: string;
  imageUrls: string[];
  status: PostStatus;
  isActive: boolean;
  publishAt: string | null;
  createdAt: string;
  updatedAt: string;
  stats: RealStats;
  test: { likes: number; views: number } | null;
}

type Form = { profileId: string; groupId: string; title: string; content: string; imageUrls: string[] };
const EMPTY: Form = { profileId: '', groupId: '', title: '', content: '', imageUrls: [] };
const MAX_IMAGES = 5;

/** 다음 정각 + 1시간(KST) — 예약 기본값 */
function defaultScheduleLocal() {
  const t = new Date(Date.now() + 9 * 3600000);
  t.setUTCMinutes(0, 0, 0);
  t.setUTCHours(t.getUTCHours() + 2);
  return t.toISOString().slice(0, 16);
}

/** 운영 글 쓰기·고치기 — /admin/operator/posts/new · /admin/operator/posts/:id */
export default function AdminOperatorPostEditPage({ params }: { params: { id: string } }) {
  const isNew = params.id === 'new';
  const router = useRouter();
  const env = useOperatorEnv();
  const [profiles, setProfiles] = useState<OperatorProfile[]>([]);
  const [groups, setGroups] = useState<CGroup[]>([]);
  const [loaded, setLoaded] = useState<LoadedPost | null>(null);
  const [form, setForm] = useState<Form>(EMPTY);
  const [mode, setMode] = useState<'publish' | 'schedule' | 'draft'>('publish');
  const [scheduleAt, setScheduleAt] = useState(defaultScheduleLocal());
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(!isNew);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    adminFetch('GET', '/api/v1/admin/operator/profiles', undefined, { cache: false })
      .then((d) => {
        const list: OperatorProfile[] = d.data || [];
        setProfiles(list);
        if (isNew) setForm((f) => (f.profileId ? f : { ...f, profileId: list.find((p) => p.isActive)?.id || '' }));
      })
      .catch(() => toast.error('운영 프로필을 불러오지 못했어요'));
    adminFetch('GET', '/api/v1/admin/community/groups')
      .then((d) => setGroups(d.data || []))
      .catch(() => toast.error('카테고리를 불러오지 못했어요'));
    if (!isNew) {
      adminFetch('GET', `/api/v1/admin/operator/posts/${params.id}`, undefined, { cache: false })
        .then((p: LoadedPost) => {
          setLoaded(p);
          setForm({ profileId: p.profileId, groupId: p.groupId, title: p.title, content: p.content, imageUrls: p.imageUrls });
          if (p.publishAt) setScheduleAt(isoToKstLocal(p.publishAt));
        })
        .catch((e) => toast.error(e?.response?.data?.message || '글을 불러오지 못했어요'))
        .finally(() => setLoading(false));
    }
  }, [isNew, params.id]);

  const dirty = useMemo(() => {
    if (isNew) return !!(form.title || form.content || form.imageUrls.length);
    if (!loaded) return false;
    return (
      form.profileId !== loaded.profileId ||
      form.groupId !== loaded.groupId ||
      form.title !== loaded.title ||
      form.content !== loaded.content ||
      JSON.stringify(form.imageUrls) !== JSON.stringify(loaded.imageUrls)
    );
  }, [form, loaded, isNew]);

  // 저장 안 한 채 나가면 묻기
  useEffect(() => {
    const onBefore = (e: BeforeUnloadEvent) => {
      if (!dirty) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBefore);
    return () => window.removeEventListener('beforeunload', onBefore);
  }, [dirty]);

  const profile = profiles.find((p) => p.id === form.profileId) || null;
  const groupName = useMemo(() => {
    for (const g of groups) for (const c of g.children) if (c.id === form.groupId) return c.name;
    return '';
  }, [groups, form.groupId]);
  const status = loaded?.status;
  const locked = status === 'published' || status === 'private';

  const addImages = async (files: FileList | null) => {
    if (!files?.length) return;
    const room = MAX_IMAGES - form.imageUrls.length;
    if (room <= 0) { toast.error(`사진은 ${MAX_IMAGES}장까지예요`); return; }
    setUploading(true);
    try {
      const urls: string[] = [];
      for (const f of Array.from(files).slice(0, room)) urls.push(await uploadAdminImage(f));
      setForm((prev) => ({ ...prev, imageUrls: [...prev.imageUrls, ...urls].slice(0, MAX_IMAGES) }));
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || '사진을 올리지 못했어요');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const check = () => {
    if (!form.profileId) return '운영 프로필을 골라 주세요';
    if (!form.groupId) return '카테고리를 골라 주세요';
    if (!form.title.trim()) return '제목을 입력해 주세요';
    if (!form.content.trim() && !form.imageUrls.length) return '본문이나 사진을 넣어 주세요';
    return null;
  };

  const create = async () => {
    const problem = check();
    if (problem) { toast.error(problem); return; }
    if (mode === 'publish' && !(await adminConfirm(`'${profile?.nickname}' 이름으로 지금 게시할까요?\n앱 웨딩숲 피드에 바로 올라가고 '운영팀' 표시가 붙어요.`))) return;
    setBusy(true);
    try {
      const res = await adminFetch('POST', '/api/v1/admin/operator/posts', {
        ...form,
        mode,
        publishAt: mode === 'schedule' ? kstLocalToIso(scheduleAt) : undefined,
        reason: reason.trim() || undefined,
      });
      toast.success(mode === 'publish' ? '게시했어요' : mode === 'schedule' ? '예약했어요' : '임시저장했어요');
      setForm(EMPTY);
      router.replace(`/admin/operator/posts/${res.id}`);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || '저장하지 못했어요', { duration: 6000 });
    } finally {
      setBusy(false);
    }
  };

  const update = async (action: 'save' | 'publish' | 'schedule' | 'unschedule' | 'private') => {
    if (!loaded) return;
    const problem = check();
    if (problem) { toast.error(problem); return; }
    const ask: Record<string, string> = {
      publish: status === 'private' ? '다시 공개할까요?' : '지금 게시할까요? 앱 피드에 바로 올라가요.',
      private: '비공개로 바꿀까요? 앱에서 바로 빠져요(좋아요·댓글은 그대로 남아요).',
      unschedule: '예약을 취소하고 임시저장으로 돌릴까요?',
    };
    if (ask[action] && !(await adminConfirm(ask[action]))) return;
    setBusy(true);
    try {
      const body: any = { action, reason: reason.trim() || undefined };
      if (form.title !== loaded.title) body.title = form.title;
      if (form.content !== loaded.content) body.content = form.content;
      if (form.groupId !== loaded.groupId) body.groupId = form.groupId;
      if (form.profileId !== loaded.profileId) body.profileId = form.profileId;
      if (JSON.stringify(form.imageUrls) !== JSON.stringify(loaded.imageUrls)) body.imageUrls = form.imageUrls;
      if (action === 'schedule') body.publishAt = kstLocalToIso(scheduleAt);
      const res = await adminFetch('PATCH', `/api/v1/admin/operator/posts/${loaded.id}`, body);
      if (!res.changed?.length) toast('바뀐 내용이 없어요');
      else toast.success(action === 'publish' ? '게시했어요' : action === 'schedule' ? '예약했어요' : action === 'unschedule' ? '예약을 취소했어요' : action === 'private' ? '비공개로 바꿨어요' : '저장했어요');
      const fresh: LoadedPost = await adminFetch('GET', `/api/v1/admin/operator/posts/${loaded.id}`, undefined, { cache: false });
      setLoaded(fresh);
      setForm({ profileId: fresh.profileId, groupId: fresh.groupId, title: fresh.title, content: fresh.content, imageUrls: fresh.imageUrls });
      setReason('');
    } catch (e: any) {
      toast.error(e?.response?.data?.message || '저장하지 못했어요', { duration: 6000 });
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!loaded) return;
    if (!(await adminConfirm('이 운영 글을 완전히 지울까요?\n댓글·좋아요까지 사라지고 되돌릴 수 없어요. 잠깐 내리려면 \'비공개\'를 쓰세요.'))) return;
    setBusy(true);
    try {
      await adminFetch('DELETE', `/api/v1/admin/operator/posts/${loaded.id}${reason.trim() ? `?reason=${encodeURIComponent(reason.trim())}` : ''}`);
      toast.success('지웠어요');
      router.replace('/admin/operator');
    } catch (e: any) {
      toast.error(e?.response?.data?.message || '지우지 못했어요');
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="adm-skel h-[40px] w-1/3" />
        <div className="adm-skel h-[420px]" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="adm-op-top">
        <Link href="/admin/operator" className="adm-op-back">‹ 운영 글</Link>
        <h2 className="adm-op-title">{isNew ? '새 운영 글' : '운영 글 수정'}</h2>
        {status && <span className={`adm-badge ${STATUS_TONE[status] || ''}`}>{status === 'published' && !loaded?.isActive ? '관리자 숨김' : STATUS_LABEL[status]}</span>}
        {status === 'scheduled' && loaded?.publishAt && <span className="adm-op-when">{formatKstDateTime(loaded.publishAt)} 게시 예정</span>}
        {dirty && <span className="adm-op-dirty">저장 안 한 변경 있음</span>}
      </div>

      <div className="adm-op-grid">
        {/* 왼쪽 — 글 */}
        <div className="adm-card adm-op-form">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="adm-label">운영 프로필</label>
              <select
                value={form.profileId}
                onChange={(e) => setForm({ ...form, profileId: e.target.value })}
                disabled={locked}
                className="adm-input"
                title={locked ? '이미 게시한 글은 쓴 프로필을 바꿀 수 없어요' : undefined}
              >
                <option value="">프로필 선택</option>
                {profiles.filter((p) => p.isActive || p.id === form.profileId).map((p) => <option key={p.id} value={p.id}>{p.nickname}{p.isActive ? '' : ' (쉬는 중)'}</option>)}
              </select>
              {profiles.length === 0 && <p className="adm-op-hint">먼저 <Link href="/admin/operator/profiles" className="adm-inline-link">운영 프로필</Link>을 만들어 주세요</p>}
            </div>
            <div>
              <label className="adm-label">카테고리</label>
              <select value={form.groupId} onChange={(e) => setForm({ ...form, groupId: e.target.value })} className="adm-input">
                <option value="">카테고리 선택</option>
                {groups.map((g) => (
                  <optgroup key={g.id} label={g.name}>
                    {g.children.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </optgroup>
                ))}
              </select>
            </div>
          </div>
          <div className="mt-4">
            <label className="adm-label">제목 <span className="adm-op-count">{form.title.length}/120</span></label>
            <input value={form.title} maxLength={120} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="제목" className="adm-input adm-op-title-input" />
          </div>
          <div className="mt-4">
            <label className="adm-label">본문 <span className="adm-op-count">{form.content.length.toLocaleString()}/10,000</span></label>
            <textarea
              value={form.content}
              maxLength={10000}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
              placeholder="웨딩숲 회원에게 보일 본문"
              rows={12}
              className="adm-input adm-textarea adm-op-body"
            />
          </div>
          <div className="mt-4">
            <label className="adm-label">사진 <span className="adm-op-count">{form.imageUrls.length}/{MAX_IMAGES}</span></label>
            <div className="adm-op-imgs">
              {form.imageUrls.map((src, i) => (
                <span key={src + i} className="adm-op-img">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt="" />
                  <button type="button" aria-label="사진 빼기" onClick={() => setForm({ ...form, imageUrls: form.imageUrls.filter((_, k) => k !== i) })}>×</button>
                </span>
              ))}
              {form.imageUrls.length < MAX_IMAGES && (
                <button type="button" className="adm-op-img-add" onClick={() => fileRef.current?.click()} disabled={uploading}>
                  {uploading ? '올리는 중…' : '+ 사진'}
                </button>
              )}
              <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => addImages(e.target.files)} />
            </div>
          </div>
        </div>

        {/* 오른쪽 — 게시 · 미리보기 · 반응 */}
        <div className="space-y-4">
          <div className="adm-card">
            <p className="adm-card-title">게시</p>
            {isNew ? (
              <>
                <div className="adm-seg mt-3" role="tablist">
                  {(['publish', 'schedule', 'draft'] as const).map((m) => (
                    <button key={m} type="button" role="tab" aria-selected={mode === m} className={mode === m ? 'on' : ''} onClick={() => setMode(m)}>
                      {m === 'publish' ? '지금 게시' : m === 'schedule' ? '예약' : '임시저장'}
                    </button>
                  ))}
                </div>
                {mode === 'schedule' && (
                  <div className="mt-3">
                    <label className="adm-label">게시 시각(한국 시간)</label>
                    <input type="datetime-local" value={scheduleAt} onChange={(e) => setScheduleAt(e.target.value)} className="adm-input" />
                  </div>
                )}
                <p className="adm-op-hint mt-3">
                  {mode === 'publish' ? "누르면 바로 앱 피드 맨 위에 올라가요." : mode === 'schedule' ? '정한 시각부터 1분 안에 자동으로 올라가요. 그 전엔 앱에 안 보여요.' : '앱에 안 보이게 저장만 해요.'}
                </p>
              </>
            ) : (
              <p className="adm-op-hint mt-2">
                {status === 'published' ? '앱에 보이는 중이에요. 고친 내용은 저장하면 바로 반영돼요.' : status === 'private' ? '비공개 — 앱에서 빠져 있어요.' : status === 'scheduled' ? '예약 — 시각이 되면 자동으로 올라가요.' : '임시저장 — 앱에 안 보여요.'}
                {loaded && (status === 'published' || status === 'private') && <> · {formatKstDateTime(loaded.createdAt)} 게시</>}
              </p>
            )}
            {!isNew && (status === 'draft' || status === 'scheduled') && (
              <div className="mt-3">
                <label className="adm-label">예약 시각(한국 시간)</label>
                <input type="datetime-local" value={scheduleAt} onChange={(e) => setScheduleAt(e.target.value)} className="adm-input" />
              </div>
            )}
            <div className="mt-3">
              <label className="adm-label">메모 <span className="adm-op-count">변경 이력에 사유로 남아요(선택)</span></label>
              <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} placeholder="예: 10월 웨딩홀 투어 안내" className="adm-input" />
            </div>
            <div className="adm-op-actions">
              {isNew ? (
                <button type="button" className="adm-btn primary adm-op-main" disabled={busy || uploading} onClick={create}>
                  {busy ? '저장 중' : mode === 'publish' ? '게시하기' : mode === 'schedule' ? '예약하기' : '임시저장'}
                </button>
              ) : (
                <>
                  <button type="button" className="adm-btn primary adm-op-main" disabled={busy || uploading || !dirty} onClick={() => update('save')}>{busy ? '저장 중' : '저장'}</button>
                  {(status === 'draft' || status === 'scheduled') && <button type="button" className="adm-btn weak" disabled={busy} onClick={() => update('publish')}>지금 게시</button>}
                  {(status === 'draft' || status === 'scheduled') && <button type="button" className="adm-btn" disabled={busy} onClick={() => update('schedule')}>{status === 'scheduled' ? '예약 시각 바꾸기' : '예약하기'}</button>}
                  {status === 'scheduled' && <button type="button" className="adm-btn" disabled={busy} onClick={() => update('unschedule')}>예약 취소</button>}
                  {status === 'published' && <button type="button" className="adm-btn" disabled={busy} onClick={() => update(loaded?.isActive ? 'private' : 'publish')}>{loaded?.isActive ? '비공개로' : '다시 보이게'}</button>}
                  {status === 'private' && <button type="button" className="adm-btn weak" disabled={busy} onClick={() => update('publish')}>다시 공개</button>}
                  <button type="button" className="adm-btn danger" disabled={busy} onClick={remove}>삭제</button>
                </>
              )}
            </div>
          </div>

          {/* 앱에서 보이는 모습(작성자 줄) */}
          <div className="adm-card">
            <p className="adm-card-title">앱에서 이렇게 보여요</p>
            <div className="adm-op-preview">
              <div className="adm-op-preview-side">
                <OpAvatar src={profile?.avatarUrl} name={profile?.nickname || '운영팀'} size={40} />
                <span className="adm-op-preview-role">운영팀</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="adm-op-preview-name">{profile?.nickname || '운영 프로필'}</p>
                <p className="adm-op-preview-meta">{groupName || '카테고리'} · 방금</p>
                <p className="adm-op-preview-title">{form.title || '제목'}</p>
                <p className="adm-op-preview-body">{form.content || '본문'}</p>
              </div>
            </div>
            {profile?.bio && <p className="adm-op-hint mt-2">글 상세에 소개도 보여요: “{profile.bio}”</p>}
          </div>

          {loaded && (status === 'published' || status === 'private') && (
            <div className="adm-card">
              <p className="adm-card-title">실제 반응</p>
              <div className="adm-op-stats">
                <span><b>{loaded.stats.likes.toLocaleString()}</b>좋아요</span>
                <span><b>{loaded.stats.comments.toLocaleString()}</b>댓글</span>
                <span><b>{loaded.stats.views.toLocaleString()}</b>조회</span>
              </div>
              {loaded.stats.likes > 0 && (
                <p className="adm-op-hint mt-2">
                  {Object.entries(loaded.stats.likesByType).filter(([, n]) => n > 0).map(([t, n]) => `${REACTION_LABEL[t] || t} ${n}`).join(' · ')}
                  {loaded.stats.replies > 0 && ` · 답글 ${loaded.stats.replies}`}
                </p>
              )}
              {env?.testMetricsEnabled && loaded.test && <p className="adm-op-hint mt-1">테스트 수치(이 서버에서만): 좋아요 +{loaded.test.likes} · 조회 +{loaded.test.views}</p>}
              <p className="adm-op-hint mt-1"><Link href="/admin/operator/metrics" className="adm-inline-link">반응 수치에서 자세히 ›</Link></p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

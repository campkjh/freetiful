'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Archive, ExternalLink, RefreshCw, Save, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { adminFetch } from '../../_components/adminFetch';
import { AdminErrorPanel, extractAdminError, type AdminErrorInfo } from '../../_components/ErrorPanel';

const ROLES = ['general', 'pro', 'business', 'admin'];
const PAYMENT_STATUSES = ['pending', 'completed', 'failed', 'refunded', 'escrowed', 'settled'];
const QUOTATION_STATUSES = ['pending', 'accepted', 'paid', 'cancelled', 'refunded', 'expired'];
const MATCH_STATUSES = ['open', 'matched', 'cancelled', 'expired'];
const SETTING_FIELDS = ['chatPush', 'bookingPush', 'paymentPush', 'reviewPush', 'systemPush', 'marketingPush', 'marketingSms', 'marketingEmail'];

function dateText(v?: string | null) {
  if (!v) return '-';
  return new Date(v).toLocaleString('ko-KR', { dateStyle: 'short', timeStyle: 'short' });
}

function money(v?: number | null) {
  return `${Number(v || 0).toLocaleString()}원`;
}

function Section({ title, right, children }: { title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-3">
        <h2 className="text-sm font-extrabold text-gray-900">{title}</h2>
        <div className="ml-auto">{right}</div>
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function MiniButton({ children, onClick, tone = 'gray' }: { children: React.ReactNode; onClick: () => void; tone?: 'gray' | 'red' | 'blue' }) {
  const cls = tone === 'red'
    ? 'bg-red-50 text-red-600 hover:bg-red-100'
    : tone === 'blue'
      ? 'bg-blue-50 text-blue-600 hover:bg-blue-100'
      : 'bg-gray-100 text-gray-600 hover:bg-gray-200';
  return <button onClick={onClick} className={`px-2.5 py-1.5 rounded-lg text-xs font-bold ${cls}`}>{children}</button>;
}

function StatusSelect({ value, options, onChange }: { value: string; options: string[]; onChange: (value: string) => void }) {
  return (
    <select
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      className="h-8 rounded-lg border border-gray-200 px-2 text-xs font-semibold text-gray-700 bg-white"
    >
      {options.map((option) => <option key={option} value={option}>{option}</option>)}
    </select>
  );
}

export default function AdminUserDetailPage() {
  const params = useParams();
  const router = useRouter();
  const userId = params?.id as string;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastError, setLastError] = useState<AdminErrorInfo | null>(null);
  const [payload, setPayload] = useState<any>(null);
  const [form, setForm] = useState<any>({});
  const user = payload?.user;
  const relations = payload?.relations || {};

  const counts = useMemo(() => user?._count || {}, [user]);

  const load = async () => {
    if (!userId) return;
    setLoading(true);
    setLastError(null);
    try {
      const data = await adminFetch('GET', `/api/v1/admin/users/${userId}`);
      setPayload(data);
      setForm({
        name: data.user?.name || '',
        email: data.user?.email || '',
        phone: data.user?.phone || '',
        role: data.user?.role || 'general',
        profileImageUrl: data.user?.profileImageUrl || '',
        isActive: !!data.user?.isActive,
        isBanned: !!data.user?.isBanned,
        banReason: data.user?.banReason || '',
        pointBalance: data.user?.pointBalance || 0,
        referralCode: data.user?.referralCode || '',
        notificationSettings: data.user?.notificationSettings || {},
      });
    } catch (e: any) {
      const err = extractAdminError(e);
      setLastError(err);
      toast.error(`유저 상세 로드 실패: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [userId]);

  const save = async () => {
    setSaving(true);
    try {
      const data = await adminFetch('PATCH', `/api/v1/admin/users/${userId}`, form);
      setPayload(data);
      toast.success('유저 설정이 저장되었습니다');
    } catch (e: any) {
      toast.error(`저장 실패: ${e?.response?.data?.message || e?.message || ''}`);
    } finally {
      setSaving(false);
    }
  };

  const run = async (label: string, method: string, path: string, body?: any, confirmText?: string) => {
    if (confirmText && !confirm(confirmText)) return;
    try {
      await adminFetch(method, path, body);
      toast.success(label);
      await load();
    } catch (e: any) {
      toast.error(`${label} 실패: ${e?.response?.data?.message || e?.message || ''}`, { duration: 6000 });
    }
  };

  const hardDeleteUser = async () => {
    if (!confirm(`${form.name} 계정을 완전히 삭제할까요? 연관 데이터가 있으면 실패할 수 있습니다.`)) return;
    try {
      await adminFetch('DELETE', `/api/v1/admin/users/${userId}`);
      toast.success('유저가 삭제되었습니다');
      router.push('/admin/users');
    } catch (e: any) {
      toast.error(`삭제 실패: ${e?.response?.data?.message || e?.message || ''}`, { duration: 6000 });
    }
  };

  if (loading) {
    return <div className="py-20 text-center text-sm text-gray-400">유저 데이터를 불러오는 중...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="p-2 rounded-lg hover:bg-gray-100"><ArrowLeft size={18} /></button>
        <div>
          <h1 className="text-xl font-extrabold text-gray-900">유저 상세 · 관계 데이터</h1>
          <p className="text-xs text-gray-400 mt-0.5">{user?.id}</p>
        </div>
        <button onClick={load} className="ml-auto p-2 rounded-lg hover:bg-gray-100"><RefreshCw size={16} /></button>
      </div>

      <AdminErrorPanel error={lastError} label="유저 상세" />

      <div className="grid gap-4 md:grid-cols-4">
        {[
          ['찜', counts.favorites],
          ['채팅', counts.chatRooms],
          ['매칭요청', counts.matchRequests],
          ['리뷰', counts.reviews],
        ].map(([label, value]) => (
          <div key={label} className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-xs text-gray-400 font-bold">{label}</p>
            <p className="mt-1 text-2xl font-extrabold text-gray-900">{Number(value || 0).toLocaleString()}</p>
          </div>
        ))}
      </div>

      <Section
        title="유저 기본 설정"
        right={
          <div className="flex gap-2">
            <button onClick={save} disabled={saving} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-600 text-white text-xs font-bold disabled:opacity-50">
              <Save size={14} /> 저장
            </button>
            <MiniButton tone="gray" onClick={() => run('보관처리 완료', 'PATCH', `/api/v1/admin/users/${userId}/archive`, {}, `${form.name} 계정을 보관처리할까요?`)}><Archive size={13} className="inline mr-1" />보관</MiniButton>
            <MiniButton tone="red" onClick={hardDeleteUser}><Trash2 size={13} className="inline mr-1" />삭제</MiniButton>
          </div>
        }
      >
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="이름" value={form.name} onChange={(v) => setForm((f: any) => ({ ...f, name: v }))} />
          <Field label="이메일" value={form.email} onChange={(v) => setForm((f: any) => ({ ...f, email: v }))} />
          <Field label="전화번호" value={form.phone} onChange={(v) => setForm((f: any) => ({ ...f, phone: v }))} />
          <Field label="프로필 이미지 URL" value={form.profileImageUrl} onChange={(v) => setForm((f: any) => ({ ...f, profileImageUrl: v }))} />
          <Field label="포인트 잔액" type="number" value={form.pointBalance} onChange={(v) => setForm((f: any) => ({ ...f, pointBalance: Number(v) || 0 }))} />
          <Field label="추천 코드" value={form.referralCode} onChange={(v) => setForm((f: any) => ({ ...f, referralCode: v }))} />
          <div>
            <label className="block text-xs font-bold text-gray-400 mb-1">권한</label>
            <select value={form.role} onChange={(e) => setForm((f: any) => ({ ...f, role: e.target.value }))} className="w-full h-10 rounded-lg border border-gray-200 px-3 text-sm">
              {ROLES.map((role) => <option key={role} value={role}>{role}</option>)}
            </select>
          </div>
          <Field label="차단 사유" value={form.banReason} onChange={(v) => setForm((f: any) => ({ ...f, banReason: v }))} />
        </div>
        <div className="mt-4 flex flex-wrap gap-4">
          <CheckField label="활성 계정" checked={form.isActive} onChange={(v) => setForm((f: any) => ({ ...f, isActive: v }))} />
          <CheckField label="차단 계정" checked={form.isBanned} onChange={(v) => setForm((f: any) => ({ ...f, isBanned: v }))} />
          {SETTING_FIELDS.map((field) => (
            <CheckField
              key={field}
              label={field}
              checked={!!form.notificationSettings?.[field]}
              onChange={(v) => setForm((f: any) => ({ ...f, notificationSettings: { ...(f.notificationSettings || {}), [field]: v } }))}
            />
          ))}
        </div>
      </Section>

      {user?.proProfile && (
        <Section title="연결된 사회자 프로필">
          <div className="flex items-start gap-4">
            <img src={user.proProfile.images?.[0]?.imageUrl || user.profileImageUrl || '/images/default-profile.svg'} alt="" className="w-20 h-20 rounded-xl object-cover bg-gray-100" />
            <div className="flex-1">
              <p className="text-sm font-extrabold text-gray-900">{user.name}</p>
              <p className="text-xs text-gray-500 mt-1">상태 {user.proProfile.status} · 리뷰 {user.proProfile._count?.reviews || 0} · 견적 {user.proProfile._count?.quotations || 0} · 채팅 {user.proProfile._count?.chatRooms || 0}</p>
              <p className="text-xs text-gray-500 mt-1 line-clamp-2">{user.proProfile.shortIntro || '소개 없음'}</p>
              <div className="mt-3 flex gap-2">
                <Link href={`/admin/pros/${user.proProfile.id}/edit`} className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-blue-50 text-blue-600 text-xs font-bold">
                  사회자 수정 <ExternalLink size={12} />
                </Link>
                <Link href={`/pros/${user.proProfile.id}`} target="_blank" className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-gray-100 text-gray-600 text-xs font-bold">
                  공개페이지 <ExternalLink size={12} />
                </Link>
              </div>
            </div>
          </div>
        </Section>
      )}

      <Section title={`찜 목록 (${relations.favorites?.length || 0})`}>
        <div className="space-y-2">
          {(relations.favorites || []).map((fav: any) => (
            <Row key={fav.id} title={`${fav.targetType} · ${fav.target?.user?.name || fav.target?.businessName || fav.targetId}`} meta={dateText(fav.createdAt)}>
              <MiniButton tone="red" onClick={() => run('찜 삭제 완료', 'DELETE', `/api/v1/admin/favorites/${fav.id}`, undefined, '이 찜 데이터를 삭제할까요?')}>삭제</MiniButton>
            </Row>
          ))}
        </div>
      </Section>

      <Section title={`채팅방 (${relations.chatRooms?.length || 0})`}>
        <div className="space-y-2">
          {(relations.chatRooms || []).map((room: any) => (
            <Row key={room.id} title={room.proProfile?.user?.name || room.id} meta={`메시지 ${room._count?.messages || 0} · 견적 ${room._count?.quotations || 0} · ${dateText(room.lastMessageAt || room.createdAt)}`}>
              <MiniButton tone="red" onClick={() => run('채팅방 숨김 처리 완료', 'DELETE', `/api/v1/admin/chat-rooms/${room.id}`, undefined, '양쪽 채팅 목록에서 이 채팅방을 숨김 처리할까요?')}>숨김</MiniButton>
            </Row>
          ))}
        </div>
      </Section>

      <EditableList
        title={`견적 (${relations.quotations?.length || 0})`}
        items={relations.quotations || []}
        render={(q: any) => (
          <Row key={q.id} title={`${q.proProfile?.user?.name || '사회자'} · ${money(q.amount)}`} meta={`${q.title || '제목 없음'} · ${dateText(q.createdAt)}`}>
            <StatusSelect value={q.status} options={QUOTATION_STATUSES} onChange={(status) => run('견적 상태 변경 완료', 'PATCH', `/api/v1/admin/quotations/${q.id}`, { status })} />
            <MiniButton tone="red" onClick={() => run('견적 삭제 완료', 'DELETE', `/api/v1/admin/quotations/${q.id}`, undefined, '견적을 삭제할까요?')}>삭제</MiniButton>
          </Row>
        )}
      />

      <EditableList
        title={`결제 (${relations.payments?.length || 0})`}
        items={relations.payments || []}
        render={(p: any) => (
          <Row key={p.id} title={`${p.proProfile?.user?.name || '사회자'} · ${money(p.amount)}`} meta={`${p.method || 'method 없음'} · 스케줄 ${p.schedules?.length || 0} · ${dateText(p.createdAt)}`}>
            <StatusSelect value={p.status} options={PAYMENT_STATUSES} onChange={(status) => run('결제 상태 변경 완료', 'PATCH', `/api/v1/admin/payments/${p.id}`, { status })} />
            <MiniButton tone="red" onClick={() => run('결제 삭제 완료', 'DELETE', `/api/v1/admin/payments/${p.id}`, undefined, '결제와 연결 리뷰를 삭제하고 견적/스케줄 연결을 해제할까요?')}>삭제</MiniButton>
          </Row>
        )}
      />

      <EditableList
        title={`매칭 요청 (${relations.matchRequests?.length || 0})`}
        items={relations.matchRequests || []}
        render={(m: any) => (
          <Row key={m.id} title={`${m.category?.name || '카테고리'} · ${m.eventLocation || '장소 없음'}`} meta={`전달 ${m.deliveries?.length || 0}건 · ${dateText(m.createdAt)}`}>
            <StatusSelect value={m.status} options={MATCH_STATUSES} onChange={(status) => run('매칭 요청 변경 완료', 'PATCH', `/api/v1/admin/match-requests/${m.id}`, { status })} />
            <MiniButton tone="red" onClick={() => run('매칭 요청 삭제 완료', 'DELETE', `/api/v1/admin/match-requests/${m.id}`, undefined, '매칭 요청과 전달 내역을 삭제할까요?')}>삭제</MiniButton>
          </Row>
        )}
      />

      <Section title={`알림 (${relations.notifications?.length || 0})`}>
        <div className="space-y-2">
          {(relations.notifications || []).map((n: any) => (
            <Row key={n.id} title={`${n.title || n.type} ${n.isRead ? '' : '· 안읽음'}`} meta={`${n.body || ''} · ${dateText(n.createdAt)}`}>
              <MiniButton tone="blue" onClick={() => run('알림 상태 변경 완료', 'PATCH', `/api/v1/admin/notifications/${n.id}`, { isRead: !n.isRead })}>{n.isRead ? '안읽음' : '읽음'}</MiniButton>
              <MiniButton tone="red" onClick={() => run('알림 삭제 완료', 'DELETE', `/api/v1/admin/notifications/${n.id}`, undefined, '알림을 삭제할까요?')}>삭제</MiniButton>
            </Row>
          ))}
        </div>
      </Section>

      <Section title={`작성 리뷰 (${relations.reviews?.length || 0})`}>
        <div className="space-y-2">
          {(relations.reviews || []).map((r: any) => (
            <Row key={r.id} title={`${r.proProfile?.user?.name || '사회자'} · ${Number(r.avgRating || 0).toFixed(1)}점`} meta={`${r.comment || '내용 없음'} · ${dateText(r.createdAt)}`}>
              <MiniButton tone="red" onClick={() => run('리뷰 삭제 완료', 'DELETE', `/api/v1/admin/reviews/${r.id}`, undefined, '리뷰를 삭제할까요?')}>삭제</MiniButton>
            </Row>
          ))}
        </div>
      </Section>
    </div>
  );
}

function Field({ label, value, onChange, type = 'text' }: { label: string; value: any; onChange: (v: string) => void; type?: string }) {
  return (
    <div>
      <label className="block text-xs font-bold text-gray-400 mb-1">{label}</label>
      <input value={value || ''} type={type} onChange={(e) => onChange(e.target.value)} className="w-full h-10 rounded-lg border border-gray-200 px-3 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-blue-100" />
    </div>
  );
}

function CheckField({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="inline-flex items-center gap-2 text-xs font-semibold text-gray-600">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="w-4 h-4" />
      {label}
    </label>
  );
}

function Row({ title, meta, children }: { title: string; meta?: string; children?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50 px-3 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-gray-900 truncate">{title}</p>
        {meta && <p className="text-xs text-gray-500 truncate mt-0.5">{meta}</p>}
      </div>
      <div className="flex items-center gap-2 shrink-0">{children}</div>
    </div>
  );
}

function EditableList({ title, items, render }: { title: string; items: any[]; render: (item: any) => React.ReactNode }) {
  return (
    <Section title={title}>
      {items.length === 0 ? <p className="text-sm text-gray-400">데이터가 없습니다</p> : <div className="space-y-2">{items.map(render)}</div>}
    </Section>
  );
}

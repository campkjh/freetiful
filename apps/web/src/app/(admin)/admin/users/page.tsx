'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, Search, ChevronLeft, ChevronRight, Trash2, RefreshCw, AlertTriangle, Archive } from 'lucide-react';
import toast from 'react-hot-toast';
import { AdminErrorPanel, extractAdminError, type AdminErrorInfo } from '../_components/ErrorPanel';
import { AdminDateFilter, type AdminDateRange } from '../_components/AdminDateFilter';
import { adminFetch } from '../_components/adminFetch';

interface UserItem {
  id: string;
  name: string;
  email: string;
  role: string;
  profileImageUrl: string | null;
  createdAt: string;
  paymentCount: number;
  proProfile: null | {
    id: string;
    status: 'draft' | 'pending' | 'approved' | 'rejected' | 'suspended';
    hasIntro: boolean;
    imageCount: number;
    serviceCount: number;
    isEmpty: boolean;
  };
}

const roleColors: Record<string, string> = {
  general: 'bg-gray-100 text-gray-600',
  user: 'bg-gray-100 text-gray-600',
  pro: 'bg-blue-50 text-blue-600',
  business: 'bg-violet-50 text-violet-600',
  admin: 'bg-red-50 text-red-600',
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState('전체');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [lastError, setLastError] = useState<AdminErrorInfo | null>(null);
  const [dateRange, setDateRange] = useState<AdminDateRange>({ startDate: '', endDate: '' });
  const LIMIT = 20;

  const fetchUsers = async (p = page, s = search, r = filterRole, range = dateRange) => {
    setLoading(true);
    setLastError(null);
    try {
      const params: any = { page: p, limit: LIMIT };
      if (s) params.search = s;
      if (r !== '전체') params.role = r;
      if (range.startDate) params.startDate = range.startDate;
      if (range.endDate) params.endDate = range.endDate;
      const data = await adminFetch('GET', `/api/v1/admin/users?${new URLSearchParams(params).toString()}`);
      setUsers(data.data || []);
      setTotal(data.total || 0);
    } catch (e: any) {
      const err = extractAdminError(e);
      setLastError(err);
      toast.error(`유저 목록 로드 실패${err.status ? ` (${err.status})` : ''}: ${err.message}`, { duration: 6000 });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleRoleChange = async (id: string, role: string) => {
    if (!confirm(`권한을 ${role}로 변경하시겠습니까?`)) return;
    try {
      await adminFetch('PATCH', `/api/v1/admin/users/${id}/role`, { role });
      toast.success('권한이 변경되었습니다');
      setUsers((prev) => prev.map((u) => u.id === id ? { ...u, role } : u));
    } catch { toast.error('변경 실패'); }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`${name}님을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`)) return;
    try {
      await adminFetch('DELETE', `/api/v1/admin/users/${id}`);
      toast.success('삭제되었습니다');
      setUsers((prev) => prev.filter((u) => u.id !== id));
      setTotal((t) => t - 1);
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || '';
      toast.error(`삭제 실패: ${msg} — 연관 데이터(채팅/결제/메시지 등)가 있으면 "보관처리" 를 사용해주세요`, { duration: 8000 });
    }
  };

  // 중복 진단 섹션
  const [diagOpen, setDiagOpen] = useState(false);
  const [diagQuery, setDiagQuery] = useState('');
  const [diagResult, setDiagResult] = useState<any[]>([]);
  const [diagLoading, setDiagLoading] = useState(false);

  const runDiag = async () => {
    if (!diagQuery.trim()) { toast.error('이메일 또는 이름을 입력하세요'); return; }
    setDiagLoading(true);
    try {
      const data = await adminFetch('GET', `/api/v1/admin/users/diagnose?email=${encodeURIComponent(diagQuery.trim())}`);
      setDiagResult(Array.isArray(data) ? data : []);
    } catch (e: any) {
      toast.error(`진단 실패: ${e?.response?.data?.message || e?.message || ''}`);
    } finally {
      setDiagLoading(false);
    }
  };

  const handleArchive = async (userId: string, name: string) => {
    if (!confirm(`${name}님 계정을 보관처리하시겠습니까? email 이 archived-... 로 변경되고 isActive=false 됩니다. 연관 데이터는 유지됩니다.`)) return;
    try {
      await adminFetch('PATCH', `/api/v1/admin/users/${userId}/archive`);
      toast.success('보관처리되었습니다');
      runDiag();
      fetchUsers();
    } catch (e: any) {
      toast.error(`보관처리 실패: ${e?.response?.data?.message || e?.message || ''}`);
    }
  };

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 px-1">
        <Link href="/admin" className="admin-icon-button flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#6B7684] shadow-[0_6px_16px_rgba(2,32,71,0.04)] hover:bg-[#F2F4F6]">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <p className="text-[12px] font-bold text-[#3182F6]">회원 운영</p>
          <h1 className="mt-1 text-[24px] font-black text-[#191F28] tracking-tight">유저 관리</h1>
        </div>
        <span className="ml-auto rounded-full bg-white px-3 py-1.5 text-[12px] font-bold text-[#6B7684] shadow-[0_6px_16px_rgba(2,32,71,0.04)]">총 {total.toLocaleString()}명</span>
        <button
          onClick={() => fetchUsers(page, search, filterRole, dateRange)}
          disabled={loading}
          className="admin-icon-button flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#6B7684] shadow-[0_6px_16px_rgba(2,32,71,0.04)] hover:bg-[#F2F4F6] disabled:opacity-50"
          title="새로고침"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

        <AdminErrorPanel error={lastError} label="유저 목록" />

        {/* 중복 진단 섹션 */}
        <div className="admin-card-soft border-amber-200/70 bg-amber-50/80 p-4">
          <button onClick={() => setDiagOpen((v) => !v)} className="flex items-center gap-2 text-sm font-bold text-amber-800 w-full text-left">
            <AlertTriangle size={16} />
            중복 유저 진단 (같은 이메일/이름으로 여러 계정이 있는지 확인)
            <span className="ml-auto text-xs text-amber-600">{diagOpen ? '닫기' : '열기'}</span>
          </button>
          {diagOpen && (
            <div className="mt-4 space-y-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={diagQuery}
                  onChange={(e) => setDiagQuery(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') runDiag(); }}
                  placeholder="이메일 일부 또는 이름 (예: campkjh, 김정훈)"
                  className="flex-1 h-10 border border-amber-300 rounded-lg px-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-200"
                />
                <button onClick={runDiag} disabled={diagLoading} className="px-4 h-10 rounded-lg bg-amber-600 text-white text-sm font-medium hover:bg-amber-700 disabled:opacity-50">
                  {diagLoading ? '검색 중' : '진단'}
                </button>
              </div>
              {diagResult.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs text-amber-700">{diagResult.length}개 계정 발견. 데이터가 많은 쪽을 남기고 빈 쪽을 "보관처리" 하세요.</p>
                  {diagResult.map((u) => (
                    <div key={u.id} className="bg-white rounded-lg border border-amber-200 p-3 text-xs">
                      <div className="flex items-start gap-3">
                        <img
                          src={u.profileImageUrl || '/images/default-profile.svg'}
                          alt={u.name}
                          className="w-10 h-10 rounded-full object-cover bg-gray-100 shrink-0"
                          onError={(e) => { (e.target as HTMLImageElement).src = '/images/default-profile.svg'; }}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-bold text-gray-900">{u.name}</span>
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${u.isActive ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-400'}`}>{u.isActive ? 'active' : 'inactive'}</span>
                            <span className="text-gray-400">· {u.role}</span>
                          </div>
                          <p className="text-gray-600 break-all">📧 {u.email || '(이메일 없음)'}</p>
                          <p className="text-gray-600">📱 {u.phone || '(전화 없음)'}</p>
                          <p className="text-gray-500 mt-1">
                            가입일: {new Date(u.createdAt).toLocaleDateString('ko-KR')} ·
                            Auth: {u.authProviders?.map((a: any) => a.provider).join(', ') || 'none'}
                          </p>
                          {u.proProfile ? (
                            <div className="mt-2 p-2 bg-blue-50 rounded">
                              <p className="font-bold text-blue-700">프로프로필 [{u.proProfile.status}]</p>
                              <p className="text-blue-600">
                                사진 {u.proProfile._count.images} · 서비스 {u.proProfile._count.services} ·
                                리뷰 {u.proProfile._count.reviews} · 견적 {u.proProfile._count.quotations} ·
                                점수 {u.proProfileScore}
                              </p>
                              <p className="text-blue-600 truncate">{u.proProfile.shortIntro || '(소개 없음)'}</p>
                            </div>
                          ) : (
                            <p className="mt-2 text-gray-400">프로프로필 없음</p>
                          )}
                          <p className="text-gray-500 mt-1">
                            채팅방 {u._count.chatRooms} · 보낸메시지 {u._count.sentMessages} · 작성리뷰 {u._count.reviews}
                          </p>
                        </div>
                        <div className="flex flex-col gap-1 shrink-0">
                          {u.proProfile && (
                            <a
                              href={`/admin/pros/${u.proProfile.id}/edit`}
                              className="px-2 py-1 rounded bg-blue-50 text-blue-600 text-[11px] font-medium hover:bg-blue-100"
                            >
                              수정
                            </a>
                          )}
                          <button
                            onClick={() => handleArchive(u.id, u.name)}
                            className="flex items-center gap-1 px-2 py-1 rounded bg-gray-100 text-gray-700 text-[11px] font-medium hover:bg-gray-200"
                          >
                            <Archive size={11} /> 보관
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {!diagLoading && diagResult.length === 0 && diagQuery && (
                <p className="text-xs text-amber-700">검색 결과 없음. 이메일 일부만 입력해보세요 (예: campkjh)</p>
              )}
            </div>
          )}
        </div>

        <div className="admin-toolbar p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { setPage(1); fetchUsers(1, search, filterRole, dateRange); } }}
                placeholder="이름 또는 이메일 검색 (Enter)"
                className="h-11 w-full rounded-2xl border border-[#E5E8EB] bg-[#F7F8FA] pl-9 pr-4 text-sm font-semibold text-[#191F28] placeholder:text-[#B0B8C1] focus:outline-none"
              />
            </div>
            <div className="flex gap-2">
              {['전체', 'general', 'pro', 'business', 'admin'].map((r) => (
                <button
                  key={r}
                  onClick={() => { setFilterRole(r); setPage(1); fetchUsers(1, search, r, dateRange); }}
                  className={`admin-chip px-3.5 text-sm ${filterRole === r ? 'bg-[#191F28] text-white shadow-[0_8px_18px_rgba(25,31,40,0.14)]' : 'bg-[#F2F4F6] text-[#6B7684] hover:bg-[#E5E8EB] hover:text-[#191F28]'}`}
                >
                  {r === '전체' ? '전체' : r === 'general' ? '일반' : r === 'business' ? '비즈' : r}
                </button>
              ))}
            </div>
          </div>
        </div>

        <AdminDateFilter
          value={dateRange}
          onApply={(range) => {
            setDateRange(range);
            setPage(1);
            fetchUsers(1, search, filterRole, range);
          }}
        />

        <div className="admin-list-card">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">유저</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">이메일</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">권한</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">프로프로필</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">결제수</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">가입일</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">액션</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i}>
                      <td colSpan={7} className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="skeleton h-9 w-9 rounded-full" />
                          <div className="flex-1 space-y-2">
                            <div className="skeleton h-3 w-44" />
                            <div className="skeleton h-3 w-72 max-w-full" />
                          </div>
                          <div className="skeleton h-8 w-20" />
                        </div>
                      </td>
                    </tr>
                  ))
                ) : users.length === 0 ? (
                  <tr><td colSpan={7} className="admin-empty-state text-center py-14 text-sm font-semibold">검색 결과가 없습니다</td></tr>
                ) : users.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {user.profileImageUrl
                          ? <img src={user.profileImageUrl} alt={user.name} className="w-9 h-9 rounded-full object-cover bg-gray-100" />
                          : <div className="w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-500">{user.name?.[0] || '?'}</div>
                        }
                        <span className="text-sm font-semibold text-gray-900">{user.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">{user.email}</td>
                    <td className="px-4 py-3 text-center">
                      <select
                        value={user.role}
                        onChange={(e) => handleRoleChange(user.id, e.target.value)}
                        className={`text-xs font-medium px-2 py-1 rounded-full border-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-200 ${roleColors[user.role] || 'bg-gray-100 text-gray-600'}`}
                      >
                        <option value="general">general</option>
                        <option value="pro">pro</option>
                        <option value="business">business</option>
                        <option value="admin">admin</option>
                      </select>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {user.proProfile ? (
                        <div className="flex flex-col items-center gap-0.5">
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            user.proProfile.status === 'approved' ? 'bg-emerald-50 text-emerald-600'
                            : user.proProfile.status === 'pending' ? 'bg-amber-50 text-amber-600'
                            : user.proProfile.status === 'rejected' ? 'bg-red-50 text-red-500'
                            : user.proProfile.status === 'suspended' ? 'bg-slate-100 text-slate-600'
                            : 'bg-gray-100 text-gray-500'
                          }`}>{user.proProfile.status}</span>
                          <span className="text-[10px] text-gray-400">
                            사진 {user.proProfile.imageCount} · 서비스 {user.proProfile.serviceCount}
                          </span>
                          {user.proProfile.isEmpty && (
                            <span className="text-[10px] text-red-500 font-bold">빈 프로필</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-[11px] text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center text-sm text-gray-600">{user.paymentCount}</td>
                    <td className="px-4 py-3 text-center text-xs text-gray-400">
                      {new Date(user.createdAt).toLocaleDateString('ko-KR', { year: '2-digit', month: '2-digit', day: '2-digit' })}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Link href={`/admin/users/${user.id}`} className="px-2 py-1.5 rounded-lg bg-blue-50 text-blue-600 text-xs font-bold hover:bg-blue-100">
                          상세
                        </Link>
                        <button
                          onClick={() => handleDelete(user.id, user.name)}
                          className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="border-t border-[#F2F4F6] px-4 py-3 flex items-center justify-between">
              <p className="text-xs text-gray-500">총 {total}명 ({page}/{totalPages} 페이지)</p>
              <div className="flex items-center gap-1">
                <button disabled={page <= 1} onClick={() => { const p = page - 1; setPage(p); fetchUsers(p, search, filterRole, dateRange); }} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 disabled:opacity-30"><ChevronLeft size={16} /></button>
                <span className="px-3 py-1 text-xs font-bold bg-blue-50 text-blue-600 rounded-full">{page}</span>
                <button disabled={page >= totalPages} onClick={() => { const p = page + 1; setPage(p); fetchUsers(p, search, filterRole, dateRange); }} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 disabled:opacity-30"><ChevronRight size={16} /></button>
              </div>
            </div>
          )}
        </div>
    </div>
  );
}

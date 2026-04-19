'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, Search, ChevronLeft, ChevronRight, Trash2, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import { apiClient } from '@/lib/api/client';
import { AdminErrorPanel, extractAdminError, type AdminErrorInfo } from '../_components/ErrorPanel';

async function adminFetch(method: string, path: string, body?: any) {
  const headers: Record<string, string> = {};
  const adminKey = (typeof window !== 'undefined' && localStorage.getItem('admin-key')) || '';
  if (adminKey) headers['x-admin-key'] = adminKey;
  const res = await apiClient.request({ method, url: path, data: body, headers });
  return res.data;
}

interface UserItem {
  id: string;
  name: string;
  email: string;
  role: string;
  profileImageUrl: string | null;
  createdAt: string;
  paymentCount: number;
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
  const LIMIT = 20;

  const fetchUsers = async (p = page, s = search, r = filterRole) => {
    setLoading(true);
    setLastError(null);
    try {
      const params: any = { page: p, limit: LIMIT };
      if (s) params.search = s;
      if (r !== '전체') params.role = r;
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
    } catch { toast.error('삭제 실패'); }
  };

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center gap-3">
          <Link href="/admin" className="p-1 hover:bg-gray-100 rounded-lg"><ArrowLeft size={20} /></Link>
          <h1 className="text-lg font-bold text-gray-900">유저 관리</h1>
          <span className="ml-auto text-sm text-gray-400">총 {total}명</span>
          <button onClick={() => fetchUsers(page, search, filterRole)} className="p-2 hover:bg-gray-100 rounded-lg">
            <RefreshCw size={16} className="text-gray-500" />
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-6">
        <AdminErrorPanel error={lastError} label="유저 목록" />
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { setPage(1); fetchUsers(1, search, filterRole); } }}
                placeholder="이름 또는 이메일 검색 (Enter)"
                className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
            </div>
            <div className="flex gap-2">
              {['전체', 'general', 'pro', 'business', 'admin'].map((r) => (
                <button
                  key={r}
                  onClick={() => { setFilterRole(r); setPage(1); fetchUsers(1, search, r); }}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${filterRole === r ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                >
                  {r === '전체' ? '전체' : r === 'general' ? '일반' : r === 'business' ? '비즈' : r}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">유저</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">이메일</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">권한</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">결제수</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">가입일</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">액션</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr><td colSpan={6} className="text-center py-12 text-sm text-gray-400">로딩 중...</td></tr>
                ) : users.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-12 text-sm text-gray-400">검색 결과가 없습니다</td></tr>
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
                    <td className="px-4 py-3 text-center text-sm text-gray-600">{user.paymentCount}</td>
                    <td className="px-4 py-3 text-center text-xs text-gray-400">
                      {new Date(user.createdAt).toLocaleDateString('ko-KR', { year: '2-digit', month: '2-digit', day: '2-digit' })}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => handleDelete(user.id, user.name)}
                        className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="border-t border-gray-200 px-4 py-3 flex items-center justify-between">
              <p className="text-xs text-gray-500">총 {total}명 ({page}/{totalPages} 페이지)</p>
              <div className="flex items-center gap-1">
                <button disabled={page <= 1} onClick={() => { const p = page - 1; setPage(p); fetchUsers(p); }} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 disabled:opacity-30"><ChevronLeft size={16} /></button>
                <span className="px-3 py-1 text-xs font-medium bg-blue-50 text-blue-600 rounded-lg">{page}</span>
                <button disabled={page >= totalPages} onClick={() => { const p = page + 1; setPage(p); fetchUsers(p); }} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 disabled:opacity-30"><ChevronRight size={16} /></button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api/client';

interface User {
  id: string;
  email: string | null;
  name: string | null;
  phone: string | null;
  role: 'general' | 'pro' | string;
  isBanned: boolean;
  isActive: boolean;
  createdAt: string;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'general' | 'pro'>('all');

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const params = roleFilter !== 'all' ? { role: roleFilter } : {};
      const res = await apiClient.get<User[]>('/api/v1/admin/users', { params });
      setUsers(res.data);
    } catch (e: any) {
      console.error(e);
      setUsers([]);
    }
    setLoading(false);
  };

  useEffect(() => { fetchUsers(); }, [roleFilter]);

  const filtered = users.filter((u) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      (u.email || '').toLowerCase().includes(s) ||
      (u.name || '').toLowerCase().includes(s) ||
      (u.phone || '').includes(s) ||
      u.id.includes(s)
    );
  });

  const updateRole = async (id: string, role: 'general' | 'pro') => {
    try {
      await apiClient.patch(`/api/v1/admin/users/${id}/role`, { role });
      setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, role } : u)));
    } catch (e: any) {
      alert('업데이트 실패: ' + (e?.response?.data?.message ?? e.message));
    }
  };

  const toggleBan = async (id: string, current: boolean) => {
    const next = !current;
    try {
      await apiClient.patch(`/api/v1/admin/users/${id}/ban`, { isBanned: next });
      setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, isBanned: next } : u)));
    } catch (e: any) {
      alert('업데이트 실패: ' + (e?.response?.data?.message ?? e.message));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-[20px] font-bold">유저 관리</h1>
        <button
          onClick={fetchUsers}
          className="text-[12px] px-3 py-1.5 bg-gray-100 rounded-md hover:bg-gray-200"
        >
          새로고침
        </button>
      </div>

      <div className="flex gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="이메일, 이름, 전화번호, id 검색"
          className="flex-1 px-3 py-2 border border-gray-200 rounded-md text-[13px]"
        />
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value as any)}
          className="px-3 py-2 border border-gray-200 rounded-md text-[13px]"
        >
          <option value="all">전체</option>
          <option value="general">일반</option>
          <option value="pro">프로</option>
        </select>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-3 py-2 text-left font-semibold">이메일</th>
              <th className="px-3 py-2 text-left font-semibold">이름</th>
              <th className="px-3 py-2 text-left font-semibold">전화</th>
              <th className="px-3 py-2 text-left font-semibold">역할</th>
              <th className="px-3 py-2 text-left font-semibold">상태</th>
              <th className="px-3 py-2 text-left font-semibold">가입일</th>
              <th className="px-3 py-2 text-left font-semibold">액션</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="px-3 py-8 text-center text-gray-400">불러오는 중...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} className="px-3 py-8 text-center text-gray-400">유저 없음</td></tr>
            ) : (
              filtered.map((u) => (
                <tr key={u.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-3 py-2 truncate max-w-[220px]">{u.email}</td>
                  <td className="px-3 py-2">{u.name}</td>
                  <td className="px-3 py-2 text-gray-500">{u.phone || '-'}</td>
                  <td className="px-3 py-2">
                    <select
                      value={u.role}
                      onChange={(e) => updateRole(u.id, e.target.value as any)}
                      className="px-2 py-1 border border-gray-200 rounded text-[12px]"
                    >
                      <option value="general">일반</option>
                      <option value="pro">프로</option>
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    {u.isBanned ? (
                      <span className="px-2 py-0.5 bg-red-100 text-red-600 rounded-full text-[11px]">밴</span>
                    ) : (
                      <span className="px-2 py-0.5 bg-green-100 text-green-600 rounded-full text-[11px]">활성</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-gray-500">{new Date(u.createdAt).toLocaleDateString()}</td>
                  <td className="px-3 py-2">
                    <button
                      onClick={() => toggleBan(u.id, u.isBanned)}
                      className="text-[12px] px-2 py-1 bg-gray-100 rounded hover:bg-gray-200"
                    >
                      {u.isBanned ? '밴 해제' : '밴'}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="text-[12px] text-gray-400">최근 {users.length}명 표시 (최대 200)</p>
    </div>
  );
}

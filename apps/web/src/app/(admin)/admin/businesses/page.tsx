'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Building2, ChevronLeft, ChevronRight, RefreshCw, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import { adminFetch } from '../_components/adminFetch';

interface BusinessUserItem {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: string;
  createdAt: string;
  businessProfile: null | {
    id: string;
    businessName: string;
    businessType: string | null;
    status: string;
    phone: string | null;
    address: string | null;
    imageCount: number;
    categoryCount: number;
    createdAt: string;
  };
}

const LIMIT = 20;

const statusTone: Record<string, string> = {
  approved: 'bg-emerald-50 text-emerald-600',
  pending: 'bg-amber-50 text-amber-600',
  rejected: 'bg-red-50 text-red-500',
  draft: 'bg-gray-100 text-gray-500',
};

function dateText(value?: string | null) {
  if (!value) return '-';
  try {
    return new Date(value).toLocaleDateString('ko-KR', { year: '2-digit', month: '2-digit', day: '2-digit' });
  } catch {
    return '-';
  }
}

export default function AdminBusinessesPage() {
  const [rows, setRows] = useState<BusinessUserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const fetchData = async (p = page, s = search) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p), limit: String(LIMIT), role: 'business' });
      if (s.trim()) params.set('search', s.trim());
      const data = await adminFetch('GET', `/api/v1/admin/users?${params.toString()}`);
      setRows(data.data || []);
      setTotal(data.total || 0);
    } catch (e: any) {
      toast.error(`비즈 계정 로드 실패: ${e?.response?.data?.message || e?.message || ''}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(1, ''); }, []);

  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between px-1">
        <div>
          <p className="text-[12px] font-bold text-[#3182F6]">실제 비즈 계정</p>
          <h1 className="mt-1 text-[24px] font-black text-[#191F28]">Biz 고객사 관리</h1>
          <p className="mt-1 text-[13px] font-semibold text-[#8B95A1]">
            비즈니스 고객 계정과 연결된 업체 프로필을 확인합니다.
          </p>
        </div>
        <button
          onClick={() => fetchData(page, search)}
          disabled={loading}
          className="admin-icon-button flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#6B7684] shadow-[0_6px_16px_rgba(2,32,71,0.04)] hover:bg-[#F2F4F6] disabled:opacity-50"
          title="새로고침"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="admin-toolbar p-4">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#B0B8C1]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                setPage(1);
                fetchData(1, search);
              }
            }}
            placeholder="비즈 계정명 또는 이메일 검색 (Enter)"
            className="h-11 w-full rounded-2xl border border-[#E5E8EB] bg-[#F7F8FA] pl-9 pr-4 text-sm font-semibold text-[#191F28] placeholder:text-[#B0B8C1] focus:outline-none"
          />
        </div>
      </div>

      <div className="admin-list-card overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead className="border-b border-[#F2F4F6] bg-[#FBFCFD]">
            <tr>
              <th className="px-4 py-3 text-left font-semibold">계정</th>
              <th className="px-4 py-3 text-left font-semibold">비즈 프로필</th>
              <th className="px-4 py-3 text-left font-semibold">연락처</th>
              <th className="px-4 py-3 text-center font-semibold">상태</th>
              <th className="px-4 py-3 text-center font-semibold">등록일</th>
              <th className="px-4 py-3 text-center font-semibold">액션</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F2F4F6]">
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i}><td colSpan={6} className="px-4 py-3"><div className="skeleton h-9 w-full" /></td></tr>
              ))
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="admin-empty-state px-4 py-14 text-center text-sm font-semibold">
                  비즈 계정 데이터가 없습니다
                </td>
              </tr>
            ) : (
              rows.map((r) => {
                const profile = r.businessProfile;
                return (
                  <tr key={r.id} className="hover:bg-[#F7FAFF]">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#F2F7FF] text-[#3182F6]">
                          <Building2 size={18} />
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-[#191F28]">{r.name || '-'}</p>
                          <p className="mt-0.5 truncate text-[11px] text-[#8B95A1]">{r.email || '-'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {profile ? (
                        <>
                          <p className="font-bold text-[#191F28]">{profile.businessName}</p>
                          <p className="mt-0.5 max-w-[260px] truncate text-[11px] text-[#8B95A1]">
                            {profile.businessType || '분류 없음'} · 이미지 {profile.imageCount} · 카테고리 {profile.categoryCount}
                          </p>
                        </>
                      ) : (
                        <span className="text-[12px] font-semibold text-[#B0B8C1]">비즈 프로필 없음</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-[12px] font-semibold text-[#6B7684]">
                      <p>{profile?.phone || r.phone || '-'}</p>
                      <p className="mt-0.5 max-w-[220px] truncate text-[#8B95A1]">{profile?.address || '-'}</p>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${statusTone[profile?.status || 'draft'] || 'bg-gray-100 text-gray-500'}`}>
                        {profile?.status || 'profile_missing'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-[12px] font-semibold text-[#8B95A1]">
                      {dateText(profile?.createdAt || r.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {profile ? (
                        <Link href={`/admin/partners/${profile.id}`} className="rounded-xl bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-600 hover:bg-blue-100">
                          프로필 관리
                        </Link>
                      ) : (
                        <Link href={`/admin/users/${r.id}`} className="rounded-xl bg-gray-100 px-3 py-1.5 text-xs font-bold text-gray-600 hover:bg-gray-200">
                          계정 상세
                        </Link>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-[#F2F4F6] px-4 py-3">
            <p className="text-xs font-semibold text-[#8B95A1]">총 {total.toLocaleString()}개 ({page}/{totalPages})</p>
            <div className="flex items-center gap-1">
              <button disabled={page <= 1 || loading} onClick={() => { const next = page - 1; setPage(next); fetchData(next, search); }} className="rounded-xl p-1.5 text-[#8B95A1] hover:bg-[#F2F4F6] disabled:opacity-30"><ChevronLeft size={16} /></button>
              <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-600">{page}</span>
              <button disabled={page >= totalPages || loading} onClick={() => { const next = page + 1; setPage(next); fetchData(next, search); }} className="rounded-xl p-1.5 text-[#8B95A1] hover:bg-[#F2F4F6] disabled:opacity-30"><ChevronRight size={16} /></button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Building2, RefreshCw, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import { AdminDateFilter, type AdminDateRange } from '../_components/AdminDateFilter';
import { AdminInfiniteScroll, appendUniqueById } from '../_components/AdminInfiniteScroll';
import { adminFetch } from '../_components/adminFetch';

interface BusinessUserItem {
  id: string;
  businessName: string;
  businessType: string | null;
  address: string | null;
  phone: string | null;
  status: string;
  createdAt: string;
  images?: Array<{ imageUrl: string }>;
  categories?: Array<{ category?: { name: string } }>;
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
  const [loadingMore, setLoadingMore] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [dateRange, setDateRange] = useState<AdminDateRange>({ startDate: '', endDate: '' });

  const fetchData = async (p = page, s = search, range = dateRange, append = false) => {
    if (append) setLoadingMore(true);
    else setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p), limit: String(LIMIT) });
      if (s.trim()) params.set('search', s.trim());
      if (range.startDate) params.set('startDate', range.startDate);
      if (range.endDate) params.set('endDate', range.endDate);
      const data = await adminFetch('GET', `/api/v1/admin/businesses?${params.toString()}`);
      const nextRows = data.data || [];
      setRows((prev) => append ? appendUniqueById(prev, nextRows) : nextRows);
      setTotal(data.total || 0);
      setPage(p);
    } catch (e: any) {
      toast.error(`비즈 계정 로드 실패: ${e?.response?.data?.message || e?.message || ''}`);
    } finally {
      if (append) setLoadingMore(false);
      else setLoading(false);
    }
  };

  useEffect(() => { fetchData(1, ''); }, []);

  const hasMore = rows.length < total;

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
          onClick={() => fetchData(1, search, dateRange)}
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
                fetchData(1, search, dateRange);
              }
            }}
            placeholder="비즈 계정명 또는 이메일 검색 (Enter)"
            className="h-11 w-full rounded-2xl border border-[#E5E8EB] bg-[#F7F8FA] pl-9 pr-4 text-sm font-semibold text-[#191F28] placeholder:text-[#B0B8C1] focus:outline-none"
          />
        </div>
      </div>

      <AdminDateFilter
        value={dateRange}
        onApply={(range) => {
          setDateRange(range);
          setPage(1);
          fetchData(1, search, range);
        }}
      />

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
                const categoryNames = r.categories?.map((c) => c.category?.name).filter(Boolean).join(', ');
                return (
                  <tr key={r.id} className="hover:bg-[#F7FAFF]">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#F2F7FF] text-[#3182F6]">
                          <Building2 size={18} />
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-[#191F28]">{r.businessName || '-'}</p>
                          <p className="mt-0.5 truncate text-[11px] text-[#8B95A1]">{r.businessType || '분류 없음'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-bold text-[#191F28]">{r.businessName}</p>
                      <p className="mt-0.5 max-w-[260px] truncate text-[11px] text-[#8B95A1]">
                        이미지 {r.images?.length || 0} · {categoryNames || '카테고리 없음'}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-[12px] font-semibold text-[#6B7684]">
                      <p>{r.phone || '-'}</p>
                      <p className="mt-0.5 max-w-[220px] truncate text-[#8B95A1]">{r.address || '-'}</p>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${statusTone[r.status || 'draft'] || 'bg-gray-100 text-gray-500'}`}>
                        {r.status || 'draft'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-[12px] font-semibold text-[#8B95A1]">
                      {dateText(r.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Link href={`/admin/partners/${r.id}`} className="rounded-xl bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-600 hover:bg-blue-100">
                        프로필 관리
                      </Link>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
        <AdminInfiniteScroll
          hasMore={hasMore}
          loading={loadingMore}
          loaded={rows.length}
          total={total}
          onLoadMore={() => {
            if (!hasMore || loading || loadingMore) return;
            fetchData(page + 1, search, dateRange, true);
          }}
          itemLabel="개"
        />
      </div>
    </div>
  );
}

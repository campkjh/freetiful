'use client';

import { useEffect, useMemo, useState } from 'react';
import { RefreshCw, Search } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function AdminBusinessesPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchData = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('companies')
      .select('*')
      .order('createdAt', { ascending: false })
      .limit(200);
    if (error) console.error(error);
    setRows((data as any) || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const filtered = useMemo(() => rows.filter((r) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (r.name || '').toLowerCase().includes(s) || (r.businessNumber || '').includes(s);
  }), [rows, search]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between px-1">
        <div>
          <p className="text-[12px] font-bold text-[#3182F6]">B2B 운영</p>
          <h1 className="mt-1 text-[24px] font-black text-[#191F28] tracking-tight">Biz 고객사 관리</h1>
        </div>
        <button
          onClick={fetchData}
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
            placeholder="회사명, 사업자번호 검색"
            className="h-11 w-full rounded-2xl border border-[#E5E8EB] bg-[#F7F8FA] pl-9 pr-4 text-sm font-semibold text-[#191F28] placeholder:text-[#B0B8C1] focus:outline-none"
          />
        </div>
      </div>

      <div className="admin-list-card overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-3 py-2 text-left font-semibold">회사명</th>
              <th className="px-3 py-2 text-left font-semibold">사업자번호</th>
              <th className="px-3 py-2 text-left font-semibold">담당자</th>
              <th className="px-3 py-2 text-left font-semibold">연락처</th>
              <th className="px-3 py-2 text-left font-semibold">등록일</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i}><td colSpan={5} className="px-3 py-3"><div className="skeleton h-8 w-full" /></td></tr>
              ))
            ) : filtered.length === 0 ? (
              <tr><td colSpan={5} className="admin-empty-state px-3 py-12 text-center text-sm font-semibold">고객사 없음</td></tr>
            ) : (
              filtered.map((r) => (
                <tr key={r.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-3 py-2 font-medium">{r.name || '-'}</td>
                  <td className="px-3 py-2 text-gray-500">{r.businessNumber || '-'}</td>
                  <td className="px-3 py-2">{r.contactName || '-'}</td>
                  <td className="px-3 py-2 text-gray-500">{r.contactPhone || r.contactEmail || '-'}</td>
                  <td className="px-3 py-2 text-gray-500">{new Date(r.createdAt).toLocaleDateString()}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

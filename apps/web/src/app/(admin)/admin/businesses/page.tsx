'use client';

import { useEffect, useState } from 'react';
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

  const filtered = rows.filter((r) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (r.name || '').toLowerCase().includes(s) || (r.businessNumber || '').includes(s);
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-[20px] font-bold">Biz 고객사 관리</h1>
        <button onClick={fetchData} className="text-[12px] px-3 py-1.5 bg-gray-100 rounded-md hover:bg-gray-200">새로고침</button>
      </div>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="회사명, 사업자번호 검색"
        className="w-full px-3 py-2 border border-gray-200 rounded-md text-[13px]"
      />

      <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
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
              <tr><td colSpan={5} className="px-3 py-8 text-center text-gray-400">불러오는 중...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={5} className="px-3 py-8 text-center text-gray-400">고객사 없음</td></tr>
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

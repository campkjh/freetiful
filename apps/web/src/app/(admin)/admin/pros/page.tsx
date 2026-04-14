'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

interface Pro {
  id: string;
  userId: string;
  bio: string | null;
  category: string | null;
  isApproved: boolean;
  isPublic: boolean;
  avgRating: number | null;
  reviewCount: number | null;
  createdAt: string;
  users?: { email: string | null; name: string | null };
}

export default function AdminProsPage() {
  const [pros, setPros] = useState<Pro[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved'>('all');

  const fetchPros = async () => {
    setLoading(true);
    let q = supabase
      .from('pro_profiles')
      .select('*, users(email, name)')
      .order('createdAt', { ascending: false })
      .limit(200);
    if (filter === 'pending') q = q.eq('isApproved', false);
    if (filter === 'approved') q = q.eq('isApproved', true);
    const { data, error } = await q;
    if (error) console.error(error);
    setPros((data as any) || []);
    setLoading(false);
  };

  useEffect(() => { fetchPros(); }, [filter]);

  const toggleApprove = async (id: string, current: boolean) => {
    const { error } = await supabase.from('pro_profiles').update({ isApproved: !current }).eq('id', id);
    if (error) return alert('실패: ' + error.message);
    setPros((prev) => prev.map((p) => (p.id === id ? { ...p, isApproved: !current } : p)));
  };

  const togglePublic = async (id: string, current: boolean) => {
    const { error } = await supabase.from('pro_profiles').update({ isPublic: !current }).eq('id', id);
    if (error) return alert('실패: ' + error.message);
    setPros((prev) => prev.map((p) => (p.id === id ? { ...p, isPublic: !current } : p)));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-[20px] font-bold">프로 관리</h1>
        <button onClick={fetchPros} className="text-[12px] px-3 py-1.5 bg-gray-100 rounded-md hover:bg-gray-200">새로고침</button>
      </div>

      <div className="flex gap-2">
        {([['all', '전체'], ['pending', '승인대기'], ['approved', '승인완료']] as const).map(([v, l]) => (
          <button
            key={v}
            onClick={() => setFilter(v)}
            className={`px-3 py-1.5 rounded-md text-[12px] ${filter === v ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700'}`}
          >
            {l}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-3 py-2 text-left font-semibold">유저</th>
              <th className="px-3 py-2 text-left font-semibold">카테고리</th>
              <th className="px-3 py-2 text-left font-semibold">소개</th>
              <th className="px-3 py-2 text-left font-semibold">평점</th>
              <th className="px-3 py-2 text-left font-semibold">승인</th>
              <th className="px-3 py-2 text-left font-semibold">공개</th>
              <th className="px-3 py-2 text-left font-semibold">액션</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="px-3 py-8 text-center text-gray-400">불러오는 중...</td></tr>
            ) : pros.length === 0 ? (
              <tr><td colSpan={7} className="px-3 py-8 text-center text-gray-400">프로 없음</td></tr>
            ) : (
              pros.map((p) => (
                <tr key={p.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-3 py-2">
                    <div className="font-medium">{p.users?.name || '-'}</div>
                    <div className="text-[11px] text-gray-400">{p.users?.email}</div>
                  </td>
                  <td className="px-3 py-2">{p.category || '-'}</td>
                  <td className="px-3 py-2 truncate max-w-[300px] text-gray-500">{p.bio || '-'}</td>
                  <td className="px-3 py-2">{p.avgRating?.toFixed(1) || '-'} ({p.reviewCount || 0})</td>
                  <td className="px-3 py-2">
                    {p.isApproved ? <span className="px-2 py-0.5 bg-green-100 text-green-600 rounded-full text-[11px]">승인</span>
                      : <span className="px-2 py-0.5 bg-yellow-100 text-yellow-600 rounded-full text-[11px]">대기</span>}
                  </td>
                  <td className="px-3 py-2">
                    {p.isPublic ? '✅' : '—'}
                  </td>
                  <td className="px-3 py-2 space-x-1">
                    <button onClick={() => toggleApprove(p.id, p.isApproved)} className="text-[12px] px-2 py-1 bg-blue-50 text-blue-600 rounded hover:bg-blue-100">
                      {p.isApproved ? '승인 취소' : '승인'}
                    </button>
                    <button onClick={() => togglePublic(p.id, p.isPublic)} className="text-[12px] px-2 py-1 bg-gray-100 rounded hover:bg-gray-200">
                      {p.isPublic ? '비공개' : '공개'}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

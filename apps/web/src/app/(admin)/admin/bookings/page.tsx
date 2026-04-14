'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function AdminBookingsPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'confirmed' | 'cancelled'>('all');

  const fetchData = async () => {
    setLoading(true);
    let q = supabase
      .from('bookings')
      .select('*, user:users!bookings_userId_fkey(name, email), pro_profile:pro_profiles!bookings_proProfileId_fkey(userId, users(name))')
      .order('createdAt', { ascending: false })
      .limit(200);
    if (filter !== 'all') q = q.eq('status', filter);
    const { data, error } = await q;
    if (error) console.error(error);
    setRows((data as any) || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [filter]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-[20px] font-bold">의뢰/예약 관리</h1>
        <button onClick={fetchData} className="text-[12px] px-3 py-1.5 bg-gray-100 rounded-md hover:bg-gray-200">새로고침</button>
      </div>

      <div className="flex gap-2">
        {([['all', '전체'], ['pending', '대기'], ['confirmed', '확정'], ['cancelled', '취소']] as const).map(([v, l]) => (
          <button key={v} onClick={() => setFilter(v)}
            className={`px-3 py-1.5 rounded-md text-[12px] ${filter === v ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700'}`}>
            {l}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-3 py-2 text-left font-semibold">의뢰인</th>
              <th className="px-3 py-2 text-left font-semibold">프로</th>
              <th className="px-3 py-2 text-left font-semibold">일자</th>
              <th className="px-3 py-2 text-left font-semibold">상태</th>
              <th className="px-3 py-2 text-left font-semibold">금액</th>
              <th className="px-3 py-2 text-left font-semibold">생성</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="px-3 py-8 text-center text-gray-400">불러오는 중...</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={6} className="px-3 py-8 text-center text-gray-400">예약 없음</td></tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-3 py-2">
                    <div className="font-medium">{r.user?.name || '-'}</div>
                    <div className="text-[11px] text-gray-400">{r.user?.email}</div>
                  </td>
                  <td className="px-3 py-2">{r.pro_profile?.users?.name || '-'}</td>
                  <td className="px-3 py-2">{r.eventDate ? new Date(r.eventDate).toLocaleDateString() : '-'}</td>
                  <td className="px-3 py-2">
                    <span className="px-2 py-0.5 bg-gray-100 rounded-full text-[11px]">{r.status}</span>
                  </td>
                  <td className="px-3 py-2">{r.totalPrice ? `${Number(r.totalPrice).toLocaleString()}원` : '-'}</td>
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

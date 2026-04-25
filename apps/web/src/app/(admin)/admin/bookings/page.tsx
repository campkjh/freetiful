'use client';

import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
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
    <div className="space-y-5">
      <div className="flex items-center justify-between px-1">
        <div>
          <p className="text-[12px] font-bold text-[#3182F6]">예약 운영</p>
          <h1 className="mt-1 text-[24px] font-black text-[#191F28] tracking-tight">의뢰/예약 관리</h1>
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

      <div className="admin-toolbar flex gap-2 p-3">
        {([['all', '전체'], ['pending', '대기'], ['confirmed', '확정'], ['cancelled', '취소']] as const).map(([v, l]) => (
          <button key={v} onClick={() => setFilter(v)}
            className={`admin-chip px-3.5 text-[12px] ${filter === v ? 'bg-[#191F28] text-white shadow-[0_8px_18px_rgba(25,31,40,0.14)]' : 'bg-[#F2F4F6] text-[#6B7684] hover:bg-[#E5E8EB] hover:text-[#191F28]'}`}>
            {l}
          </button>
        ))}
      </div>

      <div className="admin-list-card overflow-x-auto">
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
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i}><td colSpan={6} className="px-3 py-3"><div className="skeleton h-8 w-full" /></td></tr>
              ))
            ) : rows.length === 0 ? (
              <tr><td colSpan={6} className="admin-empty-state px-3 py-12 text-center text-sm font-semibold">예약 없음</td></tr>
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

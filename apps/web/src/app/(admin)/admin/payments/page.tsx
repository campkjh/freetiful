'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function AdminPaymentsPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'paid' | 'refunded' | 'failed'>('all');

  const fetchData = async () => {
    setLoading(true);
    let q = supabase
      .from('payments')
      .select('*, users(name, email)')
      .order('createdAt', { ascending: false })
      .limit(200);
    if (filter !== 'all') q = q.eq('status', filter);
    const { data, error } = await q;
    if (error) console.error(error);
    setRows((data as any) || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [filter]);

  const totalPaid = rows
    .filter((r) => r.status === 'paid')
    .reduce((sum, r) => sum + Number(r.amount || 0), 0);
  const totalRefunded = rows
    .filter((r) => r.status === 'refunded')
    .reduce((sum, r) => sum + Number(r.amount || 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-[20px] font-bold">결제/정산 관리</h1>
        <button onClick={fetchData} className="text-[12px] px-3 py-1.5 bg-gray-100 rounded-md hover:bg-gray-200">새로고침</button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-[12px] text-gray-500 mb-1">결제 합계 (최근 200건)</p>
          <p className="text-[20px] font-bold text-green-600">{totalPaid.toLocaleString()}원</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-[12px] text-gray-500 mb-1">환불 합계</p>
          <p className="text-[20px] font-bold text-red-500">{totalRefunded.toLocaleString()}원</p>
        </div>
      </div>

      <div className="flex gap-2">
        {([['all', '전체'], ['paid', '결제완료'], ['refunded', '환불'], ['failed', '실패']] as const).map(([v, l]) => (
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
              <th className="px-3 py-2 text-left font-semibold">유저</th>
              <th className="px-3 py-2 text-left font-semibold">금액</th>
              <th className="px-3 py-2 text-left font-semibold">결제수단</th>
              <th className="px-3 py-2 text-left font-semibold">상태</th>
              <th className="px-3 py-2 text-left font-semibold">결제일</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="px-3 py-8 text-center text-gray-400">불러오는 중...</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={5} className="px-3 py-8 text-center text-gray-400">결제 없음</td></tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-3 py-2">
                    <div className="font-medium">{r.users?.name || '-'}</div>
                    <div className="text-[11px] text-gray-400">{r.users?.email}</div>
                  </td>
                  <td className="px-3 py-2 font-semibold">{Number(r.amount || 0).toLocaleString()}원</td>
                  <td className="px-3 py-2 text-gray-500">{r.method || '-'}</td>
                  <td className="px-3 py-2">
                    <span className={`px-2 py-0.5 rounded-full text-[11px] ${
                      r.status === 'paid' ? 'bg-green-100 text-green-600' :
                      r.status === 'refunded' ? 'bg-red-100 text-red-600' :
                      'bg-gray-100 text-gray-600'
                    }`}>{r.status}</span>
                  </td>
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

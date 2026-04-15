'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api/client';

type Status = 'draft' | 'pending' | 'approved' | 'rejected' | 'suspended';

interface Pro {
  id: string;
  userId: string;
  status: Status;
  gender: string | null;
  shortIntro: string | null;
  mainExperience: string | null;
  careerYears: number | null;
  avgRating: string | number | null;
  reviewCount: number | null;
  createdAt: string;
  approvedAt: string | null;
  rejectionReason: string | null;
  user?: { email: string | null; name: string | null; phone: string | null; profileImageUrl: string | null };
  images?: { imageUrl: string }[];
}

const STATUS_LABEL: Record<Status, string> = {
  draft: '작성중', pending: '심사대기', approved: '승인', rejected: '반려', suspended: '정지',
};
const STATUS_STYLE: Record<Status, string> = {
  draft: 'bg-gray-100 text-gray-500',
  pending: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  suspended: 'bg-gray-300 text-gray-700',
};

export default function AdminProsPage() {
  const [pros, setPros] = useState<Pro[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | Status>('all');

  const fetchPros = async () => {
    setLoading(true);
    try {
      const params = filter === 'all' ? {} : { status: filter };
      const { data } = await apiClient.get<Pro[]>('/api/v1/admin/pros', { params });
      setPros(data || []);
    } catch (e: any) {
      console.error(e);
      alert('불러오기 실패: ' + (e?.response?.data?.message || e.message));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPros(); }, [filter]);

  const updateStatus = async (id: string, status: Status, rejectionReason?: string) => {
    try {
      await apiClient.patch(`/api/v1/admin/pros/${id}/status`, { status, rejectionReason });
      setPros((prev) => prev.map((p) => (p.id === id ? { ...p, status, approvedAt: status === 'approved' ? new Date().toISOString() : p.approvedAt, rejectionReason: status === 'rejected' ? rejectionReason ?? null : null } : p)));
    } catch (e: any) {
      alert('실패: ' + (e?.response?.data?.message || e.message));
    }
  };

  const handleApprove = (p: Pro) => {
    if (!confirm(`${p.user?.name || p.id} 님의 파트너 신청을 승인하시겠습니까?`)) return;
    updateStatus(p.id, 'approved');
  };

  const handleReject = (p: Pro) => {
    const reason = prompt('반려 사유를 입력해주세요 (선택)', '');
    if (reason === null) return;
    updateStatus(p.id, 'rejected', reason || undefined);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-[20px] font-bold">프로 관리</h1>
        <button onClick={fetchPros} className="text-[12px] px-3 py-1.5 bg-gray-100 rounded-md hover:bg-gray-200">새로고침</button>
      </div>

      <div className="flex gap-2 flex-wrap">
        {(['all', 'pending', 'approved', 'rejected', 'draft', 'suspended'] as const).map((v) => (
          <button
            key={v}
            onClick={() => setFilter(v)}
            className={`px-3 py-1.5 rounded-md text-[12px] ${filter === v ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700'}`}
          >
            {v === 'all' ? '전체' : STATUS_LABEL[v]}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-3 py-2 text-left font-semibold">유저</th>
              <th className="px-3 py-2 text-left font-semibold">소개</th>
              <th className="px-3 py-2 text-left font-semibold">경력</th>
              <th className="px-3 py-2 text-left font-semibold">상태</th>
              <th className="px-3 py-2 text-left font-semibold">신청일</th>
              <th className="px-3 py-2 text-left font-semibold">액션</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="px-3 py-8 text-center text-gray-400">불러오는 중...</td></tr>
            ) : pros.length === 0 ? (
              <tr><td colSpan={6} className="px-3 py-8 text-center text-gray-400">프로 없음</td></tr>
            ) : (
              pros.map((p) => (
                <tr key={p.id} className="border-b border-gray-100 hover:bg-gray-50 align-top">
                  <td className="px-3 py-2">
                    <div className="font-medium">{p.user?.name || '-'}</div>
                    <div className="text-[11px] text-gray-400">{p.user?.email}</div>
                    {p.user?.phone && <div className="text-[11px] text-gray-400">{p.user.phone}</div>}
                  </td>
                  <td className="px-3 py-2 truncate max-w-[300px] text-gray-500">{p.shortIntro || '-'}</td>
                  <td className="px-3 py-2">{p.careerYears ? `${p.careerYears}년` : '-'}</td>
                  <td className="px-3 py-2">
                    <span className={`px-2 py-0.5 rounded-full text-[11px] ${STATUS_STYLE[p.status]}`}>{STATUS_LABEL[p.status]}</span>
                    {p.status === 'rejected' && p.rejectionReason && (
                      <div className="text-[11px] text-red-500 mt-1 max-w-[200px]">사유: {p.rejectionReason}</div>
                    )}
                  </td>
                  <td className="px-3 py-2 text-[11px] text-gray-400">
                    {new Date(p.createdAt).toLocaleDateString('ko-KR')}
                  </td>
                  <td className="px-3 py-2 space-x-1 whitespace-nowrap">
                    {p.status !== 'approved' && (
                      <button onClick={() => handleApprove(p)} className="text-[12px] px-2 py-1 bg-green-50 text-green-700 rounded hover:bg-green-100">
                        승인
                      </button>
                    )}
                    {p.status !== 'rejected' && p.status !== 'approved' && (
                      <button onClick={() => handleReject(p)} className="text-[12px] px-2 py-1 bg-red-50 text-red-700 rounded hover:bg-red-100">
                        반려
                      </button>
                    )}
                    {p.status === 'approved' && (
                      <button onClick={() => { if (confirm('승인을 취소하고 심사대기로 되돌립니다.')) updateStatus(p.id, 'pending'); }} className="text-[12px] px-2 py-1 bg-yellow-50 text-yellow-700 rounded hover:bg-yellow-100">
                        승인 취소
                      </button>
                    )}
                    <a href={`/pros/${p.id}`} target="_blank" rel="noreferrer" className="text-[12px] px-2 py-1 bg-gray-100 rounded hover:bg-gray-200 inline-block">
                      상세
                    </a>
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

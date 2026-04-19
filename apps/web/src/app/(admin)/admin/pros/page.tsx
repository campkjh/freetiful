'use client';

import { useState, useEffect } from 'react';
import { ArrowLeft, Search, ToggleLeft, ToggleRight, ChevronLeft, ChevronRight, Check, X } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { apiClient } from '@/lib/api/client';

const ADMIN_KEY = process.env.NEXT_PUBLIC_ADMIN_KEY || '';

interface ProItem {
  id: string;
  name: string;
  email: string;
  status: string;
  showPartnersLogo: boolean;
  image: string;
  avgRating: number;
  reviewCount: number;
  isFeatured: boolean;
}

const statusLabel: Record<string, { text: string; className: string }> = {
  approved: { text: '승인', className: 'bg-green-50 text-green-600' },
  pending: { text: '대기', className: 'bg-yellow-50 text-yellow-600' },
  rejected: { text: '반려', className: 'bg-red-50 text-red-600' },
  draft: { text: '임시저장', className: 'bg-gray-50 text-gray-500' },
};

async function adminFetch(method: string, path: string, body?: any) {
  const adminKey = localStorage.getItem('admin-key') || ADMIN_KEY;
  const res = await apiClient.request({
    method,
    url: path,
    data: body,
    headers: { 'x-admin-key': adminKey },
  });
  return res.data;
}

export default function AdminProsPage() {
  const [pros, setPros] = useState<ProItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('전체');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [adminKey, setAdminKey] = useState('');
  const [keyInput, setKeyInput] = useState('');
  const LIMIT = 20;

  const fetchPros = async (p = page, s = search, st = filterStatus) => {
    setLoading(true);
    try {
      const params: any = { page: p, limit: LIMIT };
      if (s) params.search = s;
      if (st !== '전체') params.status = st;
      const data = await adminFetch('GET', `/api/v1/admin/pros?${new URLSearchParams(params).toString()}`);
      setPros(data.data || []);
      setTotal(data.total || 0);
    } catch {
      toast.error('목록을 불러오지 못했습니다');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const stored = localStorage.getItem('admin-key');
    if (stored) { setAdminKey(stored); fetchPros(); }
    else setLoading(false);
  }, []);

  const handleKeySubmit = () => {
    localStorage.setItem('admin-key', keyInput);
    setAdminKey(keyInput);
    fetchPros(1, search, filterStatus);
  };

  const handleApprove = async (id: string) => {
    try {
      await adminFetch('PATCH', `/api/v1/admin/pros/${id}/approve`);
      toast.success('승인되었습니다');
      setPros((prev) => prev.map((p) => p.id === id ? { ...p, status: 'approved' } : p));
    } catch { toast.error('승인 실패'); }
  };

  const handleReject = async (id: string) => {
    try {
      await adminFetch('PATCH', `/api/v1/admin/pros/${id}/reject`);
      toast.success('반려되었습니다');
      setPros((prev) => prev.map((p) => p.id === id ? { ...p, status: 'rejected' } : p));
    } catch { toast.error('반려 실패'); }
  };

  const handleToggleLogo = async (id: string) => {
    try {
      await adminFetch('PATCH', `/api/v1/admin/pros/${id}/toggle-logo`);
      setPros((prev) => prev.map((p) => p.id === id ? { ...p, showPartnersLogo: !p.showPartnersLogo } : p));
    } catch { toast.error('변경 실패'); }
  };

  const handleToggleFeatured = async (id: string) => {
    try {
      await adminFetch('PATCH', `/api/v1/admin/pros/${id}/featured`);
      setPros((prev) => prev.map((p) => p.id === id ? { ...p, isFeatured: !p.isFeatured } : p));
    } catch { toast.error('변경 실패'); }
  };

  const totalPages = Math.ceil(total / LIMIT);

  if (!adminKey) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-xl border border-gray-200 p-8 w-full max-w-sm">
          <h2 className="text-lg font-bold mb-4">관리자 인증</h2>
          <input
            type="password"
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleKeySubmit()}
            placeholder="Admin Key 입력"
            className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-blue-300"
          />
          <button
            onClick={handleKeySubmit}
            className="w-full bg-gray-900 text-white rounded-lg py-2.5 text-sm font-medium"
          >
            확인
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4">
          <div className="flex items-center gap-3">
            <Link href="/admin" className="p-1 hover:bg-gray-100 rounded-lg">
              <ArrowLeft size={20} />
            </Link>
            <h1 className="text-lg font-bold text-gray-900">전문가 관리</h1>
            <span className="ml-auto text-sm text-gray-400">총 {total}명</span>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-6">
        {/* Filters */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => { setSearch(e.target.value); }}
                onKeyDown={(e) => { if (e.key === 'Enter') { setPage(1); fetchPros(1, search, filterStatus); } }}
                placeholder="전문가 이름 검색 (Enter)"
                className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              {['전체', 'pending', 'approved', 'rejected'].map((st) => (
                <button
                  key={st}
                  onClick={() => { setFilterStatus(st); setPage(1); fetchPros(1, search, st); }}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    filterStatus === st ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {st === '전체' ? '전체' : st === 'pending' ? '대기' : st === 'approved' ? '승인' : '반려'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">전문가</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">이메일</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">상태</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">평점</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">리뷰</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">파트너로고</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">추천</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">액션</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr><td colSpan={7} className="text-center py-12 text-sm text-gray-400">로딩 중...</td></tr>
                ) : pros.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-12 text-sm text-gray-400">검색 결과가 없습니다</td></tr>
                ) : pros.map((pro) => (
                  <tr key={pro.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <img src={pro.image || '/images/placeholder.avif'} alt={pro.name} className="w-10 h-10 rounded-full object-cover bg-gray-100" />
                        <Link href={`/pros/${pro.id}`} className="text-sm font-semibold text-gray-900 hover:text-blue-500">{pro.name}</Link>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">{pro.email}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs font-medium px-2 py-1 rounded-full ${statusLabel[pro.status]?.className || 'bg-gray-100 text-gray-500'}`}>
                        {statusLabel[pro.status]?.text || pro.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-sm font-medium text-gray-900">{pro.avgRating?.toFixed(1) || '-'}</td>
                    <td className="px-4 py-3 text-center text-sm text-gray-600">{pro.reviewCount}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-center">
                        <button onClick={() => handleToggleLogo(pro.id)} className="transition-colors">
                          {pro.showPartnersLogo
                            ? <ToggleRight size={32} className="text-blue-500" />
                            : <ToggleLeft size={32} className="text-gray-300" />}
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-center">
                        <button onClick={() => handleToggleFeatured(pro.id)} className="transition-colors">
                          {pro.isFeatured
                            ? <ToggleRight size={32} className="text-amber-500" />
                            : <ToggleLeft size={32} className="text-gray-300" />}
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        {pro.status !== 'approved' && (
                          <button
                            onClick={() => handleApprove(pro.id)}
                            className="flex items-center gap-1 px-2.5 py-1.5 bg-green-50 text-green-600 rounded-lg text-xs font-medium hover:bg-green-100 transition-colors"
                          >
                            <Check size={12} /> 승인
                          </button>
                        )}
                        {pro.status !== 'rejected' && (
                          <button
                            onClick={() => handleReject(pro.id)}
                            className="flex items-center gap-1 px-2.5 py-1.5 bg-red-50 text-red-500 rounded-lg text-xs font-medium hover:bg-red-100 transition-colors"
                          >
                            <X size={12} /> 반려
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="border-t border-gray-200 px-4 py-3 flex items-center justify-between">
              <p className="text-xs text-gray-500">총 {total}명 ({page}/{totalPages} 페이지)</p>
              <div className="flex items-center gap-1">
                <button
                  disabled={page <= 1}
                  onClick={() => { const p = page - 1; setPage(p); fetchPros(p); }}
                  className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 disabled:opacity-30"
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="px-3 py-1 text-xs font-medium bg-blue-50 text-blue-600 rounded-lg">{page}</span>
                <button
                  disabled={page >= totalPages}
                  onClick={() => { const p = page + 1; setPage(p); fetchPros(p); }}
                  className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 disabled:opacity-30"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

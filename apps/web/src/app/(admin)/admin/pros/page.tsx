'use client';

import { useState, useEffect } from 'react';
import { Search, ToggleLeft, ToggleRight, ChevronLeft, ChevronRight, Check, X, Edit3, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/lib/store/auth.store';
import { adminFetch } from '../_components/adminFetch';

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


export default function AdminProsPage() {
  const [pros, setPros] = useState<ProItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('전체');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [lastError, setLastError] = useState<{ status?: number; message?: string } | null>(null);
  const authUser = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const LIMIT = 20;

  const fetchPros = async (p = page, s = search, st = filterStatus) => {
    setLoading(true);
    setLastError(null);
    try {
      const params: any = { page: p, limit: LIMIT };
      if (s) params.search = s;
      if (st !== '전체') params.status = st;
      const data = await adminFetch('GET', `/api/v1/admin/pros?${new URLSearchParams(params).toString()}`);
      setPros(data.data || []);
      setTotal(data.total || 0);
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || '알 수 없는 오류';
      const status = e?.response?.status;
      setLastError({ status, message: msg });
      toast.error(`목록 로드 실패${status ? ` (${status})` : ''}: ${msg}`, { duration: 6000 });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPros(); }, []);

  const handleApprove = async (id: string) => {
    try {
      await adminFetch('PATCH', `/api/v1/admin/pros/${id}/approve`);
      toast.success('승인되었습니다');
      setPros((prev) => prev.map((p) => p.id === id ? { ...p, status: 'approved' } : p));
    } catch { toast.error('승인 실패'); }
  };

  const handleReject = async (id: string) => {
    const reason = window.prompt('반려 사유 (선택)') || undefined;
    try {
      await adminFetch('PATCH', `/api/v1/admin/pros/${id}/reject`, { reason });
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

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-xl font-bold text-gray-900">전문가 관리</h1>
        <span className="ml-auto text-sm text-gray-400">총 {total}명</span>
      </div>

      {lastError && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-xl p-4 text-sm">
          <div className="flex items-start gap-3">
            <AlertCircle size={18} className="text-red-500 mt-0.5 shrink-0" />
            <div className="flex-1 space-y-1">
              <p className="font-bold text-red-700">목록 로드 실패 {lastError.status ? `(HTTP ${lastError.status})` : ''}</p>
              <p className="text-red-600 break-words">{lastError.message}</p>
              <div className="mt-2 pt-2 border-t border-red-200 space-y-0.5 text-[12px] text-red-700/80">
                <p>로그인 이메일: <code className="bg-white px-1.5 py-0.5 rounded">{authUser?.email || '(로그인 안됨)'}</code></p>
                <p>유저 role: <code className="bg-white px-1.5 py-0.5 rounded">{authUser?.role || '(없음)'}</code></p>
                <p>JWT 토큰: <code className="bg-white px-1.5 py-0.5 rounded">{accessToken ? '있음' : '없음'}</code></p>
                <p>localStorage admin-key: <code className="bg-white px-1.5 py-0.5 rounded">{(typeof window !== 'undefined' && localStorage.getItem('admin-key')) ? '있음' : '없음'}</code></p>
              </div>
              {lastError.status === 403 && (
                <p className="mt-2 text-[12px] text-red-700/80 bg-white rounded-lg px-3 py-2">
                  <strong>해결 방법:</strong>
                  <br />1) Railway 백엔드에서 <code>admin@freetiful.com</code> 유저가 DB에 존재하는지 확인
                  <br />2) 없다면 Railway 쉘에서 <code>cd apps/api && npx ts-node prisma/create-admin.ts</code> 실행
                  <br />3) 또는 <code>/admin</code> 첫 화면에서 Railway의 <code>ADMIN_SECRET_KEY</code> 값을 입력
                </p>
              )}
            </div>
          </div>
        </div>
      )}

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
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">로고</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">추천</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">액션</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={8} className="text-center py-12 text-sm text-gray-400">로딩 중...</td></tr>
              ) : pros.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-12 text-sm text-gray-400">검색 결과가 없습니다</td></tr>
              ) : pros.map((pro) => (
                <tr key={pro.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <ProAvatar src={pro.image} name={pro.name} />
                      <Link href={`/pros/${pro.id}`} target="_blank" className="text-sm font-semibold text-gray-900 hover:text-blue-500">{pro.name}</Link>
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
                          ? <ToggleRight size={28} className="text-blue-500" />
                          : <ToggleLeft size={28} className="text-gray-300" />}
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-center">
                      <button onClick={() => handleToggleFeatured(pro.id)} className="transition-colors">
                        {pro.isFeatured
                          ? <ToggleRight size={28} className="text-amber-500" />
                          : <ToggleLeft size={28} className="text-gray-300" />}
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1 flex-wrap">
                      <Link
                        href={`/admin/pros/${pro.id}/edit`}
                        className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs font-medium hover:bg-blue-100 transition-colors"
                      >
                        <Edit3 size={12} /> 수정
                      </Link>
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

        {totalPages > 1 && (
          <div className="border-t border-gray-200 px-4 py-3 flex items-center justify-between">
            <p className="text-xs text-gray-500">총 {total}명 ({page}/{totalPages})</p>
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
  );
}

function ProAvatar({ src, name }: { src?: string | null; name: string }) {
  const [err, setErr] = useState(false);
  if (!src || err) {
    return (
      <div className="w-10 h-10 rounded-full bg-[#B6CEE2] flex items-center justify-center shrink-0" aria-label={`${name} 기본 프로필`}>
        <svg viewBox="0 0 24 24" fill="#E8F1F9" className="w-6 h-6">
          <circle cx="12" cy="9" r="3.5" />
          <path d="M4.5 20.5C4.5 16 7.5 14 12 14C16.5 14 19.5 16 19.5 20.5 L4.5 20.5 Z" />
        </svg>
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={name}
      onError={() => setErr(true)}
      className="w-10 h-10 rounded-full object-cover bg-gray-100 shrink-0"
    />
  );
}


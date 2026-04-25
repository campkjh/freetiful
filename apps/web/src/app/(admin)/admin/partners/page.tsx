'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Search,
  Plus,
  Edit3,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ImageOff,
  AlertCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { AdminDateFilter, type AdminDateRange } from '../_components/AdminDateFilter';
import { adminPartnersApi, type AdminPartnerListItem } from '@/lib/api/admin-partners.api';

const statusLabel: Record<string, { text: string; className: string }> = {
  approved: { text: '승인', className: 'bg-green-50 text-green-600' },
  pending: { text: '대기', className: 'bg-yellow-50 text-yellow-600' },
  rejected: { text: '반려', className: 'bg-red-50 text-red-600' },
  draft: { text: '임시저장', className: 'bg-gray-50 text-gray-500' },
};

const LIMIT = 20;

export default function AdminPartnersPage() {
  const [items, setItems] = useState<AdminPartnerListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [lastError, setLastError] = useState<{ status?: number; message?: string } | null>(null);
  const [dateRange, setDateRange] = useState<AdminDateRange>({ startDate: '', endDate: '' });

  const fetchList = async (p = page, s = search, range = dateRange) => {
    setLoading(true);
    setLastError(null);
    try {
      const res = await adminPartnersApi.list({
        page: p,
        limit: LIMIT,
        search: s || undefined,
        startDate: range.startDate || undefined,
        endDate: range.endDate || undefined,
      });
      setItems(res.data || []);
      setTotal(res.total || 0);
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || '알 수 없는 오류';
      const status = e?.response?.status;
      setLastError({ status, message: msg });
      toast.error(`목록 로드 실패${status ? ` (${status})` : ''}: ${msg}`, { duration: 6000 });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`"${name}" 업체를 삭제하시겠습니까?\n(이미지/카테고리 연결도 함께 삭제됩니다)`)) return;
    try {
      await adminPartnersApi.remove(id);
      toast.success('삭제되었습니다');
      setItems((prev) => prev.filter((p) => p.id !== id));
      setTotal((t) => Math.max(0, t - 1));
    } catch (e: any) {
      toast.error(`삭제 실패: ${e?.response?.data?.message || e?.message || ''}`);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-xl font-bold text-gray-900">웨딩 파트너 업체</h1>
        <span className="ml-auto text-sm text-gray-400">총 {total}개</span>
        <Link
          href="/admin/partners/new"
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#3182F6] text-white text-sm font-semibold hover:bg-[#1B64DA]"
        >
          <Plus size={14} /> 추가
        </Link>
      </div>

      {lastError && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-xl p-4 text-sm">
          <div className="flex items-start gap-3">
            <AlertCircle size={18} className="text-red-500 mt-0.5 shrink-0" />
            <div className="flex-1 space-y-1">
              <p className="font-bold text-red-700">
                목록 로드 실패 {lastError.status ? `(HTTP ${lastError.status})` : ''}
              </p>
              <p className="text-red-600 break-words">{lastError.message}</p>
            </div>
          </div>
        </div>
      )}

      {/* 검색 */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                setPage(1);
                fetchList(1, search, dateRange);
              }
            }}
            placeholder="업체명 / 카테고리 / 주소 검색 (Enter)"
            className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
          />
        </div>
      </div>

      <AdminDateFilter
        value={dateRange}
        onApply={(range) => {
          setDateRange(range);
          setPage(1);
          fetchList(1, search, range);
        }}
      />

      {/* 테이블 */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">이미지</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">업체명</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">카테고리</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">주소</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">전화</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">등록일</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">상태</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">액션</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-sm text-gray-400">
                    로딩 중...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-sm text-gray-400">
                    등록된 업체가 없습니다
                  </td>
                </tr>
              ) : (
                items.map((b) => {
                  const thumb = b.images?.[0]?.imageUrl || null;
                  const cats = b.categories?.map((c) => c.category?.name).filter(Boolean) || [];
                  return (
                    <tr key={b.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <Thumb src={thumb} alt={b.businessName} />
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold text-gray-900">
                        <Link
                          href={`/admin/partners/${b.id}`}
                          className="hover:text-blue-500 transition-colors"
                        >
                          {b.businessName}
                        </Link>
                        {b.businessType && (
                          <div className="text-[11px] text-gray-400 font-normal mt-0.5">
                            {b.businessType}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {cats.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {cats.map((c) => (
                              <span
                                key={c}
                                className="text-[11px] px-2 py-0.5 rounded-md bg-blue-50 text-blue-600 font-medium"
                              >
                                {c}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-300">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{b.address || '-'}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{b.phone || '-'}</td>
                      <td className="px-4 py-3 text-center text-xs text-gray-500">
                        {b.createdAt ? new Date(b.createdAt).toLocaleDateString('ko-KR') : '-'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`text-xs font-medium px-2 py-1 rounded-full ${
                            statusLabel[b.status]?.className || 'bg-gray-100 text-gray-500'
                          }`}
                        >
                          {statusLabel[b.status]?.text || b.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1 flex-wrap">
                          <Link
                            href={`/admin/partners/${b.id}`}
                            className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs font-medium hover:bg-blue-100 transition-colors"
                          >
                            <Edit3 size={12} /> 수정
                          </Link>
                          <button
                            onClick={() => handleDelete(b.id, b.businessName)}
                            className="flex items-center gap-1 px-2.5 py-1.5 bg-red-50 text-red-500 rounded-lg text-xs font-medium hover:bg-red-100 transition-colors"
                          >
                            <Trash2 size={12} /> 삭제
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="border-t border-gray-200 px-4 py-3 flex items-center justify-between">
            <p className="text-xs text-gray-500">
              총 {total}개 ({page}/{totalPages})
            </p>
            <div className="flex items-center gap-1">
              <button
                disabled={page <= 1}
                onClick={() => {
                  const p = page - 1;
                  setPage(p);
                  fetchList(p, search, dateRange);
                }}
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 disabled:opacity-30"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="px-3 py-1 text-xs font-medium bg-blue-50 text-blue-600 rounded-lg">
                {page}
              </span>
              <button
                disabled={page >= totalPages}
                onClick={() => {
                  const p = page + 1;
                  setPage(p);
                  fetchList(p, search, dateRange);
                }}
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

function Thumb({ src, alt }: { src: string | null; alt: string }) {
  const [err, setErr] = useState(false);
  if (!src || err) {
    return (
      <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
        <ImageOff size={16} className="text-gray-300" />
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      onError={() => setErr(true)}
      className="w-12 h-12 rounded-lg object-cover bg-gray-100 shrink-0"
    />
  );
}

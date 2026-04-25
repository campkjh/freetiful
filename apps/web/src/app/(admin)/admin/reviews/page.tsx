'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, ChevronLeft, ChevronRight, Trash2, RefreshCw, Star } from 'lucide-react';
import toast from 'react-hot-toast';
import { AdminErrorPanel, extractAdminError, type AdminErrorInfo } from '../_components/ErrorPanel';
import { AdminDateFilter, type AdminDateRange } from '../_components/AdminDateFilter';
import { adminFetch } from '../_components/adminFetch';

interface ReviewItem {
  id: string;
  reviewerName: string;
  proName: string;
  avgRating: number;
  comment: string;
  createdAt: string;
  isAnonymous: boolean;
}

export default function AdminReviewsPage() {
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [lastError, setLastError] = useState<AdminErrorInfo | null>(null);
  const [dateRange, setDateRange] = useState<AdminDateRange>({ startDate: '', endDate: '' });
  const LIMIT = 20;

  const fetchReviews = async (p = page, range = dateRange) => {
    setLoading(true);
    setLastError(null);
    try {
      const params = new URLSearchParams({ page: String(p), limit: String(LIMIT) });
      if (range.startDate) params.set('startDate', range.startDate);
      if (range.endDate) params.set('endDate', range.endDate);
      const data = await adminFetch('GET', `/api/v1/admin/reviews?${params.toString()}`);
      setReviews(data.data || []);
      setTotal(data.total || 0);
    } catch (e: any) {
      const err = extractAdminError(e);
      setLastError(err);
      toast.error(`리뷰 로드 실패${err.status ? ` (${err.status})` : ''}: ${err.message}`, { duration: 6000 });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchReviews(); }, []);

  const handleDelete = async (id: string) => {
    if (!confirm('이 리뷰를 삭제하시겠습니까?')) return;
    try {
      await adminFetch('DELETE', `/api/v1/admin/reviews/${id}`);
      toast.success('삭제되었습니다');
      setReviews((prev) => prev.filter((r) => r.id !== id));
      setTotal((t) => t - 1);
    } catch { toast.error('삭제 실패'); }
  };

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 px-1">
        <Link href="/admin" className="admin-icon-button flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#6B7684] shadow-[0_6px_16px_rgba(2,32,71,0.04)] hover:bg-[#F2F4F6]">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <p className="text-[12px] font-bold text-[#3182F6]">리뷰 운영</p>
          <h1 className="mt-1 text-[24px] font-black text-[#191F28] tracking-tight">리뷰 관리</h1>
        </div>
        <span className="ml-auto rounded-full bg-white px-3 py-1.5 text-[12px] font-bold text-[#6B7684] shadow-[0_6px_16px_rgba(2,32,71,0.04)]">총 {total.toLocaleString()}건</span>
        <button
          onClick={() => fetchReviews(page, dateRange)}
          disabled={loading}
          className="admin-icon-button flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#6B7684] shadow-[0_6px_16px_rgba(2,32,71,0.04)] hover:bg-[#F2F4F6] disabled:opacity-50"
          title="새로고침"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

        <AdminErrorPanel error={lastError} label="리뷰" />
        <AdminDateFilter
          value={dateRange}
          onApply={(range) => {
            setDateRange(range);
            setPage(1);
            fetchReviews(1, range);
          }}
        />
        <div className="admin-list-card">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">작성자</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">전문가</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">평점</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">내용</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">날짜</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">액션</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i}>
                      <td colSpan={6} className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="skeleton h-3 w-24" />
                          <div className="skeleton h-3 w-24" />
                          <div className="skeleton h-3 w-16" />
                          <div className="skeleton h-3 flex-1" />
                        </div>
                      </td>
                    </tr>
                  ))
                ) : reviews.length === 0 ? (
                  <tr><td colSpan={6} className="admin-empty-state text-center py-14 text-sm font-semibold">리뷰가 없습니다</td></tr>
                ) : reviews.map((review) => (
                  <tr key={review.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {review.isAnonymous ? <span className="text-gray-400 italic">익명</span> : review.reviewerName || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{review.proName || '-'}</td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-0.5">
                        <Star size={12} className="fill-amber-400 text-amber-400" />
                        <span className="text-sm font-bold text-gray-900">{Number(review.avgRating).toFixed(1)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 max-w-[300px] truncate">{review.comment || '-'}</td>
                    <td className="px-4 py-3 text-center text-xs text-gray-400">
                      {new Date(review.createdAt).toLocaleDateString('ko-KR', { year: '2-digit', month: '2-digit', day: '2-digit' })}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => handleDelete(review.id)}
                        className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="border-t border-[#F2F4F6] px-4 py-3 flex items-center justify-between">
              <p className="text-xs text-gray-500">총 {total}건 ({page}/{totalPages} 페이지)</p>
              <div className="flex items-center gap-1">
                <button disabled={page <= 1} onClick={() => { const p = page - 1; setPage(p); fetchReviews(p, dateRange); }} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 disabled:opacity-30"><ChevronLeft size={16} /></button>
                <span className="px-3 py-1 text-xs font-bold bg-blue-50 text-blue-600 rounded-full">{page}</span>
                <button disabled={page >= totalPages} onClick={() => { const p = page + 1; setPage(p); fetchReviews(p, dateRange); }} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 disabled:opacity-30"><ChevronRight size={16} /></button>
              </div>
            </div>
          )}
        </div>
    </div>
  );
}

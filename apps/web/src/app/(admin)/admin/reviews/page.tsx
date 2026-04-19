'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, ChevronLeft, ChevronRight, Trash2, RefreshCw, Star } from 'lucide-react';
import toast from 'react-hot-toast';
import { apiClient } from '@/lib/api/client';

async function adminFetch(method: string, path: string) {
  const res = await apiClient.request({ method, url: path });
  return res.data;
}

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
  const LIMIT = 20;

  const fetchReviews = async (p = page) => {
    setLoading(true);
    try {
      const data = await adminFetch('GET', `/api/v1/admin/reviews?page=${p}&limit=${LIMIT}`);
      setReviews(data.data || []);
      setTotal(data.total || 0);
    } catch {
      toast.error('목록을 불러오지 못했습니다');
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
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center gap-3">
          <Link href="/admin" className="p-1 hover:bg-gray-100 rounded-lg"><ArrowLeft size={20} /></Link>
          <h1 className="text-lg font-bold text-gray-900">리뷰 관리</h1>
          <span className="ml-auto text-sm text-gray-400">총 {total}건</span>
          <button onClick={() => fetchReviews(page)} className="p-2 hover:bg-gray-100 rounded-lg">
            <RefreshCw size={16} className="text-gray-500" />
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-6">
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
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
                  <tr><td colSpan={6} className="text-center py-12 text-sm text-gray-400">로딩 중...</td></tr>
                ) : reviews.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-12 text-sm text-gray-400">리뷰가 없습니다</td></tr>
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
            <div className="border-t border-gray-200 px-4 py-3 flex items-center justify-between">
              <p className="text-xs text-gray-500">총 {total}건 ({page}/{totalPages} 페이지)</p>
              <div className="flex items-center gap-1">
                <button disabled={page <= 1} onClick={() => { const p = page - 1; setPage(p); fetchReviews(p); }} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 disabled:opacity-30"><ChevronLeft size={16} /></button>
                <span className="px-3 py-1 text-xs font-medium bg-blue-50 text-blue-600 rounded-lg">{page}</span>
                <button disabled={page >= totalPages} onClick={() => { const p = page + 1; setPage(p); fetchReviews(p); }} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 disabled:opacity-30"><ChevronRight size={16} /></button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

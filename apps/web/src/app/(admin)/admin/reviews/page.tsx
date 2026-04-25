'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, Trash2, RefreshCw, Star, Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import { AdminErrorPanel, extractAdminError, type AdminErrorInfo } from '../_components/ErrorPanel';
import { AdminDateFilter, type AdminDateRange } from '../_components/AdminDateFilter';
import { AdminExportButton, exportRowsToXls, fetchAllAdminRows, formatExportDate } from '../_components/AdminExportButton';
import { AdminTerm } from '../_components/AdminHelpTooltip';
import { AdminInfiniteScroll, appendUniqueById } from '../_components/AdminInfiniteScroll';
import { AdminSwitch } from '../_components/AdminSwitch';
import { adminFetch } from '../_components/adminFetch';

interface ReviewItem {
  id: string;
  reviewerName: string;
  proName: string;
  avgRating: number;
  comment: string;
  createdAt: string;
  isAnonymous: boolean;
  isVisible?: boolean;
  adminCreated?: boolean;
  eventDate?: string | null;
  eventTime?: string | null;
  eventLocation?: string | null;
  eventTitle?: string | null;
  amount?: number;
}

interface ProOption {
  id: string;
  name: string;
  email?: string;
}

const toDateTimeLocal = (date = new Date()) => {
  const offsetMs = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
};

const emptyDraft = () => ({
  proProfileId: '',
  reviewerName: '',
  reviewerEmail: '',
  ratingSatisfaction: 5,
  ratingComposition: 5,
  ratingExperience: 5,
  ratingAppearance: 5,
  ratingVoice: 5,
  ratingWit: 5,
  comment: '',
  eventTitle: '결혼식 사회',
  eventDate: '',
  eventTime: '',
  eventLocation: '',
  reviewCreatedAt: toDateTimeLocal(),
  amount: 0,
  isAnonymous: false,
  isVisible: true,
});

function formatDate(value?: string | null) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('ko-KR', { year: '2-digit', month: '2-digit', day: '2-digit' });
}

function formatTime(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
}

export default function AdminReviewsPage() {
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [lastError, setLastError] = useState<AdminErrorInfo | null>(null);
  const [dateRange, setDateRange] = useState<AdminDateRange>({ startDate: '', endDate: '' });
  const [pros, setPros] = useState<ProOption[]>([]);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState(emptyDraft);
  const LIMIT = 20;

  const fetchReviews = async (p = page, range = dateRange, append = false) => {
    if (append) setLoadingMore(true);
    else setLoading(true);
    setLastError(null);
    try {
      const params = new URLSearchParams({ page: String(p), limit: String(LIMIT) });
      if (range.startDate) params.set('startDate', range.startDate);
      if (range.endDate) params.set('endDate', range.endDate);
      const data = await adminFetch('GET', `/api/v1/admin/reviews?${params.toString()}`);
      const nextReviews = data.data || [];
      setReviews((prev) => append ? appendUniqueById(prev, nextReviews) : nextReviews);
      setTotal(data.total || 0);
      setPage(p);
    } catch (e: any) {
      const err = extractAdminError(e);
      setLastError(err);
      toast.error(`리뷰 로드 실패${err.status ? ` (${err.status})` : ''}: ${err.message}`, { duration: 6000 });
    } finally {
      if (append) setLoadingMore(false);
      else setLoading(false);
    }
  };

  const fetchPros = async () => {
    try {
      const data = await adminFetch('GET', '/api/v1/admin/pros?limit=200&status=approved');
      const list = (data.data || []).map((pro: any) => ({
        id: pro.id,
        name: pro.name,
        email: pro.email,
      }));
      setPros(list);
      setDraft((prev) => prev.proProfileId ? prev : { ...prev, proProfileId: list[0]?.id || '' });
    } catch {
      toast.error('사회자 목록 로드 실패');
    }
  };

  useEffect(() => {
    fetchReviews();
    fetchPros();
  }, []);

  const handleCreate = async () => {
    if (!draft.proProfileId) { toast.error('사회자를 선택해주세요'); return; }
    if (!draft.reviewerName.trim()) { toast.error('작성자명을 입력해주세요'); return; }
    if (!draft.comment.trim()) { toast.error('리뷰 내용을 입력해주세요'); return; }
    setCreating(true);
    try {
      await adminFetch('POST', '/api/v1/admin/reviews', draft);
      toast.success('관리자 리뷰가 등록되었습니다');
      setDraft((prev) => ({ ...emptyDraft(), proProfileId: prev.proProfileId }));
      fetchReviews(1, dateRange);
    } catch (e: any) {
      const err = extractAdminError(e);
      toast.error(`리뷰 등록 실패${err.status ? ` (${err.status})` : ''}: ${err.message}`, { duration: 6000 });
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('이 리뷰를 삭제하시겠습니까?')) return;
    try {
      await adminFetch('DELETE', `/api/v1/admin/reviews/${id}`);
      toast.success('삭제되었습니다');
      setReviews((prev) => prev.filter((r) => r.id !== id));
      setTotal((t) => t - 1);
    } catch { toast.error('삭제 실패'); }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const rows = await fetchAllAdminRows<ReviewItem>({
        fetchPage: async (p, limit) => {
          const params = new URLSearchParams({ page: String(p), limit: String(limit) });
          if (dateRange.startDate) params.set('startDate', dateRange.startDate);
          if (dateRange.endDate) params.set('endDate', dateRange.endDate);
          const data = await adminFetch('GET', `/api/v1/admin/reviews?${params.toString()}`, undefined, { cache: false });
          return { rows: data.data || [], total: data.total };
        },
      });

      exportRowsToXls('admin-reviews', '리뷰 관리', rows, [
        { header: '순번', value: (_, index) => index + 1 },
        { header: '리뷰ID', value: (row) => row.id },
        { header: '작성자', value: (row) => row.isAnonymous ? '익명' : row.reviewerName || '' },
        { header: '전문가', value: (row) => row.proName || '' },
        { header: '평점', value: (row) => Number(row.avgRating).toFixed(1) },
        { header: '내용', value: (row) => row.comment || '' },
        { header: '행사명', value: (row) => row.eventTitle || '' },
        { header: '행사일', value: (row) => formatExportDate(row.eventDate) },
        { header: '행사시간', value: (row) => formatTime(row.eventTime) },
        { header: '행사장소', value: (row) => row.eventLocation || '' },
        { header: '금액', value: (row) => row.amount ?? '' },
        { header: '리뷰일', value: (row) => formatExportDate(row.createdAt, true) },
        { header: '관리자등록', value: (row) => !!row.adminCreated },
        { header: '익명', value: (row) => row.isAnonymous },
        { header: '노출', value: (row) => row.isVisible !== false },
      ]);
      toast.success(`${rows.length.toLocaleString()}건 엑셀 다운로드 완료`);
    } catch (e: any) {
      toast.error(`엑셀 다운로드 실패: ${e?.response?.data?.message || e?.message || ''}`);
    } finally {
      setExporting(false);
    }
  };

  const hasMore = reviews.length < total;

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
        <AdminExportButton loading={exporting} onClick={handleExport} />
        <button
          onClick={() => fetchReviews(1, dateRange)}
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
        <div className="admin-list-card border-y border-[#E5E8EB] py-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-[12px] font-normal text-[#B0B8C1]">관리자 등록</p>
              <h2 className="mt-1 text-[16px] font-bold text-[#191F28]">사회자 리뷰 직접 등록</h2>
            </div>
            <button
              onClick={handleCreate}
              disabled={creating}
              className="admin-icon-button inline-flex h-10 items-center gap-1.5 rounded-lg bg-[#3180F7] px-4 text-[13px] font-semibold text-white hover:bg-[#1B64DA] disabled:opacity-50"
            >
              <Plus size={15} /> {creating ? '등록 중' : '리뷰 등록'}
            </button>
          </div>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-4">
            <div>
              <label className="mb-1.5 block text-[12px] font-medium text-[#8B95A1]">사회자</label>
              <select
                value={draft.proProfileId}
                onChange={(e) => setDraft({ ...draft, proProfileId: e.target.value })}
                className="h-11 w-full rounded-lg bg-[#F9FAFB] px-3 text-[13px] text-[#191F28] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#3180F7]"
              >
                <option value="">사회자 선택</option>
                {pros.map((pro) => (
                  <option key={pro.id} value={pro.id}>{pro.name}{pro.email ? ` · ${pro.email}` : ''}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-[12px] font-medium text-[#8B95A1]">작성자명</label>
              <input
                value={draft.reviewerName}
                onChange={(e) => setDraft({ ...draft, reviewerName: e.target.value })}
                placeholder="예: 김민지"
                className="h-11 w-full rounded-lg bg-[#F9FAFB] px-3 text-[13px] text-[#191F28] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#3180F7]"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[12px] font-medium text-[#8B95A1]">작성자 이메일</label>
              <input
                value={draft.reviewerEmail}
                onChange={(e) => setDraft({ ...draft, reviewerEmail: e.target.value })}
                placeholder="선택 입력"
                className="h-11 w-full rounded-lg bg-[#F9FAFB] px-3 text-[13px] text-[#191F28] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#3180F7]"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[12px] font-medium text-[#8B95A1]">
                <AdminTerm term="리뷰 작성일">리뷰 작성일</AdminTerm>
              </label>
              <input
                type="datetime-local"
                value={draft.reviewCreatedAt}
                onChange={(e) => setDraft({ ...draft, reviewCreatedAt: e.target.value })}
                className="h-11 w-full rounded-lg bg-[#F9FAFB] px-3 text-[13px] text-[#191F28] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#3180F7]"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[12px] font-medium text-[#8B95A1]">행사명</label>
              <input
                value={draft.eventTitle}
                onChange={(e) => setDraft({ ...draft, eventTitle: e.target.value })}
                className="h-11 w-full rounded-lg bg-[#F9FAFB] px-3 text-[13px] text-[#191F28] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#3180F7]"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[12px] font-medium text-[#8B95A1]">행사일</label>
              <input
                type="date"
                value={draft.eventDate}
                onChange={(e) => setDraft({ ...draft, eventDate: e.target.value })}
                className="h-11 w-full rounded-lg bg-[#F9FAFB] px-3 text-[13px] text-[#191F28] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#3180F7]"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[12px] font-medium text-[#8B95A1]">행사시간</label>
              <input
                type="time"
                value={draft.eventTime}
                onChange={(e) => setDraft({ ...draft, eventTime: e.target.value })}
                className="h-11 w-full rounded-lg bg-[#F9FAFB] px-3 text-[13px] text-[#191F28] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#3180F7]"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[12px] font-medium text-[#8B95A1]">행사장소</label>
              <input
                value={draft.eventLocation}
                onChange={(e) => setDraft({ ...draft, eventLocation: e.target.value })}
                placeholder="예: 더채플앳청담"
                className="h-11 w-full rounded-lg bg-[#F9FAFB] px-3 text-[13px] text-[#191F28] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#3180F7]"
              />
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-7">
            {[
              ['ratingSatisfaction', '만족도'],
              ['ratingComposition', '구성'],
              ['ratingExperience', '경험'],
              ['ratingAppearance', '외형'],
              ['ratingVoice', '목소리'],
              ['ratingWit', '센스'],
            ].map(([key, label]) => (
              <div key={key}>
                <label className="mb-1.5 block text-[12px] font-medium text-[#8B95A1]">{label}</label>
                <input
                  type="number"
                  min={1}
                  max={5}
                  step={1}
                  value={(draft as any)[key]}
                  onChange={(e) => setDraft({ ...draft, [key]: Number(e.target.value) } as any)}
                  className="h-11 w-full rounded-lg bg-[#F9FAFB] px-3 text-[13px] text-[#191F28] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#3180F7]"
                />
              </div>
            ))}
            <div>
              <label className="mb-1.5 block text-[12px] font-medium text-[#8B95A1]">금액</label>
              <input
                type="number"
                min={0}
                value={draft.amount}
                onChange={(e) => setDraft({ ...draft, amount: Number(e.target.value) })}
                className="h-11 w-full rounded-lg bg-[#F9FAFB] px-3 text-[13px] text-[#191F28] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#3180F7]"
              />
            </div>
          </div>
          <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-[1fr_auto_auto]">
            <textarea
              value={draft.comment}
              onChange={(e) => setDraft({ ...draft, comment: e.target.value })}
              placeholder="리뷰 내용을 입력하세요"
              rows={3}
              className="w-full resize-y rounded-lg bg-[#F9FAFB] px-3 py-3 text-[13px] text-[#191F28] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#3180F7]"
            />
            <div className="flex items-center rounded-lg bg-[#F9FAFB] px-4 py-3">
              <AdminSwitch
                checked={draft.isAnonymous}
                onChange={(checked) => setDraft({ ...draft, isAnonymous: checked })}
                label={<AdminTerm term="익명">익명</AdminTerm>}
                ariaLabel="익명"
              />
            </div>
            <div className="flex items-center rounded-lg bg-[#F9FAFB] px-4 py-3">
              <AdminSwitch
                checked={draft.isVisible}
                onChange={(checked) => setDraft({ ...draft, isVisible: checked })}
                label={<AdminTerm term="노출">노출</AdminTerm>}
                ariaLabel="노출"
              />
            </div>
          </div>
        </div>
        <div className="admin-list-card">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px]">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">작성자</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">전문가</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">평점</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">내용</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">행사</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">리뷰일</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase"><AdminTerm term="구분">구분</AdminTerm></th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">액션</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i}>
                      <td colSpan={8} className="px-4 py-3">
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
                  <tr><td colSpan={8} className="admin-empty-state text-center py-14 text-sm font-semibold">리뷰가 없습니다</td></tr>
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
                    <td className="px-4 py-3 text-xs text-gray-500">
                      <p className="font-semibold text-gray-700">{review.eventTitle || '-'}</p>
                      <p className="mt-0.5">{formatDate(review.eventDate)} {formatTime(review.eventTime)}</p>
                      {review.eventLocation && <p className="mt-0.5 max-w-[180px] truncate">{review.eventLocation}</p>}
                    </td>
                    <td className="px-4 py-3 text-center text-xs text-gray-400">
                      {formatDate(review.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`rounded-lg px-2 py-1 text-[12px] font-semibold ${review.adminCreated ? 'bg-[#F3F8FF] text-[#3180F7]' : 'bg-gray-50 text-gray-500'}`}>
                        {review.adminCreated ? '관리자' : '유저'}
                      </span>
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

          <AdminInfiniteScroll
            hasMore={hasMore}
            loading={loadingMore}
            loaded={reviews.length}
            total={total}
            onLoadMore={() => {
              if (!hasMore || loading || loadingMore) return;
              fetchReviews(page + 1, dateRange, true);
            }}
          />
        </div>
    </div>
  );
}

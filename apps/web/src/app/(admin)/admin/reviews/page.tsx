'use client';

import { useState, useEffect } from 'react';
import { Trash2, Star, Plus } from '@/app/(admin)/admin/_components/admin-icons';
import toast from 'react-hot-toast';
import { AdminErrorPanel, extractAdminError, type AdminErrorInfo } from '../_components/ErrorPanel';
import { AdminDateFilter, type AdminDateRange } from '../_components/AdminDateFilter';
import { AdminExportButton, exportRowsToXls, fetchAllAdminRows, formatExportDate } from '../_components/AdminExportButton';
import { AdminTerm } from '../_components/AdminHelpTooltip';
import { AdminInfiniteScroll, appendUniqueById } from '../_components/AdminInfiniteScroll';
import { AdminSwitch } from '../_components/AdminSwitch';
import { adminFetch } from '../_components/adminFetch';
import { useAdminRefresh } from '../_components/adminRefresh';

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
  /** 평점 하나(261004 사장 '경험·외형·목소리 등등 없애줘') — 서버엔 항목 6개를 같은 값으로 보내 평균 = 이 값 */
  rating: 5,
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
  /** 직접 등록 칸 — 평소엔 접어 두고 도구막대 버튼으로 연다(어드민 2.0) */
  const [formOpen, setFormOpen] = useState(false);
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
      const { rating, ...rest } = draft;
      await adminFetch('POST', '/api/v1/admin/reviews', {
        ...rest,
        ratingSatisfaction: rating,
        ratingComposition: rating,
        ratingExperience: rating,
        ratingAppearance: rating,
        ratingVoice: rating,
        ratingWit: rating,
      });
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

  // ── 인라인 편집 + 자동저장(버튼 없이 onBlur 시 저장) ──
  const editLocal = (id: string, patch: Partial<ReviewItem>) => {
    setReviews((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };
  const saveReviewField = async (id: string, field: 'comment' | 'reviewerName' | 'createdAt', value: string) => {
    try {
      await adminFetch('PATCH', `/api/v1/admin/reviews/${id}`, { [field]: value });
    } catch {
      toast.error('저장 실패 — 다시 시도해주세요');
    }
  };
  const toDateInput = (v?: string) => {
    if (!v) return '';
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return '';
    return new Date(d.getTime() + 9 * 3600000).toISOString().slice(0, 10);
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
        { header: '사회자', value: (row) => row.proName || '' },
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

  // 머리 오른쪽 새로고침(종 옆)
  useAdminRefresh(() => fetchReviews(1, dateRange));

  return (
    <div className="space-y-5">
      {/* 도구막대 — 제목은 레이아웃 머리(리뷰 관리) */}
      {/* 검색·거르기 + 조회기간 = 한 덩어리(261004 사장 '조회기간 섹션이랑 합쳐져야 해') */}
      <div className="adm-filter">
        <div className="adm-toolbar">
          <button type="button" onClick={() => setFormOpen((v) => !v)} className={`adm-btn ${formOpen ? 'weak' : 'primary'}`} aria-expanded={formOpen}>
            <Plus size={15} /> {formOpen ? '등록 칸 닫기' : '리뷰 직접 등록'}
          </button>
          <span className="grow" />
          <span className="adm-count">총 <b>{total.toLocaleString()}</b>건</span>
          <AdminExportButton loading={exporting} onClick={handleExport} />
        </div>
        <AdminDateFilter
          value={dateRange}
          onApply={(range) => {
            setDateRange(range);
            setPage(1);
            fetchReviews(1, range);
          }}
        />
      </div>

        <AdminErrorPanel error={lastError} label="리뷰" />
        {formOpen && (
        <div className="adm-card adm-form">
          <div className="adm-card-head">
            <div>
              <h2 className="adm-card-title">사회자 리뷰 직접 등록</h2>
              <p className="adm-card-sub">관리자가 받은 후기를 대신 올려요. 노출을 끄면 목록에만 남아요</p>
            </div>
            <button type="button" onClick={handleCreate} disabled={creating} className="adm-btn primary">
              {creating ? '등록 중' : '등록하기'}
            </button>
          </div>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-4">
            <div>
              <label className="adm-label">사회자</label>
              <select
                value={draft.proProfileId}
                onChange={(e) => setDraft({ ...draft, proProfileId: e.target.value })}
                className="adm-input"
              >
                <option value="">사회자 선택</option>
                {pros.map((pro) => (
                  <option key={pro.id} value={pro.id}>{pro.name}{pro.email ? ` · ${pro.email}` : ''}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="adm-label">작성자명</label>
              <input
                value={draft.reviewerName}
                onChange={(e) => setDraft({ ...draft, reviewerName: e.target.value })}
                placeholder="예: 김민지"
                className="adm-input"
              />
            </div>
            <div>
              <label className="adm-label">작성자 이메일</label>
              <input
                value={draft.reviewerEmail}
                onChange={(e) => setDraft({ ...draft, reviewerEmail: e.target.value })}
                placeholder="선택 입력"
                className="adm-input"
              />
            </div>
            <div>
              <label className="adm-label">
                <AdminTerm term="리뷰 작성일">리뷰 작성일</AdminTerm>
              </label>
              <input
                type="datetime-local"
                value={draft.reviewCreatedAt}
                onChange={(e) => setDraft({ ...draft, reviewCreatedAt: e.target.value })}
                className="adm-input"
              />
            </div>
            <div>
              <label className="adm-label">행사명</label>
              <input
                value={draft.eventTitle}
                onChange={(e) => setDraft({ ...draft, eventTitle: e.target.value })}
                className="adm-input"
              />
            </div>
            <div>
              <label className="adm-label">행사일</label>
              <input
                type="date"
                value={draft.eventDate}
                onChange={(e) => setDraft({ ...draft, eventDate: e.target.value })}
                className="adm-input"
              />
            </div>
            <div>
              <label className="adm-label">행사시간</label>
              <input
                type="time"
                value={draft.eventTime}
                onChange={(e) => setDraft({ ...draft, eventTime: e.target.value })}
                className="adm-input"
              />
            </div>
            <div>
              <label className="adm-label">행사장소</label>
              <input
                value={draft.eventLocation}
                onChange={(e) => setDraft({ ...draft, eventLocation: e.target.value })}
                placeholder="예: 더채플앳청담"
                className="adm-input"
              />
            </div>
          </div>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="adm-label">평점</label>
              <div className="adm-stars" role="radiogroup" aria-label="평점">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    role="radio"
                    aria-checked={draft.rating === n}
                    aria-label={`${n}점`}
                    onClick={() => setDraft({ ...draft, rating: n })}
                    className={`adm-star ${n <= draft.rating ? 'on' : ''}`}
                  >
                    <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M12 2.8l2.75 5.57 6.15.9-4.45 4.34 1.05 6.12L12 16.84l-5.5 2.89 1.05-6.12L3.1 9.27l6.15-.9L12 2.8z" />
                    </svg>
                  </button>
                ))}
                <span className="adm-stars-num">{draft.rating}.0</span>
              </div>
            </div>
            <div>
              <label className="adm-label">금액</label>
              <input
                type="number"
                min={0}
                value={draft.amount}
                onChange={(e) => setDraft({ ...draft, amount: Number(e.target.value) })}
                className="adm-input"
              />
            </div>
          </div>
          <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-[1fr_auto_auto]">
            <textarea
              value={draft.comment}
              onChange={(e) => setDraft({ ...draft, comment: e.target.value })}
              placeholder="리뷰 내용을 입력하세요"
              rows={3}
              className="adm-input adm-textarea"
            />
            <div className="flex items-center rounded-[12px] bg-[#F2F4F6] px-4 py-3">
              <AdminSwitch
                checked={draft.isAnonymous}
                onChange={(checked) => setDraft({ ...draft, isAnonymous: checked })}
                label={<AdminTerm term="익명">익명</AdminTerm>}
                ariaLabel="익명"
              />
            </div>
            <div className="flex items-center rounded-[12px] bg-[#F2F4F6] px-4 py-3">
              <AdminSwitch
                checked={draft.isVisible}
                onChange={(checked) => setDraft({ ...draft, isVisible: checked })}
                label={<AdminTerm term="노출">노출</AdminTerm>}
                ariaLabel="노출"
              />
            </div>
          </div>
        </div>
        )}
        <div className="admin-list-card">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px]">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left px-4 py-3">작성자</th>
                  <th className="text-left px-4 py-3">사회자</th>
                  <th className="text-center px-4 py-3">평점</th>
                  <th className="text-left px-4 py-3">내용</th>
                  <th className="text-left px-4 py-3">행사</th>
                  <th className="text-center px-4 py-3">리뷰일</th>
                  <th className="text-center px-4 py-3"><AdminTerm term="구분">구분</AdminTerm></th>
                  <th className="text-center px-4 py-3">액션</th>
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
                  <tr><td colSpan={8} className="adm-empty">리뷰가 없어요</td></tr>
                ) : reviews.map((review) => (
                  <tr key={review.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-sm text-gray-700">
                      <input
                        value={review.reviewerName || ''}
                        onChange={(e) => editLocal(review.id, { reviewerName: e.target.value })}
                        onBlur={(e) => saveReviewField(review.id, 'reviewerName', e.target.value)}
                        placeholder={review.isAnonymous ? '익명' : '작성자'}
                        className="w-full min-w-[70px] rounded bg-transparent px-1 py-0.5 text-sm text-gray-700 outline-none hover:bg-gray-100 focus:bg-white focus:ring-1 focus:ring-[#3180F7]"
                      />
                    </td>
                    <td className="px-4 py-3"><span className="adm-cell-main">{review.proName || '-'}</span></td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-0.5">
                        <Star size={12} className="fill-amber-400 text-amber-400" />
                        <span className="text-sm font-bold text-gray-900">{Number(review.avgRating).toFixed(1)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 max-w-[300px]">
                      <input
                        value={review.comment || ''}
                        onChange={(e) => editLocal(review.id, { comment: e.target.value })}
                        onBlur={(e) => saveReviewField(review.id, 'comment', e.target.value)}
                        placeholder="리뷰 내용"
                        className="w-full min-w-[160px] rounded bg-transparent px-1 py-0.5 text-sm text-gray-700 outline-none hover:bg-gray-100 focus:bg-white focus:ring-1 focus:ring-[#3180F7]"
                      />
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      <p className="font-semibold text-gray-700">{review.eventTitle || '-'}</p>
                      <p className="mt-0.5">{formatDate(review.eventDate)} {formatTime(review.eventTime)}</p>
                      {review.eventLocation && <p className="mt-0.5 max-w-[180px] truncate">{review.eventLocation}</p>}
                    </td>
                    <td className="px-4 py-3 text-center text-xs text-gray-400">
                      <input
                        type="date"
                        value={toDateInput(review.createdAt)}
                        onChange={(e) => editLocal(review.id, { createdAt: e.target.value })}
                        onBlur={(e) => { if (e.target.value) saveReviewField(review.id, 'createdAt', e.target.value); }}
                        className="rounded bg-transparent px-1 py-0.5 text-xs text-gray-600 outline-none hover:bg-gray-100 focus:bg-white focus:ring-1 focus:ring-[#3180F7] [color-scheme:light]"
                      />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`adm-badge ${review.adminCreated ? 'blue' : ''}`}>
                        {review.adminCreated ? '관리자' : '유저'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        type="button"
                        onClick={() => handleDelete(review.id)}
                        className="adm-btn icon sm ghost"
                        aria-label="리뷰 삭제"
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

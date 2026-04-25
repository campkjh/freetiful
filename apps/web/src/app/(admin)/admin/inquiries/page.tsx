'use client';

import { useEffect, useState } from 'react';
import {
  Mail,
  MessageSquareText,
  Paperclip,
  Phone,
  RefreshCw,
  Save,
  Search,
  Trash2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { AdminDateFilter, type AdminDateRange } from '../_components/AdminDateFilter';
import {
  AdminExportButton,
  exportRowsToXls,
  fetchAllAdminRows,
  formatExportDate,
} from '../_components/AdminExportButton';
import { AdminInfiniteScroll, appendUniqueById } from '../_components/AdminInfiniteScroll';
import { adminFetch } from '../_components/adminFetch';

interface BusinessInquiryItem {
  id: string;
  company: string | null;
  name: string;
  phone: string;
  email: string | null;
  type: string | null;
  message: string;
  fileName: string | null;
  fileSize: number | null;
  fileType: string | null;
  status: string;
  adminNote: string | null;
  source: string;
  createdAt: string;
  updatedAt: string;
}

const LIMIT = 20;

const STATUS_OPTIONS = [
  ['all', '전체'],
  ['new', '신규'],
  ['contacted', '연락중'],
  ['done', '완료'],
  ['archived', '보관'],
] as const;

const statusTone: Record<string, string> = {
  new: 'bg-[#F3F8FF] text-[#3180F7]',
  contacted: 'bg-amber-50 text-amber-600',
  done: 'bg-emerald-50 text-emerald-600',
  archived: 'bg-gray-100 text-gray-500',
};

const statusLabel: Record<string, string> = {
  new: '신규',
  contacted: '연락중',
  done: '완료',
  archived: '보관',
};

const typeLabel: Record<string, string> = {
  wedding: '결혼식 사회자 섭외',
  enterprise: '기업행사 / 공식행사',
  festival: '축제 / 체육대회',
  broadcast: '방송 / 라이브커머스',
  partnership: '제휴 / 파트너십',
  other: '기타',
};

function formatFileSize(value?: number | null) {
  if (!value) return '';
  if (value >= 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)}MB`;
  if (value >= 1024) return `${Math.round(value / 1024)}KB`;
  return `${value}B`;
}

export default function AdminInquiriesPage() {
  const [items, setItems] = useState<BusinessInquiryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<(typeof STATUS_OPTIONS)[number][0]>('all');
  const [dateRange, setDateRange] = useState<AdminDateRange>({ startDate: '', endDate: '' });
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const fetchList = async (
    p = page,
    nextStatus = status,
    nextSearch = search,
    range = dateRange,
    append = false,
  ) => {
    if (append) setLoadingMore(true);
    else setLoading(true);

    try {
      const params = new URLSearchParams({ page: String(p), limit: String(LIMIT) });
      if (nextStatus !== 'all') params.set('status', nextStatus);
      if (nextSearch.trim()) params.set('search', nextSearch.trim());
      if (range.startDate) params.set('startDate', range.startDate);
      if (range.endDate) params.set('endDate', range.endDate);
      const data = await adminFetch('GET', `/api/v1/admin/business-inquiries?${params.toString()}`);
      const rows = data.data || [];
      setItems((prev) => append ? appendUniqueById(prev, rows) : rows);
      setTotal(data.total || 0);
      setPage(p);
    } catch (e: any) {
      toast.error(`문의 목록 로드 실패: ${e?.response?.data?.message || e?.message || ''}`);
    } finally {
      if (append) setLoadingMore(false);
      else setLoading(false);
    }
  };

  useEffect(() => { fetchList(1, status, search, dateRange); }, []);

  const updateLocal = (id: string, patch: Partial<BusinessInquiryItem>) => {
    setItems((prev) => prev.map((item) => item.id === id ? { ...item, ...patch } : item));
  };

  const saveItem = async (item: BusinessInquiryItem) => {
    setSavingId(item.id);
    try {
      const updated = await adminFetch('PATCH', `/api/v1/admin/business-inquiries/${item.id}`, {
        status: item.status,
        adminNote: item.adminNote || '',
      });
      updateLocal(item.id, updated);
      toast.success('문의 상태가 저장되었습니다');
    } catch (e: any) {
      toast.error(`저장 실패: ${e?.response?.data?.message || e?.message || ''}`);
    } finally {
      setSavingId(null);
    }
  };

  const deleteItem = async (item: BusinessInquiryItem) => {
    if (!confirm(`${item.company || item.name} 문의를 삭제하시겠습니까?`)) return;
    try {
      await adminFetch('DELETE', `/api/v1/admin/business-inquiries/${item.id}`);
      setItems((prev) => prev.filter((row) => row.id !== item.id));
      setTotal((value) => Math.max(0, value - 1));
      toast.success('문의가 삭제되었습니다');
    } catch (e: any) {
      toast.error(`삭제 실패: ${e?.response?.data?.message || e?.message || ''}`);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const rows = await fetchAllAdminRows<BusinessInquiryItem>({
        fetchPage: async (p, limit) => {
          const params = new URLSearchParams({ page: String(p), limit: String(limit) });
          if (status !== 'all') params.set('status', status);
          if (search.trim()) params.set('search', search.trim());
          if (dateRange.startDate) params.set('startDate', dateRange.startDate);
          if (dateRange.endDate) params.set('endDate', dateRange.endDate);
          const data = await adminFetch('GET', `/api/v1/admin/business-inquiries?${params.toString()}`, undefined, { cache: false });
          return { rows: data.data || [], total: data.total, hasMore: data.hasMore };
        },
      });

      exportRowsToXls('admin-business-inquiries', 'Biz 문의', rows, [
        { header: '순번', value: (_, index) => index + 1 },
        { header: '문의ID', value: (row) => row.id },
        { header: '상태', value: (row) => statusLabel[row.status] || row.status },
        { header: '회사명', value: (row) => row.company || '' },
        { header: '담당자', value: (row) => row.name },
        { header: '연락처', value: (row) => row.phone },
        { header: '이메일', value: (row) => row.email || '' },
        { header: '문의유형', value: (row) => typeLabel[row.type || ''] || row.type || '' },
        { header: '문의내용', value: (row) => row.message },
        { header: '첨부파일', value: (row) => row.fileName || '' },
        { header: '파일크기', value: (row) => formatFileSize(row.fileSize) },
        { header: '관리자메모', value: (row) => row.adminNote || '' },
        { header: '접수일', value: (row) => formatExportDate(row.createdAt, true) },
        { header: '수정일', value: (row) => formatExportDate(row.updatedAt, true) },
      ]);
      toast.success(`${rows.length.toLocaleString()}건 엑셀 다운로드 완료`);
    } catch (e: any) {
      toast.error(`엑셀 다운로드 실패: ${e?.response?.data?.message || e?.message || ''}`);
    } finally {
      setExporting(false);
    }
  };

  const hasMore = items.length < total;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 px-1">
        <div>
          <p className="text-[12px] font-bold text-[#3182F6]">문의 운영</p>
          <h1 className="mt-1 text-[24px] font-black tracking-tight text-[#191F28]">Biz 문의 관리</h1>
          <p className="mt-1 text-[13px] font-semibold text-[#8B95A1]">
            비즈페이지 문의하기 폼으로 접수된 내용을 확인합니다.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-white px-3 py-1.5 text-[12px] font-bold text-[#6B7684] shadow-[0_6px_16px_rgba(2,32,71,0.04)]">
            총 {total.toLocaleString()}건
          </span>
          <AdminExportButton loading={exporting} onClick={handleExport} />
          <button
            type="button"
            onClick={() => fetchList(1, status, search, dateRange)}
            disabled={loading}
            className="admin-icon-button flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#6B7684] shadow-[0_6px_16px_rgba(2,32,71,0.04)] hover:bg-[#F2F4F6] disabled:opacity-50"
            title="새로고침"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      <div className="admin-toolbar p-4">
        <div className="flex flex-col gap-3 lg:flex-row">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#B0B8C1]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  setPage(1);
                  fetchList(1, status, search, dateRange);
                }
              }}
              placeholder="회사명, 담당자, 연락처, 이메일, 문의 내용 검색 (Enter)"
              className="h-11 w-full rounded-2xl border border-[#E5E8EB] bg-[#F7F8FA] pl-9 pr-4 text-sm font-semibold text-[#191F28] placeholder:text-[#B0B8C1] focus:outline-none"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {STATUS_OPTIONS.map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => {
                  setStatus(value);
                  setPage(1);
                  fetchList(1, value, search, dateRange);
                }}
                className={`admin-chip px-3.5 text-[12px] ${
                  status === value
                    ? 'bg-[#191F28] text-white shadow-[0_8px_18px_rgba(25,31,40,0.14)]'
                    : 'bg-[#F2F4F6] text-[#6B7684] hover:bg-[#E5E8EB] hover:text-[#191F28]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <AdminDateFilter
        value={dateRange}
        onApply={(range) => {
          setDateRange(range);
          setPage(1);
          fetchList(1, status, search, range);
        }}
      />

      <div className="admin-list-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1120px] text-[13px]">
            <thead className="border-b border-[#F2F4F6] bg-[#FBFCFD]">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">문의자</th>
                <th className="px-4 py-3 text-left font-semibold">연락처</th>
                <th className="px-4 py-3 text-left font-semibold">문의유형</th>
                <th className="px-4 py-3 text-left font-semibold">문의내용</th>
                <th className="px-4 py-3 text-center font-semibold">상태</th>
                <th className="px-4 py-3 text-left font-semibold">관리자 메모</th>
                <th className="px-4 py-3 text-center font-semibold">접수일</th>
                <th className="px-4 py-3 text-center font-semibold">작업</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F2F4F6]">
              {loading ? (
                Array.from({ length: 6 }).map((_, index) => (
                  <tr key={index}><td colSpan={8} className="px-4 py-3"><div className="skeleton h-12 w-full" /></td></tr>
                ))
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="admin-empty-state px-4 py-14 text-center text-sm font-semibold">
                    접수된 비즈 문의가 없습니다
                  </td>
                </tr>
              ) : items.map((item) => (
                <tr key={item.id} className="align-top hover:bg-[#F7FAFF]">
                  <td className="px-4 py-3">
                    <p className="font-black text-[#191F28]">{item.company || '회사명 없음'}</p>
                    <p className="mt-1 text-[12px] font-semibold text-[#6B7684]">{item.name}</p>
                    <p className="mt-1 font-mono text-[10px] text-[#B0B8C1]">{item.id.slice(0, 8)}</p>
                  </td>
                  <td className="px-4 py-3">
                    <a href={`tel:${item.phone}`} className="flex items-center gap-1.5 font-bold text-[#191F28] hover:text-[#3180F7]">
                      <Phone size={13} /> {item.phone}
                    </a>
                    {item.email && (
                      <a href={`mailto:${item.email}`} className="mt-1 flex items-center gap-1.5 text-[12px] font-semibold text-[#6B7684] hover:text-[#3180F7]">
                        <Mail size={13} /> {item.email}
                      </a>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex rounded-full bg-[#F2F4F6] px-2.5 py-1 text-[11px] font-bold text-[#6B7684]">
                      {typeLabel[item.type || ''] || item.type || '미선택'}
                    </span>
                    {item.fileName && (
                      <p className="mt-2 flex max-w-[180px] items-center gap-1 text-[11px] font-semibold text-[#8B95A1]">
                        <Paperclip size={12} />
                        <span className="truncate">{item.fileName}</span>
                        <span>{formatFileSize(item.fileSize)}</span>
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="max-w-[300px] whitespace-pre-wrap rounded-xl bg-[#F9FAFB] px-3 py-2 text-[12px] font-medium leading-relaxed text-[#4E5968]">
                      <MessageSquareText size={13} className="mb-1 inline text-[#3180F7]" /> {item.message}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <select
                      value={item.status}
                      onChange={(e) => updateLocal(item.id, { status: e.target.value })}
                      className={`rounded-full border-0 px-2.5 py-1 text-[11px] font-bold focus:outline-none ${statusTone[item.status] || 'bg-gray-100 text-gray-500'}`}
                    >
                      {STATUS_OPTIONS.filter(([value]) => value !== 'all').map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <textarea
                      value={item.adminNote || ''}
                      onChange={(e) => updateLocal(item.id, { adminNote: e.target.value })}
                      rows={3}
                      placeholder="처리 메모"
                      className="w-[220px] resize-y rounded-xl border border-[#E5E8EB] bg-white px-3 py-2 text-[12px] font-medium text-[#191F28] focus:outline-none focus:ring-2 focus:ring-[#3180F7]"
                    />
                  </td>
                  <td className="px-4 py-3 text-center text-[12px] font-semibold text-[#8B95A1]">
                    {formatExportDate(item.createdAt, true)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        type="button"
                        onClick={() => saveItem(item)}
                        disabled={savingId === item.id}
                        className="inline-flex items-center gap-1 rounded-lg bg-[#F3F8FF] px-2.5 py-1.5 text-[12px] font-bold text-[#3180F7] hover:bg-[#E1EFFF] disabled:opacity-50"
                      >
                        <Save size={13} /> 저장
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteItem(item)}
                        className="rounded-lg p-1.5 text-red-400 hover:bg-red-50 hover:text-red-600"
                        title="삭제"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <AdminInfiniteScroll
          hasMore={hasMore}
          loading={loadingMore}
          loaded={items.length}
          total={total}
          onLoadMore={() => {
            if (!hasMore || loading || loadingMore) return;
            fetchList(page + 1, status, search, dateRange, true);
          }}
        />
      </div>
    </div>
  );
}

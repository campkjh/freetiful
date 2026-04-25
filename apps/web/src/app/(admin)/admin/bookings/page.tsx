'use client';

import { useEffect, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import { adminFetch } from '../_components/adminFetch';

interface BookingItem {
  id: string;
  source: 'quotation' | 'matchRequest';
  sourceLabel: string;
  status: string;
  normalizedStatus: 'pending' | 'confirmed' | 'cancelled';
  userName: string | null;
  userEmail: string | null;
  userPhone: string | null;
  proName: string | null;
  categoryName: string | null;
  eventCategoryName: string | null;
  eventDate: string | null;
  eventTime: string | null;
  eventLocation: string | null;
  amount: number | null;
  paymentStatus: string | null;
  deliveryCount: number | null;
  chatRoomCount: number | null;
  deliveredPros: Array<{ id: string; name: string | null; status: string }>;
  createdAt: string;
}

interface PaymentItem {
  id: string;
  amount: number;
  status: string;
  userName: string | null;
  proName: string | null;
  createdAt: string;
}

const LIMIT = 20;

const FILTERS = [
  ['all', '전체'],
  ['pending', '대기'],
  ['confirmed', '확정'],
  ['cancelled', '취소/만료'],
] as const;

const statusTone: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-600',
  confirmed: 'bg-emerald-50 text-emerald-600',
  cancelled: 'bg-red-50 text-red-500',
};

function dateText(value?: string | null) {
  if (!value) return '-';
  try {
    return new Date(value).toLocaleDateString('ko-KR', { year: '2-digit', month: '2-digit', day: '2-digit' });
  } catch {
    return '-';
  }
}

function timeText(value?: string | null) {
  if (!value) return '';
  const match = value.match(/T(\d{2}):(\d{2})/);
  if (match) return `${match[1]}:${match[2]}`;
  return value.slice(0, 5);
}

function normalizePaymentStatus(status: string): BookingItem['normalizedStatus'] {
  if (status === 'completed' || status === 'settled') return 'confirmed';
  if (status === 'failed' || status === 'refunded') return 'cancelled';
  return 'pending';
}

function paymentStatusFilter(status: string) {
  if (status === 'pending') return 'pending';
  if (status === 'confirmed') return 'completed';
  if (status === 'cancelled') return 'refunded';
  return '';
}

export default function AdminBookingsPage() {
  const [rows, setRows] = useState<BookingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<(typeof FILTERS)[number][0]>('all');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const fetchData = async (p = page, status = filter) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p), limit: String(LIMIT) });
      if (status !== 'all') params.set('status', status);
      const data = await adminFetch('GET', `/api/v1/admin/bookings?${params.toString()}`);
      setRows(data.data || []);
      setTotal(data.total || 0);
    } catch (e: any) {
      if (e?.response?.status === 404) {
        try {
          const params = new URLSearchParams({ page: String(p), limit: String(LIMIT) });
          const paymentStatus = paymentStatusFilter(status);
          if (paymentStatus) params.set('status', paymentStatus);
          const data = await adminFetch('GET', `/api/v1/admin/payments?${params.toString()}`);
          setRows((data.data || []).map((payment: PaymentItem) => ({
            id: payment.id,
            source: 'quotation',
            sourceLabel: '결제 예약',
            status: payment.status,
            normalizedStatus: normalizePaymentStatus(payment.status),
            userName: payment.userName,
            userEmail: null,
            userPhone: null,
            proName: payment.proName,
            categoryName: null,
            eventCategoryName: null,
            eventDate: null,
            eventTime: null,
            eventLocation: null,
            amount: payment.amount,
            paymentStatus: payment.status,
            deliveryCount: null,
            chatRoomCount: null,
            deliveredPros: [],
            createdAt: payment.createdAt,
          })));
          setTotal(data.total || 0);
          return;
        } catch (fallbackError: any) {
          toast.error(`의뢰/예약 로드 실패: ${fallbackError?.response?.data?.message || fallbackError?.message || ''}`);
          return;
        }
      }
      toast.error(`의뢰/예약 로드 실패: ${e?.response?.data?.message || e?.message || ''}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(1, filter); }, []);

  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between px-1">
        <div>
          <p className="text-[12px] font-bold text-[#3182F6]">실제 의뢰 흐름</p>
          <h1 className="mt-1 text-[24px] font-black text-[#191F28]">의뢰/예약 관리</h1>
          <p className="mt-1 text-[13px] font-semibold text-[#8B95A1]">
            매칭 요청과 견적/결제 예약 데이터를 함께 봅니다.
          </p>
        </div>
        <button
          onClick={() => fetchData(page, filter)}
          disabled={loading}
          className="admin-icon-button flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#6B7684] shadow-[0_6px_16px_rgba(2,32,71,0.04)] hover:bg-[#F2F4F6] disabled:opacity-50"
          title="새로고침"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="admin-toolbar flex flex-wrap gap-2 p-3">
        {FILTERS.map(([value, label]) => (
          <button
            key={value}
            onClick={() => {
              setFilter(value);
              setPage(1);
              fetchData(1, value);
            }}
            className={`admin-chip px-3.5 text-[12px] ${
              filter === value
                ? 'bg-[#191F28] text-white shadow-[0_8px_18px_rgba(25,31,40,0.14)]'
                : 'bg-[#F2F4F6] text-[#6B7684] hover:bg-[#E5E8EB] hover:text-[#191F28]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="admin-list-card overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead className="border-b border-[#F2F4F6] bg-[#FBFCFD]">
            <tr>
              <th className="px-4 py-3 text-left font-semibold">유형</th>
              <th className="px-4 py-3 text-left font-semibold">의뢰인</th>
              <th className="px-4 py-3 text-left font-semibold">전문가/전달</th>
              <th className="px-4 py-3 text-left font-semibold">행사</th>
              <th className="px-4 py-3 text-right font-semibold">금액</th>
              <th className="px-4 py-3 text-center font-semibold">상태</th>
              <th className="px-4 py-3 text-center font-semibold">생성</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F2F4F6]">
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i}><td colSpan={7} className="px-4 py-3"><div className="skeleton h-9 w-full" /></td></tr>
              ))
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="admin-empty-state px-4 py-14 text-center text-sm font-semibold">
                  실제 의뢰/예약 데이터가 없습니다
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={`${r.source}-${r.id}`} className="hover:bg-[#F7FAFF]">
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#F2F4F6] px-2.5 py-1 text-[11px] font-bold text-[#6B7684]">
                      <CalendarDays size={12} /> {r.sourceLabel}
                    </span>
                    <p className="mt-1 text-[10px] font-mono text-[#B0B8C1]">{r.id.slice(0, 8)}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-bold text-[#191F28]">{r.userName || '-'}</p>
                    <p className="mt-0.5 text-[11px] text-[#8B95A1]">{r.userEmail || r.userPhone || '-'}</p>
                  </td>
                  <td className="px-4 py-3">
                    {r.source === 'quotation' ? (
                      <p className="font-bold text-[#191F28]">{r.proName || '-'}</p>
                    ) : (
                      <>
                        <p className="font-bold text-[#191F28]">전달 {r.deliveryCount ?? 0}명 · 채팅 {r.chatRoomCount ?? 0}</p>
                        <p className="mt-0.5 max-w-[220px] truncate text-[11px] text-[#8B95A1]">
                          {r.deliveredPros.map((p) => p.name).filter(Boolean).join(', ') || '전달 전'}
                        </p>
                      </>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-[#191F28]">
                      {dateText(r.eventDate)} {timeText(r.eventTime)}
                    </p>
                    <p className="mt-0.5 max-w-[240px] truncate text-[11px] text-[#8B95A1]">
                      {r.eventLocation || r.eventCategoryName || r.categoryName || '-'}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-right font-black text-[#191F28]">
                    {r.amount ? `${Number(r.amount).toLocaleString()}원` : '-'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${statusTone[r.normalizedStatus] || 'bg-gray-100 text-gray-500'}`}>
                      {r.normalizedStatus === 'pending' ? '대기' : r.normalizedStatus === 'confirmed' ? '확정' : '취소/만료'}
                    </span>
                    {r.paymentStatus && <p className="mt-1 text-[10px] text-[#8B95A1]">결제 {r.paymentStatus}</p>}
                  </td>
                  <td className="px-4 py-3 text-center text-[12px] font-semibold text-[#8B95A1]">{dateText(r.createdAt)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-[#F2F4F6] px-4 py-3">
            <p className="text-xs font-semibold text-[#8B95A1]">총 {total.toLocaleString()}건 ({page}/{totalPages})</p>
            <div className="flex items-center gap-1">
              <button disabled={page <= 1 || loading} onClick={() => { const next = page - 1; setPage(next); fetchData(next, filter); }} className="rounded-xl p-1.5 text-[#8B95A1] hover:bg-[#F2F4F6] disabled:opacity-30"><ChevronLeft size={16} /></button>
              <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-600">{page}</span>
              <button disabled={page >= totalPages || loading} onClick={() => { const next = page + 1; setPage(next); fetchData(next, filter); }} className="rounded-xl p-1.5 text-[#8B95A1] hover:bg-[#F2F4F6] disabled:opacity-30"><ChevronRight size={16} /></button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

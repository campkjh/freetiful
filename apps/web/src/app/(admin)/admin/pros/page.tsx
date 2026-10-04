'use client';

import { useState, useEffect } from 'react';
import { Search, AlertCircle } from '@/app/(admin)/admin/_components/admin-icons';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/lib/store/auth.store';
import { AdminDateFilter, type AdminDateRange } from '../_components/AdminDateFilter';
import { AdminExportButton, exportRowsToXls, fetchAllAdminRows } from '../_components/AdminExportButton';
import { AdminTerm } from '../_components/AdminHelpTooltip';
import { AdminInfiniteScroll, appendUniqueById } from '../_components/AdminInfiniteScroll';
import { AdminSwitch } from '../_components/AdminSwitch';
import { adminFetch } from '../_components/adminFetch';
import { useAdminRefresh } from '../_components/adminRefresh';

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
  isProfileHidden: boolean;
}

/** 사회자 프로필 상태 → 이름 · 뱃지 색(adm-badge) */
const statusLabel: Record<string, { text: string; className: string }> = {
  approved: { text: '승인', className: 'green' },
  pending: { text: '승인 대기', className: 'orange' },
  rejected: { text: '반려', className: 'red' },
  draft: { text: '작성 중', className: '' },
  suspended: { text: '정지', className: '' },
};
/** 상태 칩(회원 관리 · 사회자 탭) */
const STATUS_FILTERS: Array<[string, string]> = [['전체', '전체'], ['approved', '승인'], ['pending', '승인 대기'], ['draft', '작성 중'], ['rejected', '반려'], ['suspended', '정지']];


export default function AdminProsPage() {
  const [pros, setPros] = useState<ProItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('전체');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [lastError, setLastError] = useState<{ status?: number; message?: string } | null>(null);
  const [dateRange, setDateRange] = useState<AdminDateRange>({ startDate: '', endDate: '' });
  const authUser = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const LIMIT = 20;

  const fetchPros = async (p = page, s = search, st = filterStatus, range = dateRange, append = false) => {
    if (append) setLoadingMore(true);
    else setLoading(true);
    setLastError(null);
    try {
      const params: any = { page: p, limit: LIMIT };
      if (s) params.search = s;
      if (st !== '전체') params.status = st;
      if (range.startDate) params.startDate = range.startDate;
      if (range.endDate) params.endDate = range.endDate;
      const data = await adminFetch('GET', `/api/v1/admin/pros?${new URLSearchParams(params).toString()}`);
      const nextPros = data.data || [];
      setPros((prev) => append ? appendUniqueById(prev, nextPros) : nextPros);
      setTotal(data.total || 0);
      setPage(p);
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || '알 수 없는 오류';
      const status = e?.response?.status;
      setLastError({ status, message: msg });
      toast.error(`목록 로드 실패${status ? ` (${status})` : ''}: ${msg}`, { duration: 6000 });
    } finally {
      if (append) setLoadingMore(false);
      else setLoading(false);
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

  const handleToggleHidden = async (id: string) => {
    const target = pros.find((p) => p.id === id);
    if (!target) return;
    try {
      await adminFetch('PATCH', `/api/v1/admin/pros/${id}`, { isProfileHidden: !target.isProfileHidden });
      setPros((prev) => prev.map((p) => p.id === id ? { ...p, isProfileHidden: !p.isProfileHidden } : p));
    } catch { toast.error('변경 실패'); }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const rows = await fetchAllAdminRows<ProItem>({
        fetchPage: async (p, limit) => {
          const params: any = { page: p, limit };
          if (search) params.search = search;
          if (filterStatus !== '전체') params.status = filterStatus;
          if (dateRange.startDate) params.startDate = dateRange.startDate;
          if (dateRange.endDate) params.endDate = dateRange.endDate;
          const data = await adminFetch('GET', `/api/v1/admin/pros?${new URLSearchParams(params).toString()}`, undefined, { cache: false });
          return { rows: data.data || [], total: data.total };
        },
      });

      exportRowsToXls('admin-pros', '사회자 관리', rows, [
        { header: '순번', value: (_, index) => index + 1 },
        { header: '사회자ID', value: (row) => row.id },
        { header: '이름', value: (row) => row.name },
        { header: '이메일', value: (row) => row.email },
        { header: '상태', value: (row) => statusLabel[row.status]?.text || row.status },
        { header: '평점', value: (row) => row.avgRating ?? '' },
        { header: '리뷰수', value: (row) => row.reviewCount },
        { header: '파트너로고 노출', value: (row) => row.showPartnersLogo },
        { header: '추천 노출', value: (row) => row.isFeatured },
        { header: '프로필 숨김', value: (row) => row.isProfileHidden },
      ]);
      toast.success(`${rows.length.toLocaleString()}명 엑셀 다운로드 완료`);
    } catch (e: any) {
      toast.error(`엑셀 다운로드 실패: ${e?.response?.data?.message || e?.message || ''}`);
    } finally {
      setExporting(false);
    }
  };


  const hasMore = pros.length < total;

  // 머리 오른쪽 새로고침(종 옆) — 지금 검색·상태·기간 그대로
  useAdminRefresh(() => fetchPros(1, search, filterStatus, dateRange));

  return (
    <div className="space-y-5">
      {/* 도구막대 — 제목은 레이아웃 머리(회원 관리 · 사회자 탭) */}
      <div className="adm-toolbar">
        <label className="adm-search grow">
          <Search size={17} />
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); }}
            onKeyDown={(e) => { if (e.key === 'Enter') { setPage(1); fetchPros(1, search, filterStatus, dateRange); } }}
            placeholder="사회자 이름 검색 (Enter)"
            className="adm-input"
          />
        </label>
        <div className="adm-chips">
          {STATUS_FILTERS.map(([st, label]) => (
            <button
              key={st}
              type="button"
              onClick={() => { setFilterStatus(st); setPage(1); fetchPros(1, search, st, dateRange); }}
              className={`adm-chip ${filterStatus === st ? 'on' : ''}`}
            >
              {label}
            </button>
          ))}
        </div>
        <span className="adm-count">총 <b>{total.toLocaleString()}</b>명</span>
        <AdminExportButton loading={exporting} onClick={handleExport} />
      </div>

      {lastError && (
        <div className="mb-4 rounded-[16px] bg-[#FFF5F5] p-5 text-sm">
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

      <AdminDateFilter
        value={dateRange}
        onApply={(range) => {
          setDateRange(range);
          setPage(1);
          fetchPros(1, search, filterStatus, range);
        }}
      />

      {/* Table */}
      <div className="admin-list-card">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left px-4 py-3">사회자</th>
                <th className="text-center px-4 py-3"><AdminTerm term="프로필상태">상태</AdminTerm></th>
                <th className="text-center px-4 py-3">평점</th>
                <th className="text-center px-4 py-3">리뷰</th>
                <th className="text-center px-4 py-3"><AdminTerm term="로고">로고</AdminTerm></th>
                <th className="text-center px-4 py-3"><AdminTerm term="추천">추천</AdminTerm></th>
                <th className="text-center px-4 py-3"><AdminTerm term="프로필상태">숨김</AdminTerm></th>
                <th className="text-center px-4 py-3" aria-label="관리" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={8} className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="skeleton h-10 w-10 rounded-full" />
                        <div className="flex-1 space-y-2">
                          <div className="skeleton h-3 w-40" />
                          <div className="skeleton h-3 w-64 max-w-full" />
                        </div>
                        <div className="skeleton h-8 w-24" />
                      </div>
                    </td>
                  </tr>
                ))
              ) : pros.length === 0 ? (
                <tr><td colSpan={8} className="adm-empty">검색 결과가 없어요</td></tr>
              ) : pros.map((pro) => (
                <tr key={pro.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <ProAvatar src={pro.image} name={pro.name} />
                      <span className="min-w-0">
                        <Link href={`/pros/${pro.id}`} target="_blank" className="adm-cell-main hover:text-[#3182F6]">{pro.name}</Link>
                        <span className="adm-cell-sub">{pro.email}</span>
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`adm-badge ${statusLabel[pro.status]?.className || ''}`}>
                      {statusLabel[pro.status]?.text || pro.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center font-semibold tabular-nums text-[#191F28]">★ {pro.avgRating?.toFixed(1) || '-'}</td>
                  <td className="px-4 py-3 text-center tabular-nums">{pro.reviewCount}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-center">
                      <AdminSwitch
                        checked={pro.showPartnersLogo}
                        onChange={() => handleToggleLogo(pro.id)}
                        ariaLabel={`${pro.name} 파트너 로고 노출`}
                      />
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-center">
                      <AdminSwitch
                        checked={pro.isFeatured}
                        onChange={() => handleToggleFeatured(pro.id)}
                        ariaLabel={`${pro.name} 추천 노출`}
                      />
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-center">
                      <AdminSwitch
                        checked={pro.isProfileHidden}
                        onChange={() => handleToggleHidden(pro.id)}
                        ariaLabel={`${pro.name} 프로필 숨김`}
                      />
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1 flex-wrap">
                      <Link href={`/admin/pros/${pro.id}/edit`} className="adm-btn weak sm">
                        수정
                      </Link>
                      {pro.status !== 'approved' && (
                        <button type="button" onClick={() => handleApprove(pro.id)} className="adm-btn sm adm-btn-ok">
                          승인
                        </button>
                      )}
                      {pro.status !== 'rejected' && (
                        <button type="button" onClick={() => handleReject(pro.id)} className="adm-btn sm danger">
                          반려
                        </button>
                      )}
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
          loaded={pros.length}
          total={total}
          onLoadMore={() => {
            if (!hasMore || loading || loadingMore) return;
            fetchPros(page + 1, search, filterStatus, dateRange, true);
          }}
          itemLabel="명"
        />
      </div>

    </div>
  );
}

function ProAvatar({ src, name }: { src?: string | null; name: string }) {
  const [err, setErr] = useState(false);
  if (!src || err) {
    return (
      <div className="adm-ava bg-[#E3ECF5]" aria-label={`${name} 기본 프로필`}>
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
      className="adm-ava"
    />
  );
}

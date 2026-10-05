'use client';

import { useState, useEffect, useRef } from 'react';
import { AlertCircle } from '@/app/(admin)/admin/_components/admin-icons';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/lib/store/auth.store';
import { AdminDateFilter, type AdminDateRange } from '../_components/AdminDateFilter';
import { AdminExportButton, exportRowsToXls, fetchAllAdminRows } from '../_components/AdminExportButton';
import { AdminTerm } from '../_components/AdminHelpTooltip';
import { AdminInfiniteScroll, appendUniqueById } from '../_components/AdminInfiniteScroll';
import { AdminSwitch } from '../_components/AdminSwitch';
import { adminFetch } from '../_components/adminFetch';
import { useAdminRefresh } from '../_components/adminRefresh';
import { AdminListCard, AdminTableScroll } from '../_components/AdminListCard';
import { RollingNumber } from '../_components/AdminNumber';
import { adminConfirm } from '../_components/adminDialog';
import { AdminRadioGroup } from '../_components/AdminRadioGroup';
import { AdminSearchField } from '../_components/AdminSearchField';

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
  /** 퀵매칭 첫 화면 노출(지정 사회자) — API admin/pros 목록 줄마다(261005) */
  quickMatchDesignated?: boolean;
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
  /* 퀵매칭 노출(지정 사회자, 261005 사장 '퀵매칭에 노출시킬 사회자 토글') — 칩 = 지정만 보기 + 지금 몇 명 */
  const [quickOnly, setQuickOnly] = useState(false);
  const [quickCount, setQuickCount] = useState<number | null>(null);
  /** 서버가 명단 표가 있다(quickMatchEditable true)고 할 때만 스위치를 바꿀 수 있다 — 표가 없거나(SQL 전) 옛 API(값 없음)면 보기만 */
  const [quickEditable, setQuickEditable] = useState(false);
  const [quickSaving, setQuickSaving] = useState<Set<string>>(new Set());
  const quickSavingRef = useRef<Set<string>>(new Set());
  /** 저장 중인 줄의 누른 값 — 그 사이 목록을 다시 받아도 이 값을 유지 */
  const quickPendingRef = useRef<Map<string, boolean>>(new Map());
  /** 저장이 끝난 값과 시각 — 그보다 먼저 보낸 목록 요청의 (옛) 값으로 덮지 않게 */
  const quickSavedRef = useRef<Map<string, { v: boolean; at: number }>>(new Map());
  /** '퀵매칭 노출' 거르기 중에 끈 줄 — 다음 목록을 받을 때까지는 그 자리에 둔다(누르자마자 줄이 사라지지 않게) */
  const [quickKeep, setQuickKeep] = useState<Set<string>>(new Set());
  const router = useRouter();
  const authUser = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const LIMIT = 20;

  const fetchPros = async (p = page, s = search, st = filterStatus, range = dateRange, append = false, qm = quickOnly) => {
    if (append) setLoadingMore(true);
    else setLoading(true);
    setLastError(null);
    const startedAt = Date.now();
    try {
      const params: any = { page: p, limit: LIMIT };
      if (s) params.search = s;
      if (st !== '전체') params.status = st;
      if (range.startDate) params.startDate = range.startDate;
      if (range.endDate) params.endDate = range.endDate;
      if (qm) params.quickMatch = '1';
      const data = await adminFetch('GET', `/api/v1/admin/pros?${new URLSearchParams(params).toString()}`, undefined, { cache: false });
      const fetched: ProItem[] = data.data || [];
      // 퀵매칭 스위치: 저장 중이면 누른 값, 이 요청을 보낸 뒤 저장이 끝났으면 저장된 값을 지킨다
      // (저장 전 서버 값으로 덮이면 저장이 끝나도 스위치가 옛 값으로 남았다)
      const savedSince = (id: string) => { const r = quickSavedRef.current.get(id); return r && r.at >= startedAt ? r : null; };
      let raced = quickSavingRef.current.size > 0;
      const nextPros = fetched.map((x) => {
        if (quickSavingRef.current.has(x.id)) return { ...x, quickMatchDesignated: quickPendingRef.current.get(x.id) ?? x.quickMatchDesignated };
        const r = savedSince(x.id);
        if (r) { raced = true; return { ...x, quickMatchDesignated: r.v }; }
        return x;
      });
      if (!raced) raced = Array.from(quickSavedRef.current.values()).some((r) => r.at >= startedAt);
      setPros((prev) => append ? appendUniqueById(prev, nextPros) : nextPros);
      setTotal(data.total || 0);
      setPage(p);
      if (!append) setQuickKeep(new Set());
      // 지정 인원 — 서버가 세어 주면 그 값(전체 기준), 아니면 받은 줄에서 센다
      // 지정 인원도 같은 이유로, 스위치 저장과 엇갈린 응답이면 저장 응답의 값을 그대로 둔다
      if (typeof data.quickMatchCount === 'number') { if (!raced) setQuickCount(data.quickMatchCount); }
      else if (!append && !qm && !s && st === '전체' && !range.startDate && !range.endDate && nextPros.length >= (data.total || 0)) setQuickCount(nextPros.filter((x) => x.quickMatchDesignated).length);
      setQuickEditable(data.quickMatchEditable === true);
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

  /** 퀵매칭 노출 스위치 — 바로 뒤집어 보이고(낙관), 실패하면 되돌리고 알림. 저장 중엔 그 줄 스위치를 잠근다 */
  const handleToggleQuickMatch = async (id: string, next: boolean) => {
    if (quickSavingRef.current.has(id)) return;
    const name = pros.find((p) => p.id === id)?.name || '사회자';
    const mark = (on: boolean) => {
      const n = new Set(quickSavingRef.current);
      if (on) { n.add(id); quickPendingRef.current.set(id, next); } else { n.delete(id); quickPendingRef.current.delete(id); }
      quickSavingRef.current = n;
      setQuickSaving(n);
    };
    const setRow = (v: boolean) => setPros((prev) => prev.map((p) => (p.id === id ? { ...p, quickMatchDesignated: v } : p)));
    mark(true);
    if (quickOnly) setQuickKeep((prev) => new Set(prev).add(id));
    setRow(next);
    setQuickCount((c) => (c == null ? c : Math.max(0, c + (next ? 1 : -1))));
    try {
      const res = await adminFetch('PATCH', `/api/v1/admin/pros/${id}/quick-match`, { designated: next });
      const saved = typeof res?.quickMatchDesignated === 'boolean' ? res.quickMatchDesignated : next;
      // 늘 서버 값으로 줄을 맞춘다(저장 중에 새로고침·거르기로 목록이 다시 와도)
      quickSavedRef.current.set(id, { v: saved, at: Date.now() });
      setRow(saved);
      if (typeof res?.quickMatchCount === 'number') setQuickCount(res.quickMatchCount);
      else if (saved !== next) setQuickCount((c) => (c == null ? c : Math.max(0, c + (saved ? 1 : -1))));
      toast.success(saved ? `${name} 님을 퀵매칭 첫 화면에 넣었어요` : `${name} 님을 퀵매칭 첫 화면에서 뺐어요`);
    } catch (e: any) {
      setRow(!next);
      setQuickCount((c) => (c == null ? c : Math.max(0, c + (next ? -1 : 1))));
      const data = e?.response?.data;
      if (data?.code === 'QUICK_MATCH_GENDER_REQUIRED') {
        // 프로필 성별이 비어 첫 화면 남/여 묶음을 정할 수 없다 → 사회자 수정에서 성별을 정하게 안내
        mark(false);
        const go = await adminConfirm({
          title: '성별을 먼저 정해 주세요',
          description: `퀵매칭 첫 화면은 남/여로 나눠 보여 줘요. ${name} 님 프로필에 성별이 비어 있어요.`,
          confirmText: '사회자 수정',
          cancelText: '닫기',
        });
        if (go) router.push(`/admin/pros/${id}/edit`);
        return;
      }
      const msg = data?.message || e?.message || '';
      toast.error(`퀵매칭 노출 변경 실패${msg ? `: ${msg}` : ''}`);
    } finally {
      mark(false);
    }
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
          if (quickOnly) params.quickMatch = '1';
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
        { header: '퀵매칭 노출', value: (row) => !!row.quickMatchDesignated },
      ]);
      toast.success(`${rows.length.toLocaleString()}명 엑셀 다운로드 완료`);
    } catch (e: any) {
      toast.error(`엑셀 다운로드 실패: ${e?.response?.data?.message || e?.message || ''}`);
    } finally {
      setExporting(false);
    }
  };


  const hasMore = pros.length < total;
  // 지정만 보기 — 서버가 quickMatch 거르기를 모르는 옛 API 여도 화면에선 지정 줄만
  const rows = quickOnly ? pros.filter((p) => p.quickMatchDesignated || quickKeep.has(p.id)) : pros;
  // 지정만 보기에서 방금 끈 줄(흐리게 남김)은 '표시됨' 수에서 뺀다
  const shownLoaded = quickOnly ? rows.filter((p) => p.quickMatchDesignated).length : rows.length;
  const shownTotal = quickOnly && quickCount != null ? Math.min(total, quickCount) : total;

  // 머리 오른쪽 새로고침(종 옆) — 지금 검색·상태·기간·퀵매칭 거르기 그대로
  useAdminRefresh(() => fetchPros(1, search, filterStatus, dateRange, false, quickOnly));

  const errorPanel = lastError && (
    <div className="rounded-[16px] bg-[#FFF5F5] p-5 text-sm">
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
  );

  return (
    <div className="space-y-5">
      {/* 오류 칸은 카드 위 — 제목은 레이아웃 머리(회원 관리 · 사회자 탭) */}
      {errorPanel}

      {/* 검색·거르기 + 조회기간 + 사회자 표 = 한 카드(261005 사장 '테이블이랑 필터링 패널이랑 합쳐줘') */}
      <AdminListCard
        filter={<>
          <div className="adm-toolbar">
            <AdminSearchField className="grow" value={search} onChange={setSearch} onSubmit={(search) => { setPage(1); fetchPros(1, search, filterStatus, dateRange); }} placeholder="사회자 이름 검색" />
            <div className="adm-radio-row">
              <AdminRadioGroup
                value={filterStatus}
                options={STATUS_FILTERS.map(([value, label]) => ({ value, label }))}
                ariaLabel="사회자 상태"
                onChange={(st) => { setFilterStatus(st); setPage(1); fetchPros(1, search, st, dateRange); }}
              />
              {/* 퀵매칭 노출 = 지정 사회자만 보기 + 지금 몇 명(다른 거르기와 함께 걸린다) */}
              <button
                type="button"
                aria-pressed={quickOnly}
                onClick={() => { const next = !quickOnly; setQuickOnly(next); setPage(1); fetchPros(1, search, filterStatus, dateRange, false, next); }}
                className={`adm-chip adm-chip-qm ${quickOnly ? 'on' : ''}`}
                title="퀵매칭 첫 화면(지정 사회자)에 나오는 사회자만 보기"
              >
                <span className="adm-chip-qm-dot" aria-hidden="true" />
                <span>퀵매칭 노출{quickCount != null && <> <RollingNumber value={quickCount} />명</>}</span>
              </button>
            </div>
            <span className="adm-count">총 <b><RollingNumber value={shownTotal} /></b>명</span>
            <AdminExportButton loading={exporting} onClick={handleExport} />
          </div>
          <AdminDateFilter
            value={dateRange}
            onApply={(range) => {
              setDateRange(range);
              setPage(1);
              fetchPros(1, search, filterStatus, range);
            }}
          />
        </>}
      >
        <AdminTableScroll>
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="adm-col-person text-left px-4 py-3">사회자</th>
                <th className="text-center px-4 py-3"><AdminTerm term="프로필상태">상태</AdminTerm></th>
                <th className="text-center px-4 py-3">평점</th>
                <th className="text-center px-4 py-3">리뷰</th>
                <th className="text-center px-3 py-3"><AdminTerm term="퀵매칭 노출">퀵매칭</AdminTerm></th>
                <th className="text-center px-3 py-3"><AdminTerm term="로고">로고</AdminTerm></th>
                <th className="text-center px-3 py-3"><AdminTerm term="추천">추천</AdminTerm></th>
                <th className="text-center px-3 py-3"><AdminTerm term="프로필상태">숨김</AdminTerm></th>
                <th className="text-center px-4 py-3" aria-label="관리" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={9} className="px-4 py-3">
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
              ) : rows.length === 0 ? (
                <tr><td colSpan={9} className="adm-empty">{quickOnly ? '퀵매칭 첫 화면에 넣은 사회자가 없어요' : '검색 결과가 없어요'}</td></tr>
              ) : rows.map((pro) => (
                <tr key={pro.id} className={`hover:bg-gray-50 transition-[background-color,opacity] ${quickOnly && !pro.quickMatchDesignated ? 'opacity-50' : ''}`}>
                  <td className="adm-col-person px-4 py-3">
                    {/* 사회자 칸 폭 고정(261005 사장 '사회자 가로가 너무 넓어') — 긴 이름·이메일은 말줄임 + 마우스 올리면 전체 */}
                    <div className="adm-person">
                      <ProAvatar src={pro.image} name={pro.name} />
                      <span className="adm-person-text">
                        <Link href={`/pros/${pro.id}`} target="_blank" className="adm-cell-main hover:text-[#3182F6]" title={pro.name}>{pro.name}</Link>
                        <span className="adm-cell-sub" title={pro.email}>{pro.email}</span>
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`adm-badge ${statusLabel[pro.status]?.className || ''}`}>
                      {statusLabel[pro.status]?.text || pro.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center whitespace-nowrap font-semibold tabular-nums text-[#191F28]">★ {pro.avgRating?.toFixed(1) || '-'}</td>
                  <td className="px-4 py-3 text-center tabular-nums">{pro.reviewCount}</td>
                  <td className="px-3 py-3">
                    {typeof pro.quickMatchDesignated !== 'boolean' ? (
                      // 옛 API(퀵매칭 값을 아직 안 줌) — 모르는 값을 '꺼짐'으로 보이지 않게
                      <span className="block text-center text-[#C4CCD4]" title="퀵매칭 노출 값을 아직 받지 못했어요">-</span>
                    ) : (
                      <div className="flex flex-col items-center gap-1" title={quickEditable ? undefined : '퀵매칭 명단 표가 아직 준비되지 않아 지금은 바꿀 수 없어요'}>
                        <AdminSwitch
                          checked={pro.quickMatchDesignated}
                          onChange={(next) => handleToggleQuickMatch(pro.id, next)}
                          disabled={!quickEditable}
                          busy={quickSaving.has(pro.id)}
                          ariaLabel={`${pro.name} 퀵매칭 첫 화면 노출`}
                        />
                        {/* 켜 두어도 첫 화면은 승인·노출 중인 사회자만 보여 준다 */}
                        {pro.quickMatchDesignated && (pro.status !== 'approved' || pro.isProfileHidden) && (
                          <span className="adm-qm-off">{pro.isProfileHidden ? '숨김이라 안 보임' : '미승인이라 안 보임'}</span>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex justify-center">
                      <AdminSwitch
                        checked={pro.showPartnersLogo}
                        onChange={() => handleToggleLogo(pro.id)}
                        ariaLabel={`${pro.name} 파트너 로고 노출`}
                      />
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex justify-center">
                      <AdminSwitch
                        checked={pro.isFeatured}
                        onChange={() => handleToggleFeatured(pro.id)}
                        ariaLabel={`${pro.name} 추천 노출`}
                      />
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex justify-center">
                      <AdminSwitch
                        checked={pro.isProfileHidden}
                        onChange={() => handleToggleHidden(pro.id)}
                        ariaLabel={`${pro.name} 프로필 숨김`}
                      />
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1 whitespace-nowrap">
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
        </AdminTableScroll>

        <AdminInfiniteScroll
          hasMore={hasMore}
          loading={loadingMore}
          loaded={shownLoaded}
          total={shownTotal}
          onLoadMore={() => {
            if (!hasMore || loading || loadingMore) return;
            fetchPros(page + 1, search, filterStatus, dateRange, true, quickOnly);
          }}
          itemLabel="명"
        />
      </AdminListCard>
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

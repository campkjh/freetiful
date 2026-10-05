'use client';

import { useEffect, useMemo, useState } from 'react';
import { AdminExportButton, exportRowsToXls, formatExportDate } from '../_components/AdminExportButton';
import { adminFetch } from '../_components/adminFetch';
import toast from 'react-hot-toast';
import { RollingNumber } from '../_components/AdminNumber';
import { AdminListCard } from '../_components/AdminListCard';
import { useAdminRefresh } from '../_components/adminRefresh';
import { AdminSearchField } from '../_components/AdminSearchField';
import { AdminRadioGroup } from '../_components/AdminRadioGroup';

type ReferralRow = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  referralCode: string;
  createdAt: string;
  referralCount: number;
  claimEligible: boolean;
  claim: {
    id: string;
    status: string;
    bankName: string;
    accountHolder: string;
    accountNumber: string;
    adminNote?: string | null;
    submittedAt: string;
  } | null;
  referrals: Array<{
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    referralCode: string;
    createdAt: string;
  }>;
};

const CLAIM_STATUSES = ['전체', 'pending', 'approved', 'paid', 'rejected'] as const;

function statusLabel(status?: string | null) {
  if (status === 'approved') return '승인';
  if (status === 'paid') return '지급완료';
  if (status === 'rejected') return '반려';
  if (status === 'pending') return '접수';
  return '미신청';
}

export default function AdminReferralEventPage() {
  const [rows, setRows] = useState<ReferralRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<(typeof CLAIM_STATUSES)[number]>('전체');
  const [savingId, setSavingId] = useState<string | null>(null);
  const [adminNotes, setAdminNotes] = useState<Record<string, string>>({});

  /** q·st 를 주면 그 값으로(검색칸 지우기·라디오 바꾸기 — 상태가 아직 안 바뀌었을 수 있다) */
  const fetchRows = async (q: string = search, st: (typeof CLAIM_STATUSES)[number] = status) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('limit', '100');
      if (q.trim()) params.set('search', q.trim());
      if (st !== '전체') params.set('status', st);
      const data = await adminFetch('GET', `/api/v1/admin/referral-event?${params.toString()}`, undefined, { cache: false });
      const nextRows = Array.isArray(data?.data) ? data.data : [];
      setRows(nextRows);
      setAdminNotes(
        nextRows.reduce((acc: Record<string, string>, row: ReferralRow) => {
          if (row.claim?.id) acc[row.claim.id] = row.claim.adminNote || '';
          return acc;
        }, {}),
      );
    } catch (error: any) {
      toast.error(error?.response?.data?.message || '이벤트 참여자 목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRows();
  }, []);
  // 머리 오른쪽 새로고침 — 지금 검색·상태 그대로(본문을 새로 띄우지 않아 숫자 다이얼이 같은 값이면 다시 돌지 않는다)
  useAdminRefresh(() => { fetchRows(); });

  const totalApplicants = useMemo(
    () => rows.filter((row) => !!row.claim).length,
    [rows],
  );

  const handleUpdateClaim = async (claimId: string, nextStatus: string) => {
    setSavingId(claimId);
    try {
      await adminFetch('PATCH', `/api/v1/admin/referral-event/claims/${claimId}`, {
        status: nextStatus,
        adminNote: adminNotes[claimId] || '',
      });
      toast.success('신청 상태를 저장했어요.');
      await fetchRows();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || '신청 상태 저장에 실패했습니다.');
    } finally {
      setSavingId(null);
    }
  };

  const handleExport = () => {
    exportRowsToXls('admin-referral-event', '친구초대 이벤트', rows, [
      { header: '참여자명', value: (row) => row.name },
      { header: '이메일', value: (row) => row.email || '' },
      { header: '전화번호', value: (row) => row.phone || '' },
      { header: '내 초대코드', value: (row) => row.referralCode },
      { header: '초대한 친구 수', value: (row) => row.referralCount },
      { header: '신청 가능', value: (row) => (row.claimEligible ? 'Y' : 'N') },
      { header: '신청 상태', value: (row) => statusLabel(row.claim?.status) },
      { header: '은행명', value: (row) => row.claim?.bankName || '' },
      { header: '예금주', value: (row) => row.claim?.accountHolder || '' },
      { header: '계좌번호', value: (row) => row.claim?.accountNumber || '' },
      { header: '신청일시', value: (row) => formatExportDate(row.claim?.submittedAt, true) },
      { header: '가입일', value: (row) => formatExportDate(row.createdAt, true) },
    ]);
    toast.success(`${rows.length.toLocaleString()}건 다운로드 완료`);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between px-1">
        <div>
          <h1 className="text-[22px] font-bold text-[#191F28] tracking-tight">친구초대 이벤트</h1>
          <p className="mt-0.5 text-[13px] text-[#8B95A1]">초대 참여자, 초대한 친구 수, 계좌 신청 상태를 확인합니다.</p>
        </div>
        <AdminExportButton loading={false} onClick={handleExport} />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-3xl bg-white p-5">
          <p className="text-[13px] font-medium text-[#8B95A1]">참여자 수</p>
          <p className="mt-2 text-[28px] font-extrabold text-[#191F28]"><RollingNumber value={rows.length} /></p>
        </div>
        <div className="rounded-3xl bg-white p-5">
          <p className="text-[13px] font-medium text-[#8B95A1]">지급 신청 수</p>
          <p className="mt-2 text-[28px] font-extrabold text-[#191F28]"><RollingNumber value={totalApplicants} /></p>
        </div>
        <div className="rounded-3xl bg-white p-5">
          <p className="text-[13px] font-medium text-[#8B95A1]">지급 가능 수</p>
          <p className="mt-2 text-[28px] font-extrabold text-[#191F28]">
            <RollingNumber value={rows.filter((row) => row.claimEligible).length} />
          </p>
        </div>
      </div>

      {/* 검색·상태 + 참여자 목록 = 한 카드(261005 사장 '테이블이랑 필터링 패널이랑 합쳐줘') */}
      <AdminListCard
        filter={
          <div className="adm-toolbar flex flex-col gap-3 md:flex-row md:items-center">
            <AdminSearchField className="flex-1" value={search} onChange={setSearch} onSubmit={(q) => fetchRows(q)} placeholder="이름 · 이메일 · 추천코드 검색" />
            <AdminRadioGroup
              value={status}
              options={CLAIM_STATUSES.map((item) => ({ value: item, label: item === '전체' ? '전체' : statusLabel(item) }))}
              ariaLabel="신청 상태"
              onChange={(st) => { setStatus(st); fetchRows(search, st); }}
            />
            <button
              onClick={() => fetchRows()}
              className="h-11 rounded-2xl bg-[#3180F7] px-5 text-[14px] font-bold text-white"
            >
              조회
            </button>
          </div>
        }
      >
        {loading ? (
          <div className="px-5 py-16 text-center text-[14px] text-[#8B95A1]">이벤트 참여자를 불러오는 중...</div>
        ) : rows.length === 0 ? (
          <div className="px-5 py-16 text-center text-[14px] font-semibold text-[#8B95A1]">참여자가 없습니다.</div>
        ) : (
          <div className="divide-y divide-[#F2F4F6]">
            {rows.map((row) => (
              <div key={row.id} className="px-5 py-5">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[18px] font-extrabold text-[#191F28]">{row.name}</p>
                      <span className="rounded-full bg-[#F2F4F6] px-2.5 py-1 text-[12px] font-semibold text-[#6B7684]">
                        {row.referralCode}
                      </span>
                      <span className={`rounded-full px-2.5 py-1 text-[12px] font-semibold ${
                        row.claimEligible ? 'bg-[#EEF6FF] text-[#3180F7]' : 'bg-[#F7F8FA] text-[#8B95A1]'
                      }`}>
                        {row.referralCount}명 초대
                      </span>
                    </div>
                    <p className="mt-2 text-[13px] text-[#6B7684]">
                      {row.email || '-'} · {row.phone || '-'} · 가입일 {formatExportDate(row.createdAt, true)}
                    </p>

                    <div className="mt-4 rounded-2xl bg-[#F8FAFD] p-4">
                      <p className="text-[13px] font-semibold text-[#6B7684]">초대한 친구</p>
                      {row.referrals.length === 0 ? (
                        <p className="mt-2 text-[13px] text-[#A0A8B6]">아직 등록된 친구가 없습니다.</p>
                      ) : (
                        <div className="mt-3 space-y-2">
                          {row.referrals.map((referral) => (
                            <div key={referral.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white px-3 py-3">
                              <div className="min-w-0">
                                <p className="text-[14px] font-semibold text-[#191F28]">{referral.name}</p>
                                <p className="mt-0.5 text-[12px] text-[#8B95A1]">{referral.email || '-'} · {referral.phone || '-'}</p>
                              </div>
                              <span className="text-[12px] font-medium text-[#8B95A1]">{formatExportDate(referral.createdAt, true)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="w-full rounded-2xl border border-[#EEF2F6] bg-[#FCFDFF] p-4 xl:w-[360px]">
                    <div className="flex items-center justify-between">
                      <p className="text-[15px] font-bold text-[#191F28]">현금 지급 신청</p>
                      <span className={`rounded-full px-2.5 py-1 text-[12px] font-semibold ${
                        row.claim
                          ? 'bg-[#EEF6FF] text-[#3180F7]'
                          : 'bg-[#F7F8FA] text-[#8B95A1]'
                      }`}>
                        {statusLabel(row.claim?.status)}
                      </span>
                    </div>

                    {row.claim ? (
                      <div className="mt-4 space-y-3">
                        <Field label="은행명" value={row.claim.bankName} />
                        <Field label="예금주" value={row.claim.accountHolder} />
                        <Field label="계좌번호" value={row.claim.accountNumber} />
                        <Field label="신청일시" value={formatExportDate(row.claim.submittedAt, true)} />

                        <select
                          value={row.claim.status}
                          onChange={(e) => handleUpdateClaim(row.claim!.id, e.target.value)}
                          disabled={savingId === row.claim.id}
                          className="h-11 w-full rounded-2xl border border-[#E5E8EB] px-3 text-[14px] font-semibold text-[#191F28]"
                        >
                          {CLAIM_STATUSES.filter((item) => item !== '전체').map((item) => (
                            <option key={item} value={item}>
                              {statusLabel(item)}
                            </option>
                          ))}
                        </select>
                        <textarea
                          value={adminNotes[row.claim.id] || ''}
                          onChange={(e) => setAdminNotes((prev) => ({ ...prev, [row.claim!.id]: e.target.value }))}
                          placeholder="관리 메모"
                          className="min-h-[92px] w-full rounded-2xl border border-[#E5E8EB] px-3 py-3 text-[14px] outline-none placeholder:text-[#A0A8B6]"
                        />
                        <button
                          onClick={() => handleUpdateClaim(row.claim!.id, row.claim!.status)}
                          disabled={savingId === row.claim.id}
                          className="h-11 w-full rounded-2xl bg-[#191F28] text-[14px] font-bold text-white disabled:opacity-60"
                        >
                          {savingId === row.claim.id ? '저장 중...' : '메모 저장'}
                        </button>
                      </div>
                    ) : (
                      <div className="mt-4 rounded-2xl bg-white px-4 py-5 text-[13px] text-[#8B95A1]">
                        아직 현금 지급 신청 내역이 없습니다.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </AdminListCard>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white px-3 py-3">
      <p className="text-[12px] font-medium text-[#8B95A1]">{label}</p>
      <p className="mt-1 text-[14px] font-semibold text-[#191F28] break-all">{value || '-'}</p>
    </div>
  );
}

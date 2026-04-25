'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Users, Star, CreditCard, UserCheck, ChevronRight, RefreshCw, Calendar, Building2, ArrowRightLeft, Wallet } from 'lucide-react';
import toast from 'react-hot-toast';
import { adminFetch } from './_components/adminFetch';

interface Stats {
  totalUsers: number;
  totalPros: number;
  pendingPros: number;
  totalReviews: number;
  thisMonthRevenue: number;
  totalRevenue: number;
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferSource, setTransferSource] = useState('');
  const [transferTarget, setTransferTarget] = useState('');
  const [transferring, setTransferring] = useState(false);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const data = await adminFetch('GET', '/api/v1/admin/stats');
      setStats(data);
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || '알 수 없는 오류';
      const status = e?.response?.status;
      toast.error(`통계 로드 실패${status ? ` (${status})` : ''}: ${msg}`, { duration: 6000 });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchStats(); }, []);

  const handleCleanup = async () => {
    if (!confirm('이미지 0장인 approved 프로필을 전부 draft 로 강등하시겠습니까? (공개 목록에서 사라짐)')) return;
    try {
      const data = await adminFetch('POST', '/api/v1/admin/cleanup-empty-profiles');
      toast.success(`${data.archivedCount}개 빈 프로필이 draft 로 강등됨`);
      if (data.archivedCount > 0) {
        console.log('archived:', data.archived);
      }
    } catch (e: any) {
      toast.error(`정리 실패: ${e?.response?.data?.message || e?.message || ''}`);
    }
  };

  const handleTransfer = async () => {
    if (!transferSource || !transferTarget) { toast.error('이메일을 모두 입력하세요'); return; }
    if (!confirm(`${transferSource} 의 모든 프로필/이미지/서비스를 ${transferTarget} 계정으로 이관합니다.\n\n이 작업은 되돌릴 수 없습니다. 계속할까요?`)) return;
    setTransferring(true);
    try {
      const data = await adminFetch('POST', '/api/v1/admin/transfer-pro-profile', {
        sourceEmail: transferSource,
        targetEmail: transferTarget,
      });
      toast.success(`이관 완료: ${data.transferredProfileId}`);
      setTransferOpen(false);
      fetchStats();
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || '알 수 없는 오류';
      toast.error(`이관 실패: ${msg}`, { duration: 6000 });
    } finally {
      setTransferring(false);
    }
  };

  const navItems = [
    { href: '/admin/pros', icon: UserCheck, label: '전문가 관리', desc: '승인 · 반려 · 프로필', count: stats?.pendingPros ? `대기 ${stats.pendingPros}` : undefined, countTone: 'warn' as const },
    { href: '/admin/users', icon: Users, label: '유저 관리', desc: '회원 목록 · 권한', count: stats?.totalUsers != null ? `${stats.totalUsers.toLocaleString()}명` : undefined },
    { href: '/admin/bookings', icon: Calendar, label: '의뢰 · 예약', desc: '예약 현황' },
    { href: '/admin/payments', icon: CreditCard, label: '결제 관리', desc: '결제 내역 · 매출', count: stats?.thisMonthRevenue != null ? `₩${Number(stats.thisMonthRevenue).toLocaleString()}` : undefined },
    { href: '/admin/settlements', icon: Wallet, label: '정산 관리', desc: '전문가 정산 처리' },
    { href: '/admin/reviews', icon: Star, label: '리뷰 관리', desc: '리뷰 목록 · 삭제', count: stats?.totalReviews != null ? `${stats.totalReviews.toLocaleString()}건` : undefined },
    { href: '/admin/businesses', icon: Building2, label: 'Biz 고객사', desc: '비즈니스 계정' },
  ];

  const summaryItems = stats
    ? [
        { label: '이번달 매출', value: `₩${Number(stats.thisMonthRevenue).toLocaleString()}` },
        { label: '누적 매출', value: `₩${Number(stats.totalRevenue).toLocaleString()}` },
        { label: '전체 유저', value: `${stats.totalUsers.toLocaleString()}명` },
        { label: '승인 전문가', value: `${stats.totalPros.toLocaleString()}명` },
      ]
    : [];

  const statusItems = stats
    ? [
        { label: '승인 대기', value: `${stats.pendingPros.toLocaleString()}명` },
        { label: '리뷰', value: `${stats.totalReviews.toLocaleString()}건` },
        { label: '운영 메뉴', value: `${navItems.length.toLocaleString()}개` },
        { label: '업데이트', value: '실시간' },
      ]
    : [];

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[12px] font-normal text-[#B0B8C1]">운영 센터</p>
          <h1 className="mt-3 text-[16px] font-bold text-[#191F28]">관리자 홈</h1>
        </div>
        <button
          onClick={fetchStats}
          disabled={loading}
          className="admin-icon-button flex h-10 w-10 items-center justify-center rounded-lg bg-[#F7F8FA] text-[#6B7684] hover:bg-[#F2F4F6] disabled:opacity-50"
          title="새로고침"
        >
          <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {loading ? (
        <div className="admin-list-card animate-pulse">
          <div className="grid grid-cols-4 border-y border-[#E5E8EB] bg-[#F7F8FA]">
            {[1, 2, 3, 4].map((i) => <div key={i} className="h-[54px] px-6 py-4"><div className="h-3 w-20 rounded bg-gray-100" /></div>)}
          </div>
          <div className="grid grid-cols-4 border-b border-[#E5E8EB]">
            {[1, 2, 3, 4].map((i) => <div key={i} className="h-[54px] px-6 py-4"><div className="h-4 w-24 rounded bg-gray-100" /></div>)}
          </div>
        </div>
      ) : stats && (
        <div className="admin-list-card overflow-x-auto">
          <table className="w-full min-w-[760px]">
            <thead>
              <tr>
                {summaryItems.map((item) => (
                  <th key={item.label} className="px-6 text-center">{item.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                {summaryItems.map((item) => (
                  <td key={item.label} className="px-6 text-center font-semibold text-[#333D4B]">{item.value}</td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {loading ? (
        <div className="admin-list-card animate-pulse">
          <div className="grid grid-cols-4 border-y border-[#E5E8EB] bg-[#F7F8FA]">
            {[1, 2, 3, 4].map((i) => <div key={i} className="h-[54px] px-6 py-4"><div className="h-3 w-16 rounded bg-gray-100" /></div>)}
          </div>
        </div>
      ) : stats && (
        <div className="admin-list-card overflow-x-auto">
          <table className="w-full min-w-[760px]">
            <thead>
              <tr>
                {statusItems.map((item) => (
                  <th key={item.label} className="px-6 text-center">{item.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                {statusItems.map((item) => (
                  <td key={item.label} className="px-6 text-center font-semibold text-[#333D4B]">{item.value}</td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      )}

      <div className="admin-list-card">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-[16px] font-bold text-[#191F28]">관리 메뉴</h2>
          <span className="text-[12px] font-normal text-[#8B95A1]">총 {navItems.length}개 센터</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px]">
            <thead>
              <tr>
                <th className="px-6 text-left">센터</th>
                <th className="px-6 text-left">관리범위</th>
                <th className="px-6 text-center">현황</th>
                <th className="px-6 text-center">이동</th>
              </tr>
            </thead>
            <tbody>
              {navItems.map((item) => {
                const Icon = item.icon;
                const countClass = item.countTone === 'warn'
                  ? 'bg-[#FFF3F3] text-[#F04452]'
                  : 'bg-[#F3F8FF] text-[#3180F7]';
                return (
                  <tr key={item.href}>
                    <td className="px-6">
                      <div className="flex items-center gap-3">
                        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#F3F8FF] text-[#3180F7]">
                          <Icon size={16} />
                        </span>
                        <span className="font-semibold text-[#191F28]">{item.label}</span>
                      </div>
                    </td>
                    <td className="px-6 text-[#6B7684]">{item.desc}</td>
                    <td className="px-6 text-center">
                      {item.count ? (
                        <span className={`inline-flex rounded-lg px-2.5 py-1 text-[12px] font-semibold ${countClass}`}>
                          {item.count}
                        </span>
                      ) : (
                        <span className="text-[#B0B8C1]">-</span>
                      )}
                    </td>
                    <td className="px-6 text-center">
                      <Link
                        href={item.href}
                        className="admin-icon-button inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#8B95A1] hover:bg-[#F3F8FF] hover:text-[#3180F7]"
                        aria-label={`${item.label}로 이동`}
                      >
                        <ChevronRight size={16} />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="admin-list-card">
        <div className="mb-4">
          <h2 className="text-[16px] font-bold text-[#191F28]">관리자 도구</h2>
        </div>
        <div className="grid grid-cols-1 gap-2 border-y border-[#E5E8EB] py-3 sm:grid-cols-2">
          <button
            onClick={handleCleanup}
            className="rounded-lg bg-[#F7F8FA] px-4 py-3 text-left hover:bg-[#F2F4F6]"
          >
            <span className="block text-[13px] font-semibold text-[#191F28]">빈 프로필 정리</span>
            <span className="mt-0.5 block text-[12px] font-normal text-[#8B95A1]">이미지 0 → draft 강등</span>
          </button>
          <button
            onClick={() => setTransferOpen(true)}
            className="rounded-lg bg-[#F7F8FA] px-4 py-3 text-left hover:bg-[#F2F4F6]"
          >
            <span className="flex items-center gap-1.5 text-[13px] font-semibold text-[#191F28]">
              <ArrowRightLeft size={13} /> 프로필 이관
            </span>
            <span className="mt-0.5 block text-[12px] font-normal text-[#8B95A1]">계정 연결 정리</span>
          </button>
        </div>
      </div>

      {transferOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4"
          onClick={() => setTransferOpen(false)}
        >
          <div
            className="w-full max-w-md overflow-hidden rounded-lg bg-white"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 pt-6 pb-2">
              <h2 className="text-[16px] font-bold text-[#191F28]">프로필 이관</h2>
              <p className="mt-1 text-[12px] font-normal text-[#8B95A1]">기존 계정 → 대상 계정</p>
            </div>
            <div className="px-6 py-4 space-y-4">
              <p className="text-[12px] font-normal leading-relaxed text-[#6B7684]">
                기존 계정의 프로 프로필(이미지·서비스·리뷰·채팅 등)을 대상 계정으로 통째로 이관합니다.
                대상 계정에 기존 프로필이 있으면 삭제되고, 기존 계정은 비활성화됩니다.
              </p>
              <div>
                <label className="block text-[12px] font-medium text-[#8B95A1] mb-1.5">
                  기존 계정 이메일
                </label>
                <input
                  type="email"
                  value={transferSource}
                  onChange={(e) => setTransferSource(e.target.value)}
                  className="w-full rounded-lg bg-[#F9FAFB] px-4 py-3 text-[13px] text-[#191F28] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#3180F7]"
                />
              </div>
              <div>
                <label className="block text-[12px] font-medium text-[#8B95A1] mb-1.5">
                  대상 계정 이메일
                </label>
                <input
                  type="email"
                  value={transferTarget}
                  onChange={(e) => setTransferTarget(e.target.value)}
                  className="w-full rounded-lg bg-[#F9FAFB] px-4 py-3 text-[13px] text-[#191F28] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#3180F7]"
                />
              </div>
            </div>
            <div className="px-6 pb-6 flex gap-2">
              <button
                onClick={() => setTransferOpen(false)}
                className="flex-1 rounded-lg bg-[#F2F4F6] py-3 text-[13px] font-semibold text-[#191F28] hover:bg-[#E5E8EB]"
              >
                취소
              </button>
              <button
                onClick={handleTransfer}
                disabled={transferring}
                className="flex-1 rounded-lg bg-[#3180F7] py-3 text-[13px] font-semibold text-white hover:bg-[#1B64DA] disabled:opacity-50"
              >
                {transferring ? '이관 중...' : '이관 실행'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

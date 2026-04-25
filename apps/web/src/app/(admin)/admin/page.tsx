'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Users, Star, CreditCard, UserCheck, ChevronRight, RefreshCw, Sprout, Calendar, Building2, ArrowRightLeft, Wallet } from 'lucide-react';
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
  const [seeding, setSeeding] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferSource, setTransferSource] = useState('leesj@freetiful.com');
  const [transferTarget, setTransferTarget] = useState('lsja3713@hanmail.net');
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

  const handleSeed = async () => {
    if (!confirm('전문가 데이터를 시드하시겠습니까?')) return;
    setSeeding(true);
    try {
      const data = await adminFetch('POST', '/api/v1/admin/seed-pros');
      toast.success(`완료: 생성 ${data.created}, 스킵 ${data.skipped}, 오류 ${data.errors}`);
      fetchStats();
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || '알 수 없는 오류';
      toast.error(`시드 실패: ${msg}`);
    } finally {
      setSeeding(false);
    }
  };

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
    { href: '/admin/pros', icon: UserCheck, label: '전문가 관리', desc: '승인 · 반려 · 프로필', accent: 'bg-[#E8F3FF] text-[#3182F6]', count: stats?.pendingPros ? `대기 ${stats.pendingPros}` : undefined, countTone: 'warn' as const },
    { href: '/admin/users', icon: Users, label: '유저 관리', desc: '회원 목록 · 권한', accent: 'bg-[#E7F8F3] text-[#00C896]', count: stats?.totalUsers != null ? `${stats.totalUsers.toLocaleString()}명` : undefined },
    { href: '/admin/bookings', icon: Calendar, label: '의뢰 · 예약', desc: '예약 현황', accent: 'bg-[#FFF4E5] text-[#FF9500]' },
    { href: '/admin/payments', icon: CreditCard, label: '결제 관리', desc: '결제 내역 · 매출', accent: 'bg-[#F0EEFF] text-[#8B75FF]', count: stats?.thisMonthRevenue != null ? `₩${Number(stats.thisMonthRevenue).toLocaleString()}` : undefined },
    { href: '/admin/settlements', icon: Wallet, label: '정산 관리', desc: '전문가 정산 처리', accent: 'bg-[#E7F8F3] text-[#00C896]' },
    { href: '/admin/reviews', icon: Star, label: '리뷰 관리', desc: '리뷰 목록 · 삭제', accent: 'bg-[#FFF7E0] text-[#F59E0B]', count: stats?.totalReviews != null ? `${stats.totalReviews.toLocaleString()}건` : undefined },
    { href: '/admin/businesses', icon: Building2, label: 'Biz 고객사', desc: '비즈니스 계정', accent: 'bg-[#FFECEC] text-[#F04452]' },
  ];

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between px-1">
        <div>
          <p className="text-[12px] font-bold text-[#3182F6]">운영 현황</p>
          <h1 className="mt-1 text-[26px] font-black text-[#191F28] tracking-tight">대시보드</h1>
          <p className="text-[13px] text-[#8B95A1] mt-1">유저, 전문가, 결제 흐름을 한 화면에서 빠르게 확인합니다.</p>
        </div>
        <button
          onClick={fetchStats}
          disabled={loading}
          className="admin-icon-button w-11 h-11 flex items-center justify-center rounded-full bg-white text-[#6B7684] shadow-[0_8px_20px_rgba(2,32,71,0.05)] hover:bg-[#F2F4F6] disabled:opacity-50"
          title="새로고침"
        >
          <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* 매출 히어로 */}
      {loading ? (
        <div className="admin-card p-6 animate-pulse">
          <div className="h-3 w-20 bg-gray-100 rounded mb-3" />
          <div className="h-9 w-56 bg-gray-100 rounded" />
        </div>
      ) : stats && (
        <div className="admin-card relative overflow-hidden p-6 md:p-7">
          <div className="absolute inset-x-0 top-0 h-1 bg-[#3182F6]" />
          <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-[13px] font-bold text-[#6B7684]">이번달 매출</p>
              <p className="mt-2 text-[34px] leading-tight font-black text-[#191F28] tracking-tight md:text-[40px]">
                ₩{Number(stats.thisMonthRevenue).toLocaleString()}
              </p>
            </div>
            <div className="rounded-2xl bg-[#F7F8FA] px-4 py-3 text-right">
              <p className="text-[12px] font-bold text-[#8B95A1]">누적 매출</p>
              <p className="mt-1 text-[18px] font-black text-[#191F28]">₩{Number(stats.totalRevenue).toLocaleString()}</p>
            </div>
          </div>
        </div>
      )}

      {/* 통계 4분할 */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[1,2,3,4].map((i) => (
            <div key={i} className="admin-card p-4 animate-pulse">
              <div className="h-3 w-14 bg-gray-100 rounded mb-2" />
              <div className="h-6 w-20 bg-gray-100 rounded" />
            </div>
          ))}
        </div>
      ) : stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: '전체 유저', value: stats.totalUsers.toLocaleString(), unit: '명' },
            { label: '승인 전문가', value: stats.totalPros.toLocaleString(), unit: '명' },
            { label: '승인 대기', value: `${stats.pendingPros}`, unit: '명', highlight: stats.pendingPros > 0 },
            { label: '리뷰', value: stats.totalReviews.toLocaleString(), unit: '건' },
          ].map((item, index) => (
            <div
              key={item.label}
              className="admin-card admin-metric-card p-4 md:p-5"
              style={{ animationDelay: `${index * 40}ms` }}
            >
              <p className="text-[12px] font-bold text-[#8B95A1]">{item.label}</p>
              <p className="mt-1.5 text-[22px] font-black tracking-tight">
                <span className={item.highlight ? 'text-[#F04452]' : 'text-[#191F28]'}>{item.value}</span>
                <span className="text-[13px] font-bold text-[#8B95A1] ml-1">{item.unit}</span>
              </p>
            </div>
          ))}
        </div>
      )}

      {/* 관리 메뉴 */}
      <div className="admin-list-card">
        <div className="px-5 pt-5 pb-1">
          <h2 className="text-[16px] font-black text-[#191F28]">관리 메뉴</h2>
        </div>
        <div className="divide-y divide-[#F2F4F6]">
          {navItems.map((item) => {
            const Icon = item.icon;
            const countClass = item.countTone === 'warn'
              ? 'text-[#F04452] bg-[#FFECEC]'
              : 'text-[#3182F6] bg-[#E8F3FF]';
            return (
              <Link
                key={item.href}
                href={item.href}
                className="group flex items-center gap-3 px-5 py-3.5 hover:bg-[#F7FAFF]"
              >
                <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-105 ${item.accent}`}>
                  <Icon size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[15px] font-semibold text-[#191F28] truncate">{item.label}</p>
                  <p className="text-[12px] text-[#8B95A1] mt-0.5 truncate">{item.desc}</p>
                </div>
                {item.count && (
                  <span className={`text-[12px] font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${countClass}`}>
                    {item.count}
                  </span>
                )}
                <ChevronRight size={18} className="text-[#B0B8C1] shrink-0 transition-transform group-hover:translate-x-0.5" />
              </Link>
            );
          })}
        </div>
      </div>

      {/* 관리자 도구 */}
      <div className="admin-card p-5">
        <h2 className="text-[16px] font-black text-[#191F28] mb-3">관리자 도구</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <button
            onClick={handleCleanup}
            className="px-4 py-3 rounded-2xl bg-[#F7F8FA] hover:bg-[#F2F4F6] text-left"
          >
            <span className="block text-[13px] font-semibold text-[#F04452]">빈 프로필 정리</span>
            <span className="block text-[11px] text-[#8B95A1] mt-0.5">이미지 0 → draft 강등</span>
          </button>
          <button
            onClick={() => setTransferOpen(true)}
            className="px-4 py-3 rounded-2xl bg-[#F7F8FA] hover:bg-[#F2F4F6] text-left"
          >
            <span className="flex items-center gap-1.5 text-[13px] font-semibold text-[#191F28]">
              <ArrowRightLeft size={13} /> 프로필 이관
            </span>
            <span className="block text-[11px] text-[#8B95A1] mt-0.5">더미 → 실계정</span>
          </button>
          <button
            onClick={handleSeed}
            disabled={seeding}
            className="px-4 py-3 rounded-2xl bg-[#F7F8FA] hover:bg-[#F2F4F6] disabled:opacity-50 text-left"
          >
            <span className="flex items-center gap-1.5 text-[13px] font-semibold text-[#191F28]">
              <Sprout size={13} /> {seeding ? '시드 중...' : '전문가 시드'}
            </span>
            <span className="block text-[11px] text-[#8B95A1] mt-0.5">데모 데이터 주입</span>
          </button>
        </div>
      </div>

      {/* 프로필 이관 모달 */}
      {transferOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onClick={() => setTransferOpen(false)}
        >
          <div
            className="bg-white rounded-3xl w-full max-w-md overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 pt-6 pb-2">
              <h2 className="text-[18px] font-bold text-[#191F28]">프로필 이관</h2>
              <p className="text-[12px] text-[#8B95A1] mt-1">더미 계정 → 실계정</p>
            </div>
            <div className="px-6 py-4 space-y-4">
              <p className="text-[12px] text-[#6B7684] leading-relaxed">
                source 계정의 프로 프로필(이미지·서비스·리뷰·채팅 등)을 target 계정으로 통째로 이관합니다.
                target에 기존 프로필이 있으면 삭제되고, source 이메일은 archived-... 로 변경됩니다.
              </p>
              <div>
                <label className="block text-[12px] font-medium text-[#8B95A1] mb-1.5">
                  source (더미) 이메일
                </label>
                <input
                  type="email"
                  value={transferSource}
                  onChange={(e) => setTransferSource(e.target.value)}
                  className="w-full bg-[#F9FAFB] rounded-xl px-4 py-3 text-[14px] text-[#191F28] focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#3182F6]"
                />
              </div>
              <div>
                <label className="block text-[12px] font-medium text-[#8B95A1] mb-1.5">
                  target (실계정) 이메일
                </label>
                <input
                  type="email"
                  value={transferTarget}
                  onChange={(e) => setTransferTarget(e.target.value)}
                  className="w-full bg-[#F9FAFB] rounded-xl px-4 py-3 text-[14px] text-[#191F28] focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#3182F6]"
                />
              </div>
            </div>
            <div className="px-6 pb-6 flex gap-2">
              <button
                onClick={() => setTransferOpen(false)}
                className="flex-1 py-3.5 rounded-2xl bg-[#F2F4F6] text-[#191F28] text-[15px] font-semibold hover:bg-[#E5E8EB]"
              >
                취소
              </button>
              <button
                onClick={handleTransfer}
                disabled={transferring}
                className="flex-1 py-3.5 rounded-2xl bg-[#3182F6] text-white text-[15px] font-semibold hover:bg-[#1B64DA] disabled:opacity-50"
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

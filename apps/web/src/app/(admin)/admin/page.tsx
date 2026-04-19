'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Users, Star, CreditCard, UserCheck, ChevronRight, RefreshCw, Sprout, Calendar, Building2 } from 'lucide-react';
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

  const navItems = [
    { href: '/admin/pros', icon: <UserCheck size={20} />, label: '전문가 관리', desc: '승인/반려, 프로필 수정', color: 'text-blue-600 bg-blue-50', count: stats?.pendingPros ? `대기 ${stats.pendingPros}명` : undefined },
    { href: '/admin/users', icon: <Users size={20} />, label: '유저 관리', desc: '회원 목록, 권한 변경', color: 'text-emerald-600 bg-emerald-50', count: stats?.totalUsers != null ? `전체 ${stats.totalUsers}명` : undefined },
    { href: '/admin/bookings', icon: <Calendar size={20} />, label: '의뢰/예약', desc: '예약 현황 관리', color: 'text-orange-600 bg-orange-50' },
    { href: '/admin/payments', icon: <CreditCard size={20} />, label: '결제 관리', desc: '결제 내역, 매출', color: 'text-violet-600 bg-violet-50', count: stats?.thisMonthRevenue != null ? `이번달 ₩${Number(stats.thisMonthRevenue).toLocaleString()}` : undefined },
    { href: '/admin/reviews', icon: <Star size={20} />, label: '리뷰 관리', desc: '리뷰 목록, 삭제', color: 'text-amber-600 bg-amber-50', count: stats?.totalReviews != null ? `${stats.totalReviews}건` : undefined },
    { href: '/admin/businesses', icon: <Building2 size={20} />, label: 'Biz 고객사', desc: '비즈니스 계정', color: 'text-rose-600 bg-rose-50' },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">대시보드</h1>
          <p className="text-xs text-gray-400 mt-0.5">프리티풀 전체 관리</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleSeed} disabled={seeding} className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-medium transition-colors disabled:opacity-50">
            <Sprout size={14} /> {seeding ? '시드 중...' : '전문가 시드'}
          </button>
          <button onClick={fetchStats} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <RefreshCw size={16} className="text-gray-500" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
          {[1,2,3,4,5,6].map((i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 animate-pulse">
              <div className="h-3 w-16 bg-gray-100 rounded mb-2" />
              <div className="h-6 w-24 bg-gray-100 rounded" />
            </div>
          ))}
        </div>
      ) : stats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
          {[
            { label: '전체 유저', value: `${stats.totalUsers.toLocaleString()}명`, color: 'text-blue-600' },
            { label: '승인 전문가', value: `${stats.totalPros.toLocaleString()}명`, color: 'text-emerald-600' },
            { label: '승인 대기', value: `${stats.pendingPros}명`, color: stats.pendingPros > 0 ? 'text-amber-600' : 'text-gray-400' },
            { label: '전체 리뷰', value: `${stats.totalReviews.toLocaleString()}건`, color: 'text-violet-600' },
            { label: '이번달 매출', value: `₩${Number(stats.thisMonthRevenue).toLocaleString()}`, color: 'text-green-600' },
            { label: '누적 매출', value: `₩${Number(stats.totalRevenue).toLocaleString()}`, color: 'text-gray-700' },
          ].map((item) => (
            <div key={item.label} className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs text-gray-400 mb-1">{item.label}</p>
              <p className={`text-lg font-bold ${item.color}`}>{item.value}</p>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {navItems.map((item) => (
          <Link key={item.href} href={item.href}>
            <div className="bg-white rounded-xl border border-gray-200 p-5 hover:border-gray-300 hover:shadow-sm transition-all group cursor-pointer">
              <div className="flex items-start justify-between">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${item.color} mb-3`}>
                  {item.icon}
                </div>
                <ChevronRight size={18} className="text-gray-300 group-hover:text-gray-500 transition-colors mt-0.5" />
              </div>
              <h3 className="text-sm font-bold text-gray-900">{item.label}</h3>
              <p className="text-xs text-gray-400 mt-0.5">{item.desc}</p>
              {item.count && (
                <span className="inline-block mt-2 text-[11px] font-medium bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                  {item.count}
                </span>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

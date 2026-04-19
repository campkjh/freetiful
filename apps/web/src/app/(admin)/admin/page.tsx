'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Users, Star, CreditCard, MessageSquare, UserCheck, ChevronRight, RefreshCw, Sprout } from 'lucide-react';
import toast from 'react-hot-toast';
import { apiClient } from '@/lib/api/client';

const ADMIN_KEY = process.env.NEXT_PUBLIC_ADMIN_KEY || '';

async function adminFetch(method: string, path: string, body?: any) {
  const adminKey = localStorage.getItem('admin-key') || ADMIN_KEY;
  const res = await apiClient.request({ method, url: path, data: body, headers: { 'x-admin-key': adminKey } });
  return res.data;
}

interface Stats {
  totalUsers: number;
  totalPros: number;
  pendingPros: number;
  totalReviews: number;
  thisMonthRevenue: number;
  totalRevenue: number;
}

export default function AdminPage() {
  const [adminKey, setAdminKey] = useState('');
  const [keyInput, setKeyInput] = useState('');
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const data = await adminFetch('GET', '/api/v1/admin/stats');
      setStats(data);
    } catch {
      toast.error('통계를 불러오지 못했습니다');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const stored = localStorage.getItem('admin-key');
    if (stored) { setAdminKey(stored); }
    else setLoading(false);
  }, []);

  useEffect(() => {
    if (adminKey) fetchStats();
  }, [adminKey]);

  const handleKeySubmit = () => {
    localStorage.setItem('admin-key', keyInput);
    setAdminKey(keyInput);
  };

  const handleSeed = async () => {
    if (!confirm('전문가 데이터를 시드하시겠습니까?')) return;
    setSeeding(true);
    try {
      const res = await adminFetch('POST', '/api/v1/admin/seed-pros');
      toast.success(`완료: 생성 ${res.created}, 스킵 ${res.skipped}, 오류 ${res.errors}`);
      fetchStats();
    } catch {
      toast.error('시드 실패');
    } finally {
      setSeeding(false);
    }
  };

  if (!adminKey) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-xl border border-gray-200 p-8 w-full max-w-sm shadow-sm">
          <div className="text-center mb-6">
            <div className="w-12 h-12 bg-gray-900 rounded-xl flex items-center justify-center mx-auto mb-3">
              <span className="text-white text-xl">🔑</span>
            </div>
            <h2 className="text-lg font-bold text-gray-900">관리자 인증</h2>
            <p className="text-sm text-gray-400 mt-1">Admin Key를 입력하세요</p>
          </div>
          <input
            type="password"
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleKeySubmit()}
            placeholder="Admin Key"
            className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-blue-200"
          />
          <button onClick={handleKeySubmit} className="w-full bg-gray-900 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-gray-800 transition-colors">
            확인
          </button>
        </div>
      </div>
    );
  }

  const navItems = [
    { href: '/admin/pros', icon: <UserCheck size={20} />, label: '전문가 관리', desc: '승인/반려, 파트너 로고', color: 'text-blue-600 bg-blue-50', count: stats?.pendingPros ? `대기 ${stats.pendingPros}명` : undefined },
    { href: '/admin/users', icon: <Users size={20} />, label: '유저 관리', desc: '회원 목록, 권한 변경', color: 'text-emerald-600 bg-emerald-50', count: stats?.totalUsers != null ? `일반 ${stats.totalUsers}명` : undefined },
    { href: '/admin/payments', icon: <CreditCard size={20} />, label: '결제 관리', desc: '결제 내역, 매출 현황', color: 'text-violet-600 bg-violet-50', count: stats?.thisMonthRevenue != null ? `이번달 ₩${Number(stats.thisMonthRevenue).toLocaleString()}` : undefined },
    { href: '/admin/reviews', icon: <Star size={20} />, label: '리뷰 관리', desc: '리뷰 목록, 삭제', color: 'text-amber-600 bg-amber-50', count: stats?.totalReviews != null ? `${stats.totalReviews}건` : undefined },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-900">프리티풀 어드민</h1>
            <p className="text-xs text-gray-400">관리자 대시보드</p>
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
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Stats Grid */}
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

        {/* Nav Cards */}
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
    </div>
  );
}

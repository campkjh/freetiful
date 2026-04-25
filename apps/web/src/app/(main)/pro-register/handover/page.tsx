'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, CheckCircle2, Loader2, Search } from 'lucide-react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { prosApi, type ProfileHandoverCandidate } from '@/lib/api/pros.api';
import { useAuthStore } from '@/lib/store/auth.store';

function formatPrice(value: number | null) {
  if (!value) return '가격 미등록';
  return `${value.toLocaleString()}원`;
}

function clearHandoverCaches(profileId?: string) {
  if (typeof window === 'undefined') return;
  [
    'freetiful-pros-cache-v4',
    'freetiful-pros-cache',
    'freetiful-pro-dashboard-cache-v2',
    'freetiful-my-pro-category',
    'freetiful-my-pro-stats-cache-v1',
    'freetiful-pudding',
    'proRegister_allAgreed',
    'proRegister_terms',
    'proRegister_name',
    'proRegister_phone',
    'proRegister_gender',
    'proRegister_category',
    'proRegister_selectedCategories',
    'proRegister_regions',
    'proRegister_photos',
    'freetiful_pro_register_draft',
  ].forEach((key) => {
    try { localStorage.removeItem(key); } catch {}
  });
  try {
    localStorage.setItem('userRole', 'pro');
    if (profileId) localStorage.setItem('freetiful-my-pro-id', profileId);
  } catch {}
}

export default function ProfileHandoverPage() {
  const router = useRouter();
  const authUser = useAuthStore((state) => state.user);
  const hasHydrated = useAuthStore((state) => state.hasHydrated);
  const setUser = useAuthStore((state) => state.setUser);
  const [search, setSearch] = useState('');
  const [items, setItems] = useState<ProfileHandoverCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [claimingId, setClaimingId] = useState<string | null>(null);

  const trimmedSearch = useMemo(() => search.trim(), [search]);

  useEffect(() => {
    if (!hasHydrated) return;
    if (!authUser) {
      setLoading(false);
      return;
    }

    let alive = true;
    const timer = window.setTimeout(() => {
      setLoading(true);
      prosApi.getProfileHandoverCandidates({ search: trimmedSearch || undefined, limit: 40 })
        .then((data) => {
          if (alive) setItems(data);
        })
        .catch((error) => {
          if (alive) {
            setItems([]);
            toast.error(error?.response?.data?.message || '프로필 목록을 불러오지 못했습니다.');
          }
        })
        .finally(() => {
          if (alive) setLoading(false);
        });
    }, trimmedSearch ? 220 : 0);

    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [authUser, hasHydrated, trimmedSearch]);

  async function handleClaim(candidate: ProfileHandoverCandidate) {
    if (!authUser || claimingId) return;
    setClaimingId(candidate.id);
    try {
      const result = await prosApi.claimProfileHandover(candidate.id);
      setUser(result.user);
      clearHandoverCaches(result.profile?.id || candidate.id);
      window.dispatchEvent(new CustomEvent('freetiful:auth-changed', { detail: { user: result.user } }));
      toast.success(`${candidate.name} 프로필을 연결했습니다.`);
      router.replace('/pro-dashboard');
    } catch (error: any) {
      toast.error(error?.response?.data?.message || '프로필 인수에 실패했습니다.');
    } finally {
      setClaimingId(null);
    }
  }

  return (
    <div className="min-h-[100dvh] bg-white">
      <div className="sticky top-0 z-20 border-b border-gray-100 bg-white/95 px-4 pb-3 pt-4 backdrop-blur">
        <div className="mb-4 flex items-center gap-3">
          <motion.button
            type="button"
            onClick={() => router.back()}
            whileTap={{ scale: 0.9 }}
            className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-gray-50"
          >
            <ArrowLeft size={22} className="text-gray-900" />
          </motion.button>
          <div>
            <p className="text-[12px] font-medium text-[#3180F7]">파트너스</p>
            <h1 className="text-[18px] font-bold leading-6 text-gray-900">기존 프로필 인수</h1>
          </div>
        </div>

        <div className="flex items-center gap-2 rounded-2xl bg-gray-50 px-4 py-3">
          <Search size={18} className="shrink-0 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="이름으로 검색"
            className="w-full bg-transparent text-[15px] font-medium text-gray-900 outline-none placeholder:text-gray-300"
          />
        </div>
      </div>

      {!hasHydrated || loading ? (
        <div className="space-y-3 px-4 py-5">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="flex gap-3 rounded-2xl border border-gray-100 p-3">
              <div className="h-16 w-16 animate-pulse rounded-xl bg-gray-100" />
              <div className="min-w-0 flex-1 space-y-2 py-1">
                <div className="h-4 w-24 animate-pulse rounded-full bg-gray-100" />
                <div className="h-3 w-full animate-pulse rounded-full bg-gray-100" />
                <div className="h-3 w-2/3 animate-pulse rounded-full bg-gray-100" />
              </div>
            </div>
          ))}
        </div>
      ) : !authUser ? (
        <div className="px-5 py-20 text-center">
          <p className="text-[16px] font-bold text-gray-900">로그인이 필요합니다</p>
          <button
            type="button"
            onClick={() => window.dispatchEvent(new Event('freetiful:show-login'))}
            className="mt-5 rounded-2xl bg-[#3180F7] px-6 py-3 text-[14px] font-bold text-white"
          >
            로그인하기
          </button>
        </div>
      ) : items.length === 0 ? (
        <div className="px-5 py-20 text-center">
          <p className="text-[16px] font-bold text-gray-900">검색 결과가 없습니다</p>
          <p className="mt-2 text-[13px] leading-5 text-gray-400">이름을 다시 확인해주세요.</p>
        </div>
      ) : (
        <div className="space-y-3 px-4 py-5 pb-10">
          {items.map((item, index) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(index * 0.03, 0.18) }}
              className="rounded-2xl border border-gray-100 bg-white p-3 shadow-[0_2px_10px_rgba(15,23,42,0.04)]"
            >
              <div className="flex gap-3">
                <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-gray-100">
                  <img
                    src={item.profileImageUrl || '/images/default-profile.svg'}
                    alt={item.name}
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-[16px] font-bold text-gray-900">{item.name}</p>
                      <p className="mt-0.5 line-clamp-1 text-[12px] font-medium text-gray-400">
                        {item.categories[0] || '사회자'} · 경력 {item.careerYears ?? 0}년
                      </p>
                    </div>
                    {item.isMine && (
                      <span className="rounded-full bg-[#EAF3FF] px-2 py-1 text-[11px] font-bold text-[#3180F7]">
                        연결됨
                      </span>
                    )}
                  </div>
                  <p className="mt-2 line-clamp-2 text-[13px] leading-5 text-gray-600">
                    {item.shortIntro || item.mainExperience || '등록된 소개가 없습니다.'}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px] font-semibold text-gray-500">
                    <span>후기 {item.reviewCount}</span>
                    <span className="h-1 w-1 rounded-full bg-gray-300" />
                    <span>{formatPrice(item.basePrice)}</span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                disabled={item.isMine || claimingId !== null}
                onClick={() => handleClaim(item)}
                className={`mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-xl text-[14px] font-bold transition active:scale-[0.98] disabled:cursor-default ${
                  item.isMine
                    ? 'bg-gray-100 text-gray-400'
                    : 'bg-[#3180F7] text-white shadow-[0_6px_14px_rgba(49,128,247,0.22)]'
                }`}
              >
                {claimingId === item.id ? (
                  <Loader2 size={17} className="animate-spin" />
                ) : item.isMine ? (
                  <CheckCircle2 size={17} />
                ) : null}
                {item.isMine ? '이미 내 계정에 연결됨' : claimingId === item.id ? '연결 중' : '이 프로필 인수하기'}
              </button>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

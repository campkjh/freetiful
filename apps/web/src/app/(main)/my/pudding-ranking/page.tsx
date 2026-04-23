'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Crown, Medal } from 'lucide-react';
import { useAuthStore } from '@/lib/store/auth.store';
import { apiClient } from '@/lib/api/client';

interface RankEntry {
  rank: number;
  name: string;
  pudding: number;
  isCurrentUser?: boolean;
}

function getRankColor(rank: number) {
  if (rank === 1) return { bg: '#FEF3C7', text: '#D97706', icon: '#F59E0B' };
  if (rank === 2) return { bg: '#F3F4F6', text: '#6B7280', icon: '#9CA3AF' };
  if (rank === 3) return { bg: '#FED7AA', text: '#C2410C', icon: '#F97316' };
  return { bg: '#F9FAFB', text: '#9CA3AF', icon: '#D1D5DB' };
}

export default function PuddingRankingPage() {
  const router = useRouter();
  const authUser = useAuthStore((s) => s.user);
  const [ranking, setRanking] = useState<RankEntry[]>([]);
  const [myRank, setMyRank] = useState(0);

  useEffect(() => {
    window.scrollTo(0, 0);

    apiClient.get('/api/v1/pro/pudding/rank')
      .then((res) => {
        const arr: any[] = Array.isArray(res.data) ? res.data : (Array.isArray(res.data?.data) ? res.data.data : []);
        const mapped: RankEntry[] = arr.map((entry: any, idx: number) => ({
          rank: entry.puddingRank ?? entry.rank ?? idx + 1,
          name: entry.user?.name ?? entry.name ?? '익명',
          pudding: entry.puddingCount ?? entry.pudding ?? 0,
          isCurrentUser: authUser ? (entry.user?.id === authUser.id) : false,
        }));
        const found = mapped.find((e) => e.isCurrentUser);
        setRanking(mapped);
        setMyRank(found ? found.rank : 0);
      })
      .catch(() => { setRanking([]); setMyRank(0); });
  }, [authUser]);

  return (
    <div className="bg-white min-h-screen" style={{ letterSpacing: '-0.02em' }}>
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white">
        <div className="flex items-center h-[52px] px-4">
          <button onClick={() => router.back()} className="p-1 -ml-1 active:scale-90 transition-transform">
            <ChevronLeft size={24} className="text-gray-900" />
          </button>
          <h1 className="text-[18px] font-bold text-gray-900 ml-1">랭킹 보기</h1>
        </div>
      </div>

      {/* My Rank Summary */}
      <div className="px-4 pt-2 pb-5">
        <div className="rounded-xl bg-amber-50 border border-amber-100 px-4 py-4">
          <p className="text-[13px] text-amber-600">내 순위</p>
          <p className="text-[28px] font-bold text-amber-800 mt-1">{myRank > 0 ? `${myRank}위` : '랭킹 없음'}</p>
          {myRank > 0 && ranking.length > 0 && (
            <p className="text-[12px] text-amber-500 mt-1">
              상위 {Math.min(Math.round((myRank / ranking.length) * 100), 100)}%
              {' | '}
              보유 {ranking.find((e) => e.isCurrentUser)?.pudding.toLocaleString() || 0}개
            </p>
          )}
        </div>
      </div>

      {/* Divider */}
      <div className="h-px bg-gray-200" />

      {/* Ranking List */}
      <div className="px-4 pt-5 pb-10">
        <p className="text-[16px] font-bold text-gray-900 mb-4">TOP 10</p>
        <div className="space-y-2">
          {ranking.filter(e => e.rank <= 10).map((entry) => {
            const colors = getRankColor(entry.rank);
            return (
              <div
                key={entry.rank}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${
                  entry.isCurrentUser ? 'bg-blue-50 border border-blue-200' : 'bg-gray-50'
                }`}
              >
                {/* Rank */}
                <div className="w-8 text-center">
                  {entry.rank <= 3 ? (
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: colors.bg }}
                    >
                      {entry.rank === 1 ? (
                        <Crown size={16} style={{ color: colors.icon }} />
                      ) : (
                        <Medal size={16} style={{ color: colors.icon }} />
                      )}
                    </div>
                  ) : (
                    <span className="text-[15px] font-bold text-gray-400">{entry.rank}</span>
                  )}
                </div>

                {/* Name */}
                <div className="flex-1">
                  <p className={`text-[15px] font-bold ${entry.isCurrentUser ? 'text-blue-700' : 'text-gray-900'}`}>
                    {entry.name}
                    {entry.isCurrentUser && <span className="text-[11px] text-blue-500 ml-1.5">나</span>}
                  </p>
                </div>

                {/* Pudding count */}
                <p className="text-[15px] font-bold text-amber-600">{entry.pudding.toLocaleString()}개</p>
              </div>
            );
          })}

          {/* Show current user if not in top 10 */}
          {ranking.filter(e => e.isCurrentUser && e.rank > 10).map((entry) => (
            <div key="myrank">
              <div className="flex items-center justify-center py-2">
                <span className="text-[12px] text-gray-300">...</span>
              </div>
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-blue-50 border border-blue-200">
                <div className="w-8 text-center">
                  <span className="text-[15px] font-bold text-blue-500">{entry.rank}</span>
                </div>
                <div className="flex-1">
                  <p className="text-[15px] font-bold text-blue-700">
                    {entry.name}
                    <span className="text-[11px] text-blue-500 ml-1.5">나</span>
                  </p>
                </div>
                <p className="text-[15px] font-bold text-amber-600">{entry.pudding.toLocaleString()}개</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, TrendingUp, Trophy, Info } from 'lucide-react';
import { useAuthStore } from '@/lib/store/auth.store';
import { apiClient } from '@/lib/api/client';
import { ProCardListSkeleton, ProRankingSkeleton, SkeletonBlock } from '../_components/ProSkeletons';

const EARNING_RULES = [
  { action: '1:1 견적 답변', pudding: '+3', icon: '💬' },
  { action: '다중 견적 답변', pudding: '+2', icon: '📋' },
  { action: '매칭 성공', pudding: '+10', icon: '🎯' },
  { action: '만점 리뷰', pudding: '+8', icon: '⭐' },
  { action: '클로저 정보 등록', pudding: '+3', icon: '📝' },
  { action: '추천 유저 가입', pudding: '+8', icon: '👥' },
];

const REASON_LABEL: Record<string, string> = {
  quote_reply_single: '1:1 견적 답변',
  quote_reply_multi: '다중 견적 답변',
  successful_match: '매칭 성공',
  perfect_review: '만점 리뷰',
  info_registered: '클로저 정보 등록',
  referral_joined: '추천 유저 가입',
};

interface HistoryItem {
  id: string;
  reason: string;
  amount: number;
  date: string;
  balance: number;
}

interface RankItem {
  rank: number;
  name: string;
  pudding: number;
  image: string;
  isMe: boolean;
}

export default function PuddingPage() {
  const router = useRouter();
  const authUser = useAuthStore((s) => s.user);
  const [balance, setBalance] = useState<number | null>(null);
  const [myRank, setMyRank] = useState<number | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [ranking, setRanking] = useState<RankItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authUser) { setLoading(false); return; }
    setLoading(true);
    Promise.all([
      apiClient.get('/api/v1/pro/pudding').then((r) => r.data).catch(() => null),
      apiClient.get('/api/v1/pro/pudding/rank').then((r) => r.data).catch(() => null),
    ])
      .then(([me, rankRes]) => {
        if (me) {
          setBalance(me.balance ?? me.puddingCount ?? 0);
          setMyRank(me.rank ?? me.puddingRank ?? null);
          const rows: any[] = Array.isArray(me.history) ? me.history : (Array.isArray(me.transactions) ? me.transactions : []);
          setHistory(rows.map((t: any) => ({
            id: t.id,
            reason: REASON_LABEL[t.reason] || t.note || '활동',
            amount: t.amount ?? 0,
            date: t.createdAt ? new Date(t.createdAt).toISOString().slice(0, 16).replace('T', ' ') : '',
            balance: t.balanceAfter ?? 0,
          })));
        }
        const rankArr: any[] = Array.isArray(rankRes) ? rankRes : (Array.isArray(rankRes?.data) ? rankRes.data : []);
        setRanking(rankArr.map((r: any, i: number) => ({
          rank: r.puddingRank ?? r.rank ?? i + 1,
          name: r.user?.name ?? r.name ?? '익명',
          pudding: r.puddingCount ?? r.pudding ?? 0,
          image: r.user?.profileImageUrl ?? r.image ?? '/images/default-profile.svg',
          isMe: authUser && r.user?.id === authUser.id ? true : false,
        })));
      })
      .finally(() => setLoading(false));
  }, [authUser]);

  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="bg-white px-4 pt-12 pb-4 sticky top-0 z-10 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="p-1"><ArrowLeft size={22} /></button>
          <h1 className="text-lg font-bold">푸딩</h1>
        </div>
      </div>

      <div className="bg-gradient-to-r from-yellow-400 to-orange-400 mx-4 mt-4 rounded-2xl p-5 text-white">
        <p className="text-xs opacity-80">내 푸딩</p>
        <div className="flex items-end justify-between mt-1">
          {loading ? (
            <SkeletonBlock className="h-10 w-24 rounded-lg bg-white/30" />
          ) : (
            <p className="text-4xl font-black">{balance ?? 0}</p>
          )}
          <div className="text-right">
            {loading ? (
              <>
                <SkeletonBlock className="ml-auto mb-1.5 h-5 w-20 rounded bg-white/30" />
                <SkeletonBlock className="ml-auto h-2.5 w-24 rounded bg-white/30" />
              </>
            ) : (
              <>
                <p className="text-lg font-bold">
                  {myRank == null ? '랭킹 없음' : myRank <= 3 ? `${['🥇','🥈','🥉'][myRank - 1]} ${myRank}위` : `${myRank}위`}
                </p>
                <p className="text-[10px] opacity-70">실시간 랭킹 반영</p>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="mx-4 mt-3 bg-red-50 rounded-xl p-3 flex items-start gap-2">
        <Info size={14} className="text-red-400 shrink-0 mt-0.5" />
        <p className="text-xs text-red-600">
          푸딩은 활동과 관리자 지급/차감에 따라 실시간으로 랭킹에 반영됩니다.
          상위권 유지를 위해 꾸준히 활동하세요!
        </p>
      </div>

      <div className="px-4 mt-5">
        <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-1">
          <Trophy size={14} className="text-yellow-500" /> 오늘의 랭킹
        </h3>
        {loading && ranking.length === 0 ? (
          <ProRankingSkeleton />
        ) : (
        <div className="card overflow-hidden">
          {ranking.length === 0 ? (
            <div className="px-4 py-6 text-center text-[13px] text-gray-400">
              아직 랭킹 데이터가 없습니다
            </div>
          ) : ranking.map((r) => (
            <div key={r.rank} className={`flex items-center gap-3 px-4 py-3 border-b border-gray-50 last:border-0 ${
              r.isMe ? 'bg-primary-50' : ''
            }`}>
              <span className={`text-sm font-black w-6 text-center ${
                r.rank === 1 ? 'text-yellow-500' : r.rank === 2 ? 'text-gray-400' : r.rank === 3 ? 'text-orange-500' : 'text-gray-300'
              }`}>
                {r.rank}
              </span>
              <img src={r.image} alt={r.name} className="w-8 h-8 rounded-full object-cover" />
              <span className={`flex-1 text-sm ${r.isMe ? 'font-bold text-primary-600' : 'text-gray-700'}`}>
                {r.name} {r.isMe && '(나)'}
              </span>
              <span className="text-sm font-bold text-gray-900">{r.pudding}</span>
            </div>
          ))}
        </div>
        )}
      </div>

      <div className="px-4 mt-5">
        <h3 className="text-sm font-bold text-gray-900 mb-3">푸딩 획득 방법</h3>
        <div className="grid grid-cols-2 gap-2">
          {EARNING_RULES.map((rule) => (
            <div key={rule.action} className="card p-3 flex items-center gap-2.5">
              <span className="text-xl">{rule.icon}</span>
              <div>
                <p className="text-xs text-gray-700">{rule.action}</p>
                <p className="text-sm font-bold text-primary-500">{rule.pudding}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="px-4 mt-5 mb-8">
        <h3 className="text-sm font-bold text-gray-900 mb-3">획득 내역</h3>
        {loading && history.length === 0 ? (
          <ProCardListSkeleton count={4} avatar className="" />
        ) : (
        <div className="card">
          {history.length === 0 ? (
            <div className="px-4 py-6 text-center text-[13px] text-gray-400">
              획득 내역이 없습니다
            </div>
          ) : history.map((item) => (
            <div key={item.id} className="flex items-center gap-3 px-4 py-3 border-b border-gray-50 last:border-0">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                item.amount > 0 ? 'bg-green-50' : 'bg-red-50'
              }`}>
                <TrendingUp size={14} className={item.amount > 0 ? 'text-green-500' : 'text-red-500 rotate-180'} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-900">{item.reason}</p>
                <p className="text-[10px] text-gray-400">{item.date}</p>
              </div>
              <div className="text-right shrink-0">
                <p className={`text-sm font-bold ${item.amount > 0 ? 'text-green-600' : 'text-red-500'}`}>
                  {item.amount > 0 ? '+' : ''}{item.amount}
                </p>
                <p className="text-[10px] text-gray-400">잔액 {item.balance}</p>
              </div>
            </div>
          ))}
        </div>
        )}
      </div>
    </div>
  );
}

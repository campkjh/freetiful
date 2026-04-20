'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, TrendingUp, Trophy, Info } from 'lucide-react';
import { useAuthStore } from '@/lib/store/auth.store';
import { apiClient } from '@/lib/api/client';

const EARNING_RULES = [
  { action: '1:1 견적 답변', pudding: '+3', icon: '💬' },
  { action: '다중 견적 답변', pudding: '+2', icon: '📋' },
  { action: '매칭 성공', pudding: '+10', icon: '🎯' },
  { action: '만점 리뷰', pudding: '+8', icon: '⭐' },
  { action: '클로저 정보 등록', pudding: '+3', icon: '📝' },
  { action: '추천 유저 가입', pudding: '+8', icon: '👥' },
];

const MOCK_HISTORY = [
  { id: '1', reason: '1:1 견적 답변', amount: 3, date: '2026-03-25 14:30', balance: 45 },
  { id: '2', reason: '매칭 성공', amount: 10, date: '2026-03-24 10:00', balance: 42 },
  { id: '3', reason: '만점 리뷰', amount: 8, date: '2026-03-23 16:20', balance: 32 },
  { id: '4', reason: '다중 견적 답변', amount: 2, date: '2026-03-23 09:15', balance: 24 },
  { id: '5', reason: '일일 초기화 (TOP 3)', amount: -50, date: '2026-03-22 00:00', balance: 22 },
  { id: '6', reason: '추천 유저 가입', amount: 8, date: '2026-03-21 12:00', balance: 72 },
];

const MOCK_RANKING = [
  { rank: 1, name: '김민준', pudding: 45, image: '/images/default-profile.svg', isMe: true },
  { rank: 2, name: '이서연', pudding: 38, image: '/images/default-profile.svg', isMe: false },
  { rank: 3, name: '박준혁', pudding: 35, image: '/images/default-profile.svg', isMe: false },
  { rank: 4, name: '최지은', pudding: 28, image: '/images/default-profile.svg', isMe: false },
  { rank: 5, name: '정대현', pudding: 22, image: '/images/default-profile.svg', isMe: false },
];

export default function PuddingPage() {
  const router = useRouter();
  const authUser = useAuthStore((s) => s.user);
  const [balance, setBalance] = useState(45);
  const [myRank, setMyRank] = useState(1);
  const [history, setHistory] = useState(MOCK_HISTORY);
  const [ranking, setRanking] = useState(MOCK_RANKING);

  // Fetch pudding balance & history
  useEffect(() => {
    if (!authUser) return;
    apiClient.get('/api/v1/pro/pudding')
      .then((res) => {
        const d = res.data;
        if (d?.balance != null) setBalance(d.balance);
        if (d?.rank != null) setMyRank(d.rank);
        if (Array.isArray(d?.transactions) && d.transactions.length > 0) {
          setHistory(d.transactions.map((t: any, i: number) => ({
            id: t.id || String(i),
            reason: t.reason || t.description || '',
            amount: t.amount ?? 0,
            date: t.date || (t.createdAt ? new Date(t.createdAt).toISOString().slice(0, 16).replace('T', ' ') : ''),
            balance: t.balance ?? 0,
          })));
        }
      })
      .catch(() => { /* fallback to mock */ });
  }, [authUser]);

  // Fetch pudding ranking
  useEffect(() => {
    if (!authUser) return;
    apiClient.get('/api/v1/pro/pudding/rank')
      .then((res) => {
        const d = res.data;
        if (Array.isArray(d) && d.length > 0) {
          setRanking(d.map((r: any, i: number) => ({
            rank: r.rank || i + 1,
            name: r.name || '익명',
            pudding: r.pudding ?? r.score ?? 0,
            image: r.image || r.profileImage || '/images/default-profile.svg',
            isMe: r.isMe ?? false,
          })));
        }
      })
      .catch(() => { /* fallback to mock */ });
  }, [authUser]);

  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="bg-white px-4 pt-12 pb-4 sticky top-0 z-10 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="p-1"><ArrowLeft size={22} /></button>
          <h1 className="text-lg font-bold">푸딩</h1>
        </div>
      </div>

      {/* Balance */}
      <div className="bg-gradient-to-r from-yellow-400 to-orange-400 mx-4 mt-4 rounded-2xl p-5 text-white">
        <p className="text-xs opacity-80">내 푸딩</p>
        <div className="flex items-end justify-between mt-1">
          <p className="text-4xl font-black">{balance}</p>
          <div className="text-right">
            <p className="text-lg font-bold">{myRank <= 3 ? `${['🥇','🥈','🥉'][myRank - 1]} ${myRank}위` : `${myRank}위`}</p>
            <p className="text-[10px] opacity-70">매일 00시 랭킹 갱신</p>
          </div>
        </div>
      </div>

      {/* Warning */}
      <div className="mx-4 mt-3 bg-red-50 rounded-xl p-3 flex items-start gap-2">
        <Info size={14} className="text-red-400 shrink-0 mt-0.5" />
        <p className="text-xs text-red-600">
          전일 1~3위는 매일 00시에 푸딩이 <strong>0으로 초기화</strong>됩니다.
          상위권 유지를 위해 꾸준히 활동하세요!
        </p>
      </div>

      {/* Ranking */}
      <div className="px-4 mt-5">
        <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-1">
          <Trophy size={14} className="text-yellow-500" /> 오늘의 랭킹
        </h3>
        <div className="card overflow-hidden">
          {ranking.map((r) => (
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
      </div>

      {/* Earning Rules */}
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

      {/* History */}
      <div className="px-4 mt-5 mb-8">
        <h3 className="text-sm font-bold text-gray-900 mb-3">획득 내역</h3>
        <div className="card">
          {history.map((item) => (
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
      </div>
    </div>
  );
}

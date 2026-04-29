'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { ChevronLeft, Gift, Zap, Trophy } from 'lucide-react';
import { apiClient } from '@/lib/api/client';
import { useAuthStore } from '@/lib/store/auth.store';

export default function PuddingChargePage() {
  const router = useRouter();
  const authUser = useAuthStore((s) => s.user);
  const [balance, setBalance] = useState(0);
  const [rank, setRank] = useState<number | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (!authUser) {
      setLoading(false);
      return;
    }
    let alive = true;
    apiClient.get('/api/v1/pro/pudding')
      .then((res) => {
        if (!alive) return;
        setBalance(Number(res.data?.balance || 0));
        setRank(res.data?.rank ?? null);
        setHistory(Array.isArray(res.data?.history) ? res.data.history.slice(0, 5) : []);
      })
      .catch(() => {})
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [authUser]);

  const attendance = async () => {
    if (checking) return;
    setChecking(true);
    try {
      const res = await apiClient.post('/api/v1/pro/pudding/attendance');
      if (res.data?.granted) {
        setBalance((prev) => prev + Number(res.data.amount || 0));
        toast.success(`출석 보상 ${res.data.amount || 50}푸딩이 적립되었습니다`);
      } else {
        toast('오늘 출석 보상은 이미 받았습니다');
      }
    } catch {
      toast.error('출석 보상 처리에 실패했습니다');
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-10">
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-gray-100 bg-white/90 backdrop-blur-xl px-4 pt-12 pb-3">
        <button onClick={() => router.back()} className="p-1 active:scale-90 transition-transform"><ChevronLeft size={24} /></button>
        <h1 className="text-[18px] font-bold">푸딩</h1>
      </header>

      <section className="px-4 pt-5">
        <div className="rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 p-5 text-white shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[12px] text-white/75">보유 푸딩</p>
              <p className="mt-1 text-[32px] font-black">{loading ? '...' : balance.toLocaleString()}개</p>
            </div>
            <div className="rounded-full bg-white/20 p-3">
              <Trophy size={24} />
            </div>
          </div>
          <p className="mt-2 text-[12px] text-white/80">{rank ? `현재 랭킹 ${rank}위` : '랭킹은 푸딩 활동량 기준으로 갱신됩니다'}</p>
        </div>
      </section>

      <section className="px-4 pt-3">
        <button
          onClick={attendance}
          disabled={checking}
          className="flex w-full items-center justify-between rounded-2xl bg-white p-4 shadow-sm active:scale-[0.98] transition-transform disabled:opacity-60"
        >
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-amber-50 p-2 text-amber-500"><Gift size={20} /></div>
            <div className="text-left">
              <p className="text-[14px] font-bold text-gray-900">오늘 출석 푸딩 받기</p>
              <p className="text-[12px] text-gray-400">하루 1회 50푸딩 적립</p>
            </div>
          </div>
          <span className="text-[12px] font-bold text-[#3180F7]">{checking ? '처리 중' : '+50'}</span>
        </button>
      </section>

      <section className="px-4 pt-6">
        <h2 className="mb-3 text-[15px] font-bold text-gray-900">최근 푸딩 내역</h2>
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          {history.length === 0 ? (
            <p className="py-6 text-center text-[13px] text-gray-400">아직 푸딩 사용/적립 내역이 없습니다</p>
          ) : history.map((item, index) => (
            <div key={item.id || index} className={`flex items-center justify-between py-2 ${index > 0 ? 'border-t border-gray-50' : ''}`}>
              <div className="flex items-center gap-2">
                <Zap size={16} className={Number(item.amount) >= 0 ? 'text-amber-500' : 'text-gray-400'} />
                <p className="text-[13px] font-medium text-gray-800">{item.description || item.reason || '푸딩 활동'}</p>
              </div>
              <p className={`text-[13px] font-bold ${Number(item.amount) >= 0 ? 'text-amber-600' : 'text-gray-500'}`}>
                {Number(item.amount) > 0 ? '+' : ''}{Number(item.amount || 0).toLocaleString()}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

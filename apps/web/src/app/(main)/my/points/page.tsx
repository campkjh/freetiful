'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft, Wallet, ArrowUpRight, ArrowDownRight } from 'lucide-react';

const MOCK_TRANSACTIONS = [
  { id: '1', type: 'earn', reason: '친구 초대 적립', amount: 500, date: '2026-03-20', balance: 1500 },
  { id: '2', type: 'spend', reason: '웨딩 MC 결제 사용', amount: -1000, date: '2026-03-15', balance: 1000 },
  { id: '3', type: 'earn', reason: '회원가입 축하 포인트', amount: 2000, date: '2026-03-01', balance: 2000 },
];

export default function PointsPage() {
  const router = useRouter();

  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="bg-white px-4 pt-12 pb-4 sticky top-0 z-10 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="p-1"><ArrowLeft size={22} /></button>
          <h1 className="text-lg font-bold">포인트</h1>
        </div>
      </div>

      {/* Balance */}
      <div className="bg-white px-4 py-6 border-b border-gray-100">
        <div className="bg-gradient-to-r from-primary-500 to-primary-400 rounded-2xl p-5 text-white">
          <p className="text-xs opacity-80 flex items-center gap-1"><Wallet size={12} /> 보유 포인트</p>
          <p className="text-3xl font-black mt-1">1,500 <span className="text-base font-bold">P</span></p>
          <p className="text-xs opacity-70 mt-2">1P = 1원 결제 시 사용</p>
        </div>
      </div>

      {/* History */}
      <div className="px-4 py-4">
        <p className="text-xs font-bold text-gray-400 mb-3">적립/사용 내역</p>
        <div className="space-y-0">
          {MOCK_TRANSACTIONS.map((tx) => (
            <div key={tx.id} className="flex items-center gap-3 py-3 border-b border-gray-50 last:border-0">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                tx.type === 'earn' ? 'bg-green-50' : 'bg-red-50'
              }`}>
                {tx.type === 'earn'
                  ? <ArrowDownRight size={16} className="text-green-500" />
                  : <ArrowUpRight size={16} className="text-red-500" />
                }
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-900">{tx.reason}</p>
                <p className="text-[10px] text-gray-400 mt-0.5">{tx.date}</p>
              </div>
              <div className="text-right shrink-0">
                <p className={`text-sm font-bold ${tx.type === 'earn' ? 'text-green-600' : 'text-red-500'}`}>
                  {tx.type === 'earn' ? '+' : ''}{tx.amount.toLocaleString()}P
                </p>
                <p className="text-[10px] text-gray-400">잔액 {tx.balance.toLocaleString()}P</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

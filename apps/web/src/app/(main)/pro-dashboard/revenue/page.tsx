'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';

/* ─── Icons ─── */

const BackIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <path d="M15 19L8 12L15 5" stroke="#1F2937" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const WalletIcon = () => (
  <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
    <rect x="2" y="6" width="24" height="18" rx="4" fill="#22C55E" />
    <rect x="2" y="6" width="24" height="6" rx="4" fill="#16A34A" />
    <rect x="18" y="14" width="6" height="5" rx="2" fill="#15803D" />
    <circle cx="21" cy="16.5" r="1" fill="#22C55E" />
    <rect x="5" y="9" width="8" height="1.5" rx="0.75" fill="#86EFAC" opacity="0.5" />
  </svg>
);

const CheckCircleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
    <circle cx="10" cy="10" r="8" fill="#22C55E" />
    <circle cx="10" cy="10" r="6" fill="#16A34A" />
    <path d="M7 10L9.5 12.5L13.5 7.5" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const ClockIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
    <circle cx="10" cy="10" r="8" fill="#F59E0B" />
    <circle cx="10" cy="10" r="6" fill="#D97706" />
    <rect x="9.25" y="6" width="1.5" height="4.5" rx="0.75" fill="#fff" />
    <rect x="9.25" y="9.5" width="3.5" height="1.5" rx="0.75" fill="#fff" />
  </svg>
);

const MoneyBagIcon = () => (
  <img src="/images/이번달 매출.svg" alt="" width={20} height={20} className="shrink-0" />
);

/* ─── Data ─── */

const MONTHLY_DATA = [
  { month: '11월', amount: 1200000 },
  { month: '12월', amount: 1500000 },
  { month: '1월', amount: 1800000 },
  { month: '2월', amount: 2100000 },
  { month: '3월', amount: 1800000 },
  { month: '4월', amount: 2400000 },
];

const TRANSACTIONS = [
  { id: 't1', client: '최**', event: '웨딩 MC', date: '2026-04-05', amount: 1800000, status: 'settled' as const },
  { id: 't2', client: '장**', event: '돌잔치 MC', date: '2026-03-22', amount: 1200000, status: 'settled' as const },
  { id: 't3', client: '서**', event: '기업행사', date: '2026-03-15', amount: 3500000, status: 'pending' as const },
  { id: 't4', client: '김**', event: '웨딩 MC', date: '2026-03-08', amount: 2000000, status: 'settled' as const },
  { id: 't5', client: '박**', event: '돌잔치 MC', date: '2026-02-28', amount: 900000, status: 'settled' as const },
];

const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
const fadeUp = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.35 } } };

function formatCurrency(n: number) {
  return '₩' + n.toLocaleString();
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export default function RevenuePage() {
  const maxAmount = Math.max(...MONTHLY_DATA.map((d) => d.amount));
  const totalRevenue = TRANSACTIONS.reduce((s, t) => s + t.amount, 0);
  const settledAmount = TRANSACTIONS.filter((t) => t.status === 'settled').reduce((s, t) => s + t.amount, 0);
  const pendingAmount = TRANSACTIONS.filter((t) => t.status === 'pending').reduce((s, t) => s + t.amount, 0);

  return (
    <div className="bg-gray-50 min-h-screen pb-28">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-gray-100">
        <div className="px-4 pt-12 pb-3 flex items-center gap-3">
          <Link href="/pro-dashboard">
            <motion.div whileTap={{ scale: 0.9 }}><BackIcon /></motion.div>
          </Link>
          <h1 className="text-lg font-bold text-gray-900">매출 현황</h1>
        </div>
      </div>

      {/* Summary Cards */}
      <motion.div variants={stagger} initial="hidden" animate="show" className="px-4 mt-5 grid grid-cols-3 gap-2">
        {[
          { icon: <MoneyBagIcon />, label: '총 매출', value: formatCurrency(totalRevenue), color: 'text-gray-900' },
          { icon: <CheckCircleIcon />, label: '정산 완료', value: formatCurrency(settledAmount), color: 'text-green-600' },
          { icon: <ClockIcon />, label: '정산 예정', value: formatCurrency(pendingAmount), color: 'text-amber-600' },
        ].map((item, i) => (
          <motion.div key={i} variants={fadeUp} className="bg-white rounded-xl p-3 shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
            <div className="mb-2">{item.icon}</div>
            <p className="text-[10px] text-gray-400 font-medium">{item.label}</p>
            <p className={`text-sm font-bold mt-0.5 ${item.color}`}>{item.value}</p>
          </motion.div>
        ))}
      </motion.div>

      {/* Bar Chart */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="px-4 mt-8"
      >
        <h2 className="text-base font-bold text-gray-900 mb-4">월별 매출 추이</h2>
        <div className="bg-white rounded-2xl p-5 shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
          <div className="flex items-end gap-3 h-40">
            {MONTHLY_DATA.map((d, i) => {
              const isCurrentMonth = i === MONTHLY_DATA.length - 1;
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[10px] font-bold text-gray-500">{formatCurrency(d.amount).replace('₩', '')}</span>
                  <div className="w-full flex items-end" style={{ height: '100px' }}>
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: `${(d.amount / maxAmount) * 100}%` }}
                      transition={{ delay: 0.5 + i * 0.1, duration: 0.6, ease: 'easeOut' }}
                      className={`w-full rounded-t-lg ${isCurrentMonth ? 'bg-[#3180F7]' : 'bg-blue-100'}`}
                    />
                  </div>
                  <span className={`text-[11px] font-medium ${isCurrentMonth ? 'text-[#3180F7] font-bold' : 'text-gray-400'}`}>
                    {d.month}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </motion.div>

      {/* Transaction List */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="px-4 mt-8"
      >
        <h2 className="text-base font-bold text-gray-900 mb-4">최근 거래 내역</h2>
        <motion.div variants={stagger} initial="hidden" animate="show">
          {TRANSACTIONS.map((tx, idx) => (
            <motion.div
              key={tx.id}
              variants={fadeUp}
              className={`py-4 flex items-center justify-between ${idx < TRANSACTIONS.length - 1 ? 'border-b border-gray-100' : ''}`}
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center">
                  <WalletIcon />
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-900">{tx.client} · {tx.event}</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">{formatDate(tx.date)}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-gray-900">{formatCurrency(tx.amount)}</p>
                <p className={`text-[10px] font-bold mt-0.5 ${tx.status === 'settled' ? 'text-green-500' : 'text-amber-500'}`}>
                  {tx.status === 'settled' ? '정산 완료' : '정산 예정'}
                </p>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </motion.div>
    </div>
  );
}

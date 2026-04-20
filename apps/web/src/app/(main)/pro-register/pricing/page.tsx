'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Check, Plus, X, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';

const PLANS = [
  { id: 'premium', label: 'Premium', defaultPrice: 450000, desc: '행사 1시간 진행' },
  { id: 'superior', label: 'Superior', defaultPrice: 800000, desc: '행사 2시간 진행' },
  { id: 'enterprise', label: 'Enterprise', defaultPrice: 1700000, desc: '6시간 풀타임' },
  { id: 'test', label: 'Test', defaultPrice: 100, desc: '테스트용 (결제 플로우 확인)' },
];

const COMMON_OPTIONS: Record<string, string[]> = {
  premium: ['사회 진행', '사전 미팅'],
  superior: ['사회 진행', '사전 미팅', '대본 작성', '리허설 참석', '포토타임 진행', '영상 큐시트 관리'],
  enterprise: ['사회 진행', '사전 미팅', '대본 작성', '리허설 참석', '축사/건배사 코디', '포토타임 진행', '하객 응대 안내', '2차 진행', '영상 큐시트 관리', '전담 코디네이터'],
  test: ['테스트 서비스'],
};

const TOTAL_STEPS = 7;
const CURRENT_STEP = 6;

export default function PricingPage() {
  const router = useRouter();
  const [enabledPlans, setEnabledPlans] = useState<Set<string>>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('proRegister_enabledPlans');
      return saved ? new Set(JSON.parse(saved)) : new Set(['premium']);
    }
    return new Set(['premium']);
  });
  const [prices, setPrices] = useState<Record<string, string>>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('proRegister_prices');
      return saved ? JSON.parse(saved) : {};
    }
    return {};
  });
  const [customOptions, setCustomOptions] = useState<Record<string, {name: string, price: number}[]>>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('proRegister_customOptions');
      if (saved) {
        const parsed = JSON.parse(saved);
        // Migration: convert old string[] format to {name, price}[] format
        const migrated: Record<string, {name: string, price: number}[]> = {};
        for (const key of Object.keys(parsed)) {
          if (Array.isArray(parsed[key])) {
            migrated[key] = parsed[key].map((item: string | {name: string, price: number}) =>
              typeof item === 'string' ? { name: item, price: 0 } : item
            );
          } else {
            migrated[key] = [];
          }
        }
        return migrated;
      }
      return { premium: [], superior: [], enterprise: [] };
    }
    return { premium: [], superior: [], enterprise: [] };
  });
  const [activeTab, setActiveTab] = useState('premium');
  const [newOption, setNewOption] = useState('');
  const [newOptionPrice, setNewOptionPrice] = useState('');

  useEffect(() => { localStorage.setItem('proRegister_enabledPlans', JSON.stringify([...enabledPlans])); }, [enabledPlans]);
  useEffect(() => { localStorage.setItem('proRegister_prices', JSON.stringify(prices)); }, [prices]);
  useEffect(() => { localStorage.setItem('proRegister_customOptions', JSON.stringify(customOptions)); }, [customOptions]);

  const togglePlan = (id: string) => {
    setEnabledPlans(prev => {
      const next = new Set(prev);
      if (next.has(id)) { if (next.size > 1) next.delete(id); }
      else next.add(id);
      return next;
    });
  };

  const addCustomOption = () => {
    if (!newOption.trim()) return;
    const price = parseInt(newOptionPrice) || 0;
    setCustomOptions(prev => ({
      ...prev,
      [activeTab]: [...(prev[activeTab] || []), { name: newOption.trim(), price }],
    }));
    setNewOption('');
    setNewOptionPrice('');
  };

  const removeCustomOption = (planId: string, index: number) => {
    setCustomOptions(prev => ({
      ...prev,
      [planId]: prev[planId].filter((_, i) => i !== index),
    }));
  };

  const isValid = enabledPlans.size > 0;

  return (
    <div className="fixed inset-0 bg-white flex flex-col" style={{ height: '100dvh' }}>
      {/* Header */}
      <div className="shrink-0 px-4 pt-4 pb-3">
        <motion.button onClick={() => router.back()} className="mb-3" whileTap={{ scale: 0.9 }}>
          <ChevronLeft size={24} className="text-gray-900" />
        </motion.button>
        {/* Progress bar */}
        <div className="relative h-[3px] bg-gray-100 rounded-full overflow-hidden mb-2">
          <motion.div
            className="absolute left-0 top-0 h-full bg-[#3180F7] rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${(CURRENT_STEP / TOTAL_STEPS) * 100}%` }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          />
        </div>
        <div className="flex items-center justify-between">
          <motion.h1
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-2xl font-bold text-gray-900"
          >
            상품고지
          </motion.h1>
          <span className="text-[11px] text-gray-400">{CURRENT_STEP}/{TOTAL_STEPS}</span>
        </div>
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="text-sm text-gray-400 mt-1"
        >
          제공할 플랜과 가격을 설정해주세요
        </motion.p>
      </div>

      {/* Content — scrollable */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {/* Plan toggles */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="mb-6">
          <p className="text-[13px] font-bold text-gray-900 mb-3">제공 플랜 선택</p>
          <div className="space-y-2">
            {PLANS.map((plan) => {
              const enabled = enabledPlans.has(plan.id);
              return (
                <motion.button
                  key={plan.id}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => togglePlan(plan.id)}
                  className={`w-full flex items-center justify-between p-4 rounded-2xl border-2 transition-all ${
                    enabled ? 'border-[#3180F7] bg-blue-50/30' : 'border-gray-100'
                  }`}
                >
                  <div className="text-left">
                    <p className={`text-[16px] font-bold ${enabled ? 'text-gray-900' : 'text-gray-400'}`}>{plan.label}</p>
                    <p className={`text-[13px] ${enabled ? 'text-gray-500' : 'text-gray-300'}`}>{plan.desc}</p>
                  </div>
                  <motion.div
                    animate={{ backgroundColor: enabled ? '#3180F7' : '#E5E7EB' }}
                    transition={{ duration: 0.2 }}
                    className="w-6 h-6 rounded-full flex items-center justify-center"
                  >
                    <AnimatePresence>
                      {enabled && (
                        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} transition={{ type: 'spring', stiffness: 400, damping: 15 }}>
                          <Check size={14} className="text-white stroke-[3]" />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                </motion.button>
              );
            })}
          </div>
        </motion.div>

        {/* Plan detail tabs */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <p className="text-[13px] font-bold text-gray-900 mb-3">플랜별 상세 설정</p>
          <LayoutGroup id="pricing-tabs">
            <div className="flex gap-2 mb-4 overflow-x-auto scrollbar-hide">
              {PLANS.filter(p => enabledPlans.has(p.id)).map((plan) => {
                const active = activeTab === plan.id;
                return (
                  <button
                    key={plan.id}
                    onClick={() => setActiveTab(plan.id)}
                    className={`relative isolate px-4 py-2 text-[14px] font-semibold rounded-full shrink-0 ${active ? 'text-white' : 'text-gray-500 border border-gray-200'}`}
                  >
                    {active && (
                      <motion.span
                        layoutId="pricing-tab-bg"
                        className="absolute inset-0 bg-[#3180F7] rounded-full"
                        style={{ zIndex: -1 }}
                        transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                      />
                    )}
                    <span className="relative">{plan.label}</span>
                  </button>
                );
              })}
            </div>
          </LayoutGroup>

          {enabledPlans.has(activeTab) && (
            <AnimatePresence mode="popLayout">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                {/* Price — fixed */}
                <div className="mb-5">
                  <label className="text-[12px] font-bold text-gray-400 uppercase tracking-wider mb-2 block">가격</label>
                  <div className="h-12 bg-gray-50 border border-gray-100 rounded-xl px-4 flex items-center justify-between">
                    <span className="text-[18px] font-bold text-gray-900">
                      {(PLANS.find(p => p.id === activeTab)?.defaultPrice ?? 0).toLocaleString()}원
                    </span>
                    <span className="text-[12px] text-gray-400">고정 가격</span>
                  </div>
                </div>

                {/* Common options (read-only) */}
                <div className="mb-5">
                  <label className="text-[12px] font-bold text-gray-400 uppercase tracking-wider mb-2 block">공통 옵션 (기본 포함)</label>
                  <div className="space-y-1.5">
                    {(COMMON_OPTIONS[activeTab] || []).map((opt, i) => (
                      <motion.div
                        key={opt}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.03 }}
                        className="flex items-center gap-2.5 py-2"
                      >
                        <div className="w-5 h-5 rounded-full bg-[#3180F7]/10 flex items-center justify-center">
                          <Check size={11} className="text-[#3180F7] stroke-[3]" />
                        </div>
                        <span className="text-[14px] text-gray-700">{opt}</span>
                      </motion.div>
                    ))}
                  </div>
                </div>

                {/* Custom options (editable) */}
                <div>
                  <label className="text-[12px] font-bold text-gray-400 uppercase tracking-wider mb-2 block">개인 옵션 (추가)</label>
                  {(customOptions[activeTab] || []).length > 0 && (
                    <div className="space-y-1.5 mb-3">
                      {(customOptions[activeTab] || []).map((opt, i) => (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          className="flex items-center gap-2.5 py-2"
                        >
                          <div className="w-5 h-5 rounded-full bg-amber-100 flex items-center justify-center">
                            <span className="text-[10px] text-amber-600 font-bold">+</span>
                          </div>
                          <span className="text-[14px] text-gray-700 flex-1">{opt.name}</span>
                          {opt.price > 0 && (
                            <span className="text-[13px] font-semibold text-gray-500">{opt.price.toLocaleString()}원</span>
                          )}
                          <motion.button whileTap={{ scale: 0.85 }} onClick={() => removeCustomOption(activeTab, i)}>
                            <X size={14} className="text-gray-300" />
                          </motion.button>
                        </motion.div>
                      ))}
                    </div>
                  )}
                  <div className="space-y-2">
                    <div className="space-y-2">
                      <input
                        type="text"
                        value={newOption}
                        onChange={(e) => setNewOption(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && addCustomOption()}
                        placeholder="옵션명을 입력하세요"
                        className="w-full h-11 bg-gray-50 border border-gray-200 rounded-xl px-4 text-[16px] text-gray-900 outline-none placeholder:text-gray-400 focus:border-[#3180F7] transition-colors"
                      />
                      <input
                        type="number"
                        value={newOptionPrice}
                        onChange={(e) => setNewOptionPrice(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && addCustomOption()}
                        placeholder="가격 (원)"
                        className="w-full h-11 bg-gray-50 border border-gray-200 rounded-xl px-4 text-[16px] text-gray-900 outline-none placeholder:text-gray-400 focus:border-[#3180F7] transition-colors"
                      />
                    </div>
                    <motion.button
                      whileTap={{ scale: 0.9 }}
                      onClick={addCustomOption}
                      animate={{
                        backgroundColor: newOption.trim() ? '#3180F7' : '#E5E7EB',
                        color: newOption.trim() ? '#FFFFFF' : '#9CA3AF',
                      }}
                      transition={{ duration: 0.2 }}
                      className="w-full h-11 rounded-xl text-[14px] font-bold"
                    >
                      추가
                    </motion.button>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
          )}
        </motion.div>
      </div>

      {/* Next Button */}
      <div className="shrink-0 p-4 pb-8 bg-white">
        <motion.button
          onClick={() => router.push('/pro-register/profile')}
          disabled={!isValid}
          whileTap={{ scale: 0.96 }}
          animate={{
            backgroundColor: isValid ? '#3180F7' : '#F3F4F6',
            color: isValid ? '#FFFFFF' : '#9CA3AF',
          }}
          transition={{ duration: 0.25 }}
          className="w-full py-4 rounded-2xl font-bold text-base"
        >
          다음
        </motion.button>
      </div>
    </div>
  );
}

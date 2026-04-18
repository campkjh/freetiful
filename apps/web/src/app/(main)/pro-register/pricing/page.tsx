'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Check, Plus, X, ChevronDown } from 'lucide-react';
const PLANS = [
  { id: 'premium', label: 'Premium', defaultPrice: 450000, desc: '행사 1시간 진행' },
  { id: 'superior', label: 'Superior', defaultPrice: 800000, desc: '행사 2시간 진행' },
  { id: 'enterprise', label: 'Enterprise', defaultPrice: 1700000, desc: '6시간 풀타임' },
];

const COMMON_OPTIONS: Record<string, string[]> = {
  premium: ['사회 진행', '사전 미팅'],
  superior: ['사회 진행', '사전 미팅', '대본 작성', '리허설 참석', '포토타임 진행', '영상 큐시트 관리'],
  enterprise: ['사회 진행', '사전 미팅', '대본 작성', '리허설 참석', '축사/건배사 코디', '포토타임 진행', '하객 응대 안내', '2차 진행', '영상 큐시트 관리', '전담 코디네이터'],
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
        <button onClick={() => router.back()} className="mb-3">
          <ChevronLeft size={24} className="text-gray-900" />
        </button>
        {/* Progress bar */}
        <div className="relative h-[3px] bg-gray-100 rounded-full overflow-hidden mb-2">
          <div
            className="absolute left-0 top-0 h-full bg-[#3180F7] rounded-full"
          />
        </div>
        <div className="flex items-center justify-between">
          <h1
            className="text-2xl font-bold text-gray-900"
          >
            상품고지
          </h1>
          <span className="text-[11px] text-gray-400">{CURRENT_STEP}/{TOTAL_STEPS}</span>
        </div>
        <p
          className="text-sm text-gray-400 mt-1"
        >
          제공할 플랜과 가격을 설정해주세요
        </p>
      </div>

      {/* Content — scrollable */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {/* Plan toggles */}
        <div className="mb-6">
          <p className="text-[13px] font-bold text-gray-900 mb-3">제공 플랜 선택</p>
          <div className="space-y-2">
            {PLANS.map((plan) => {
              const enabled = enabledPlans.has(plan.id);
              return (
                <button
                  key={plan.id}
                  onClick={() => togglePlan(plan.id)}
                  className={`w-full flex items-center justify-between p-4 rounded-2xl border-2 transition-all ${
                    enabled ? 'border-[#3180F7] bg-blue-50/30' : 'border-gray-100'
                  }`}
                >
                  <div className="text-left">
                    <p className={`text-[16px] font-bold ${enabled ? 'text-gray-900' : 'text-gray-400'}`}>{plan.label}</p>
                    <p className={`text-[13px] ${enabled ? 'text-gray-500' : 'text-gray-300'}`}>{plan.desc}</p>
                  </div>
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center"
                  >
                    <>
                      {enabled && (
                        <div>
                          <Check size={14} className="text-white stroke-[3]" />
                        </div>
                      )}
                    </>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Plan detail tabs */}
        <div>
          <p className="text-[13px] font-bold text-gray-900 mb-3">플랜별 상세 설정</p>
          <>
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
                      <span
                        className="absolute inset-0 bg-[#3180F7] rounded-full"
                        style={{ zIndex: -1 }}
                      />
                    )}
                    <span className="relative">{plan.label}</span>
                  </button>
                );
              })}
            </div>
          </>

          {enabledPlans.has(activeTab) && (
            <>
              <div
                key={activeTab}
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
                      <div
                        key={opt}
                        className="flex items-center gap-2.5 py-2"
                      >
                        <div className="w-5 h-5 rounded-full bg-[#3180F7]/10 flex items-center justify-center">
                          <Check size={11} className="text-[#3180F7] stroke-[3]" />
                        </div>
                        <span className="text-[14px] text-gray-700">{opt}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Custom options (editable) */}
                <div>
                  <label className="text-[12px] font-bold text-gray-400 uppercase tracking-wider mb-2 block">개인 옵션 (추가)</label>
                  {(customOptions[activeTab] || []).length > 0 && (
                    <div className="space-y-1.5 mb-3">
                      {(customOptions[activeTab] || []).map((opt, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-2.5 py-2"
                        >
                          <div className="w-5 h-5 rounded-full bg-amber-100 flex items-center justify-center">
                            <span className="text-[10px] text-amber-600 font-bold">+</span>
                          </div>
                          <span className="text-[14px] text-gray-700 flex-1">{opt.name}</span>
                          {opt.price > 0 && (
                            <span className="text-[13px] font-semibold text-gray-500">{opt.price.toLocaleString()}원</span>
                          )}
                          <button onClick={() => removeCustomOption(activeTab, i)}>
                            <X size={14} className="text-gray-300" />
                          </button>
                        </div>
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
                    <button
                      onClick={addCustomOption}
                      className="w-full h-11 rounded-xl text-[14px] font-bold"
                    >
                      추가
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Next Button */}
      <div className="shrink-0 p-4 pb-8 bg-white">
        <button
          onClick={() => router.push('/pro-register/profile')}
          disabled={!isValid}
          className="w-full py-4 rounded-2xl font-bold text-base"
        >
          다음
        </button>
      </div>
    </div>
  );
}

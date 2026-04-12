'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Check, Building2 } from 'lucide-react';

interface BankInfo {
  bankName: string;
  accountNumber: string;
  holderName: string;
}

const BANKS = ['국민은행', '신한은행', '우리은행', '하나은행', 'NH농협', 'IBK기업', 'SC제일', '카카오뱅크', '토스뱅크', '케이뱅크', '대구은행', '부산은행', '경남은행', '광주은행', '전북은행', '제주은행'];

export default function BankPage() {
  const router = useRouter();
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [holderName, setHolderName] = useState('');
  const [saved, setSaved] = useState(false);
  const [toast, setToast] = useState('');
  const [showBankList, setShowBankList] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
    // Load from localStorage
    try {
      const stored = JSON.parse(localStorage.getItem('proRegister_bank') || '{}');
      if (stored.bankName) setBankName(stored.bankName);
      if (stored.accountNumber) setAccountNumber(stored.accountNumber);
      if (stored.holderName) setHolderName(stored.holderName);
      if (stored.bankName) setSaved(true);
    } catch {}
  }, []);

  const handleSave = () => {
    if (!bankName || !accountNumber || !holderName) {
      setToast('모든 항목을 입력해주세요');
      setTimeout(() => setToast(''), 2500);
      return;
    }
    const bankInfo: BankInfo = { bankName, accountNumber, holderName };
    localStorage.setItem('proRegister_bank', JSON.stringify(bankInfo));
    setSaved(true);
    setToast('저장되었습니다');
    setTimeout(() => setToast(''), 2500);
  };

  const isValid = bankName && accountNumber && holderName;

  return (
    <div className="bg-white min-h-screen" style={{ letterSpacing: '-0.02em' }}>
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white">
        <div className="flex items-center h-[52px] px-4">
          <button onClick={() => router.back()} className="p-1 -ml-1 active:scale-90 transition-transform">
            <ChevronLeft size={24} className="text-gray-900" />
          </button>
          <h1 className="text-[18px] font-bold text-gray-900 ml-1">계좌 관리</h1>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed top-[70px] left-1/2 -translate-x-1/2 bg-gray-900 text-white px-6 py-3 rounded-full shadow-lg z-50">
          <p className="text-[14px] font-bold flex items-center gap-2">
            <Check size={16} className="text-green-400" /> {toast}
          </p>
        </div>
      )}

      {/* Saved Info Display */}
      {saved && (
        <div className="px-4 pt-4 pb-2">
          <div className="rounded-xl bg-green-50 border border-green-100 px-4 py-4">
            <div className="flex items-center gap-2 mb-2">
              <Building2 size={18} className="text-green-600" />
              <p className="text-[14px] font-bold text-green-700">등록된 계좌</p>
            </div>
            <p className="text-[15px] text-gray-900 ml-[26px]">{bankName} {accountNumber}</p>
            <p className="text-[13px] text-gray-500 ml-[26px] mt-0.5">예금주: {holderName}</p>
          </div>
        </div>
      )}

      {/* Form */}
      <div className="px-4 pt-5 pb-10">
        <p className="text-[16px] font-bold text-gray-900 mb-5">{saved ? '계좌 정보 수정' : '계좌 등록'}</p>

        {/* Bank Name */}
        <div className="mb-4">
          <label className="block text-[12px] font-bold text-gray-400 mb-1.5">은행</label>
          <button
            onClick={() => setShowBankList(!showBankList)}
            className="w-full h-11 border border-gray-200 rounded-xl px-4 flex items-center justify-between text-[15px] active:bg-gray-50 transition-colors"
          >
            <span className={bankName ? 'text-gray-900' : 'text-gray-400'}>{bankName || '은행을 선택하세요'}</span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M6 9l6 6 6-6" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
          {showBankList && (
            <div className="mt-1 border border-gray-200 rounded-xl bg-white shadow-lg max-h-48 overflow-y-auto">
              {BANKS.map(bank => (
                <button
                  key={bank}
                  onClick={() => { setBankName(bank); setShowBankList(false); }}
                  className={`w-full px-4 py-2.5 text-left text-[14px] active:bg-gray-50 transition-colors ${
                    bankName === bank ? 'text-blue-600 font-bold bg-blue-50' : 'text-gray-700'
                  }`}
                >
                  {bank}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Account Number */}
        <div className="mb-4">
          <label className="block text-[12px] font-bold text-gray-400 mb-1.5">계좌번호</label>
          <input
            type="text"
            value={accountNumber}
            onChange={(e) => setAccountNumber(e.target.value.replace(/[^0-9-]/g, ''))}
            placeholder="계좌번호를 입력하세요"
            className="w-full h-11 border border-gray-200 rounded-xl px-4 text-[16px] text-gray-900 outline-none focus:border-[#3180F7] focus:ring-1 focus:ring-[#3180F7]/20 transition-all"
          />
        </div>

        {/* Holder Name */}
        <div className="mb-6">
          <label className="block text-[12px] font-bold text-gray-400 mb-1.5">예금주</label>
          <input
            type="text"
            value={holderName}
            onChange={(e) => setHolderName(e.target.value)}
            placeholder="예금주명을 입력하세요"
            className="w-full h-11 border border-gray-200 rounded-xl px-4 text-[16px] text-gray-900 outline-none focus:border-[#3180F7] focus:ring-1 focus:ring-[#3180F7]/20 transition-all"
          />
        </div>

        {/* Save Button */}
        <button
          onClick={handleSave}
          disabled={!isValid}
          className={`w-full h-[52px] rounded-2xl text-[15px] font-bold transition-colors ${
            isValid
              ? 'bg-[#3180F7] hover:bg-[#2668d8] text-white active:scale-[0.98]'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
          }`}
        >
          {saved ? '수정하기' : '등록하기'}
        </button>
      </div>
    </div>
  );
}

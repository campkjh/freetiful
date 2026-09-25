'use client';

import { useState, useEffect } from 'react';
import { Check, Building2 } from 'lucide-react';
import { MyDetailHeader } from '../_components/detail-ui';
import { popItemDelay } from '@/lib/pop-menu';

interface BankInfo {
  bankName: string;
  accountNumber: string;
  holderName: string;
}

const BANKS = ['국민은행', '신한은행', '우리은행', '하나은행', 'NH농협', 'IBK기업', 'SC제일', '카카오뱅크', '토스뱅크', '케이뱅크', '대구은행', '부산은행', '경남은행', '광주은행', '전북은행', '제주은행'];

export default function BankPage() {
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
      <MyDetailHeader title="계좌 관리" sub="정산받을 계좌를 등록해 주세요" />

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
        <div className="px-6 pb-2">
          <div className="rounded-[16px] border-[1.5px] border-[#C6EFD6] bg-[#EDFBF3] px-[18px] py-4">
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
      <div className="qd-body px-6 pb-10 pt-3">
        <p className="mb-4 text-[17px] font-semibold text-[#333D4B]">{saved ? '계좌 정보 수정' : '계좌 등록'}</p>

        {/* Bank Name */}
        <div className="mb-4">
          <label className="mb-2 block text-[13px] font-semibold text-[#8B95A1]">은행</label>
          <button
            onClick={() => setShowBankList(!showBankList)}
            className="qd-input flex items-center justify-between text-left active:bg-[#F8F9FA]"
          >
            <span className={bankName ? 'text-gray-900' : 'text-gray-400'}>{bankName || '은행을 선택하세요'}</span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M6 9l6 6 6-6" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
          {showBankList && (
            <div className="pop-menu mt-2 max-h-56 overflow-y-auto py-1.5">
              {BANKS.map((bank, i) => (
                <button
                  key={bank}
                  style={popItemDelay(i)}
                  onClick={() => { setBankName(bank); setShowBankList(false); }}
                  className={`pop-menu-item w-full px-4 py-2.5 text-left text-[15px] active:bg-[#F2F4F6] transition-colors ${
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
          <label className="mb-2 block text-[13px] font-semibold text-[#8B95A1]">계좌번호</label>
          <input
            type="text"
            value={accountNumber}
            onChange={(e) => setAccountNumber(e.target.value.replace(/[^0-9-]/g, ''))}
            placeholder="계좌번호를 입력하세요"
            className="qd-input"
          />
        </div>

        {/* Holder Name */}
        <div className="mb-6">
          <label className="mb-2 block text-[13px] font-semibold text-[#8B95A1]">예금주</label>
          <input
            type="text"
            value={holderName}
            onChange={(e) => setHolderName(e.target.value)}
            placeholder="예금주명을 입력하세요"
            className="qd-input"
          />
        </div>

        {/* Save Button */}
        <button
          onClick={handleSave}
          disabled={!isValid}
          className="qd-cta"
        >
          {saved ? '수정하기' : '등록하기'}
        </button>
      </div>
    </div>
  );
}

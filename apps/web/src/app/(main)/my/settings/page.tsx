'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Lock, Link2, Wallet } from 'lucide-react';
import ImageUploader from '@/components/ui/ImageUploader';

const MOCK_IMAGES = [
  { id: 'img-1', imageUrl: '/images/mc-characters.png', displayOrder: 0, hasFace: true, isPrimary: true },
  { id: 'img-2', imageUrl: '/images/박인애/IMG_7549.avif', displayOrder: 1, hasFace: true, isPrimary: false },
  { id: 'img-3', imageUrl: '/images/이승진/IMG_75131771924219656.avif', displayOrder: 2, hasFace: true, isPrimary: false },
  { id: 'img-4', imageUrl: '/images/전해별/IMG_92281772850158117.avif', displayOrder: 3, hasFace: false, isPrimary: false },
];

// 소셜 로그인 아이콘
const KakaoIcon = () => (
  <svg width={18} height={18} viewBox="0 0 24 24" fill="none">
    <path d="M12 3C6.48 3 2 6.58 2 10.9c0 2.8 1.86 5.25 4.66 6.62l-1.2 4.38c-.1.37.32.66.64.45l5.1-3.39c.26.02.52.04.8.04 5.52 0 10-3.58 10-7.9C22 6.58 17.52 3 12 3z" fill="#191919"/>
  </svg>
);
const GoogleIcon = () => (
  <svg width={18} height={18} viewBox="0 0 24 24">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09A6.01 6.01 0 015.52 12c0-.72.12-1.42.32-2.09V7.07H2.18A10 10 0 001 12c0 1.61.39 3.14 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);
const AppleIcon = () => (
  <svg width={18} height={18} viewBox="0 0 24 24" fill="white">
    <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C3.79 16.16 4.36 9.53 8.74 9.29c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.22 4.1zM12.03 9.25C11.88 7.02 13.69 5.18 15.8 5c.32 2.44-2.19 4.52-3.77 4.25z"/>
  </svg>
);
const NaverIcon = () => (
  <svg width={18} height={18} viewBox="0 0 24 24" fill="white">
    <path d="M16.27 12.99L7.44 1H1v22h6.73V12.01L16.56 23H23V1h-6.73v11.99z"/>
  </svg>
);

const SOCIAL_ACCOUNTS = [
  { name: '카카오', connected: true, bg: 'bg-[#FEE500]', icon: <KakaoIcon /> },
  { name: 'Google', connected: true, bg: 'bg-white border border-gray-200', icon: <GoogleIcon /> },
  { name: 'Apple', connected: false, bg: 'bg-gray-900', icon: <AppleIcon /> },
  { name: '네이버', connected: false, bg: 'bg-[#03C75A]', icon: <NaverIcon /> },
];

export default function SettingsPage() {
  const router = useRouter();
  useEffect(() => { window.scrollTo(0, 0); }, []);
  const [name, setName] = useState('김정훈');
  const [phone, setPhone] = useState('010-9433-5674');
  const [images, setImages] = useState(MOCK_IMAGES);
  const [showBankForm, setShowBankForm] = useState(false);
  const [bank, setBank] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountHolder, setAccountHolder] = useState('');
  const [savedAccount, setSavedAccount] = useState<{ bank: string; number: string; holder: string } | null>(null);

  return (
    <div className="bg-white min-h-screen max-w-lg mx-auto lg:max-w-2xl" style={{ letterSpacing: '-0.02em' }}>
      {/* ─── Header ─────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-10 bg-white/90 backdrop-blur-xl border-b border-gray-100/60">
        <div className="flex items-center gap-3 px-4 h-[52px]">
          <button onClick={() => router.back()} className="p-1 active:scale-90 transition-transform"><ChevronLeft size={24} className="text-gray-700" /></button>
          <h1 className="text-[17px] font-bold text-gray-900">프로필 설정</h1>
        </div>
      </div>

      {/* ─── Profile Images ──────────────────────────────────────────── */}
      <div className="px-4 py-6">
        <ImageUploader
          images={images}
          onChange={setImages}
          maxImages={10}
          minImages={4}
          requireFace
        />
      </div>

      <div className="h-1.5 bg-gray-50" />

      {/* ─── Basic Info ──────────────────────────────────────────────── */}
      <div className="px-4 py-5 space-y-4">
        <p className="text-[13px] font-bold text-gray-500">기본 정보</p>
        <div>
          <label className="block text-[13px] font-bold text-gray-700 mb-1.5">이름</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="input text-[16px]" />
        </div>
        <div>
          <label className="block text-[13px] font-bold text-gray-700 mb-1.5">이메일</label>
          <input type="email" value="campkjh@gmail.com" disabled className="input text-[16px] bg-gray-50 text-gray-400 cursor-not-allowed" />
          <p className="text-[11px] text-gray-400 mt-1.5 flex items-center gap-1"><Lock size={10} /> 이메일은 변경할 수 없습니다</p>
        </div>
        <div>
          <label className="block text-[13px] font-bold text-gray-700 mb-1.5">전화번호</label>
          <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="input text-[16px]" />
        </div>
      </div>

      <div className="h-1.5 bg-gray-50" />

      {/* ─── Linked Accounts ─────────────────────────────────────────── */}
      <div className="px-4 py-5 space-y-3">
        <p className="text-[13px] font-bold text-gray-500 flex items-center gap-1"><Link2 size={12} /> 연결된 계정</p>
        {SOCIAL_ACCOUNTS.map((acc) => (
          <div key={acc.name} className="flex items-center justify-between py-2.5">
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-full ${acc.bg} flex items-center justify-center`}>
                {acc.icon}
              </div>
              <div>
                <p className="text-[14px] font-semibold text-gray-900">{acc.name}</p>
                <p className="text-[11px] text-gray-400">{acc.connected ? '연결됨' : '미연결'}</p>
              </div>
            </div>
            <button
              className={`text-[12px] font-bold px-4 py-2 rounded-full transition-colors active:scale-95 ${
                acc.connected ? 'bg-gray-100 text-gray-500 hover:bg-gray-200' : 'bg-gray-900 text-white hover:bg-gray-800'
              }`}
            >
              {acc.connected ? '연결 해제' : '연결하기'}
            </button>
          </div>
        ))}
      </div>

      <div className="h-1.5 bg-gray-50" />

      {/* ─── Refund Account ──────────────────────────────────────────── */}
      <div className="px-4 py-5 space-y-3">
        <p className="text-[13px] font-bold text-gray-500 flex items-center gap-1"><Wallet size={12} /> 환불 계좌</p>
        {savedAccount ? (
          <div className="border border-gray-100 rounded-2xl p-4 flex items-center justify-between">
            <div>
              <p className="text-[14px] font-semibold text-gray-900">{savedAccount.bank}</p>
              <p className="text-[13px] text-gray-500 mt-0.5">{savedAccount.number} · {savedAccount.holder}</p>
            </div>
            <button onClick={() => { setSavedAccount(null); setShowBankForm(false); }} className="text-[12px] text-red-500 font-bold">삭제</button>
          </div>
        ) : showBankForm ? (
          <div className="border border-gray-100 rounded-2xl p-4 space-y-3">
            <select value={bank} onChange={(e) => setBank(e.target.value)} className="input text-[16px]">
              <option value="">은행 선택</option>
              {['국민은행','신한은행','하나은행','우리은행','IBK기업','NH농협','카카오뱅크','토스뱅크','케이뱅크'].map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
            <input type="text" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} placeholder="계좌번호" className="input text-[16px]" />
            <input type="text" value={accountHolder} onChange={(e) => setAccountHolder(e.target.value)} placeholder="예금주명" className="input text-[16px]" />
            <div className="flex gap-2">
              <button onClick={() => setShowBankForm(false)} className="flex-1 h-11 bg-gray-100 text-gray-600 font-bold rounded-xl text-[14px] active:scale-[0.98]">취소</button>
              <button
                onClick={() => {
                  if (!bank || !accountNumber || !accountHolder) return;
                  setSavedAccount({ bank, number: accountNumber, holder: accountHolder });
                  setShowBankForm(false);
                }}
                className="flex-1 h-11 bg-gray-900 text-white font-bold rounded-xl text-[14px] active:scale-[0.98]"
              >
                등록
              </button>
            </div>
          </div>
        ) : (
          <div className="border border-gray-100 rounded-2xl p-4">
            <p className="text-[13px] text-gray-500">등록된 환불 계좌가 없습니다</p>
            <button onClick={() => setShowBankForm(true)} className="text-[13px] text-gray-900 font-bold mt-2">계좌 등록하기</button>
          </div>
        )}
      </div>

      {/* ─── Save ────────────────────────────────────────────────────── */}
      <div className="px-4 py-6">
        <button className="w-full h-[52px] bg-gray-900 hover:bg-gray-800 text-white font-bold rounded-2xl active:scale-[0.98] transition-all">
          저장하기
        </button>
      </div>

      <div className="px-4 pb-10 text-center">
        <button className="text-[12px] text-gray-400 underline">회원 탈퇴</button>
      </div>
    </div>
  );
}

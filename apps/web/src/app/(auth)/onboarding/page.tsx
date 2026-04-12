'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { initSignupBonus } from '@/lib/points';
import { useAuthStore } from '@/lib/store/auth.store';
import { usersApi } from '@/lib/api/users.api';

export default function OnboardingPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);

  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 11);
    if (digits.length <= 3) return digits;
    if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPhone(formatPhone(e.target.value));
  };

  const authUser = useAuthStore((s) => s.user);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || phone.replace(/\D/g, '').length < 10) return;
    setLoading(true);

    // Update profile via API if authenticated
    if (authUser) {
      try {
        const updated = await usersApi.updateProfile({ name: name.trim(), phone: phone.replace(/\D/g, '') });
        useAuthStore.getState().setUser({ ...authUser, name: updated.name, phone: updated.phone } as any);
        // Signup bonus is handled by initSignupBonus() below via localStorage
      } catch {}
    }

    // Also save to localStorage for backwards compat
    const existing = JSON.parse(localStorage.getItem('freetiful-user') || '{}');
    localStorage.setItem('freetiful-user', JSON.stringify({ ...existing, name: name.trim(), phone }));
    localStorage.setItem('freetiful-logged-in', 'true');
    setLoading(false);
    initSignupBonus();
    router.push('/main');
  };

  const isValid = name.trim().length >= 2 && phone.replace(/\D/g, '').length >= 10;

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <div className="flex-1 flex flex-col justify-center px-6 py-12 max-w-lg mx-auto w-full">
        {/* Logo */}
        <div className="mb-10 text-center">
          <h1 className="text-3xl font-black text-primary-500 tracking-tight">Freetiful</h1>
          <div className="mt-6">
            <div className="w-16 h-16 bg-primary-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">🎉</span>
            </div>
            <h2 className="text-2xl font-bold text-gray-900">마지막 단계예요!</h2>
            <p className="mt-2 text-gray-500 text-sm leading-relaxed">
              서비스 이용을 위해<br />기본 정보를 입력해주세요
            </p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              이름
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="홍길동"
              className="input"
              autoComplete="name"
              autoFocus
            />
            {name.length > 0 && name.trim().length < 2 && (
              <p className="text-red-500 text-xs mt-1">이름은 2자 이상 입력해주세요</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              휴대폰 번호
            </label>
            <input
              type="tel"
              value={phone}
              onChange={handlePhoneChange}
              placeholder="010-0000-0000"
              className="input"
              autoComplete="tel"
              inputMode="numeric"
            />
            {phone.length > 0 && phone.replace(/\D/g, '').length < 10 && (
              <p className="text-red-500 text-xs mt-1">올바른 전화번호를 입력해주세요</p>
            )}
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={!isValid || loading}
              className="btn-primary"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  처리 중...
                </span>
              ) : (
                '시작하기'
              )}
            </button>
          </div>
        </form>

        <p className="mt-6 text-center text-xs text-gray-400 leading-relaxed">
          가입함으로써{' '}
          <span className="text-primary-500 font-medium">이용약관</span>과{' '}
          <span className="text-primary-500 font-medium">개인정보처리방침</span>에<br />
          동의하는 것으로 간주됩니다
        </p>
      </div>
    </div>
  );
}

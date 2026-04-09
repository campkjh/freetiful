'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Eye, EyeOff, Check } from 'lucide-react';

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const passwordChecks = [
    { label: '8자 이상', pass: password.length >= 8 },
    { label: '영문 포함', pass: /[a-zA-Z]/.test(password) },
    { label: '숫자 포함', pass: /[0-9]/.test(password) },
    { label: '특수문자 포함', pass: /[!@#$%^&*]/.test(password) },
  ];

  const isPasswordValid = passwordChecks.every((c) => c.pass);
  const isPasswordMatch = password === confirmPassword && confirmPassword.length > 0;
  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const canSubmit = isEmailValid && isPasswordValid && isPasswordMatch;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    await new Promise((r) => setTimeout(r, 1000));
    setLoading(false);
    router.push('/onboarding');
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <div className="px-4 pt-12 pb-3">
        <button onClick={() => router.back()} className="p-1"><ArrowLeft size={22} /></button>
      </div>

      <div className="flex-1 px-6 py-4 max-w-md mx-auto w-full">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">회원가입</h1>
        <p className="text-sm text-gray-500 mb-8">Freetiful에 오신 것을 환영합니다</p>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Email */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">이메일</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="example@email.com"
              className="input"
              autoComplete="email"
              autoFocus
            />
            {email && !isEmailValid && (
              <p className="text-red-500 text-xs mt-1">올바른 이메일 형식을 입력해주세요</p>
            )}
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">비밀번호</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="비밀번호를 입력해주세요"
                className="input pr-10"
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {password && (
              <div className="flex flex-wrap gap-2 mt-2">
                {passwordChecks.map(({ label, pass }) => (
                  <span key={label} className={`flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full ${
                    pass ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-400'
                  }`}>
                    <Check size={10} /> {label}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Confirm Password */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">비밀번호 확인</label>
            <input
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="비밀번호를 다시 입력해주세요"
              className="input"
              autoComplete="new-password"
            />
            {confirmPassword && !isPasswordMatch && (
              <p className="text-red-500 text-xs mt-1">비밀번호가 일치하지 않습니다</p>
            )}
            {isPasswordMatch && (
              <p className="text-green-500 text-xs mt-1 flex items-center gap-1">
                <Check size={12} /> 비밀번호가 일치합니다
              </p>
            )}
          </div>

          {/* Submit */}
          <div className="pt-2">
            <button type="submit" disabled={!canSubmit || loading} className="btn-primary">
              {loading ? '가입 중...' : '가입하기'}
            </button>
          </div>
        </form>

        <div className="mt-6 text-center text-sm text-gray-500">
          이미 계정이 있으신가요?{' '}
          <Link href="/login" className="text-primary-500 font-semibold">로그인</Link>
        </div>

        <p className="mt-8 text-center text-xs text-gray-400 leading-relaxed">
          가입함으로써{' '}
          <Link href="/terms/service" className="text-primary-500 font-medium">이용약관</Link>과{' '}
          <Link href="/terms/privacy" className="text-primary-500 font-medium">개인정보처리방침</Link>에<br />
          동의하는 것으로 간주됩니다
        </p>
      </div>
    </div>
  );
}

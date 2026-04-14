'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuth } from '@/lib/hooks/useAuth';

const schema = z.object({
  email: z.string().email('올바른 이메일을 입력해주세요'),
  password: z.string().min(1, '비밀번호를 입력해주세요'),
});
type FormData = z.infer<typeof schema>;

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { emailLogin } = useAuth();

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    try {
      await emailLogin(data.email, data.password);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* 왼쪽: 캐릭터 영역 (데스크톱) */}
      <div className="hidden md:flex md:w-1/2 bg-[#F4FF93] items-center justify-center">
        <div className="text-center">
          <h1 className="text-6xl font-black text-gray-900 tracking-tight">Freetiful</h1>
          <p className="mt-4 text-gray-700 text-lg">나의 특별한 행사를 완성하는 전문가</p>
        </div>
      </div>

      {/* 오른쪽: 로그인 폼 */}
      <div className="w-full md:w-1/2 flex flex-col justify-center px-6 md:px-16 py-12 bg-white">
        <div className="w-full max-w-sm mx-auto">
          {/* 모바일 로고 */}
          <div className="md:hidden mb-10 text-center">
            <h1 className="text-3xl font-black text-gray-900 tracking-tight">Freetiful</h1>
          </div>

          <h2 className="text-2xl font-bold text-gray-900 mb-8">로그인</h2>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">이메일</label>
              <input
                {...register('email')}
                type="email"
                placeholder="이메일을 입력해주세요"
                autoComplete="email"
                className="w-full h-12 px-4 bg-[#F9F9F9] border-0 rounded-lg text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#4E8FFF]"
              />
              {errors.email && <p className="text-red-500 text-xs mt-1.5">{errors.email.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">비밀번호</label>
              <div className="relative">
                <input
                  {...register('password')}
                  type={showPassword ? 'text' : 'password'}
                  placeholder="비밀번호를 입력해주세요"
                  autoComplete="current-password"
                  className="w-full h-12 px-4 pr-12 bg-[#F9F9F9] border-0 rounded-lg text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#4E8FFF]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
                  aria-label={showPassword ? '비밀번호 숨기기' : '비밀번호 보기'}
                >
                  {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
              {errors.password && <p className="text-red-500 text-xs mt-1.5">{errors.password.message}</p>}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-[50px] bg-[#4E8FFF] hover:bg-[#3D7FEF] disabled:bg-gray-300 text-white font-semibold rounded-lg transition-colors mt-6"
            >
              {loading ? '로그인 중...' : '로그인'}
            </button>
          </form>

          <p className="mt-8 text-center text-xs text-gray-400">
            계정 문의는 운영팀에 연락해주세요
          </p>
        </div>
      </div>
    </div>
  );
}

function EyeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path d="M1 10C1 10 4.5 4 10 4C15.5 4 19 10 19 10C19 10 15.5 16 10 16C4.5 16 1 10 1 10Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="10" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path d="M2 2L18 18M8.5 4.2A9.3 9.3 0 0 1 10 4C15.5 4 19 10 19 10C18.5 10.9 17.8 11.9 17 12.8M11.5 11.5A2.5 2.5 0 0 1 8.5 8.5M5 5.5C2.8 7.3 1 10 1 10C1 10 4.5 16 10 16C11.5 16 12.9 15.6 14 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

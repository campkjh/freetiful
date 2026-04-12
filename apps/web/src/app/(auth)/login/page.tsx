'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

const schema = z.object({
  email: z.string().email('올바른 이메일을 입력해주세요'),
  password: z.string().min(1, '비밀번호를 입력해주세요'),
});
type FormData = z.infer<typeof schema>;

function buildOAuthUrl(base: string, params: Record<string, string>) {
  const query = new URLSearchParams(params).toString();
  return `${base}?${query}`;
}

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  // 테스트 로그인 (백엔드 없이)
  const handleTestLogin = (provider: string) => {
    setLoading(true);
    localStorage.setItem('freetiful-logged-in', 'true');
    localStorage.setItem('freetiful-user', JSON.stringify({
      name: '',
      email: '',
      provider,
      image: '',
      createdAt: Date.now(),
    }));
    localStorage.setItem('userRole', 'general');
    setTimeout(() => {
      router.push('/onboarding');
    }, 500);
  };

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    localStorage.setItem('freetiful-logged-in', 'true');
    localStorage.setItem('freetiful-user', JSON.stringify({
      name: '',
      email: data.email,
      provider: 'email',
      image: '',
      createdAt: Date.now(),
    }));
    localStorage.setItem('userRole', 'general');
    setTimeout(() => {
      router.push('/onboarding');
    }, 500);
  };

  const handleKakao = () => handleTestLogin('kakao');
  const handleNaver = () => handleTestLogin('naver');

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <div className="flex-1 flex flex-col justify-center px-6 py-12 max-w-md mx-auto w-full">
        <div className="mb-10 text-center">
          <h1 className="text-3xl font-black text-primary-500 tracking-tight">Freetiful</h1>
          <p className="mt-2 text-gray-500 text-sm">나의 특별한 행사를 완성하는 전문가</p>
        </div>

        <div className="space-y-3 mb-6">
          <button
            onClick={handleKakao}
            className="w-full flex items-center justify-center gap-3 bg-[#FEE500] text-[#191919] font-semibold py-3.5 px-4 rounded-xl hover:bg-[#F5DC00] transition-colors"
          >
            <KakaoIcon />
            카카오로 계속하기
          </button>

          <button
            onClick={handleNaver}
            className="w-full flex items-center justify-center gap-3 bg-[#03C75A] text-white font-semibold py-3.5 px-4 rounded-xl hover:bg-[#02B350] transition-colors"
          >
            <NaverIcon />
            네이버로 계속하기
          </button>

          <button onClick={() => handleTestLogin('google')} className="w-full flex items-center justify-center gap-3 bg-white text-gray-700 border border-gray-200 font-semibold py-3.5 px-4 rounded-xl hover:bg-gray-50 transition-colors">
            <GoogleIcon />
            Google로 계속하기
          </button>

          <button onClick={() => handleTestLogin('apple')} className="w-full flex items-center justify-center gap-3 bg-black text-white font-semibold py-3.5 px-4 rounded-xl hover:bg-gray-900 transition-colors">
            <AppleIcon />
            Apple로 계속하기
          </button>
        </div>

        <div className="flex items-center gap-3 my-4">
          <div className="flex-1 h-px bg-gray-200" />
          <span className="text-gray-400 text-xs">또는 이메일로</span>
          <div className="flex-1 h-px bg-gray-200" />
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div>
            <input {...register('email')} type="email" placeholder="이메일" className="input" autoComplete="email" />
            {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
          </div>
          <div>
            <input {...register('password')} type="password" placeholder="비밀번호" className="input" autoComplete="current-password" />
            {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
          </div>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? '로그인 중...' : '로그인'}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-gray-500">
          계정이 없으신가요?{' '}
          <Link href="/signup" className="text-primary-500 font-semibold">회원가입</Link>
        </div>
      </div>

      <div className="px-6 pb-8 text-center text-xs text-gray-400 space-x-3">
        <Link href="/terms/privacy">개인정보처리방침</Link>
        <span>·</span>
        <Link href="/terms/service">이용약관</Link>
      </div>
    </div>
  );
}

function KakaoIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path fillRule="evenodd" clipRule="evenodd" d="M9 0C4.03 0 0 3.19 0 7.13c0 2.52 1.67 4.74 4.19 6.01L3.1 17.2a.3.3 0 0 0 .46.32L8.4 14a10.7 10.7 0 0 0 .6.02C13.97 14.02 18 10.83 18 6.89 18 2.94 13.97 0 9 0z" fill="#191919" />
    </svg>
  );
}

function NaverIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
      <path d="M16.27 12.84L7.27 0H0v24h7.73V11.16L16.73 24H24V0h-7.73z" />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg width="16" height="18" viewBox="0 0 814 1000" fill="white">
      <path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76 0-103.7 40.8-165.9 40.8s-105-57.8-155.5-127.4C46.7 791 0 703.7 0 621 0 463.5 100.3 380.8 198.5 380.8c66.1 0 121.2 43.4 162.7 43.4 39.5 0 101.1-46 176.3-46 28.5 0 130.9 2.6 198.3 99.2zm-234-181.5c31.1-36.9 53.1-88.1 53.1-139.3 0-7.1-.6-14.3-1.9-20.1-50.6 1.9-110.8 33.7-147.1 75.8-28.5 32.4-55.1 83.6-55.1 135.5 0 7.8 1.3 15.6 1.9 18.1 3.2.6 8.4 1.3 13.6 1.3 45.4 0 102.5-30.4 135.5-71.3z" />
    </svg>
  );
}

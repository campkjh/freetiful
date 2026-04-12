'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function RootPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const isLoggedIn = localStorage.getItem('freetiful-logged-in');
    if (isLoggedIn === 'true') {
      const role = localStorage.getItem('userRole');
      router.replace(role === 'pro' ? '/pro-dashboard' : '/main');
    } else {
      setChecking(false);
    }
  }, [router]);

  const handleLogin = (provider: string) => {
    localStorage.setItem('freetiful-logged-in', 'true');
    localStorage.setItem('freetiful-user', JSON.stringify({
      name: '',
      email: '',
      provider,
      image: '',
      createdAt: Date.now(),
    }));
    localStorage.setItem('userRole', 'general');
    router.push('/onboarding');
  };

  if (checking) return null;

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <div className="flex-1 flex flex-col justify-center px-6 py-12 max-w-md mx-auto w-full">
        <div className="mb-10 text-center">
          <h1 className="text-3xl font-bold text-[#3180F7] tracking-tight">Freetiful</h1>
          <p className="mt-2 text-gray-500 text-sm">나의 특별한 행사를 완성하는 전문가</p>
        </div>

        <div className="space-y-3 mb-6">
          <button
            onClick={() => handleLogin('kakao')}
            className="w-full flex items-center justify-center gap-3 bg-[#FEE500] text-[#191919] font-semibold py-3.5 px-4 rounded-xl active:scale-[0.98] transition-transform"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path fillRule="evenodd" clipRule="evenodd" d="M9 0C4.03 0 0 3.19 0 7.13c0 2.52 1.67 4.74 4.19 6.01L3.1 17.2a.3.3 0 0 0 .46.32L8.4 14a10.7 10.7 0 0 0 .6.02C13.97 14.02 18 10.83 18 6.89 18 2.94 13.97 0 9 0z" fill="#191919"/></svg>
            카카오로 계속하기
          </button>

          <button
            onClick={() => handleLogin('naver')}
            className="w-full flex items-center justify-center gap-3 bg-[#03C75A] text-white font-semibold py-3.5 px-4 rounded-xl active:scale-[0.98] transition-transform"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M12.16 9.57L5.56 0H0v18h5.84V8.43L12.44 18H18V0h-5.84v9.57z" fill="white"/></svg>
            네이버로 계속하기
          </button>

          <button
            onClick={() => handleLogin('google')}
            className="w-full flex items-center justify-center gap-3 bg-white text-gray-700 border border-gray-200 font-semibold py-3.5 px-4 rounded-xl active:scale-[0.98] transition-transform"
          >
            <svg width="18" height="18" viewBox="0 0 18 18"><path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/><path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/><path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/><path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/></svg>
            Google로 계속하기
          </button>

          <button
            onClick={() => handleLogin('apple')}
            className="w-full flex items-center justify-center gap-3 bg-black text-white font-semibold py-3.5 px-4 rounded-xl active:scale-[0.98] transition-transform"
          >
            <svg width="16" height="18" viewBox="0 0 16 20" fill="white"><path d="M15.545 15.467c-.318.734-.692 1.41-1.124 2.033-.588.852-1.07 1.442-1.44 1.77-.577.539-1.194.815-1.856.832-.475 0-1.048-.135-1.714-.41-.669-.273-1.284-.408-1.848-.408-.588 0-1.22.135-1.893.408-.675.275-1.22.418-1.635.432-.636.027-1.267-.256-1.893-.852-.402-.356-.904-.967-1.507-1.832C.983 16.513.48 15.44.14 14.332c-.364-1.198-.547-2.357-.547-3.48 0-1.286.278-2.395.833-3.323A4.893 4.893 0 012.17 5.836a4.702 4.702 0 012.37-.67c.504 0 1.165.156 1.987.463.819.308 1.345.464 1.574.464.172 0 .753-.182 1.738-.545.932-.337 1.718-.476 2.364-.42 1.747.14 3.06.828 3.93 2.07-1.562.947-2.334 2.274-2.317 3.974.015 1.323.494 2.424 1.434 3.296.427.405.903.717 1.434.94-.115.334-.236.654-.364.96zM11.914.21c0 1.037-.379 2.005-1.133 2.9-.911 1.063-2.012 1.677-3.206 1.58a3.224 3.224 0 01-.024-.393c0-.995.433-2.06 1.203-2.93.384-.44.873-.806 1.467-1.097.593-.287 1.153-.446 1.68-.476.016.139.024.278.024.416z"/></svg>
            Apple로 계속하기
          </button>
        </div>

        <div className="text-center text-xs text-gray-400 mt-4 leading-relaxed">
          계속하면{' '}
          <Link href="/terms/service" className="text-[#3180F7] font-medium">이용약관</Link>과{' '}
          <Link href="/terms/privacy" className="text-[#3180F7] font-medium">개인정보처리방침</Link>에<br />
          동의하는 것으로 간주됩니다
        </div>
      </div>
    </div>
  );
}

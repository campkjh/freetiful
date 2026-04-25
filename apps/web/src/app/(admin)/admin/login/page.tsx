'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { authApi } from '@/lib/api/auth.api';
import { useAuthStore } from '@/lib/store/auth.store';
import toast from 'react-hot-toast';

const ADMIN_EMAILS = ['admin@freetiful.com'];

function isAdminUser(user: { email?: string | null; role?: string | null }) {
  return user.role === 'admin' || (!!user.email && ADMIN_EMAILS.includes(user.email));
}

const schema = z.object({
  email: z.string().email('올바른 이메일을 입력해주세요'),
  password: z.string().min(1, '비밀번호를 입력해주세요'),
});
type FormData = z.infer<typeof schema>;

export default function AdminLoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [keyLoading, setKeyLoading] = useState(false);
  const [adminKey, setAdminKey] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const setAuth = useAuthStore((s) => s.setAuth);

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    try {
      const res = await authApi.emailLogin(data.email.trim().toLowerCase(), data.password);
      if (!isAdminUser(res.user)) {
        toast.error('어드민 권한이 없습니다');
        return;
      }
      setAuth(res.user, res.tokens.accessToken, res.tokens.refreshToken);
      router.replace('/admin/users');
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? '로그인에 실패했습니다');
    } finally {
      setLoading(false);
    }
  };

  const loginWithAdminKey = async () => {
    const key = adminKey.trim();
    if (!key) {
      toast.error('관리자 키를 입력해주세요');
      return;
    }
    setKeyLoading(true);
    try {
      const res = await fetch('/api/v1/admin/stats', {
        headers: { 'x-admin-key': key },
        cache: 'no-store',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message || '관리자 키를 확인해주세요');
      }
      localStorage.setItem('admin-key', key);
      window.dispatchEvent(new Event('freetiful:admin-key-changed'));
      toast.success('관리자 키로 로그인했습니다');
      router.replace('/admin');
    } catch (e: any) {
      toast.error(e?.message || '관리자 키 로그인이 실패했습니다');
    } finally {
      setKeyLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center px-6 py-12 bg-white">
      <div className="w-full max-w-sm mx-auto">
        <div className="mb-10 flex flex-col items-center text-center">
          <Image
            src="/images/logo-freetiful-wordmark.svg"
            alt="Freetiful"
            width={154}
            height={45}
            priority
            className="h-[38px] w-auto"
          />
          <p className="mt-2 text-[12px] font-bold text-[#8B95A1]">Admin Console</p>
        </div>

        <h2 className="text-[14px] font-semibold text-[#191F28] mb-6">로그인</h2>

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

        <div className="my-7 flex items-center gap-3">
          <span className="h-px flex-1 bg-[#F2F4F6]" />
          <span className="text-[11px] font-bold text-[#B0B8C1]">또는</span>
          <span className="h-px flex-1 bg-[#F2F4F6]" />
        </div>

        <div className="rounded-2xl bg-[#F7F8FA] p-4">
          <p className="text-[13px] font-bold text-[#191F28]">관리자 키로 로그인</p>
          <p className="mt-1 text-[11px] leading-relaxed text-[#8B95A1]">
            이메일 계정이 아직 운영 DB에 생성되지 않았거나 비밀번호가 맞지 않을 때 사용합니다.
          </p>
          <div className="mt-3 flex gap-2">
            <input
              value={adminKey}
              onChange={(e) => setAdminKey(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') loginWithAdminKey();
              }}
              type="password"
              placeholder="ADMIN_SECRET_KEY"
              autoComplete="off"
              className="min-w-0 flex-1 rounded-xl bg-white px-3 text-sm font-semibold text-[#191F28] outline-none ring-1 ring-[#E5E8EB] focus:ring-2 focus:ring-[#4E8FFF]"
            />
            <button
              type="button"
              onClick={loginWithAdminKey}
              disabled={keyLoading}
              className="h-11 rounded-xl bg-[#191F28] px-4 text-[13px] font-bold text-white disabled:bg-gray-300"
            >
              {keyLoading ? '확인 중' : '입장'}
            </button>
          </div>
        </div>

        <p className="mt-8 text-center text-xs text-gray-400">
          이 페이지는 관리자 전용입니다
        </p>
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

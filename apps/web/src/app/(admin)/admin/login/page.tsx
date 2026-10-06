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
import { isAdminUser } from '@/lib/admin-access';

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

  // 어드민 2.0(261004) — 회색 바탕 + 가운데 흰 카드, 입력칸 56 · 버튼 56/r17/17(앱 공통), 카드와 줄들이 차례로 올라온다
  const field = 'h-14 w-full rounded-[14px] border-[1.5px] border-transparent bg-[#F2F4F6] px-4 text-[16px] text-[#191F28] outline-none transition-colors placeholder:text-[#B0B8C1] focus:border-[#3182F6] focus:bg-white';
  return (
    <div className="flex min-h-screen flex-col justify-center bg-[#F2F4F6] px-5 py-12">
      <div className="adm-login mx-auto w-full max-w-[420px] rounded-[24px] bg-white px-6 pb-7 pt-9 sm:px-9">
        <div className="adm-login-rise mb-8 flex items-center gap-2">
          <Image
            src="/images/logo-freetiful-wordmark.svg"
            alt="Freetiful"
            width={120}
            height={35}
            priority
            className="h-[28px] w-auto"
          />
          <span className="rounded-full bg-[#E8F3FF] px-2.5 py-1 text-[12px] font-bold text-[#3182F6]">관리자</span>
        </div>

        <h1 className="adm-login-rise text-[24px] font-bold tracking-[-0.6px] text-[#191F28]" style={{ animationDelay: '.05s' }}>관리자 로그인</h1>
        <p className="adm-login-rise mt-1.5 text-[15px] text-[#6B7684]" style={{ animationDelay: '.1s' }}>운영 계정으로 들어가요</p>

        <form onSubmit={handleSubmit(onSubmit)} className="adm-login-rise mt-7 space-y-3" style={{ animationDelay: '.15s' }}>
          <div>
            <input
              {...register('email')}
              type="email"
              placeholder="이메일"
              autoComplete="email"
              aria-label="이메일"
              className={field}
            />
            {errors.email && <p className="mt-1.5 px-1 text-[13px] text-[#F04452]">{errors.email.message}</p>}
          </div>

          <div>
            <div className="relative">
              <input
                {...register('password')}
                type={showPassword ? 'text' : 'password'}
                placeholder="비밀번호"
                autoComplete="current-password"
                aria-label="비밀번호"
                className={`${field} pr-12`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-[#B0B8C1] hover:text-[#6B7684]"
                aria-label={showPassword ? '비밀번호 숨기기' : '비밀번호 보기'}
              >
                {showPassword ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
            {errors.password && <p className="mt-1.5 px-1 text-[13px] text-[#F04452]">{errors.password.message}</p>}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-3 h-14 w-full rounded-[17px] bg-[#3182F6] text-[17px] font-semibold text-white transition active:scale-[.98] enabled:hover:bg-[#2272EB] disabled:opacity-50"
          >
            {loading ? '로그인 중…' : '로그인'}
          </button>
        </form>

        <details className="adm-login-rise group mt-6 rounded-[16px] bg-[#F7F8FA]" style={{ animationDelay: '.2s' }}>
          <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3.5 text-[14px] font-semibold text-[#4E5968] [&::-webkit-details-marker]:hidden">
            관리자 키로 들어가기
            <span className="ml-auto text-[#B0B8C1] transition-transform group-open:rotate-180" aria-hidden>⌄</span>
          </summary>
          <div className="px-4 pb-4">
            <p className="text-[13px] leading-relaxed text-[#8B95A1]">
              운영 DB에 이메일 계정이 아직 없거나 비밀번호가 맞지 않을 때 써요.
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
                aria-label="관리자 키"
                className="h-12 min-w-0 flex-1 rounded-[12px] border-[1.5px] border-transparent bg-white px-3 text-[15px] text-[#191F28] outline-none focus:border-[#3182F6]"
              />
              <button
                type="button"
                onClick={loginWithAdminKey}
                disabled={keyLoading}
                className="h-12 rounded-[12px] bg-[#E8F3FF] px-4 text-[15px] font-semibold text-[#3182F6] disabled:opacity-50"
              >
                {keyLoading ? '확인 중' : '입장'}
              </button>
            </div>
          </div>
        </details>
      </div>
      <p className="mt-6 text-center text-[13px] text-[#B0B8C1]">이 페이지는 관리자 전용이에요</p>
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

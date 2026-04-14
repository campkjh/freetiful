'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { authApi } from '@/lib/api/auth.api';
import { useAuthStore } from '@/lib/store/auth.store';
import toast from 'react-hot-toast';

const ADMIN_EMAILS = ['admin@freetiful.com'];

const schema = z.object({
  email: z.string().email('올바른 이메일을 입력해주세요'),
  password: z.string().min(1, '비밀번호를 입력해주세요'),
});
type FormData = z.infer<typeof schema>;

export default function AdminLoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const setAuth = useAuthStore((s) => s.setAuth);

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    if (!ADMIN_EMAILS.includes(data.email)) {
      toast.error('어드민 권한이 없습니다');
      return;
    }
    setLoading(true);
    try {
      const res = await authApi.emailLogin(data.email, data.password);
      setAuth(res.user, res.tokens.accessToken, res.tokens.refreshToken);
      router.replace('/admin/users');
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? '로그인에 실패했습니다');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 px-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-black text-white">Freetiful Admin</h1>
          <p className="mt-2 text-gray-400 text-sm">관리자 전용 페이지</p>
        </div>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="bg-gray-800 rounded-xl p-6 space-y-4 border border-gray-700"
        >
          <div>
            <label className="block text-xs font-medium text-gray-300 mb-2">이메일</label>
            <input
              {...register('email')}
              type="email"
              placeholder="admin@freetiful.com"
              autoComplete="email"
              className="w-full h-11 px-4 bg-gray-900 border border-gray-700 rounded-lg text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-blue-500"
            />
            {errors.email && <p className="text-red-400 text-xs mt-1.5">{errors.email.message}</p>}
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-300 mb-2">비밀번호</label>
            <input
              {...register('password')}
              type="password"
              autoComplete="current-password"
              className="w-full h-11 px-4 bg-gray-900 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500"
            />
            {errors.password && <p className="text-red-400 text-xs mt-1.5">{errors.password.message}</p>}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full h-11 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-600 text-white font-semibold rounded-lg transition-colors"
          >
            {loading ? '로그인 중...' : '로그인'}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-gray-500">
          이 페이지는 관리자 전용입니다
        </p>
      </div>
    </div>
  );
}

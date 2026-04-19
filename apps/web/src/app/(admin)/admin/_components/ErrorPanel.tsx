'use client';

import { AlertCircle } from 'lucide-react';
import { useAuthStore } from '@/lib/store/auth.store';

export interface AdminErrorInfo {
  status?: number;
  message?: string;
}

export function AdminErrorPanel({ error, label = '목록' }: { error: AdminErrorInfo | null; label?: string }) {
  const authUser = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  if (!error) return null;

  const hasAdminKey = typeof window !== 'undefined' && !!localStorage.getItem('admin-key');

  return (
    <div className="mb-4 bg-red-50 border border-red-200 rounded-xl p-4 text-sm">
      <div className="flex items-start gap-3">
        <AlertCircle size={18} className="text-red-500 mt-0.5 shrink-0" />
        <div className="flex-1 space-y-1">
          <p className="font-bold text-red-700">{label} 로드 실패 {error.status ? `(HTTP ${error.status})` : ''}</p>
          <p className="text-red-600 break-words">{error.message || '알 수 없는 오류'}</p>
          <div className="mt-2 pt-2 border-t border-red-200 space-y-0.5 text-[12px] text-red-700/80">
            <p>로그인 이메일: <code className="bg-white px-1.5 py-0.5 rounded">{authUser?.email || '(로그인 안됨)'}</code></p>
            <p>유저 role: <code className="bg-white px-1.5 py-0.5 rounded">{authUser?.role || '(없음)'}</code></p>
            <p>JWT 토큰: <code className="bg-white px-1.5 py-0.5 rounded">{accessToken ? '있음' : '없음'}</code></p>
            <p>admin-key: <code className="bg-white px-1.5 py-0.5 rounded">{hasAdminKey ? '있음' : '없음'}</code></p>
          </div>
          {error.status === 403 && (
            <p className="mt-2 text-[12px] text-red-700/80 bg-white rounded-lg px-3 py-2">
              <strong>해결 방법:</strong>
              <br />1) Railway 쉘: <code>cd apps/api && npx ts-node prisma/create-admin.ts</code> 실행 → admin@freetiful.com / Freetiful2026!
              <br />2) 또는 <code>/admin</code> 첫 화면에서 Railway의 <code>ADMIN_SECRET_KEY</code> 값 입력
            </p>
          )}
          {error.status === 401 && (
            <p className="mt-2 text-[12px] text-red-700/80 bg-white rounded-lg px-3 py-2">
              <strong>해결:</strong> 로그인 세션 만료. <a href="/admin/login" className="underline font-bold">재로그인</a>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export function extractAdminError(e: any): AdminErrorInfo {
  return {
    status: e?.response?.status,
    message: e?.response?.data?.message || e?.message || '알 수 없는 오류',
  };
}

'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect } from 'react';

function withSearch(path: string, searchParams: URLSearchParams) {
  const query = searchParams.toString();
  return query ? `${path}?${query}` : path;
}

function resolveRecoveryPath(pathname: string, searchParams: URLSearchParams) {
  const path = pathname.toLowerCase();
  const provider = path.includes('kakao')
    ? 'kakao'
    : path.includes('naver')
      ? 'naver'
      : null;

  if (provider) {
    const isMobile = path.includes('mobile');
    return withSearch(`/auth/${provider}/${isMobile ? 'mobile' : 'callback'}`, searchParams);
  }

  const looksLikeLoginReturn =
    path.includes('oauth') ||
    path.includes('callback') ||
    path.includes('login') ||
    path.includes('signin') ||
    path.includes('signup') ||
    path.startsWith('/auth');

  return looksLikeLoginReturn ? '/main' : null;
}

function NotFoundInner() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    const recoveryPath = resolveRecoveryPath(pathname || '', new URLSearchParams(searchParams.toString()));
    if (recoveryPath) router.replace(recoveryPath);
  }, [pathname, router, searchParams]);

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-white px-6 text-center">
      <h1 className="text-2xl font-bold text-gray-900">페이지를 찾을 수 없습니다</h1>
      <p className="mt-3 text-sm text-gray-500">잠시 후 홈으로 이동하거나 아래 버튼을 눌러주세요.</p>
      <Link
        href="/main"
        className="mt-6 inline-flex h-11 items-center justify-center rounded-full bg-gray-900 px-6 text-sm font-semibold text-white"
      >
        홈으로 가기
      </Link>
    </main>
  );
}

export default function NotFound() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-white" />}>
      <NotFoundInner />
    </Suspense>
  );
}

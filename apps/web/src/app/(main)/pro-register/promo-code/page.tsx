'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function PromoCodePage() {
  const router = useRouter();

  useEffect(() => {
    try {
      localStorage.removeItem('proRegister_code');
    } catch {}
    router.replace('/pro-register/personal-info');
  }, [router]);

  return <div className="min-h-[100dvh] bg-white" />;
}

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function RootPage() {
  const router = useRouter();
  useEffect(() => {
    const isLoggedIn = localStorage.getItem('freetiful-logged-in');
    if (isLoggedIn === 'true') {
      const role = localStorage.getItem('userRole');
      router.replace(role === 'pro' ? '/pro-dashboard' : '/main');
    } else {
      router.replace('/login');
    }
  }, [router]);
  return null;
}

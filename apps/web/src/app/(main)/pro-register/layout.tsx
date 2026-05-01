'use client';

import type { CSSProperties, FormEvent, ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, LockKeyhole } from 'lucide-react';
import { useRouter } from 'next/navigation';

const PARTNER_ACCESS_KEY = 'freetiful-partner-apply-access';
const PARTNER_ACCESS_PASSWORD = '프리티풀';
const secureTextStyle = {
  WebkitTextSecurity: 'disc',
} as CSSProperties & { WebkitTextSecurity?: string };

export default function ProRegisterLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [checking, setChecking] = useState(true);
  const [unlocked, setUnlocked] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    try {
      const hasAccess = sessionStorage.getItem(PARTNER_ACCESS_KEY) === '1';
      setUnlocked(hasAccess);
    } catch {
      setUnlocked(false);
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    if (!checking && !unlocked) {
      window.setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [checking, unlocked]);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (password.trim().normalize('NFC') !== PARTNER_ACCESS_PASSWORD) {
      setError('비밀번호를 다시 확인해주세요.');
      return;
    }
    try {
      sessionStorage.setItem(PARTNER_ACCESS_KEY, '1');
    } catch {}
    setError('');
    setUnlocked(true);
  };

  if (checking) {
    return <div className="min-h-[100dvh] bg-white" />;
  }

  if (unlocked) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-[100dvh] bg-white px-5">
      <div className="mx-auto flex min-h-[100dvh] w-full max-w-[420px] flex-col justify-center py-10">
        <button
          type="button"
          onClick={() => router.back()}
          className="mb-8 flex h-10 w-10 items-center justify-center rounded-full bg-gray-50 text-gray-700 transition active:scale-95"
          aria-label="뒤로가기"
        >
          <ArrowLeft size={21} />
        </button>

        <div className="mb-7 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#EAF3FF] text-[#3180F7]">
          <LockKeyhole size={26} strokeWidth={2.3} />
        </div>

        <p className="text-[13px] font-bold text-[#3180F7]">파트너스 신청</p>
        <h1 className="mt-2 text-[24px] font-bold leading-[1.25] tracking-[-0.01em] text-gray-950">
          비밀번호를 입력해주세요
        </h1>
        <p className="mt-3 text-[14px] font-medium leading-6 text-gray-500">
          프리티풀 파트너 신청은 승인된 비밀번호 입력 후 진행할 수 있습니다.
        </p>

        <form onSubmit={submit} className="mt-8 space-y-3">
          <input
            ref={inputRef}
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              if (error) setError('');
            }}
            type="text"
            inputMode="text"
            lang="ko"
            enterKeyHint="done"
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            placeholder="비밀번호"
            style={secureTextStyle}
            className={`h-14 w-full rounded-2xl border bg-white px-4 text-[16px] font-semibold text-gray-950 outline-none transition placeholder:text-gray-300 focus:border-[#3180F7] focus:ring-4 focus:ring-[#3180F7]/10 ${
              error ? 'border-red-300 bg-red-50/40' : 'border-gray-100'
            }`}
          />
          {error && <p className="px-1 text-[12px] font-semibold text-red-500">{error}</p>}
          <button
            type="submit"
            className="flex h-14 w-full items-center justify-center rounded-2xl bg-[#3180F7] text-[15px] font-bold text-white shadow-[0_10px_22px_rgba(49,128,247,0.22)] transition active:scale-[0.98]"
          >
            확인
          </button>
        </form>
      </div>
    </div>
  );
}

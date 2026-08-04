'use client';

/**
 * 비회원 로그인 폼 — 랜딩(견적 신청)으로만 가입해 소셜 계정이 없는 고객용.
 * 전화번호 + 이름이 모두 일치해야 로그인된다(서버 /auth/login/guest).
 * 로그인 모달이 웹에 여러 곳(레이아웃/사회자 상세/wedding-mc) 있어 공용으로 뺐다.
 */

import { useState } from 'react';
import { useAuthStore } from '@/lib/store/auth.store';

export default function GuestLoginForm({
  onSuccess,
  onCancel,
  compact = false,
}: {
  onSuccess?: () => void;
  onCancel?: () => void;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    if (busy) return;
    setError('');
    if (!phone.replace(/[^0-9]/g, '') || !name.trim()) {
      setError('전화번호와 이름을 모두 입력해주세요');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/v1/auth/login/guest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, name, platform: 'web' }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.message || '전화번호 또는 이름이 일치하지 않습니다');
        return;
      }
      useAuthStore.getState().setAuth(data.user, data.accessToken, data.refreshToken);
      onSuccess?.();
    } catch {
      setError('로그인에 실패했습니다. 잠시 후 다시 시도해주세요');
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => { setOpen(true); setError(''); }}
        className={`w-full text-center font-semibold text-gray-500 underline underline-offset-4 ${compact ? 'py-2.5 text-[13px]' : 'py-3 text-[14px]'}`}
      >
        비회원 로그인 (견적 신청하신 분)
      </button>
    );
  }

  return (
    <div className={compact ? 'mt-3' : 'mt-4'}>
      <p className="mb-2.5 text-[13px] leading-relaxed text-gray-500">
        <b className="block text-gray-700">* 비회원으로 견적을 신청하신 경우</b>
        도착한 견적을 확인하려면, 견적 신청 때 입력하신{' '}
        <b className="text-gray-700">전화번호와 이름</b>을 그대로 입력해주세요.
      </p>
      <input
        type="tel" inputMode="numeric" value={phone}
        onChange={(e) => { setPhone(e.target.value); setError(''); }}
        placeholder="전화번호 (예: 01012345678)"
        className="mb-2 w-full rounded-xl border border-gray-200 px-4 py-3 text-[16px] outline-none focus:border-[#3182F6]"
      />
      <input
        type="text" value={name}
        onChange={(e) => { setName(e.target.value); setError(''); }}
        onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
        placeholder="이름"
        className="w-full rounded-xl border border-gray-200 px-4 py-3 text-[16px] outline-none focus:border-[#3182F6]"
      />
      {error && <p className="mt-2 text-[13px] font-medium text-[#F04452]">{error}</p>}
      <button
        onClick={submit} disabled={busy}
        className="mt-3 w-full rounded-2xl bg-[#3182F6] py-3.5 text-[15px] font-bold text-white transition active:scale-[0.98] disabled:opacity-60"
      >
        {busy ? '확인 중…' : '로그인'}
      </button>
      <button
        onClick={() => { setOpen(false); setError(''); onCancel?.(); }}
        className="mt-2 w-full py-2 text-center text-[13px] font-medium text-gray-400"
      >
        소셜 로그인으로 돌아가기
      </button>
    </div>
  );
}

'use client';

// 웨딩숲 댓글 칸 위 '내 웨딩숲 프로필 · 바꾸기' 줄(260928 사장 — 지정 계정은 댓글 달 때 닉네임·사진을 정해서 달 수 있게).
//  · 서버가 허용한 계정(canSetNickname)에만 보인다. 누르면 웨딩숲 프로필 시트(AI 추천 닉네임 + 그에 맞는 동물 친구 사진).
//  · 계정당 하나 — 바꾸면 그 계정의 글·댓글 전체가 새 모습으로 보인다.
import { useEffect, useState } from 'react';
import { useAuthStore } from '@/lib/store/auth.store';
import { fetchMyNickname, type MyNickname } from '@/lib/community/my-nickname';
import IdentitySheet from './IdentitySheet';

/** '오리로' / '사슴으로' — 받침(ㄹ 받침은 '로')에 맞춘 조사 */
function roParticle(word: string) {
  const c = word.charCodeAt(word.length - 1);
  if (c < 0xac00 || c > 0xd7a3) return '(으)로';
  const jong = (c - 0xac00) % 28;
  return jong === 0 || jong === 8 ? '로' : '으로';
}

export default function NicknameBar({ onChanged, className = '' }: { onChanged?: (next: MyNickname) => void; className?: string }) {
  const userId = useAuthStore((s) => s.user?.id);
  const [me, setMe] = useState<MyNickname | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    if (!userId) { setMe(null); return; }
    fetchMyNickname().then((n) => { if (alive) setMe(n); });
    return () => { alive = false; };
  }, [userId]);

  if (!me?.canSetNickname) return null;

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={`tdet-replying w-full text-left ${className}`}>
        <span className="flex min-w-0 items-center gap-2">
          {me.avatar && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={me.avatar} alt="" className="h-6 w-6 shrink-0 rounded-full object-cover" referrerPolicy="no-referrer" />
          )}
          <span className="min-w-0 truncate">
            <b>{me.nickname}</b>{roParticle(me.nickname)} 남겨요
          </span>
        </span>
        <span className="shrink-0 text-[13.5px] font-semibold text-[#3182F6]">✦ 바꾸기</span>
      </button>
      <IdentitySheet open={open} current={me} onClose={() => setOpen(false)} onSaved={(next) => { setMe(next); onChanged?.(next); }} />
    </>
  );
}

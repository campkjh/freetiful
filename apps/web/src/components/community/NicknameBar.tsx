'use client';

// 웨딩숲 댓글 칸 위 '내 닉네임 · 바꾸기' 줄(260928 사장 — 지정 계정은 댓글 달 때 닉네임을 정해서 달 수 있게).
//  · 서버가 허용한 계정(canSetNickname)에만 보인다. 닉네임은 계정당 하나 — 바꾸면 그 계정의 글·댓글 전체가 새 닉네임으로 보인다
//    (댓글마다 다른 이름이면 한 사람이 여러 회원처럼 보여서 그렇게 만들지 않았다).
//  · 바꾸기 = 아래에서 스프링으로 올라오는 시트(뒤 화면 잠금). 댓글 시트 안에서도 전체 화면으로 뜨게 body 로 portal.
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, MotionConfig, motion } from 'framer-motion';
import { useAuthStore } from '@/lib/store/auth.store';
import { useBodyScrollLock } from '@/lib/hooks/useBodyScrollLock';
import { fetchMyNickname, saveMyNickname, type MyNickname } from '@/lib/community/my-nickname';

export default function NicknameBar({ onChanged, className = '' }: { onChanged?: (next: MyNickname) => void; className?: string }) {
  const userId = useAuthStore((s) => s.user?.id);
  const [me, setMe] = useState<MyNickname | null>(null);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  useBodyScrollLock(open);

  useEffect(() => {
    let alive = true;
    if (!userId) { setMe(null); return; }
    fetchMyNickname().then((n) => { if (alive) setMe(n); });
    return () => { alive = false; };
  }, [userId]);

  if (!me?.canSetNickname) return null;

  const save = async () => {
    if (saving) return;
    setSaving(true);
    setError('');
    try {
      const next = await saveMyNickname(draft);
      setMe(next);
      setOpen(false);
      onChanged?.(next);
    } catch (e: any) {
      setError(e?.response?.data?.message || '저장하지 못했어요');
    } finally {
      setSaving(false);
    }
  };

  const valid = draft.trim().length >= 2 && draft.trim().length <= 12;

  return (
    <>
      <div className={`tdet-replying ${className}`}>
        <span className="min-w-0 truncate">
          닉네임 <b>{me.nickname}</b>
        </span>
        <button type="button" onClick={() => { setDraft(me.custom || ''); setError(''); setOpen(true); }}>
          {me.custom ? '바꾸기' : '정하기'}
        </button>
      </div>

      {typeof document !== 'undefined' && createPortal(
        <MotionConfig reducedMotion="user">
          <AnimatePresence>
            {open && (
              <motion.div
                key="nick-scrim"
                className="ft-scrim"
                style={{ animation: 'none' }}
                initial={{ backgroundColor: 'rgba(0, 0, 0, 0)' }}
                animate={{ backgroundColor: 'rgba(0, 0, 0, 0.4)' }}
                exit={{ backgroundColor: 'rgba(0, 0, 0, 0)' }}
                transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
                onClick={() => !saving && setOpen(false)}
              >
                <motion.div
                  className="ft-sheet"
                  role="dialog"
                  aria-modal="true"
                  aria-label="웨딩숲 닉네임"
                  style={{ animation: 'none' }}
                  initial={{ y: '100%' }}
                  animate={{ y: 0 }}
                  exit={{ y: '100%', transition: { duration: 0.26, ease: [0.4, 0, 1, 1] } }}
                  transition={{ type: 'spring', stiffness: 380, damping: 36, mass: 0.9 }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="ft-grab" aria-hidden="true" />
                  <h2 className="ft-title">웨딩숲 닉네임</h2>
                  <p className="ft-desc">계정당 하나로 적용돼요. 바꾸면 내가 쓴 글과 댓글이 모두 새 닉네임으로 보여요.</p>
                  <input
                    className="ft-input mt-5"
                    value={draft}
                    maxLength={12}
                    placeholder="2~12자 (한글·영문·숫자)"
                    autoFocus
                    onChange={(e) => { setDraft(e.target.value); if (error) setError(''); }}
                    onKeyDown={(e) => { if (e.key === 'Enter' && valid) save(); }}
                  />
                  <p className={`mt-2 text-[13px] leading-5 ${error ? 'text-[#F04452]' : 'text-[#8B95A1]'}`}>
                    {error || '운영진이나 사회자로 보일 수 있는 이름은 쓸 수 없어요'}
                  </p>
                  <div className="ft-actions">
                    <button type="button" className="ft-btn secondary" onClick={() => setOpen(false)} disabled={saving}>취소</button>
                    <button type="button" className="ft-btn primary" onClick={save} disabled={!valid || saving}>{saving ? '저장 중' : '저장'}</button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </MotionConfig>,
        document.body,
      )}
    </>
  );
}

'use client';

// 웨딩숲 프로필 시트(260928 사장 — 지정 계정: 닉네임을 누르면 AI 가 추천 닉네임 + 그에 맞는 프로필 사진, 사진도 바꿀 수 있게, 글 올릴 때도).
//  · 열자마자 AI 추천 6개('꾸밈말 + 동물' + 그 동물 친구 사진)가 차례로 떠오른다 · '다시 추천' · 닉네임 직접 고치기 · 사진 고르기(동물 친구 20종 / 원래 사진).
//  · 계정당 하나 — 저장하면 그 계정의 글·댓글 전체가 새 닉네임·사진으로 보인다(글마다 다른 사람처럼 보이게 하는 건 만들지 않음).
//  · 사진은 웨딩숲에서만 보인다(실제 프로필 사진 — 사회자 페이지 등 — 은 그대로). 아무 사진이나 올리는 건 막고 동물 친구 중에서만.
//  · 댓글 시트 안에서도 전체 화면으로 뜨게 body 로 portal, 뒤 화면 잠금, 스프링으로 올라오고 내려가며 닫힌다.
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, MotionConfig, motion } from 'framer-motion';
import { useAuthStore } from '@/lib/store/auth.store';
import { useBodyScrollLock } from '@/lib/hooks/useBodyScrollLock';
import { saveMyNickname, suggestNicknames, type MyNickname, type NicknameSuggestion } from '@/lib/community/my-nickname';
import { AVATAR_ANIMALS } from '@/lib/community/nickname';

const animalSrc = (i: number) => `/images/avatars/animal-${String(i + 1).padStart(2, '0')}.webp`;
/** 동물 친구 사진 주소 → 번호(0~19), 아니면 -1 */
const animalIndex = (url?: string | null) => {
  const m = /\/images\/avatars\/animal-(\d{2})\.webp$/.exec(url || '');
  return m ? Number(m[1]) - 1 : -1;
};

function Face({ src, size, alt = '' }: { src?: string | null; size: number; alt?: string }) {
  return (
    <span className="flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#F2F4F6]" style={{ width: size, height: size }}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt} className="h-full w-full object-cover" referrerPolicy="no-referrer" draggable={false} />
      ) : (
        <span className="text-[13px] font-semibold text-[#B0B8C1]">원래</span>
      )}
    </span>
  );
}

export default function IdentitySheet({
  open,
  current,
  onClose,
  onSaved,
}: {
  open: boolean;
  current: MyNickname;
  onClose: () => void;
  onSaved: (next: MyNickname) => void;
}) {
  const originalPhoto = useAuthStore((s) => s.user?.profileImageUrl) || null;
  const [nickname, setNickname] = useState('');
  /** 고른 사진 — 동물 친구 주소, null = 원래 사진 */
  const [photo, setPhoto] = useState<string | null>(null);
  const [items, setItems] = useState<NicknameSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [round, setRound] = useState(0);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  useBodyScrollLock(open);

  const recommend = async () => {
    setLoading(true);
    setError('');
    try {
      setItems(await suggestNicknames());
      setRound((r) => r + 1);
    } catch {
      setError('추천을 불러오지 못했어요. 다시 눌러 주세요.');
    } finally {
      setLoading(false);
    }
  };

  // 열 때마다 지금 모습으로 채우고, 추천이 없으면 바로 받아 온다
  useEffect(() => {
    if (!open) return;
    setNickname(current.custom || current.nickname);
    setPhoto(current.customAvatar);
    setError('');
    if (items.length === 0) recommend();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const trimmed = nickname.replace(/\s+/g, ' ').trim();
  const valid = trimmed.length >= 2 && trimmed.length <= 12;
  const shownPhoto = photo ? photo : originalPhoto;

  const save = async () => {
    if (!valid || saving) return;
    setSaving(true);
    setError('');
    try {
      const next = await saveMyNickname(trimmed, photo);
      onSaved(next);
      onClose();
    } catch (e: any) {
      setError(e?.response?.data?.message || '저장하지 못했어요');
    } finally {
      setSaving(false);
    }
  };

  if (typeof document === 'undefined') return null;
  return createPortal(
    <MotionConfig reducedMotion="user">
      <AnimatePresence>
        {open && (
          <motion.div
            key="identity-scrim"
            className="ft-scrim"
            style={{ animation: 'none' }}
            initial={{ backgroundColor: 'rgba(0, 0, 0, 0)' }}
            animate={{ backgroundColor: 'rgba(0, 0, 0, 0.4)' }}
            exit={{ backgroundColor: 'rgba(0, 0, 0, 0)' }}
            transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
            onClick={() => !saving && onClose()}
          >
            <motion.div
              className="ft-sheet"
              role="dialog"
              aria-modal="true"
              aria-label="웨딩숲 프로필"
              style={{ animation: 'none', overscrollBehavior: 'contain' }}
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%', transition: { duration: 0.26, ease: [0.4, 0, 1, 1] } }}
              transition={{ type: 'spring', stiffness: 380, damping: 36, mass: 0.9 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="ft-grab" aria-hidden="true" />
              <h2 className="ft-title">웨딩숲 프로필</h2>
              <p className="ft-desc">계정당 하나로 적용돼요. 바꾸면 내가 쓴 글과 댓글이 모두 새 모습으로 보여요.</p>

              {/* 지금 고른 모습 — 사진 · 닉네임(직접 고칠 수 있다) */}
              <div className="mt-5 flex items-center gap-3">
                <motion.span key={shownPhoto || 'none'} initial={{ scale: 0.8, opacity: 0.4 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 460, damping: 26 }}>
                  <Face src={shownPhoto} size={56} alt="고른 프로필 사진" />
                </motion.span>
                <input
                  className="ft-input min-w-0 flex-1"
                  value={nickname}
                  maxLength={12}
                  placeholder="2~12자 (한글·영문·숫자)"
                  aria-label="닉네임"
                  onChange={(e) => { setNickname(e.target.value); if (error) setError(''); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') save(); }}
                />
              </div>

              {/* AI 추천 — 꾸밈말 + 동물, 그 동물 사진 */}
              <div className="mt-6 flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-[15px] font-semibold text-[#4E5968]">
                  <span aria-hidden className="text-[#8B5CF6]">✦</span> AI 추천
                </span>
                <button type="button" onClick={recommend} disabled={loading} className="flex items-center gap-1 text-[14px] font-semibold text-[#3182F6] disabled:text-[#B0B8C1]">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true" className={loading ? 'animate-spin' : ''}>
                    <path d="M20 12a8 8 0 1 1-2.34-5.66M20 4v4h-4" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  다시 추천
                </button>
              </div>
              <div className="mt-2.5 grid grid-cols-2 gap-2">
                {loading && items.length === 0
                  ? Array.from({ length: 6 }, (_, i) => <div key={i} className="h-[52px] animate-pulse rounded-[14px] bg-[#F2F4F6]" />)
                  : items.map((it, i) => {
                      const on = trimmed === it.nickname && animalIndex(photo) === animalIndex(it.avatarUrl);
                      return (
                        <motion.button
                          key={`${round}-${it.nickname}`}
                          type="button"
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: loading ? 0.5 : 1, y: 0 }}
                          transition={{ delay: i * 0.05, type: 'spring', stiffness: 420, damping: 32 }}
                          whileTap={{ scale: 0.96 }}
                          onClick={() => { setNickname(it.nickname); setPhoto(it.avatarUrl); if (error) setError(''); }}
                          className="flex min-w-0 items-center gap-2 rounded-[14px] border-[1.5px] px-2.5 py-2 text-left transition-colors"
                          style={{ borderColor: on ? '#3182F6' : '#E5E8EB', backgroundColor: on ? '#EDF4FF' : '#fff' }}
                        >
                          <Face src={it.avatarUrl} size={34} />
                          <span className={`min-w-0 truncate text-[14px] font-semibold tracking-[-0.3px] ${on ? 'text-[#3182F6]' : 'text-[#333D4B]'}`}>{it.nickname}</span>
                        </motion.button>
                      );
                    })}
              </div>

              {/* 사진 고르기 — 원래 사진 + 동물 친구 20종 */}
              <p className="mt-6 text-[15px] font-semibold text-[#4E5968]">사진</p>
              <div className="-mx-6 mt-2.5 flex gap-2.5 overflow-x-auto px-6 pb-1" style={{ scrollbarWidth: 'none' }}>
                {[null, ...AVATAR_ANIMALS.map((_, i) => animalSrc(i))].map((src) => {
                  const on = src === null ? photo === null : animalIndex(photo) === animalIndex(src);
                  return (
                    <motion.button
                      key={src || 'original'}
                      type="button"
                      whileTap={{ scale: 0.9 }}
                      onClick={() => setPhoto(src)}
                      aria-label={src ? '동물 친구 사진' : '원래 사진'}
                      aria-pressed={on}
                      className="shrink-0 rounded-full p-[2px] transition-shadow"
                      style={{ boxShadow: on ? '0 0 0 2px #3182F6' : 'none' }}
                    >
                      <Face src={src === null ? originalPhoto : src} size={44} />
                    </motion.button>
                  );
                })}
              </div>

              <p className={`mt-3 text-[13px] leading-5 ${error ? 'text-[#F04452]' : 'text-[#8B95A1]'}`}>
                {error || '운영진이나 사회자로 보일 수 있는 이름은 쓸 수 없어요'}
              </p>
              <div className="ft-actions">
                <button type="button" className="ft-btn secondary" onClick={onClose} disabled={saving}>취소</button>
                <button type="button" className="ft-btn primary" onClick={save} disabled={!valid || saving}>{saving ? '저장 중' : '저장'}</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </MotionConfig>,
    document.body,
  );
}

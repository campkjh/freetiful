'use client';

// 운영진 에디터 이름·사진 바꾸기 시트(261001 사장 '그 닉네임 바꿀 수 있게') — '올릴 이름' 메뉴의 에디터 줄 ✎ 에서 연다(허용 계정만).
//  · 이름은 자유(2~16자, '프리티풀' 안 붙임 — 261001 사장) · 대신 에디터 글·댓글엔 늘 '운영진' 표시가 붙는다(서버 mapAuthors).
//    회원·예비부부·사회자로 보이는 말, 회원 닉네임('꾸밈말 동물') 모양은 서버가 막는다.
//  · 사진은 동물 친구 20종 중에서(지금 사진 그대로도 가능).
//  · 서버가 바꾸기 직전 이름을 그 에디터의 예전 글·댓글에 박아 두므로, 바꿔도 예전 글은 그때 이름 그대로 보인다.
//  · 모양·움직임은 웨딩숲 프로필 시트(IdentitySheet)와 같다 — body portal · 뒤 화면 잠금 · 스프링.
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, MotionConfig, motion } from 'framer-motion';
import { useBodyScrollLock } from '@/lib/hooks/useBodyScrollLock';
import { renameEditor, type MyNickname } from '@/lib/community/my-nickname';
import { AVATAR_ANIMALS } from '@/lib/community/nickname';

const animalSrc = (i: number) => `/images/avatars/animal-${String(i + 1).padStart(2, '0')}.webp`;
/** 동물 친구 사진 주소 → 번호(0~19), 아니면 -1 */
const animalIndex = (url?: string | null) => {
  const m = /\/images\/avatars\/animal-(\d{2})\.webp$/.exec(url || '');
  return m ? Number(m[1]) - 1 : -1;
};

function Face({ src, size }: { src?: string | null; size: number }) {
  return (
    <span className="flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#F2F4F6]" style={{ width: size, height: size }}>
      {src && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" draggable={false} />
      )}
    </span>
  );
}

export type EditorPersona = { id: string; name: string; avatar: string | null };

export default function EditorNameSheet({
  editor,
  onClose,
  onSaved,
}: {
  /** 고칠 에디터 — null 이면 닫힘 */
  editor: EditorPersona | null;
  onClose: () => void;
  onSaved: (next: MyNickname) => void;
}) {
  const open = !!editor;
  const [rest, setRest] = useState('');
  /** 고른 동물 친구 사진 — null = 지금 사진 그대로 */
  const [photo, setPhoto] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  // 닫히는 동안에도 마지막 에디터 모습을 그대로 보여 준다(내용이 먼저 사라지면 덜컥거림)
  const [shown, setShown] = useState<EditorPersona | null>(null);
  useBodyScrollLock(open);

  useEffect(() => {
    if (!editor) return;
    setShown(editor);
    setRest(editor.name);
    setPhoto(null);
    setError('');
  }, [editor]);

  const trimmed = rest.replace(/\s+/g, ' ').trim();
  const valid = trimmed.length >= 2 && trimmed.length <= 16;
  const facePhoto = photo || shown?.avatar || null;

  const save = async () => {
    if (!editor || !valid || saving) return;
    setSaving(true);
    setError('');
    try {
      const next = await renameEditor(editor.id, trimmed, photo || undefined);
      onSaved(next);
      onClose();
    } catch (e: any) {
      const m = e?.response?.data?.message;
      setError((Array.isArray(m) ? m[0] : m) || '저장하지 못했어요');
    } finally {
      setSaving(false);
    }
  };

  if (typeof document === 'undefined') return null;
  return createPortal(
    <MotionConfig reducedMotion="user">
      <AnimatePresence>
        {open && shown && (
          <motion.div
            key="editor-name-scrim"
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
              aria-label="에디터 이름 바꾸기"
              style={{ animation: 'none', overscrollBehavior: 'contain' }}
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%', transition: { duration: 0.26, ease: [0.4, 0, 1, 1] } }}
              transition={{ type: 'spring', stiffness: 380, damping: 36, mass: 0.9 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="ft-grab" aria-hidden="true" />
              <h2 className="ft-title">에디터 이름 바꾸기</h2>
              <p className="ft-desc">이름 옆에 &lsquo;운영진&rsquo; 표시가 붙어 운영진 글로 보여요. 바꿔도 예전 글과 댓글은 그때 이름 그대로예요.</p>

              {/* 지금 고른 모습 — 사진 · 이름 + '운영진' 표시 */}
              <div className="mt-5 flex items-center gap-3">
                <motion.span key={facePhoto || 'none'} initial={{ scale: 0.8, opacity: 0.4 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 460, damping: 26 }}>
                  <Face src={facePhoto} size={56} />
                </motion.span>
                <label className="flex h-14 min-w-0 flex-1 cursor-text items-center gap-2 rounded-[17px] border-[1.5px] border-[#E5E8EB] bg-white pl-[18px] pr-3.5 transition-colors focus-within:border-[#3182F6]">
                  <input
                    className="min-w-0 flex-1 bg-transparent text-[17px] tracking-[-0.3px] text-[#191F28] outline-none placeholder:text-[#B0B8C1]"
                    value={rest}
                    maxLength={16}
                    placeholder="에디터 이름 (2~16자)"
                    aria-label="에디터 이름"
                    onChange={(e) => { setRest(e.target.value); if (error) setError(''); }}
                    onKeyDown={(e) => { if (e.key === 'Enter') save(); }}
                  />
                  <span className="shrink-0 text-[13px] font-semibold text-[#3182F6]">운영진</span>
                </label>
              </div>

              {/* 사진 고르기 — 지금 사진 + 동물 친구 20종 */}
              <p className="mt-6 text-[15px] font-semibold text-[#4E5968]">사진</p>
              <div className="-mx-6 mt-2.5 flex gap-2.5 overflow-x-auto px-6 pb-1" style={{ scrollbarWidth: 'none' }}>
                {[null, ...AVATAR_ANIMALS.map((_, i) => animalSrc(i))].map((src) => {
                  const on = src === null ? photo === null : animalIndex(photo) === animalIndex(src);
                  return (
                    <motion.button
                      key={src || 'current'}
                      type="button"
                      whileTap={{ scale: 0.9 }}
                      onClick={() => setPhoto(src)}
                      aria-label={src ? '동물 친구 사진' : '지금 사진 그대로'}
                      aria-pressed={on}
                      className="shrink-0 rounded-full p-[2px] transition-shadow"
                      style={{ boxShadow: on ? '0 0 0 2px #3182F6' : 'none' }}
                    >
                      <Face src={src === null ? shown.avatar : src} size={44} />
                    </motion.button>
                  );
                })}
              </div>

              <p className={`mt-3 text-[13px] leading-5 ${error ? 'text-[#F04452]' : 'text-[#8B95A1]'}`}>
                {error || "회원·예비부부·사회자로 보이는 말, 회원 닉네임 같은 '꾸밈말 + 동물' 이름은 쓸 수 없어요"}
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

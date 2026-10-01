'use client';

// 웨딩숲 '올릴 이름' 메뉴(허용 계정, 260930) — 내 웨딩숲 프로필 / 운영진 에디터 이름들(프리티풀 에디터 …) + 내 닉네임·사진 바꾸기.
//  · 에디터 이름엔 '프리티풀'이 붙어 운영진 글로 보인다. 실제로 쓴 계정은 서버가 따로 기록(postedById)해 고치기·지우기는 그대로 된다.
//  · 토스 팝 메뉴(globals .pop-menu.nt-menu) — 작게 시작해 커지고 줄은 차례로. 바깥을 누르거나 화면이 움직이면 닫힌다.
//  · 메뉴는 body 로 띄운다 — 글쓰기 칸(펼침 칸 overflow hidden)·댓글 시트 안에서 잘리지 않게.
//  · 에디터 줄 오른쪽 ✎ = 에디터 이름·사진 바꾸기(EditorNameSheet, 261001) — '프리티풀'은 고정, 바꿔도 예전 글은 그때 이름.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { popItemDelay } from '@/lib/pop-menu';
import type { MyNickname } from '@/lib/community/my-nickname';
import { useCommunityPersona } from '@/lib/community/persona-store';
import EditorNameSheet, { type EditorPersona } from './EditorNameSheet';

/** 지금 고른 에디터(목록에 없으면 null = 내 프로필) */
export function useActiveEditor(identity: MyNickname | null) {
  const editorId = useCommunityPersona((s) => s.editorId);
  return identity?.editors?.find((e) => e.id === editorId) || null;
}

const MENU_W = 300;

export default function PersonaPicker({
  identity,
  className,
  children,
  onEditProfile,
  onIdentityUpdated,
  label = '올릴 이름 고르기',
}: {
  identity: MyNickname;
  className?: string;
  children: ReactNode;
  onEditProfile: () => void;
  /** 에디터 이름·사진을 바꾼 뒤 새 목록(부모가 들고 있는 identity 를 갈아 끼운다) */
  onIdentityUpdated?: (next: MyNickname) => void;
  label?: string;
}) {
  const [pos, setPos] = useState<{ top: number; left: number; up: boolean } | null>(null);
  const [editing, setEditing] = useState<EditorPersona | null>(null);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const editorId = useCommunityPersona((s) => s.editorId);
  const setEditorId = useCommunityPersona((s) => s.setEditorId);
  const open = !!pos;

  // 단추 자리에 맞춘 메뉴 위치 — 위/아래 방향은 열 때 한 번 정하고, 화면이 움직이면(키보드가 닫히는 등) 단추를 따라간다
  const place = (keepUp?: boolean) => {
    const r = btnRef.current?.getBoundingClientRect();
    if (!r) return null;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const left = Math.max(12, Math.min(r.left - 8, vw - MENU_W - 12));
    // 아래 자리가 모자라면(댓글 칸은 화면 아래) 위로 연다
    const up = keepUp ?? (vh - r.bottom < 380 && r.top > vh - r.bottom);
    return { top: up ? r.top - 6 : r.bottom + 6, left, up };
  };
  const toggle = () => setPos(open ? null : place());

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (menuRef.current?.contains(t) || btnRef.current?.contains(t)) return;
      setPos(null);
    };
    const follow = () => setPos((cur) => (cur ? place(cur.up) : cur));
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setPos(null); };
    document.addEventListener('pointerdown', onDown, true);
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', follow);
    window.addEventListener('scroll', follow, true);
    return () => {
      document.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', follow);
      window.removeEventListener('scroll', follow, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const options = [
    { id: null as string | null, name: identity.nickname, avatar: identity.avatar, sub: '내 웨딩숲 프로필' },
    ...(identity.editors || []).map((e) => ({ id: e.id as string | null, name: e.name, avatar: e.avatar, sub: '운영진 이름' })),
  ];
  const activeId = identity.editors?.some((e) => e.id === editorId) ? editorId : null;

  return (
    <>
      <button ref={btnRef} type="button" className={className} onClick={toggle} aria-haspopup="menu" aria-expanded={open} aria-label={label}>
        {children}
      </button>
      {pos && createPortal(
        <div
          ref={menuRef}
          className="pop-menu nt-menu fixed z-[400] overflow-hidden"
          style={{
            left: pos.left,
            width: MENU_W,
            ...(pos.up ? { bottom: window.innerHeight - pos.top } : { top: pos.top }),
            transformOrigin: pos.up ? '28px 100%' : '28px 0',
          }}
          role="menu"
          aria-label="올릴 이름"
        >
          <p className="px-5 pb-1 pt-1.5 text-[13px] font-semibold tracking-[-0.2px] text-[#8B95A1]">올릴 이름</p>
          {options.map((o, i) => {
            const on = o.id === activeId;
            const editor = o.id ? identity.editors?.find((e) => e.id === o.id) : null;
            return (
              <div key={o.id || 'me'} className="pop-menu-item flex items-center pr-2.5" style={popItemDelay(i)}>
                <button
                  type="button"
                  role="menuitemradio"
                  aria-checked={on}
                  onClick={() => { setEditorId(o.id); setPos(null); }}
                  className={`flex min-w-0 flex-1 items-center gap-3 rounded-[14px] py-2 pl-5 text-left transition-colors active:bg-[#F2F4F6] [@media(hover:hover)]:hover:bg-[#F9FAFB] ${editor ? 'pr-1' : 'pr-2.5'}`}
                >
                  <span className="h-8 w-8 shrink-0 overflow-hidden rounded-full bg-[#F2F4F6]">
                    {o.avatar && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={o.avatar} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate text-[16px] leading-[22px] tracking-[-0.3px] ${on ? 'font-bold text-[#191F28]' : 'font-semibold text-[#333D4B]'}`}>{o.name}</span>
                    <span className="block text-[13px] leading-[18px] tracking-[-0.2px] text-[#8B95A1]">{o.sub}</span>
                  </span>
                  {on && (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="shrink-0">
                      <path d="M5 12.5l4.2 4.2L19 7" stroke="#3182F6" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>
                {editor && (
                  <button
                    type="button"
                    onClick={() => { setPos(null); setEditing(editor); }}
                    aria-label={`${editor.name} 이름 바꾸기`}
                    className="ml-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#8B95A1] transition-colors active:bg-[#F2F4F6] [@media(hover:hover)]:hover:bg-[#F2F4F6] [@media(hover:hover)]:hover:text-[#4E5968]"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M4 20h4L18.5 9.5a2.12 2.12 0 0 0-3-3L5 17v3z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                      <path d="M13.5 8.5l2 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  </button>
                )}
              </div>
            );
          })}
          <div className="nt-menu-sep" />
          <button
            type="button"
            onClick={() => { setPos(null); onEditProfile(); }}
            className="pop-menu-item flex w-full items-center gap-2 px-5 py-2.5 text-left text-[15px] font-semibold tracking-[-0.2px] text-[#3182F6] transition-colors active:bg-[#F2F4F6] [@media(hover:hover)]:hover:bg-[#F9FAFB]"
            style={popItemDelay(options.length)}
          >
            <span aria-hidden>✦</span> 내 닉네임·사진 바꾸기
          </button>
        </div>,
        document.body,
      )}
      <EditorNameSheet editor={editing} onClose={() => setEditing(null)} onSaved={(next) => onIdentityUpdated?.(next)} />
    </>
  );
}

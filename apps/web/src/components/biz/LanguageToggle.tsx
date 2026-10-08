'use client';

import { popItemDelay } from '@/lib/pop-menu';
import { useState, useRef, useEffect } from 'react';
import { Globe } from 'lucide-react';
import { BIZ_LANGS, useBizLang } from '@/lib/biz/i18n';

/**
 * KO | EN 작은 알약(261009 사장 '프리티풀로 좌측엔 영어 한국어 번역 탭') — 비즈 머리줄(BizHeader) 오른쪽, '비즈 · 프리티풀로' 글자 탭 왼쪽.
 * 바탕 #F2F4F6 알약 안에서 고른 칸만 흰 바탕 + 굵게 — 흰 칸(엄지)이 두 칸 사이를 미끄러져 옮겨 간다(줄인 움직임이면 바로).
 * 드롭다운(아래 LanguageToggle)은 4개 언어 · 이건 두 개만: 머리줄 한 줄에 로고 · 알약 · 글자 탭이 360 폭에서도 들어가야 해서.
 * 예전에 일본어 · 중국어를 골라 둔 손님(localStorage biz-lang)은 두 칸 다 안 고른 모양으로 보이고, 누르면 그 언어로 바뀐다.
 */
export function BizLangPill({ className = '' }: { className?: string }) {
  const { lang, setLang } = useBizLang();
  const idx = lang === 'ko' ? 0 : lang === 'en' ? 1 : -1;
  const opts = [
    { code: 'ko' as const, label: 'KO', name: '한국어' },
    { code: 'en' as const, label: 'EN', name: 'English' },
  ];
  return (
    <div role="group" aria-label="언어 · Language" className={`relative flex h-[30px] shrink-0 items-center rounded-full bg-[#F2F4F6] p-[3px] ${className}`}>
      {/* 엄지 — 칸 폭(32)만큼 옮긴다. 살짝 튕기는 감속(머리줄 CTA 와 같은 결) */}
      <span
        aria-hidden
        className="absolute left-[3px] top-[3px] h-[24px] w-8 rounded-full bg-white shadow-[0_1px_3px_rgba(0,23,51,0.12)] transition-[transform,opacity] duration-[380ms] ease-[cubic-bezier(0.34,1.36,0.64,1)] motion-reduce:transition-none"
        style={{ transform: `translateX(${idx === 1 ? 32 : 0}px)`, opacity: idx < 0 ? 0 : 1 }}
      />
      {opts.map((o) => {
        const on = lang === o.code;
        return (
          <button
            key={o.code}
            type="button"
            lang={o.code}
            aria-pressed={on}
            aria-label={o.name}
            onClick={() => setLang(o.code)}
            className={`relative z-[1] flex h-[24px] w-8 items-center justify-center rounded-full text-[12px] leading-none tracking-[-0.1px] transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3182F6]/40 ${
              on ? 'font-bold text-[#191F28]' : 'font-semibold text-[#8B95A1] hover:text-[#4E5968]'
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * 비즈 페이지 헤더 내부에서 사용하는 언어 토글.
 * 인라인 배치 — 버튼 클릭 시 아래로 드롭다운 열림.
 * tone='light' = 어두운 첫 화면(영상) 위 흰 글자(261008 비즈 개편) · 'inherit' = 머리줄 글자색을 따른다(토스식 머리줄이 밝기를 정함)
 * placement='up' = 화면 아래쪽(모바일 메뉴 바닥)에 둘 때 위로 열림. 누르는 칸은 42px 높이(햄버거와 같은 크기 — 32px 은 옆 단추와 헷갈려 잘못 눌렸다)
 */
export default function LanguageToggle({ tone = 'dark', placement = 'down' }: { tone?: 'dark' | 'light' | 'inherit'; placement?: 'down' | 'up' }) {
  const [open, setOpen] = useState(false);
  const { lang, setLang } = useBizLang();
  const ref = useRef<HTMLDivElement>(null);
  const currentShort = BIZ_LANGS.find((l) => l.code === lang)?.short || '한';

  // 외부 클릭 시 닫힘
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={`flex min-h-[42px] items-center gap-1.5 px-3 py-2 rounded-full transition-colors ${tone === 'light' ? 'text-white hover:bg-white/10' : tone === 'inherit' ? 'text-inherit hover:bg-current/10' : 'text-gray-700 hover:bg-gray-100'}`}
        aria-label="Language"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <Globe size={15} />
        <span className="text-[12px] font-bold">{currentShort}</span>
      </button>
      {open && (
        <div
          role="menu"
          className={`pop-menu absolute min-w-[150px] overflow-hidden py-1.5 z-[70] ${placement === 'up' ? 'bottom-full left-0 mb-2' : 'top-full right-0 mt-2'}`}
          style={{ transformOrigin: placement === 'up' ? 'bottom left' : 'top right' }}
        >
          {BIZ_LANGS.map((l, i) => (
            <button
              key={l.code}
              role="menuitem"
              onClick={() => {
                setLang(l.code);
                setOpen(false);
              }}
              className={`pop-menu-item w-full text-left px-4 py-2.5 text-[13px] hover:bg-gray-50 flex items-center justify-between ${
                lang === l.code ? 'text-[#3180F7] font-bold' : 'text-gray-700'
              }`}
              style={popItemDelay(i)}
            >
              <span>{l.label}</span>
              <span className="text-[11px] text-gray-400">{l.short}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

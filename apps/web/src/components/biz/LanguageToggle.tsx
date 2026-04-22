'use client';

import { useState, useRef, useEffect } from 'react';
import { Globe } from 'lucide-react';
import { BIZ_LANGS, useBizLang } from '@/lib/biz/i18n';

/**
 * 비즈 페이지 헤더 내부에서 사용하는 언어 토글.
 * 인라인 배치 — 버튼 클릭 시 아래로 드롭다운 열림.
 */
export default function LanguageToggle() {
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
        className="flex items-center gap-1.5 px-3 py-2 rounded-full text-gray-700 hover:bg-gray-100 transition-colors"
        aria-label="Language"
      >
        <Globe size={15} />
        <span className="text-[12px] font-bold">{currentShort}</span>
      </button>
      {open && (
        <div className="absolute top-full right-0 mt-2 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden min-w-[140px] z-[70]">
          {BIZ_LANGS.map((l) => (
            <button
              key={l.code}
              onClick={() => {
                setLang(l.code);
                setOpen(false);
              }}
              className={`w-full text-left px-4 py-2.5 text-[13px] hover:bg-gray-50 flex items-center justify-between ${
                lang === l.code ? 'text-[#3180F7] font-bold' : 'text-gray-700'
              }`}
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

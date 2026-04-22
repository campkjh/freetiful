'use client';

import { useState } from 'react';
import { Globe } from 'lucide-react';
import { BIZ_LANGS, useBizLang } from '@/lib/biz/i18n';

export default function LanguageToggle() {
  const [open, setOpen] = useState(false);
  const { lang, setLang } = useBizLang();
  const currentShort = BIZ_LANGS.find((l) => l.code === lang)?.short || '한';

  return (
    <div className="fixed bottom-6 right-6 z-[60]">
      <div className="relative">
        {open && (
          <div className="absolute bottom-full right-0 mb-2 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden min-w-[140px]">
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
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-full px-3.5 py-2.5 shadow-md hover:shadow-lg transition-shadow"
          aria-label="Language"
        >
          <Globe size={16} className="text-gray-700" />
          <span className="text-[13px] font-bold text-gray-800">{currentShort}</span>
        </button>
      </div>
    </div>
  );
}

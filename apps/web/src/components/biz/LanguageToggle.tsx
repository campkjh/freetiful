'use client';

import { useEffect, useState } from 'react';
import { Globe } from 'lucide-react';

const LANGS = [
  { code: 'ko', label: '한국어', short: '한' },
  { code: 'en', label: 'English', short: 'EN' },
  { code: 'ja', label: '日本語', short: 'JA' },
  { code: 'zh-CN', label: '中文', short: '中' },
] as const;

declare global {
  interface Window {
    googleTranslateElementInit?: () => void;
    google?: any;
  }
}

export default function LanguageToggle() {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState<(typeof LANGS)[number]['code']>('ko');

  // Google Translate 초기화 — 한 번만
  useEffect(() => {
    if (document.getElementById('gt-script')) return;

    window.googleTranslateElementInit = () => {
      new window.google.translate.TranslateElement(
        {
          pageLanguage: 'ko',
          includedLanguages: 'en,ja,zh-CN',
          autoDisplay: false,
        },
        'google_translate_element',
      );
    };

    const s = document.createElement('script');
    s.id = 'gt-script';
    s.src = '//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
    s.async = true;
    document.body.appendChild(s);

    // 쿠키로부터 현재 언어 복원
    const cookie = document.cookie.split('; ').find((c) => c.startsWith('googtrans='));
    if (cookie) {
      const match = cookie.match(/googtrans=\/ko\/(en|ja|zh-CN)/);
      if (match) setCurrent(match[1] as any);
    }
  }, []);

  const changeLang = (code: (typeof LANGS)[number]['code']) => {
    setOpen(false);
    setCurrent(code);

    // 쿠키 설정 — 현재 경로 + 루트 도메인 양쪽
    const host = window.location.hostname;
    const rootHost = host.split('.').slice(-2).join('.'); // freetiful.com

    if (code === 'ko') {
      // 쿠키 삭제 (원본 언어 복귀)
      document.cookie = 'googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/';
      document.cookie = `googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=${host}`;
      document.cookie = `googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=.${rootHost}`;
    } else {
      const value = `/ko/${code}`;
      document.cookie = `googtrans=${value}; path=/`;
      document.cookie = `googtrans=${value}; path=/; domain=${host}`;
      document.cookie = `googtrans=${value}; path=/; domain=.${rootHost}`;
    }
    window.location.reload();
  };

  const currentLabel = LANGS.find((l) => l.code === current)?.short || '한';

  return (
    <>
      {/* Google Translate 위젯 호스트 — 숨김 */}
      <div id="google_translate_element" style={{ position: 'absolute', visibility: 'hidden', pointerEvents: 'none', height: 0, overflow: 'hidden' }} />

      {/* Google 기본 상단 배너 / 하이라이트 제거 */}
      <style jsx global>{`
        .goog-te-banner-frame.skiptranslate { display: none !important; }
        .goog-te-gadget { height: 0; overflow: hidden; }
        body { top: 0 !important; }
        .goog-tooltip, .goog-tooltip:hover { display: none !important; }
        .goog-text-highlight { background-color: transparent !important; box-shadow: none !important; }
      `}</style>

      {/* 플로팅 언어 버튼 (우측 하단, 비즈 페이지 내부 배너 가리지 않게) */}
      <div className="fixed bottom-6 right-6 z-[60]">
        <div className="relative">
          {open && (
            <div className="absolute bottom-full right-0 mb-2 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden min-w-[140px]">
              {LANGS.map((l) => (
                <button
                  key={l.code}
                  onClick={() => changeLang(l.code)}
                  className={`w-full text-left px-4 py-2.5 text-[13px] hover:bg-gray-50 flex items-center justify-between ${
                    current === l.code ? 'text-[#3180F7] font-bold' : 'text-gray-700'
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
            className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-full px-3.5 py-2.5 shadow-md hover:shadow-lg transition-shadow notranslate"
            aria-label="언어 변경"
          >
            <Globe size={16} className="text-gray-700" />
            <span className="text-[13px] font-bold text-gray-800">{currentLabel}</span>
          </button>
        </div>
      </div>
    </>
  );
}

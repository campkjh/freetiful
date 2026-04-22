'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export const BIZ_LANGS = [
  { code: 'ko', label: '한국어', short: '한' },
  { code: 'en', label: 'English', short: 'EN' },
  { code: 'ja', label: '日本語', short: 'JA' },
  { code: 'zh', label: '中文', short: '中' },
] as const;

export type BizLangCode = (typeof BIZ_LANGS)[number]['code'];

type Ctx = {
  lang: BizLangCode;
  setLang: (c: BizLangCode) => void;
};

const BizLangContext = createContext<Ctx>({ lang: 'ko', setLang: () => {} });

const STORAGE_KEY = 'biz-lang';

export function BizLangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<BizLangCode>('ko');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const saved = localStorage.getItem(STORAGE_KEY) as BizLangCode | null;
    if (saved && BIZ_LANGS.some((l) => l.code === saved)) setLangState(saved);
  }, []);

  const setLang = (c: BizLangCode) => {
    setLangState(c);
    try {
      localStorage.setItem(STORAGE_KEY, c);
    } catch {}
  };

  return <BizLangContext.Provider value={{ lang, setLang }}>{children}</BizLangContext.Provider>;
}

export function useBizLang() {
  return useContext(BizLangContext);
}

/**
 * Translation helper: pass an object keyed by language.
 * Missing keys fallback to Korean (original).
 *   const title = useT({ ko: '회사소개', en: 'About', ja: '会社紹介', zh: '公司简介' });
 */
export type Translations<T = string> = { ko: T; en?: T; ja?: T; zh?: T };

/**
 * Returns a translator function that picks the right language.
 *   const t = useT();
 *   <h1>{t({ ko: '회사소개', en: 'About', ja: '会社紹介', zh: '公司简介' })}</h1>
 */
export function useT() {
  const { lang } = useBizLang();
  return <T = string>(tr: Translations<T>): T => (tr[lang] ?? tr.ko) as T;
}

/** Non-hook version — pass lang directly */
export function getT<T = string>(t: Translations<T>, lang: BizLangCode): T {
  return (t[lang] ?? t.ko) as T;
}

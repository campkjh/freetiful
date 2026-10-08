import { BizHtmlLang, BizLangProvider } from '@/lib/biz/i18n';
import BizTabBar from '@/components/biz/BizTabBar';

export default function BizLayout({ children }: { children: React.ReactNode }) {
  return (
    <BizLangProvider>
      {/* html lang = 비즈 언어(비즈 모든 화면 — 일 · 중 한자 글자꼴 · 줄바꿈 규칙) */}
      <BizHtmlLang />
      {children}
      {/* 모바일 하단 탭바(홈 · 뉴스·소식 · 문의하기 · 기업소개, 261008 사장) — 비즈 모든 화면 공통이라 여기서 한 번만.
          맨 아래 내용이 탭바에 가리지 않게 하는 빈칸도 탭바가 화면별로 같이 둔다 */}
      <BizTabBar />
    </BizLangProvider>
  );
}

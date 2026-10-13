import { BizHtmlLang, BizLangProvider } from '@/lib/biz/i18n';
import BizTabBar from '@/components/biz/BizTabBar';
import BizInquiryModalHost from '@/components/biz/BizInquiryModalHost';

export default function BizLayout({ children }: { children: React.ReactNode }) {
  return (
    <BizLangProvider>
      {/* html lang = 비즈 언어(비즈 모든 화면 — 일 · 중 한자 글자꼴 · 줄바꿈 규칙) */}
      <BizHtmlLang />
      {children}
      {/* 모바일 하단 탭바(홈 · 뉴스·소식 · 문의하기 · 기업소개, 261008 사장) — 비즈 모든 화면 공통이라 여기서 한 번만.
          맨 아래 내용이 탭바에 가리지 않게 하는 빈칸도 탭바가 화면별로 같이 둔다 */}
      <BizTabBar />
      {/* PC 상담 팝업(261013 사장 'pc버전에서 비즈 문의클릭하면 페이지로 이동하는게 아닌 팝업이 나오게끔') — PC 폭에서 '비즈문의' · 문의 CTA 를 누르면
          /biz/inquiry 로 넘어가지 않고 이 화면 위에 상담 채팅 팝업. 폰은 예전처럼 화면 이동. 비즈 모든 화면 공통이라 여기서 한 번만 */}
      <BizInquiryModalHost />
    </BizLangProvider>
  );
}

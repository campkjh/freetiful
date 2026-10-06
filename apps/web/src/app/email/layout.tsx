import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '이메일로 시작하기 | 프리티풀',
  description: '이메일로 프리티풀에 가입하거나 로그인해요.',
  robots: { index: false, follow: false },
};

/** 이메일 가입·로그인 — 퀵매칭처럼 하단 탭 없는 단독 화면(앱 네이티브 탭바도 숨는다) */
export default function EmailLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* 퀵매칭과 같은 Pretendard */}
      <link
        rel="stylesheet"
        href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
      />
      {children}
    </>
  );
}

import type { Metadata } from 'next';
import { Toaster, ToastBar } from 'react-hot-toast';
import Providers from './providers';
import './globals.css';

export const metadata: Metadata = {
  title: 'Freetiful — 나의 특별한 행사를 완성하는 전문가',
  description: '웨딩, 생일, 돌잔치 등 모든 행사의 MC, 가수, 쇼호스트를 한 번에',
  keywords: ['MC', '웨딩MC', '행사진행', '결혼식MC', '이벤트전문가'],
  openGraph: {
    title: 'Freetiful',
    description: '나의 특별한 행사를 완성하는 전문가',
    locale: 'ko_KR',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css"
        />
      </head>
      <body className="font-sans bg-white text-gray-900 antialiased overflow-x-hidden">
        <Providers>
          {children}
          <Toaster
            position="top-center"
            containerStyle={{ top: 24 }}
            toastOptions={{
              duration: 2200,
              style: {
                fontFamily: 'Pretendard, sans-serif',
                background: 'rgba(255, 255, 255, 0.7)',
                color: '#1f2937',
                fontSize: '14px',
                fontWeight: 600,
                padding: '12px 22px',
                borderRadius: '9999px',
                border: '1px solid rgba(255, 255, 255, 0.5)',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
                backdropFilter: 'blur(20px) saturate(180%)',
                WebkitBackdropFilter: 'blur(20px) saturate(180%)',
                maxWidth: 'none',
                minHeight: 'auto',
              },
              success: { icon: null },
              error: { icon: null, style: { color: '#dc2626' } },
              loading: { icon: null },
            }}
          >
            {(t) => (
              <div
                style={{
                  animation: t.visible
                    ? 'toastBounceIn 0.55s cubic-bezier(0.34, 1.56, 0.64, 1) forwards'
                    : 'toastBounceOut 0.35s cubic-bezier(0.7, 0, 0.84, 0) forwards',
                }}
              >
                <ToastBar
                  toast={t}
                  style={{
                    ...t.style,
                    animation: 'none',
                  }}
                />
              </div>
            )}
          </Toaster>
        </Providers>
      </body>
    </html>
  );
}

'use client';

import { Toaster, ToastBar } from 'react-hot-toast';

export default function AppToaster() {
  return (
    <Toaster
      position="top-center"
      containerStyle={{ top: 24 }}
      toastOptions={{
        duration: 2200,
        style: {
          fontFamily: 'Pretendard, sans-serif',
          background: 'rgba(255, 255, 255, 0.92)',
          color: '#2B313D',
          fontSize: '14px',
          fontWeight: 700,
          lineHeight: 1.35,
          padding: '13px 18px',
          borderRadius: '20px',
          border: '0.6px solid rgba(229, 233, 240, 0.9)',
          boxShadow: '0 18px 42px rgba(15, 23, 42, 0.14)',
          backdropFilter: 'blur(18px) saturate(1.25)',
          WebkitBackdropFilter: 'blur(18px) saturate(1.25)',
          maxWidth: 'calc(100vw - 32px)',
          minHeight: 'auto',
        },
        success: { icon: null },
        error: { icon: null, style: { color: '#E5484D' } },
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
  );
}

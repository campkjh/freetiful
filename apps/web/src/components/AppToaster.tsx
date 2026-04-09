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
  );
}

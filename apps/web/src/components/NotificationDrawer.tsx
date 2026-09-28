'use client';

import { useEffect, useRef, useState } from 'react';
import NotificationsView from '@/components/notifications/NotificationsView';

/**
 * PC 헤더의 알림 서랍 — 홈을 그대로 두고 오른쪽만 덮는다(예전엔 종을 누르면 /notifications 전체 화면으로 넘어가 보던 화면이 사라졌다).
 * 260928 사장 '알림 UI 도 모바일이랑 동일한 UI·인터랙션': 서랍 안은 모바일 알림 화면(NotificationsView) 그대로 —
 * '알림 ⌄' 거르기·모두 읽음·전체 삭제, 새 알림 파란 바탕 + 지난 알림, 같은 곳 'N건' 묶음, 밀어서 삭제, 제목 페이드·줄 순차 슬라이드.
 * 열 때마다 새로 그려 등장 애니가 다시 돌고, 닫을 땐 밀려 나가는 동안(300ms) 내용을 둔다.
 */
export default function NotificationDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(open);

  useEffect(() => {
    if (open) {
      setMounted(true);
      scrollRef.current?.scrollTo({ top: 0 });
      return;
    }
    const t = window.setTimeout(() => setMounted(false), 320);
    return () => window.clearTimeout(t);
  }, [open]);

  // ESC 로 닫기
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <>
      {/* 딤 — 홈이 비쳐 보일 정도로만 */}
      <div
        data-notification-drawer
        onClick={onClose}
        className={`fixed inset-0 z-[60] bg-black/25 transition-opacity duration-300 ${
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        aria-hidden={!open}
      />
      <aside
        data-notification-drawer
        // 닫히면 슬라이드가 끝난 뒤 invisible — 화면 밖에 걸린 서랍 그림자가 모든 페이지 오른쪽 끝에 회색 띠로 번지던 것
        className={`fixed right-0 top-0 z-[61] flex h-full w-[420px] max-w-[92vw] flex-col bg-white shadow-[-12px_0_40px_rgba(15,23,42,0.12)] ease-out ${
          open
            ? 'visible translate-x-0 [transition:transform_300ms_cubic-bezier(0,0,0.2,1),visibility_0s]'
            : 'invisible translate-x-full [transition:transform_300ms_cubic-bezier(0,0,0.2,1),visibility_0s_linear_300ms]'
        }`}
        aria-hidden={!open}
        aria-label="알림"
      >
        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {mounted && <NotificationsView variant="drawer" onBack={onClose} onNavigate={onClose} scrollRootRef={scrollRef} />}
        </div>
      </aside>
    </>
  );
}

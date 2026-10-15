'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { QuickMatchBubbleGlass } from '@/components/home/TossBubble';
import AiIcon from '@/components/icons/AiIcon';
import { X } from './admin-icons';

export function AdminAiAnnouncement({ scope, used, onOpen, trigger }: {
  scope: string; used: boolean; onOpen: () => void; trigger: RefObject<HTMLButtonElement>;
}) {
  const storageKey = `ft-admin-ai-announcement-v1:${scope}`;
  const [phase, setPhase] = useState<'hidden' | 'in' | 'out'>('hidden');
  const [dismissed, setDismissed] = useState(false);
  const [width, setWidth] = useState(340);
  const wrap = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismiss = useCallback((restoreFocus = false) => {
    try { localStorage.setItem(storageKey, '1'); } catch { /* Remember for this mount if storage is blocked. */ }
    setDismissed(true);
    setPhase((current) => current === 'in' ? 'out' : 'hidden');
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setPhase('hidden'), 200);
    if (restoreFocus) trigger.current?.focus({ preventScroll: true });
  }, [storageKey, trigger]);

  useEffect(() => () => { if (closeTimer.current) clearTimeout(closeTimer.current); }, []);
  useEffect(() => { if (used) dismiss(); }, [used, dismiss]);
  useEffect(() => {
    if (used || dismissed) return;
    try { if (localStorage.getItem(storageKey)) return; } catch { /* The notice is still dismissible without storage. */ }
    const started = Date.now();
    let quietSince = 0;
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      const now = Date.now();
      const modalOpen = Array.from(document.querySelectorAll('dialog[open], [role="dialog"][aria-modal="true"]')).some((element) => {
        if (element.closest('[hidden], [aria-hidden="true"]')) return false;
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0
          && rect.bottom > 0 && rect.top < window.innerHeight && rect.right > 0 && rect.left < window.innerWidth;
      });
      const busy = document.hidden || modalOpen;
      if (busy) quietSince = 0;
      else if (!quietSince) quietSince = now;
      if (quietSince && now - quietSince >= 1_200) { setPhase('in'); return; }
      if (now - started < 120_000) timer = setTimeout(tick, 200);
    };
    timer = setTimeout(tick, 200);
    return () => clearTimeout(timer);
  }, [storageKey, used, dismissed]);

  useLayoutEffect(() => {
    const element = wrap.current;
    if (!element) return;
    const measure = () => setWidth(element.offsetWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [phase]);

  if (used || phase === 'hidden') return null;
  return <div ref={wrap} className="adm-ai-hint-wrap" onKeyDown={(event) => { if (event.key === 'Escape') { event.preventDefault(); dismiss(true); } }}>
    <div className={`qm-bubble biz adm-ai-announcement${phase === 'out' ? ' is-out' : ''}`} style={{ transformOrigin: `${width - 40}px 0` }} role="group" aria-label="새 AI 기능 안내">
      <span className="qm-bubble-shadow" aria-hidden="true" />
      <QuickMatchBubbleGlass tailX={width - 40} />
      <div className="qm-bubble-body">
        <button type="button" className="adm-ai-hint-open" aria-label="새로운 AI로 오늘 하루 요약 열기" onClick={() => { dismiss(); onOpen(); }} />
        <span className="qm-bubble-ic" aria-hidden="true"><AiIcon size={26} tile={false} /></span>
        <div role="status"><p className="qm-bubble-title">새로운 AI가 도착했어요</p><p className="qm-bubble-sub">오늘의 매출과 운영 흐름을 한눈에</p></div>
        <button type="button" className="qm-bubble-x" aria-label="AI 안내 말풍선 닫기" onClick={() => dismiss(true)}><X size={10} /></button>
      </div>
    </div>
  </div>;
}

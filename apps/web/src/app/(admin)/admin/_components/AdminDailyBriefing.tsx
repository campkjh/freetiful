'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import StyleIntroCard from '@/components/pros/StyleIntroCard';
import { adminFetch } from './adminFetch';
import { X, RefreshCw } from './admin-icons';
import { AdminAiOrb } from './AdminAiOrb';

type Metrics = { revenue: number; payments: number; requests: number; connected: number; visits: number; signups: number; inquiries: number; unresponded: number };
interface Briefing {
  date: string; generatedAt: string; expiresAt: string; source: 'ai' | 'rule'; summary: string; insights: string[];
  today: Metrics; previous: Metrics; pendingInquiries: number; pendingPros: number;
}
const timeLabel = (value: string) => new Date(value).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Seoul' });

export function AdminDailyBriefing({ hidden = false }: { hidden?: boolean }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<Briefing | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const request = useRef(0);
  const inflight = useRef(false);
  const reduced = useReducedMotion();

  const load = useCallback(async () => {
    if (inflight.current) return;
    inflight.current = true;
    const revision = ++request.current;
    setLoading(true); setError(false);
    try {
      const report = await adminFetch('GET', '/api/v1/admin/daily-briefing', undefined, { cache: false });
      if (!report?.today || !report.summary || !Array.isArray(report.insights) || !Number.isFinite(Date.parse(report.expiresAt))) throw new Error('Invalid briefing');
      if (request.current === revision) setData(report);
    } catch { if (request.current === revision) setError(true); }
    finally { if (request.current === revision) { setLoading(false); inflight.current = false; } }
  }, []);

  useEffect(() => () => { request.current += 1; }, []);
  useEffect(() => { if (hidden) setOpen(false); }, [hidden]);
  useEffect(() => {
    if (!open) return;
    const expired = !data || Date.parse(data.expiresAt) <= Date.now();
    if (expired) void load();
    const timer = data ? setTimeout(() => void load(), Math.max(30_000, Date.parse(data.expiresAt) - Date.now() + 2_000)) : undefined;
    const onFocus = () => { if (!document.hidden && (!data || Date.parse(data.expiresAt) <= Date.now())) void load(); };
    document.addEventListener('visibilitychange', onFocus);
    return () => { clearTimeout(timer); document.removeEventListener('visibilitychange', onFocus); };
  }, [open, data, load]);

  const close = useCallback((restoreFocus = false) => { setOpen(false); if (restoreFocus) trigger.current?.focus({ preventScroll: true }); }, []);
  useEffect(() => {
    if (!open) return;
    panel.current?.focus({ preventScroll: true });
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.preventDefault(); close(true); } };
    const outside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!panel.current?.contains(target) && !trigger.current?.contains(target)) close();
    };
    document.addEventListener('keydown', escape);
    document.addEventListener('pointerdown', outside);
    return () => { document.removeEventListener('keydown', escape); document.removeEventListener('pointerdown', outside); };
  }, [open, close]);

  if (hidden || typeof document === 'undefined') return null;
  const metrics = data ? [
    { label: '완료 매출', value: `${data.today.revenue.toLocaleString('ko-KR')}원`, key: 'revenue' },
    { label: '완료 결제', value: `${data.today.payments.toLocaleString('ko-KR')}건`, key: 'payments' },
    { label: '견적 의뢰', value: `${data.today.requests.toLocaleString('ko-KR')}건`, key: 'requests' },
    { label: '사회자 연결', value: `${data.today.connected.toLocaleString('ko-KR')}건`, key: 'connected' },
    { label: '방문 세션', value: `${data.today.visits.toLocaleString('ko-KR')}회`, key: 'visits' },
    { label: '신규 가입', value: `${data.today.signups.toLocaleString('ko-KR')}명`, key: 'signups' },
  ] : [];

  return createPortal(<div className="adm-ai-float">
    <AnimatePresence>
      {open && <motion.div ref={panel} id="admin-daily-briefing" role="dialog" aria-modal={false} aria-labelledby="admin-briefing-title" aria-busy={loading} tabIndex={-1} className="adm-ai-panel"
        initial={{ opacity: 0, y: 20, scale: 0.92 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12, scale: 0.96 }} transition={{ duration: reduced ? 0 : 0.4, ease: [0.22, 1, 0.36, 1] }}>
        <header className="adm-ai-head"><div><h2 id="admin-briefing-title">오늘 하루 요약</h2><p>{data ? `${data.date.slice(5).replace('-', '월 ')}일 · ${timeLabel(data.generatedAt)} 기준` : '오늘의 운영 데이터를 살펴볼게요'}</p></div><button type="button" aria-label="오늘 요약 닫기" onClick={() => close(true)}><X size={19} /></button></header>
        <div className="adm-ai-scroll" data-lenis-prevent>
          <StyleIntroCard className="adm-ai-summary" compact title={data?.source === 'rule' ? '운영 지표 집계 요약' : 'AI가 정리한 오늘의 흐름'} waitText="매출과 의뢰 흐름을 분석하고 있어요…" loading={loading && !data} summary={data ? { summary: data.summary, keywords: [], source: data.source, reviewCount: 0 } : null} />
          {error && <div role="status" className="adm-ai-error">{data ? '새 요약을 불러오지 못했어요. 이전 요약을 표시하고 있어요.' : '요약을 불러오지 못했어요.'}<button type="button" className="adm-btn weak sm" onClick={() => void load()} disabled={loading}><RefreshCw size={14} /> 다시 시도</button></div>}
          {data && <div key={data.generatedAt} className="adm-ai-details">
            <dl className="adm-ai-metrics">{metrics.map((item, index) => <div key={item.key} className="style-chip" style={{ animationDelay: `${0.25 + index * 0.045}s` }}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}</dl>
            <h3>확인할 흐름</h3>
            <ul className="adm-ai-insights">{data.insights.map((line, index) => <li key={index} className="style-word" style={{ animationDelay: `${0.6 + index * 0.1}s` }}>{line}</li>)}</ul>
            <nav className="adm-ai-actions" aria-label="운영 확인"><Link href="/admin/chat-connections" onClick={() => close()}>응답 대기 {data.today.unresponded}건</Link><Link href="/admin/inquiries" onClick={() => close()}>미처리 문의 {data.pendingInquiries}건</Link><Link href="/admin/pros" onClick={() => close()}>승인 대기 {data.pendingPros}명</Link></nav>
          </div>}
        </div>
        <footer className="adm-ai-foot">2시간마다 갱신{data && <> · 다음 {timeLabel(data.expiresAt)}</>}<span>{data?.source === 'ai' ? 'AI 분석' : data ? '실제 수치 기반' : '한국시간 기준'}</span></footer>
      </motion.div>}
    </AnimatePresence>
    <button ref={trigger} type="button" className="adm-ai-launch" aria-label="오늘 하루 요약" aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? 'admin-daily-briefing' : undefined} onClick={() => setOpen((value) => !value)}>
      <AdminAiOrb /><span className="adm-ai-launch-label">오늘 하루 요약</span>
    </button>
  </div>, document.body);
}

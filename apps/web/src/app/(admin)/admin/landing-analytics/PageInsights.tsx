'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { adminFetch } from '../_components/adminFetch';
import { useAdminRefresh } from '../_components/adminRefresh';
import { RollingNumber } from '../_components/AdminNumber';
import { AdminCollapse } from '../_components/AdminCollapse';
import { AdminDatePop } from '../_components/AdminDatePop';
import { AdminExportButton, exportRowsToXls } from '../_components/AdminExportButton';
import { PAGE_REGISTRY, displayUrl, pageMeta } from './page-registry';

/* ─────────────────────────────────────────────────────────────
 * 페이지별 인사이트(261007 사장 '페이지별 방문자 수·잔류시간, 어떤 페이지인지 한글로 + 아래 URL + 오른쪽 그 페이지 그림,
 *  엑셀 추출, 기간별, 가장 많이 방문하는 곳 = 메인 · 중간 = 서브 · 그 외 = 마이너').
 *  데이터 = page_views(전 화면 조회 1건 = 1행, 떠날 때 체류시간) — 261007 부터 기록. API GET /admin/landing-analytics/pages.
 *  어법 = 페이지별 유입 분석과 같게: 박스 없는 숫자 줄 → 흐름 막대(홈 14일 막대 .adm-vbar) → 순위 목록 카드.
 * ──────────────────────────────────────────────────────────── */

interface PageRow {
  path: string;
  views: number;
  visitors: number;
  sessions: number;
  entries: number;
  bounces: number;
  timed: number;
  avgMs: number;
  medianMs: number;
  mobile: number;
  app: number;
  prevVisitors: number | null;
}
interface Insights {
  since: string | null;
  range: { from: string; to: string; bucket: 'hour' | 'day' };
  totals: { views: number; visitors: number; sessions: number; avgMs: number; bounceRate: number; mobile: number; app: number };
  prev: { views: number; visitors: number; avgMs: number } | null;
  series: { t: string; visitors: number; views: number }[];
  pages: PageRow[];
}
type Tier = 'main' | 'sub' | 'minor' | 'none';
const TIER_LABEL: Record<Tier, string> = { main: '메인', sub: '서브', minor: '마이너', none: '방문 없음' };
/** 메인 = 방문자 많은 순으로 더해 전체의 50% 까지 · 서브 = 85% 까지 · 마이너 = 나머지 */
const MAIN_CUT = 0.5;
const SUB_CUT = 0.85;

const RANGES = [
  { key: 'today', label: '오늘' },
  { key: '7', label: '7일' },
  { key: '30', label: '30일' },
  { key: '90', label: '90일' },
  { key: 'all', label: '전체' },
] as const;
type RangeKey = (typeof RANGES)[number]['key'];

const num = (n: number) => Math.round(n || 0).toLocaleString('ko-KR');
const pctNum = (n: number) => Math.round((n || 0) * 100);
const KST_TODAY = () => new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
const kstStartISO = (ymd: string) => new Date(`${ymd}T00:00:00+09:00`).toISOString();
const kstEndISO = (ymd: string) => new Date(`${ymd}T23:59:59.999+09:00`).toISOString();
const addDaysYmd = (ymd: string, n: number) => new Date(Date.parse(`${ymd}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
const kstYmd = (iso: string) => new Date(new Date(iso).getTime() + 9 * 3600000).toISOString().slice(0, 10);
const kstHm = (iso: string) => new Date(new Date(iso).getTime() + 9 * 3600000).toISOString().slice(11, 16);
const md = (ymd: string) => `${Number(ymd.slice(5, 7))}월 ${Number(ymd.slice(8, 10))}일`;
/** 체류시간 글자 — 1분 넘으면 'N분 N초' */
const durText = (ms: number) => {
  const s = Math.round((ms || 0) / 1000);
  if (s < 60) return `${s}초`;
  const m = Math.floor(s / 60);
  return s % 60 ? `${m}분 ${s % 60}초` : `${m}분`;
};

/** 앞 기간 대비 — 기록 시작보다 앞이라 비교할 수 없으면 null */
function trendOf(cur: number, prev: number | null | undefined): { text: string; tone: 'up' | 'down' | 'flat' } | null {
  if (prev == null) return null;
  if (prev === 0) return cur > 0 ? { text: '새로', tone: 'up' } : null;
  const p = Math.round(((cur - prev) / prev) * 100);
  if (p === 0) return { text: '그대로', tone: 'flat' };
  return { text: `${p > 0 ? '+' : ''}${p}%`, tone: p > 0 ? 'up' : 'down' };
}

/** 숫자 줄 한 칸(유입 분석 숫자 줄과 같은 클래스) */
function Kpi({ label, children, sub, tone }: { label: string; children: React.ReactNode; sub: React.ReactNode; tone?: string }) {
  return (
    <div className="adm-la-kpi">
      <p className="adm-la-kpi-label">{label}</p>
      <p className="adm-la-kpi-value" style={tone ? { color: tone } : undefined}>{children}</p>
      <p className="adm-la-kpi-sub">{sub}</p>
    </div>
  );
}

/** 체류시간 다이얼 — 분·초 따로 굴린다 */
function Dur({ ms }: { ms: number }) {
  const s = Math.round((ms || 0) / 1000);
  const m = Math.floor(s / 60);
  if (m === 0) return <><RollingNumber value={s} />초</>;
  return <><RollingNumber value={m} />분{s % 60 ? <>&nbsp;<RollingNumber value={s % 60} />초</> : null}</>;
}

/** 흐름 막대 — 이틀 이하 = 시간마다, 그 밖 = 날마다(92일 넘으면 주마다 더해서). 홈 14일 막대(.adm-vbar) 그대로 */
function FlowChart({ data, metric }: { data: Insights; metric: 'visitors' | 'views' }) {
  const [hover, setHover] = useState<number | null>(null);
  const points = useMemo(() => {
    const byT = new Map(data.series.map((s) => [s.t, s]));
    // 기록 시작(since) 앞 칸은 그리지 않는다 — 0 막대가 '방문이 없었다'로 읽히지 않게
    const startMs = Math.max(Date.parse(data.range.from), data.since ? Date.parse(data.since) : 0);
    const fromYmd = kstYmd(new Date(startMs).toISOString());
    const toYmd = kstYmd(data.range.to);
    const out: { key: string; label: string; tip: string; v: number }[] = [];
    if (data.range.bucket === 'hour') {
      for (let d = fromYmd; d <= toYmd; d = addDaysYmd(d, 1)) {
        for (let h = 0; h < 24; h += 1) {
          const key = `${d}T${String(h).padStart(2, '0')}`;
          const iso = `${key}:00:00+09:00`;
          if (Date.parse(iso) > Date.parse(data.range.to) || Date.parse(iso) + 3600000 <= startMs) continue;
          const s = byT.get(key);
          out.push({ key, label: `${h}시`, tip: `${md(d)} ${h}시`, v: s ? s[metric] : 0 });
        }
      }
      return out;
    }
    const days: { key: string; v: number }[] = [];
    for (let d = fromYmd; d <= toYmd; d = addDaysYmd(d, 1)) {
      const s = byT.get(d);
      days.push({ key: d, v: s ? s[metric] : 0 });
    }
    if (days.length <= 92) return days.map((x) => ({ key: x.key, label: `${Number(x.key.slice(5, 7))}.${Number(x.key.slice(8, 10))}`, tip: md(x.key), v: x.v }));
    for (let i = 0; i < days.length; i += 7) {
      const wk = days.slice(i, i + 7);
      out.push({ key: wk[0].key, label: `${Number(wk[0].key.slice(5, 7))}.${Number(wk[0].key.slice(8, 10))}~`, tip: `${md(wk[0].key)}부터 7일(날마다 더함)`, v: wk.reduce((a, x) => a + x.v, 0) });
    }
    return out;
  }, [data, metric]);
  const max = Math.max(1, ...points.map((p) => p.v));
  const lastWithValue = (() => { for (let i = points.length - 1; i >= 0; i -= 1) if (points[i].v > 0) return i; return points.length - 1; })();
  const active = hover ?? (points.length ? lastWithValue : null);
  const step = Math.max(1, Math.ceil(points.length / 12)); // 아래 글자는 12개쯤만
  const total = points.reduce((a, p) => a + p.v, 0);
  return (
    <>
      <p className="adm-pi-flow-sum">
        {active != null && points[active] ? <>{points[active].tip} <b>{num(points[active].v)}{metric === 'visitors' ? '명' : '회'}</b></> : null}
        <span>{metric === 'views' ? `합계 ${num(total)}회` : data.range.bucket === 'hour' ? '시간마다 방문자' : '날마다 방문자'}</span>
      </p>
      <div className="adm-vbars adm-pi-vbars" key={`${metric}-${points.length}`} onMouseLeave={() => setHover(null)}>
        {points.map((p, i) => {
          const on = i === active;
          const h = Math.max(3, (p.v / max) * 100);
          return (
            <div key={p.key} className={`adm-vbar ${on ? 'on' : ''}`} onMouseEnter={() => setHover(i)} title={`${p.tip} · ${num(p.v)}`}>
              <div className="adm-vbar-plot">
                <span className="adm-vbar-col" style={{ height: `${h}%`, animationDelay: `${Math.min(i, 30) * 0.02}s` }}>
                  {(points.length <= 16 || on) && p.v > 0 && <span className="adm-vbar-val">{num(p.v)}</span>}
                  <span className="adm-vbar-fill" />
                </span>
              </div>
              <span className="adm-vbar-label" style={i % step && !on ? { visibility: 'hidden' } : undefined}>{p.label}</span>
            </div>
          );
        })}
      </div>
    </>
  );
}

interface RankedRow extends PageRow {
  tier: Tier;
  share: number;
  rank: number;
}

/** 순위 줄 — 왼쪽 순위 · 등급 · 한글 이름 · 설명 · 주소 / 가운데 숫자 4칸 / 오른쪽 그 화면 그림 */
function PageRowItem({ r, max, delay, onThumb }: { r: RankedRow; max: number; delay: number; onThumb: (src: string, name: string) => void }) {
  const meta = pageMeta(r.path);
  const trend = trendOf(r.visitors, r.prevVisitors);
  const staticPath = !r.path.includes(':id');
  const none = r.tier === 'none';
  return (
    <div className={`adm-pi-row ${none ? 'none' : ''}`} style={{ animationDelay: `${delay}s` }}>
      <span className={`adm-pi-rank ${r.tier === 'main' ? 'hi' : ''}`}>{none ? '' : r.rank}</span>
      <div className="adm-pi-info">
        <p className="adm-pi-name">
          <span className={`adm-pi-tier ${r.tier}`}>{TIER_LABEL[r.tier]}</span>
          <b>{meta.name}</b>
        </p>
        <p className="adm-pi-desc">{meta.known ? meta.desc : '등록되지 않은 화면 — 주소로 확인'}</p>
        {staticPath ? (
          <a className="adm-pi-url" href={`https://${displayUrl(r.path)}`} target="_blank" rel="noopener noreferrer">{displayUrl(r.path)}</a>
        ) : (
          <span className="adm-pi-url plain" title=":id 자리는 사회자·글마다 달라요">{displayUrl(r.path)}</span>
        )}
        {!none && <span className="adm-top-bar adm-pi-bar"><span style={{ width: `${(r.visitors / max) * 100}%` }} /></span>}
      </div>
      <div className="adm-pi-stats">
        <div className="adm-pi-stat">
          <p>방문자</p>
          <b>{none ? '—' : <>{num(r.visitors)}<small>명</small></>}</b>
          <span className="adm-pi-statsub">
            {none ? ' ' : `${pctNum(r.share)}%`}
            {trend && <em className={`adm-pi-trend ${trend.tone}`}>{trend.text}</em>}
          </span>
        </div>
        <div className="adm-pi-stat">
          <p>페이지뷰</p>
          <b>{none ? '—' : <>{num(r.views)}<small>회</small></>}</b>
          <span className="adm-pi-statsub">{none || !r.visitors ? ' ' : `1인 ${(r.views / r.visitors).toFixed(1)}회`}</span>
        </div>
        <div className="adm-pi-stat">
          <p>평균 체류</p>
          <b>{none || !r.timed ? '—' : durText(r.avgMs)}</b>
          <span className="adm-pi-statsub">{none || !r.timed ? ' ' : `중간값 ${durText(r.medianMs)}`}</span>
        </div>
        <div className="adm-pi-stat">
          <p>바로 나감</p>
          <b>{none || !r.entries ? '—' : `${pctNum(r.bounces / r.entries)}%`}</b>
          <span className="adm-pi-statsub">{none || !r.entries ? ' ' : `첫 화면 ${num(r.entries)}회`}</span>
        </div>
      </div>
      <button
        type="button"
        className="adm-pi-thumb"
        onClick={() => meta.thumbUrl && onThumb(meta.thumbUrl, meta.name)}
        disabled={!meta.thumbUrl}
        aria-label={`${meta.name} 화면 크게 보기`}
      >
        {meta.thumbUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- public 정적 그림
          <img src={meta.thumbUrl} alt="" loading="lazy" decoding="async" width={240} height={426} />
        ) : (
          <span className="adm-pi-thumb-none" aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><rect x="5" y="2.5" width="14" height="19" rx="3" stroke="currentColor" strokeWidth="1.8" /><path d="M10 18.5h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
          </span>
        )}
      </button>
    </div>
  );
}

export default function PageInsights() {
  const [range, setRange] = useState<RangeKey>('7');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const customActive = !!(customFrom || customTo);
  const [data, setData] = useState<Insights | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [metric, setMetric] = useState<'visitors' | 'views'>('visitors');
  const [openNone, setOpenNone] = useState(false);
  const [openMinor, setOpenMinor] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [zoom, setZoom] = useState<{ src: string; name: string } | null>(null);

  const query = () => {
    const today = KST_TODAY();
    if (customActive) {
      const a = customFrom || customTo;
      const b = customTo || customFrom;
      const [f, t] = a <= b ? [a, b] : [b, a];
      return `?from=${encodeURIComponent(kstStartISO(f))}&to=${encodeURIComponent(kstEndISO(t))}`;
    }
    if (range === 'all') return '';
    const days = range === 'today' ? 1 : Number(range);
    return `?from=${encodeURIComponent(kstStartISO(addDaysYmd(today, -(days - 1))))}`;
  };
  const load = async () => {
    setLoading(true);
    try {
      const d = await adminFetch('GET', `/api/v1/admin/landing-analytics/pages${query()}`, undefined, { cache: false });
      setData(d && Array.isArray(d.pages) ? d : null);
      setFailed(!(d && Array.isArray(d.pages)));
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [range, customFrom, customTo]);
  useAdminRefresh(() => { load(); });

  // 순위 · 등급 — 방문자 많은 순(같으면 조회 많은 순), 누적 비중으로 메인 · 서브 · 마이너
  const ranked = useMemo<RankedRow[]>(() => {
    const rows = (data?.pages ?? []).filter((p) => p.views > 0);
    const total = rows.reduce((a, p) => a + p.visitors, 0) || 1;
    let cum = 0;
    return rows
      .slice()
      .sort((a, b) => b.visitors - a.visitors || b.views - a.views)
      .map((p, i) => {
        const before = cum / total;
        cum += p.visitors;
        const tier: Tier = before < MAIN_CUT ? 'main' : before < SUB_CUT ? 'sub' : 'minor';
        return { ...p, tier, share: p.visitors / total, rank: i + 1 };
      });
  }, [data]);
  // 기간 안 방문이 없는 등록 화면 — 그림·주소는 보이게 맨 아래 접어 둔다
  const unvisited = useMemo<RankedRow[]>(() => {
    const seen = new Set(ranked.map((r) => r.path));
    return PAGE_REGISTRY.filter((p) => !seen.has(p.path)).map((p) => ({
      path: p.path, views: 0, visitors: 0, sessions: 0, entries: 0, bounces: 0, timed: 0, avgMs: 0, medianMs: 0, mobile: 0, app: 0, prevVisitors: null,
      tier: 'none' as Tier, share: 0, rank: 0,
    }));
  }, [ranked]);
  const head = ranked.filter((r) => r.tier !== 'minor');
  const minor = ranked.filter((r) => r.tier === 'minor');
  const max = Math.max(1, ...ranked.map((r) => r.visitors));
  const tierCount = (t: Tier) => ranked.filter((r) => r.tier === t).length;

  const periodText = (() => {
    if (customActive) {
      const a = customFrom || customTo;
      const b = customTo || customFrom;
      const [f, t] = a <= b ? [a, b] : [b, a];
      return f === t ? md(f) : `${md(f)} ~ ${md(t)}`;
    }
    return range === 'today' ? '오늘' : range === 'all' ? '전체 기간' : `최근 ${range}일`;
  })();
  const sinceText = data?.since ? `${md(kstYmd(data.since))} ${kstHm(data.since)}부터 기록` : '방금부터 기록을 시작했어요';

  const t = data?.totals;
  const prev = data?.prev;
  const visTrend = t ? trendOf(t.visitors, prev?.visitors ?? null) : null;
  const durTrend = t && prev && prev.avgMs > 0 && t.avgMs > 0 ? trendOf(t.avgMs, prev.avgMs) : null;

  const handleExport = () => {
    if (!data) return;
    setExporting(true);
    try {
      const rows = [...ranked, ...unvisited];
      exportRowsToXls(`페이지별 인사이트 ${periodText}`, '페이지별 인사이트', rows, [
        { header: '순위', value: (r) => (r.tier === 'none' ? '' : r.rank) },
        { header: '구분', value: (r) => TIER_LABEL[r.tier] },
        { header: '화면', value: (r) => pageMeta(r.path).name },
        { header: '어떤 화면', value: (r) => pageMeta(r.path).desc },
        { header: '주소', value: (r) => displayUrl(r.path) },
        { header: '분류', value: (r) => pageMeta(r.path).group },
        { header: '방문자(명)', value: (r) => r.visitors },
        { header: '방문자 비중(%)', value: (r) => (r.tier === 'none' ? 0 : Math.round(r.share * 1000) / 10) },
        { header: '앞 기간 방문자(명)', value: (r) => (r.prevVisitors == null ? '' : r.prevVisitors) },
        { header: '페이지뷰(회)', value: (r) => r.views },
        { header: '세션', value: (r) => r.sessions },
        { header: '첫 화면으로 들어옴(회)', value: (r) => r.entries },
        { header: '바로 나감(%)', value: (r) => (r.entries ? Math.round((r.bounces / r.entries) * 1000) / 10 : '') },
        { header: '평균 체류(초)', value: (r) => (r.timed ? Math.round(r.avgMs / 100) / 10 : '') },
        { header: '중간 체류(초)', value: (r) => (r.timed ? Math.round(r.medianMs / 100) / 10 : '') },
        { header: '모바일 비율(%)', value: (r) => (r.views ? Math.round((r.mobile / r.views) * 1000) / 10 : '') },
        { header: '앱 비율(%)', value: (r) => (r.views ? Math.round((r.app / r.views) * 1000) / 10 : '') },
        { header: '기간', value: () => periodText },
      ]);
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      {/* 기간 · 엑셀 */}
      <div className="adm-pi-ctl">
        <div className="adm-seg" role="tablist" aria-label="기간">
          {RANGES.map((r) => (
            <button key={r.key} type="button" role="tab" aria-selected={!customActive && range === r.key} className={!customActive && range === r.key ? 'on' : ''} onClick={() => { setCustomFrom(''); setCustomTo(''); setRange(r.key); }}>
              {r.label}
            </button>
          ))}
        </div>
        <span className="adm-la-range">
          <AdminDatePop value={customFrom} onChange={setCustomFrom} placeholder="시작일" ariaLabel="시작일" rangeStart={customFrom} rangeEnd={customTo} />
          <span aria-hidden="true">~</span>
          <AdminDatePop value={customTo} onChange={setCustomTo} placeholder="종료일" ariaLabel="종료일" rangeStart={customFrom} rangeEnd={customTo} />
          {customActive && (
            <button type="button" className="adm-btn icon sm" onClick={() => { setCustomFrom(''); setCustomTo(''); }} aria-label="날짜 고르기 풀기">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" /></svg>
            </button>
          )}
        </span>
        <span className="adm-pi-ctl-right">
          <AdminExportButton loading={exporting} onClick={handleExport} />
        </span>
      </div>

      {/* 숫자 줄 — 박스 없는 다이얼 6칸 */}
      <section className="adm-la-top" aria-label={`${periodText} 숫자`}>
        <div className="adm-la-kpis" key={periodText}>
          <Kpi label={`${periodText} 방문자`} sub={visTrend ? <>앞 기간보다 <b className={`adm-pi-trend ${visTrend.tone}`}>{visTrend.text}</b></> : sinceText}>
            {t ? <><RollingNumber value={t.visitors} />명</> : <span className="adm-money-wait">—</span>}
          </Kpi>
          <Kpi label="페이지뷰" sub={t && t.visitors ? `1인 ${(t.views / t.visitors).toFixed(1)}페이지` : '화면을 연 횟수'}>
            {t ? <><RollingNumber value={t.views} />회</> : <span className="adm-money-wait">—</span>}
          </Kpi>
          <Kpi label="평균 체류시간" tone="#3182F6" sub={durTrend ? <>앞 기간보다 <b className={`adm-pi-trend ${durTrend.tone}`}>{durTrend.text}</b></> : '화면이 보이던 시간'}>
            {t ? (t.avgMs > 0 ? <Dur ms={t.avgMs} /> : '—') : <span className="adm-money-wait">—</span>}
          </Kpi>
          <Kpi label="바로 나감" sub="첫 화면만 보고 나간 세션">
            {t ? (t.sessions ? <><RollingNumber value={pctNum(t.bounceRate)} />%</> : '—') : <span className="adm-money-wait">—</span>}
          </Kpi>
          <Kpi label="앱에서 본 비율" sub="iOS · 안드로이드 앱">
            {t ? (t.views ? <><RollingNumber value={pctNum(t.app / t.views)} />%</> : '—') : <span className="adm-money-wait">—</span>}
          </Kpi>
          <Kpi label="모바일 비율" sub={t && t.views ? `PC ${100 - pctNum(t.mobile / t.views)}%` : '폰 · 태블릿 화면'}>
            {t ? (t.views ? <><RollingNumber value={pctNum(t.mobile / t.views)} />%</> : '—') : <span className="adm-money-wait">—</span>}
          </Kpi>
        </div>
        <div className="adm-money-line" />
      </section>

      {/* 흐름 — 기간 안 시간/날마다 */}
      <div className="adm-card">
        <div className="adm-card-head">
          <div className="min-w-0">
            <h2 className="adm-card-title">{periodText} 흐름</h2>
            <p className="adm-card-sub">{data?.range.bucket === 'hour' ? '시간마다' : '날마다'} · {sinceText}</p>
          </div>
          <div className="adm-seg" role="tablist" aria-label="지표">
            <button type="button" role="tab" aria-selected={metric === 'visitors'} className={metric === 'visitors' ? 'on' : ''} onClick={() => setMetric('visitors')}>방문자</button>
            <button type="button" role="tab" aria-selected={metric === 'views'} className={metric === 'views' ? 'on' : ''} onClick={() => setMetric('views')}>페이지뷰</button>
          </div>
        </div>
        {loading && !data ? <div className="adm-skel h-[236px]" /> : data ? <FlowChart data={data} metric={metric} /> : <p className="adm-la-empty">데이터를 불러오지 못했어요</p>}
      </div>

      {/* 순위 목록 */}
      <div className="adm-card adm-pi-card">
        <div className="adm-card-head">
          <div className="min-w-0">
            <h2 className="adm-card-title">페이지 순위</h2>
            <p className="adm-card-sub">
              {periodText} · 방문 있는 화면 {num(ranked.length)}곳 · 메인 {tierCount('main')} · 서브 {tierCount('sub')} · 마이너 {tierCount('minor')}
            </p>
          </div>
        </div>
        {loading && !data ? (
          <div className="space-y-3">{[0, 1, 2, 3].map((i) => <div key={i} className="adm-skel h-[150px]" />)}</div>
        ) : failed && !data ? (
          <p className="adm-la-empty">데이터를 불러오지 못했어요</p>
        ) : (
          <>
            {ranked.length === 0 && <p className="adm-la-empty">{periodText} 방문 기록이 아직 없어요 · {sinceText}</p>}
            <div className="adm-pi-list" key={periodText}>
              {head.map((r, i) => <PageRowItem key={r.path} r={r} max={max} delay={Math.min(i, 8) * 0.04} onThumb={(src, name) => setZoom({ src, name })} />)}
            </div>
            {minor.length > 0 && (
              <>
                <AdminCollapse open={openMinor}>
                  <div className="adm-pi-list adm-pi-rest">
                    {minor.map((r, i) => <PageRowItem key={r.path} r={r} max={max} delay={Math.min(i, 8) * 0.03} onThumb={(src, name) => setZoom({ src, name })} />)}
                  </div>
                </AdminCollapse>
                <button type="button" className={`adm-top-more ${openMinor ? 'on' : ''}`} onClick={() => setOpenMinor((v) => !v)} aria-expanded={openMinor}>
                  {openMinor ? '마이너 접기' : `마이너 ${minor.length}곳 펼치기`}
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </button>
              </>
            )}
            {unvisited.length > 0 && (
              <>
                <AdminCollapse open={openNone}>
                  <div className="adm-pi-list adm-pi-rest">
                    {unvisited.map((r, i) => <PageRowItem key={r.path} r={r} max={max} delay={Math.min(i, 8) * 0.03} onThumb={(src, name) => setZoom({ src, name })} />)}
                  </div>
                </AdminCollapse>
                <button type="button" className={`adm-top-more ${openNone ? 'on' : ''}`} onClick={() => setOpenNone((v) => !v)} aria-expanded={openNone}>
                  {openNone ? '접기' : `${periodText} 방문 없는 화면 ${unvisited.length}곳`}
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </button>
              </>
            )}
          </>
        )}
        <p className="adm-la-foot">
          방문자 = 기기 수(같은 기기는 기간 안에 여러 번 와도 1명) · 페이지뷰 = 화면을 연 횟수 · 체류 = 화면이 실제로 보이던 시간(앱·탭이 뒤로 가면 멈춤, 30분 상한) ·
          바로 나감 = 그 화면으로 들어와 그 화면만 보고 끝난 비율 · 메인 = 방문자 많은 순으로 더해 전체의 절반까지, 서브 = 85%까지, 마이너 = 나머지 ·
          관리자 화면·로봇은 세지 않아요 · {sinceText}
        </p>
      </div>

      {zoom && typeof document !== 'undefined' && createPortal(
        <div className="adm-pi-zoom admin-shell" role="dialog" aria-modal="true" aria-label={`${zoom.name} 화면`} onClick={() => setZoom(null)}>
          <figure onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={zoom.src} alt={`${zoom.name} 화면`} />
            <figcaption>{zoom.name}</figcaption>
          </figure>
        </div>,
        document.body,
      )}
    </>
  );
}

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { adminFetch } from '../_components/adminFetch';
import { useAdminRefresh } from '../_components/adminRefresh';
import { AdminTableScroll } from '../_components/AdminListCard';
import { RollingNumber } from '../_components/AdminNumber';
import { AdminCollapse } from '../_components/AdminCollapse';
import { AdminDatePop } from '../_components/AdminDatePop';

/* ─────────────────────────────────────────────────────────────
 * 페이지별 유입 분석(261005 사장 '퀵매칭 · 웨딩MC · 비즈MC' → 261006 '톤앤매너에 맞춰서').
 *  홈과 같은 어법: 박스 없는 숫자 줄(다이얼) → 한 줄 브리핑 + 홈식 달력(박스 없음) → 카드(.adm-card) → 목록 카드(표).
 *  글자 굵기 700 까지, 모서리 r20, 색 = 파랑(방문)·초록(신청)·회색 단계. 데이터는 고른 페이지(?page=)만.
 * ──────────────────────────────────────────────────────────── */

interface Bucket { key: string; visits: number; conversions: number; rate: number; }
interface PageStat { page: string; visits: number; conversions: number; rate: number; bySource: Bucket[]; byMedium: Bucket[]; byCampaign: Bucket[]; }
interface DailyRow { date: string; visits: number; conversions: number; }
interface Analytics { pages: PageStat[]; totalVisits: number; totalConversions: number; daily: DailyRow[]; today: { date: string; visits: number; conversions: number }; }
interface VisitRow { page: string; source: string | null; medium: string | null; campaign: string | null; referrerHost: string | null; referrer: string | null; converted: boolean; createdAt: string; }
type Totals = { visits: number; conversions: number };

/** 제목 자리 큰 글씨 탭 — 고른 것 검정 · 나머지 회색. conv = 그 페이지의 '전환' 이름 */
const PAGE_TABS = [
  { key: 'quick-match', label: '퀵매칭', desc: '퀵매칭 페이지 유입(UTM·리퍼러)과 견적 요청 전환', conv: '견적 요청' },
  { key: 'wedding-mc', label: '웨딩MC', desc: '결혼식 사회자 랜딩(wedding-mc) 유입과 견적 신청 전환', conv: '견적 신청' },
  { key: 'corporate-mc', label: '비즈MC', desc: '전문행사 사회자 랜딩(corporate-mc) 유입과 견적 신청 전환', conv: '견적 신청' },
] as const;
type PageKey = (typeof PAGE_TABS)[number]['key'];
/** 어드민 API 주소에 고른 페이지를 붙인다 */
const withPage = (url: string, page: PageKey) => `${url}${url.includes('?') ? '&' : '?'}page=${page}`;

const RANGES = [
  { key: '7', label: '7일' },
  { key: '30', label: '30일' },
  { key: '90', label: '90일' },
  { key: 'all', label: '전체' },
] as const;
const DIMS = [
  { key: 'source', label: '유입 소스' },
  { key: 'medium', label: '매체' },
  { key: 'campaign', label: '캠페인' },
] as const;
type DimKey = (typeof DIMS)[number]['key'];

const WD = ['일', '월', '화', '수', '목', '금', '토'];
const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
const num = (n: number) => Math.round(n || 0).toLocaleString('ko-KR');
const won = (n: number) => `${Math.round(n).toLocaleString('ko-KR')}원`;
const pad2 = (n: number) => String(n).padStart(2, '0');

const KST_TODAY = () => new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
const kstStartISO = (ymd: string) => new Date(`${ymd}T00:00:00+09:00`).toISOString();
const kstEndISO = (ymd: string) => new Date(`${ymd}T23:59:59.999+09:00`).toISOString();
const addDaysYmd = (ymd: string, n: number) => new Date(Date.parse(`${ymd}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
const md = (ymd: string) => `${Number(ymd.slice(5, 7))}월 ${Number(ymd.slice(8, 10))}일`;
/** KST 날짜 'YYYY-MM-DD' · 시각 'HH:mm' */
const kstYmdOf = (iso: string) => new Date(new Date(iso).getTime() + 9 * 3600000).toISOString().slice(0, 10);
const kstHm = (iso: string) => new Date(new Date(iso).getTime() + 9 * 3600000).toISOString().slice(11, 16);

// 표시 월(offset 0=이번달, -1=저번달…)의 달력: 앞뒤 달 칸 포함한 주 단위
interface CalCell { key: string; day: number; weekday: number; inMonth: boolean; }
function monthGrid(offset: number): { year: number; month: number; cells: CalCell[]; gridStart: string; gridEnd: string } {
  const kstNow = new Date(Date.now() + 9 * 3600000);
  const first = new Date(Date.UTC(kstNow.getUTCFullYear(), kstNow.getUTCMonth() + offset, 1));
  const year = first.getUTCFullYear();
  const month = first.getUTCMonth();
  const firstWeekday = first.getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const gridStart = first.getTime() - firstWeekday * 86400000;
  const totalCells = Math.ceil((firstWeekday + daysInMonth) / 7) * 7;
  const cells: CalCell[] = [];
  for (let i = 0; i < totalCells; i++) {
    const dt = new Date(gridStart + i * 86400000);
    cells.push({ key: dt.toISOString().slice(0, 10), day: dt.getUTCDate(), weekday: dt.getUTCDay(), inMonth: dt.getUTCMonth() === month });
  }
  return { year, month, cells, gridStart: cells[0].key, gridEnd: cells[cells.length - 1].key };
}

// 표시월(offset)의 실제 1일~말일 KST 날짜
function monthFirstLast(offset: number): { first: string; last: string } {
  const kstNow = new Date(Date.now() + 9 * 3600000);
  const first = new Date(Date.UTC(kstNow.getUTCFullYear(), kstNow.getUTCMonth() + offset, 1));
  const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0));
  return { first: first.toISOString().slice(0, 10), last: last.toISOString().slice(0, 10) };
}

// 유입 소스 → 브랜드 아이콘(public/admin-icons/src-*.svg)
const SOURCE_ICON: Record<string, string> = {
  instagram: 'src-instagram', insta: 'src-instagram', ig: 'src-instagram',
  facebook: 'src-facebook', fb: 'src-facebook', 'facebook.com': 'src-facebook',
  meta: 'src-meta',
  threads: 'src-threads', 'threads.net': 'src-threads',
  naver: 'src-naver', 'naver.com': 'src-naver', 'blog.naver.com': 'src-naver',
  google: 'src-google', kakao: 'src-kakao', tiktok: 'src-tiktok',
};
function sourceIconFile(key?: string | null): string | null {
  if (!key) return null;
  const k = String(key).toLowerCase().trim();
  if (SOURCE_ICON[k]) return SOURCE_ICON[k];
  if (k.includes('instagram')) return 'src-instagram';
  if (k.includes('facebook')) return 'src-facebook';
  if (k.includes('threads')) return 'src-threads';
  if (k.includes('naver')) return 'src-naver';
  if (k.includes('google')) return 'src-google';
  if (k.includes('kakao')) return 'src-kakao';
  if (k.includes('tiktok')) return 'src-tiktok';
  if (k.includes('meta')) return 'src-meta';
  return null;
}
// 소스 키 → 사람이 읽는 이름
const SOURCE_NAME: Record<string, string> = {
  instagram: '인스타그램', facebook: '페이스북', meta: '메타', threads: '스레드',
  naver: '네이버', youtube: '유튜브', tiktok: '틱톡', kakao: '카카오', google: '구글',
};
const srcLabel = (k: string) => SOURCE_NAME[k.toLowerCase()] || k;

/** 소스 아이콘 — 브랜드 아이콘이 없으면 회색 동그라미 */
function SrcIcon({ k, size = 20 }: { k: string; size?: number }) {
  const file = sourceIconFile(k);
  if (!file) return <span className="adm-la-srcdot" style={{ width: size, height: size }} aria-hidden="true" />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={`/admin-icons/${file}.svg`} alt="" width={size} height={size} className="adm-la-srcimg" />;
}

// 광고 채널 — 유입 소스(utm_source/리퍼러)를 광고비 집행 단위로 묶는다(메타 = 인스타·페북·스레드 한 계정)
const AD_CHANNELS: { key: string; label: string; sources: string[]; icon: string }[] = [
  { key: 'meta', label: '메타', sources: ['meta', 'instagram', 'insta', 'ig', 'facebook', 'fb', 'threads'], icon: 'src-meta' },
  { key: 'naver', label: '네이버', sources: ['naver'], icon: 'src-naver' },
  { key: 'google', label: '구글', sources: ['google'], icon: 'src-google' },
  { key: 'kakao', label: '카카오', sources: ['kakao'], icon: 'src-kakao' },
  { key: 'tiktok', label: '틱톡', sources: ['tiktok'], icon: 'src-tiktok' },
];

/**
 * 유입 순위 줄 — 사회자 TOP 줄 어법(순위 · 이름 · 비율 막대 · 오른쪽 숫자). 기본 6줄, 펼치면 전부.
 *  icon = 소스 아이콘(매체·캠페인은 아이콘 없이)
 */
function RankRows({ rows, conv, empty, icon = true }: { rows: Bucket[]; conv: string; empty: string; icon?: boolean }) {
  const [open, setOpen] = useState(false);
  const shown = rows.filter((r) => r.visits > 0 || r.conversions > 0);
  const total = shown.reduce((s, r) => s + r.visits, 0);
  const max = Math.max(1, ...shown.map((r) => r.visits));
  if (shown.length === 0) return <p className="adm-la-empty">{empty}</p>;
  const row = (r: Bucket, i: number) => (
    <div key={r.key} className="adm-top-row adm-la-rank" style={{ animationDelay: `${(i < 6 ? i : i - 6) * 0.04}s` }}>
      <span className={`adm-top-rank ${i < 3 ? 'hi' : ''}`}>{i + 1}</span>
      <span className="min-w-0 flex-1">
        <span className="adm-la-src">
          {icon && <SrcIcon k={r.key} />}
          <span className="adm-la-src-name">{icon ? srcLabel(r.key) : r.key}</span>
          <span className="adm-la-share">{total ? pct(r.visits / total) : ''}</span>
        </span>
        <span className="adm-top-bar"><span style={{ width: `${(r.visits / max) * 100}%` }} /></span>
      </span>
      <span className="adm-top-val">
        {num(r.visits)}회
        <small className={r.conversions ? 'on' : ''}>{r.conversions ? `${conv} ${num(r.conversions)}` : `${conv} 0`}</small>
      </span>
    </div>
  );
  return (
    <>
      <div className="adm-top">
        {shown.slice(0, 6).map(row)}
        <AdminCollapse open={open} className="adm-top-rest-wrap">
          <div className="adm-top-rest">{shown.slice(6).map((r, j) => row(r, j + 6))}</div>
        </AdminCollapse>
      </div>
      {shown.length > 6 && (
        <button type="button" className={`adm-top-more ${open ? 'on' : ''}`} onClick={() => setOpen((v) => !v)} aria-expanded={open}>
          {open ? '접기' : `펼치기 · ${shown.length}곳`}
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
      )}
    </>
  );
}

const Chev = ({ dir }: { dir: 'l' | 'r' }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d={dir === 'l' ? 'M15 5.5 8.5 12l6.5 6.5' : 'M9 5.5 15.5 12 9 18.5'} stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/** 방문 기록 — 오른쪽 칸(261006 사장 '방문 기록은 우측에'). 날마다 묶어 최근 순: 소스 아이콘 · 매체/캠페인(없으면 리퍼러) · 시각 · 신청 */
function VisitFeed({ visits, conv, sel }: { visits: VisitRow[] | null; conv: string; sel: PageKey }) {
  const today = KST_TODAY();
  const yest = addDaysYmd(today, -1);
  const groups = useMemo(() => {
    const m = new Map<string, VisitRow[]>();
    for (const v of visits ?? []) {
      const d = kstYmdOf(v.createdAt);
      const arr = m.get(d);
      if (arr) arr.push(v);
      else m.set(d, [v]);
    }
    return Array.from(m.entries());
  }, [visits]);
  const short = conv.replace(/^견적\s*/, '');
  return (
    <div className="adm-card adm-la-log">
      <div className="adm-card-head">
        <h2 className="adm-card-title">방문 기록</h2>
        <span className="adm-qm-count">최근 <b>{num(visits?.length || 0)}</b>건</span>
      </div>
      <div className="adm-la-logscroll">
        {visits == null ? (
          <div className="space-y-3 pt-2">{[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="adm-skel h-[44px]" />)}</div>
        ) : visits.length === 0 ? (
          <p className="adm-la-empty">방문 기록이 아직 없어요</p>
        ) : groups.map(([d, rows]) => (
          <div key={d} className="adm-la-logday">
            <p className="adm-la-logday-head">
              {d === today ? '오늘' : d === yest ? '어제' : md(d)}
              <span>{num(rows.length)}건{rows.some((r) => r.converted) ? ` · ${short} ${rows.filter((r) => r.converted).length}` : ''}</span>
            </p>
            {rows.map((v, i) => {
              const k = v.source || v.referrerHost || '';
              const sub = [v.medium, v.campaign].filter(Boolean).join(' · ') || v.referrerHost || '유입 정보 없음';
              return (
                <div key={`${v.createdAt}-${i}`} className="adm-la-logrow" title={v.referrer || undefined}>
                  <SrcIcon k={k || '직접/기타'} size={26} />
                  <span className="min-w-0 flex-1">
                    <span className="adm-la-logname">{k ? srcLabel(k) : '직접/기타'}</span>
                    <span className="adm-la-logsub">{sub}</span>
                  </span>
                  <span className="adm-la-logright">
                    <span className="adm-la-logtime">{kstHm(v.createdAt)}</span>
                    {v.converted && <span className="adm-badge green">{short}</span>}
                  </span>
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <p className="adm-la-logfoot">
        방문 = 기기(세션)·페이지당 1번 · {conv} = 폼 제출 성공 · UTM 이 없으면 리퍼러로 소스를 추정, 둘 다 없으면 직접/기타
        <br />링크 예시 freetiful.com/{sel}?utm_source=instagram&amp;utm_medium=bio
      </p>
    </div>
  );
}

/** 숫자 줄 한 칸 — 홈 상단 숫자와 같은 어법(이름 · 다이얼 숫자 · 회색 한 줄). 화면 안에서 만들면 그릴 때마다 다시 붙어 다이얼이 매번 굴러서 밖에 둔다 */
function Kpi({ label, value, unit, sub, tone }: { label: string; value: number | null; unit?: string; sub: React.ReactNode; tone?: string }) {
  return (
    <div className="adm-la-kpi">
      <p className="adm-la-kpi-label">{label}</p>
      <p className="adm-la-kpi-value" style={tone ? { color: tone } : undefined}>
        {value == null ? <span className="adm-money-wait">—</span> : <><RollingNumber value={Math.round(value)} />{unit}</>}
      </p>
      <p className="adm-la-kpi-sub">{sub}</p>
    </div>
  );
}

export default function LandingAnalyticsPage() {
  // 고른 페이지 — 주소 ?p= 로 남겨 새로고침·공유해도 그대로
  const [sel, setSel] = useState<PageKey>('quick-match');
  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get('p');
    if (PAGE_TABS.some((t) => t.key === p)) setSel(p as PageKey);
  }, []);
  const pickPage = (k: PageKey) => {
    setSel(k);
    try {
      const u = new URL(window.location.href);
      u.searchParams.set('p', k);
      window.history.replaceState(window.history.state, '', `${u.pathname}${u.search}`);
    } catch { /* 주소만 못 바꿔도 화면은 바뀐다 */ }
  };
  const tab = PAGE_TABS.find((t) => t.key === sel) || PAGE_TABS[0];
  const conv = tab.conv;

  // ── 상세(기간 고르기) · 고른 날 ──
  const [data, setData] = useState<Analytics | null>(null);
  const [visits, setVisits] = useState<VisitRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<string>('30');
  const [customFrom, setCustomFrom] = useState<string>('');
  const [customTo, setCustomTo] = useState<string>('');
  const customActive = !!(customFrom || customTo);
  const [dim, setDim] = useState<DimKey>('source');
  // ── 오늘 · 어제 ──
  const [todayData, setTodayData] = useState<Analytics | null>(null);
  const [yesterday, setYesterday] = useState<Totals | null>(null);
  // ── 표시월(달력·브리핑·광고 효율) ──
  const [monthOffset, setMonthOffset] = useState(0); // 0=이번 달, -1=지난달…
  const [monthData, setMonthData] = useState<Analytics | null>(null); // 달력 칸 범위(앞뒤 달 포함) 날마다
  const [monthExact, setMonthExact] = useState<Analytics | null>(null); // 표시월 1일~말일 정확 집계
  const [prevSame, setPrevSame] = useState<Totals | null>(null); // 지난달 같은 기간
  // 광고 집행비 — 표시월 기준 채널별 하루 집행액(어드민이 직접 입력)
  const [adSpend, setAdSpend] = useState<Record<string, number>>({});
  const [spendEditing, setSpendEditing] = useState(false);
  const [spendDraft, setSpendDraft] = useState<Record<string, string>>({});
  const [spendSaving, setSpendSaving] = useState(false);

  const load = async (r: string, from = customFrom, to = customTo) => {
    setLoading(true);
    try {
      let qs = '';
      if (from || to) {
        // 하루만 고르면 그날 하루(KST 경계), 둘 다면 기간
        const a = from || to;
        const b = to || from;
        const [effFrom, effTo] = a <= b ? [a, b] : [b, a];
        qs = `?from=${encodeURIComponent(kstStartISO(effFrom))}&to=${encodeURIComponent(kstEndISO(effTo))}`;
      } else if (r !== 'all') {
        qs = `?from=${encodeURIComponent(new Date(Date.now() - Number(r) * 86400000).toISOString())}`;
      }
      const [d, v] = await Promise.all([
        adminFetch('GET', withPage(`/api/v1/admin/landing-analytics${qs}`, sel), undefined, { cache: false }),
        adminFetch('GET', withPage(`/api/v1/admin/landing-analytics/recent?limit=150`, sel), undefined, { cache: false }).catch(() => null),
      ]);
      setData(d);
      setVisits(v && Array.isArray(v.data) ? v.data : []);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(range, customFrom, customTo); /* eslint-disable-next-line */ }, [range, customFrom, customTo, sel]);

  const loadToday = useCallback(async () => {
    const t = KST_TODAY();
    const y = addDaysYmd(t, -1);
    const [td, yd] = await Promise.all([
      adminFetch('GET', withPage(`/api/v1/admin/landing-analytics?from=${encodeURIComponent(kstStartISO(t))}`, sel), undefined, { cache: false }).catch(() => null),
      adminFetch('GET', withPage(`/api/v1/admin/landing-analytics?from=${encodeURIComponent(kstStartISO(y))}&to=${encodeURIComponent(kstEndISO(y))}`, sel), undefined, { cache: false }).catch(() => null),
    ]);
    setTodayData(td ?? null);
    setYesterday(yd ? { visits: yd.totalVisits || 0, conversions: yd.totalConversions || 0 } : null);
  }, [sel]);
  useEffect(() => { loadToday(); }, [loadToday]);

  const loadMonth = useCallback(async () => {
    try {
      const g = monthGrid(monthOffset);
      const cur = monthFirstLast(monthOffset);
      const today = KST_TODAY();
      // 지난달 같은 기간 — 이번 달이면 1일~오늘과 같은 날까지(지난달이 짧으면 말일), 지난 달이면 한 달 전체
      const pm = monthFirstLast(monthOffset - 1);
      const span = monthOffset === 0 ? Number(today.slice(8, 10)) : 31;
      const pmEnd = `${pm.first.slice(0, 8)}${pad2(Math.min(span, Number(pm.last.slice(8, 10))))}`;
      const q = (from: string, to: string) => withPage(`/api/v1/admin/landing-analytics?from=${encodeURIComponent(kstStartISO(from))}&to=${encodeURIComponent(kstEndISO(to))}`, sel);
      const [grid, exact, prev, spend] = await Promise.all([
        adminFetch('GET', q(g.gridStart, g.gridEnd), undefined, { cache: false }).catch(() => null),
        adminFetch('GET', q(cur.first, cur.last), undefined, { cache: false }).catch(() => null),
        adminFetch('GET', q(pm.first, pmEnd), undefined, { cache: false }).catch(() => null),
        adminFetch('GET', `/api/v1/admin/landing-analytics/ad-spend?month=${cur.first.slice(0, 7)}`, undefined, { cache: false }).catch(() => null),
      ]);
      setMonthData(grid ?? null);
      setMonthExact(exact ?? null);
      setPrevSame(prev ? { visits: prev.totalVisits || 0, conversions: prev.totalConversions || 0 } : null);
      const map: Record<string, number> = {};
      for (const it of (spend?.items ?? [])) map[it.channel] = Number(it.amount) || 0;
      setAdSpend(map);
    } catch { /* 칸만 비워 둔다 */ }
  }, [monthOffset, sel]);
  useEffect(() => { loadMonth(); }, [loadMonth]);

  // 머리 오른쪽 새로고침(종 옆)
  useAdminRefresh(() => { load(range); loadToday(); loadMonth(); });

  // ── 달력에서 고른 날(하루) — 숫자 줄 앞 두 칸·유입 경로가 그날 기준 ──
  const pickedDate = customFrom && customFrom === customTo ? customFrom : '';
  const pickDay = (day: string) => {
    if (pickedDate === day) { setCustomFrom(''); setCustomTo(''); return; }
    setCustomFrom(day);
    setCustomTo(day);
  };
  const clearCustom = () => { setCustomFrom(''); setCustomTo(''); };
  const pageStat = data?.pages?.[0];
  const dayAgg = pickedDate
    ? { label: md(pickedDate), totals: loading ? null : { visits: data?.totalVisits || 0, conversions: data?.totalConversions || 0 }, rows: loading ? null : pageStat?.bySource || [] }
    : { label: '오늘', totals: todayData ? { visits: todayData.totalVisits || 0, conversions: todayData.totalConversions || 0 } : null, rows: todayData ? todayData.pages?.[0]?.bySource || [] : null };

  // ── 표시월 ──
  const g = monthGrid(monthOffset);
  const monthNo = g.month + 1;
  const monthTotals: Totals | null = monthExact ? { visits: monthExact.totalVisits || 0, conversions: monthExact.totalConversions || 0 } : null;
  const monthRows = monthExact?.pages?.[0]?.bySource || [];

  // 집행 일수 — 광고비는 '하루 집행액'이라 월 누적은 일수를 곱한다. 이번 달은 오늘까지만(아직 안 온 날은 안 쓴 돈)
  const spendDays = useMemo(() => {
    const { first, last } = monthFirstLast(monthOffset);
    const today = KST_TODAY();
    const end = last > today ? today : last;
    if (end < first) return 0;
    return Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${first}T00:00:00Z`)) / 86400000) + 1;
  }, [monthOffset]);

  // 광고 효율 — 채널별 집행비 대비 방문·신청(표시월 1일~말일)
  const adRows = useMemo(() => {
    const bySrc = new Map<string, Totals>();
    for (const p of monthExact?.pages ?? []) {
      for (const b of p.bySource) {
        const k = String(b.key).toLowerCase().trim();
        const e = bySrc.get(k) || { visits: 0, conversions: 0 };
        e.visits += b.visits;
        e.conversions += b.conversions;
        bySrc.set(k, e);
      }
    }
    const rows = AD_CHANNELS.map((c) => {
      let v = 0;
      let cv = 0;
      for (const s of c.sources) {
        const e = bySrc.get(s);
        if (e) { v += e.visits; cv += e.conversions; }
      }
      const daily = adSpend[c.key] || 0;
      const spend = daily * spendDays;
      return {
        ...c,
        daily,
        spend,
        visits: v,
        conversions: cv,
        cpa: cv > 0 && spend > 0 ? spend / cv : null,
        cpc: v > 0 && spend > 0 ? spend / v : null,
        cvr: v > 0 ? cv / v : 0,
      };
    });
    const total = rows.reduce(
      (a, r) => ({ daily: a.daily + r.daily, spend: a.spend + r.spend, visits: a.visits + r.visits, conversions: a.conversions + r.conversions }),
      { daily: 0, spend: 0, visits: 0, conversions: 0 },
    );
    return { rows, total };
  }, [monthExact, adSpend, spendDays]);

  const startSpendEdit = () => {
    const d: Record<string, string> = {};
    AD_CHANNELS.forEach((c) => { d[c.key] = adSpend[c.key] ? String(adSpend[c.key]) : ''; });
    setSpendDraft(d);
    setSpendEditing(true);
  };
  const saveAdSpend = async () => {
    if (spendSaving) return;
    setSpendSaving(true);
    const ym = monthFirstLast(monthOffset).first.slice(0, 7);
    try {
      const next: Record<string, number> = { ...adSpend };
      await Promise.all(AD_CHANNELS.map(async (c) => {
        const raw = spendDraft[c.key];
        if (raw === undefined) return;
        const amount = Math.max(0, Number(String(raw).replace(/[^0-9]/g, '')) || 0);
        if (amount === (adSpend[c.key] || 0)) return;
        await adminFetch('POST', '/api/v1/admin/landing-analytics/ad-spend', { month: ym, channel: c.key, amount }, { cache: false });
        next[c.key] = amount;
      }));
      setAdSpend(next);
      setSpendEditing(false);
    } catch { /* 저장 실패 — 입력칸을 그대로 둔다 */ } finally {
      setSpendSaving(false);
    }
  };

  // ── 한 줄 브리핑 — 지난달 '같은 기간'과 견준다(이번 달 며칠치를 지난달 한 달 전체와 견주면 늘 크게 줄어 보였다) ──
  const briefing = useMemo(() => {
    if (!monthTotals || !prevSame) return null;
    const cur = monthTotals.visits;
    const prev = prevSame.visits;
    if (cur === 0 && prev === 0) return <>아직 방문 기록이 없어요</>;
    if (prev === 0) return <>지난달 같은 기간엔 방문 기록이 없었어요</>;
    const diff = cur - prev;
    const p = Math.round((Math.abs(diff) / prev) * 100);
    if (p < 5) return <>지난달 같은 기간과 비슷하게 들어오는 중</>;
    return diff > 0
      ? <>지난달 같은 기간보다 방문이 <b style={{ color: '#3182F6' }}>{p}%</b> 늘었어요</>
      : <>지난달 같은 기간보다 방문이 <b style={{ color: '#F04452' }}>{p}%</b> 줄었어요</>;
  }, [monthTotals, prevSame]);
  const spanText = (() => {
    const cur = monthFirstLast(monthOffset);
    const today = KST_TODAY();
    const end = monthOffset === 0 && cur.last > today ? today : cur.last;
    return `${md(cur.first)} ~ ${md(end)} · 지난달 같은 기간 ${prevSame ? `${num(prevSame.visits)}회` : '—'}`;
  })();

  const calMap = useMemo(() => new Map((monthData?.daily ?? []).map((d) => [d.date, d])), [monthData]);
  const todayYmd = KST_TODAY();
  const dailyBudget = adRows.total.daily;

  const dimRows = (dim === 'source' ? pageStat?.bySource : dim === 'medium' ? pageStat?.byMedium : pageStat?.byCampaign) || [];
  const periodText = customFrom && customTo && customFrom !== customTo
    ? `${md(customFrom < customTo ? customFrom : customTo)} ~ ${md(customFrom < customTo ? customTo : customFrom)}`
    : customActive ? md(customFrom || customTo) : range === 'all' ? '전체 기간' : `최근 ${range}일`;

  const cvrOf = (t: Totals | null) => (t && t.visits > 0 ? pct(t.conversions / t.visits) : '—');

  return (
    <div className="w-full adm-la">
      {/* 머리 = 제목 자리 큰 글씨 탭(261005 사장 '퀵매칭 · 웨딩MC · 비즈MC — 누르면 검정, 나머지 회색'). 레이아웃 머리는 이 화면에서 숨긴다 */}
      <div className="adm-head">
        <div className="adm-title-tabs" role="tablist" aria-label="페이지">
          {PAGE_TABS.map((t) => (
            <button key={t.key} type="button" role="tab" aria-selected={sel === t.key} className={`adm-title-tab ${sel === t.key ? 'on' : ''}`} onClick={() => pickPage(t.key)}>
              {t.label}
            </button>
          ))}
        </div>
        <p className="adm-desc" key={sel}>{tab.desc}</p>
      </div>

      {/* 가운데 = 숫자·달력·카드 차례로(스택), 오른쪽 = 방문 기록(261006 사장 '방문 기록은 우측에') */}
      <div className="adm-la-layout">
      <div className="adm-la-main">
      {/* 숫자 줄 — 홈 상단과 같은 박스 없는 다이얼 6칸 */}
      <section className="adm-la-top" aria-label="오늘과 이번 달 숫자">
        <div className="adm-la-kpis" key={`${sel}-${monthOffset}`}>
          <Kpi
            label={`${dayAgg.label} 방문`}
            value={dayAgg.totals?.visits ?? null}
            unit="회"
            sub={pickedDate ? '달력에서 다시 누르면 오늘로' : `어제 ${yesterday ? `${num(yesterday.visits)}회` : '—'}`}
          />
          <Kpi label={`${dayAgg.label} ${conv}`} value={dayAgg.totals?.conversions ?? null} unit="건" tone="#03A35F" sub={`전환율 ${cvrOf(dayAgg.totals)}`} />
          <Kpi label={`${monthNo}월 방문`} value={monthTotals?.visits ?? null} unit="회" sub={`지난달 같은 기간 ${prevSame ? `${num(prevSame.visits)}회` : '—'}`} />
          <Kpi label={`${monthNo}월 ${conv}`} value={monthTotals?.conversions ?? null} unit="건" tone="#03A35F" sub={`전환율 ${cvrOf(monthTotals)}`} />
          <Kpi label={`${monthNo}월 광고비`} value={monthExact ? adRows.total.spend : null} unit="원" sub={adRows.total.daily ? `하루 ${won(adRows.total.daily)} × ${spendDays}일` : '광고비 입력 전'} />
          <Kpi
            label={`${conv} 1건당 광고비`}
            value={monthExact ? (adRows.total.conversions > 0 && adRows.total.spend > 0 ? adRows.total.spend / adRows.total.conversions : null) : null}
            unit="원"
            tone="#3182F6"
            sub={adRows.total.visits > 0 && adRows.total.spend > 0 ? `방문당 ${won(adRows.total.spend / adRows.total.visits)}` : '광고비·신청이 있어야 계산돼요'}
          />
        </div>
        <div className="adm-money-line" />

        {/* 한 줄 브리핑 + 달 넘기기 */}
        <div className="adm-la-mid">
          <div className="min-w-0">
            <p className="adm-money-say">{briefing || <span className="adm-money-wait">불러오는 중</span>}</p>
            <p className="adm-la-mid-sub">{spanText}</p>
          </div>
          <div className="adm-la-monthnav">
            <b>{g.year}년 {monthNo}월</b>
            <button type="button" className="adm-btn icon sm" onClick={() => setMonthOffset((v) => v - 1)} aria-label="지난달"><Chev dir="l" /></button>
            <button type="button" className="adm-btn icon sm" onClick={() => setMonthOffset((v) => Math.min(0, v + 1))} disabled={monthOffset >= 0} aria-label="다음 달"><Chev dir="r" /></button>
          </div>
        </div>

        {/* 달력 — 홈 달력 어법(박스 없음): 날짜 · 방문(파랑) · 신청(초록). 날짜를 누르면 위 앞 두 칸·아래 유입이 그날 기준 */}
        <div className="adm-la-cal" key={`cal-${sel}-${monthOffset}`}>
          <div className="adm-la-cal-head" aria-hidden="true">{WD.map((w) => <span key={w}>{w}</span>)}</div>
          {Array.from({ length: g.cells.length / 7 }, (_, r) => (
            <div key={r} className="adm-la-cal-row" style={{ animationDelay: `${r * 0.04}s` }}>
              {g.cells.slice(r * 7, r * 7 + 7).map((c) => {
                const rec = calMap.get(c.key);
                const v = rec?.visits || 0;
                const cv = rec?.conversions || 0;
                const future = c.key > todayYmd;
                const shownVals = c.inMonth && !future;
                const tip = shownVals
                  ? `${md(c.key)} · 방문 ${num(v)}회 · ${conv} ${num(cv)}건${dailyBudget > 0 && v > 0 ? ` · 방문당 ${won(dailyBudget / v)}` : ''}${dailyBudget > 0 && cv > 0 ? ` · ${conv}당 ${won(dailyBudget / cv)}` : ''}`
                  : undefined;
                return (
                  <button
                    key={c.key}
                    type="button"
                    className={`adm-la-cell ${c.inMonth ? '' : 'out'} ${future ? 'future' : ''} ${c.key === todayYmd ? 'today' : ''} ${pickedDate === c.key ? 'pick' : ''}`}
                    disabled={!shownVals}
                    onClick={() => pickDay(c.key)}
                    aria-pressed={pickedDate === c.key}
                    title={tip}
                    aria-label={tip || `${md(c.key)}`}
                  >
                    <span className="adm-la-day">{c.day}</span>
                    <span className="adm-la-v">{shownVals && v > 0 ? num(v) : ''}</span>
                    <span className="adm-la-c">{shownVals && cv > 0 ? `${conv.replace(/^견적\s*/, '')} ${num(cv)}` : ''}</span>
                  </button>
                );
              })}
            </div>
          ))}
          <div className="adm-la-legend">
            <span className="v">방문</span>
            <span className="c">{conv}</span>
            <span className="hint">{pickedDate ? <>{md(pickedDate)} 보는 중 · <button type="button" onClick={clearCustom}>오늘로</button></> : '날짜를 누르면 그날 기준으로 바뀌어요 · 칸에 대면 광고비 대비 비용'}</span>
          </div>
        </div>
      </section>

      {/* 유입 경로 — 오늘(또는 고른 날) | 이번 달 */}
      <div className="adm-grid adm-la-row2">
        <div className="adm-card">
          <div className="adm-card-head">
            <div className="min-w-0">
              <h2 className="adm-card-title">{dayAgg.label} 유입 경로</h2>
              <p className="adm-card-sub">{dayAgg.totals ? `방문 ${num(dayAgg.totals.visits)}회 · ${conv} ${num(dayAgg.totals.conversions)}건` : '불러오는 중'}</p>
            </div>
          </div>
          {dayAgg.rows == null ? <div className="space-y-3">{[0, 1, 2].map((i) => <div key={i} className="adm-skel h-[40px]" />)}</div> : <RankRows key={`d-${sel}-${pickedDate}`} rows={dayAgg.rows} conv={conv} empty={`${dayAgg.label} 방문 기록이 없어요`} />}
        </div>
        <div className="adm-card">
          <div className="adm-card-head">
            <div className="min-w-0">
              <h2 className="adm-card-title">{monthNo}월 유입 경로</h2>
              <p className="adm-card-sub">{monthTotals ? `방문 ${num(monthTotals.visits)}회 · ${conv} ${num(monthTotals.conversions)}건` : '불러오는 중'}</p>
            </div>
          </div>
          {!monthExact ? <div className="space-y-3">{[0, 1, 2].map((i) => <div key={i} className="adm-skel h-[40px]" />)}</div> : <RankRows key={`m-${sel}-${monthOffset}`} rows={monthRows} conv={conv} empty={`${monthNo}월 방문 기록이 없어요`} />}
        </div>
      </div>

      {/* 광고 효율 — 채널별 하루 집행액(직접 입력) 대비 방문·신청 */}
      <div className="adm-card adm-la-ad">
        <div className="adm-card-head">
          <div className="min-w-0">
            <h2 className="adm-card-title">광고 효율</h2>
            <p className="adm-card-sub">하루 집행액 기준 · {monthNo}월 {spendDays}일치 누적 · 메타 = 인스타·페북·스레드</p>
          </div>
          {spendEditing ? (
            <span className="inline-flex flex-none gap-1.5">
              <button type="button" className="adm-btn sm" onClick={() => setSpendEditing(false)} disabled={spendSaving}>취소</button>
              <button type="button" className="adm-btn primary sm" onClick={saveAdSpend} disabled={spendSaving}>{spendSaving ? '저장 중' : '저장'}</button>
            </span>
          ) : (
            <button type="button" className="adm-btn weak sm flex-none" onClick={startSpendEdit}>광고비 입력</button>
          )}
        </div>
        <div className="adm-mini-grid">
          <div className="adm-mini"><p>하루 집행액</p><b><RollingNumber value={adRows.total.daily} /><small>원</small></b></div>
          <div className="adm-mini"><p>{monthNo}월 누적</p><b><RollingNumber value={adRows.total.spend} /><small>원</small></b></div>
          <div className="adm-mini"><p>광고 채널 {conv}</p><b><RollingNumber value={adRows.total.conversions} /><small>건 · {adRows.total.visits > 0 ? pct(adRows.total.conversions / adRows.total.visits) : '—'}</small></b></div>
          <div className="adm-mini"><p>{conv} 1건당</p><b>{adRows.total.conversions > 0 && adRows.total.spend > 0 ? <><RollingNumber value={Math.round(adRows.total.spend / adRows.total.conversions)} /><small>원</small></> : '—'}</b></div>
        </div>
        <AdminTableScroll edge={false} className="mt-4">
          <table className="adm-table adm-la-adtable">
            <thead>
              <tr>
                <th>채널</th>
                <th className="r">하루 집행액</th>
                <th className="r">방문</th>
                <th className="r">{conv}</th>
                <th className="r">전환율</th>
                <th className="r">{conv}당</th>
                <th className="r">방문당</th>
              </tr>
            </thead>
            <tbody>
              {adRows.rows.map((r) => (
                <tr key={r.key}>
                  <td>
                    <span className="adm-la-src">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={`/admin-icons/${r.icon}.svg`} alt="" width={20} height={20} className="adm-la-srcimg" />
                      <span className="adm-la-src-name">{r.label}</span>
                    </span>
                  </td>
                  <td className="r">
                    {spendEditing ? (
                      <span className="adm-la-spend">
                        <input
                          type="text"
                          inputMode="numeric"
                          value={spendDraft[r.key] ?? ''}
                          onChange={(e) => setSpendDraft((p) => ({ ...p, [r.key]: e.target.value.replace(/[^0-9]/g, '') }))}
                          placeholder="0"
                          className="adm-input sm"
                          aria-label={`${r.label} 하루 집행액`}
                        />
                        <small>원/일</small>
                      </span>
                    ) : r.daily > 0 ? <b className="adm-la-num">{won(r.daily)}</b> : <span className="adm-la-dim">미입력</span>}
                  </td>
                  <td className="r adm-la-num">{num(r.visits)}</td>
                  <td className="r adm-la-num">{r.conversions ? <b className="adm-la-conv">{num(r.conversions)}</b> : '0'}</td>
                  <td className="r adm-la-num">{pct(r.cvr)}</td>
                  <td className="r adm-la-num">{r.cpa != null ? won(r.cpa) : <span className="adm-la-dim">—</span>}</td>
                  <td className="r adm-la-num">{r.cpc != null ? won(r.cpc) : <span className="adm-la-dim">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </AdminTableScroll>
        <p className="adm-la-foot">월 누적 = 하루 집행액 × 집행 일수(이번 달은 오늘까지) · {conv}당 = 누적 집행액 ÷ {conv} 수(CPA) · 달력 칸에 마우스를 대면 그날 방문당·{conv}당 비용</p>
      </div>

      {/* 유입 상세 — 소스 · 매체 · 캠페인, 기간 고르기 */}
      <div className="adm-card">
        <div className="adm-card-head adm-la-detail-head">
          <div className="min-w-0">
            <h2 className="adm-card-title">유입 상세</h2>
            <p className="adm-card-sub">{periodText} · 방문 {num(pageStat?.visits || 0)}회 · {conv} {num(pageStat?.conversions || 0)}건 · 전환율 {pct(pageStat?.rate || 0)}</p>
          </div>
          <div className="adm-la-ctl">
            <div className="adm-seg" role="tablist" aria-label="나눠 보기">
              {DIMS.map((d) => (
                <button key={d.key} type="button" role="tab" aria-selected={dim === d.key} className={dim === d.key ? 'on' : ''} onClick={() => setDim(d.key)}>{d.label}</button>
              ))}
            </div>
            <div className="adm-seg" role="tablist" aria-label="기간">
              {RANGES.map((r) => (
                <button key={r.key} type="button" role="tab" aria-selected={!customActive && range === r.key} className={!customActive && range === r.key ? 'on' : ''} onClick={() => { clearCustom(); setRange(r.key); }}>{r.label}</button>
              ))}
            </div>
            {/* 직접 고르기 — 다른 목록과 같은 그 자리 달력(하루만 고르면 그날 하루) */}
            <span className="adm-la-range">
              <AdminDatePop value={customFrom} onChange={setCustomFrom} placeholder="시작일" ariaLabel="시작일" rangeStart={customFrom} rangeEnd={customTo} />
              <span aria-hidden="true">~</span>
              <AdminDatePop value={customTo} onChange={setCustomTo} placeholder="종료일" ariaLabel="종료일" rangeStart={customFrom} rangeEnd={customTo} />
              {customActive && (
                <button type="button" className="adm-btn icon sm" onClick={clearCustom} aria-label="날짜 고르기 풀기">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" /></svg>
                </button>
              )}
            </span>
          </div>
        </div>
        {loading && !data ? (
          <div className="space-y-3">{[0, 1, 2, 3].map((i) => <div key={i} className="adm-skel h-[40px]" />)}</div>
        ) : !data ? (
          <p className="adm-la-empty">데이터를 불러오지 못했어요</p>
        ) : (
          <RankRows key={`${dim}-${sel}-${periodText}`} rows={dimRows} conv={conv} icon={dim === 'source'} empty="이 기간 유입 기록이 없어요" />
        )}
      </div>

      </div>

      <aside className="adm-la-side" aria-label="방문 기록">
        <VisitFeed visits={visits} conv={conv} sel={sel} />
      </aside>
      </div>
    </div>
  );
}

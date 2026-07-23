'use client';

import { useEffect, useMemo, useState } from 'react';
import { RefreshCw, TrendingUp } from '@/app/(admin)/admin/_components/admin-icons';
import { adminFetch } from '../_components/adminFetch';

interface Bucket { key: string; visits: number; conversions: number; rate: number; }
interface PageStat { page: string; visits: number; conversions: number; rate: number; bySource: Bucket[]; byMedium: Bucket[]; byCampaign: Bucket[]; }
interface DailyRow { date: string; visits: number; conversions: number; }
interface Analytics { pages: PageStat[]; totalVisits: number; totalConversions: number; daily: DailyRow[]; today: { date: string; visits: number; conversions: number }; }
interface VisitRow { page: string; source: string | null; medium: string | null; campaign: string | null; referrerHost: string | null; referrer: string | null; converted: boolean; createdAt: string; }

const PAGE_LABEL: Record<string, string> = { 'wedding-mc': '결혼식 사회자 (wedding-mc)', 'corporate-mc': '전문행사 사회자 (corporate-mc)' };
const PAGE_SHORT: Record<string, string> = { 'wedding-mc': '결혼식', 'corporate-mc': '전문행사' };
const RANGES = [
  { key: '7', label: '7일' },
  { key: '30', label: '30일' },
  { key: '90', label: '90일' },
  { key: 'all', label: '전체' },
] as const;

const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
const num = (n: number) => n.toLocaleString('ko-KR');

const KST_TODAY = () => new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
const kstDateOf = (iso: string) => new Date(new Date(iso).getTime() + 9 * 3600000).toISOString().slice(0, 10);

// 표시 월(offset 0=이번달, -1=저번달…)의 달력 그리드: 앞뒤 달 spillover 포함 6주 셀
interface CalCell { key: string; day: number; weekday: number; inMonth: boolean; }
function monthGrid(offset: number): { year: number; month: number; cells: CalCell[]; gridStart: string; gridEnd: string } {
  const kstNow = new Date(Date.now() + 9 * 3600000);
  const first = new Date(Date.UTC(kstNow.getUTCFullYear(), kstNow.getUTCMonth() + offset, 1)); // 표시월 1일(UTC=KST일자표현)
  const year = first.getUTCFullYear();
  const month = first.getUTCMonth();
  const firstWeekday = first.getUTCDay(); // 0=일
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const gridStart = first.getTime() - firstWeekday * 86400000; // 1일이 속한 주의 일요일
  const totalCells = Math.ceil((firstWeekday + daysInMonth) / 7) * 7;
  const cells: CalCell[] = [];
  for (let i = 0; i < totalCells; i++) {
    const dt = new Date(gridStart + i * 86400000);
    cells.push({ key: dt.toISOString().slice(0, 10), day: dt.getUTCDate(), weekday: dt.getUTCDay(), inMonth: dt.getUTCMonth() === month });
  }
  return { year, month, cells, gridStart: cells[0].key, gridEnd: cells[cells.length - 1].key };
}

// 방문 로그 1행 → 유입 소스 키(utm 우선, 없으면 리퍼러 호스트로 추정)
function srcKeyOf(v: { source: string | null; referrerHost: string | null }): string {
  if (v.source && v.source.trim()) return v.source.trim();
  const h = (v.referrerHost || '').toLowerCase();
  if (!h) return '직접/기타';
  if (h.includes('instagram')) return 'instagram';
  if (h.includes('threads')) return 'threads';
  if (h.includes('facebook')) return 'facebook';
  if (h.includes('naver')) return 'naver';
  if (h.includes('youtube') || h.includes('youtu.be')) return 'youtube';
  if (h.includes('tiktok')) return 'tiktok';
  if (h.includes('kakao')) return 'kakao';
  if (h.includes('google')) return 'google';
  return h;
}

// 유입 소스 → 브랜드 아이콘(public/admin-icons/src-*.svg)
const SOURCE_ICON: Record<string, string> = {
  instagram: 'src-instagram', insta: 'src-instagram', ig: 'src-instagram',
  facebook: 'src-facebook', fb: 'src-facebook', 'facebook.com': 'src-facebook',
  meta: 'src-meta',
  threads: 'src-threads', 'threads.net': 'src-threads',
  naver: 'src-naver', 'naver.com': 'src-naver', 'blog.naver.com': 'src-naver',
};
function sourceIconFile(key?: string | null): string | null {
  if (!key) return null;
  const k = String(key).toLowerCase().trim();
  if (SOURCE_ICON[k]) return SOURCE_ICON[k];
  if (k.includes('instagram')) return 'src-instagram';
  if (k.includes('facebook')) return 'src-facebook';
  if (k.includes('threads')) return 'src-threads';
  if (k.includes('naver')) return 'src-naver';
  if (k.includes('meta')) return 'src-meta';
  return null;
}
// 소스 키 → 사람이 읽는 라벨
const SOURCE_NAME: Record<string, string> = {
  instagram: '인스타그램', facebook: '페이스북', meta: '메타', threads: '스레드',
  naver: '네이버', youtube: '유튜브', tiktok: '틱톡', kakao: '카카오', google: '구글',
};
const srcLabel = (k: string) => SOURCE_NAME[k.toLowerCase()] || k;
function SourceLabel({ value, className = '' }: { value: string; className?: string }) {
  const file = sourceIconFile(value);
  return (
    <span className={`inline-flex min-w-0 items-center gap-1.5 ${className}`}>
      {file && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={`/admin-icons/${file}.svg`} alt="" width={16} height={16} className="shrink-0 rounded-[3px]" />
      )}
      <span className="truncate">{value}</span>
    </span>
  );
}

const DONUT_COLORS = ['#3182F6', '#00C2B3', '#FF7043', '#845EF7', '#FFB020', '#F45B8B', '#4E9BFF', '#22C55E', '#EC4899', '#14B8A6', '#F97316', '#A0AEC0'];

function Donut({ title, rows }: { title: string; rows: Bucket[] }) {
  const shown = rows.slice(0, 12);
  const total = shown.reduce((s, r) => s + r.visits, 0);
  const R = 42;
  const C = 2 * Math.PI * R;
  let acc = 0;
  const segs = shown.map((r, i) => {
    const len = total > 0 ? (r.visits / total) * C : 0;
    const seg = { color: DONUT_COLORS[i % DONUT_COLORS.length], len, offset: acc };
    acc += len;
    return seg;
  });
  return (
    <div className="rounded-3xl bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
      <h4 className="mb-4 text-[14px] font-bold text-gray-800">{title}</h4>
      {shown.length === 0 || total === 0 ? (
        <p className="text-[13px] text-gray-400">데이터 없음</p>
      ) : (
        <div className="flex items-center gap-5">
          {/* 도넛 */}
          <div className="relative shrink-0" style={{ width: 116, height: 116 }}>
            <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
              <circle cx="50" cy="50" r={R} fill="none" stroke="#F1F3F5" strokeWidth="15" />
              {segs.map((s, i) => (
                <circle key={i} cx="50" cy="50" r={R} fill="none" stroke={s.color} strokeWidth="15"
                  strokeDasharray={`${s.len} ${C - s.len}`} strokeDashoffset={-s.offset} />
              ))}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-[18px] font-extrabold leading-none tabular-nums text-gray-900">{num(total)}</span>
              <span className="mt-0.5 text-[10px] text-gray-400">방문</span>
            </div>
          </div>
          {/* 범례 (비율) */}
          <div className="min-w-0 flex-1 space-y-1.5">
            {shown.map((r, i) => {
              const frac = total > 0 ? r.visits / total : 0;
              return (
                <div key={r.key} className="flex items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: DONUT_COLORS[i % DONUT_COLORS.length] }} />
                    <SourceLabel value={r.key} className="truncate text-[12px] font-medium text-gray-700" />
                  </span>
                  <span className="shrink-0 text-[11px] tabular-nums text-gray-400">
                    <b className="text-gray-800">{pct(frac)}</b> · {num(r.visits)}
                    {r.conversions > 0 && <> · 전환 <b className="text-[#3182F6]">{num(r.conversions)}</b></>}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// 목업 상단 카드 — 제목 + 큰 수치 + 유입처 리스트(아이콘·이름 … 수치)
function SourceCard({ title, value, unit, tone = 'text-gray-900', rows, empty = '유입 기록 없음' }:
  { title: string; value: number; unit: string; tone?: string; rows: { key: string; count: number }[]; empty?: string }) {
  return (
    <div className="rounded-3xl bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
      <p className="text-[13px] text-gray-500">{title}</p>
      <p className={`mt-1 text-[26px] font-black leading-none ${tone}`}>{num(value)}<span className="ml-1 text-[14px] font-bold text-gray-400">{unit}</span></p>
      <div className="mt-4 space-y-2.5">
        {rows.length === 0 ? (
          <p className="text-[12px] text-gray-300">{empty}</p>
        ) : rows.slice(0, 6).map((r) => (
          <div key={r.key} className="flex items-center justify-between gap-2">
            <span className="flex min-w-0 items-center gap-2">
              {sourceIconFile(r.key)
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={`/admin-icons/${sourceIconFile(r.key)}.svg`} alt="" width={18} height={18} className="shrink-0 rounded-full" />
                : <span className="h-[18px] w-[18px] shrink-0 rounded-full bg-gray-200" />}
              <span className="truncate text-[13px] text-gray-600">{srcLabel(r.key)}</span>
            </span>
            <span className="shrink-0 text-[14px] font-bold tabular-nums text-gray-900">{num(r.count)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function LandingAnalyticsPage() {
  const [data, setData] = useState<Analytics | null>(null);
  const [visits, setVisits] = useState<VisitRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<string>('30');
  const [customFrom, setCustomFrom] = useState<string>('');
  const [customTo, setCustomTo] = useState<string>('');
  const customActive = !!(customFrom || customTo);
  const [monthData, setMonthData] = useState<Analytics | null>(null);
  const [monthOffset, setMonthOffset] = useState(0); // 0=이번달, -1=저번달…

  const load = async (r: string, from = customFrom, to = customTo) => {
    setLoading(true);
    try {
      let qs = '';
      if (from || to) {
        // 단일 날짜 선택 시 그날 하루만(to 미지정이면 from 하루). 둘 다면 범위. (KST 하루 경계)
        const effFrom = from || to;
        const effTo = to || from;
        const parts: string[] = [];
        if (effFrom) parts.push(`from=${encodeURIComponent(new Date(`${effFrom}T00:00:00+09:00`).toISOString())}`);
        if (effTo) parts.push(`to=${encodeURIComponent(new Date(`${effTo}T23:59:59.999+09:00`).toISOString())}`);
        qs = `?${parts.join('&')}`;
      } else if (r !== 'all') {
        const fromISO = new Date(Date.now() - Number(r) * 86400000).toISOString();
        qs = `?from=${encodeURIComponent(fromISO)}`;
      }
      const [d, v] = await Promise.all([
        adminFetch('GET', `/api/v1/admin/landing-analytics${qs}`, undefined, { cache: false }),
        adminFetch('GET', `/api/v1/admin/landing-analytics/recent?limit=150`, undefined, { cache: false }).catch(() => null),
      ]);
      setData(d);
      setVisits(v && Array.isArray(v.data) ? v.data : []);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(range, customFrom, customTo); /* eslint-disable-next-line */ }, [range, customFrom, customTo]);

  // 달력용 데이터 — 메인 필터와 무관하게 표시월(monthOffset) 그리드 범위 전체
  useEffect(() => {
    (async () => {
      try {
        const g = monthGrid(monthOffset);
        const from = new Date(`${g.gridStart}T00:00:00+09:00`).toISOString();
        const to = new Date(`${g.gridEnd}T23:59:59.999+09:00`).toISOString();
        const d = await adminFetch('GET', `/api/v1/admin/landing-analytics?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, undefined, { cache: false });
        setMonthData(d ?? null);
      } catch {}
    })();
  }, [monthOffset]);

  const fmtDT = (iso: string) => { const d = new Date(iso); return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };

  // ── 오늘(KST) 방문/신청 + 유입처 — 방문 로그에서 직접 계산(필터·월 이동과 무관) ──
  const groupBySrc = (rows: VisitRow[]) => {
    const m = new Map<string, number>();
    for (const v of rows) m.set(srcKeyOf(v), (m.get(srcKeyOf(v)) || 0) + 1);
    return Array.from(m.entries()).map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count);
  };
  const todayAgg = useMemo(() => {
    const t = KST_TODAY();
    const rows = (visits ?? []).filter((v) => kstDateOf(v.createdAt) === t);
    return {
      visits: rows.length,
      conversions: rows.filter((v) => v.converted).length,
      bySource: groupBySrc(rows),
      byConvSource: groupBySrc(rows.filter((v) => v.converted)),
    };
  }, [visits]);

  // ── 표시월 총 방문 + 유입처(달력 그리드 응답의 pages 합산) ──
  const g = monthGrid(monthOffset);
  const monthAgg = useMemo(() => {
    const dmap = new Map((monthData?.daily ?? []).map((d) => [d.date, d]));
    let visitsSum = 0, convSum = 0;
    for (const c of g.cells) if (c.inMonth) { const r = dmap.get(c.key); visitsSum += r?.visits || 0; convSum += r?.conversions || 0; }
    const sm = new Map<string, number>();
    for (const p of monthData?.pages ?? []) for (const b of p.bySource) sm.set(b.key, (sm.get(b.key) || 0) + b.visits);
    const bySource = Array.from(sm.entries()).map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count);
    return { visits: visitsSum, conversions: convSum, bySource };
  }, [monthData, monthOffset]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── 달력에서 하루 선택 시(customFrom===customTo) 상단 카드를 그 날짜 기준으로 ──
  const pickedDate = customFrom && customFrom === customTo ? customFrom : '';
  const pickedLabel = pickedDate ? `${Number(pickedDate.slice(5, 7))}월 ${Number(pickedDate.slice(8, 10))}일` : '';
  const pickedAgg = useMemo(() => {
    if (!pickedDate || !data) return null; // data는 선택 시 그날 하루로 필터돼 옴
    const sm = new Map<string, { visits: number; conv: number }>();
    for (const p of data.pages ?? []) for (const b of p.bySource) {
      const e = sm.get(b.key) || { visits: 0, conv: 0 }; e.visits += b.visits; e.conv += b.conversions; sm.set(b.key, e);
    }
    const bySource = Array.from(sm.entries()).map(([key, v]) => ({ key, count: v.visits })).sort((a, b) => b.count - a.count);
    const byConvSource = Array.from(sm.entries()).map(([key, v]) => ({ key, count: v.conv })).filter((r) => r.count > 0).sort((a, b) => b.count - a.count);
    return { visits: data.totalVisits, conversions: data.totalConversions, bySource, byConvSource };
  }, [pickedDate, data]);

  // 상단 카드 1·2(방문/신청) — 선택일이 있으면 그날, 없으면 오늘
  const card1 = pickedDate
    ? { title: `${pickedLabel} 방문`, value: pickedAgg?.visits ?? 0, rows: pickedAgg?.bySource ?? [], empty: '방문 없음' }
    : { title: '오늘 방문', value: todayAgg.visits, rows: todayAgg.bySource, empty: '오늘 방문 없음' };
  const card2 = pickedDate
    ? { title: `${pickedLabel} 견적 신청`, value: pickedAgg?.conversions ?? 0, rows: pickedAgg?.byConvSource ?? [], empty: '신청 없음' }
    : { title: '오늘 견적 신청', value: todayAgg.conversions, rows: todayAgg.byConvSource, empty: '오늘 신청 없음' };

  return (
    <div className="min-h-full w-full bg-[#F2F4F6] px-5 py-6 md:px-8">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-[22px] font-bold text-gray-900"><TrendingUp className="h-6 w-6 text-[#3182F6]" /> 랜딩 유입 분석</h1>
          <p className="mt-1 text-[13px] text-gray-500">wedding-mc · corporate-mc 유입 소스(UTM/리퍼러)별 방문·전환 지표</p>
        </div>
        <button onClick={() => load(range)} className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 text-gray-500 hover:bg-gray-50">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* 상단: (선택일/오늘) 방문 + 어디서 왔는지 리스트 + 이번 달 방문 */}
      <div className="mb-4 grid gap-3 md:grid-cols-3">
        <SourceCard title={card1.title} value={card1.value} unit="회" tone="text-gray-900" rows={card1.rows} empty={card1.empty} />
        <SourceCard title={card2.title} value={card2.value} unit="명" tone="text-emerald-600" rows={card2.rows} empty={card2.empty} />
        <SourceCard title={`${g.month + 1}월 방문`} value={monthAgg.visits} unit="회" tone="text-[#3182F6]" rows={monthAgg.bySource} empty="이번 달 방문 없음" />
      </div>

      {/* 월간 달력 — 토스 정산달력 스타일(테두리 없는 클린 그리드) */}
      {(() => {
        const WD = ['일', '월', '화', '수', '목', '금', '토'];
        const kstToday = KST_TODAY();
        const map = new Map((monthData?.daily ?? []).map((d) => [d.date, d]));
        return (
          <div className="mb-8 rounded-3xl bg-white p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)] md:p-8">
            {/* 헤더: 연·월 + 이동 */}
            <div className="flex items-center gap-3">
              <h3 className="text-[26px] font-extrabold tracking-tight text-gray-900">{g.year}년 {g.month + 1}월</h3>
              <div className="flex items-center gap-1.5">
                <button onClick={() => setMonthOffset((v) => v - 1)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100 text-[15px] text-gray-400 transition hover:bg-gray-200 hover:text-gray-600" aria-label="저번 달">‹</button>
                <button onClick={() => setMonthOffset((v) => Math.min(0, v + 1))} disabled={monthOffset >= 0}
                  className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100 text-[15px] text-gray-400 transition enabled:hover:bg-gray-200 enabled:hover:text-gray-600 disabled:opacity-40" aria-label="다음 달">›</button>
              </div>
            </div>
            {/* 범례 */}
            <div className="mt-6 flex items-center gap-5 border-t border-gray-100 pt-5 text-[13px] text-gray-500">
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[#3182F6]" /> 방문</span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> 견적 신청</span>
            </div>
            {/* 요일 헤더 */}
            <div className="mt-4 grid grid-cols-7">
              {WD.map((w) => (
                <div key={w} className="pb-1 text-[13px] font-medium text-gray-400">{w}</div>
              ))}
            </div>
            {/* 날짜 그리드 (테두리 없음) */}
            <div className="grid grid-cols-7">
              {g.cells.map((c) => {
                const row = map.get(c.key);
                const vis = row?.visits || 0, conv = row?.conversions || 0;
                const active = customFrom === c.key && (customTo === c.key || !customTo);
                const isToday = c.key === kstToday;
                const weekend = c.weekday === 0 || c.weekday === 6;
                const dateColor = !c.inMonth ? (weekend ? 'text-red-200' : 'text-gray-300') : weekend ? 'text-[#F04452]' : 'text-gray-800';
                return (
                  <button key={c.key} onClick={() => { setCustomFrom(c.key); setCustomTo(c.key); }}
                    className="flex min-h-[92px] flex-col items-start px-1 pb-3 pt-2.5 text-left">
                    <span className="flex items-center gap-1">
                      <span className={`inline-flex h-[26px] min-w-[26px] items-center justify-center rounded-full px-1 text-[15px] font-semibold tabular-nums transition ${active ? 'bg-[#3182F6] text-white' : `${dateColor} hover:bg-gray-100`}`}>{c.day}</span>
                      {isToday && !active && <span className="rounded-full bg-red-50 px-1.5 py-[2px] text-[10px] font-bold leading-none text-[#F04452]">오늘</span>}
                    </span>
                    <span className="mt-2 pl-1 leading-tight">
                      {c.inMonth ? (
                        <>
                          <span className={`block text-[13px] font-bold tabular-nums ${vis ? 'text-[#3182F6]' : 'text-gray-300'}`}>{num(vis)}</span>
                          <span className={`block text-[13px] font-bold tabular-nums ${conv ? 'text-emerald-500' : 'text-gray-300'}`}>{num(conv)}</span>
                        </>
                      ) : (
                        <span className="block text-[13px] font-bold tabular-nums text-gray-200">0</span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="mt-2 border-t border-gray-100 pt-4 text-[12px] text-gray-400">날짜를 누르면 위 방문·신청 카드와 아래 유입 소스가 그 날짜 기준으로 바뀌어요.</p>
          </div>
        );
      })()}

      {/* 기간 필터 (아래 페이지별 유입 소스·매체·캠페인에 적용) */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="mr-1 text-[13px] font-semibold text-gray-500">기간</span>
        {RANGES.map((r) => (
          <button key={r.key} onClick={() => { setCustomFrom(''); setCustomTo(''); setRange(r.key); }}
            className={`rounded-full px-4 py-2 text-[13px] font-semibold transition ${range === r.key && !customActive ? 'bg-[#3182F6] text-white' : 'border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
            {r.label}
          </button>
        ))}
        <div className={`ml-1 flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] ${customActive ? 'border-[#3182F6] bg-[#EAF3FF]' : 'border-gray-200'}`}>
          <input type="date" value={customFrom} max={customTo || undefined}
            onChange={(e) => setCustomFrom(e.target.value)}
            className="bg-transparent text-[13px] text-gray-700 outline-none [color-scheme:light]" />
          <span className="text-gray-400">~</span>
          <input type="date" value={customTo} min={customFrom || undefined}
            onChange={(e) => setCustomTo(e.target.value)}
            className="bg-transparent text-[13px] text-gray-700 outline-none [color-scheme:light]" />
          {customActive && (
            <button onClick={() => { setCustomFrom(''); setCustomTo(''); }} className="ml-0.5 rounded-full px-1.5 text-[13px] font-bold text-gray-400 hover:text-gray-600" title="날짜 필터 해제">✕</button>
          )}
        </div>
      </div>

      {/* 페이지별 */}
      {(data?.pages ?? []).map((p) => (
        <section key={p.page} className="mb-10">
          <div className="mb-4 flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <h2 className="text-[17px] font-bold text-gray-900">{PAGE_LABEL[p.page] || p.page}</h2>
            <span className="text-[13px] text-gray-500">방문 <b className="text-gray-800">{num(p.visits)}</b> · 전환 <b className="text-[#3182F6]">{num(p.conversions)}</b> · 전환율 <b className="text-emerald-600">{pct(p.rate)}</b></span>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <Donut title="유입 소스" rows={p.bySource} />
            <Donut title="매체 (medium)" rows={p.byMedium} />
            <Donut title="캠페인 (campaign)" rows={p.byCampaign} />
          </div>
        </section>
      ))}

      {/* 방문 로그 — 어떤 유입으로 들어왔는지 */}
      <div className="mb-8 rounded-3xl bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <h3 className="mb-3 text-[14px] font-bold text-gray-800">방문 로그 <span className="font-medium text-gray-400">(최근순 · 어떤 경로로 유입됐는지)</span></h3>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-[12.5px]">
            <thead>
              <tr className="border-b border-gray-100 text-[11px] text-gray-400">
                <th className="py-2 pr-2 text-left font-semibold">시간</th>
                <th className="py-2 pr-2 text-left font-semibold">랜딩</th>
                <th className="py-2 pr-2 text-left font-semibold">유입 소스</th>
                <th className="py-2 pr-2 text-left font-semibold">매체/캠페인</th>
                <th className="py-2 pr-2 text-left font-semibold">리퍼러</th>
                <th className="py-2 pl-2 text-right font-semibold">견적</th>
              </tr>
            </thead>
            <tbody>
              {(visits ?? []).slice(0, 150).map((v, i) => (
                <tr key={i} className="border-b border-gray-50">
                  <td className="whitespace-nowrap py-2 pr-2 tabular-nums text-gray-500">{fmtDT(v.createdAt)}</td>
                  <td className="py-2 pr-2"><span className="rounded bg-gray-100 px-1.5 py-0.5 text-[11px] font-medium text-gray-600">{PAGE_SHORT[v.page] || v.page}</span></td>
                  <td className="py-2 pr-2 font-semibold text-gray-800">{v.source ? <SourceLabel value={v.source} /> : v.referrerHost ? <SourceLabel value={v.referrerHost} /> : <span className="font-normal text-gray-400">직접/기타</span>}</td>
                  <td className="py-2 pr-2 text-gray-500">{[v.medium, v.campaign].filter(Boolean).join(' · ') || '—'}</td>
                  <td className="max-w-[180px] truncate py-2 pr-2 text-gray-400" title={v.referrer || ''}>{v.referrerHost || '—'}</td>
                  <td className="py-2 pl-2 text-right">{v.converted ? <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[11px] font-bold text-emerald-600">신청</span> : <span className="text-gray-300">–</span>}</td>
                </tr>
              ))}
              {visits != null && visits.length === 0 && (
                <tr><td colSpan={6} className="py-8 text-center text-gray-400">방문 기록이 아직 없습니다</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {!loading && !data && <p className="text-center text-[14px] text-gray-400">데이터를 불러오지 못했습니다.</p>}

      <p className="mt-6 text-[12px] leading-relaxed text-gray-400">
        · 방문은 세션·페이지당 1회 집계됩니다. 전환은 폼 제출(견적/상담 신청) 성공 시 기록됩니다.<br />
        · UTM 파라미터가 없는 유입은 리퍼러(instagram/threads/naver 등)로 소스를 추정하며, 둘 다 없으면 <b>직접/기타</b>로 분류됩니다.<br />
        · 링크 예시: <code className="rounded bg-gray-100 px-1">freetiful.com/wedding-mc?utm_source=instagram&utm_medium=bio&utm_campaign=summer</code>
      </p>
    </div>
  );
}

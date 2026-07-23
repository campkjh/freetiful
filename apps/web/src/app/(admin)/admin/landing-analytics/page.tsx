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

// 특정 주(offset 0=이번주, -1=저번주…)의 KST 날짜 7개(과거→오늘 순)
function weekDates(offset: number): string[] {
  const kstToday = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
  const anchor = new Date(`${kstToday}T00:00:00Z`).getTime() + offset * 7 * 86400000;
  const out: string[] = [];
  for (let i = 6; i >= 0; i--) out.push(new Date(anchor - i * 86400000).toISOString().slice(0, 10));
  return out;
}

// 유입 소스 → 브랜드 아이콘(public/admin-icons/src-*.svg)
const SOURCE_ICON: Record<string, string> = {
  instagram: 'src-instagram', insta: 'src-instagram', ig: 'src-instagram',
  facebook: 'src-facebook', fb: 'src-facebook', 'facebook.com': 'src-facebook',
  meta: 'src-meta',
  threads: 'src-threads', 'threads.net': 'src-threads',
};
function sourceIconFile(key?: string | null): string | null {
  if (!key) return null;
  const k = String(key).toLowerCase().trim();
  if (SOURCE_ICON[k]) return SOURCE_ICON[k];
  if (k.includes('instagram')) return 'src-instagram';
  if (k.includes('facebook')) return 'src-facebook';
  if (k.includes('threads')) return 'src-threads';
  if (k.includes('meta')) return 'src-meta';
  return null;
}
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
    <div className="rounded-2xl border border-gray-100 bg-white p-5">
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

export default function LandingAnalyticsPage() {
  const [data, setData] = useState<Analytics | null>(null);
  const [visits, setVisits] = useState<VisitRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<string>('30');
  const [customFrom, setCustomFrom] = useState<string>('');
  const [customTo, setCustomTo] = useState<string>('');
  const customActive = !!(customFrom || customTo);
  const [weekDaily, setWeekDaily] = useState<DailyRow[]>([]);
  const [weekOffset, setWeekOffset] = useState(0); // 0=이번주, -1=저번주…

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

  // 달력용 데이터 — 메인 필터와 무관하게 해당 주(weekOffset)의 7일치만
  useEffect(() => {
    (async () => {
      try {
        const ds = weekDates(weekOffset);
        const from = new Date(`${ds[0]}T00:00:00+09:00`).toISOString();
        const to = new Date(`${ds[6]}T23:59:59.999+09:00`).toISOString();
        const d = await adminFetch('GET', `/api/v1/admin/landing-analytics?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, undefined, { cache: false });
        setWeekDaily(Array.isArray(d?.daily) ? d.daily : []);
      } catch {}
    })();
  }, [weekOffset]);

  const totalRate = useMemo(() => (data && data.totalVisits ? data.totalConversions / data.totalVisits : 0), [data]);
  const fmtDT = (iso: string) => { const d = new Date(iso); return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-6 md:px-6">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-[22px] font-bold text-gray-900"><TrendingUp className="h-6 w-6 text-[#3182F6]" /> 랜딩 유입 분석</h1>
          <p className="mt-1 text-[13px] text-gray-500">wedding-mc · corporate-mc 유입 소스(UTM/리퍼러)별 방문·전환 지표</p>
        </div>
        <button onClick={() => load(range)} className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 text-gray-500 hover:bg-gray-50">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-2">
        {RANGES.map((r) => (
          <button key={r.key} onClick={() => { setCustomFrom(''); setCustomTo(''); setRange(r.key); }}
            className={`rounded-full px-4 py-2 text-[13px] font-semibold transition ${range === r.key && !customActive ? 'bg-[#3182F6] text-white' : 'border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
            {r.label}
          </button>
        ))}
        {/* 캘린더 날짜 범위 필터 */}
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

      {/* 오늘 요약 (강조) */}
      <div className="mb-4 grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-[#3182F6] p-5 text-white">
          <p className="text-[12px] opacity-80">오늘 방문</p>
          <p className="mt-1 text-[30px] font-black leading-none">{loading ? '…' : num(data?.today?.visits ?? 0)}<span className="ml-1 text-[14px] font-medium opacity-80">회</span></p>
        </div>
        <div className="rounded-2xl bg-emerald-500 p-5 text-white">
          <p className="text-[12px] opacity-80">오늘 견적 신청</p>
          <p className="mt-1 text-[30px] font-black leading-none">{loading ? '…' : num(data?.today?.conversions ?? 0)}<span className="ml-1 text-[14px] font-medium opacity-80">명</span></p>
        </div>
      </div>

      {/* 기간 총계 */}
      <div className="mb-6 grid grid-cols-3 gap-3">
        {[
          { label: '총 방문', value: num(data?.totalVisits ?? 0), tone: 'text-gray-900' },
          { label: '총 견적(전환)', value: num(data?.totalConversions ?? 0), tone: 'text-[#3182F6]' },
          { label: '전환율', value: pct(totalRate), tone: 'text-emerald-600' },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-gray-100 bg-white p-5 text-center">
            <p className="text-[12px] text-gray-400">{s.label}</p>
            <p className={`mt-1 text-[26px] font-bold ${s.tone}`}>{loading ? '…' : s.value}</p>
          </div>
        ))}
      </div>

      {/* 주간 달력 — 좌우 버튼으로 저번주/다음주 이동, 날짜 클릭 시 그날로 필터 */}
      {(() => {
        const WD = ['일', '월', '화', '수', '목', '금', '토'];
        const kstToday = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
        const map = new Map(weekDaily.map((d) => [d.date, d]));
        const ds = weekDates(weekOffset);
        const cells = ds.map((key) => {
          const row = map.get(key);
          return { key, wd: WD[new Date(`${key}T00:00:00Z`).getUTCDay()], dd: key.slice(8), visits: row?.visits || 0, conversions: row?.conversions || 0 };
        });
        const rangeLabel = weekOffset === 0 ? '이번 주' : `${ds[0].slice(5).replace('-', '.')} ~ ${ds[6].slice(5).replace('-', '.')}`;
        return (
          <div className="mb-8 rounded-2xl border border-gray-100 bg-white p-5">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="text-[14px] font-bold text-gray-800">주간 방문 · 신청 (KST) <span className="font-medium text-gray-400">· 날짜를 누르면 그날만 필터돼요</span></h3>
              <div className="flex items-center gap-1">
                <button onClick={() => setWeekOffset((v) => v - 1)}
                  className="flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition hover:bg-gray-50" aria-label="저번 주">‹</button>
                <span className="min-w-[92px] text-center text-[12px] font-semibold tabular-nums text-gray-600">{rangeLabel}</span>
                <button onClick={() => setWeekOffset((v) => Math.min(0, v + 1))} disabled={weekOffset >= 0}
                  className="flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition enabled:hover:bg-gray-50 disabled:opacity-30" aria-label="다음 주">›</button>
              </div>
            </div>
            <div className="grid grid-cols-7 gap-1.5">
              {cells.map((c) => {
                const active = customFrom === c.key && (customTo === c.key || !customTo);
                const isToday = c.key === kstToday;
                return (
                  <button key={c.key} onClick={() => { setCustomFrom(c.key); setCustomTo(c.key); }}
                    className={`rounded-xl border p-2 text-center transition ${active ? 'border-[#3182F6] bg-[#EAF3FF] ring-1 ring-[#3182F6]' : 'border-gray-100 bg-white hover:bg-gray-50'}`}>
                    <div className={`text-[11px] font-bold ${c.wd === '일' ? 'text-red-500' : c.wd === '토' ? 'text-blue-500' : 'text-gray-500'}`}>{c.wd}</div>
                    <div className={`text-[15px] font-extrabold tabular-nums ${isToday ? 'text-[#3182F6]' : 'text-gray-900'}`}>{c.dd}</div>
                    <div className="mt-1.5 text-[11px] tabular-nums text-gray-600">방문 <b className="text-gray-800">{num(c.visits)}</b></div>
                    <div className="text-[11px] tabular-nums text-emerald-600">신청 <b>{num(c.conversions)}</b></div>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })()}

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
      <div className="mb-8 rounded-2xl border border-gray-100 bg-white p-5">
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

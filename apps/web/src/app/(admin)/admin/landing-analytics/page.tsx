'use client';

import { useEffect, useMemo, useState } from 'react';
import { RefreshCw, TrendingUp } from 'lucide-react';
import { adminFetch } from '../_components/adminFetch';

interface Bucket { key: string; visits: number; conversions: number; rate: number; }
interface PageStat { page: string; visits: number; conversions: number; rate: number; bySource: Bucket[]; byMedium: Bucket[]; byCampaign: Bucket[]; }
interface Analytics { pages: PageStat[]; totalVisits: number; totalConversions: number; }

const PAGE_LABEL: Record<string, string> = { 'wedding-mc': '결혼식 사회자 (wedding-mc)', 'corporate-mc': '전문행사 사회자 (corporate-mc)' };
const RANGES = [
  { key: '7', label: '7일' },
  { key: '30', label: '30일' },
  { key: '90', label: '90일' },
  { key: 'all', label: '전체' },
] as const;

const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
const num = (n: number) => n.toLocaleString('ko-KR');

function Bars({ title, rows }: { title: string; rows: Bucket[] }) {
  const max = Math.max(1, ...rows.map((r) => r.visits));
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5">
      <h4 className="mb-4 text-[14px] font-bold text-gray-800">{title}</h4>
      {rows.length === 0 ? (
        <p className="text-[13px] text-gray-400">데이터 없음</p>
      ) : (
        <div className="space-y-3">
          {rows.slice(0, 12).map((r) => (
            <div key={r.key}>
              <div className="mb-1 flex items-baseline justify-between gap-3">
                <span className="truncate text-[13px] font-medium text-gray-700">{r.key}</span>
                <span className="shrink-0 text-[12px] text-gray-400">
                  방문 <b className="text-gray-700">{num(r.visits)}</b> · 전환 <b className="text-[#3182F6]">{num(r.conversions)}</b> · {pct(r.rate)}
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                <div className="h-full rounded-full bg-[#3182F6]" style={{ width: `${(r.visits / max) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function LandingAnalyticsPage() {
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<string>('30');

  const load = async (r: string) => {
    setLoading(true);
    try {
      let qs = '';
      if (r !== 'all') {
        const from = new Date(Date.now() - Number(r) * 86400000).toISOString();
        qs = `?from=${encodeURIComponent(from)}`;
      }
      const d = await adminFetch('GET', `/api/v1/admin/landing-analytics${qs}`, undefined, { cache: false });
      setData(d);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(range); /* eslint-disable-next-line */ }, [range]);

  const totalRate = useMemo(() => (data && data.totalVisits ? data.totalConversions / data.totalVisits : 0), [data]);

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

      <div className="mb-6 flex gap-2">
        {RANGES.map((r) => (
          <button key={r.key} onClick={() => setRange(r.key)}
            className={`rounded-full px-4 py-2 text-[13px] font-semibold transition ${range === r.key ? 'bg-[#3182F6] text-white' : 'border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
            {r.label}
          </button>
        ))}
      </div>

      {/* 총계 */}
      <div className="mb-8 grid grid-cols-3 gap-3">
        {[
          { label: '총 방문', value: num(data?.totalVisits ?? 0), tone: 'text-gray-900' },
          { label: '총 전환(문의)', value: num(data?.totalConversions ?? 0), tone: 'text-[#3182F6]' },
          { label: '전환율', value: pct(totalRate), tone: 'text-emerald-600' },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-gray-100 bg-white p-5 text-center">
            <p className="text-[12px] text-gray-400">{s.label}</p>
            <p className={`mt-1 text-[26px] font-bold ${s.tone}`}>{loading ? '…' : s.value}</p>
          </div>
        ))}
      </div>

      {/* 페이지별 */}
      {(data?.pages ?? []).map((p) => (
        <section key={p.page} className="mb-10">
          <div className="mb-4 flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <h2 className="text-[17px] font-bold text-gray-900">{PAGE_LABEL[p.page] || p.page}</h2>
            <span className="text-[13px] text-gray-500">방문 <b className="text-gray-800">{num(p.visits)}</b> · 전환 <b className="text-[#3182F6]">{num(p.conversions)}</b> · 전환율 <b className="text-emerald-600">{pct(p.rate)}</b></span>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <Bars title="유입 소스" rows={p.bySource} />
            <Bars title="매체 (medium)" rows={p.byMedium} />
            <Bars title="캠페인 (campaign)" rows={p.byCampaign} />
          </div>
        </section>
      ))}

      {!loading && !data && <p className="text-center text-[14px] text-gray-400">데이터를 불러오지 못했습니다.</p>}

      <p className="mt-6 text-[12px] leading-relaxed text-gray-400">
        · 방문은 세션·페이지당 1회 집계됩니다. 전환은 폼 제출(견적/상담 신청) 성공 시 기록됩니다.<br />
        · UTM 파라미터가 없는 유입은 리퍼러(instagram/threads/naver 등)로 소스를 추정하며, 둘 다 없으면 <b>직접/기타</b>로 분류됩니다.<br />
        · 링크 예시: <code className="rounded bg-gray-100 px-1">freetiful.com/wedding-mc?utm_source=instagram&utm_medium=bio&utm_campaign=summer</code>
      </p>
    </div>
  );
}

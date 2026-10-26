'use client';

import { useState, useEffect } from 'react';
import { MyDetailHeader, MySectionTitle, QdList, QdRow } from '../_components/detail-ui';
import { useAuthStore } from '@/lib/store/auth.store';
import { apiClient } from '@/lib/api/client';

/**
 * 사회자 본인 정산 내역(261026) — 줄 = 정산 로그 1건, 누르면 정산 명세서(빌지 /my/settlement/[id]).
 *  · 주소는 /pro/settlement-logs — /pro/settlements 는 월별 매출 묶음(매출 내역 화면)이라 여기서 쓰면 안 된다.
 *  · 상태·합계는 서버가 정한다: 환불된 결제의 정산은 '취소'로 오고 정산 예정 합계에서 빠져 있다.
 */
type SettlementLogRow = {
  id: string;
  status: 'pending' | 'settled' | 'cancelled' | string;
  netAmount: number;
  settledAt: string | null;
  createdAt: string;
  customerName: string | null;
  event: { title: string | null; kind: string | null; date: string | null } | null;
};

type SettlementMeta = { total: number; pending: number; settled: number; pendingAmount: number; settledAmount: number };

const LIMIT = 100;
const won = (n: number) => `${Math.round(n || 0).toLocaleString('ko-KR')}원`;

const STATUS: Record<string, { text: string; color: string }> = {
  settled: { text: '정산 완료', color: '#03A35F' },
  pending: { text: '정산 예정', color: '#E65F00' },
  cancelled: { text: '취소', color: '#8B95A1' },
};

/** 'YYYY-MM-DD' 또는 ISO(KST 로) → '12월 20일' · 올해가 아니면 '2025년 12월 20일' */
function dayLabel(value: string | null | undefined): string {
  if (!value) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  let y: number, mo: number, d: number;
  if (m) {
    [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  } else {
    const k = new Date(new Date(value).getTime() + 9 * 3600000);
    if (Number.isNaN(k.getTime())) return '';
    [y, mo, d] = [k.getUTCFullYear(), k.getUTCMonth() + 1, k.getUTCDate()];
  }
  const thisYear = new Date(Date.now() + 9 * 3600000).getUTCFullYear();
  return `${y === thisYear ? '' : `${y}년 `}${mo}월 ${d}일`;
}

function rowTitle(s: SettlementLogRow): string {
  if (s.event?.title) return s.event.title;
  return [s.event?.kind, s.customerName && `${s.customerName} 고객`].filter(Boolean).join(' · ') || '행사';
}

function rowHint(s: SettlementLogRow): string {
  const parts = [s.event?.date ? `${dayLabel(s.event.date)} 행사` : ''];
  if (s.status === 'settled' && s.settledAt) parts.push(`${dayLabel(s.settledAt)} 정산`);
  else if (s.status === 'cancelled') parts.push('결제 환불');
  else if (!s.event?.date) parts.push(`${dayLabel(s.createdAt)} 결제`);
  return parts.filter(Boolean).join(' · ');
}

export default function SettlementPage() {
  const authUser = useAuthStore((s) => s.user);
  const [rows, setRows] = useState<SettlementLogRow[]>([]);
  const [meta, setMeta] = useState<SettlementMeta | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    window.scrollTo(0, 0);
    if (!authUser) { setState('ready'); return; }
    let alive = true;
    setState('loading');
    apiClient.get<{ data: SettlementLogRow[]; meta: SettlementMeta }>(`/api/v1/pro/settlement-logs?limit=${LIMIT}`)
      .then((res) => {
        if (!alive) return;
        setRows(Array.isArray(res.data?.data) ? res.data.data : []);
        setMeta(res.data?.meta ?? null);
        setState('ready');
      })
      .catch(() => { if (alive) setState('error'); });
    return () => { alive = false; };
  }, [authUser]);

  const loading = state === 'loading';

  return (
    <div className="bg-white min-h-screen" style={{ letterSpacing: '-0.02em' }}>
      <MyDetailHeader title="정산 내역" sub="수수료를 뺀 받을 금액이에요" />

      <div className="qd-body px-6 pb-10 pt-1">
        <div className="qd-card mb-7 px-[18px] py-5">
          <p className="text-[13px] text-[#8B95A1]">정산 받은 금액</p>
          <p className="mt-1 text-[28px] font-bold text-[#191F28]">
            {loading ? <span className="inline-block h-[34px] w-40 animate-pulse rounded-[8px] bg-[#F2F4F6] align-middle" /> : won(meta?.settledAmount || 0)}
          </p>
          <div className="mt-4 flex items-center justify-between border-t border-[#F2F4F6] pt-4">
            <span className="text-[15px] text-[#4E5968]">정산 예정{meta?.pending ? ` ${meta.pending}건` : ''}</span>
            <span className="text-[15px] font-semibold text-[#191F28]">{loading ? '—' : won(meta?.pendingAmount || 0)}</span>
          </div>
        </div>

        <div>
          <MySectionTitle>행사별 정산</MySectionTitle>
          {loading ? (
            <div className="space-y-2.5">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-[72px] animate-pulse rounded-[16px] bg-[#F7F8FA]" />
              ))}
            </div>
          ) : state === 'error' ? (
            <div className="py-12 text-center text-[15px] text-[#8B95A1]">정산 내역을 불러오지 못했어요</div>
          ) : rows.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-[15px] text-[#8B95A1]">아직 정산 내역이 없어요</p>
              <p className="mt-1 text-[13px] text-[#B0B8C1]">고객 결제가 끝나면 여기에 쌓여요</p>
            </div>
          ) : (
            <>
              <QdList>
                {rows.map((s) => {
                  const st = STATUS[s.status] || STATUS.pending;
                  const cancelled = s.status === 'cancelled';
                  return (
                    <QdRow
                      key={s.id}
                      href={`/my/settlement/${s.id}`}
                      title={<span className={cancelled ? 'text-[#8B95A1]' : undefined}>{rowTitle(s)}</span>}
                      hint={rowHint(s)}
                      right={
                        <span className="flex shrink-0 flex-col items-end gap-[3px]">
                          <span className={`text-[15px] font-bold ${cancelled ? 'text-[#B0B8C1] line-through' : 'text-[#191F28]'}`}>{won(s.netAmount)}</span>
                          <span className="text-[13px] font-semibold" style={{ color: st.color }}>{st.text}</span>
                        </span>
                      }
                    />
                  );
                })}
              </QdList>
              {meta && meta.total > rows.length && (
                <p className="mt-4 text-center text-[13px] text-[#8B95A1]">최근 {rows.length}건까지 보여요</p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

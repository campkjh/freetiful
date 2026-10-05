'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { MyDetailHeader } from '../../_components/detail-ui';
import { apiClient } from '@/lib/api/client';
import { useAuthStore } from '@/lib/store/auth.store';
import { SettlementBillActions, SettlementBillCard, type SettlementBillData } from '@/components/settlement/SettlementBill';

/** 정산 명세서(빌지) — 정산 완료 푸시를 누르면 여기로(261005 사장 '빌지 형태로 나와서 카톡으로 이미지 공유') */
export default function SettlementBillPage() {
  const params = useParams<{ id: string }>();
  const id = String(params?.id || '');
  const authUser = useAuthStore((s) => s.user);
  const [bill, setBill] = useState<SettlementBillData | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'missing'>('loading');

  useEffect(() => {
    window.scrollTo(0, 0);
    if (!authUser || !id) { setState(authUser ? 'missing' : 'loading'); return; }
    let alive = true;
    apiClient.get<SettlementBillData>(`/api/v1/pro/settlements/${encodeURIComponent(id)}/bill`)
      .then((res) => { if (alive) { setBill(res.data); setState('ready'); } })
      .catch(() => { if (alive) setState('missing'); });
    return () => { alive = false; };
  }, [authUser, id]);

  return (
    <div className="min-h-screen bg-[#F2F4F6]" style={{ letterSpacing: '-0.02em' }}>
      <MyDetailHeader title="정산 명세서" sub="이미지로 카카오톡에 보낼 수 있어요" />
      <div className="px-5 pb-12 pt-3">
        {state === 'loading' ? (
          <div className="mx-auto h-[520px] w-full max-w-[360px] animate-pulse rounded-[24px] bg-white/70" />
        ) : state === 'missing' || !bill ? (
          <div className="py-20 text-center text-[15px] text-[#8B95A1]">정산 명세서를 찾을 수 없어요</div>
        ) : (
          <>
            <SettlementBillCard bill={bill} />
            <div className="mx-auto mt-6 w-full max-w-[360px]">
              <SettlementBillActions bill={bill} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

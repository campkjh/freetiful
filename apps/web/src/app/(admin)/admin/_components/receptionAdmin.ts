'use client';

// 송년회 어드민(참여자 · 설문 응답) 공용 — API GET /api/v1/admin/reception/:eventKey(apps/api reception-admin.controller.ts).
// 참여자 = 자리 탭에서 이름을 넣은 기기 ∪ 사진·좋아요/공감·설문을 한 기기. 기기가 곧 한 사람(로그인 없음).
import { useCallback, useEffect, useState } from 'react';
import { adminFetch } from './adminFetch';
import { useAdminRefresh } from './adminRefresh';
import { RECEPTION_EVENT_KEY } from '@/lib/reception/event';

export interface ReceptionParticipant {
  deviceId: string;
  name: string | null;
  firstAt: string;
  lastAt: string;
  photo: { thumbUrl: string; imageUrl: string; likes: number; empathies: number; rank: number; createdAt: string } | null;
  likesUsed: number;
  empathiesUsed: number;
  surveyAt: string | null;
}

export interface ReceptionSurveyRow {
  deviceId: string;
  name: string;
  answers: { rating?: number; best?: string; again?: 'yes' | 'maybe' | 'no'; comment?: string };
  createdAt: string;
  updatedAt: string;
}

export interface ReceptionOverview {
  summary: {
    participants: number;
    named: number;
    photos: number;
    voters: number;
    surveys: number;
    avgRating: number | null;
    again: { yes: number; maybe: number; no: number };
    best: { title: string; count: number }[];
  };
  participants: ReceptionParticipant[];
  surveys: ReceptionSurveyRow[];
}

export const AGAIN_LABEL = { yes: '꼭 올게요', maybe: '아마도요', no: '잘 모르겠어요' } as const;
export const AGAIN_TONE = { yes: 'green', maybe: 'orange', no: 'red' } as const;

export function useReceptionOverview() {
  const [data, setData] = useState<ReceptionOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await adminFetch('GET', `/api/v1/admin/reception/${RECEPTION_EVENT_KEY}`, undefined, { cache: false }));
      setError(null);
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || '불러오지 못했어요');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);
  useAdminRefresh(load);
  return { data, loading, error, reload: load };
}

import { apiClient } from './client';

export interface PlanTemplate {
  id: string;
  planKey: string;
  label: string;
  description: string | null;
  defaultPrice: number;
  includedItems: string[];
  displayOrder: number;
  isActive: boolean;
}

// 어드민에서 설정하는 글로벌 플랜 템플릿 — 모든 페이지에서 공유
// 1분 TTL (어드민 수정이 빠르게 반영되도록)
const CACHE_TTL = 60_000;
let cache: { data: PlanTemplate[]; ts: number } | null = null;
let inflight: Promise<PlanTemplate[]> | null = null;

const FALLBACK: PlanTemplate[] = [
  { id: 'fb-premium', planKey: 'premium', label: 'Premium', description: '행사 1시간 진행', defaultPrice: 450000, includedItems: ['사회 진행', '사전 미팅'], displayOrder: 0, isActive: true },
  { id: 'fb-superior', planKey: 'superior', label: 'Superior', description: '행사 2시간 진행', defaultPrice: 800000, includedItems: ['사회 진행', '사전 미팅', '대본 작성', '리허설 참석', '포토타임 진행', '영상 큐시트 관리'], displayOrder: 1, isActive: true },
  { id: 'fb-enterprise', planKey: 'enterprise', label: 'Enterprise', description: '6시간 풀타임', defaultPrice: 1700000, includedItems: ['사회 진행', '사전 미팅', '대본 작성', '리허설 참석', '축사/건배사 코디', '포토타임 진행', '하객 응대 안내', '2차 진행', '영상 큐시트 관리', '전담 코디네이터'], displayOrder: 2, isActive: true },
];

export async function getPlanTemplates(options?: { skipCache?: boolean }): Promise<PlanTemplate[]> {
  if (!options?.skipCache && cache && Date.now() - cache.ts < CACHE_TTL) {
    return cache.data;
  }
  if (inflight) return inflight;
  inflight = apiClient
    .get<PlanTemplate[]>('/api/v1/plan-templates')
    .then((r) => {
      const data = Array.isArray(r.data) && r.data.length > 0 ? r.data : FALLBACK;
      cache = { data, ts: Date.now() };
      inflight = null;
      return data;
    })
    .catch(() => {
      inflight = null;
      return FALLBACK;
    });
  return inflight;
}

export function invalidatePlanTemplateCache() {
  cache = null;
  inflight = null;
}

// 동기 조회 (SSR/초기 렌더 fallback 용) — 캐시에 있으면 반환, 없으면 FALLBACK
export function getPlanTemplatesSync(): PlanTemplate[] {
  return cache?.data ?? FALLBACK;
}

// planKey → 템플릿 매핑 (자주 쓰이는 편의 함수)
export function findPlanByKey(templates: PlanTemplate[], key: string): PlanTemplate | undefined {
  return templates.find((t) => t.planKey === key || t.label === key);
}

// 템플릿 → legacy PLAN 형태로 변환 (기존 코드 호환용)
export interface LegacyPlanShape {
  id: string;
  label: string;
  price: number;
  defaultPrice: number;
  desc: string;
  includedItems: string[];
}
export function toLegacyPlans(templates: PlanTemplate[]): LegacyPlanShape[] {
  return templates.map((t) => ({
    id: t.planKey,
    label: t.label,
    price: t.defaultPrice,
    defaultPrice: t.defaultPrice,
    desc: t.description || '',
    includedItems: t.includedItems,
  }));
}

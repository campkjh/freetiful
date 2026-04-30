import type { PlanTemplate } from './api/plan-templates.api';

export type WeddingCustomOption = {
  name: string;
  price: number;
};

export type WeddingServicePayload = {
  title: string;
  description?: string;
  basePrice?: number;
};

export const WEDDING_PLAN_TEMPLATES: PlanTemplate[] = [
  {
    id: 'wedding-part1',
    planKey: 'wedding_part1',
    label: '1부 예식',
    description: '본식 1부 진행',
    defaultPrice: 300000,
    includedItems: ['본식 1부 사회', '사전 미팅', '식순 확인', '기본 대본 준비'],
    displayOrder: 0,
    isActive: true,
  },
  {
    id: 'wedding-part12',
    planKey: 'wedding_part12',
    label: '1+2부 예식',
    description: '본식 1부 + 2부 진행',
    defaultPrice: 400000,
    includedItems: ['본식 1부 사회', '2부 피로연 진행', '사전 미팅', '맞춤 대본 준비', '현장 리허설 체크'],
    displayOrder: 1,
    isActive: true,
  },
];

export const WEDDING_OPTION_SUGGESTIONS: WeddingCustomOption[] = [
  { name: '출장비', price: 0 },
  { name: '다국어 사회', price: 100000 },
  { name: '주례없는 예식 대본', price: 50000 },
  { name: '현장 리허설 추가', price: 50000 },
];

const WEDDING_PLAN_KEYS = new Set(WEDDING_PLAN_TEMPLATES.map((plan) => plan.planKey));
const LEGACY_DEFAULT_PRICES: Record<string, number> = {
  premium: 450000,
  superior: 800000,
  enterprise: 1700000,
  test: 100,
};

export function normalizeWeddingPlanKey(value?: string | null) {
  const raw = String(value || '').trim();
  const key = raw.toLowerCase();
  if (!key) return '';

  if (
    key === 'wedding_part12'
    || key === 'wedding-part12'
    || key === 'part12'
    || key === 'superior'
    || key === 'enterprise'
    || key.includes('1+2')
    || key.includes('1＋2')
    || key.includes('2부')
    || key.includes('피로연')
  ) {
    return 'wedding_part12';
  }

  if (
    key === 'wedding_part1'
    || key === 'wedding-part1'
    || key === 'part1'
    || key === 'premium'
    || key.includes('1부')
    || key.includes('본식')
  ) {
    return 'wedding_part1';
  }

  return key;
}

export function getWeddingPlanTemplate(value?: string | null) {
  const key = normalizeWeddingPlanKey(value);
  return WEDDING_PLAN_TEMPLATES.find((plan) => plan.planKey === key);
}

export function migrateWeddingPlanKeys(values: unknown) {
  const rawValues = Array.isArray(values) ? values : [];
  const keys = rawValues
    .map((value) => normalizeWeddingPlanKey(String(value || '')))
    .filter((key) => WEDDING_PLAN_KEYS.has(key));
  const unique = Array.from(new Set(keys));
  return unique.length > 0 ? unique : ['wedding_part1'];
}

export function migrateWeddingPlanPrices(raw: unknown) {
  const prices: Record<string, number> = Object.fromEntries(
    WEDDING_PLAN_TEMPLATES.map((plan) => [plan.planKey, plan.defaultPrice]),
  );
  if (!raw || typeof raw !== 'object') return prices;

  Object.entries(raw as Record<string, unknown>).forEach(([sourceKey, sourceValue]) => {
    const normalized = normalizeWeddingPlanKey(sourceKey);
    if (!WEDDING_PLAN_KEYS.has(normalized)) return;
    const price = Number(sourceValue);
    if (!Number.isFinite(price) || price <= 0) return;
    const legacyDefault = LEGACY_DEFAULT_PRICES[sourceKey.toLowerCase()];
    if (legacyDefault && price === legacyDefault) return;
    prices[normalized] = price;
  });

  return prices;
}

export function migrateWeddingCustomOptions(raw: unknown) {
  const options: Record<string, WeddingCustomOption[]> = Object.fromEntries(
    WEDDING_PLAN_TEMPLATES.map((plan) => [plan.planKey, []]),
  );
  if (!raw || typeof raw !== 'object') return options;

  Object.entries(raw as Record<string, unknown>).forEach(([sourceKey, list]) => {
    const normalized = normalizeWeddingPlanKey(sourceKey);
    if (!WEDDING_PLAN_KEYS.has(normalized) || !Array.isArray(list)) return;
    const cleaned = list
      .map((item) => {
        if (typeof item === 'string') return { name: item.trim(), price: 0 };
        if (!item || typeof item !== 'object') return null;
        const opt = item as { name?: unknown; price?: unknown };
        const name = String(opt.name || '').trim();
        if (!name) return null;
        const price = Number(opt.price) || 0;
        return { name, price: Math.max(0, price) };
      })
      .filter(Boolean) as WeddingCustomOption[];

    const seen = new Set(options[normalized].map((opt) => `${opt.name}:${opt.price}`));
    cleaned.forEach((opt) => {
      const key = `${opt.name}:${opt.price}`;
      if (seen.has(key)) return;
      seen.add(key);
      options[normalized].push(opt);
    });
  });

  return options;
}

export function formatWeddingCustomOptions(options: WeddingCustomOption[] = []) {
  const cleaned = options.filter((opt) => opt.name.trim());
  if (cleaned.length === 0) return '';
  return `추가옵션: ${cleaned
    .map((opt) => `${opt.name}${opt.price > 0 ? `(+${opt.price.toLocaleString()}원)` : ''}`)
    .join(', ')}`;
}

export function parseWeddingOptionsFromDescription(description?: string | null) {
  const text = String(description || '');
  const marker = '추가옵션:';
  const markerIndex = text.indexOf(marker);
  if (markerIndex < 0) return [];
  return text
    .slice(markerIndex + marker.length)
    .split(',')
    .map((part) => {
      const trimmed = part.trim();
      if (!trimmed) return null;
      const match = trimmed.match(/^(.+?)\(\+([\d,]+)원\)$/);
      if (match) return { name: match[1].trim(), price: Number(match[2].replace(/,/g, '')) || 0 };
      return { name: trimmed, price: 0 };
    })
    .filter(Boolean) as WeddingCustomOption[];
}

export function buildWeddingServices(
  enabledPlans: Iterable<string>,
  prices: Record<string, number> = {},
  customOptions: Record<string, WeddingCustomOption[]> = {},
) {
  return migrateWeddingPlanKeys(Array.from(enabledPlans))
    .map((key): WeddingServicePayload | null => {
      const template = getWeddingPlanTemplate(key);
      if (!template) return null;
      const optionText = formatWeddingCustomOptions(customOptions[key] || []);
      const description = [template.description, optionText].filter(Boolean).join(' · ');
      return {
        title: template.label,
        description: description || undefined,
        basePrice: Number(prices[key]) > 0 ? Number(prices[key]) : template.defaultPrice,
      };
    })
    .filter(Boolean) as WeddingServicePayload[];
}

export function buildWeddingServicesFromStorage() {
  if (typeof window === 'undefined') return buildWeddingServices(['wedding_part1'], {}, {});
  const safeParse = <T>(key: string, fallback: T): T => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  };
  const enabled = migrateWeddingPlanKeys(safeParse('proRegister_enabledPlans', []));
  const prices = migrateWeddingPlanPrices(safeParse('proRegister_prices', {}));
  const options = migrateWeddingCustomOptions(safeParse('proRegister_customOptions', {}));
  return buildWeddingServices(enabled, prices, options);
}

export function getWeddingPlanDisplayPrice(keyOrLabel: string, sourcePrice?: number | null) {
  const key = normalizeWeddingPlanKey(keyOrLabel);
  const template = getWeddingPlanTemplate(key);
  if (!template) return Number(sourcePrice) || 0;
  const price = Number(sourcePrice) || 0;
  const legacyDefault = LEGACY_DEFAULT_PRICES[String(keyOrLabel || '').toLowerCase()];
  if (!price || (legacyDefault && price === legacyDefault)) return template.defaultPrice;
  return price;
}

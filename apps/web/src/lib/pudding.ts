// Pudding transaction types
export type PuddingType = 'welcome' | 'charge' | 'boost' | 'promo' | 'bonus' | 'review' | 'admin_grant';

export interface PuddingTransaction {
  id: string;
  type: PuddingType;
  amount: number; // positive = earn, negative = use
  description: string;
  createdAt: number;
  category: string;
}

const PUDDING_KEY = 'freetiful-pudding';
const HISTORY_KEY = 'freetiful-pudding-history';

export function getPudding(): number {
  if (typeof window === 'undefined') return 0;
  try {
    const stored = localStorage.getItem(PUDDING_KEY);
    return stored ? Number(stored) : 0;
  } catch {
    return 0;
  }
}

export function getPuddingHistory(): PuddingTransaction[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
  } catch {
    return [];
  }
}

export function addPudding(type: PuddingType, amount: number, description: string, category?: string): void {
  if (typeof window === 'undefined') return;
  try {
    const current = getPudding();
    const history = getPuddingHistory();
    const transaction: PuddingTransaction = {
      id: `pd_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      type,
      amount,
      description,
      createdAt: Date.now(),
      category: category || type,
    };
    localStorage.setItem(PUDDING_KEY, String(current + amount));
    history.unshift(transaction);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch {}
}

export function usePudding(amount: number, description: string, category?: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const current = getPudding();
    if (current < amount) return false;
    const history = getPuddingHistory();
    const transaction: PuddingTransaction = {
      id: `pd_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      type: 'boost',
      amount: -amount,
      description,
      createdAt: Date.now(),
      category: category || 'boost',
    };
    localStorage.setItem(PUDDING_KEY, String(current - amount));
    history.unshift(transaction);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    return true;
  } catch {
    return false;
  }
}

export function initWelcomePudding(): void {
  if (typeof window === 'undefined') return;
  try {
    const alreadyGiven = localStorage.getItem('freetiful-pudding-welcome-given');
    if (alreadyGiven) return;
    addPudding('welcome', 100, '가입 환영 푸딩', 'welcome');
    localStorage.setItem('freetiful-pudding-welcome-given', 'true');
  } catch {}
}

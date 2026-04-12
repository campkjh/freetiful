import { usersApi } from './api/users.api';
import { useAuthStore } from './store/auth.store';

// Point transaction types
export type PointType = 'signup_bonus' | 'review_write' | 'invite_friend' | 'daily_check' | 'quote_request' | 'payment_use' | 'admin_grant';

export interface PointTransaction {
  id: string;
  type: PointType;
  amount: number; // positive = earn, negative = use
  description: string;
  createdAt: number;
}

const POINTS_KEY = 'freetiful-points';
const HISTORY_KEY = 'freetiful-point-history';

function isAuthenticated() {
  if (typeof window === 'undefined') return false;
  return useAuthStore.getState().user !== null;
}

export function getPoints(): number {
  if (typeof window === 'undefined') return 0;
  // Return from auth store if available
  const user = useAuthStore.getState().user;
  if (user) return user.pointBalance || 0;
  try {
    const stored = localStorage.getItem(POINTS_KEY);
    return stored ? Number(stored) : 0;
  } catch {
    return 0;
  }
}

export async function getPointsAsync(): Promise<number> {
  if (isAuthenticated()) {
    try {
      const res = await usersApi.getPointBalance();
      return res.balance;
    } catch {}
  }
  return getPoints();
}

export function getPointHistory(): PointTransaction[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
  } catch {
    return [];
  }
}

export async function getPointHistoryAsync(): Promise<PointTransaction[]> {
  if (isAuthenticated()) {
    try {
      const res = await usersApi.getPointHistory();
      return (res.data || []).map((t: any) => ({
        id: t.id,
        type: t.type,
        amount: t.amount,
        description: t.description,
        createdAt: new Date(t.createdAt).getTime(),
      }));
    } catch {}
  }
  return getPointHistory();
}

export function addPoints(type: PointType, amount: number, description: string): void {
  if (typeof window === 'undefined') return;

  // Save to API if authenticated
  if (isAuthenticated()) {
    usersApi.getPointBalance().then(() => {
      // Points are managed server-side now
    }).catch(() => {});
  }

  // Also save to localStorage for backwards compat
  try {
    const current = getPoints();
    const history = getPointHistory();
    const transaction: PointTransaction = {
      id: `pt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      type,
      amount,
      description,
      createdAt: Date.now(),
    };
    localStorage.setItem(POINTS_KEY, String(current + amount));
    history.unshift(transaction);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch {}
}

export function usePoints(amount: number, description: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const current = getPoints();
    if (current < amount) return false;
    const history = getPointHistory();
    const transaction: PointTransaction = {
      id: `pt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      type: 'payment_use',
      amount: -amount,
      description,
      createdAt: Date.now(),
    };
    localStorage.setItem(POINTS_KEY, String(current - amount));
    history.unshift(transaction);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    return true;
  } catch {
    return false;
  }
}

export function initSignupBonus(): void {
  if (typeof window === 'undefined') return;
  try {
    const alreadyGiven = localStorage.getItem('freetiful-signup-bonus-given');
    if (alreadyGiven) return;
    addPoints('signup_bonus', 1000, '신규 가입 축하 포인트');
    localStorage.setItem('freetiful-signup-bonus-given', 'true');
  } catch {}
}

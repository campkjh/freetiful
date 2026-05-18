import { apiClient } from './client';
import type { User } from '@prettyful/types';

const BASE = '/api/v1/users';

export type NotificationSettings = {
  chatPush: boolean;
  bookingPush: boolean;
  paymentPush: boolean;
  reviewPush: boolean;
  systemPush: boolean;
  marketingPush: boolean;
  marketingSms: boolean;
  marketingEmail: boolean;
};

export type ReferralEventStatus = {
  campaignKey: string;
  referralCode: string;
  referralCount: number;
  requiredReferrals: number;
  totalRewardAmount: number;
  stepRewardAmount: number;
  completedRewardAmount: number;
  claimedRewardAmount: number;
  availableRewardAmount: number;
  claimEligible: boolean;
  hasEnteredReferralCode: boolean;
  enteredReferralCode: string | null;
  inviterName: string | null;
  claim: {
    id: string;
    bankName: string;
    accountHolder: string;
    accountNumber: string;
    status: string;
    adminNote?: string | null;
    submittedAt: string;
  } | null;
  milestones: Array<{
    step: number;
    rewardAmount: number;
    completed: boolean;
    eligible: boolean;
    claimed: boolean;
    label: string;
  }>;
};

export const usersApi = {
  getProfile: () =>
    apiClient.get<User & { proProfile?: any; businessProfile?: any }>(`${BASE}/profile`).then((r) => r.data),

  updateProfile: (data: { name?: string; phone?: string; profileImageUrl?: string; profileImageDataUrl?: string }) =>
    apiClient.put<User>(`${BASE}/profile`, data).then((r) => r.data),

  uploadProfileImage: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return apiClient
      .post<{ profileImageUrl: string }>(`${BASE}/profile/image`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((r) => r.data);
  },

  getNotificationSettings: () =>
    apiClient.get<NotificationSettings>(`${BASE}/notification-settings`).then((r) => r.data),

  updateNotificationSettings: (data: Partial<NotificationSettings>) =>
    apiClient.put<NotificationSettings>(`${BASE}/notification-settings`, data).then((r) => r.data),

  deleteAccount: () =>
    apiClient.post(`${BASE}/delete-account`).then((r) => r.data),

  getReferralEventStatus: () =>
    apiClient.get<ReferralEventStatus>(`${BASE}/referral-event`).then((r) => r.data),

  applyReferralEventCode: (code: string) =>
    apiClient.post<ReferralEventStatus>(`${BASE}/referral-event/code`, { code }).then((r) => r.data),

  claimReferralEventReward: (step: number) =>
    apiClient.post<ReferralEventStatus>(`${BASE}/referral-event/rewards/${step}/claim`).then((r) => r.data),

  submitReferralEventClaim: (data: { bankName: string; accountHolder: string; accountNumber: string }) =>
    apiClient.post<ReferralEventStatus>(`${BASE}/referral-event/claim`, data).then((r) => r.data),
};

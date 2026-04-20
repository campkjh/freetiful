// Shared types for chat detail page

export type SystemKind =
  | 'session_start'
  | 'quote'
  | 'payment_request'
  | 'payment_paid'
  | 'booking_confirmed'
  | 'reminder'
  | 'event_today'
  | 'event_done'
  | 'review_request'
  | 'refund'
  | 'cancel';

export interface SystemPayload {
  kind: SystemKind;
  title?: string;
  amount?: number;
  items?: string[];
  eventName?: string;
  eventDate?: string;
  eventTime?: string;
  venue?: string;
  daysLeft?: number;
  paymentType?: 'deposit' | 'balance';
  plan?: string; // 어드민이 자유롭게 planKey 추가 가능 (premium/superior/enterprise + 기타)
  reviewUrl?: string;
  rating?: number;
  quotationId?: string;
  proId?: string;
}

export interface Message {
  id: string;
  senderId: string;
  content: string;
  type: 'text' | 'image' | 'file' | 'location' | 'system' | 'voice';
  createdAt: string;
  isRead: boolean;
  fileName?: string;
  duration?: number;
  latitude?: number;
  longitude?: number;
  address?: string;
  replyTo?: { id: string; name: string; content: string } | null;
  reaction?: string | null;
  isNew?: boolean;
  system?: SystemPayload;
}

export interface ChatPartner {
  id: string;
  name: string;
  profileImageUrl: string;
  isActive: boolean;
  lastSeen?: string;
  role?: 'pro' | 'general'; // 상대방 역할: 사회자 or 고객
}

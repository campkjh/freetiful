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
  plan?: 'premium' | 'superior' | 'enterprise';
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
}

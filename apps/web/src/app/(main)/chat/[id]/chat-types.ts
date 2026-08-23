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
  eventLocation?: string;
  venue?: string;
  daysLeft?: number;
  paymentType?: 'deposit' | 'balance';
  plan?: string; // 어드민이 자유롭게 planKey 추가 가능 (premium/superior/enterprise + 기타)
  basePrice?: number;
  options?: { name: string; price: number }[];
  reviewUrl?: string;
  rating?: number;
  quotationId?: string;
  paymentId?: string;
  orderId?: string;
  proId?: string;
  proImage?: string | null;
}

export interface Message {
  id: string;
  senderId: string;
  content: string;
  type: 'text' | 'image' | 'video' | 'file' | 'location' | 'system' | 'voice';
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
  /** 사회자 자동응답으로 나간 메시지 — 화면에 '자동응답' 표시를 단다 */
  autoReply?: boolean;
  // 미디어 업로드 진행률 (낙관적 메시지에서만 사용): 0~100, 완료 시 undefined
  uploadProgress?: number;
  // 원본 파일 크기(byte) — 업로드 진행 오버레이에 "X.X / Y.Y MB" 표기용
  uploadBytesTotal?: number;
  // 업로드 실패 — 버블을 지우지 않고(사진 사라짐 방지) '전송 실패·재시도' 상태로 유지
  uploadFailed?: boolean;
}

export interface ChatPartner {
  id: string;                // otherUser.id — 유저 ID
  proProfileId?: string;     // 룸에 연결된 프로 프로필 ID — 결제/프로필 이동 시 사용
  name: string;
  profileImageUrl: string;
  isActive: boolean;
  lastSeen?: string;
  role?: 'pro' | 'general'; // 상대방 역할: 사회자 or 고객
}

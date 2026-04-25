// ─── Enums ───────────────────────────────────────────────────────────────────

export type UserRole = 'general' | 'pro' | 'business' | 'admin';
export type AuthProvider = 'kakao' | 'google' | 'apple' | 'naver' | 'email';
export type ProStatus = 'draft' | 'pending' | 'approved' | 'rejected' | 'suspended';
export type BusinessStatus = 'draft' | 'pending' | 'approved' | 'rejected';
export type PaymentStatus = 'pending' | 'completed' | 'failed' | 'refunded' | 'escrowed' | 'settled';
export type QuotationStatus = 'pending' | 'accepted' | 'paid' | 'cancelled' | 'refunded' | 'expired';
export type MatchRequestType = 'multi' | 'single';
export type MatchRequestStatus = 'open' | 'matched' | 'cancelled' | 'expired';
export type MessageType = 'text' | 'image' | 'file' | 'location' | 'link' | 'sticker' | 'system';
export type NotificationType = 'chat' | 'booking' | 'payment' | 'review' | 'system' | 'marketing';
export type PuddingReason =
  | 'quote_reply_single'
  | 'quote_reply_multi'
  | 'successful_match'
  | 'perfect_review'
  | 'info_registered'
  | 'referral_joined';

// ─── User ────────────────────────────────────────────────────────────────────

export interface User {
  id: string;
  role: UserRole;
  name: string;
  phone: string | null;
  email: string | null;
  profileImageUrl: string | null;
  referralCode: string;
  pointBalance: number;
  isActive: boolean;
  createdAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface LoginResponse {
  user: User;
  tokens: AuthTokens;
  isNewUser: boolean;
  needsPhone: boolean;
}

// ─── Pro Profile ─────────────────────────────────────────────────────────────

export interface ProProfile {
  id: string;
  userId: string;
  status: ProStatus;
  gender: string | null;
  shortIntro: string | null;
  mainExperience: string | null;
  careerYears: number | null;
  awards: string | null;
  detailHtml: string | null;
  youtubeUrl: string | null;
  isNationwide: boolean;
  puddingCount: number;
  puddingRank: number | null;
  profileViews: number;
  avgRating: number;
  reviewCount: number;
  isFeatured: boolean;
  isProfileHidden: boolean;
  createdAt: string;
  updatedAt: string;
  // relations
  user?: User;
  categories?: Category[];
  eventCategories?: EventCategory[];
  regions?: Region[];
  images?: ProProfileImage[];
  services?: ProService[];
  faqs?: ProFaq[];
}

export interface ProProfileImage {
  id: string;
  proProfileId: string;
  imageUrl: string;
  displayOrder: number;
  isPrimary: boolean;
  hasFace: boolean;
}

export interface ProService {
  id: string;
  proProfileId: string;
  title: string;
  description: string | null;
  basePrice: number | null;
  priceUnit: 'per_hour' | 'per_event' | 'custom' | null;
  displayOrder: number;
  isActive: boolean;
}

export interface ProFaq {
  id: string;
  proProfileId: string;
  question: string;
  answer: string;
  displayOrder: number;
}

// ─── Category / Region ───────────────────────────────────────────────────────

export interface Category {
  id: string;
  type: 'pro' | 'business';
  name: string;
  iconUrl: string | null;
  displayOrder: number;
  isActive: boolean;
  parentId: string | null;
}

export interface EventCategory {
  id: string;
  categoryId: string;
  name: string;
  displayOrder: number;
  isActive: boolean;
}

export interface Region {
  id: string;
  name: string;
  isNationwide: boolean;
  displayOrder: number;
}

export interface StyleOption {
  id: string;
  categoryId: string;
  name: string;
  displayOrder: number;
  isActive: boolean;
}

export interface PersonalityOption {
  id: string;
  name: string;
  displayOrder: number;
  isActive: boolean;
}

// ─── Matching ─────────────────────────────────────────────────────────────────

export interface MatchRequest {
  id: string;
  userId: string;
  type: MatchRequestType;
  categoryId: string;
  eventCategoryId: string | null;
  eventDate: string | null;
  eventTime: string | null;
  eventLocation: string | null;
  budgetMin: number | null;
  budgetMax: number | null;
  aiGeneratedMessage: string | null;
  status: MatchRequestStatus;
  expiresAt: string | null;
  createdAt: string;
}

// ─── Quotation ───────────────────────────────────────────────────────────────

export interface Quotation {
  id: string;
  proProfileId: string;
  userId: string;
  chatRoomId: string | null;
  amount: number;
  title: string | null;
  description: string | null;
  eventDate: string | null;
  eventTime: string | null;
  eventLocation: string | null;
  validUntil: string | null;
  status: QuotationStatus;
  createdAt: string;
  updatedAt: string;
}

// ─── Chat ─────────────────────────────────────────────────────────────────────

export interface ChatRoom {
  id: string;
  userId: string;
  proProfileId: string;
  lastMessageAt: string | null;
  unreadCount: number;
  isFavorited: boolean;
  otherUser?: Partial<User & { proProfile?: Partial<ProProfile> }>;
  lastMessage?: Message;
}

export interface Message {
  id: string;
  roomId: string;
  senderId: string;
  type: MessageType;
  content: string | null;
  metadata: Record<string, unknown> | null;
  replyToId: string | null;
  isEdited: boolean;
  isDeleted: boolean;
  createdAt: string;
  reactions?: MessageReaction[];
  replyTo?: Message;
}

export interface MessageReaction {
  emoji: string;
  count: number;
  userIds: string[];
}

// ─── Review ──────────────────────────────────────────────────────────────────

export interface Review {
  id: string;
  paymentId: string;
  reviewerId: string;
  proProfileId: string;
  ratingSatisfaction: number;
  ratingComposition: number;
  ratingExperience: number;
  ratingAppearance: number;
  ratingVoice: number;
  ratingWit: number;
  avgRating: number;
  comment: string | null;
  isAnonymous: boolean;
  proReply: string | null;
  createdAt: string;
  reviewer?: Partial<User>;
}

// ─── Notification ────────────────────────────────────────────────────────────

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string | null;
  body: string | null;
  data: Record<string, unknown> | null;
  isRead: boolean;
  createdAt: string;
}

// ─── API Response Wrappers ───────────────────────────────────────────────────

export interface ApiResponse<T> {
  data: T;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface ApiError {
  statusCode: number;
  message: string;
  errors?: Record<string, string[]>;
}

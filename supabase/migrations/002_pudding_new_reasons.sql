-- 2026-04 푸딩 지급 규칙 전면 재설계: 7개 활동 기반 사유 enum 추가
-- PostgreSQL: ALTER TYPE ... ADD VALUE 는 트랜잭션 외부에서 실행되어야 함

ALTER TYPE "PuddingReason" ADD VALUE IF NOT EXISTS 'daily_attendance';
ALTER TYPE "PuddingReason" ADD VALUE IF NOT EXISTS 'review_received';
ALTER TYPE "PuddingReason" ADD VALUE IF NOT EXISTS 'deal_completed';
ALTER TYPE "PuddingReason" ADD VALUE IF NOT EXISTS 'new_chat_received';
ALTER TYPE "PuddingReason" ADD VALUE IF NOT EXISTS 'replied_to_customer';
ALTER TYPE "PuddingReason" ADD VALUE IF NOT EXISTS 'review_reply';
ALTER TYPE "PuddingReason" ADD VALUE IF NOT EXISTS 'profile_views_100';

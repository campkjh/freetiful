-- 커뮤니티 운영 콘텐츠(261004): 운영 프로필 · 운영 글 상태/예약 · 테스트 수치 · 관리자 변경 이력 확장
-- 전부 추가만 한다(기존 데이터·컬럼을 바꾸거나 지우지 않음). 여러 번 돌려도 같은 결과(IF NOT EXISTS · ON CONFLICT).
-- ⚠ `prisma migrate diff` 가 함께 내놓는 DROP INDEX "reviews_proProfileId_isVisible_createdAt_idx" 는 넣지 않았다
--    (ProService 가 부팅 때 직접 만드는 성능 색인 — schema.prisma 에 없을 뿐 지우면 안 된다).

-- 1) 관리자 변경 이력: 사유 · 관리자 이메일
ALTER TABLE "admin_audit_logs" ADD COLUMN IF NOT EXISTS "adminEmail" TEXT;
ALTER TABLE "admin_audit_logs" ADD COLUMN IF NOT EXISTS "reason" TEXT;
CREATE INDEX IF NOT EXISTS "admin_audit_logs_createdAt_idx" ON "admin_audit_logs"("createdAt");
CREATE INDEX IF NOT EXISTS "admin_audit_logs_targetType_targetId_idx" ON "admin_audit_logs"("targetType", "targetId");
CREATE INDEX IF NOT EXISTS "admin_audit_logs_action_idx" ON "admin_audit_logs"("action");

-- 2) 글 상태(published | draft | scheduled | private) · 게시 예약 시각 — 기존 글은 모두 published
ALTER TABLE "community_posts" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'published';
ALTER TABLE "community_posts" ADD COLUMN IF NOT EXISTS "publishAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "community_posts_status_publishAt_idx" ON "community_posts"("status", "publishAt");

-- 3) 운영 프로필
CREATE TABLE IF NOT EXISTS "community_operator_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "nickname" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "bio" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdByAdminId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "community_operator_profiles_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "community_operator_profiles_userId_key" ON "community_operator_profiles"("userId");

-- 4) 테스트 좋아요·조회수(개발·스테이징 전용 — 운영 서버는 쓰지도 읽지도 않는다)
CREATE TABLE IF NOT EXISTS "community_test_metrics" (
    "postId" TEXT NOT NULL,
    "likes" INTEGER NOT NULL DEFAULT 0,
    "views" INTEGER NOT NULL DEFAULT 0,
    "updatedByAdminId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "community_test_metrics_pkey" PRIMARY KEY ("postId")
);

-- 5) 기존 운영진 에디터 4계정(이미 앱에서 '운영진' 표시 중)을 운영 프로필로 등록 — 이름·사진은 지금 계정 값 그대로
WITH ins AS (
  INSERT INTO "community_operator_profiles" ("id", "userId", "nickname", "avatarUrl", "bio", "isActive", "createdByAdminId", "createdAt", "updatedAt")
  SELECT gen_random_uuid()::text, u."id", u."name", u."profileImageUrl", NULL, true, 'system:backfill', NOW(), NOW()
  FROM "users" u
  WHERE u."id" IN (
    '939313a1-1b41-4f2a-b3c0-f9c189616daa',
    'fe30b69f-5396-4fa6-b466-6e0cdca3431a',
    '03d9933c-454f-4913-9493-d75dff85e8e7',
    'b30daa89-aad7-488a-acdf-3e2ddc47e7fa'
  )
  ON CONFLICT ("userId") DO NOTHING
  RETURNING "id", "userId", "nickname"
)
INSERT INTO "admin_audit_logs" ("id", "adminId", "action", "targetType", "targetId", "afterState", "reason", "createdAt")
SELECT gen_random_uuid()::text, 'system', 'operator_profile.create', 'operator_profile', ins."id",
       jsonb_build_object('userId', ins."userId", 'nickname', ins."nickname", 'source', 'backfill'),
       '기존 운영진 에디터 계정을 운영 프로필로 등록', NOW()
FROM ins;

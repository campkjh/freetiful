-- 신규가입 5,000원 미션(261110) — 출석(하루 한 번) + 지급 신청. 새 표 둘만(기존 표 안 건드림), 다시 돌려도 안전.
BEGIN;

CREATE TABLE IF NOT EXISTS "user_attendances" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_attendances_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "welcome_mission_claims" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rewardAmount" INTEGER NOT NULL DEFAULT 5000,
    "phone" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "accountHolder" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "adminNote" TEXT,
    "paidAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "welcome_mission_claims_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "user_attendances_userId_day_key" ON "user_attendances"("userId", "day");
CREATE UNIQUE INDEX IF NOT EXISTS "welcome_mission_claims_userId_key" ON "welcome_mission_claims"("userId");
CREATE INDEX IF NOT EXISTS "welcome_mission_claims_status_createdAt_idx" ON "welcome_mission_claims"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "welcome_mission_claims_phone_idx" ON "welcome_mission_claims"("phone");
CREATE INDEX IF NOT EXISTS "welcome_mission_claims_accountNumber_idx" ON "welcome_mission_claims"("accountNumber");

COMMIT;

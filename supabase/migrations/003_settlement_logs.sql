-- 2026-04 정산 로그 테이블
-- 결제 완료 시 pending 로그가 자동 생성되고, 관리자가 "정산" 클릭 시 settled 로 전환됨

CREATE TYPE "SettlementStatus" AS ENUM ('pending', 'settled', 'cancelled');

CREATE TABLE "settlement_logs" (
  "id"              TEXT PRIMARY KEY,
  "paymentId"       TEXT NOT NULL UNIQUE REFERENCES "payments"("id") ON DELETE CASCADE,
  "proProfileId"    TEXT NOT NULL REFERENCES "pro_profiles"("id"),
  "amount"          INTEGER NOT NULL,
  "platformFee"     INTEGER NOT NULL DEFAULT 0,
  "netAmount"       INTEGER NOT NULL,
  "status"          "SettlementStatus" NOT NULL DEFAULT 'pending',
  "settledAt"       TIMESTAMP(3),
  "settledByUserId" TEXT REFERENCES "users"("id"),
  "note"            TEXT,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL
);

CREATE INDEX "settlement_logs_pro_status_idx" ON "settlement_logs"("proProfileId", "status");
CREATE INDEX "settlement_logs_status_created_idx" ON "settlement_logs"("status", "createdAt" DESC);

-- 기존 completed 결제들에 대한 pending SettlementLog 백필
INSERT INTO "settlement_logs" (
  "id", "paymentId", "proProfileId", "amount", "platformFee", "netAmount",
  "status", "settledAt", "createdAt", "updatedAt"
)
SELECT
  gen_random_uuid()::text,
  p."id",
  p."proProfileId",
  p."amount",
  COALESCE(p."platformFee", 0),
  COALESCE(p."netAmount", p."amount" - COALESCE(p."platformFee", 0)),
  CASE WHEN p."settledAt" IS NOT NULL THEN 'settled'::"SettlementStatus" ELSE 'pending'::"SettlementStatus" END,
  p."settledAt",
  p."createdAt",
  CURRENT_TIMESTAMP
FROM "payments" p
WHERE p."status" = 'completed'
ON CONFLICT DO NOTHING;

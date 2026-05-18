CREATE TABLE "referral_event_claims" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "campaignKey" TEXT NOT NULL DEFAULT 'friend-invite-cash-2026',
  "referralCountSnapshot" INTEGER NOT NULL DEFAULT 0,
  "rewardAmount" INTEGER NOT NULL DEFAULT 5000,
  "bankName" TEXT NOT NULL,
  "accountHolder" TEXT NOT NULL,
  "accountNumber" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "adminNote" TEXT,
  "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "referral_event_claims_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "referral_event_claims_userId_campaignKey_key"
  ON "referral_event_claims"("userId", "campaignKey");

CREATE INDEX "referral_event_claims_campaignKey_status_submittedAt_idx"
  ON "referral_event_claims"("campaignKey", "status", "submittedAt");

ALTER TABLE "referral_event_claims"
  ADD CONSTRAINT "referral_event_claims_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

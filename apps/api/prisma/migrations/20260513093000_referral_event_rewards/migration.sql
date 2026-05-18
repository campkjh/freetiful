CREATE TABLE "referral_event_rewards" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "campaignKey" TEXT NOT NULL DEFAULT 'friend-invite-cash-2026',
  "step" INTEGER NOT NULL,
  "rewardAmount" INTEGER NOT NULL DEFAULT 1000,
  "claimedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "referral_event_rewards_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "referral_event_rewards_userId_campaignKey_step_key"
  ON "referral_event_rewards"("userId", "campaignKey", "step");

CREATE INDEX "referral_event_rewards_campaignKey_claimedAt_idx"
  ON "referral_event_rewards"("campaignKey", "claimedAt");

ALTER TABLE "referral_event_rewards"
  ADD CONSTRAINT "referral_event_rewards_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

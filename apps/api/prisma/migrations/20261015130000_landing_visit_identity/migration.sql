SET lock_timeout = '5s';
ALTER TABLE "landing_visits" ADD COLUMN IF NOT EXISTS "userId" TEXT;
ALTER TABLE "match_requests" ADD COLUMN IF NOT EXISTS "landingVisitId" TEXT;
ALTER TABLE "business_inquiries" ADD COLUMN IF NOT EXISTS "landingVisitId" TEXT;
CREATE INDEX IF NOT EXISTS "match_requests_landingVisitId_idx" ON "match_requests"("landingVisitId");
CREATE INDEX IF NOT EXISTS "business_inquiries_landingVisitId_idx" ON "business_inquiries"("landingVisitId");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'match_requests_landingVisitId_fkey') THEN
    ALTER TABLE "match_requests" ADD CONSTRAINT "match_requests_landingVisitId_fkey" FOREIGN KEY ("landingVisitId") REFERENCES "landing_visits"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'business_inquiries_landingVisitId_fkey') THEN
    ALTER TABLE "business_inquiries" ADD CONSTRAINT "business_inquiries_landingVisitId_fkey" FOREIGN KEY ("landingVisitId") REFERENCES "landing_visits"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
CREATE TABLE IF NOT EXISTS "admin_daily_briefings" (
  "slotKey" TEXT PRIMARY KEY,
  "payload" JSONB NOT NULL,
  "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL
);

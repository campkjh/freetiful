CREATE TABLE IF NOT EXISTS "match_alimtalk_deliveries" (
  "id" TEXT PRIMARY KEY,
  "kind" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "subjectId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "dueAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "providerId" TEXT,
  "reason" TEXT
);

CREATE INDEX IF NOT EXISTS "match_alimtalk_deliveries_status_dueAt_idx"
  ON "match_alimtalk_deliveries" ("status", "dueAt");
CREATE INDEX IF NOT EXISTS "match_alimtalk_deliveries_userId_kind_status_updatedAt_idx"
  ON "match_alimtalk_deliveries" ("userId", "kind", "status", "updatedAt");

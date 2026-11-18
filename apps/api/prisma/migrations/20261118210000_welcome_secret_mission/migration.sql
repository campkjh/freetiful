-- 시크릿 미션 응모(261118) — 새 표 하나만(기존 표 안 건드림), 다시 돌려도 안전.
BEGIN;

CREATE TABLE IF NOT EXISTS "welcome_secret_entries" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "instagramId" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "thumbUrl" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'entered',
    "adminNote" TEXT,
    "wonAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "welcome_secret_entries_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "welcome_secret_entries_userId_key" ON "welcome_secret_entries"("userId");
CREATE INDEX IF NOT EXISTS "welcome_secret_entries_status_createdAt_idx" ON "welcome_secret_entries"("status", "createdAt");

COMMIT;

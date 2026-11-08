-- 송년회(261108 사장 'Freetiful & WMAK 2026 Year-End RECEPTION' — 웹 /reception) 이벤트 사진·좋아요/공감·설문 표.
-- 전부 추가만 한다(기존 표·컬럼을 바꾸거나 지우지 않음). 여러 번 돌려도 같은 결과(IF NOT EXISTS · 제약은 없을 때만).
-- `prisma migrate diff --from-empty --to-schema-datamodel` 출력의 reception_* 부분 그대로(+ IF NOT EXISTS).
-- 운영은 SKIP_PRISMA_DB_PUSH=1 이라 사람이 `npx prisma db execute --file prisma/migrations/20261108120000_reception_event/migration.sql --schema prisma/schema.prisma` 로 적용한다.

BEGIN;

CREATE TABLE IF NOT EXISTS "reception_photos" (
    "id" TEXT NOT NULL,
    "eventKey" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "thumbUrl" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "reception_photos_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "reception_votes" (
    "id" TEXT NOT NULL,
    "eventKey" TEXT NOT NULL,
    "photoId" TEXT NOT NULL,
    "voterDeviceId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reception_votes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "reception_surveys" (
    "id" TEXT NOT NULL,
    "eventKey" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "answers" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "reception_surveys_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "reception_photos_eventKey_deletedAt_createdAt_idx" ON "reception_photos"("eventKey", "deletedAt", "createdAt");

CREATE INDEX IF NOT EXISTS "reception_photos_eventKey_deviceId_idx" ON "reception_photos"("eventKey", "deviceId");

CREATE INDEX IF NOT EXISTS "reception_votes_eventKey_voterDeviceId_kind_idx" ON "reception_votes"("eventKey", "voterDeviceId", "kind");

CREATE INDEX IF NOT EXISTS "reception_votes_eventKey_photoId_idx" ON "reception_votes"("eventKey", "photoId");

CREATE UNIQUE INDEX IF NOT EXISTS "reception_votes_photoId_voterDeviceId_kind_key" ON "reception_votes"("photoId", "voterDeviceId", "kind");

CREATE UNIQUE INDEX IF NOT EXISTS "reception_surveys_eventKey_deviceId_key" ON "reception_surveys"("eventKey", "deviceId");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reception_votes_photoId_fkey') THEN
    ALTER TABLE "reception_votes" ADD CONSTRAINT "reception_votes_photoId_fkey" FOREIGN KEY ("photoId") REFERENCES "reception_photos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

COMMIT;

-- 송년회 손님 표(261108 사장 '어드민 campkjh@nate.com 에서 누가 참여했는지 · 누가 설문에 답했는지').
-- 자리 탭에서 이름을 넣은 기기를 남긴다(예전엔 이름이 폰에만 있어 서버가 몰랐다). 추가만 · 여러 번 돌려도 같은 결과.
-- 운영 적용: npx prisma db execute --file prisma/migrations/20261108180000_reception_guests/migration.sql --schema prisma/schema.prisma

BEGIN;

CREATE TABLE IF NOT EXISTS "reception_guests" (
    "id" TEXT NOT NULL,
    "eventKey" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reception_guests_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "reception_guests_eventKey_deviceId_key" ON "reception_guests"("eventKey", "deviceId");

CREATE INDEX IF NOT EXISTS "reception_guests_eventKey_createdAt_idx" ON "reception_guests"("eventKey", "createdAt");

COMMIT;

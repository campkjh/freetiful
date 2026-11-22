-- 송년회 2차(261122 사장 '정답 공개 때 테이블마다 어떤 정답을 썼는지' · '이름을 입력하면 자리 + 럭키드로우' · '관리자 태블릿에서 누가 왔는지').
-- 진행 상태 · 자리 명단 · 응모권(=입장) · 추첨 기록 · 퀴즈 테이블 답 표. 전부 추가만 한다(기존 표·컬럼을 바꾸거나 지우지 않음). 여러 번 돌려도 같은 결과.
-- `prisma migrate diff --from-empty --to-schema-datamodel` 출력의 해당 부분 그대로(+ IF NOT EXISTS).
-- 운영 적용: npx prisma db execute --file prisma/migrations/20261122120000_reception_quiz_draw/migration.sql --schema prisma/schema.prisma

BEGIN;

CREATE TABLE IF NOT EXISTS "reception_state" (
    "eventKey" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reception_state_pkey" PRIMARY KEY ("eventKey", "key")
);

CREATE TABLE IF NOT EXISTS "reception_seats" (
    "id" TEXT NOT NULL,
    "eventKey" TEXT NOT NULL,
    "nameKey" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tableNo" INTEGER NOT NULL,
    "seatNo" INTEGER,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reception_seats_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "reception_seats_eventKey_nameKey_key" ON "reception_seats"("eventKey", "nameKey");

CREATE TABLE IF NOT EXISTS "reception_tickets" (
    "id" TEXT NOT NULL,
    "eventKey" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "nameKey" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reception_tickets_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "reception_tickets_eventKey_number_key" ON "reception_tickets"("eventKey", "number");

CREATE UNIQUE INDEX IF NOT EXISTS "reception_tickets_eventKey_nameKey_key" ON "reception_tickets"("eventKey", "nameKey");

CREATE TABLE IF NOT EXISTS "reception_draws" (
    "id" TEXT NOT NULL,
    "eventKey" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "prize" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cancelledAt" TIMESTAMPTZ(3),

    CONSTRAINT "reception_draws_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "reception_draws_eventKey_createdAt_idx" ON "reception_draws"("eventKey", "createdAt");

CREATE TABLE IF NOT EXISTS "reception_quiz_answers" (
    "id" TEXT NOT NULL,
    "eventKey" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "tableNo" INTEGER NOT NULL,
    "answer" TEXT,
    "name" TEXT,
    "deviceId" TEXT,
    "correct" BOOLEAN,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reception_quiz_answers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "reception_quiz_answers_eventKey_questionId_tableNo_key" ON "reception_quiz_answers"("eventKey", "questionId", "tableNo");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reception_draws_ticketId_fkey') THEN
    ALTER TABLE "reception_draws" ADD CONSTRAINT "reception_draws_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "reception_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

COMMIT;

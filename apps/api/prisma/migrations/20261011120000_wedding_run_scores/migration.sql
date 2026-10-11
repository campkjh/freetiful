-- 웨딩런 '신혼집까지 달려!' 점수 표(261011 사장 '원라인솔루션 에그점프처럼 점프게임, url 은 따로').
-- 한 판 = 1행, sessionId unique 로 한 판은 한 번만 제출. 순위 = 플레이어(playerKey)당 기간 최고점(동점은 먼저 낸 사람 위).
-- 개인 정보: 닉네임은 공개용(실명 아님), IP 는 해시(ipHash)만 저장한다.
-- 전부 추가만 한다(기존 표·컬럼을 바꾸거나 지우지 않음). 여러 번 돌려도 같은 결과(IF NOT EXISTS).
-- `prisma migrate diff --from-empty --to-schema-datamodel` 출력의 wedding_run_scores 부분 그대로(+ IF NOT EXISTS).
-- 운영은 SKIP_PRISMA_DB_PUSH=1 이라 사람이 `npx prisma db execute --file prisma/migrations/20261011120000_wedding_run_scores/migration.sql --schema prisma/schema.prisma` 로 적용한다.

BEGIN;

CREATE TABLE IF NOT EXISTS "wedding_run_scores" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "playerKey" TEXT NOT NULL,
    "userId" TEXT,
    "deviceId" TEXT NOT NULL,
    "nickname" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "stage" INTEGER NOT NULL,
    "segment" INTEGER NOT NULL,
    "arrived" BOOLEAN NOT NULL DEFAULT false,
    "laps" INTEGER NOT NULL DEFAULT 0,
    "durationMs" INTEGER NOT NULL,
    "hearts" INTEGER NOT NULL DEFAULT 0,
    "envelopes" INTEGER NOT NULL DEFAULT 0,
    "ipHash" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wedding_run_scores_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "wedding_run_scores_sessionId_key" ON "wedding_run_scores"("sessionId");
CREATE INDEX IF NOT EXISTS "wedding_run_scores_createdAt_idx" ON "wedding_run_scores"("createdAt");
CREATE INDEX IF NOT EXISTS "wedding_run_scores_playerKey_score_idx" ON "wedding_run_scores"("playerKey", "score" DESC);
CREATE INDEX IF NOT EXISTS "wedding_run_scores_score_createdAt_idx" ON "wedding_run_scores"("score" DESC, "createdAt");

COMMIT;

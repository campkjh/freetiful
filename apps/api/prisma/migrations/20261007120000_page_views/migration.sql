-- 페이지별 인사이트 저장 표(261007 사장 '페이지별 방문자 수, 잔류시간 — 기간별·엑셀로').
-- 화면을 열 때마다 1행, 떠날 때 체류시간(durationMs)을 채운다. 개인 정보 없음(visitorId = 기기마다 무작위 값).
-- 전부 추가만 한다(기존 표·컬럼을 바꾸거나 지우지 않음). 여러 번 돌려도 같은 결과(IF NOT EXISTS).
-- `prisma migrate diff`(schema 기준) 출력 = 아래 CREATE TABLE + INDEX 그대로. 운영 DB 기준 diff 가 내놓는 DROP INDEX(reviews_…_idx)는 넣지 않는다.

BEGIN;

CREATE TABLE IF NOT EXISTS "page_views" (
    "id" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "visitorId" TEXT NOT NULL,
    "sessionKey" TEXT NOT NULL,
    "platform" TEXT,
    "device" TEXT,
    "entry" BOOLEAN NOT NULL DEFAULT false,
    "referrerHost" TEXT,
    "durationMs" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "page_views_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "page_views_createdAt_idx" ON "page_views"("createdAt");
CREATE INDEX IF NOT EXISTS "page_views_path_createdAt_idx" ON "page_views"("path", "createdAt");

COMMIT;

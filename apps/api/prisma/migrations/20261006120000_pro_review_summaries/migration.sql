-- 사회자 리뷰 요약 저장 표(261006 사장 '리뷰 요약 DB 에 저장 — 배포마다 다시 만들지 않게').
-- 메모리에만 두면 재배포 때마다 사라져 사회자마다 Gemini 를 다시 불렀다(최근 24시간 AI 호출의 대부분).
-- 전부 추가만 한다(기존 표·컬럼을 바꾸거나 지우지 않음). 여러 번 돌려도 같은 결과(IF NOT EXISTS).
-- `prisma migrate diff`(schema 기준) 출력 = 아래 CREATE TABLE + FK 그대로. 운영 DB 기준 diff 가 내놓는 DROP INDEX(reviews_…_idx)는 넣지 않는다.

BEGIN;

CREATE TABLE IF NOT EXISTS "pro_review_summaries" (
    "proProfileId" TEXT NOT NULL,
    "sig" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "keywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "reviewCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pro_review_summaries_pkey" PRIMARY KEY ("proProfileId")
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pro_review_summaries_proProfileId_fkey') THEN
    ALTER TABLE "pro_review_summaries"
      ADD CONSTRAINT "pro_review_summaries_proProfileId_fkey"
      FOREIGN KEY ("proProfileId") REFERENCES "pro_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

COMMIT;

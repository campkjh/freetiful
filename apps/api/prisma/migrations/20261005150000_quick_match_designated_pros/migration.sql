-- 퀵매칭 지정 사회자를 코드(match/quick-match.config.ts)에서 DB 로(261005 사장 '사회자 부분에 퀵매칭에 노출시킬 사회자 토글').
-- 전부 추가만 한다(기존 표·컬럼을 바꾸거나 지우지 않음). 여러 번 돌려도 같은 결과(IF NOT EXISTS · ON CONFLICT DO NOTHING).
-- pro_profiles 에 컬럼을 붙이지 않고 따로 표를 둔 이유: Prisma 는 pro_profiles 를 읽을 때 모든 컬럼을 SELECT 하므로,
--   컬럼이면 이 SQL 보다 API 가 먼저 배포됐을 때 사회자 조회가 전부 깨진다. 표면 없을 때 코드가 config 명단으로 돌아간다.
-- `prisma migrate diff`(schema 기준) 출력 = 아래 CREATE TABLE + FK 그대로. 운영 DB 기준 diff 가 내놓는 DROP INDEX(reviews_…_idx)는 넣지 않는다.

BEGIN;

CREATE TABLE IF NOT EXISTS "quick_match_designated_pros" (
    "proProfileId" TEXT NOT NULL,
    "gender" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedBy" TEXT,

    CONSTRAINT "quick_match_designated_pros_pkey" PRIMARY KEY ("proProfileId")
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'quick_match_designated_pros_proProfileId_fkey') THEN
    ALTER TABLE "quick_match_designated_pros"
      ADD CONSTRAINT "quick_match_designated_pros_proProfileId_fkey"
      FOREIGN KEY ("proProfileId") REFERENCES "pro_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- 지금 명단(260927 사장 지정 12명) 그대로 옮기기 — 성별 묶음·순서도 config 그대로(남 5 · 여 7).
-- 순서 = createdAt 오름차순(코드가 그렇게 읽는다) → config 순서대로 1ms 씩 벌려 넣는다(한 문장 안 CURRENT_TIMESTAMP 는 다 같아서).
-- 운영 DB 에 없는 프로필 id 는 건너뛴다(FK). 표가 비어 있고 어드민 스위치 이력('pro.quick_match')도 없을 때만 넣는다
--   — 다시 돌려도 어드민에서 끈 사람을(전원을 꺼 표가 빈 경우까지) 되살리지 않는다.
INSERT INTO "quick_match_designated_pros" ("proProfileId", "gender", "createdAt", "updatedAt", "updatedBy")
SELECT v.id, v.gender,
       CURRENT_TIMESTAMP + v.ord * INTERVAL '1 millisecond',
       CURRENT_TIMESTAMP + v.ord * INTERVAL '1 millisecond',
       'migration:quick-match.config'
FROM (VALUES
  ('bcbc3d81-27e1-4eea-9ddc-358c728d7c96', 'male',    1), -- 김병국
  ('9bded78a-431c-4b85-8a9d-fd2b61c1ff2e', 'male',    2), -- 조동호
  ('44aaf9df-fd3b-4a2f-805a-3da588c5799a', 'male',    3), -- 전준배
  ('163fc6dd-20f0-4549-ae0a-c86ca6c7c7bd', 'male',    4), -- 전승민
  ('52af21ac-b707-4cec-94da-0bba1b729ed8', 'male',    5), -- 노유재
  ('6fb8f628-7549-44e6-8136-71d74c937d75', 'female',  6), -- 이승진
  ('d35e3cf7-5885-43e2-832e-dcc0b1f50c2f', 'female',  7), -- 나연지
  ('b9d1ba06-882d-437f-a072-7eb8b8056f27', 'female',  8), -- 문정은
  ('63a96e5f-7c1e-4106-80ab-e1d4e2a8d04a', 'female',  9), -- 심수의
  ('9df27318-94c4-4877-8971-b921746b36b8', 'female', 10), -- 김규연
  ('1ae2c8d3-8b11-4e02-8296-5a3e348c0b73', 'female', 11), -- 김솔
  ('ebd7e017-acdb-41ea-bb36-e069369d23e5', 'female', 12)  -- 이도윤(사장 정정 260927 — 여성 묶음)
) AS v(id, gender, ord)
JOIN "pro_profiles" p ON p."id" = v.id
WHERE NOT EXISTS (SELECT 1 FROM "quick_match_designated_pros")
  AND NOT EXISTS (SELECT 1 FROM "admin_audit_logs" WHERE "action" = 'pro.quick_match')
ON CONFLICT ("proProfileId") DO NOTHING;

COMMIT;

-- 확인: SELECT gender, count(*) FROM "quick_match_designated_pros" GROUP BY 1;  → male 5 · female 7
--       SELECT "proProfileId", gender FROM "quick_match_designated_pros" ORDER BY "createdAt", "proProfileId";  → 위 순서 그대로
-- 되돌리기(필요할 때만, 코드는 표가 없으면 config 명단으로 돈다): DROP TABLE IF EXISTS "quick_match_designated_pros";

-- 웨딩런 랭킹 API 검증 보강(261011 사장 '웨딩런: 신혼집까지 달려!' 2D 개편 — 앞 검증 7건 반영).
--  · wedding_run_sessions : 판 세션을 DB 에 남겨 한 번만 쓰고 30분에 만료(토큰 받아 두고 기다렸다 큰 점수 내는 공격 차단)
--  · wedding_run_players  : 플레이어별 공개 닉네임(마지막으로 정한 이름)·같은 이름 금지 키·운영 숨김
--  · wedding_run_bests    : 기간별(전체·KST 날짜·KST 주) 플레이어 최고점 요약 — 순위가 점수 표 전체를 정렬하지 않게
--  · wedding_run_scores   : 운영 숨김 칸 2개 추가(NULL 허용 — 표 다시 쓰기 없음), 쓰이지 않던 (score DESC, createdAt) 색인 삭제
-- 전부 웨딩런 표만 건드린다(다른 표는 읽지도 바꾸지도 않음). 여러 번 돌려도 같은 결과(IF NOT EXISTS · ON CONFLICT DO NOTHING).
-- 모양은 `prisma migrate diff --from-schema-datamodel <이전 schema> --to-schema-datamodel prisma/schema.prisma` 출력 그대로(+ IF NOT EXISTS).
-- 같은 이름의 표가 다른 모양으로 이미 있으면 IF NOT EXISTS 가 조용히 건너뛰므로, 끝에서 칸을 확인하고 다르면 전체를 되돌린다(RAISE).
--
-- 적용(운영은 SKIP_PRISMA_DB_PUSH=1 — 사람이 직접, 20261011120000_wedding_run_scores 다음에):
--   npx prisma db execute --file prisma/migrations/20261011120000_wedding_run_scores/migration.sql --schema prisma/schema.prisma
--   npx prisma db execute --file prisma/migrations/20261011123000_wedding_run_sessions_bests/migration.sql --schema prisma/schema.prisma
-- API 배포는 이 두 파일 적용 뒤(새 표가 없으면 게임 API 가 500 → 웹은 '랭킹 준비 중'으로 처리).

BEGIN;

-- ── 점수 표: 운영 숨김 칸 · 색인 정리 ──
ALTER TABLE "wedding_run_scores" ADD COLUMN IF NOT EXISTS "hiddenAt" TIMESTAMPTZ(3);
ALTER TABLE "wedding_run_scores" ADD COLUMN IF NOT EXISTS "hiddenReason" TEXT;
-- 어떤 쿼리도 쓰지 않아 쓰기 비용만 늘리던 색인(순위는 이제 wedding_run_bests 에서 읽는다)
DROP INDEX IF EXISTS "wedding_run_scores_score_createdAt_idx";

-- ── 세션 ──
CREATE TABLE IF NOT EXISTS "wedding_run_sessions" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "playerKey" TEXT NOT NULL,
    "userId" TEXT,
    "ipHash" TEXT,
    "startedAt" TIMESTAMPTZ(3) NOT NULL,
    "usedAt" TIMESTAMPTZ(3),
    "closeReason" TEXT,

    CONSTRAINT "wedding_run_sessions_pkey" PRIMARY KEY ("id")
);

-- ── 플레이어 ──
CREATE TABLE IF NOT EXISTS "wedding_run_players" (
    "playerKey" TEXT NOT NULL,
    "userId" TEXT,
    "deviceId" TEXT NOT NULL,
    "nickname" TEXT NOT NULL,
    "nicknameKey" TEXT,
    "nicknameLocked" BOOLEAN NOT NULL DEFAULT false,
    "hiddenAt" TIMESTAMPTZ(3),
    "hiddenReason" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "wedding_run_players_pkey" PRIMARY KEY ("playerKey")
);

-- ── 기간별 최고점 요약 ──
CREATE TABLE IF NOT EXISTS "wedding_run_bests" (
    "periodKey" TEXT NOT NULL,
    "playerKey" TEXT NOT NULL,
    "scoreId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "stage" INTEGER NOT NULL,
    "arrived" BOOLEAN NOT NULL,
    "achievedAt" TIMESTAMPTZ(3) NOT NULL,
    "hidden" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "wedding_run_bests_pkey" PRIMARY KEY ("periodKey","playerKey")
);

-- ── 모양 확인(다른 모양의 같은 이름 표가 있었다면 색인을 만들기 전에 여기서 전체 되돌림) ──
DO $$
DECLARE
  missing text;
BEGIN
  SELECT string_agg(t.tbl || '.' || t.col, ', ') INTO missing
  FROM (VALUES
    ('wedding_run_scores', 'hiddenAt'), ('wedding_run_scores', 'hiddenReason'), ('wedding_run_scores', 'playerKey'), ('wedding_run_scores', 'score'),
    ('wedding_run_sessions', 'id'), ('wedding_run_sessions', 'deviceId'), ('wedding_run_sessions', 'playerKey'), ('wedding_run_sessions', 'userId'),
    ('wedding_run_sessions', 'ipHash'), ('wedding_run_sessions', 'startedAt'), ('wedding_run_sessions', 'usedAt'), ('wedding_run_sessions', 'closeReason'),
    ('wedding_run_players', 'playerKey'), ('wedding_run_players', 'userId'), ('wedding_run_players', 'deviceId'), ('wedding_run_players', 'nickname'),
    ('wedding_run_players', 'nicknameKey'), ('wedding_run_players', 'nicknameLocked'), ('wedding_run_players', 'hiddenAt'), ('wedding_run_players', 'hiddenReason'),
    ('wedding_run_players', 'createdAt'), ('wedding_run_players', 'updatedAt'),
    ('wedding_run_bests', 'periodKey'), ('wedding_run_bests', 'playerKey'), ('wedding_run_bests', 'scoreId'), ('wedding_run_bests', 'score'),
    ('wedding_run_bests', 'stage'), ('wedding_run_bests', 'arrived'), ('wedding_run_bests', 'achievedAt'), ('wedding_run_bests', 'hidden')
  ) AS t(tbl, col)
  WHERE NOT EXISTS (
    SELECT 1 FROM information_schema.columns c
    WHERE c.table_schema = current_schema() AND c.table_name = t.tbl AND c.column_name = t.col
  );
  IF missing IS NOT NULL THEN
    RAISE EXCEPTION '웨딩런 표 모양이 예상과 다릅니다(없는 칸: %) — 적용을 되돌립니다', missing;
  END IF;
END $$;

-- ── 색인 ──
CREATE INDEX IF NOT EXISTS "wedding_run_sessions_deviceId_startedAt_idx" ON "wedding_run_sessions"("deviceId", "startedAt");
CREATE INDEX IF NOT EXISTS "wedding_run_sessions_ipHash_startedAt_idx" ON "wedding_run_sessions"("ipHash", "startedAt");
CREATE INDEX IF NOT EXISTS "wedding_run_sessions_startedAt_idx" ON "wedding_run_sessions"("startedAt");
CREATE UNIQUE INDEX IF NOT EXISTS "wedding_run_players_nicknameKey_key" ON "wedding_run_players"("nicknameKey");
CREATE INDEX IF NOT EXISTS "wedding_run_players_userId_idx" ON "wedding_run_players"("userId");
CREATE INDEX IF NOT EXISTS "wedding_run_bests_periodKey_hidden_score_achievedAt_scoreId_idx" ON "wedding_run_bests"("periodKey", "hidden", "score" DESC, "achievedAt", "scoreId");
CREATE INDEX IF NOT EXISTS "wedding_run_bests_playerKey_idx" ON "wedding_run_bests"("playerKey");

-- ── 이미 있던 점수로 플레이어·요약 채우기(새 API 배포 전 기록이 있을 때만 의미 — 없으면 아무 일 없음) ──
-- 플레이어: 가장 최근 판의 닉네임·기기·계정(직접 정한 이름 여부를 모르므로 같은 이름 키는 비워 둔다)
INSERT INTO "wedding_run_players" ("playerKey", "userId", "deviceId", "nickname", "nicknameKey", "createdAt", "updatedAt")
SELECT DISTINCT ON (s."playerKey") s."playerKey", s."userId", s."deviceId", s."nickname", NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "wedding_run_scores" s
ORDER BY s."playerKey", s."createdAt" DESC, s."id" DESC
ON CONFLICT DO NOTHING;

-- 요약: 전체 · KST 날짜('d:YYYY-MM-DD') · KST 주 월요일('w:YYYY-MM-DD') 마다 플레이어 최고점(동점은 먼저 낸 판). 숨긴 판은 뺀다
INSERT INTO "wedding_run_bests" ("periodKey", "playerKey", "scoreId", "score", "stage", "arrived", "achievedAt", "hidden")
SELECT DISTINCT ON (k."periodKey", k."playerKey") k."periodKey", k."playerKey", k."id", k."score", k."stage", k."arrived", k."createdAt", false
FROM (
  SELECT 'all' AS "periodKey", s.* FROM "wedding_run_scores" s WHERE s."hiddenAt" IS NULL
  UNION ALL
  SELECT 'd:' || to_char((s."createdAt" AT TIME ZONE 'UTC') + interval '9 hours', 'YYYY-MM-DD'), s.* FROM "wedding_run_scores" s WHERE s."hiddenAt" IS NULL
  UNION ALL
  SELECT 'w:' || to_char(date_trunc('week', (s."createdAt" AT TIME ZONE 'UTC') + interval '9 hours'), 'YYYY-MM-DD'), s.* FROM "wedding_run_scores" s WHERE s."hiddenAt" IS NULL
) k
ORDER BY k."periodKey", k."playerKey", k."score" DESC, k."createdAt" ASC, k."id" ASC
ON CONFLICT DO NOTHING;

COMMIT;

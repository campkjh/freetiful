-- 송년회 3차(261122 사장 '럭키드로우권이 앱에서 발급 · 이벤트 페이지에서 확인 · 당첨이 되면 푸시 알람이 가게끔 당사자에게').
-- 손님 표 · 응모권에 프리티풀 계정(userId)을 붙인다 — 당첨 푸시 받을 사람. 로그인 안 한 손님은 null.
-- 전부 추가만 한다(기존 표·컬럼을 바꾸거나 지우지 않음, 외래 키 없음 — 탈퇴해도 송년회 기록은 그대로). 여러 번 돌려도 같은 결과.
-- `prisma migrate diff --from-schema-datamodel (HEAD) --to-schema-datamodel` 출력 그대로(+ IF NOT EXISTS).
-- 운영 적용: npx prisma db execute --file prisma/migrations/20261122200000_reception_user_link/migration.sql --schema prisma/schema.prisma
-- **API 배포보다 먼저 적용** — Dockerfile 기본 SKIP_PRISMA_DB_PUSH=1 이라 부팅 때 스키마 동기화가 없다. 컬럼 없이 새 API 가 뜨면
--   응모권·손님 표를 읽는 쿼리가 "userId" 를 찾다 실패 → PUT /guest(자리·응모권)와 어드민 추첨판이 500. 배포 뒤 PUT /guest 200 확인.

BEGIN;

ALTER TABLE "reception_guests" ADD COLUMN IF NOT EXISTS "userId" TEXT;

ALTER TABLE "reception_tickets" ADD COLUMN IF NOT EXISTS "userId" TEXT;

COMMIT;

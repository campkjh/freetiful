-- 송년회 2차 회식(261122 사장 '송년회 설문조사에 첫번째가 2차 회식 참여 여부 — 예 버튼을 누르면 어드민 참여자 명단에 2차 참여 태그').
-- 손님 표에 2차 참여('yes' | 'no', 안 골랐으면 null)와 마지막으로 바꾼 때를 붙인다. 설문 첫 질문에서 누르는 순간 저장(설문 제출과 따로).
-- 전부 추가만 한다(기존 표·컬럼을 바꾸거나 지우지 않음). 여러 번 돌려도 같은 결과.
-- 운영 적용: npx prisma db execute --file prisma/migrations/20261122230000_reception_after_party/migration.sql --schema prisma/schema.prisma
-- **API 배포보다 먼저 적용** — Dockerfile 기본 SKIP_PRISMA_DB_PUSH=1 이라 부팅 때 스키마 동기화가 없다. 컬럼 없이 새 API 가 뜨면
--   손님 표를 읽는 쿼리가 "afterParty" 를 찾다 실패 → GET·PUT /survey · PUT /after-party · 어드민 설문/참여자가 500. 배포 뒤 GET /survey 200 확인.

BEGIN;

ALTER TABLE "reception_guests" ADD COLUMN IF NOT EXISTS "afterParty" TEXT;

ALTER TABLE "reception_guests" ADD COLUMN IF NOT EXISTS "afterPartyAt" TIMESTAMPTZ(3);

COMMIT;

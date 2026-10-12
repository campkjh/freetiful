-- 음성 메시지 enum 값 되살리기(261012 사장 '채팅창 내에서 갤럭시 장소/음성 전달 실패(아이폰 갤럭시 둘다 발생함)').
-- 웹은 녹음을 type 'voice' 로 보내는데 "MessageType" 에 voice 가 없어 INSERT 가 실패했다(7/1 3e5c5355 에서 schema 에서 빠짐).
-- 운영 DB 에 예전 값이 이미 남아 있을 수도 있어 IF NOT EXISTS — 몇 번을 돌려도 같은 결과.
-- 카탈로그에 값 하나만 덧붙인다(표 재작성·messages 행 잠금 없음, 기존 값·행은 그대로).
-- ⚠ 이 파일은 이 문장 하나만 둔다 — BEGIN/COMMIT 으로 감싸거나 다른 문장과 같이 보내면 안 된다
--   (PG11 이하는 트랜잭션 블록 안 ADD VALUE 거절, PG12+ 도 같은 트랜잭션에서는 새 값을 못 쓴다).
-- 적용 순서: ① 이 파일(DB) → ② API(Railway, prisma generate 에 voice 포함) → ③ 웹. API 를 먼저 올리면 voice INSERT 가 22P02 로 500.
-- 운영은 SKIP_PRISMA_DB_PUSH=1 이라 사람이 직접 적용한다(db push 금지 — 색인이 지워진다):
--   cd apps/api && npx prisma db execute --file prisma/migrations/20261012100000_message_type_voice/migration.sql --schema prisma/schema.prisma
-- 확인: SELECT unnest(enum_range(NULL::"MessageType"));  → voice 가 보이면 끝.
-- ⚠ voice 행이 한 건이라도 생긴 뒤에는 API 를 voice 없는 옛 빌드로 되돌리지 말 것(그 방·채팅 목록 읽기가 enum 오류로 500).

ALTER TYPE "MessageType" ADD VALUE IF NOT EXISTS 'voice';

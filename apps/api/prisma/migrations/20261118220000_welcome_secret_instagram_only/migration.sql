-- 시크릿 미션 응모를 인스타 아이디만으로(261118 사장 '캡처사진 필요없고 그냥 인스타아이디만') — 캡처 칸을 비워 둘 수 있게 + 아이디 색인. 다시 돌려도 안전.
BEGIN;

ALTER TABLE "welcome_secret_entries" ALTER COLUMN "imageUrl" DROP NOT NULL;
ALTER TABLE "welcome_secret_entries" ALTER COLUMN "thumbUrl" DROP NOT NULL;
CREATE INDEX IF NOT EXISTS "welcome_secret_entries_instagramId_idx" ON "welcome_secret_entries"("instagramId");

COMMIT;

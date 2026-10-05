-- 홈 '오늘 방문' 웹·앱 나눠 보기(261005) — 추가만, 여러 번 돌려도 같음
ALTER TABLE "landing_visits" ADD COLUMN IF NOT EXISTS "platform" TEXT;

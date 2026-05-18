DROP TABLE IF EXISTS "scheduled_messages" CASCADE;
DROP TABLE IF EXISTS "pro_schedules" CASCADE;
DROP TABLE IF EXISTS "pudding_rankings" CASCADE;
DROP TABLE IF EXISTS "pudding_transactions" CASCADE;
DROP TABLE IF EXISTS "favorites" CASCADE;
DROP TABLE IF EXISTS "point_transactions" CASCADE;
DROP TABLE IF EXISTS "user_coupons" CASCADE;
DROP TABLE IF EXISTS "coupons" CASCADE;

ALTER TABLE "chat_room_members" DROP COLUMN IF EXISTS "isFavorited";
ALTER TABLE "users" DROP COLUMN IF EXISTS "pointBalance";
ALTER TABLE "pro_profiles" DROP COLUMN IF EXISTS "puddingCount";
ALTER TABLE "pro_profiles" DROP COLUMN IF EXISTS "puddingRank";

DROP TYPE IF EXISTS "PuddingTransactionType";
DROP TYPE IF EXISTS "PuddingReason";
DROP TYPE IF EXISTS "ScheduleStatus";

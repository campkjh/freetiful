CREATE INDEX IF NOT EXISTS "pro_schedules_proProfileId_status_date_idx"
  ON "pro_schedules" ("proProfileId", "status", "date");

CREATE INDEX IF NOT EXISTS "match_deliveries_proProfileId_status_deliveredAt_idx"
  ON "match_deliveries" ("proProfileId", "status", "deliveredAt");

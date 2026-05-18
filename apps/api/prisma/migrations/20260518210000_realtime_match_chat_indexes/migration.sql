CREATE INDEX IF NOT EXISTS "pro_categories_categoryId_proProfileId_idx"
  ON "pro_categories" ("categoryId", "proProfileId");

CREATE INDEX IF NOT EXISTS "match_deliveries_matchRequestId_proProfileId_idx"
  ON "match_deliveries" ("matchRequestId", "proProfileId");

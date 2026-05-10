CREATE INDEX IF NOT EXISTS "payments_userId_createdAt_idx"
  ON "payments" ("userId", "createdAt");

CREATE INDEX IF NOT EXISTS "payments_userId_status_createdAt_idx"
  ON "payments" ("userId", "status", "createdAt");

CREATE INDEX IF NOT EXISTS "payments_proProfileId_status_createdAt_idx"
  ON "payments" ("proProfileId", "status", "createdAt");

CREATE INDEX IF NOT EXISTS "payments_quotationId_idx"
  ON "payments" ("quotationId");

CREATE INDEX IF NOT EXISTS "quotations_userId_chatRoomId_idx"
  ON "quotations" ("userId", "chatRoomId");

CREATE INDEX IF NOT EXISTS "quotations_chatRoomId_userId_idx"
  ON "quotations" ("chatRoomId", "userId");

CREATE INDEX IF NOT EXISTS "quotations_paymentId_createdAt_idx"
  ON "quotations" ("paymentId", "createdAt");

CREATE INDEX IF NOT EXISTS "messages_senderId_createdAt_roomId_idx"
  ON "messages" ("senderId", "createdAt", "roomId");

CREATE INDEX IF NOT EXISTS "match_requests_userId_createdAt_idx"
  ON "match_requests" ("userId", "createdAt");

INSERT INTO "chat_room_members" ("roomId", "userId")
SELECT cr."id", cr."userId"
FROM "chat_rooms" cr
WHERE cr."userId" IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO "chat_room_members" ("roomId", "userId")
SELECT cr."id", pp."userId"
FROM "chat_rooms" cr
JOIN "pro_profiles" pp ON pp."id" = cr."proProfileId"
WHERE pp."userId" IS NOT NULL
ON CONFLICT DO NOTHING;

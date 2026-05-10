CREATE INDEX IF NOT EXISTS "chat_rooms_userId_lastMessageAt_idx"
  ON "chat_rooms" ("userId", "lastMessageAt");

CREATE INDEX IF NOT EXISTS "chat_rooms_proProfileId_lastMessageAt_idx"
  ON "chat_rooms" ("proProfileId", "lastMessageAt");

CREATE INDEX IF NOT EXISTS "chat_rooms_matchRequestId_idx"
  ON "chat_rooms" ("matchRequestId");

CREATE INDEX IF NOT EXISTS "chat_room_members_userId_roomId_idx"
  ON "chat_room_members" ("userId", "roomId");

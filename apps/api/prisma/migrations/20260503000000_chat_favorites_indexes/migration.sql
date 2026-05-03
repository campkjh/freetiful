CREATE INDEX IF NOT EXISTS "chat_rooms_userId_userDeletedAt_lastMessageAt_idx"
  ON "chat_rooms" ("userId", "userDeletedAt", "lastMessageAt");

CREATE INDEX IF NOT EXISTS "chat_rooms_proProfileId_proDeletedAt_lastMessageAt_idx"
  ON "chat_rooms" ("proProfileId", "proDeletedAt", "lastMessageAt");

CREATE INDEX IF NOT EXISTS "chat_rooms_lastMessageAt_idx"
  ON "chat_rooms" ("lastMessageAt");

CREATE INDEX IF NOT EXISTS "chat_room_members_userId_idx"
  ON "chat_room_members" ("userId");

CREATE INDEX IF NOT EXISTS "favorites_targetType_targetId_idx"
  ON "favorites" ("targetType", "targetId");

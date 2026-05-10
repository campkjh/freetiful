CREATE INDEX IF NOT EXISTS "chat_room_members_userId_roomId_idx"
  ON "chat_room_members" ("userId", "roomId");

CREATE INDEX IF NOT EXISTS "messages_senderId_roomId_createdAt_idx"
  ON "messages" ("senderId", "roomId", "createdAt");

CREATE INDEX IF NOT EXISTS "messages_roomId_isDeleted_createdAt_idx"
  ON "messages" ("roomId", "isDeleted", "createdAt");

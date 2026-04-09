-- ═══════════════════════════════════════════════════════════
-- Freetiful Chat Schema (Supabase)
-- ═══════════════════════════════════════════════════════════

-- 프로필 (이미 auth.users와 연동될 수 있음)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  username TEXT UNIQUE,
  avatar_url TEXT,
  role TEXT,  -- 'MC', '사회자', '가수' 등
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 채팅방
CREATE TABLE IF NOT EXISTS chat_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 채팅 참여자
CREATE TABLE IF NOT EXISTS chat_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  is_pinned BOOLEAN DEFAULT false,
  is_archived BOOLEAN DEFAULT false,
  last_read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(room_id, user_id)
);

-- 메시지
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL,  -- 'system'일 수 있으므로 FK 없음
  type TEXT NOT NULL CHECK (type IN ('text', 'image', 'file', 'location', 'system')),
  content TEXT,
  metadata JSONB,
  reply_to_id UUID REFERENCES messages(id) ON DELETE SET NULL,
  is_deleted BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 메시지 리액션
CREATE TABLE IF NOT EXISTS message_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(message_id, user_id, emoji)
);

-- ═══════════════════════════════════════════════════════════
-- Indexes
-- ═══════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_chat_participants_user ON chat_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_participants_room ON chat_participants(room_id);
CREATE INDEX IF NOT EXISTS idx_messages_room_created ON messages(room_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_message_reactions_message ON message_reactions(message_id);

-- ═══════════════════════════════════════════════════════════
-- RLS (Row Level Security)
-- ═══════════════════════════════════════════════════════════

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_reactions ENABLE ROW LEVEL SECURITY;

-- 프로필: 누구나 읽기, 본인만 수정
CREATE POLICY "Profiles are viewable by everyone" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- 채팅방: 참여자만 조회
CREATE POLICY "Participants can view rooms" ON chat_rooms FOR SELECT
  USING (EXISTS (SELECT 1 FROM chat_participants WHERE room_id = id AND user_id = auth.uid()));
CREATE POLICY "Authenticated can create rooms" ON chat_rooms FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- 참여자: 본인 관련만
CREATE POLICY "View own participations" ON chat_participants FOR SELECT
  USING (user_id = auth.uid());
CREATE POLICY "Manage own participations" ON chat_participants FOR ALL
  USING (user_id = auth.uid());
CREATE POLICY "Insert participations" ON chat_participants FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- 메시지: 참여 중인 방만
CREATE POLICY "Participants can view messages" ON messages FOR SELECT
  USING (EXISTS (SELECT 1 FROM chat_participants WHERE room_id = messages.room_id AND user_id = auth.uid()));
CREATE POLICY "Participants can send messages" ON messages FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM chat_participants WHERE room_id = messages.room_id AND user_id = auth.uid()));
CREATE POLICY "Sender can update own messages" ON messages FOR UPDATE
  USING (sender_id = auth.uid()::text);

-- 리액션: 참여자만
CREATE POLICY "Participants can manage reactions" ON message_reactions FOR ALL
  USING (user_id = auth.uid());

-- ═══════════════════════════════════════════════════════════
-- Realtime (Supabase Realtime 활성화)
-- ═══════════════════════════════════════════════════════════

ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE message_reactions;

-- ═══════════════════════════════════════════════════════════
-- Storage Bucket
-- ═══════════════════════════════════════════════════════════
-- Supabase Dashboard에서 'chat-files' 버킷을 생성하고,
-- 아래 정책을 적용하세요:
--
-- INSERT: authenticated users
-- SELECT: authenticated users (same room participants)
-- bucket: chat-files

-- ═══════════════════════════════════════════════════════════
-- Functions
-- ═══════════════════════════════════════════════════════════

-- 1:1 DM 방 찾기
CREATE OR REPLACE FUNCTION find_dm_room(p_user1 UUID, p_user2 UUID)
RETURNS TABLE(id UUID) AS $$
  SELECT cp1.room_id AS id
  FROM chat_participants cp1
  JOIN chat_participants cp2 ON cp1.room_id = cp2.room_id
  WHERE cp1.user_id = p_user1
    AND cp2.user_id = p_user2
  LIMIT 1;
$$ LANGUAGE sql STABLE;

-- 채팅방 목록 (with last message, unread count)
CREATE OR REPLACE FUNCTION get_chat_rooms(p_user_id UUID)
RETURNS TABLE(
  id UUID,
  other_user JSONB,
  last_message TEXT,
  last_message_at TIMESTAMPTZ,
  unread_count BIGINT,
  is_pinned BOOLEAN,
  is_archived BOOLEAN
) AS $$
  SELECT
    cr.id,
    jsonb_build_object(
      'id', p.id,
      'name', p.name,
      'username', p.username,
      'avatar_url', p.avatar_url,
      'role', p.role,
      'is_active', p.is_active
    ) AS other_user,
    latest_msg.content AS last_message,
    latest_msg.created_at AS last_message_at,
    COALESCE(unread.cnt, 0) AS unread_count,
    cp_me.is_pinned,
    cp_me.is_archived
  FROM chat_participants cp_me
  JOIN chat_rooms cr ON cr.id = cp_me.room_id
  JOIN chat_participants cp_other ON cp_other.room_id = cr.id AND cp_other.user_id != p_user_id
  JOIN profiles p ON p.id = cp_other.user_id
  LEFT JOIN LATERAL (
    SELECT content, created_at
    FROM messages
    WHERE room_id = cr.id AND is_deleted = false
    ORDER BY created_at DESC
    LIMIT 1
  ) latest_msg ON true
  LEFT JOIN LATERAL (
    SELECT COUNT(*) AS cnt
    FROM messages
    WHERE room_id = cr.id
      AND is_deleted = false
      AND sender_id != p_user_id::text
      AND created_at > COALESCE(cp_me.last_read_at, '1970-01-01'::timestamptz)
  ) unread ON true
  WHERE cp_me.user_id = p_user_id
  ORDER BY cp_me.is_pinned DESC, latest_msg.created_at DESC NULLS LAST;
$$ LANGUAGE sql STABLE;

-- updated_at 자동 갱신 트리거
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_chat_rooms_updated_at BEFORE UPDATE ON chat_rooms
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_messages_updated_at BEFORE UPDATE ON messages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

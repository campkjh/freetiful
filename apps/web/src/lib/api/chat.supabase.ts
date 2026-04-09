import { supabase } from '../supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

// ─── Types ──────────────────────────────────────────────────

export interface ChatRoom {
  id: string;
  otherUser: {
    id: string;
    name: string;
    username: string;
    avatar_url: string | null;
    role: string | null;
    is_active: boolean;
  };
  lastMessage: string | null;
  lastMessageAt: string | null;
  unreadCount: number;
  isPinned: boolean;
  isArchived: boolean;
}

export interface ChatMessage {
  id: string;
  room_id: string;
  sender_id: string;
  type: 'text' | 'image' | 'file' | 'location' | 'system';
  content: string | null;
  metadata: Record<string, unknown> | null;
  reply_to_id: string | null;
  is_deleted: boolean;
  created_at: string;
  sender: { id: string; name: string; avatar_url: string | null };
  reactions: { emoji: string; user_id: string }[];
}

// ─── Chat Rooms ─────────────────────────────────────────────

/** 내 채팅방 목록 조회 */
export async function getChatRooms(userId: string) {
  const { data, error } = await supabase
    .rpc('get_chat_rooms' as never, { p_user_id: userId } as never);

  if (error) throw error;
  return (data || []) as ChatRoom[];
}

/** 채팅방 생성 (1:1) */
export async function createChatRoom(myId: string, otherUserId: string) {
  // 기존 1:1 방 체크
  const { data: existing } = await supabase
    .rpc('find_dm_room' as never, { p_user1: myId, p_user2: otherUserId } as never);

  const rows = existing as { id: string }[] | null;
  if (rows?.length) return rows[0].id;

  // 새 방 생성
  const { data: room, error: roomErr } = await supabase
    .from('chat_rooms')
    .insert({})
    .select('id')
    .single();
  if (roomErr) throw roomErr;

  await supabase.from('chat_participants').insert([
    { room_id: room.id, user_id: myId, is_pinned: false, is_archived: false },
    { room_id: room.id, user_id: otherUserId, is_pinned: false, is_archived: false },
  ]);

  await sendMessage(room.id, 'system', 'system', '견적 요청으로 대화가 시작되었습니다');
  return room.id;
}

/** 핀 고정 토글 */
export async function togglePin(roomId: string, userId: string, pinned: boolean) {
  await supabase
    .from('chat_participants')
    .update({ is_pinned: pinned })
    .eq('room_id', roomId)
    .eq('user_id', userId);
}

/** 보관 처리 */
export async function archiveRoom(roomId: string, userId: string) {
  await supabase
    .from('chat_participants')
    .update({ is_archived: true })
    .eq('room_id', roomId)
    .eq('user_id', userId);
}

/** 채팅방 삭제 (나만 나감) */
export async function leaveRoom(roomId: string, userId: string) {
  await supabase
    .from('chat_participants')
    .delete()
    .eq('room_id', roomId)
    .eq('user_id', userId);
}

// ─── Messages ───────────────────────────────────────────────

/** 메시지 목록 (최신순 → reverse) */
export async function getMessages(roomId: string, limit = 50, before?: string) {
  let query = supabase
    .from('messages')
    .select(`
      *,
      sender:profiles!messages_sender_id_fkey (id, name, avatar_url),
      reactions:message_reactions (emoji, user_id)
    `)
    .eq('room_id', roomId)
    .eq('is_deleted', false)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (before) query = query.lt('created_at', before);

  const { data, error } = await query;
  if (error) throw error;
  return ((data || []) as unknown as ChatMessage[]).reverse();
}

/** 메시지 전송 */
export async function sendMessage(
  roomId: string,
  senderId: string,
  type: ChatMessage['type'],
  content: string,
  options?: { replyToId?: string; metadata?: Record<string, unknown> }
) {
  const { data, error } = await supabase
    .from('messages')
    .insert({
      room_id: roomId,
      sender_id: senderId,
      type,
      content,
      reply_to_id: options?.replyToId || null,
      metadata: options?.metadata || null,
    })
    .select(`
      *,
      sender:profiles!messages_sender_id_fkey (id, name, avatar_url),
      reactions:message_reactions (emoji, user_id)
    `)
    .single();

  if (error) throw error;
  return data as unknown as ChatMessage;
}

/** 메시지 삭제 (soft delete) */
export async function deleteMessage(messageId: string) {
  await supabase
    .from('messages')
    .update({ is_deleted: true, content: null })
    .eq('id', messageId);
}

// ─── Reactions ──────────────────────────────────────────────

/** 리액션 토글 */
export async function toggleReaction(messageId: string, userId: string, emoji: string) {
  const { data: existing } = await supabase
    .from('message_reactions')
    .select('id')
    .eq('message_id', messageId)
    .eq('user_id', userId)
    .eq('emoji', emoji)
    .maybeSingle();

  if (existing) {
    await supabase.from('message_reactions').delete().eq('id', existing.id);
  } else {
    await supabase.from('message_reactions').insert({ message_id: messageId, user_id: userId, emoji });
  }
}

// ─── Read Status ────────────────────────────────────────────

/** 읽음 처리 */
export async function markAsRead(roomId: string, userId: string) {
  await supabase
    .from('chat_participants')
    .update({ last_read_at: new Date().toISOString() })
    .eq('room_id', roomId)
    .eq('user_id', userId);
}

// ─── File Upload ────────────────────────────────────────────

/** 파일 업로드 → public URL 반환 */
export async function uploadFile(roomId: string, file: File) {
  const ext = file.name.split('.').pop() || 'bin';
  const path = `chat/${roomId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;

  const { error } = await supabase.storage.from('chat-files').upload(path, file);
  if (error) throw error;

  const { data } = supabase.storage.from('chat-files').getPublicUrl(path);
  return data.publicUrl;
}

// ─── Realtime ───────────────────────────────────────────────

/** 채팅방 실시간 메시지 구독 */
export function subscribeToRoom(
  roomId: string,
  callbacks: {
    onNewMessage: (msg: ChatMessage) => void;
    onDeleteMessage?: (msgId: string) => void;
    onReaction?: () => void;
  }
): RealtimeChannel {
  return supabase
    .channel(`room:${roomId}`)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'messages',
      filter: `room_id=eq.${roomId}`,
    }, async (payload) => {
      const { data } = await supabase
        .from('messages')
        .select(`
          *,
          sender:profiles!messages_sender_id_fkey (id, name, avatar_url),
          reactions:message_reactions (emoji, user_id)
        `)
        .eq('id', payload.new.id)
        .single();
      if (data) callbacks.onNewMessage(data as unknown as ChatMessage);
    })
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'messages',
      filter: `room_id=eq.${roomId}`,
    }, (payload) => {
      if (payload.new.is_deleted && callbacks.onDeleteMessage) {
        callbacks.onDeleteMessage(payload.new.id as string);
      }
    })
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'message_reactions',
    }, () => {
      callbacks.onReaction?.();
    })
    .subscribe();
}

/** 채팅 목록 변경 구독 */
export function subscribeToRoomList(userId: string, onUpdate: () => void): RealtimeChannel {
  return supabase
    .channel(`rooms:${userId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, onUpdate)
    .subscribe();
}

/** 구독 해제 */
export function unsubscribe(channel: RealtimeChannel) {
  supabase.removeChannel(channel);
}

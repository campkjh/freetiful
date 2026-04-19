import { chatApi, type ChatRoomItem, type MessageItem } from './api/chat.api';

export interface ChatPreWarmData {
  roomId?: string;
  room?: ChatRoomItem;
  messages?: MessageItem[];
  promise?: Promise<void>;
}

// proId → pre-warmed chat data
export const proToRoomCache = new Map<string, ChatPreWarmData>();
// roomId → pre-warmed data (for direct lookup by the chat page)
export const roomDataCache = new Map<string, ChatPreWarmData>();

export function preWarmChat(proProfileId: string) {
  const existing = proToRoomCache.get(proProfileId);
  if (existing?.roomId || existing?.promise) return existing;

  const data: ChatPreWarmData = {};
  proToRoomCache.set(proProfileId, data);

  data.promise = (async () => {
    try {
      const roomRes = await chatApi.createRoom(proProfileId);
      const roomData = roomRes.data as any;
      const roomId: string | undefined = roomData?.id || roomData?.roomId;
      if (!roomId) return;
      data.roomId = roomId;
      roomDataCache.set(roomId, data);

      // 메시지와 룸 정보를 병렬 프리페치
      const [messagesRes, roomInfoRes] = await Promise.allSettled([
        chatApi.getMessages(roomId, { limit: 50 }),
        chatApi.getRoom(roomId),
      ]);
      if (messagesRes.status === 'fulfilled') {
        data.messages = messagesRes.value.data.data || [];
      }
      if (roomInfoRes.status === 'fulfilled') {
        data.room = roomInfoRes.value.data as ChatRoomItem;
      }
    } catch {
      // 실패해도 무시 (클릭 시 다시 시도)
    }
  })();

  return data;
}

export function getPreWarmByRoomId(roomId: string): ChatPreWarmData | undefined {
  return roomDataCache.get(roomId);
}

export function getPreWarmByProId(proProfileId: string): ChatPreWarmData | undefined {
  return proToRoomCache.get(proProfileId);
}

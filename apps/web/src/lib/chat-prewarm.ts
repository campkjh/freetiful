import { chatApi, type ChatRoomItem, type MessageItem } from './api/chat.api';

export interface ChatPreWarmData {
  roomId?: string;
  room?: ChatRoomItem;
  messages?: MessageItem[];
  messagesPromise?: Promise<MessageItem[]>;
  /** createRoom만 완료되면 resolve (빠름) */
  roomIdPromise?: Promise<string | undefined>;
}

// proId → pre-warmed chat data
export const proToRoomCache = new Map<string, ChatPreWarmData>();
// roomId → pre-warmed data (for direct lookup by the chat page)
export const roomDataCache = new Map<string, ChatPreWarmData>();

export function preWarmChat(proProfileId: string) {
  const existing = proToRoomCache.get(proProfileId);
  if (existing?.roomId || existing?.roomIdPromise) return existing;

  const data: ChatPreWarmData = {};
  proToRoomCache.set(proProfileId, data);

  data.roomIdPromise = (async () => {
    try {
      const roomRes = await chatApi.createRoom(proProfileId);
      const roomData = roomRes.data as any;
      const roomId: string | undefined = roomData?.id || roomData?.roomId;
      if (!roomId) return undefined;
      data.roomId = roomId;
      // createRoom 응답에 room 정보가 포함되어 있으면 즉시 사용
      if (roomData?.otherUser) {
        data.room = roomData as ChatRoomItem;
      }
      roomDataCache.set(roomId, data);

      // getMessages만 백그라운드로 (room 정보는 이미 있음)
      data.messagesPromise = chatApi.getMessages(roomId, { limit: 50 })
        .then((res) => {
          const messages = res.data.data || [];
          data.messages = messages;
          return messages;
        })
        .catch(() => []);

      return roomId;
    } catch {
      return undefined;
    }
  })();

  return data;
}

export function preWarmExistingRoom(room: ChatRoomItem) {
  const existing = roomDataCache.get(room.id);
  if (existing?.messages || existing?.messagesPromise) return existing;

  const data: ChatPreWarmData = existing || { roomId: room.id, room };
  data.roomId = room.id;
  data.room = room;
  roomDataCache.set(room.id, data);

  data.messagesPromise = chatApi.getMessages(room.id, { limit: 50 })
    .then((res) => {
      const messages = res.data.data || [];
      data.messages = messages;
      return messages;
    })
    .catch(() => []);

  return data;
}

export function getPreWarmByRoomId(roomId: string): ChatPreWarmData | undefined {
  return roomDataCache.get(roomId);
}

export function getPreWarmByProId(proProfileId: string): ChatPreWarmData | undefined {
  return proToRoomCache.get(proProfileId);
}

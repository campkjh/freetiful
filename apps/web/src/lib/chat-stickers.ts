export type ChatSticker = {
  id: string;
  src: string;
  alt: string;
};

export const CHAT_STICKERS: ChatSticker[] = Array.from({ length: 12 }, (_, index) => {
  const stickerNumber = index + 1;
  return {
    id: `freeti-${stickerNumber}`,
    src: `/images/chat-stickers/freeti/freeti-${stickerNumber}.png`,
    alt: `프리티 이모티콘 ${stickerNumber}`,
  };
});

export function isChatStickerUrl(value?: string | null) {
  return typeof value === 'string' && value.includes('/images/chat-stickers/');
}

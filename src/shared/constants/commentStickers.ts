export type CommentSticker = {
  id: string;
  emoji: string;
  imageUrl: string;
};

/** Twemoji PNGs used in composer chips; tapping inserts `emoji` into comment text. */
export const COMMENT_STICKERS: readonly CommentSticker[] = [
  {
    id: "thumbs-up",
    emoji: "👍",
    imageUrl: "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f44d.png",
  },
  {
    id: "fire",
    emoji: "🔥",
    imageUrl: "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f525.png",
  },
  {
    id: "heart",
    emoji: "❤️",
    imageUrl: "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/2764.png",
  },
  {
    id: "party",
    emoji: "🎉",
    imageUrl: "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f389.png",
  },
  {
    id: "cool",
    emoji: "😎",
    imageUrl: "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f60e.png",
  },
  {
    id: "rocket",
    emoji: "🚀",
    imageUrl: "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f680.png",
  },
] as const;

export const STICKER_IMAGE_URLS = COMMENT_STICKERS.map((s) => s.imageUrl);

export function isStickerAssetUri(uri: string): boolean {
  const normalized = uri.split("?")[0] ?? uri;
  return STICKER_IMAGE_URLS.some((url) => url === uri || url === normalized);
}

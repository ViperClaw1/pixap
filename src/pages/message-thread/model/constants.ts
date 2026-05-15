export { COMPOSER_HEIGHT, FOOTER_VERTICAL_PADDING } from "@/shared/lib/messageThreadLayout";

export const REACTION_SET = ["👍", "❤️", "🔥"] as const;
export const KEYBOARD_GAP = 0;
export const STICKER_URLS = [
  "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f44d.png",
  "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f525.png",
  "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/2764.png",
  "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f389.png",
  "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f60e.png",
  "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f680.png",
] as const;

export function isStickerAssetUri(uri: string): boolean {
  const normalized = uri.split("?")[0] ?? uri;
  return STICKER_URLS.some((s) => s === uri || s === normalized);
}

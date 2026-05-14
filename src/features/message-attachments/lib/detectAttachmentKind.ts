import type { AttachmentKind } from "../model/types";

const IMAGE_EXT = /\.(jpe?g|png|gif|webp|bmp|heic|avif)(\?|#|$)/i;
const VIDEO_EXT = /\.(mp4|mov|m4v|webm|mkv|avi)(\?|#|$)/i;
const DOCUMENT_EXT = /\.(pdf|docx?|xlsx?|pptx?|zip|rar|7z|txt|csv)(\?|#|$)/i;

const LOCAL_SCHEMES = /^(file|content|ph|assets-library):/i;

export function detectAttachmentKind(uri: string, mimeHint?: string | null): AttachmentKind {
  const m = mimeHint?.trim().toLowerCase();
  if (m?.startsWith("image/")) return "image";
  if (m?.startsWith("video/")) return "video";
  if (m?.startsWith("audio/")) return "file";

  const path = uri.split("?")[0]?.split("#")[0] ?? uri;
  if (IMAGE_EXT.test(path)) return "image";
  if (VIDEO_EXT.test(path)) return "video";
  if (DOCUMENT_EXT.test(path)) return "file";

  if (uri.startsWith("http://") || uri.startsWith("https://")) {
    return "file";
  }

  /** Локальные URI из пикера часто без расширения — по умолчанию пробуем как изображение (превью в чате). */
  if (LOCAL_SCHEMES.test(uri)) {
    return "image";
  }

  return "file";
}

const VIDEO_EXT = /\.(mp4|mov|m4v|webm|mkv|avi)(\?|#|$)/i;

/**
 * Poster objects are uploaded next to chat videos as `{base}-poster.webp`
 * (see `uploadMessageAttachmentToStories`).
 */
export function getMessageVideoPosterPublicUrl(videoPublicUrl: string): string | null {
  const trimmed = videoPublicUrl.trim();
  if (!trimmed) return null;
  const hashIdx = trimmed.indexOf("#");
  const beforeHash = hashIdx >= 0 ? trimmed.slice(0, hashIdx) : trimmed;
  const hash = hashIdx >= 0 ? trimmed.slice(hashIdx) : "";
  const qIdx = beforeHash.indexOf("?");
  const pathPart = qIdx >= 0 ? beforeHash.slice(0, qIdx) : beforeHash;
  const query = qIdx >= 0 ? beforeHash.slice(qIdx) : "";

  if (!VIDEO_EXT.test(pathPart)) return null;
  if (/-poster\.webp$/i.test(pathPart)) return null;

  const posterPath = pathPart.replace(/\.(mp4|mov|m4v|webm|mkv|avi)$/i, "-poster.webp");
  if (posterPath === pathPart) return null;

  return `${posterPath}${query}${hash}`;
}

export function messageVideoPosterStoragePath(videoStoragePath: string, posterExtension = "webp"): string {
  const pathOnly = videoStoragePath.split("?")[0] ?? videoStoragePath;
  return pathOnly.replace(/\.(mp4|mov|m4v|webm|mkv|avi)$/i, `-poster.${posterExtension}`);
}

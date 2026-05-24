import { PixelRatio } from "react-native";
import { resolvePostFeedPregeneratedUrl } from "@/shared/lib/feed/feedMediaPregenStorage";
import { getOptimizedImageUrl, quantizeDecodePx } from "@/shared/lib/imageUtils";
import { getOptimizedImageUrlPreset } from "@/shared/lib/imagePresets";

const THUMB_LAYOUT_PX = 160;
const BLEED_LAYOUT_H_PX = 200;

export type MessageAttachmentImageLayout = "thumb" | "bleed";

function decodeEdgeForLayout(layout: MessageAttachmentImageLayout): number {
  const base = layout === "bleed" ? BLEED_LAYOUT_H_PX : THUMB_LAYOUT_PX;
  return quantizeDecodePx(Math.round(base * PixelRatio.get()));
}

/** Display URI for in-thread image attachments (pregen feed WebP, then render API when enabled). */
export function getMessageAttachmentImageDisplayUri(
  uri: string,
  layout: MessageAttachmentImageLayout = "thumb",
): string {
  const pregen = resolvePostFeedPregeneratedUrl(uri);
  if (pregen) return pregen;
  const edge = decodeEdgeForLayout(layout);
  return getOptimizedImageUrl(uri, edge, edge, 72) || uri;
}

/** Full-screen viewer — pregen feed variant or large preset. */
export function getMessageAttachmentViewerImageUri(uri: string): string {
  const pregen = resolvePostFeedPregeneratedUrl(uri);
  if (pregen) return pregen;
  return getOptimizedImageUrlPreset(uri, "large") || uri;
}

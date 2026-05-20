import { PixelRatio } from "react-native";
import { getOptimizedImageUrl, quantizeDecodePx } from "@/shared/lib/imageUtils";
import { getOptimizedImageUrlPreset } from "@/shared/lib/imagePresets";

const THUMB_LAYOUT_PX = 160;
const BLEED_LAYOUT_H_PX = 200;

export type MessageAttachmentImageLayout = "thumb" | "bleed";

function decodeEdgeForLayout(layout: MessageAttachmentImageLayout): number {
  const base = layout === "bleed" ? BLEED_LAYOUT_H_PX : THUMB_LAYOUT_PX;
  return quantizeDecodePx(Math.round(base * PixelRatio.get()));
}

/** Display URI for in-thread image attachments (Storage CDN / render API when enabled). */
export function getMessageAttachmentImageDisplayUri(
  uri: string,
  layout: MessageAttachmentImageLayout = "thumb",
): string {
  const edge = decodeEdgeForLayout(layout);
  return getOptimizedImageUrl(uri, edge, edge, 72) || uri;
}

/** Full-screen viewer — large preset, not raw upload resolution. */
export function getMessageAttachmentViewerImageUri(uri: string): string {
  return getOptimizedImageUrlPreset(uri, "large") || uri;
}

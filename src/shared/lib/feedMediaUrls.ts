import { PixelRatio } from "react-native";
import {
  resolvePostFeedPregeneratedUrl,
  resolveStoryDisplayPregeneratedUrl,
} from "@/shared/lib/feed/feedMediaPregenStorage";
import { getOptimizedImageUrlPreset, type ImagePresetId } from "@/shared/lib/imagePresets";

/** Cap DPR for feed/storage transforms — stable CDN keys, less egress on 3x devices. */
export function feedMediaDeviceDpr(max = 2): number {
  const dpr = PixelRatio.get();
  return dpr > 0 ? Math.min(max, dpr) : 1;
}

const FEED_CAROUSEL_PRESET: ImagePresetId = "medium";
const FEED_STORY_PRESET: ImagePresetId = "large";

export function getFeedPostCarouselImageUrl(url: string | null | undefined): string {
  if (!url) return "";
  const pregen = resolvePostFeedPregeneratedUrl(url);
  if (pregen) return pregen;
  return getOptimizedImageUrlPreset(url, FEED_CAROUSEL_PRESET, { dpr: feedMediaDeviceDpr() }) || url;
}

export function getFeedPostCarouselImageUrls(urls: Array<string | null | undefined>): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const url of urls) {
    const optimized = getFeedPostCarouselImageUrl(url);
    if (!optimized || seen.has(optimized)) continue;
    seen.add(optimized);
    out.push(optimized);
  }
  return out;
}

export function getFeedStoryFullscreenImageUrl(url: string | null | undefined): string {
  if (!url) return "";
  const pregen = resolveStoryDisplayPregeneratedUrl(url);
  if (pregen) return pregen;
  return getOptimizedImageUrlPreset(url, FEED_STORY_PRESET, { dpr: feedMediaDeviceDpr() }) || url;
}

/** Story strip / card preview — prefers pregen, avoids render when possible. */
export function getFeedStoryPreviewImageUrl(url: string | null | undefined): string {
  if (!url) return "";
  const pregen = resolveStoryDisplayPregeneratedUrl(url) ?? resolvePostFeedPregeneratedUrl(url);
  if (pregen) return pregen;
  return getOptimizedImageUrlPreset(url, FEED_CAROUSEL_PRESET, { dpr: feedMediaDeviceDpr() }) || url;
}

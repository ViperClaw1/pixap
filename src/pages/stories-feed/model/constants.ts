export const DOUBLE_TAP_DELAY_MS = 280;
export const FEED_APP_HEADER_BODY = 52;
export const FEED_STORIES_STRIP_HEIGHT = 100;
export const FEED_TAB_BAR_BASE = 58;
export const FEED_CAROUSEL_VIEWPORT_RATIO = 0.58;
export const FEED_CAROUSEL_MAIN_BLOCK_MAX_RATIO = 0.7;
export const FEED_CAROUSEL_MIN_HEIGHT = 240;
/** Extra height added to the post media carousel / SmartImage block. */
export const FEED_CAROUSEL_HEIGHT_BOOST = 100;
/** Extra layout slack for FlashList row height (carousel + actions). */
export const FEED_POST_LIST_ITEM_EXTRA_HEIGHT = 240;
/** Gap between focused post title input and keyboard top when auto-scrolling feed (iOS). */
export const FEED_TITLE_INPUT_KEYBOARD_GAP = 12;
/** Stories strip: highlight ring for stories posted within this window. */
export const FEED_STORY_FRESH_MS = 60 * 60 * 1000;

export function isStoryFresh(createdAt: string): boolean {
  const createdMs = new Date(createdAt).getTime();
  return Number.isFinite(createdMs) && Date.now() - createdMs < FEED_STORY_FRESH_MS;
}

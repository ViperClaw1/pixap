/** Bundled placeholder for business place thumbnails (legacy / offline). */
export const PLACE_IMAGE_FALLBACK = require("../../../assets/web/placeholder.png");

/** Remote placeholder for business cards — loading + empty state. */
export const BUSINESS_CARD_PLACEHOLDER_URI =
  "https://ylcyktbppowabnxuwdrr.supabase.co/storage/v1/object/public/logo/placeholder.png";

export const businessCardPlaceholderSource = { uri: BUSINESS_CARD_PLACEHOLDER_URI } as const;

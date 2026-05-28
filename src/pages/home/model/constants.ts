export const RECOMMENDED_BATCH_SIZE = 20;
export const RECOMMENDED_ITEM_GAP = 12;
/** Horizontal card: 96 image + 12×2 padding. */
export const RECOMMENDED_HORIZONTAL_CARD_HEIGHT = 120;
/** Item height + gap between cards (FlashList v1 compat / docs). */
export const RECOMMENDED_ITEM_ESTIMATED_SIZE =
  RECOMMENDED_HORIZONTAL_CARD_HEIGHT + RECOMMENDED_ITEM_GAP;
export const CATEGORY_PILL_ESTIMATED_WIDTH = 148;
export const FEATURED_CARD_ESTIMATED_WIDTH = 168;

/** Matches `homePageStyles.pill` vertical padding + icon wrap height. */
export const HOME_CATEGORY_PILL_PADDING_VERTICAL = 10;
export const HOME_CATEGORY_PILL_ICON_SIZE = 24;
export const HOME_CATEGORY_PILL_HEIGHT =
  HOME_CATEGORY_PILL_PADDING_VERTICAL * 2 + HOME_CATEGORY_PILL_ICON_SIZE;

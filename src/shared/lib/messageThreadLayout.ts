/** Shared layout constants for message thread UI (composer / footer). */
export const COMPOSER_HEIGHT = 50;
export const FOOTER_VERTICAL_PADDING = 16;

/** Body height of the fixed thread header (avatar row + bottom padding). */
export const MESSAGE_THREAD_HEADER_BODY_PX = 62;

export function messageThreadHeaderHeight(insetsTop: number): number {
  return Math.max(insetsTop, 10) + MESSAGE_THREAD_HEADER_BODY_PX;
}

/** Shared layout constants for message thread UI (composer / footer). */
export const COMPOSER_HEIGHT = 50;
export const FOOTER_VERTICAL_PADDING = 16;
/** Android adjustResize: trim footer lift so composer is not over-shifted. */
export const MESSAGE_THREAD_ANDROID_KEYBOARD_TRIM_PX = 48;
/** Extra lift above the keyboard for composer + list scroll room. */
export const MESSAGE_THREAD_KEYBOARD_GAP = 32;

/** Body height of the fixed thread header (avatar row + bottom padding). */
export const MESSAGE_THREAD_HEADER_BODY_PX = 62;

export function messageThreadHeaderHeight(insetsTop: number): number {
  return Math.max(insetsTop, 10) + MESSAGE_THREAD_HEADER_BODY_PX;
}

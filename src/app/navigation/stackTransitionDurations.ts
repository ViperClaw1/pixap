/**
 * Native stack slide timings.
 *
 * Android push (`slide_from_right`): длительность задаётся только нативными XML.
 * Значение `ANDROID_STACK_SLIDE_DURATION_MS` читается плагином
 * `plugins/withFasterAndroidStackTransitions.js` при **prebuild** и не подхватывается
 * через Metro reload — после изменения нужны:
 *   npx expo prebuild --platform android
 *   npx expo run:android
 * (или новый EAS build).
 *
 * iOS: `animationDuration` в stackTransitionOptions — только для fade / slide_from_bottom.
 */
export const ANDROID_STACK_SLIDE_DURATION_MS = 100;
export const ANDROID_STACK_SLIDE_DURATION_DEFAULT_MS = 180;

/** iOS modal / fade transitions when `animationDuration` is supported. */
export const IOS_STACK_MODAL_ANIMATION_DURATION_MS = 220;

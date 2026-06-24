import { InteractionManager } from "react-native";

let prefetched = false;

/** Warm bookings bundle before navigation (Android-first). */
export function ensureBookingsScreensReady(): void {
  if (prefetched) return;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require("@/pages/bookings");
  prefetched = true;
}

export function scheduleBookingsScreensPrefetch(): () => void {
  if (prefetched) return () => undefined;
  const task = InteractionManager.runAfterInteractions(() => {
    ensureBookingsScreensReady();
  });
  return () => task.cancel();
}

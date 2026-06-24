import { InteractionManager } from "react-native";

let prefetched = false;

/** Warm auth bundle before navigation (Android-first). */
export function ensureAuthScreenReady(): void {
  if (prefetched) return;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require("@/pages/auth");
  prefetched = true;
}

export function scheduleAuthScreenPrefetch(): () => void {
  if (prefetched) return () => undefined;
  const task = InteractionManager.runAfterInteractions(() => {
    ensureAuthScreenReady();
  });
  return () => task.cancel();
}

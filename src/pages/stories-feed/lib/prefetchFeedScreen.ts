import { InteractionManager } from "react-native";

let prefetched = false;

/** Warm stories-feed bundle before navigation (Android-first). */
export function ensureFeedScreensReady(): void {
  if (prefetched) return;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require("@/pages/stories-feed");
  prefetched = true;
}

export function scheduleFeedScreensPrefetch(): () => void {
  if (prefetched) return () => undefined;
  const task = InteractionManager.runAfterInteractions(() => {
    ensureFeedScreensReady();
  });
  return () => task.cancel();
}

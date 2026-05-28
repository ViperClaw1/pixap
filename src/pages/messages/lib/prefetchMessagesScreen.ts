import { InteractionManager } from "react-native";

let prefetched = false;

/** Warm Messages + MessageThread bundles before navigation (Android-first). */
export function ensureMessagesScreensReady(): void {
  if (prefetched) return;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require("@/pages/messages");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require("@/pages/message-thread");
  prefetched = true;
}

export function scheduleMessagesScreensPrefetch(): () => void {
  if (prefetched) return () => undefined;
  const task = InteractionManager.runAfterInteractions(() => {
    ensureMessagesScreensReady();
  });
  return () => task.cancel();
}

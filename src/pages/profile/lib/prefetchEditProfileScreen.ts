import { InteractionManager } from "react-native";
import { warmPhoneInputCache } from "@/shared/ui/phone-input/lib";

let prefetched = false;

/** Loads Edit Profile bundle + phone country cache before navigation (Android-first). */
export function ensureEditProfileScreenReady(): void {
  if (prefetched) return;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require("@/pages/edit-profile");
  warmPhoneInputCache();
  prefetched = true;
}

/** Warm Edit Profile in the background while Profile tab is visible. */
export function scheduleEditProfilePrefetch(): () => void {
  if (prefetched) return () => undefined;
  const task = InteractionManager.runAfterInteractions(() => {
    ensureEditProfileScreenReady();
  });
  return () => task.cancel();
}

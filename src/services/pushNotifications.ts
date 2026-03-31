import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { supabase } from "@/integrations/supabase/client";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

/**
 * Persists native FCM/APNs device token for server-side FCM HTTP v1 sends.
 * Requires a development build with push credentials (not all Expo Go setups).
 */
export async function registerNativePushToken(userId: string): Promise<void> {
  const { status } = await Notifications.getPermissionsAsync();
  if (status !== "granted") return;

  const device = await Notifications.getDevicePushTokenAsync();
  const platform = Platform.OS === "ios" ? "ios" : "android";

  const { error } = await supabase.from("user_push_tokens").upsert(
    {
      user_id: userId,
      token: device.data,
      platform,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,token" },
  );

  if (error) {
    console.warn("[push] Failed to save token", error.message);
  }
}

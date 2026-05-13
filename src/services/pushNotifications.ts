import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { supabase } from "@/shared/api/supabase/client";

let notificationHandlerInstalled = false;

/** Call once after first frame / interactions — avoids top-level side effect at import time. */
export function ensurePushNotificationHandler(): void {
  if (notificationHandlerInstalled) return;
  notificationHandlerInstalled = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

function resolveExpoProjectId(): string | undefined {
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined;
  return extra?.eas?.projectId ?? Constants.easConfig?.projectId;
}

/**
 * Persists native FCM/APNs token plus Expo push token (ExponentPushToken[...]) for server-side sends
 * via `consume-push-outbox` Edge Function + Expo Push API.
 */
export async function registerNativePushToken(userId: string): Promise<void> {
  const { status } = await Notifications.getPermissionsAsync();
  if (status !== "granted") return;

  const device = await Notifications.getDevicePushTokenAsync();
  const platform = Platform.OS === "ios" ? "ios" : "android";

  let expoPushToken: string | null = null;
  const projectId = resolveExpoProjectId();
  if (projectId) {
    try {
      const expo = await Notifications.getExpoPushTokenAsync({ projectId });
      expoPushToken = expo.data;
      if (__DEV__) {
        console.log("[push] Expo token (send-test-push / outbox delivery):", expoPushToken);
      }
    } catch (e) {
      if (__DEV__) {
        console.warn("[push] getExpoPushTokenAsync failed", e instanceof Error ? e.message : e);
      }
    }
  }

  const { error } = await supabase.from("user_push_tokens").upsert(
    {
      user_id: userId,
      token: device.data,
      platform,
      expo_push_token: expoPushToken,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,token" },
  );

  if (error) {
    console.warn("[push] Failed to save token", error.message);
  }
}

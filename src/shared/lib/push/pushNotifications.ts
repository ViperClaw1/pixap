import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { supabase } from "@/shared/api/supabase/client";
import { devLog, devWarn } from "@/shared/lib/devLog";

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

async function resolveNotificationPermission(): Promise<Notifications.PermissionStatus> {
  const current = await Notifications.getPermissionsAsync();
  if (current.status === "granted" || current.status === "denied") {
    return current.status;
  }
  const requested = await Notifications.requestPermissionsAsync();
  return requested.status;
}

/**
 * Persists native FCM/APNs token plus Expo push token (ExponentPushToken[...]) for server-side sends
 * via `consume-push-outbox` Edge Function + Expo Push API.
 */
export async function registerNativePushToken(userId: string): Promise<void> {
  const status = await resolveNotificationPermission();
  if (status !== "granted") {
    devWarn("[push] Notifications permission not granted:", status);
    return;
  }

  const device = await Notifications.getDevicePushTokenAsync();
  const platform = Platform.OS === "ios" ? "ios" : "android";

  let expoPushToken: string | null = null;
  const projectId = resolveExpoProjectId();
  if (!projectId) {
    devWarn("[push] EAS projectId missing — set EXPO_PUBLIC_EAS_PROJECT_ID in .env");
  } else {
    try {
      const expo = await Notifications.getExpoPushTokenAsync({ projectId });
      expoPushToken = expo.data;
      devLog("[push] Expo token:", expoPushToken);
    } catch (e) {
      devWarn("[push] getExpoPushTokenAsync failed", e instanceof Error ? e.message : e);
    }
  }

  if (!expoPushToken) {
    devWarn("[push] No ExponentPushToken — server push delivery will not reach this device");
    return;
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
    devWarn("[push] Failed to save token", error.message);
  }
}

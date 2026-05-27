import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { supabase } from "@/shared/api/supabase/client";
import { devLog, devWarn } from "@/shared/lib/devLog";
import {
  formatFunctionsError,
  invokeSupabaseFunctionWithAuth,
} from "@/shared/lib/invokeSupabaseFunction";
import { handlePushNotificationOpen } from "@/shared/lib/push/handlePushNotificationOpen";

let notificationHandlerInstalled = false;
let consumeInFlight: Promise<void> | null = null;
let lastConsumeAt = 0;
let notificationOpenHandler: ((data: Record<string, unknown>) => void) | null = null;

const CONSUME_DEBOUNCE_MS = 4_000;

/** Call once after first frame / interactions — avoids top-level side effect at import time. */
export function ensurePushNotificationHandler(): void {
  if (notificationHandlerInstalled) return;
  notificationHandlerInstalled = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
  Notifications.addNotificationResponseReceivedListener((response) => {
    const data = (response.notification.request.content.data ?? {}) as Record<string, unknown>;
    notificationOpenHandler?.(data);
  });
}

/** Handles notification tap when the app was cold-started from a push. */
export async function consumeInitialPushNotificationResponse(): Promise<void> {
  const response = await Notifications.getLastNotificationResponseAsync();
  if (!response) return;
  const data = (response.notification.request.content.data ?? {}) as Record<string, unknown>;
  handlePushNotificationOpen(data);
}

export function setPushNotificationOpenHandler(handler: ((data: Record<string, unknown>) => void) | null): void {
  notificationOpenHandler = handler;
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
 * Delivers pending rows from `push_outbox` for the signed-in user via Edge Function.
 * Does not require Vault/pg_cron — uses the user's session JWT.
 */
export async function consumePendingPushOutbox(): Promise<void> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) {
    devWarn("[push] consume-push-outbox skipped: no session");
    return;
  }

  const now = Date.now();
  if (consumeInFlight && now - lastConsumeAt < CONSUME_DEBOUNCE_MS) {
    return consumeInFlight;
  }
  lastConsumeAt = now;

  consumeInFlight = (async () => {
    const { data, error } = await invokeSupabaseFunctionWithAuth<{
      ok?: boolean;
      processed_rows?: number;
      expo_messages?: number;
      error?: string;
    }>("consume-push-outbox", { limit: 50 });

    if (error) {
      devWarn("[push] consume-push-outbox failed:", await formatFunctionsError(error));
      return;
    }
    if (data?.expo_messages && data.expo_messages > 0) {
      devLog("[push] delivered", data.expo_messages, "notification(s)");
    } else {
      devLog("[push] consume ok, pending:", data?.processed_rows ?? 0);
    }
  })().finally(() => {
    consumeInFlight = null;
  });

  return consumeInFlight;
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

  const { error } = await supabase.rpc("claim_expo_push_token", {
    p_device_token: device.data,
    p_platform: platform,
    p_expo_push_token: expoPushToken,
  });

  if (error) {
    devWarn("[push] Failed to claim push token", error.message);
    return;
  }

  await consumePendingPushOutbox();
}

import { useEffect, useLayoutEffect, useState, useCallback, useRef, useMemo } from "react";
import { ActivityIndicator, InteractionManager, Text, View } from "react-native";
import { NavigationContainer, DarkTheme, DefaultTheme } from "@react-navigation/native";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import Toast from "react-native-toast-message";
import { useAppTheme } from "@/app/providers/ThemeProvider";
import { useAuth } from "@/app/providers/AuthProvider";
import { AppProviders } from "@/app";
import AppNavigator from "@/app/navigation/AppNavigator";
import { linking } from "@/app/navigation/linking";
import { rootNavigationRef } from "@/app/navigation/rootNavigationRef";
import { bootstrapI18n, hydrateI18nFromStorage } from "@/shared/lib/i18n";
import { loadPersistedThemeMode } from "@/app/providers/themeStorage";
import type { ThemeMode } from "@/app/providers/ThemeProvider";
import { subscribeSupabaseAuthDeepLinks } from "@/app/navigation/subscribeSupabaseAuthDeepLinks";
import { hasSeenPermissionsIntro, setSeenPermissionsIntro } from "@/shared/lib/permissionsStorage";
import { hasLaunchedAppBefore } from "@/shared/lib/appLaunchStorage";
import { supabaseConfigError } from "@/shared/api/supabase/client";
import { logStartupDiagnostics } from "@/shared/lib/startupDiagnostics";
import { useAppToastConfig } from "@/shared/ui/app-toast/createAppToastConfig";
import { AppPopupHost } from "@/shared/ui/app-popup";
import {
  consumeInitialPushNotificationResponse,
  ensurePushNotificationHandler,
  setPushNotificationOpenHandler,
} from "@/shared/lib/push/pushNotifications";
import { handlePushNotificationOpen } from "@/shared/lib/push/handlePushNotificationOpen";
import { markStartup, resetStartupTiming } from "@/shared/lib/startupDevTiming";
import { ensureMessagesScreensReady } from "@/pages/messages/lib/prefetchMessagesScreen";

SplashScreen.preventAutoHideAsync().catch(() => undefined);

function BootErrorScreen({ message }: { message: string }) {
  useLayoutEffect(() => {
    void SplashScreen.hide();
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: "#111", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <Text style={{ color: "#fff", fontSize: 20, fontWeight: "700", marginBottom: 8 }}>Configuration error</Text>
      <Text style={{ color: "#ddd", textAlign: "center" }}>{message}</Text>
    </View>
  );
}

function PermissionsOnboardingLazy({ onComplete }: { onComplete: () => void }) {
  const Screen = useMemo(() => require("@/pages/permissions-onboarding").default, []);

  useLayoutEffect(() => {
    void SplashScreen.hide();
  }, []);

  return <Screen onComplete={onComplete} />;
}

if (__DEV__) {
  resetStartupTiming();
}

function NavigationRoot({
  onFirstFrame,
  isFirstAppLaunch,
}: {
  onFirstFrame: () => void;
  isFirstAppLaunch: boolean;
}) {
  const { colors, isDark } = useAppTheme();
  const { authHydrated } = useAuth();
  const toastConfig = useAppToastConfig(colors);

  useEffect(() => {
    if (!authHydrated) return;
    let unsubscribe: (() => void) | undefined;
    const task = InteractionManager.runAfterInteractions(() => {
      unsubscribe = subscribeSupabaseAuthDeepLinks(rootNavigationRef);
    });
    return () => {
      task.cancel();
      unsubscribe?.();
    };
  }, [authHydrated]);

  useEffect(() => {
    if (!authHydrated) return;
    setPushNotificationOpenHandler(handlePushNotificationOpen);
    return () => setPushNotificationOpenHandler(null);
  }, [authHydrated]);

  const navigationTheme = useMemo(() => {
    const base = isDark ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        primary: colors.primary,
        background: colors.background,
        card: colors.card,
        text: colors.text,
        border: colors.border,
        notification: colors.notification,
      },
    };
  }, [isDark, colors.primary, colors.background, colors.card, colors.text, colors.border, colors.notification]);

  if (!authHydrated) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <>
      <NavigationContainer
        ref={rootNavigationRef}
        linking={linking}
        theme={navigationTheme}
        onReady={() => {
          onFirstFrame();
          markStartup("navigation_container_ready");
          void consumeInitialPushNotificationResponse();
        }}
      >
        <AppNavigator isFirstAppLaunch={isFirstAppLaunch} />
        <StatusBar style={isDark ? "light" : "dark"} />
        <Toast config={toastConfig} />
      </NavigationContainer>
      <AppPopupHost />
    </>
  );
}

export default function App() {
  const [ready, setReady] = useState(false);
  const [initialThemeMode, setInitialThemeMode] = useState<ThemeMode>("system");
  const [isFirstAppLaunch, setIsFirstAppLaunch] = useState(false);
  const [showPerms, setShowPerms] = useState(false);
  const [bootError, setBootError] = useState<string | null>(null);
  const deferredRef = useRef<ReturnType<typeof InteractionManager.runAfterInteractions> | null>(null);

  useEffect(() => {
    let cancelled = false;
    deferredRef.current = null;

    void (async () => {
      try {
        markStartup("boot_effect_start");
        const [, seen, themeMode, launchedBefore] = await Promise.all([
          bootstrapI18n(),
          hasSeenPermissionsIntro(),
          loadPersistedThemeMode(),
          hasLaunchedAppBefore(),
        ]);
        markStartup("i18n_bootstrap_done");
        if (!cancelled) {
          setInitialThemeMode(themeMode);
          setIsFirstAppLaunch(!launchedBefore);
          setReady(true);
          setShowPerms(!seen);
        }
        if (cancelled) return;
        deferredRef.current = InteractionManager.runAfterInteractions(() => {
          logStartupDiagnostics();
          ensurePushNotificationHandler();
          ensureMessagesScreensReady();
          markStartup("deferred_tasks_start");
          void hydrateI18nFromStorage().then(() => {
            markStartup("i18n_storage_hydrated");
          });
        });
      } catch (error) {
        if (!cancelled) {
          setBootError(error instanceof Error ? error.message : "Startup failed");
          setReady(true);
        }
      }
    })();

    return () => {
      cancelled = true;
      deferredRef.current?.cancel();
      deferredRef.current = null;
    };
  }, []);

  const onPermsDone = useCallback(async () => {
    await setSeenPermissionsIntro();
    setShowPerms(false);
  }, []);

  const hideSplashOnFirstFrame = useCallback(() => {
    void SplashScreen.hide();
    markStartup("splash_hidden");
  }, []);

  if (!ready) return null;

  return (
    <AppProviders initialThemeMode={initialThemeMode}>
      {bootError || supabaseConfigError ? (
        <BootErrorScreen message={bootError ?? supabaseConfigError ?? "Startup failed"} />
      ) : showPerms ? (
        <PermissionsOnboardingLazy onComplete={() => void onPermsDone()} />
      ) : (
        <NavigationRoot onFirstFrame={hideSplashOnFirstFrame} isFirstAppLaunch={isFirstAppLaunch} />
      )}
    </AppProviders>
  );
}

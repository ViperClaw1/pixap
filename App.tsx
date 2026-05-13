import { useEffect, useState, useCallback, useRef } from "react";
import { InteractionManager, Text, View } from "react-native";
import { NavigationContainer, DarkTheme, DefaultTheme } from "@react-navigation/native";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import Toast from "react-native-toast-message";
import { useAppTheme } from "@/contexts/ThemeContext";
import { AppProviders } from "@/app";
import AppNavigator from "@/navigation/AppNavigator";
import { linking } from "@/navigation/linking";
import { rootNavigationRef } from "@/navigation/rootNavigationRef";
import { bootstrapI18n, hydrateI18nFromStorage } from "@/shared/lib/i18n";
import { subscribeSupabaseAuthDeepLinks } from "@/shared/lib/subscribeSupabaseAuthDeepLinks";
import PermissionsOnboardingScreen from "@/pages/permissions-onboarding";
import { hasSeenPermissionsIntro, setSeenPermissionsIntro } from "@/shared/lib/permissionsStorage";
import { supabaseConfigError } from "@/shared/api/supabase/client";
import { logStartupDiagnostics } from "@/shared/lib/startupDiagnostics";
import { useAppToastConfig } from "@/shared/ui/app-toast/createAppToastConfig";
import { ensurePushNotificationHandler } from "@/services/pushNotifications";
import { markStartup, resetStartupTiming } from "@/shared/lib/startupDevTiming";

SplashScreen.preventAutoHideAsync().catch(() => undefined);

if (__DEV__) {
  resetStartupTiming();
}

function NavigationRoot() {
  const { colors, isDark } = useAppTheme();
  const toastConfig = useAppToastConfig(colors);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    const task = InteractionManager.runAfterInteractions(() => {
      unsubscribe = subscribeSupabaseAuthDeepLinks(rootNavigationRef);
    });
    return () => {
      task.cancel();
      unsubscribe?.();
    };
  }, []);

  const base = isDark ? DarkTheme : DefaultTheme;
  const navigationTheme = {
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

  return (
    <NavigationContainer
      ref={rootNavigationRef}
      linking={linking}
      theme={navigationTheme}
      onReady={() => {
        markStartup("navigation_container_ready");
      }}
    >
      <AppNavigator />
      <StatusBar style={isDark ? "light" : "dark"} />
      <Toast config={toastConfig} />
    </NavigationContainer>
  );
}

export default function App() {
  const [ready, setReady] = useState(false);
  const [showPerms, setShowPerms] = useState(false);
  const [bootError, setBootError] = useState<string | null>(null);
  const deferredRef = useRef<ReturnType<typeof InteractionManager.runAfterInteractions> | null>(null);

  useEffect(() => {
    let cancelled = false;
    deferredRef.current = null;

    void (async () => {
      try {
        markStartup("boot_effect_start");
        const permsPromise = hasSeenPermissionsIntro();
        await bootstrapI18n();
        markStartup("i18n_bootstrap_done");
        if (!cancelled) {
          setReady(true);
          SplashScreen.hide();
          markStartup("splash_hidden");
        }
        const seen = await permsPromise;
        if (!cancelled) {
          setShowPerms(!seen);
        }
        if (cancelled) return;
        deferredRef.current = InteractionManager.runAfterInteractions(() => {
          logStartupDiagnostics();
          ensurePushNotificationHandler();
          markStartup("deferred_tasks_start");
          void hydrateI18nFromStorage().then(() => {
            markStartup("i18n_storage_hydrated");
          });
        });
      } catch (error) {
        if (!cancelled) {
          setBootError(error instanceof Error ? error.message : "Startup failed");
          setReady(true);
          SplashScreen.hide();
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

  return (
    <AppProviders>
      {!ready ? null : bootError || supabaseConfigError ? (
        <View style={{ flex: 1, backgroundColor: "#111", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <Text style={{ color: "#fff", fontSize: 20, fontWeight: "700", marginBottom: 8 }}>Configuration error</Text>
          <Text style={{ color: "#ddd", textAlign: "center" }}>{bootError ?? supabaseConfigError}</Text>
        </View>
      ) : showPerms ? (
        <PermissionsOnboardingScreen onComplete={() => void onPermsDone()} />
      ) : (
        <NavigationRoot />
      )}
    </AppProviders>
  );
}

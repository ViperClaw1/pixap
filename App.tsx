import { useEffect, useState, useCallback } from "react";
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
import { initI18n } from "@/shared/lib/i18n";
import { subscribeSupabaseAuthDeepLinks } from "@/shared/lib/subscribeSupabaseAuthDeepLinks";
import PermissionsOnboardingScreen from "@/pages/permissions-onboarding";
import { hasSeenPermissionsIntro, setSeenPermissionsIntro } from "@/shared/lib/permissionsStorage";
import { supabaseConfigError } from "@/shared/api/supabase/client";
import { logStartupDiagnostics } from "@/shared/lib/startupDiagnostics";
import { useAppToastConfig } from "@/shared/ui/app-toast/createAppToastConfig";

SplashScreen.preventAutoHideAsync().catch(() => undefined);

function NavigationRoot() {
  const { colors, isDark } = useAppTheme();
  const toastConfig = useAppToastConfig(colors);

  useEffect(() => {
    return subscribeSupabaseAuthDeepLinks(rootNavigationRef);
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
    <NavigationContainer ref={rootNavigationRef} linking={linking} theme={navigationTheme}>
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

  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      logStartupDiagnostics();
    });
    return () => {
      task.cancel();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const i18nPromise = initI18n();
        const permsPromise = hasSeenPermissionsIntro();
        await i18nPromise;
        if (!cancelled) {
          setReady(true);
          SplashScreen.hide();
        }
        const seen = await permsPromise;
        if (!cancelled) {
          setShowPerms(!seen);
        }
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

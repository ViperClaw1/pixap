import { useEffect, useState, useCallback } from "react";
import { Text, View } from "react-native";
import { NavigationContainer, DarkTheme, DefaultTheme } from "@react-navigation/native";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import Toast from "react-native-toast-message";
import { useAppTheme } from "@/contexts/ThemeContext";
import { AppProviders } from "@/app";
import AppNavigator from "@/navigation/AppNavigator";
import { linking } from "@/navigation/linking";
import PermissionsOnboardingScreen from "@/pages/permissions-onboarding";
import { hasSeenPermissionsIntro, setSeenPermissionsIntro } from "@/shared/lib/permissionsStorage";
import { supabaseConfigError } from "@/shared/api/supabase/client";
import { logStartupDiagnostics } from "@/shared/lib/startupDiagnostics";

SplashScreen.preventAutoHideAsync().catch(() => undefined);

function NavigationRoot() {
  const { colors, isDark } = useAppTheme();

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

  const toastConfig = {
    success: (props: any) => (
      <View
        style={{
          width: "auto",
          alignSelf: "stretch",
          marginHorizontal: 14,
          borderRadius: 12,
          paddingHorizontal: 16,
          paddingVertical: 14,
          backgroundColor: colors.card,
          borderWidth: 1,
          borderColor: "#ec6544",
        }}
      >
        {props.text1 ? <Text style={{ color: colors.text, fontSize: 14, fontWeight: "700" }}>{props.text1}</Text> : null}
        {props.text2 ? <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 2 }}>{props.text2}</Text> : null}
      </View>
    ),
    error: (props: any) => (
      <View
        style={{
          width: "auto",
          alignSelf: "stretch",
          marginHorizontal: 14,
          borderRadius: 12,
          paddingHorizontal: 16,
          paddingVertical: 14,
          backgroundColor: colors.card,
          borderWidth: 1,
          borderColor: "#ec6544",
        }}
      >
        {props.text1 ? <Text style={{ color: colors.danger, fontSize: 14, fontWeight: "700" }}>{props.text1}</Text> : null}
        {props.text2 ? <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 2 }}>{props.text2}</Text> : null}
      </View>
    ),
  };

  return (
    <NavigationContainer linking={linking} theme={navigationTheme}>
      <AppNavigator />
      <StatusBar style={isDark ? "light" : "dark"} />
      <Toast config={toastConfig as any} />
    </NavigationContainer>
  );
}

export default function App() {
  const [ready, setReady] = useState(false);
  const [showPerms, setShowPerms] = useState(false);
  const [bootError, setBootError] = useState<string | null>(null);

  useEffect(() => {
    logStartupDiagnostics();
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const seen = await hasSeenPermissionsIntro();
        setShowPerms(!seen);
      } catch (error) {
        setBootError(error instanceof Error ? error.message : "Startup failed");
      } finally {
        setReady(true);
        await SplashScreen.hideAsync().catch(() => undefined);
      }
    })();
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

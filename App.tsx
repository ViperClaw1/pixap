import { useEffect, useState, useCallback } from "react";
import { Text, View } from "react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NavigationContainer, DarkTheme, DefaultTheme } from "@react-navigation/native";
import * as SplashScreen from "expo-splash-screen";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider, useAppTheme } from "@/contexts/ThemeContext";
import AppNavigator from "@/navigation/AppNavigator";
import { linking } from "@/navigation/linking";
import PermissionsOnboardingScreen from "@/screens/PermissionsOnboardingScreen";
import { hasSeenPermissionsIntro, setSeenPermissionsIntro } from "@/lib/permissionsStorage";
import { supabaseConfigError } from "@/integrations/supabase/client";
import { logStartupDiagnostics } from "@/lib/startupDiagnostics";

SplashScreen.preventAutoHideAsync().catch(() => undefined);

const queryClient = new QueryClient();

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

  return (
    <NavigationContainer linking={linking} theme={navigationTheme}>
      <AppNavigator />
      <StatusBar style={isDark ? "light" : "dark"} />
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
    <SafeAreaProvider>
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            {!ready ? null : bootError || supabaseConfigError ? (
              <View style={{ flex: 1, backgroundColor: "#111", alignItems: "center", justifyContent: "center", padding: 20 }}>
                <Text style={{ color: "#fff", fontSize: 20, fontWeight: "700", marginBottom: 8 }}>Configuration error</Text>
                <Text style={{ color: "#ddd", textAlign: "center" }}>
                  {bootError ?? supabaseConfigError}
                </Text>
              </View>
            ) : showPerms ? (
              <PermissionsOnboardingScreen onComplete={() => void onPermsDone()} />
            ) : (
              <NavigationRoot />
            )}
          </AuthProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

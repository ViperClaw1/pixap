import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nextProvider } from "react-i18next";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { AuthProvider } from "@/app/providers/AuthProvider";
import { RealtimeLifecycleProvider } from "@/app/providers/RealtimeLifecycleProvider";
import { UserPresenceProvider } from "@/entities/user-presence";
import { ThemeProvider } from "@/app/providers/ThemeProvider";
import { StorageEgressMetricsDev } from "@/app/providers/StorageEgressMetricsDev";
import { RealtimeMetricsDev } from "@/app/providers/RealtimeMetricsDev";
import { AppErrorBoundary } from "@/shared/ui/error-boundary";
import { AppPopupProvider } from "@/shared/ui/app-popup";
import { TermsAcceptanceGate } from "@/features/terms-acceptance";
import { i18n } from "@/shared/lib/i18n";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      /** Короче глобальный gc: меньше «висячих» данных неактивных экранов в памяти. */
      gcTime: 10 * 60 * 1000,
      refetchOnWindowFocus: false,
      /** Social feeds rely on realtime + pull-to-refresh; reconnect refetch is expensive on mobile radio. */
      refetchOnReconnect: false,
      retry: 1,
    },
  },
});

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <I18nextProvider i18n={i18n}>
            <QueryClientProvider client={queryClient}>
              <AuthProvider>
                <RealtimeLifecycleProvider>
                <UserPresenceProvider>
                  <AppPopupProvider>
                    <StorageEgressMetricsDev />
                    <RealtimeMetricsDev />
                    <AppErrorBoundary>
                      {children}
                      <TermsAcceptanceGate />
                    </AppErrorBoundary>
                  </AppPopupProvider>
                </UserPresenceProvider>
                </RealtimeLifecycleProvider>
              </AuthProvider>
            </QueryClientProvider>
          </I18nextProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

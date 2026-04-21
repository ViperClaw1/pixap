import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";
import { env } from "../../lib/env";

type SupabaseRuntimeConfig = {
  url: string;
  anonKey: string;
  error: string | null;
};

function resolveSupabaseRuntimeConfig(): SupabaseRuntimeConfig {
  try {
    return {
      url: env.supabaseUrl,
      anonKey: env.supabaseAnonKey,
      error: null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Supabase config is missing.";
    // Keep the app process alive in release builds and show a visible configuration error in UI.
    return {
      url: "https://invalid.supabase.co",
      anonKey: "invalid-anon-key",
      error: message,
    };
  }
}

const runtimeConfig = resolveSupabaseRuntimeConfig();

export const supabaseConfigError = runtimeConfig.error;

export const supabase = createClient<Database>(runtimeConfig.url, runtimeConfig.anonKey, {
  auth: {
    storage: AsyncStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});

if (__DEV__) {
  try {
    const host = new URL(runtimeConfig.url).hostname;
    console.info("[supabase] native client:", host);
  } catch {
    console.warn("[supabase] native client: invalid EXPO_PUBLIC_SUPABASE_URL");
  }
  if (runtimeConfig.error) {
    console.warn("[supabase] config error:", runtimeConfig.error);
  }
}

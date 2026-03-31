import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";
import { env } from "../../lib/env";

export const supabase = createClient<Database>(env.supabaseUrl, env.supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});

if (__DEV__) {
  try {
    const host = new URL(env.supabaseUrl).hostname;
    console.info("[supabase] native client:", host);
  } catch {
    console.warn("[supabase] native client: invalid EXPO_PUBLIC_SUPABASE_URL");
  }
}

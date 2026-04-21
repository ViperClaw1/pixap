import Constants from "expo-constants";
import { env } from "@/lib/env";
import { supabaseConfigError } from "@/integrations/supabase/client";

type Extra = {
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  googleMapsApiKey?: string;
  oauthRedirectBase?: string;
};

function getExtra(): Extra {
  return (
    (Constants.expoConfig?.extra as Extra | undefined) ??
    ((Constants.manifest2 as { extra?: Extra } | null | undefined)?.extra ?? undefined) ??
    ((Constants.manifest as { extra?: Extra } | null | undefined)?.extra ?? undefined) ??
    {}
  );
}

function toHost(urlLike: string | undefined): string | null {
  if (!urlLike) return null;
  try {
    return new URL(urlLike).host;
  } catch {
    return null;
  }
}

export function logStartupDiagnostics(): void {
  const extra = getExtra();
  const diagnostics = {
    ownership: Constants.appOwnership ?? "unknown",
    executionEnvironment: String(Constants.executionEnvironment ?? "unknown"),
    releaseChannel: Constants.expoConfig?.releaseChannel ?? "default",
    extraAvailable: Object.keys(extra).length > 0,
    supabase: {
      hasUrl: Boolean(extra.supabaseUrl || process.env.EXPO_PUBLIC_SUPABASE_URL),
      hasAnonKey: Boolean(extra.supabaseAnonKey || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY),
      host: toHost(extra.supabaseUrl ?? process.env.EXPO_PUBLIC_SUPABASE_URL) ?? "invalid-or-missing",
      configError: supabaseConfigError ?? null,
    },
    maps: {
      hasApiKey: Boolean(extra.googleMapsApiKey || process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY),
    },
    oauth: {
      baseHost:
        toHost(extra.oauthRedirectBase ?? process.env.EXPO_PUBLIC_OAUTH_REDIRECT_BASE ?? "https://pixapp.kz") ??
        "invalid-or-missing",
    },
  };

  // Never log secrets; only booleans/hostnames and safe metadata.
  console.log("[startup]", JSON.stringify(diagnostics));
}

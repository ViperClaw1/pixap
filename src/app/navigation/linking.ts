import type { LinkingOptions } from "@react-navigation/native";
import { getStateFromPath as getStateFromPathInternal } from "@react-navigation/native";
import * as Linking from "expo-linking";
import { linkingConfig, linkingPrefixes } from "@/shared/lib/linking";
import type { RootTabParamList } from "./types";

const prefixes = [...linkingPrefixes, Linking.createURL("/")];

function normalizePath(path: string) {
  return path.replace(/^\//, "").split("?")[0] ?? "";
}

function queryParamsFromPath(fullPath: string): URLSearchParams {
  const q = fullPath.indexOf("?");
  if (q < 0) return new URLSearchParams();
  return new URLSearchParams(fullPath.slice(q + 1));
}

/** Map legacy root paths (custom scheme) into nested tab state. */
/** Supabase native redirect from `getOAuthRedirectUri()` / email verify when URL uses `~oauth/callback`. */
function stateForSupabaseAuthCallback(fullPath: string) {
  const withoutQuery = fullPath.split("?")[0] ?? "";
  const normalized = normalizePath(withoutQuery);
  if (!normalized) return null;
  const isOauthCallbackPath =
    normalized === "~oauth/callback" ||
    normalized.includes("~oauth/callback") ||
    normalized.endsWith("oauth/callback") ||
    normalized.includes("--/~oauth/callback");
  if (!isOauthCallbackPath) return null;
  return {
    routes: [
      {
        name: "Profile" as const,
        state: {
          routes: [{ name: "AuthEmailCallback" as const, params: undefined }],
          index: 0,
        },
      },
    ],
    index: 0,
  };
}

function stateForRootPath(fullPath: string) {
  const normalized = normalizePath(fullPath);
  if (normalized === "payment-success") {
    const nextRaw = queryParamsFromPath(fullPath).get("next");
    const next = nextRaw === "bookings" ? ("bookings" as const) : undefined;
    return {
      routes: [
        {
          name: "Cart" as const,
          state: {
            routes: [{ name: "PaymentSuccess" as const, params: next ? { next } : undefined }],
            index: 0,
          },
        },
      ],
      index: 0,
    };
  }
  if (normalized === "payment-canceled") {
    return {
      routes: [
        {
          name: "Cart" as const,
          state: { routes: [{ name: "PaymentCanceled" as const }], index: 0 },
        },
      ],
      index: 0,
    };
  }
  return null;
}

export const linking: LinkingOptions<RootTabParamList> = {
  prefixes,
  config: linkingConfig,
  getStateFromPath(path, _options) {
    const direct = stateForRootPath(path);
    if (direct) {
      return direct as ReturnType<typeof getStateFromPathInternal>;
    }
    const authCallback = stateForSupabaseAuthCallback(path);
    if (authCallback) {
      return authCallback as ReturnType<typeof getStateFromPathInternal>;
    }
    return getStateFromPathInternal(path, linkingConfig as Parameters<typeof getStateFromPathInternal>[1]);
  },
};

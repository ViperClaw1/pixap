import type { LinkingOptions } from "@react-navigation/native";
import { getStateFromPath as getStateFromPathInternal } from "@react-navigation/native";
import * as Linking from "expo-linking";
import { linkingConfig, linkingPrefixes } from "@/shared/lib/linking";
import type { RootTabParamList } from "./types";

const prefixes = [...linkingPrefixes, Linking.createURL("/")];

function normalizePath(path: string) {
  const withoutQuery = path.split("?")[0] ?? path;
  if (withoutQuery.includes("://")) {
    try {
      const parsed = Linking.parse(withoutQuery);
      const pathname = parsed.path?.replace(/^\//, "") ?? "";
      if (pathname) return pathname;
    } catch {
      // fall through
    }
  }
  return withoutQuery.replace(/^\//, "");
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

const FEED_TAB_INDEX = 0;

function stateForPostDetailPath(fullPath: string) {
  const normalized = normalizePath(fullPath);
  let postId: string | null = null;
  if (normalized.startsWith("post/")) {
    const raw = normalized.slice("post/".length).split("/")[0] ?? "";
    postId = decodeURIComponent(raw).trim() || null;
  } else if (normalized === "feed") {
    postId = queryParamsFromPath(fullPath).get("focusPostId")?.trim() || null;
  }
  if (!postId) return null;
  return {
    routes: [
      {
        name: "Feed" as const,
        state: {
          routes: [{ name: "PostDetail" as const, params: { postId } }],
          index: 0,
        },
      },
    ],
    index: FEED_TAB_INDEX,
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
    const postDetail = stateForPostDetailPath(path);
    if (postDetail) {
      return postDetail as ReturnType<typeof getStateFromPathInternal>;
    }
    const authCallback = stateForSupabaseAuthCallback(path);
    if (authCallback) {
      return authCallback as ReturnType<typeof getStateFromPathInternal>;
    }
    return getStateFromPathInternal(path, linkingConfig as Parameters<typeof getStateFromPathInternal>[1]);
  },
};

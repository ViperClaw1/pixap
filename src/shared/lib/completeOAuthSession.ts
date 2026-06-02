import * as Linking from "expo-linking";
import { supabase } from "@/shared/api/supabase/client";
import { devError, devInfo } from "@/shared/lib/devLog";

type OAuthCompleteResult = { ok: true } | { ok: false; message: string };

let oauthExchangePromise: Promise<OAuthCompleteResult> | null = null;

/**
 * Finishes Supabase OAuth from the callback URL returned by the auth session
 * (PKCE `code` in query) or implicit-style tokens in the URL hash.
 */
export async function completeOAuthFromCallbackUrl(
  href: string | null,
): Promise<OAuthCompleteResult> {
  if (!href) return { ok: false, message: "Missing callback URL" };

  if (oauthExchangePromise) {
    devInfo("[OAuth][complete] exchange already in progress, joining existing request");
    return oauthExchangePromise;
  }

  oauthExchangePromise = completeOAuthFromCallbackUrlUnsafe(href).finally(() => {
    oauthExchangePromise = null;
  });
  return oauthExchangePromise;
}

async function completeOAuthFromCallbackUrlUnsafe(href: string | null): Promise<OAuthCompleteResult> {
  devInfo("[OAuth][complete] incoming href:", href ?? "null");
  if (!href) return { ok: false, message: "Missing callback URL" };

  const parsed = Linking.parse(href);
  const qp = parsed.queryParams ?? {};
  const code = firstString(qp.code);
  const errorParam = firstString(qp.error);
  const errorDesc = firstString(qp.error_description);
  devInfo(
    "[OAuth][complete] hasCode:",
    Boolean(code),
    "error:",
    errorParam ?? "none",
    "path:",
    parsed.path ?? "n/a",
  );

  if (errorParam) {
    return { ok: false, message: decodeOAuthErrorMessage(errorDesc ?? errorParam) };
  }

  if (code) {
    const {
      data: { session: existingSession },
    } = await supabase.auth.getSession();
    if (existingSession?.access_token) {
      devInfo("[OAuth][complete] session already active, skip code exchange");
      return { ok: true };
    }

    const { error } = await supabase.auth.exchangeCodeForSession(href);
    if (error) {
      const {
        data: { session: sessionAfterError },
      } = await supabase.auth.getSession();
      if (sessionAfterError?.access_token) {
        devInfo(
          "[OAuth][complete] exchangeCodeForSession failed but session exists (likely duplicate callback):",
          error.message,
        );
        return { ok: true };
      }
      devError("[OAuth][complete] exchangeCodeForSession error:", error.message);
      return { ok: false, message: error.message };
    }
    devInfo("[OAuth][complete] exchangeCodeForSession success");
    return { ok: true };
  }

  if (href.includes("#")) {
    const frag = href.split("#")[1] ?? "";
    const hp = new URLSearchParams(frag);
    const accessToken = hp.get("access_token");
    const refreshToken = hp.get("refresh_token");
    if (accessToken && refreshToken) {
      const { error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
      if (error) {
        devError("[OAuth][complete] setSession error:", error.message);
        return { ok: false, message: error.message };
      }
      devInfo("[OAuth][complete] setSession success from hash tokens");
      return { ok: true };
    }
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (session) return { ok: true };

  return { ok: false, message: "No OAuth code or tokens in callback URL" };
}

function decodeOAuthErrorMessage(raw: string): string {
  try {
    return decodeURIComponent(raw.replace(/\+/g, " "));
  } catch {
    return raw;
  }
}

function firstString(v: string | string[] | undefined): string | null {
  if (typeof v === "string") return v;
  if (Array.isArray(v) && typeof v[0] === "string") return v[0];
  return null;
}

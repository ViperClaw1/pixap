/** True when this URL likely carries Supabase email verify / magic link / recovery tokens and should hit `AuthEmailCallback`. */

export function shouldRouteToAuthEmailCallback(href: string): boolean {
  const trimmed = href.trim();
  if (!trimmed) return false;

  const pathname = pathnameFromHref(trimmed);

  const lower = trimmed.toLowerCase();
  if (lower.includes("auth-email-callback")) return true;

  const hasImplicitOrPkceTokens =
    /[#&?]access_token=/i.test(trimmed) ||
    /[#&?]refresh_token=/i.test(trimmed) ||
    /[?&#]code=/i.test(trimmed);

  const hostOk =
    /^https:\/\/(www\.)?pixapp\.kz\b/i.test(trimmed) ||
    /^pixap:\/\//i.test(trimmed) ||
    trimmed.startsWith("exp://");

  /** `~oauth/callback` from `getOAuthRedirectUri()` — only when PKCE `code` or hash tokens are present and host is ours. */
  if (trimmed.includes("oauth/callback") || pathname.includes("oauth/callback")) {
    if (!hostOk || !hasImplicitOrPkceTokens) return false;
    return true;
  }

  if (!hasImplicitOrPkceTokens) return false;

  /* Root or unknown path on our site still opens the app Home tab unless we reroute — treat as auth callback when tokens are present. */
  const pathOk =
    !pathname ||
    pathname === "/" ||
    pathname === "/profile" ||
    pathname.startsWith("/profile/");

  return hostOk && pathOk;
}

function pathnameFromHref(href: string): string {
  try {
    return new URL(href).pathname;
  } catch {
    /* Expo may pass scheme-only URLs — fall back */
    const noHash = href.split("#")[0] ?? "";
    const pathStart = noHash.indexOf("/", noHash.indexOf("://") + 3);
    if (pathStart < 0) return "";
    const q = noHash.indexOf("?", pathStart);
    const end = q < 0 ? noHash.length : q;
    return noHash.slice(pathStart, end);
  }
}

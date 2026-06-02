const HANDLED_TTL_MS = 10_000;

let lastHandledKey: string | null = null;
let lastHandledAt = 0;

function normalizeOAuthCallbackHref(href: string): string {
  const trimmed = href.trim();
  try {
    const url = new URL(trimmed);
    url.hash = "";
    return url.toString();
  } catch {
    const noHash = trimmed.split("#")[0] ?? trimmed;
    return noHash;
  }
}

/** Mark an OAuth callback URL as already handled inline (e.g. from WebBrowser in AuthPage). */
export function markOAuthCallbackHandled(href: string): void {
  const key = normalizeOAuthCallbackHref(href);
  if (!key) return;
  lastHandledKey = key;
  lastHandledAt = Date.now();
}

/** True when this callback URL was recently handled in-app and deep links should be ignored. */
export function isOAuthCallbackHandled(href: string): boolean {
  const key = normalizeOAuthCallbackHref(href);
  if (!key || !lastHandledKey) return false;
  if (Date.now() - lastHandledAt > HANDLED_TTL_MS) return false;
  return key === lastHandledKey;
}
